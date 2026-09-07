from odoo import fields, models


class CompanyDocumentaryTag(models.Model):
    _name = "company.documentary.tag"
    _description = "Company Documentary Tag"
    _order = "name"

    name = fields.Char(required=True, index=True)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    color = fields.Integer(default=0)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "company_documentary_tag_name_company_uniq",
            "unique(name, company_id)",
            "A documentary tag must be unique within a company.",
        )
    ]
