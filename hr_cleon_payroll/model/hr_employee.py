from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)

class HrGrade(models.Model):
    _name = 'hr.grade'
    _description = "HR GRADE"

    name = fields.Char("Name", required=True)


class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    
    hmo_enrollment_ids = fields.One2many("hmo.enrollment", 'employee_id', string="Enrollments")