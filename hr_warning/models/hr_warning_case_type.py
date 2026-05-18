# -*- coding: utf-8 -*-
from odoo import models, fields


class HrWarningCaseType(models.Model):
    """
    Configurable case/incident types (e.g. Misconduct, Harassment, Theft).
    HR managers create these once; users pick one when filing an incident.
    """
    _name = 'hr.warning.case.type'
    _description = 'HR Warning Case Type'
    _order = 'sequence, name'

    name = fields.Char(
        string='Case Type',
        required=True,
        translate=True,
    )
    sequence = fields.Integer(
        string='Sequence',
        default=10,
    )
    categories = fields.Selection(
        selection=[
            ('attendance', 'Attendance'),
            ('conduct', 'Conduct'),
            ('performance', 'Performance'),
            ('assets', 'Assets'),
            ('it_security', 'IT Security'),
            ('ethics', 'Ethics'),
            ('safety', 'Safety'),
            ('professionalism', 'Professionalism'),
            ('financial', 'Financial'),
        ],
        string='Category',
        tracking=True,
        default="conduct"
    )
    code = fields.Char(
        string='Code',
        help='Short reference code, e.g. MISC, HARASS, THEFT',
    )
    ai_generated = fields.Boolean(default=False)
    
    description = fields.Text(
        string='Description',
        size=20,
        help='Describe when this case type should be used.',
    )
    color = fields.Integer(
        string='Color Index',
        default=0,
    )
    country_id = fields.Many2one(
         'res.country',
        string='Applicable Country', 
    )
    active = fields.Boolean(
        string='Active',
        default=True,
    )
    warning_count = fields.Integer(
        string='Incidents',
        compute='_compute_warning_count',
    )

    def _compute_warning_count(self):
        Warning = self.env['hr.warning']
        for rec in self:
            rec.warning_count = Warning.search_count(
                [('case_type_id', '=', rec.id)]
            )

    def action_view_warnings(self):
        return {
            'type': 'ir.actions.act_window',
            'name': f'Incidents — {self.name}',
            'res_model': 'hr.warning',
            'view_mode': 'tree,form',
            'domain': [('case_type_id', '=', self.id)],
        }
