from odoo import fields, models


class SocialGalleryTrustedUser(models.Model):
    _name = "social.gallery.trusted.user"
    _description = "Social Gallery Trusted User"
    _order = "user_id"

    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    user_id = fields.Many2one("res.users", required=True, index=True)
    notes = fields.Char()

    _sql_constraints = [
        ("user_company_uniq", "unique(user_id, company_id)", "User is already trusted for this company."),
    ]
