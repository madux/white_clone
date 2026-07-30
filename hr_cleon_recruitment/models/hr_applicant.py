from odoo import models, fields, api,_
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta, date
import requests
import base64
import io
import json
import re
import logging

_logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
PHONE_RE = re.compile(r'(\+?\d[\d\s\-\(\)]{8,}\d)')
WEBSITE_RE = re.compile(
        r'(https?://[^\s,]+|www\.[^\s,]+|(?:linkedin\.com|github\.com|portfolio\.[^\s,]+)/[^\s,]+)',
        re.IGNORECASE
    )


class hrRecruitmentStageInherit(models.Model):
    _inherit = "hr.recruitment.stage"

    jobs_id = fields.Many2one('hr.job')


class HrJob(models.Model):
    _inherit = 'hr.job'

    priority = fields.Selection([
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ], string="Priority", default='medium')
    offer_terms = fields.Html(string='Offer terms', default="No offer terms added... ")
    requirements = fields.Text(string='Requirements')
    talent_mobility_ids = fields.Many2many(
        'hr.talent.mobility.match',
        string='Talent mobility',
        store=True,
    )
    total_matching_mobility = fields.Float(string='Total matched Mobility')

    job_stage = fields.Selection([
        ('planning', 'Planning'),
        ('published', 'Published'),
        ('hired', 'Hired'),
        ('cancelled', 'Cancelled'),
        ('closed', 'closed'),
    ], string="Job Stage", default='planning')

    job_nature = fields.Selection([
        ('remote', 'Remote'),
        ('hybrid', 'Hybrid'),
        ('full_time', 'Full Time'),
    ], string="Job Nature")
    hiring_team_ids = fields.Many2many(
        'hr.employee',
        string='Hiring team',
        store=True,
    )
    deadline_date = fields.Datetime(string="Deadline")
    email_sent = fields.Boolean(string="Email sent", help="This tracks the emails sent")
    salary_currency = fields.Many2one('res.currency', string="Currency")
    location = fields.Char(
        string="Location", 
        default=lambda self: self.env.user.company_id.state_id.name or \
            self.env.user.company_id.country_id.name or self.env.user.company_id.name)
    opened_date = fields.Date("Opened Date")
    deadline_date_char = fields.Char(
        string="Deadline Display",
        compute="_compute_deadline_date_char",
        store=True
    )
    offer_report_ids = fields.Many2many(
        'ir.actions.report',
        # domain="[('type', 'in', ['qweb', 'html'])]",
        string='Templates',
        store=True,
    )
    location_id = fields.Many2one(
        'multi.branch',
        string='Location',
        store=True,
    )
    work_experience_ids = fields.Many2many('hr.work_experience', string="Work experiences")
    work_education_ids = fields.Many2many('hr.work_education', string="Work education")
    work_skill_ids = fields.Many2many('hr.work_skills', string="Work Skills")
    
    
    pipeline_stage_ids = fields.One2many('hr.recruitment.stage', 'jobs_id', string="Pipelines")
    default_stage_id = fields.Many2one('hr.recruitment.stage', string="Default Stage")
    ai_enabled_interview = fields.Boolean()
    text_base_interview = fields.Boolean()
    voice_base_interview = fields.Boolean()
    when_is_interview_sent = fields.Boolean()
    interview_sent_time = fields.Integer(default=0)
    send_email_expiry = fields.Boolean()
    auto_expire = fields.Boolean()
    auto_advance_without_interview = fields.Boolean()
    survey_id = fields.Many2one('survey.survey')
    survey_question_ids = fields.Many2many('survey.question')#, compute="compute_survey_questions")
    name = fields.Char(string="Name")
    
    email_invite_template = fields.Many2one(
		'mail.template',
		string="Mail Template",
		required=False,
	)
    applicant_documentation_checklist = fields.Many2many(
        'hr.applicant.documentation', 
        'recruitment_documentation_rel', 
        'job_id', 
        'recruitment_documentation_id', 
        string='Checklists'
        ) 
    button_continue_show = fields.Boolean()
    
    min_salary_band = fields.Float(
        string="Min Salary",
        copy=True,
        default=0.0
    )

    max_salary_band = fields.Float(
        string="Max Salary",
        copy=True,
        default=0.0
    )
    @api.onchange('max_salary_band')
    def onchange_max_salary_band(self):
        if self.max_salary_band:
            if self.max_salary_band < self.min_salary_band:
                self.max_salary_band = False
                raise UserError("Minimum salary cannot be greater than Maximum salary band")

    @api.onchange('min_salary_band')
    def onchange_min_salary_band(self):
        if self.min_salary_band:
            if self.max_salary_band > 0 and self.min_salary_band > self.max_salary_band:
                self.min_salary_band = False
                raise UserError("Minimum salary cannot be greater than Maximum salary band")


    # manual_survey_id = fields.Many2one('survey.survey')
    # manual_survey_question_ids = fields.One2many('custom.survey.question', 'job_id', string="Current job questions")
     
    workflow_setup = fields.Selection([
        ('Basic',   'Basic'),
        ('Description',   'Description'),
        ('Pipeline',   'Pipeline Setup'), # job details
        ('AI Interview',   'AI Interview'), # job details
        ('Job Checklist',   'Job Checklist'), # job details
        ('Application Form',   'Application Form'),
        ('Posting and Visibility',   'Posting and Visibility'), # job details
        ('Review',   'Review'), # job details
    ], default='Basic')

    mode = fields.Selection([
        ('first_intro',   'Job Creation Option'),
        ('first_intro2',   'Quick Job Creation'), # 
        ('first_intro3',   'Job Details'), # job details
        ('second_intro1',   'second_intro1'), # job details
        ('second_intro2',   'second_intro2'), # job details
        ('second_intro3',   'second_intro3'), 
    ], default='first_intro')

    def action_move_workflow(self):
        self.ensure_one()
        if self.workflow_setup == 'Basic':
            self.workflow_setup = 'Description'
        elif self.workflow_setup == 'Description':
            self.workflow_setup = 'Pipeline'
        elif self.workflow_setup == 'Pipeline':
            self.workflow_setup = 'AI Interview'
        elif self.workflow_setup == 'AI Interview':
            self.workflow_setup = 'Job Checklist'
        elif self.workflow_setup == 'Job Checklist':
            self.workflow_setup = 'Application Form'
        elif self.workflow_setup == 'Application Form':
            self.workflow_setup = 'Posting and Visibility'
        # elif self.workflow_setup == 'Posting and Visibility':
        else:
            self.workflow_setup = 'Review'

    def _reopen(self, view_id=False, target='new', view_mode='form'):
        """Return an action that re-opens this same wizard record (refreshes the view)."""
        view_id = view_id if view_id else self.env.ref(
                'hr_cleon_recruitment.hr_recruitment_job_process_form_view'
            ).id
        return {
            'type': 'ir.actions.act_window',
            'res_model': "hr.job",
            'res_id': self.id,
            'view_mode': view_mode,
            'target': target,
            'views': [
                    (view_id, view_mode)
                ], 
            'context': self.env.context,
            'name': "Add job",
        }
    
    def action_back_mode(self):
        if self.mode == 'first_intro2':
            self.mode = 'first_intro'
        return self._reopen()
    
    def create_job_positon(self):
        view_id = self.env.ref(
                'hr.view_hr_job_form'
            ).id
        self.mode = 'first_intro3' # go to main job details 
        self.active = True #  
        return self._reopen(target='current', view_id=view_id, view_mode='form')
    
    def first_intro_button(self):
        self.button_continue_show = True
        self.mode = 'first_intro2'
        return self._reopen()

    def second_intro_button(self):
        self.button_continue_show = True
        self.mode = 'second_intro1'
        return self._reopen(target='fullscreen')

    def second_intro2_move_to_description_button(self):
        '''Moves to description part'''
        self.button_continue_show = True
        self.mode = 'second_intro2'

    def second_intro3_button(self):
        '''Moves to description part'''
        self.button_continue_show = True
        self.mode = 'second_intro3'

    def first_intro_continue_button(self):
        if self.mode == 'first_intro2':
            self.mode = 'first_intro3'
        
        elif self.mode == 'first_intro3':
            self.mode = 'first_intro3'

    def first_intro_continue_button(self):
        if self.mode == 'first_intro2':
            self.mode = 'first_intro3'
    
    def action_generate_description_with_ai(self):
        pass
    def action_generate_interview_with_ai(self):
        pass

    

    @api.onchange('survey_id')
    def compute_survey_questions(self):
        self.ensure_one()
        for rec in self:
            if rec.survey_id:
                self.survey_question_ids = rec.survey_id.question_ids
            else:
                self.survey_question_ids = False
    
    @api.depends('deadline_date')
    def _compute_deadline_date_char(self):
        for rec in self:
            if rec.deadline_date:
                rec.deadline_date_char = rec.deadline_date.strftime('%d %b %Y')
                # Example: 15 Mar 2025
            else:
                rec.deadline_date_char = False


