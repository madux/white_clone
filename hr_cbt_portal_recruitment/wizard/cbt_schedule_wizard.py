# -*- coding: utf-8 -*-
from odoo import http
from datetime import date, datetime
from odoo import models, fields
from odoo.exceptions import ValidationError

 
class CBTscheduleWizard(models.TransientModel):
    _name = "cbt.schedule.wizard"
    _order = "id asc"
    _description = "CBT Wizard Scheduler"
    _rec_name = "survey_id"

    cbt_template_config_id = fields.Many2one(
        'cbt.template.config',
        string="CBT Template",
        required=False,
    )
    survey_id = fields.Many2one(
        'survey.survey',
        string="Test Template",
        required=False,
    )
    is_score_sheet = fields.Boolean(
        'Is score sheet',
        help="Used to determine if the action is for sending score sheet"
        )
    email_invite_template = fields.Many2one(
        'mail.template',
        string="Invitation Mail Template",
        required=False,
    )
    applicant_ids = fields.Many2many(
        'hr.applicant',
        'application_cbt_schedult_rel',
        'hr_applicant', 
        'hr_cbt_schedule_id',
        string="Applicants",
    )
    panelist_ids = fields.Many2many(
        'hr.employee',
        'application_cbt_panelist_rel',
        'hr_applicant', 
        'hr_panelist_id',
        string="Panelist",
    )

    def schedule_action(self):
        """takes all the applicants emails and shares test links to them"""
        no_panelist_with_email = self.mapped('panelist_ids').filtered(lambda s: not s.work_email)
        if self.is_score_sheet:
            if no_panelist_with_email:
                raise ValidationError(
                    """Please check!  Ensure all the panelist email is added !!!
                    """)
            if not self.panelist_ids:
                raise ValidationError(
                    """Please ensure panelist is selected on the tab"""
                    )
        return self.survey_id.action_send_survey(
            self.email_invite_template, self.panelist_ids
            )
    
    def get_base_url(self):
        base_url = http.request.env['ir.config_parameter'].sudo().get_param('web.base.url')
        return base_url

