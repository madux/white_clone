# -*- coding: utf-8 -*-
from odoo import models, fields, api


class GrievanceType(models.Model):
    _name = 'grievance.type'
    _description = 'Grievance Type'
    _order = 'name'

    name = fields.Char(required=True, translate=True)
    category_id = fields.Many2one('grievance.category', string='Category', ondelete='restrict')
    default_priority = fields.Selection([
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ], default='medium', string='Default Priority', required=True)
    active = fields.Boolean(default=True)
    is_locked = fields.Boolean(string='System Type', default=False,
                                help="System-defined types cannot be removed, only archived.")
    case_ids = fields.One2many('grievance.case', 'grievance_type_id', string='Cases')
    case_count = fields.Integer(compute='_compute_case_counts', string='# Cases')
    active_case_count = fields.Integer(compute='_compute_case_counts', string='# Active Cases')

    @api.depends('case_ids', 'case_ids.stage_id.is_closed')
    def _compute_case_counts(self):
        for rec in self:
            rec.case_count = len(rec.case_ids)
            rec.active_case_count = len(rec.case_ids.filtered(lambda c: not c.stage_id.is_closed))
