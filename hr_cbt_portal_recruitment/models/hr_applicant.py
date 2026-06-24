# -*- coding: utf-8 -*-
from odoo import http
from datetime import date, datetime
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError


class Applicant(models.Model):
    _inherit = "hr.applicant"
    _order = "id asc"
    _rec_name = "partner_name"

    @api.onchange(
        'first_name','middle_name', 'last_name'
        )
    def onchange_of_applicants_name(self):
        fn, mm, ln = "", "", ""
        if self.first_name:
            fn = self.first_name
        if self.middle_name:
            mm = self.middle_name
        if self.last_name:
            ln = self.last_name
        self.partner_name = f'{fn} {mm} {ln}'

    cbt_scheduled_date = fields.Date("CBT Scheduled Date ")
    shared_url = fields.Char("Shared Url", 
                             help="""Used to store the url of the applicant for 
                             cbt: /applicantId/Link i.e /5/213r423wqsffbjmdfcefbgrfvcdfsbgnfbvdvbrgfnhadhfgjr1234""")
    applicant_question_line_ids = fields.One2many(
        'cbt.question.line',
        'hr_applicant_id',
        string="Question line",
        required=False,
    )
    cbt_template_config_id = fields.Many2one(
        'cbt.template.config',
        string="CBT Template",
        required=False,
    )
    survey_user_input_id = fields.Many2one(
        'survey.user_input',
        string="Survey Test",
        required=False,
    )
    survey_panelist_input_ids = fields.One2many(
        'panelist.score_sheet',
        'applicant_id',
        help="Used in storing panelist survey",
        string="Panelist Survey Tests",
        required=False,
    )
    test_started = fields.Boolean(
        "Test Started", 
        readonly=True, 
        help="used to check if application test has been set")
     
    cbt_start_date = fields.Datetime("CBT Start Date")
    cbt_end_date = fields.Datetime("CBT End Date ")
    duration = fields.Integer("Duration")

    current_salary = fields.Float("Current Salary ", group_operator="avg", help="Current Salary")
    first_name = fields.Char("First Name")
    middle_name = fields.Char("Middle Name")
    last_name = fields.Char("Last Name")
    applicant_code = fields.Char("Applicant's Code")
    has_completed_nysc = fields.Selection([('Yes', 'Yes'), ('No', 'No')], string="Completed NYSC",default="No")
    know_anyone_at_organisation = fields.Selection([
        ('Yes', 'Yes'), ('No', 'No')],
        string="Know anyone at Our Organisation?",
        default=False)
    linkedin_account = fields.Char("Linkedin")
    specify_personal_personality = fields.Text("Provide Details")
    relationship_type = fields.Selection([
        ('father', 'Father'), 
        ('mother', 'Mother'),
        ('sister', 'Sister'),
        ('spouse', 'Spouse'),
        ('friend', 'Friend'),
        ('uncle', 'Uncle'),
        ('others', 'Others'),
        ], "Relationship Type")
    image_1920 = fields.Image(string="Image", max_width=1024, max_height=1024)
    degree_in_relevant_field = fields.Selection([('Yes', 'Yes'), ('No', 'No')], string="Degree in relevant field")
    specifylevel_qualification = fields.Text("Total years of Experience")
    knowledge_description = fields.Text("What is your Knowledge of this Role")
    presentlocation = fields.Char("Present Location")
    reside_job_location = fields.Selection([('Yes', 'Yes'), ('No', 'No')], 
                                           string="Reside within Job location",
                                           default=False
                                           )
    relocation_plans = fields.Selection(
        [('Yes', 'Yes'), ('No', 'No')], string="Relocation Plans")
    resumption_period = fields.Char("Resumption period, if successful")
    reference_name = fields.Char("Reference name")
    reference_title = fields.Char("Reference Title")
    reference_email = fields.Char("Reference email")
    reference_phone = fields.Char("Reference Phone")
    test_passed = fields.Boolean(string="Test Passed", related="survey_user_input_id.scoring_success")
    scoring_percentage = fields.Float(string="scoring Percentage", related="survey_user_input_id.scoring_percentage")
    scoring_total = fields.Float(string="Scoring Total", related="survey_user_input_id.scoring_total")
    nysc_certificate_link = fields.Char()
    has_professional_certification = fields.Selection([
        ('Yes', 'Yes'), ('No', 'No')], 
        string="Do you have any Professional Certification?",
        default="No")
    professional_certificate_link = fields.Char()
    gender = fields.Char()
    highest_level_of_qualification = fields.Char(string="highest level of qualification")
    course_of_study = fields.Char(string="Course of study")
    is_graduate = fields.Boolean(string="Are you a graduate?") #  Do not choose "yes" if you do not have your NYSC certificate available
    is_external_staff = fields.Boolean(string="Are you a External staff?")
    skills = fields.Char(string="Relevant Skills")
    prefered_district = fields.Char("Which district do you prefer")
    nysc_certificate_number = fields.Char(string="NYSC Certificate Number")
    date_of_birth = fields.Date("Date of Birth")
    age = fields.Char(string="Age")
    worked_at_organisation = fields.Selection([
        ('yes', 'Yes'), ('no', 'No')],
        string="worked at Our Organisation?",
        default=False)
    mode_of_exit_at_organisation = fields.Char(string="How did you leave?")
    why_do_you_leave = fields.Char(string="Why you leave Our Company?")
    
    request_id = fields.Many2one('hr.job.recruitment.request', string="Recruitment Request", compute='_compute_request_id', store=True, index=True)
    is_panelist_added = fields.Boolean(
        "Panelist added?", 
        readonly=True, 
        compute="compute_panel_list",
        help="used to track that the panelist has been added")
    
    is_undergoing_verification = fields.Boolean(
        "Undergoing Verification process?", 
        readonly=True, 
        # compute="compute_verification_process",
        help="used to track that the candidates selected for verification")
    
    is_documentation_process = fields.Boolean(
        "Documentation process?", 
        readonly=True, 
        # compute="compute_verification_process",
        )
    applicant_documentation_checklist = fields.One2many(
        'hr.applicant.documentation', 
        'applicant_id', 
        string='Checklists'
        ) 
    
    # sign_request_ids = fields.One2many(
	# 	'sign.request', 
    #     'applicant_id', 
    #     string='Documents to sign')
    
    audited = fields.Boolean(default=False, string='Audited', readonly=True) # Boolean field to check whether someone has been auduted
    stage_type = fields.Selection(related='stage_id.stage_type') # Used in the attribute domain for hiding button
    
    @api.onchange('nysc_certificate_number')
    def _onchange_nysc_certificate_number(self):
        if self.nysc_certificate_number and self.nysc_certificate_number != '':
            self.has_completed_nysc = 'Yes'
        else:
            self.has_completed_nysc = 'No'

    def create_employee_from_applicant(self):
        res = super().create_employee_from_applicant()
        res['context']['default_first_name'] = self.first_name
        res['context']['default_name'] = f"{self.first_name or ''} {self.middle_name} {self.last_name}"
        res['context']['default_middle_name'] = self.middle_name
        res['context']['default_last_name'] = self.last_name
        res['context']['default_department_id'] = self.department_id.id
        res['context']['default_phone'] = self.partner_phone
        res['context']['default_private_email'] = self.email_from
        res['context']['default_job_title'] = self.job_id.name
        res['context']['default_skills_text'] = self.skills_text
        res['context']['default_qualifications_text'] = self.qualifications_text
        res['context']['default_experience_text'] = self.experience_text
        res['context']['default_applicant_documentation_checklist'] = [(6, 0, [doc.id for doc in self.applicant_documentation_checklist])]
        # res['context']['default_applicant_documentation_checklist'] = self.applicant_documentation_checklist
        return res
    
    @api.depends('job_id')
    def _compute_request_id(self):
        requests = self.env['hr.job.recruitment.request'].search([
            ('state', '=', 'recruiting'),
            ('job_id', 'in', self.job_id.ids)])
        for r in self:
            r.request_id = requests.filtered(lambda req: req.job_id == r.job_id)[:1] or False if r.job_id else False

    @api.depends("survey_user_input_id")
    def _compute_cbt_score(self):
        for rec in self:
            if rec.survey_user_input_id and rec.survey_user_input_id.scoring_success:
                rec.test_passed = True
            else:
                rec.test_passed = False

    def get_base_url(self):
        base_url = http.request.env['ir.config_parameter'].sudo().get_param('web.base.url')
        return base_url

    @api.depends("survey_panelist_input_ids")
    def compute_panel_list(self):
        for rec in self:
            if rec.survey_panelist_input_ids:
                rec.is_panelist_added = True 
            else: 
                rec.is_panelist_added =False 

    def action_audit_certify(self):
        if self.stage_id and self.stage_id.group_ids:
            user_group_ids = self.env.user.groups_id.ids
            group_ids_to_check = self.stage_id.group_ids.ids

            # Retrieve the names of the groups
            group_names_to_check = self.env['res.groups'].sudo().search([('id', 'in', group_ids_to_check)]).mapped('name')

            if not set(user_group_ids).intersection(group_ids_to_check):
                raise ValidationError(f"You have to be in one of the groups with names {group_names_to_check} to approve")

            self.audited = True
        else:
            self.audited = False
                
    def send_applicants_checklist(self):
        rec_ids = self.env.context.get('active_ids', [])
        self.send_checklist(rec_ids)
        
    def send_checklist(self, rec_ids):
        template_to_use = "mail_template_applicants_checklist"
        for rec in rec_ids:
            record = self.env['hr.applicant'].browse([rec])
            email_to = False
            if record.email_from:
                email_to = record.email_from 
            template = self.env.ref(f'hr_cbt_portal_recruitment.{template_to_use}')
            if template:
                ctx = dict()
                ctx.update({
                    'default_model': 'hr.applicant',
                    'default_res_id': record.id,
                    'default_use_template': bool(template),
                    'default_template_id': template.id,
                    'default_composition_mode': 'comment',
                    'default_no_attachment': record.mapped('applicant_documentation_checklist')\
                            .filtered(lambda data: not data.document_file)
                            })
                template.sudo().write({
                    'email_to': email_to,
                    'attachment_ids': [(6, 0, self.generate_document_checklist_attachment(record))],
                    })
                record.is_documentation_process = True
                template.with_context(ctx).send_mail(record.id, False)
             
    def generate_document_checklist_attachment(self, record):
        '''
        Process the attachment in documentation checklist line
          and generated the attachment id in array
        returns: attachments ==> [2, 4, 5, 78]
        '''
        if record:
            document_with_attachments = record.mapped('applicant_documentation_checklist')\
            .filtered(lambda data: data.document_file)
            attachments = []
            for attachment in document_with_attachments:
                attachments.append(attachment.document_file.id)
            return attachments
        
    def get_url(self, id):
        base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
        base_url += "/web#id=%s&model=hr.applicant&view_type=form" % (id)
        return "<a href={}> </b>Applicant<a/>. ".format(base_url)
        
    def send_mail_to_hr(self, filename_list=False, applicant_id=False):
        if filename_list:

            mail_from = self.env['ir.config_parameter'].sudo()\
                .get_param('hr_cbt_portal_recruitment.system_email') or applicant_id.email_from 
            hr_email = self.env['ir.config_parameter'].sudo()\
                .get_param('hr_cbt_portal_recruitment.company_hr_email')  
            if mail_from and hr_email:
                applicant_name = applicant_id.name if applicant_id else ""
                subject = "Applicant Document Upload Notification: {}".format(applicant_name)
                msg_body = "Dear HR, <br/>This is a notification that the applicant {} has uploaded the following documents: <br/>"\
                "<ul>"
                for filename in filename_list:
                    msg_body += f"<li>{filename}</li>"
                msg_body += "</ul><br/>Open {}<br/><br/>Thanks"
                
                applicant_url = self.get_url(applicant_id.id)
                msg_body = msg_body.format(applicant_name, applicant_url)
                mail_data = {
                    'email_from': mail_from,
                    'subject': subject,
                    'email_to': hr_email,
                    'body_html': msg_body
                }
                mail_id = self.env['mail.mail'].create(mail_data)
                self.env['mail.mail'].send(mail_id)

    def get_filtered_function(self,  **kwargs):
        view_id_form = self.env.ref('hr_recruitment.hr_applicant_view_form')
        view_id_tree = self.env.ref('hr_recruitment.crm_case_tree_view_job')
        return {
            'type': 'ir.actions.act_window',
            'name': _('Applicant for auditing'),
            'res_model': 'hr.applicant',
            'view_type': 'form',
            'view_mode': 'tree,form',
            'view_id': view_id_tree.id,
            'views': [(view_id_tree.id, 'tree'), (view_id_form.id,'form')],
            'target': 'current',
            'domain': kwargs.get('mydomain')
            }
    
    def get_filtered_audit_stage_menu(self):
        audit_applicants = self.env['hr.applicant'].search([
            ('stage_id', '=', self.env.ref('hr_cbt_portal_recruitment.hr_recruitment_stage_audit_check').id)
            ])
        return self.get_filtered_function(mydomain = [('id', 'in', [rec.id for rec in audit_applicants])] if audit_applicants else [('id', '=', 0)]) 