class HrApplicant(models.Model):
    _inherit = 'hr.applicant'
    _order = "id asc"
    _rec_name = "partner_name"

    match_rating = fields.Selection([('poor', 'poor'),
                                     ('average', 'average'),
                                     ('high', 'High'),
                                     ('excellent', 'Excellent'),
                                     ], string="Match rating", default="")
    
    applied_date = fields.Date("Applied Date", default=fields.Date.today())
    
    # Candidate detail
    application_code = fields.Char(
        string='Reference',
        required=True,
        copy=False,
        readonly=True,
        default=lambda self: _('New'),
        tracking=True,
    )
    applicant_job_location = fields.Char(related="job_id.location", default="N/A")
    number_of_interviews = fields.Integer()
    toggle_mode = fields.Selection([
        ('1',   '1'),
        ('2',   '2'),
        ('3',   '3'),
        ('4',   '4'),
        ('5', '5'),
        ('6', '6'),
        ('7', '7'),
    ], default='1', help="Used to dynamically change some views")


    offer_id = fields.Many2one("hr.offer", "Offer Reference", readonly="1")
    email_sent = fields.Boolean(string="Email sent", help="This tracks the emails sent")
    
    def button_send_message(self):
        #TODO Send message modal to candidate
        pass 

    def buttonToggleModeAction1(self):
        self.write({'toggle_mode': '1'})


    def buttonToggleModeAction2(self):
        self.write({'toggle_mode': '2'})


    def buttonToggleModeAction3(self):
        self.write({'toggle_mode': '3'})


    def buttonToggleModeAction4(self):
        self.write({'toggle_mode': '4'})


    def buttonToggleModeAction5(self):
        self.write({'toggle_mode': '5'})


    def buttonToggleModeAction6(self):
        self.write({'toggle_mode': '6'})


    def buttonToggleModeAction7(self):
        self.write({'toggle_mode': '7'})

    # Candidate detail ends 
        
    def addCandidateBtn(self):
        form_view_id = self.env.ref(
                'hr_cleon_recruitment.hr_recruitment_candidate_form_view'
            ).id
        return {
            'type': 'ir.actions.act_window',
            'name': _('New Candidate'),
            'res_model': "hr.applicant.candidate.wizard",
            # 'res_id': self.id,
            'view_mode': 'form',
            'views': [
                    (form_view_id, 'form')
                ], 
            'target': 'new',
            # 'domain': [('id', 'in', rec_ids)]
        }
    
    # AI READING OF CV 
    
    website = fields.Char(string='Website / Portfolio / LinkedIn')
    skills_text = fields.Text(string='Extracted Skills')
    qualifications_text = fields.Text(string='Extracted Qualifications')
    experience_text = fields.Text(string='Extracted Experience')

    @api.model
    def action_detect_duplicates(self):
        current_year = date.today().year

        applicants = self.env['hr.applicant'].search([
            ('job_id.opened_date', '>=', f'{current_year}-01-01'),
            ('job_id.opened_date', '<=', f'{current_year}-12-31'),
        ])

        duplicate_ids = set()

        for applicant in applicants:

            if not (
                applicant.applied_date
                and applicant.job_id.opened_date
                and applicant.job_id.close_date
            ):
                continue

            if not (
                applicant.job_id.opened_date
                <= applicant.applied_date
                <= applicant.job_id.close_date
            ):
                continue

            duplicates = self.env['hr.applicant'].search([
                ('id', '!=', applicant.id),
                ('job_id', '=', applicant.job_id.id),
                ('applied_date', '>=', applicant.job_id.opened_date),
                ('applied_date', '<=', applicant.job_id.close_date),
                '|',
                ('email_from', '=', applicant.email_from),
                ('partner_phone', '=', applicant.partner_phone),
            ])

            if duplicates:
                duplicate_ids.add(applicant.id)
                duplicate_ids.update(duplicates.ids)
        return list(duplicate_ids)
        # return {
        #     'type': 'ir.actions.act_window',
        #     'name': 'Duplicate Applicants',
        #     'res_model': 'hr.applicant',
        #     'view_mode': 'tree,form',
        #     'domain': [('id', 'in', list(duplicate_ids))],
        #     'target': 'current',
        # }

    def generate_offers(self):
        rec_ids = self.env.context.get('active_ids', [])
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'hr.offer.wizard',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_candidate_ids': [(6, 0, rec_ids)]
            },
            'name': "Offer",
        }
    
    def action_detect_duplicates2(self):
        self.env.cr.execute("""
            WITH applicant_data AS (
                SELECT
                    ha.id,
                    ha.job_id,
                    ha.email_from,
                    ha.partner_phone,
                    ha.applied_date,
                    hj.opened_date,
                    hj.close_date
                FROM hr_applicant ha
                JOIN hr_job hj ON hj.id = ha.job_id
                WHERE EXTRACT(YEAR FROM hj.opened_date) = EXTRACT(YEAR FROM CURRENT_DATE)
                AND ha.applied_date BETWEEN hj.opened_date AND hj.close_date
            )
            SELECT DISTINCT a1.id
            FROM applicant_data a1
            JOIN applicant_data a2
                ON a1.id <> a2.id
                AND a1.job_id = a2.job_id
                AND (
                    (
                        a1.email_from IS NOT NULL
                        AND a2.email_from IS NOT NULL
                        AND LOWER(a1.email_from) = LOWER(a2.email_from)
                    )
                    OR
                    (
                        a1.partner_phone IS NOT NULL
                        AND a2.partner_phone IS NOT NULL
                        AND a1.partner_phone = a2.partner_phone
                    )
                )
        """)

        applicant_ids = [row[0] for row in self.env.cr.fetchall()]

        return {
            'type': 'ir.actions.act_window',
            'name': 'Duplicate Applicants',
            'res_model': 'hr.applicant',
            'view_mode': 'tree,form',
            'domain': [('id', 'in', applicant_ids)],
        }

    def _parse_cv_text(self, text):
        """Combine regex extraction (reliable fields) with LLM extraction
        (unstructured fields: name, skills, experience, qualifications)."""
        regex_data = self._regex_extract(text)
        llm_data = self._llm_extract(text)

        # regex wins for contact details (more reliable than LLM hallucination)
        merged = {**llm_data, **{k: v for k, v in regex_data.items() if v}}
        return merged

    def _regex_extract(self, text):
        email_match = EMAIL_RE.search(text)
        phone_match = PHONE_RE.search(text)
        website_match = WEBSITE_RE.search(text)

        return {
            'email': email_match.group(0) if email_match else None,
            'phone': re.sub(r'\s+', ' ', phone_match.group(0)).strip() if phone_match else None,
            'website': website_match.group(0) if website_match else None,
        }

    def _llm_extract(self, text):
        api_key = self.env['ir.config_parameter'].sudo().get_param('cv_parser.anthropic_api_key')
        if not api_key:
            _logger.warning("No Anthropic API key configured — skipping AI extraction.")
            return {}

        prompt = f"""Extract these fields from the CV text below. Return ONLY valid JSON,
        no markdown fences, no commentary.

        {{
        "first_name": "string or null",
        "last_name": "string or null",
        "skills": ["string", ...],
        "qualifications": ["string", ...],
        "experience": [
            {{"company": "string", "title": "string", "duration": "string", "summary": "string"}}
        ]
        }}

        CV TEXT:
        \"\"\"{text[:15000]}\"\"\"
        """
        try:
            response = requests.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "claude-sonnet-4-6",
                    "max_tokens": 2000,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=30,
            )
            response.raise_for_status()
            content = response.json()["content"][0]["text"]
            cleaned = (content.strip()
                       .removeprefix("```json").removeprefix("```")
                       .removesuffix("```").strip())
            return json.loads(cleaned)
        except Exception as e:
            _logger.error("LLM extraction failed: %s", e)
            return {}

    def _apply_parsed_cv_data(self, data):
        first_name = data.get('first_name') or ''
        last_name = data.get('last_name') or ''
        full_name = f"{first_name} {last_name}".strip()

        vals = {}
        if full_name:
            vals['partner_name'] = full_name
        if data.get('email'):
            vals['email_from'] = data['email']
        if data.get('phone'):
            vals['partner_phone'] = data['phone']
        if data.get('website'):
            vals['website'] = data['website']
        if data.get('skills'):
            vals['skills_text'] = "\n".join(f"- {s}" for s in data['skills'])
        if data.get('qualifications'):
            vals['qualifications_text'] = "\n".join(f"- {q}" for q in data['qualifications'])
        if data.get('experience'):
            lines = []
            for exp in data['experience']:
                lines.append(
                    f"{exp.get('title', '')} at {exp.get('company', '')} "
                    f"({exp.get('duration', '')})\n  {exp.get('summary', '')}"
                )
            vals['experience_text'] = "\n\n".join(lines)

        if vals:
            self.write(vals)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('application_code', _('New')) == _('New'):
                vals['application_code'] = self.env['ir.sequence'].next_by_code(
                    'hr.application'
                ) or _('New')
        records = super().create(vals_list)
        return records
    '''
    This my new for view for hr.applicant model

    1. i want when user clicks on add candidate button, it should open the form view in new target
    2. When user clicks on complete form, it should open another form view that looks like screenshot 1 + screenshot 2
    3. When user clicks on the upload resume, it should prompt screenshot 3
    4. when user clicks on bulk upload, it should open screenshot 4
    5. When user clicks on linkedin url it should open screenshot 5.
    6. Just write the code, dont give me module.

    Note, give me a form view that looks exactly like the designs. 
    However what i intended doing is to use invisible to hide some of these sections.
    i.e if use clicks on complete form, it should take them to form inputs, if they click in upload, it should take them to upload resume screen and hide the complete form input section ...
    '''

    