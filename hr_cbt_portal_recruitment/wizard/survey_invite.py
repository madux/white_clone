# .

from odoo import api, fields, models, _
from odoo.tools.misc import clean_context
import logging
import re
from odoo import api, fields, models, tools, _
from odoo.exceptions import UserError

_logger = logging.getLogger(__name__)

emails_split = re.compile(r"[;,\n\r]+")

class SurveyInvite(models.TransientModel):
    _inherit = "survey.invite"

    applicant_ids = fields.Many2many('hr.applicant', 
                                     'hr_applicants_survey_invite_rel',
                                     'hr_appllicant_id',
                                     'survey_invite_id',
                                     string='Applicants')
    panelist_ids = fields.Many2many('hr.employee', 
                                     'hr_employee_survey_invite_rel',
                                     'hr_employee_id',
                                     'survey_invite_id',
                                     string='Panelists')

    def action_invite(self):
        """ Process the wizard content and proceed with sending the related
            email(s), rendering any template patterns on the fly if needed """
        self.ensure_one()
        Partner = self.env['res.partner']
        # compute partners and emails, try to find partners for given emails
        valid_partners = self.partner_ids
        langs = set(valid_partners.mapped('lang')) - {False}
        if len(langs) == 1:
            self = self.with_context(lang=langs.pop())
        valid_emails = []
        for email in emails_split.split(self.emails or ''):
            partner = False
            email_normalized = tools.email_normalize(email)
            if email_normalized:
                limit = None if self.survey_users_login_required else 1
                partner = Partner.search([('email_normalized', '=', email_normalized)], limit=limit)
            if partner:
                valid_partners |= partner
            else:
                email_formatted = tools.email_split_and_format(email)
                if email_formatted:
                    valid_emails.extend(email_formatted)

        if not valid_partners and not valid_emails and not self.applicant_ids:
            raise UserError(_("Please enter at least one valid recipient or applicants"))
        
        answers = self._prepare_answers(valid_partners, valid_emails, self.applicant_ids)
        for answer in answers:
            self._send_mail(answer)

        return {'type': 'ir.actions.act_window_close'}
    

    def _prepare_answers(self, partners, emails, applicant_ids=False):
        answers = self.env['survey.user_input']
        existing_answers = self.env['survey.user_input'].search([
            '&', '&', ('survey_id', '=', self.survey_id.id),
            ('active', '=', True),
            '|',
            ('partner_id', 'in', partners.ids),
            ('email', 'in', emails)
        ])
        survey = self.survey_id
        partners_done = self.env['res.partner']
        emails_done = []
        if existing_answers:
            if self.existing_mode == 'resend':
                partners_done = existing_answers.mapped('partner_id')
                emails_done = existing_answers.mapped('email')

                # only add the last answer for each user of each type (partner_id & email)
                # to have only one mail sent per user
                for partner_done in partners_done:
                    answers |= next(existing_answer for existing_answer in
                        existing_answers.sorted(lambda answer: answer.create_date, reverse=True)
                        if existing_answer.partner_id == partner_done)

                for email_done in emails_done:
                    answers |= next(existing_answer for existing_answer in
                        existing_answers.sorted(lambda answer: answer.create_date, reverse=True)
                        if existing_answer.email == email_done)
        
        ### customization starts here ###
        if applicant_ids:
            if not self.panelist_ids:
                for applicant in applicant_ids:
                    if applicant.email_from not in emails_done:
                        applicant_email = applicant.email_from
                        survey_input = self.survey_id._create_answer(email=applicant_email, check_attempts=False, **self._get_answers_values(), hr_applicant_id=applicant.id)
                        # survey_input = self.survey_id._create_answer(email=applicant_email, check_attempts=False, deadline=survey.deadline, **self._get_answers_values())

                        answers |= survey_input
                        applicant.survey_user_input_id = survey_input.id
                # for applicant_email in [email.email_from for email in self.applicant_ids if email not in emails_done]:
                #     answers |= self.survey_id._create_answer(email=applicant_email, check_attempts=False, **self._get_answers_values())
            else:
                applicant_panelist = self.env['panelist.score_sheet']
                for panelist in self.panelist_ids:
                    # applicant_panelist_id = applicant_panelist.create({
                    #         'panelist_id': panelist.id,
                    #     })
                    for applicant in applicant_ids:
                        survey_input = self.survey_id._create_answer(email=panelist.work_email, check_attempts=False, **self._get_answers_values())
                        answers |= survey_input
                        # applicant.survey_user_input_id = survey_input.id
                        applicant_panelist.create({
                            'panelist_id': panelist.id,
                            'survey_user_input_ids': [(4, survey_input.id)],
                            'applicant_id': applicant.id
                        })

            ### customization ends here ###
        else:
            for new_partner in partners - partners_done:
                answers |= self.survey_id._create_answer(partner=new_partner, check_attempts=False, **self._get_answers_values())
            for new_email in [email for email in emails if email not in emails_done]:
                answers |= self.survey_id._create_answer(email=new_email, check_attempts=False, **self._get_answers_values())
        return answers
