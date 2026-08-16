from odoo import fields, models


class HrClaimRejectWizard(models.TransientModel):
    """Support the reject or return claim interaction."""

    _name = "hr.claim.reject.wizard"
    _description = "Reject or Return Claim"

    claim_id = fields.Many2one("hr.claim", required=True, readonly=True)
    decision = fields.Selection(
        [("reject", "Reject"), ("return", "Return for Correction")],
        required=True,
        default="reject",
    )
    reason = fields.Text(required=True)

    def action_confirm(self):
        """Confirm an eligible record and apply its workflow side effects."""
        self.ensure_one()
        self.claim_id._apply_negative_decision(self.decision, self.reason)
        return {"type": "ir.actions.act_window_close"}
