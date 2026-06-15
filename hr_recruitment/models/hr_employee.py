from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)
 
class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    
    hr_warning_ids = fields.One2many("hr.warning", 'employee_id', string="Disciplinary Actions")