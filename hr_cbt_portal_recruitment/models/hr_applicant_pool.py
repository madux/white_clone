# -*- coding: utf-8 -*-
from odoo import http
from datetime import date, datetime
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError


class ApplicantPool(models.Model):
    _name = "hr.applicant.pool"
    _order = "id asc"
    _rec_name = "first_name"

    # name = fields.Char("Name")
    first_name = fields.Char("Employee First Name")
    last_name = fields.Char("Employee Last Name")
    middle_name = fields.Char("Employee Middle Name")
    phone_number = fields.Char("Phone")
    email = fields.Char("Email")
    # has_completed_nysc = fields.Boolean("has completed nysc")
    has_completed_nysc = fields.Char("NYSC Status")
    linkedin_account = fields.Char("Linkedin")
    brief_introduction = fields.Text("Introduction")
    applicant_ipaddress = fields.Text("Ip Address")
    applied_date = fields.Date("Applied Date", default=fields.Date.today())
    applicant_cv_link = fields.Char("CV Link", 
                             help="""Used to store the url of the applicant for 
                             cbt: /applicantId/Link i.e /5/213r423wqsffbjmdfcefbgrfvcdfsbgnfbvdvbrgfnhadhfgjr1234""")
    age = fields.Char(string="Age")
    state = fields.Char(string="State", default="draft")
    position_applied = fields.Char(string="Position applied")
    worked_at_organisation = fields.Selection([
        ('yes', 'Yes'), ('no', 'No')],
        string="worked at Our Organisation?",
        default='no')
    
    def create_applicant(self):
        applicant_name =  f'{self.first_name} {self.middle_name} {self.last_name}'
        vals = {
				"partner_name": applicant_name,
				"name": f'Application for {applicant_name}',
				"first_name": self.first_name.strip(),
				"last_name": self.last_name.strip(),
				"middle_name": self.last_name,
				"applicant_cv_link": self.applicant_cv_link,
				"email_from": self.email.strip(),
				"partner_phone": self.phone_number.strip(),
				"linkedin_account": self.linkedin_account,
				"has_completed_nysc": self.has_completed_nysc.strip(),
                "applicant_ipaddress": self.applicant_ipaddress,
			}
        applicant = self.env['hr.applicant'].sudo().create(vals)
        view_id_tree = self.env.ref('hr_recruitment.crm_case_tree_view_job')
        view_id_form = self.env.ref('hr_recruitment.hr_applicant_view_form')
        return {
            'type': 'ir.actions.act_window',
            'name': _('Applicant from pool'),
            'res_model': 'hr.applicant',
            'view_type': 'form',
            'view_mode': 'tree,form',
            'view_id': view_id_tree.id,
            'views': [(view_id_tree.id, 'tree'), (view_id_form.id,'form')],
            'target': 'current',
            'domain': [applicant.id]
            }
        
    
        