from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging
_logger = logging.getLogger(__name__)

# class EhaBranch(models.Model):
#     _inherit = "multi.branch"


class Hrdepartment(models.Model):
    _inherit = 'hr.department'

    contact_person = fields.Char(string="Contact person", required=False, copy=False)
    contact_person_phone = fields.Char(string="Contact person phone", required=False, copy=False)
    contact_person_mail = fields.Char(string="Contact person mail", required=False, copy=False)
    department_attachment_ids = fields.Many2many(
        comodel_name='ir.attachment',
        relation='hr_department_attachment_rel',
        column1='department_id',
        column2='attachment_id',
        string='Attachments',
    ) 