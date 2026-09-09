from odoo import fields, models


class SocialGalleryTag(models.Model):
    _name = "social.gallery.tag"
    _description = "Social Gallery Tag"
    _order = "name"

    name = fields.Char(required=True, index=True)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    color = fields.Char(default="#e83e8c")

    _sql_constraints = [
        ("name_company_uniq", "unique(name, company_id)", "Tag names must be unique per company."),
    ]
