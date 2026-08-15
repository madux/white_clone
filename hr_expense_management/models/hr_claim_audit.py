from odoo import fields, models
from odoo.exceptions import AccessError


class HrClaimAudit(models.Model):
    _name = "hr.claim.audit"
    _description = "Claim Audit Event"
    _order = "date desc, id desc"
    _check_company_auto = True

    claim_id = fields.Many2one(
        "hr.claim", required=True, ondelete="cascade", index=True, check_company=True
    )
    action = fields.Selection(
        [
            ("created", "Created"),
            ("submitted", "Submitted"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("returned", "Returned"),
            ("resubmitted", "Resubmitted"),
            ("appealed", "Appealed"),
            ("withdrawn", "Withdrawn"),
            ("cancelled", "Cancelled"),
            ("payment", "Payment Processed"),
            ("paid", "Paid"),
        ],
        required=True,
        index=True,
    )
    description = fields.Text(required=True)
    user_id = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user, index=True
    )
    date = fields.Datetime(required=True, default=fields.Datetime.now, index=True)
    company_id = fields.Many2one(
        related="claim_id.company_id", store=True, readonly=True, index=True
    )

    def write(self, vals):
        raise AccessError("Claim audit entries are immutable.")

    def unlink(self):
        if self.env.context.get("uninstall_mode"):
            return super().unlink()
        raise AccessError("Claim audit entries are immutable.")
