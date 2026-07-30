from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)  

class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    @api.constrains('employee_number')
    def _check_duplicate_employee_number(self):
        employee = self.env['hr.employee'].sudo()
        if self.employee_number not in ["", False]:
            duplicate_employee = employee.search([('employee_number', '=', self.employee_number)], limit=2)
            if len([r for r in duplicate_employee]) > 1:
                raise ValidationError("Employee with same staff ID already existing")

    employee_number = fields.Char(
        string="Staff Number", 
        )