from odoo import fields, models


class HrClaimApprovalWizard(models.TransientModel):
    """Support the approve claim interaction."""

    _name = "hr.claim.approval.wizard"
    _description = "Approve Claim"

    claim_id = fields.Many2one("hr.claim", required=True, readonly=True)
    comment = fields.Text()

    def action_confirm(self):
        """Confirm an eligible record and apply its workflow side effects."""
        self.ensure_one()
        self.claim_id.action_approve(self.comment)
        return {"type": "ir.actions.act_window_close"}
