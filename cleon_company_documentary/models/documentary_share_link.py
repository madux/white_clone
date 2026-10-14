from odoo import fields, models


class CompanyDocumentaryShareLink(models.Model):
    _name = "company.documentary.share.link"
    _description = "Company Documentary Share Link"
    _order = "create_date desc"

    media_id = fields.Many2one(
        "company.documentary.media",
        required=True,
        ondelete="cascade",
        index=True,
    )
    company_id = fields.Many2one(related="media_id.company_id", store=True, index=True)
    link_type = fields.Selection(
        [("internal", "Internal"), ("external", "External")],
        required=True,
        default="internal",
        index=True,
    )
    token = fields.Char(required=True, index=True, copy=False)
    created_by_id = fields.Many2one("res.users", required=True, readonly=True)
    expires_at = fields.Datetime(index=True)
    revoked_at = fields.Datetime()
    revoked_by_id = fields.Many2one("res.users", readonly=True)
    open_count = fields.Integer(default=0)

    def is_active(self):
        self.ensure_one()
        if self.revoked_at:
            return False
        if self.link_type == "external" and self.expires_at:
            return fields.Datetime.now() <= self.expires_at
        return True
