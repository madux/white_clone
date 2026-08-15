from odoo import fields, models


class HrClaimPaymentWizard(models.TransientModel):
    _name = "hr.claim.payment.wizard"
    _description = "Register Claim Payment"

    claim_id = fields.Many2one("hr.claim", required=True, readonly=True)
    currency_id = fields.Many2one(related="claim_id.currency_id", readonly=True)
    amount = fields.Monetary(required=True, currency_field="currency_id")
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
    )
    payment_date = fields.Date(required=True, default=fields.Date.context_today)
    reference = fields.Char()
    notes = fields.Text()

    def action_register_payment(self):
        self.ensure_one()
        payment = self.env["hr.claim.payment"].create(
            {
                "claim_id": self.claim_id.id,
                "amount": self.amount,
                "payment_method": self.payment_method,
                "payment_date": self.payment_date,
                "reference": self.reference,
                "notes": self.notes,
            }
        )
        payment.action_confirm()
        return {"type": "ir.actions.act_window_close"}

