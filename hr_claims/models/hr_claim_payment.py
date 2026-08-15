from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError


class HrClaimPayment(models.Model):
    _name = "hr.claim.payment"
    _description = "Claim Payment"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "payment_date desc, id desc"
    _check_company_auto = True

    name = fields.Char(default="New", readonly=True, copy=False, index=True)
    claim_id = fields.Many2one(
        "hr.claim", required=True, ondelete="restrict", tracking=True, check_company=True
    )
    employee_id = fields.Many2one(
        related="claim_id.employee_id", store=True, readonly=True, index=True
    )
    company_id = fields.Many2one(
        related="claim_id.company_id", store=True, readonly=True, index=True
    )
    currency_id = fields.Many2one(
        related="claim_id.currency_id", store=True, readonly=True
    )
    amount = fields.Monetary(required=True, currency_field="currency_id", tracking=True)
    payment_method = fields.Selection(
        [
            ("bank", "Bank Transfer"),
            ("payroll", "Via Payroll"),
            ("cheque", "Cheque"),
            ("card", "Expense Card Top-up"),
            ("cash", "Cash Payment"),
        ],
        required=True,
        default="bank",
        tracking=True,
    )
    payment_date = fields.Date(required=True, default=fields.Date.context_today, tracking=True)
    reference = fields.Char(tracking=True)
    notes = fields.Text()
    state = fields.Selection(
        [("draft", "Draft"), ("completed", "Completed"), ("cancelled", "Cancelled")],
        required=True,
        default="draft",
        tracking=True,
        copy=False,
        index=True,
    )
    processed_by_id = fields.Many2one("res.users", readonly=True, copy=False)

    _sql_constraints = [
        ("name_unique", "unique(name)", "Payment reference must be unique."),
    ]

    @api.constrains("amount")
    def _check_amount(self):
        if any(payment.amount <= 0 for payment in self):
            raise ValidationError("Payment amount must be positive.")

    @api.model_create_multi
    def create(self, vals_list):
        if not (
            self.env.user.has_group("hr_claims.group_hr_claim_finance")
            or self.env.user.has_group("hr_claims.group_hr_claim_admin")
        ):
            raise AccessError("Only Finance or an Administrator can create payments.")
        for vals in vals_list:
            if vals.get("name", "New") == "New":
                vals["name"] = self.env["ir.sequence"].next_by_code("hr.claim.payment") or "New"
        return super().create(vals_list)

    def action_confirm(self):
        if not (
            self.env.user.has_group("hr_claims.group_hr_claim_finance")
            or self.env.user.has_group("hr_claims.group_hr_claim_admin")
        ):
            raise AccessError("Only Finance or an Administrator can process payments.")
        for payment in self:
            if payment.state != "draft":
                raise UserError("Only Draft payments can be confirmed.")
            claim = payment.claim_id
            if claim.state not in ("approved", "paid") or not claim.claim_type_id.reimbursable:
                raise UserError("The claim is not eligible for payment.")
            if claim.currency_id.compare_amounts(payment.amount, claim.residual_amount) > 0:
                raise UserError("Payment amount cannot exceed the outstanding claim amount.")
            payment.write(
                {"state": "completed", "processed_by_id": self.env.user.id}
            )
            claim.invalidate_recordset(["amount_paid", "residual_amount", "payment_state"])
            claim._log_action("payment", _("Payment %s processed.") % payment.name)
            claim.message_post(
                body=_("Payment %s for %s was processed.") % (payment.name, payment.amount)
            )
            if claim.currency_id.compare_amounts(claim.amount_paid, claim.amount_total) >= 0:
                claim.sudo().with_context(hr_claim_workflow=True).write(
                    {"state": "paid", "paid_date": fields.Datetime.now()}
                )
                claim._log_action("paid", _("Claim paid in full."))
        return True

    def action_cancel(self):
        for payment in self:
            if payment.state != "draft":
                raise UserError("Only Draft payments can be cancelled.")
            payment.state = "cancelled"
        return True

