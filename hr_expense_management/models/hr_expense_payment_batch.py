from odoo import _, api, fields, models
from odoo.exceptions import UserError


class HrExpensePaymentMethod(models.Model):
    _name = "hr.expense.payment.method"
    _description = "Expense Payment Method"
    _order = "sequence, name"
    _check_company_auto = True

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    method_type = fields.Selection(
        [("bank", "Bank Transfer"), ("payroll", "Payroll"),
         ("cash", "Cash"), ("cheque", "Cheque")],
        default="bank", required=True,
    )
    supports_batch = fields.Boolean(default=True)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )

    _sql_constraints = [
        ("expense_payment_method_code_company_uniq", "unique(code, company_id)", "Payment method code must be unique per company."),
    ]


class HrExpensePaymentBatch(models.Model):
    _name = "hr.expense.payment.batch"
    _description = "Expense Payment Batch"
    _inherit = ["mail.thread", "mail.activity.mixin", "hr.expense.security.mixin"]
    _order = "create_date desc, id desc"
    _check_company_auto = True

    name = fields.Char(default="New", readonly=True, copy=False, index=True)
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)
    currency_id = fields.Many2one(related="company_id.currency_id", store=True, readonly=True)
    method_id = fields.Many2one("hr.expense.payment.method", required=True, check_company=True)
    claim_ids = fields.Many2many("hr.claim", string="Claims", check_company=True)
    payment_ids = fields.One2many("hr.claim.payment", "batch_id", string="Payments")
    total_amount = fields.Monetary(compute="_compute_totals", store=True, currency_field="currency_id")
    claim_count = fields.Integer(compute="_compute_totals", store=True)
    state = fields.Selection(
        [("draft", "Draft"), ("validated", "Validated"), ("processing", "Processing"),
         ("completed", "Completed"), ("partial", "Partially Failed"),
         ("failed", "Failed"), ("cancelled", "Cancelled")],
        default="draft", required=True, tracking=True, copy=False, index=True,
    )
    reference = fields.Char(tracking=True)
    processed_by_id = fields.Many2one("res.users", readonly=True)
    processed_date = fields.Datetime(readonly=True)
    result_log = fields.Text(readonly=True)

    @api.depends("claim_ids", "claim_ids.residual_amount")
    def _compute_totals(self):
        for batch in self:
            batch.claim_count = len(batch.claim_ids)
            batch.total_amount = sum(batch.claim_ids.mapped("residual_amount"))

    @api.model_create_multi
    def create(self, vals_list):
        self._check_finance()
        for vals in vals_list:
            if vals.get("name", "New") == "New":
                vals["name"] = self.env["ir.sequence"].next_by_code("hr.expense.payment.batch") or "New"
        return super().create(vals_list)

    def _check_finance(self):
        return self._expense_check_role(
            "finance", "admin", message=_("Only Finance can process payment batches.")
        )

    def action_validate(self):
        self._check_finance()
        for batch in self:
            if batch.state != "draft" or not batch.claim_ids:
                raise UserError("A draft batch must contain at least one claim.")
            invalid = batch.claim_ids.filtered(lambda claim: claim.state != "approved" or claim.residual_amount <= 0)
            if invalid:
                raise UserError("All batch claims must be approved with an outstanding balance.")
            batch.write({"state": "validated"})
        return True

    def action_process(self):
        self._check_finance()
        for batch in self:
            if batch.state != "validated":
                raise UserError("Validate the batch before processing it.")
            batch.write({"state": "processing"})
            completed, failures = [], []
            for claim in batch.claim_ids:
                try:
                    with self.env.cr.savepoint():
                        payment = self.env["hr.claim.payment"].create({
                            "claim_id": claim.id, "amount": claim.residual_amount,
                            "payment_method": batch.method_id.method_type,
                            "batch_id": batch.id, "reference": batch.reference,
                        })
                        payment.action_confirm()
                    completed.append(claim.name)
                except Exception as error:  # keep remaining payments processable
                    failures.append(f"{claim.name}: {error}")
            state = "completed" if completed and not failures else "partial" if completed else "failed"
            batch.write({
                "state": state, "processed_by_id": self.env.user.id,
                "processed_date": fields.Datetime.now(),
                "result_log": "\n".join([*(f"Paid {name}" for name in completed), *failures]),
            })
        return True


class HrClaimPaymentBatchLink(models.Model):
    _inherit = "hr.claim.payment"

    batch_id = fields.Many2one("hr.expense.payment.batch", readonly=True, check_company=True)
