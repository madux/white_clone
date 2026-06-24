from odoo import models, fields, api,_
from odoo.exceptions import ValidationError, UserError


class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    skills_text = fields.Text(string='Extracted Skills')
    qualifications_text = fields.Text(string='Extracted Qualifications')
    experience_text = fields.Text(string='Extracted Experience')