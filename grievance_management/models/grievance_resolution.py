# -*- coding: utf-8 -*-
from odoo import models, fields


class GrievanceResolution(models.Model):
    _name = 'grievance.resolution'
    _description = 'Grievance Resolution Definition'
    _order = 'name'

    name = fields.Char(required=True, translate=True, string='Resolution Name')
    description = fields.Text(required=True, string='Description',
                               help="Short description shown on the resolution card.")
    requires_compensation_amount = fields.Boolean(string='Requires Compensation Amount?')
    requires_followup_date = fields.Boolean(string='Requires Follow-Up Date?')
    requires_restorative_action = fields.Boolean(string='Requires Restorative Action Plan?')
    is_locked = fields.Boolean(string='System Definition', default=False,
                                help="System-defined resolutions cannot be deleted, only archived.")
    active = fields.Boolean(default=True)
    case_count = fields.Integer(compute='_compute_case_count', string='# Cases')

    def _compute_case_count(self):
        Case = self.env['grievance.case']
        for rec in self:
            rec.case_count = Case.search_count([('resolution_id', '=', rec.id)])
