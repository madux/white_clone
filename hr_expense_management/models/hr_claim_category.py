from odoo import fields, models


class HrClaimCategory(models.Model):
    _name = "hr.claim.category"
    _description = "Claim Category"
    _order = "sequence, name"
    _check_company_auto = True

    name = fields.Char(required=True, translate=True)
    code = fields.Char(required=True)
    description = fields.Text(translate=True)
    sequence = fields.Integer(default=10)
    color = fields.Integer(default=0)
    active = fields.Boolean(default=True)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    claim_type_ids = fields.One2many("hr.claim.type", "category_id", string="Claim Types")

    _sql_constraints = [
        (
            "code_company_unique",
            "unique(code, company_id)",
            "The category code must be unique per company.",
        )
    ]

