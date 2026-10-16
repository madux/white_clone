# -*- coding: utf-8 -*-
from odoo import models, fields, api


class GrievanceCategory(models.Model):
    _name = 'grievance.category'
    _description = 'Grievance Category'
    _order = 'name'

    name = fields.Char(required=True, translate=True)
    description = fields.Text()
    type_ids = fields.One2many('grievance.type', 'category_id', string='Grievance Types')
    type_count = fields.Integer(compute='_compute_type_count', string='# Types')
    active = fields.Boolean(default=True, string='Active',
                             help="Untick to archive this category instead of deleting it.")

    @api.depends('type_ids')
    def _compute_type_count(self):
        for rec in self:
            rec.type_count = len(rec.type_ids)
