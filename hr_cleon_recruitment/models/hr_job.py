from odoo import models, fields, api,_
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta, date
import requests
import base64
import io
import json
import re
import logging
from dateutil.relativedelta import relativedelta


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

    applicant_count = fields.Integer(
        compute='_compute_total_candidate'
    )

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
        ('pause', 'Paused'),
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
    active = fields.Boolean("Active", default=True)
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
    level_id = fields.Many2one(
            'hr.level',
            string='Level',
            store=True,
        )
    hiring_manager = fields.Many2one(
                'hr.employee',
                string='Hiring manager',
                store=True,
            )
    country_id = fields.Many2one(
            'res.country',
            string='country',
            store=True,
        )
    total_candidate = fields.Integer(
                string='Total Candidates',
                compute='_compute_total_candidate',
                store=False
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
    branch_id = fields.Many2one('multi.branch')
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

    initiation_count = fields.Integer(
            string='Applied',
            compute='_compute_pipeline_metrics'
        )
    
    interview_count = fields.Integer(
        string='Interview',
        compute='_compute_pipeline_metrics'
    )

    selection_process_count = fields.Integer(
        string='Selection Process',
        compute='_compute_pipeline_metrics'
    )

    documentation_count = fields.Integer(
        string='Offer',
        compute='_compute_pipeline_metrics'
    )

    hired_count = fields.Integer(
        string='Hired',
        compute='_compute_pipeline_metrics'
    )
    job_health_score = fields.Float(
        string='Job Health Score (%)',
        compute='_compute_job_health_score',
        digits=(16, 2),
        help="""Weighted Score =
            (20×10)+(5×40)+(3×60)+(2×80)+(1×100)
            = 840

            Maximum Possible Score
            = 31 × 100
            = 3100

            Health Score
            = 840 / 3100 × 100
            = 27.10%"""
        )

    job_open_days = fields.Integer(
        string='Job Open Days',
        compute='_compute_job_open_days',
        store=True
    )

    interview_scheduled_count = fields.Integer(
    string='Interviews Scheduled',
    compute='_compute_interview_scheduled_count'
    )
    next_interview_days = fields.Integer(
        string='Next Interview In',
        compute='_compute_next_interview_days'
    )
    interview_scheduled_today = fields.Integer(
    string='Interviews Today',
    compute='_compute_interview_scheduled_today'
    )
    avg_days_to_interview = fields.Float(
        string='Avg Days To Interview',
        compute='_compute_avg_days_to_interview'
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

    def _reopen(self, view_id=False, target='new', view_mode='form', context=False):
        """Return an action that re-opens this same wizard record (refreshes the view)."""
        view_id = view_id if view_id else self.env.ref(
                'hr_cleon_recruitment.job_creation_form_view'
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
            'context': context if context else self.env.context,
            'name': "Add job",
        }
    
    def action_back_mode(self):
        if self.mode == 'first_intro2':
            self.mode = 'first_intro'
        return self._reopen()
    
    def create_job_positon(self):
        view_id = self.env.ref(
                'hr_cleon_recruitment.job_creation_form_view'
            ).id
        action= self.env.ref('hr_cleon_recruitment.action_hr_job_recruitment')
        menuid= self.env.ref('hr_cleon_recruitment.menu_hr_applicant_recruitment_root')
        return { 
                'type': 'ir.actions.act_url',
                'url': '/web#id={}&action={}&model=hr.job&view_type=form&menu_id={}'.format(self.id, action.id, menuid.id),
                'target': 'current',
                'nodestroy': False,
        }
        # /web?debug=1#id=2&action=682&model=hr.job&view_type=form
        # self.mode = 'first_intro3' # go to main job details 
        # self.active = True # 
        # return self._reopen(target='current', view_id=view_id, view_mode='form')

    def create_job_from_form(self):
        view_id = view_id if view_id else self.env.ref(
                        'hr_cleon_recruitment.action_hr_recruitment_add_custom_job'
                    ).id
        return {
            'type': 'ir.actions.act_window',
            'res_model': "hr.job",
            'view_mode': 'form',
            'target': 'new',
            'views': [
                    (view_id, 'form')
                ], 
            'name': "Add job",
        } 

    def button_unarchive(self):
        self.active = False

    def button_archive(self):
        self.active = True


    def button_create_job(self):
        view_id = self.env.ref(
            'hr_cleon_recruitment.job_creation_form_view'
        ).id
        return {
            'type': 'ir.actions.act_window',
            'res_model': "hr.job",
            'view_mode': 'form',
            'target': 'new',
            'views': [
                    (view_id, 'form')
                ], 
            'name': "Add job",
        }

    def button_create_candidate(self):
        view_id = view_id if view_id else self.env.ref(
            'hr_cleon_recruitment.hr_recruitment_candidate_form_view'
        ).id
        return {
            'type': 'ir.actions.act_window',
            'res_model': "hr.applicant.candidate.wizard",
            'view_mode': 'form',
            'target': 'new',
            'views': [
                    (view_id, 'form')
                ], 
            'name': "Add Candidate",
            'context': {
                'default_job_id': self.id,
            }
        } 

    def button_goback(self):
        view_id = view_id if view_id else self.env.ref(
            'hr_cleon_recruitment.hr_job_recruitment_custom_tree_view'
        ).id
        return {
            'type': 'ir.actions.act_window',
            'res_model': "hr.job",
            'view_mode': 'tree',
            'target': 'new',
            'views': [
                    (view_id, 'tree')
                ], 
            'name': "Jobs",
            'context': {
                'default_job_id': self.id,
            }
        } 

    def open_job_filters(self):
            view_id = view_id if view_id else self.env.ref(
                            'hr_cleon_recruitment.action_hr_recruitment_add_custom_job'
                        ).id
            return {
                'type': 'ir.actions.act_window',
                'res_model': "hr.job",
                'view_mode': 'form',
                'target': 'new',
                'views': [
                        (view_id, 'form')
                    ], 
                'name': "Add job",
            } 
    
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
    
    @api.depends()
    def _compute_total_candidate(self):
        applicant_obj = self.env['hr.applicant']
        for job in self:
            counts = applicant_obj.search_count([
                ('job_id', '=', job.id)
            ])
            job.total_candidate = counts
            job.applicant_count = counts

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

    active_tab = fields.Selection([
        ('overview', 'Overview'),
        ('candidates', 'Candidates'),
        ('pipeline', 'Pipeline'),
        ('collaboration', 'Collaboration'),
        ('reports', 'Reports'),
        ('sourcing', 'Sourcing'),
        ('status', 'Status'),
    ], default='overview')

    def button_show_overview(self):
        self.ensure_one()
        self.active_tab = 'overview'

    def button_show_candidates(self):
        self.ensure_one()
        self.active_tab = 'candidates'

    def button_show_pipeline(self):
        self.ensure_one()
        self.active_tab = 'pipeline'

    def button_show_collaboration(self):
        self.ensure_one()
        self.active_tab = 'collaboration'

    def button_show_reports(self):
        self.ensure_one()
        self.active_tab = 'reports'

    def button_show_sourcing(self):
        self.ensure_one()
        self.active_tab = 'sourcing'

    def button_show_status(self):
        self.ensure_one()
        self.active_tab = 'status'

    @api.depends()
    def _compute_avg_days_to_interview(self):
        for job in self:
            applicants = self.env['hr.applicant'].search([
                ('job_id', '=', job.id),
                ('stage_id.stage_type', '=', 'interview')
            ])

            total_days = 0

            for applicant in applicants:
                total_days += (
                    fields.Date.today() -
                    fields.Date.to_date(applicant.create_date)
                ).days

            job.avg_days_to_interview = (
                total_days / len(applicants)
                if applicants else 0
            )
    

    @api.depends()
    def _compute_interview_scheduled_today(self):
        today = fields.Date.today()
        tomorrow = today + relativedelta(days=1)

        Applicant = self.env['hr.applicant']

        for job in self:
            job.interview_scheduled_today = Applicant.search_count([
                ('job_id', '=', job.id),
                ('interview_date', '>=', today),
                ('interview_date', '<', tomorrow),
            ])

    @api.depends()
    def _compute_interview_scheduled_count(self):
        Applicant = self.env['hr.applicant']

        for job in self:
            job.interview_scheduled_count = Applicant.search_count([
                ('job_id', '=', job.id),
                ('stage_id.stage_type', '=', 'interview')
            ])

    @api.depends('create_date')
    def _compute_job_open_days(self):
        today = fields.Date.today()

        for job in self:
            if job.create_date:
                open_date = fields.Date.to_date(job.create_date)
                job.job_open_days = (today - open_date).days
            else:
                job.job_open_days = 0

    @api.depends(
        'total_candidate',
        'initiation_count',
        'interview_count',
        'selection_process_count',
        'documentation_count',
        'hired_count'
    )
    def _compute_job_health_score(self):
        for job in self:
            if not job.total_candidate:
                job.job_health_score = 0
                continue

            weighted_score = (
                (job.initiation_count * 10) +
                (job.interview_count * 40) +
                (job.selection_process_count * 60) +
                (job.documentation_count * 80) +
                (job.hired_count * 100)
            )

            max_score = job.total_candidate * 100

            job.job_health_score = round(
                (weighted_score / max_score) * 100,
                2
            )
    
    @api.depends()
    def _compute_pipeline_metrics(self):
        Applicant = self.env['hr.applicant']

        for job in self:
            job.initiation_count = 0
            job.interview_count = 0
            job.selection_process_count = 0
            job.documentation_count = 0
            job.hired_count = 0

        applicants = Applicant.search([
            ('job_id', 'in', self.ids)
        ])

        metrics = {}

        for applicant in applicants:
            job_id = applicant.job_id.id
            stage_type = applicant.stage_id.stage_type

            if job_id not in metrics:
                metrics[job_id] = {
                    'initiation': 0,
                    'interview': 0,
                    'selection_process': 0,
                    'documentation': 0,
                    'hired': 0,
                }

            if stage_type == 'initiation':
                metrics[job_id]['initiation'] += 1

            elif stage_type == 'interview':
                metrics[job_id]['interview'] += 1

            elif stage_type == 'selection_process':
                metrics[job_id]['selection_process'] += 1

            elif stage_type == 'documentation':
                metrics[job_id]['documentation'] += 1

            # Assuming a hired applicant has a hired stage
            elif applicant.stage_id.name and applicant.stage_id.name.lower() == 'hired':
                metrics[job_id]['hired'] += 1

        for job in self:
            vals = metrics.get(job.id, {})

            job.initiation_count = vals.get('initiation', 0)
            job.interview_count = vals.get('interview', 0)
            job.selection_process_count = vals.get('selection_process', 0)
            job.documentation_count = vals.get('documentation', 0)
            job.hired_count = vals.get('hired', 0)

    @api.depends()
    def _compute_next_interview_days(self):
        now = fields.Datetime.now()

        Applicant = self.env['hr.applicant']

        for job in self:
            interview = Applicant.search([
                ('job_id', '=', job.id),
                ('interview_date', '>=', now)
            ], order='interview_date asc', limit=1)

            if interview:
                job.next_interview_days = (
                    interview.interview_date.date() -
                    fields.Date.today()
                ).days
            else:
                job.next_interview_days = 0

    def button_publish_job(self):
        self.datetime_publish = fields.Date.today() 
        self.job_stage = 'published'
        self.can_publish = True
        self.is_published = True

    def button_unpublish_job(self):
        self.undatetime_publish = fields.Date.today() 
        self.job_stage = 'published'
        self.can_publish = False
        self.is_published = False

    def button_pause_job(self):
        self.job_stage = 'pause'
        # self.is_published = False
        self.can_publish = False
        self.is_published = False
    
    def button_close_job(self):
        self.can_publish = False
        self.close_date = fields.Date.today()
        self.is_published = False

    def button_duplicate_job(self):
        self.copy() 
        self.is_published = False

    def button_prioritize_job(self):
        self.priority = 'high'  

    def button_auto_expire_job(self):
        self.auto_expire = True 
        self.is_published = False
    
    def button_delete_job(self):
        self.unlink() 


    is_editable = fields.Boolean(default=False)
    datetime_publish = fields.Date("Date Published")
    undatetime_publish = fields.Date("Un Published Date")
    close_date = fields.Date("Closing Date")
    is_published = fields.Boolean("Is Publish")


    def edit_btn(self):
        self.with_context(from_edit_button=True).write({
            'is_editable': True
        })

    def write(self, vals):
        if 'is_editable' not in vals:
            vals['is_editable'] = False

        return super().write(vals)

    # def write(self, vals):
        # if self.is_editable and 'is_editable' not in vals:
        #     vals['is_editable'] = False

        # return super().write(vals)

    

    
