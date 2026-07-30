# -*- coding: utf-8 -*-

from datetime import date, datetime
from odoo import models, fields, api, _



from datetime import datetime, timedelta
import time
import base64
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT
from odoo import models, fields, api, _, SUPERUSER_ID
from odoo.exceptions import ValidationError
from odoo import http
import logging
from lxml import etree
import random

_logger = logging.getLogger(__name__)


# class HrEmployee(models.Model):
#     _inherit = "hr.employee.public"

#     request_id = fields.Many2one('hr.job.recruitment.request', string="Recruitment Request", index=True)

    
class HrEmployeeBase(models.AbstractModel):
    _inherit = "hr.employee.base"

    request_id = fields.Many2one('hr.job.recruitment.request', string="Recruitment Request", index=True)
    applicant_documentation_checklist = fields.Many2many(
        'hr.applicant.documentation', 
        'hr_employee_documentation_rel', 
        'employee_id', 
        'hr_documentation_id', 
        string='Documentations'
        ) 
    employee_number = fields.Char(
        string="Staff Number", 
        )
    
class HrEmployee(models.Model):
    _inherit = "hr.employee"

    request_id = fields.Many2one('hr.job.recruitment.request', string="Recruitment Request", index=True)
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
    wage = fields.Float(string='Wage', default="100")
    
    skills_text = fields.Text(string='Extracted Skills')
    qualifications_text = fields.Text(string='Extracted Qualifications')
    experience_text = fields.Text(string='Extracted Experience')
    # employee_signature_count = fields.Integer(compute='_compute_employee_signature_count', string="# Signatures")

    # def _compute_employee_signature_count(self):
    #     if self.user_id.partner_id:
    #         request_ids = self.env['sign.request.item'].search_count([('partner_id', '=', self.user_id.partner_id.id)])#.mapped('sign_request_id')
    #         self.employee_signature_count = request_ids
    #     else:
    #         self.employee_signature_count = 0
    #     # signature_data = self.env['sign.request.item'].sudo().read_group([('partner_id', '=', self.partner_id.id)], ['partner_id'], ['partner_id'])
    #     # signature_data_mapped = dict((data['partner_id'][0], data['partner_id_count']) for data in signature_data)
    #     # for partner in self:
    #     #     partner.signature_count = signature_data_mapped.get(partner.id, 0)

    # def action_related_signatures(self):
    #     self.ensure_one()
    #     request_ids = self.env['sign.request.item'].search([('partner_id', '=', self.user_id.partner_id.id)])#.mapped('sign_request_id')
    #     return {
    #         'type': 'ir.actions.act_window',
    #         'name': _('Signature(s)'),
    #         'view_mode': 'kanban,tree,form',
    #         'res_model': 'sign.request',
    #         'domain': [('id', 'in', request_ids.ids)],
    #         'context': {
    #             'search_default_reference': self.name,
    #             'search_default_signed': 1,
    #             'search_default_in_progress': 1,
    #         },
    #     }