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

    def _lock_claims(self, claims):
        """Serialize draft allocation and confirmation for each affected claim."""
        claim_ids = sorted(set(claims.ids))
        if not claim_ids:
            return
        self.env.cr.execute(
            "SELECT id FROM hr_claim WHERE id IN %s ORDER BY id FOR UPDATE",
            [tuple(claim_ids)],
        )
        claims.invalidate_recordset(
            ["state", "payment_ids", "amount_paid", "residual_amount", "payment_state"]
        )

    def _validate_draft_exposure(self, claims=None):
        claims = claims or self.mapped("claim_id")
        for claim in claims:
            claim.invalidate_recordset(
                ["payment_ids", "amount_paid", "residual_amount", "payment_state"]
            )
            draft_total = sum(
                claim.payment_ids.filtered(lambda payment: payment.state == "draft").mapped(
                    "amount"
                )
            )
            if claim.currency_id.compare_amounts(
                draft_total, claim.residual_amount
            ) > 0:
                raise UserError(
                    "Draft payments cannot exceed the outstanding claim amount."
                )

    @api.model_create_multi
    def create(self, vals_list):
        if not (
            self.env.user.has_group("hr_expense_management.group_hr_expense_finance")
            or self.env.user.has_group("hr_expense_management.group_hr_expense_admin")
        ):
            raise AccessError("Only Finance or an Administrator can create payments.")
        claims = self.env["hr.claim"].browse(
            sorted({vals["claim_id"] for vals in vals_list if vals.get("claim_id")})
        )
        self._lock_claims(claims)
        for vals in vals_list:
            vals["state"] = "draft"
            vals.pop("processed_by_id", None)
            if vals.get("name", "New") == "New":
                vals["name"] = self.env["ir.sequence"].next_by_code("hr.claim.payment") or "New"
        payments = super().create(vals_list)
        payments._validate_draft_exposure(claims)
        return payments

    def write(self, vals):
        claims = self.mapped("claim_id")
        if vals.get("claim_id"):
            claims |= self.env["hr.claim"].browse(vals["claim_id"])
        if not self.env.su:
            if "state" in vals:
                raise AccessError("Payment states can only be changed through workflow actions.")
            if any(payment.state != "draft" for payment in self):
                raise AccessError("Completed or cancelled payments are immutable.")
        validate_exposure = bool({"amount", "claim_id"}.intersection(vals))
        if validate_exposure:
            self._lock_claims(claims)
        result = super().write(vals)
        if validate_exposure:
            self._validate_draft_exposure(claims | self.mapped("claim_id"))
        return result

    def unlink(self):
        if any(payment.state != "draft" for payment in self):
            raise AccessError("Only Draft payments can be deleted.")
        return super().unlink()

    def _workflow_write(self, vals):
        return super().write(vals)

    def action_confirm(self):
        if not (
            self.env.user.has_group("hr_expense_management.group_hr_expense_finance")
            or self.env.user.has_group("hr_expense_management.group_hr_expense_admin")
        ):
            raise AccessError("Only Finance or an Administrator can process payments.")
        claims = self.mapped("claim_id")
        self._lock_claims(claims)
        self.invalidate_recordset(["state"])
        for payment in self:
            self.env["hr.expense.period"]._ensure_date_open(payment.payment_date, "payment")
            if payment.state != "draft":
                raise UserError("Only Draft payments can be confirmed.")
            claim = payment.claim_id
            if claim.state not in ("approved", "paid") or not claim.claim_type_id.reimbursable:
                raise UserError("The claim is not eligible for payment.")
            if claim.currency_id.compare_amounts(payment.amount, claim.residual_amount) > 0:
                raise UserError("Payment amount cannot exceed the outstanding claim amount.")
            payment._workflow_write(
                {"state": "completed", "processed_by_id": self.env.user.id}
            )
            claim.invalidate_recordset(["amount_paid", "residual_amount", "payment_state"])
            claim._log_action("payment", _("Payment %s processed.") % payment.name)
            claim.sudo().message_post(
                body=_("Payment %s for %s was processed.") % (payment.name, payment.amount)
            )
            if claim.currency_id.compare_amounts(claim.amount_paid, claim.amount_total) >= 0:
                claim.sudo()._workflow_write(
                    {"state": "paid", "paid_date": fields.Datetime.now()}
                )
                claim._log_action("paid", _("Claim paid in full."))
        return True

    def action_cancel(self):
        for payment in self:
            if payment.state != "draft":
                raise UserError("Only Draft payments can be cancelled.")
            payment._workflow_write({"state": "cancelled"})
        return True
