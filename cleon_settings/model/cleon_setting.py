from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)

class CleonHrsetting(models.Model):
    _name = 'cleon.setting'
    _description = 'CLEONHR Settings'
    _rec_name = 'name'

    name = fields.Char(
        string='Name',
        required=True,
        copy=True,
        index=True,
        default=lambda self: _('New'),
    )

    description = fields.Char(
        string='Description',
        required=True,
        copy=True,
    )
    sequence = fields.Integer(
        string='Sequence',
        default=1,
    )
    active = fields.Boolean(
        string='active',
        default=True,
    )
    model_id = fields.Many2one('ir.model', string="App")

    access_right_ids = fields.Many2many(
        'ir.model.access',
        string='Access Rights',
        compute='_compute_access_right_ids',
        store=True,
    )

    @api.depends('model_id')
    def _compute_access_right_ids(self):

        for rec in self:

            if rec.model_id:

                access_rights = self.env[
                    'ir.model.access'
                ].search([
                    ('model_id', '=', rec.model_id.id)
                ])

                rec.access_right_ids = [(6, 0, access_rights.ids)]

            else:
                rec.access_right_ids = [(5, 0, 0)]
 

    # @api.model
    # def create(self, vals):
    #     record = super().create(vals)

    #     model_id = self.env.ref(
    #         'hr_insurance.model_hmo_checklist'
    #     ).id

    #     access_ids = self.env['ir.model.access'].search([
    #         ('model_id', '=', model_id)
    #     ]).ids

    #     record.access_right_ids = [(6, 0, access_ids)]

    #     return record
