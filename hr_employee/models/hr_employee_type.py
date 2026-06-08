from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging
_logger = logging.getLogger(__name__)
 
class HrCoreEmploymentType(models.Model):
    _name = "hr.core_employment_type"
    _description = "HrCoreEmploymentType"
    _rec_name = "name"

    name = fields.Char(string="Type Name", placeholder="e.g Permanent (Full time)")
    code = fields.Char(string="Code", placeholder="e.g PERM-FT")
    notice_period = fields.Integer(string="Notice Period (Days)", placeholder="e.g 30 days", default=30)
    probation = fields.Float(string="Probation", placeholder="e.g 6 months", default=6)
    probation_period = fields.Selection(
        selection=[
            ('hours', 'Hours(s)'),
            ('days', 'Day(s)'),
            ('weeks', 'Weeks(s)'),
            ('months', 'Month(s)'),
            ('years', 'Years'),
        ],
        string='Probation period',
        default='months',
        tracking=True,
        copy=False,
    )
    
    benefit_ids = fields.Many2many(
        'hr.benefit',
        string='Benefits',
        copy=False,
    )
    active = fields.Boolean(
        string='Active',
        copy=False,
        default=True
    )
    description = fields.Text(
        string='Description',
        copy=False,
    )

    applicable_tax_status_ids = fields.Many2many(
        'hr.tax.status',
        string='Tax Status',
        copy=False,
    )
 
    employee_ids = fields.One2many(
        "hr.employee",
        "employee_type_id",
        string="Employees",
        copy=True,
    )
    
    country_id = fields.Many2one('res.country', string="Country")