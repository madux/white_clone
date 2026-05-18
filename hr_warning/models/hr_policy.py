# -*- coding: utf-8 -*-
from odoo import models, fields


class HrWarningPolicy(models.Model):
    _name = 'hr.warning.policy'
    _description = 'HR Warning policy'
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
    code = fields.Char(
        string='Code',
        help='Short reference code, e.g. MISC, HARASS, THEFT',
    )
    description = fields.Text(
        string='Description',
        help='Describe when this case type should be used.',
    )
    color = fields.Integer(
        string='Color Index',
        default=0,
    )
    active = fields.Boolean(
        string='Active',
        default=True,
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
    )
    severity_level = fields.Selection(
        selection=[
            ('Minor', 'Minor'),
            ('Major', 'Major'),
            ('Severe', 'Severe'),
            ('Gross Misconduct', 'Gross Misconduct'),
        ],
        string='Severity level',
        default='',
        tracking=True,
    )