# -*- coding: utf-8 -*-


from odoo import api, exceptions, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.osv import expression

class SurveySurvey(models.Model):
    _inherit = "survey.survey"
    
    start_time = fields.Datetime('Start Time')
    deadline = fields.Datetime('Deadline')
    
    @api.constrains('start_time', 'deadline')
    def _check_deadline_after_start_time(self):
        for record in self:
            if record.deadline and record.start_time and record.deadline < record.start_time:
                raise ValidationError("The deadline must be after the start time. Please correct the dates.")
 
    def action_send_survey(self, email_invite_template=False, panelist_ids=False):
        """ Open a window to compose an email, pre-filled with the survey message """
        # Ensure that this survey has at least one question.
        if not self.question_ids:
            raise UserError(_('You cannot send an invitation for a survey that has no questions.'))

        # Ensure that this survey has at least one section with question(s), if question layout is 'One page per section'.
        if self.questions_layout == 'page_per_section':
            if not self.page_ids:
                raise UserError(_('You cannot send an invitation for a "One page per section" survey if the survey has no sections.'))
            if not self.page_ids.mapped('question_ids'):
                raise UserError(_('You cannot send an invitation for a "One page per section" survey if the survey only contains empty sections.'))

        if not self.active:
            raise exceptions.UserError(_("You cannot send invitations for closed surveys."))

        template = self.env.ref('survey.mail_template_user_input_invite', raise_if_not_found=False)

        ## add the survey template id
        #### : 
        template = email_invite_template if email_invite_template else template

        local_context = dict(
            self.env.context,
            default_survey_id=self.id,
            default_use_template=bool(template),
            default_template_id=template and template.id or False,
            default_email_layout_xmlid='mail.mail_notification_light',
            default_panelist_ids= [(6, 0, [emp.id for emp in panelist_ids])] if panelist_ids else False,
            # default_emails= email_list
        )
        return {
            'type': 'ir.actions.act_window',
            'name': _("Share a Survey"),
            'view_mode': 'form',
            'res_model': 'survey.invite',
            'target': 'new',
            'context': local_context,
        }
    
class SurveyUserInput(models.Model):
    _inherit = "survey.user_input"

    hr_applicant_id = fields.Many2one(
        'hr.applicant',
        string="HR applicant",
        required=False,
    )
    
    active = fields.Boolean(default=True)
  