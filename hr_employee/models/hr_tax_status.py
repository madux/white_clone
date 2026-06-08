from odoo import models, fields


class HrTaxStatus(models.Model):
    _name = 'hr.tax.status'
    _description = 'Tax Status'
    _rec_name = 'name'

    name = fields.Char(
        string='Tax Status',
        required=True,
    )

    code = fields.Char(
        string='Code',
        required=True,
    )

    description = fields.Text(
        string='Description'
    )

    active = fields.Boolean(
        default=True
    )
    country_ids = fields.Many2many('res.country', string="Applicable Countries")
