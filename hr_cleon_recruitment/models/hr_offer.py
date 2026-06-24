from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging
import base64

_logger = logging.getLogger(__name__)

class Hroffer(models.Model):
    _name = 'hr.offer'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _rec_name = "name"

    name = fields.Char(
        string='Reference',
        required=True,
        copy=False,
        readonly=True,
        default=lambda self: _('New'),
        tracking=True,
    )

    offer_stage = fields.Selection([
        ('draft', 'Prepared'),
        ('awaiting', 'Awaiting'),
        ('rejected', 'Rejected'),
        ('countered', 'countered'),
        ('resent', 'Resent'),
        ('hired', 'Hired'),

    ], string="OFFER STAGE", default='draft')
    salary_period = fields.Selection([
        ('Yearly', 'Yearly'),
        ('Weekly', 'Weekly'),
        ('Monthly', 'Monthly'),
        ('Daily', 'Daily'),
        ('Hourly', 'Hourly'), 

    ], string="PERIOD", default='Monthly')
    date_expiry = fields.Datetime(string="Expiry Date")
    proposed_salary = fields.Float(string="Proposed salary") #, related="candidate_id.proposed_salary")
    salary_currency = fields.Many2one('res.currency', string="Currency")
    sent_by = fields.Many2one('res.users', string="Sent by")
    vendor_id = fields.Many2one('res.partner', string="Vendors")
    job_id = fields.Many2one('hr.job', string="Job")
    contract_type_id = fields.Many2one(string="Contract type", related="job_id.contract_type_id")

    company_id = fields.Many2one('res.company', string="Company")
    department_id = fields.Many2one('hr.department', string="Department")
    benefits = fields.Text(string="Benefits")
    active = fields.Boolean(string="Active", default=True)
    details = fields.Char(string="Details", compute="compute_details")
    candidate_id = fields.Many2one(
        'hr.applicant',
        string='CANDIDATE',
        store=True,
        required=True,
    )
    mail_template_id = fields.Many2one(
        'mail.template',
        string='Mail templates',
        # domain=[('model', '=', 'hr.core_announcement')],
        # lambda self: self.get_mail_templates()
    )
    date_generated = fields.Datetime(string="Date Sent")
    accepted_date = fields.Datetime(string="Accepted Date")
    viewed_date = fields.Datetime()
    approved_date = fields.Datetime()
    response_date = fields.Datetime() 
    start_date = fields.Datetime() 
    date = fields.Datetime(string="Date Sent")
    date_char = fields.Char(
        string="Date Display",
        compute="_compute_date_char",
        store=True
    )

    offer_report_ids = fields.Many2many(
        'ir.actions.report',
        # domain="[('type', 'in', ['qweb', 'html'])]",
        string='Templates',
        store=True,
    )

    @api.depends('salary_period', 'proposed_salary')
    def compute_details(self):
        for rec in self:
            if rec.proposed_salary or rec.salary_period:
                text = f"{rec.proposed_salary or 0.00} / {rec.salary_period} - {rec.contract_type_id.name}"
                rec.details = text
            else:
                rec.details = ''

    @api.depends('date')
    def _compute_date_char(self):
        for rec in self:
            if rec.date:
                rec.date_char = rec.date.strftime('%d %b %Y')
                # Example: 15 Mar 2025
            else:
                rec.date_char = False

    def action_send_to_template_candidates(self):
        # TODO: send the email to candidate along with templates, 
        pass 

    def create_employee_from_applicant(self):
        self.ensure_one()
        res = super().create_employee_from_applicant()
        res['context']['default_first_name'] = self.candidate_id.first_name
        res['context']['default_name'] = f"{self.candidate_id.first_name or ''} {self.candidate_id.middle_name} {self.candidate_id.last_name}"
        res['context']['default_middle_name'] = self.candidate_id.middle_name
        res['context']['default_last_name'] = self.candidate_id.last_name
        res['context']['default_department_id'] = self.candidate_id.department_id.id
        res['context']['default_phone'] = self.candidate_id.partner_phone
        res['context']['default_private_email'] = self.candidate_id.email_from
        res['context']['default_job_title'] = self.candidate_id.job_id.name
        res['context']['default_skills_text'] = self.candidate_id.skills_text
        res['context']['default_qualifications_text'] = self.candidate_id.qualifications_text
        res['context']['default_experience_text'] = self.candidate_id.experience_text
        res['context']['default_wage'] = self.proposed_salary
        res['context']['default_applicant_documentation_checklist'] = [(6, 0, [doc.id for doc in self.candidate_id.applicant_documentation_checklist])]

        return res 
    
    def action_create_placement(self):
        return self.create_employee_from_applicant()
        # return {
        #     "type": "ir.actions.act_window",
        #     "name": "Matching Employees",
        #     "res_model": "hr.employee",
        #     "view_mode": "kanban,list,form",
        #     "domain": [("id", "in", self.matching_candidate_ids.ids)],
        #     "target": "current",
        # }  

    def action_send_to_reminder_email(self):
        # TODO: send the email reminder: system should be able to use a mail template, 
        self.action_set_resent() 

    def action_set_draft(self):
        # TODO: send the email notification about this 
        self.offer_stage = 'draft'

    def action_set_awaiting(self):
        # TODO: send the email notification about this 
        self.offer_stage = 'awaiting'

    def action_set_countered(self):
        # TODO: send the email notification about this 
        self.offer_stage = 'countered'

    def action_set_rejected(self):
        # TODO: send the email notification about this 
        self.offer_stage = 'rejected'

    def action_set_resent(self):
        # TODO: send the email notification about this 
        self.offer_stage = 'resent'

    def generate_attachment_from_report(self):
        attachments = []
        for report in self.offer_report_ids:
            pdf, _ = report._render_qweb_pdf(self.id)
            attachment = self.env['ir.attachment'].create({
                'name': f'{report.name}.pdf',
                'type': 'binary',
                'datas': base64.b64encode(pdf),
                'mimetype': 'application/pdf',
            })

            attachments.append(attachment.id)
        return attachments
    
    def send_mail_to_candidates(self):
        """
        Send an email to candidates
        """
        for rec in self:
            # Resolve template: stage-level → module default
            template = self.mail_template_id
            if not template:
                template = self.env.ref(
                    'hr_cleon_recruitment.mail_template_hr_offer_send_notify',
                    raise_if_not_found=False,
                )

            if not template:
                _logger.warning(
                    'hr.offer: no mail template found for offer'
                )
                continue
            candidate = self.candidate_id
            # for approver in self.approver_ids:
            try:
                template.with_context(
                    candidate_name=candidate.name,
                    lang=self.env.user.lang,
                ).send_mail(
                    rec.id,
                    force_send=True,
                    email_values={'email_to': candidate.email_from},
                )
            except Exception as exc:
                _logger.error(
                    'hr.warning: failed to send mail to %s: %s',
                    candidate.email_from, exc,
                )

            # Chatter log
            # approver_names = ', '.join(stage.approver_ids.mapped('name'))
            rec.message_post(
                body=_(
                    'An Offer was sent to <b>%(candidate_name)s</b>. '
                    'Notification sent on : %(datetime)s.',
                    candidate_name=candidate.partner_name,
                    datetime=fields.Datetime.now(),
                ),
                subtype_xmlid='mail.mt_note',
            )

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', _('New')) == _('New'):
                vals['name'] = self.env['ir.sequence'].next_by_code(
                    'hr.offer'
                ) or _('New')
        records = super().create(vals_list)
        return records


class Hrofferwizard(models.TransientModel):
    _name = 'hr.offer.wizard'

    offer_stage = fields.Selection([
        ('candidate', 'Candidate & Jobs'),
        ('offer_terms', 'offer_terms'),
        ('review', 'review'),
        ('sent', 'Sent'),

    ], string="Offer Stage", default='candidate')

    offer_terms = fields.Html(string='Offer terms')
    vendor_id = fields.Many2one('res.partner', string="Vendors")
    department_id = fields.Many2one('hr.department', string="Department")
    
    salary_currency = fields.Many2one('res.currency', string="Currency")
    job_id = fields.Many2one('hr.job', string="Job Role")
    # grade_id = fields.Many2one('hr.grade', string="Grade")
 
    candidate_ids = fields.Many2many(
        'hr.applicant',
        # domain="[('stage_id.hired_stage', '=', True)]",
        string='Candidates',
        store=True,
    )
    # onchange of the applicant, this should show list of templates set for the job positions of applicants selected
    offer_report_ids = fields.Many2many(
        'ir.actions.report',
        # domain="[('type', 'in', ['qweb', 'html'])]",
        string='Templates',
        store=True,
    )
    date = fields.Datetime(string="Date Sent")
    date_generated = fields.Datetime(string="Date Sent")
    date_expiry = fields.Datetime(string="Expiry Date")
    salary_proposed = fields.Float(string='Proposed Salary')

    date_char = fields.Char(
        string="Date Display",
        compute="_compute_date_char",
        store=True
    )
    include_attachment = fields.Boolean(
        string="Include attachment",
        store=True,
        default=True,
    )
    mail_template_id = fields.Many2one(
        'mail.template',
        string='Mail templates',
    )

    available_report_ids = fields.Many2many(
        'ir.actions.report',
        'hr_offer_wizard_available_report_rel',
        'wizard_id',
        'report_id',
        string='Available Templates',
        compute='_compute_available_reports',
        store=True,
    )
 
    @api.depends('candidate_ids', 'candidate_ids.job_id')
    def _compute_available_reports(self):
        """
        Collect all offer_report_ids from the job positions of every
        selected candidate and expose them so the widget can display them.
        """
        for wizard in self:
            job_ids = wizard.candidate_ids.mapped('job_id')
            reports = job_ids.mapped('offer_report_ids')
            wizard.available_report_ids = reports
 
    @api.onchange('candidate_ids')
    def _onchange_candidate_ids(self):
        """
        When candidates change, rebuild the available template pool and
        pre-select templates that appear on ALL selected jobs (intersection).
        Individual selection is still possible via the kanban widget.
        """
        job_ids = self.candidate_ids.mapped('job_id')
        if not job_ids:
            self.offer_report_ids = [(5, 0, 0)]
            return
 
        # Union of all templates across selected jobs
        all_reports = job_ids.mapped('offer_report_ids')
        # Auto-select only templates common to every job (intersection)
        if len(job_ids) > 1:
            common = job_ids[0].offer_report_ids
            for job in job_ids[1:]:
                common = common & job.offer_report_ids
            self.offer_report_ids = common
        else:
            self.offer_report_ids = all_reports
 
    @api.onchange('job_id')
    def _onchange_job_id(self):
        if self.job_id:
            self.offer_terms    = self.job_id.offer_terms if hasattr(self.job_id, 'offer_terms') else False
            self.department_id  = self.job_id.department_id
 

    @api.onchange('job_id')
    def onchange_job_id(self):
        if self.job_id:
            self.offer_terms = self.job_id.offer_terms
            self.department_id = self.job_id.department_id.id

    def action_view_offer_terms(self):
        # TODO: this is the second step which should show the offer terms by hiding 
        # the elements of some sections, such as the candidate_ids, offer_report_ids, date, date_generated,
        self.offer_stage = 'offer_terms'
        return self._reopen()

    def action_view_reiew(self):
        # TODO:  this will show all sections in one view for final review, note: all fields should be at readonly
        self.offer_stage = 'review'
        return self._reopen()

    def action_goback(self):
        transitions = {
            'offer_terms': 'candidate',
            'review':      'offer_terms',
        }
        self.offer_stage = transitions.get(self.offer_stage, 'candidate')
        return self._reopen()
    
    def action_send_to_candidates(self, offer):
        offer.send_mail_to_candidates()
        self.offer_stage = 'sent'

    @api.depends('date')
    def _compute_date_char(self):
        for rec in self:
            if rec.date:
                rec.date_char = rec.date.strftime('%d %b %Y')
                # Example: 15 Mar 2025
            else:
                rec.date_char = False

    def action_generate_offers(self):
        """Create hr.offer from manual form data."""
        if not self.candidate_ids:
            raise UserError(_('You must add one or more candidates'))
        if not self.offer_report_ids:
            raise UserError(_('Please Select offer templates'))
        # if not self.mapped('candidate_ids'):# .filtered(lambda self: not self.email_from):
        # for count, cd in enumerate(self.candidate_ids, 1):
        #     if not cd.email_from:
        #         return {
        #             'type': 'ir.actions.client',
        #             'tag': 'display_notification',
        #                 'params': {
        #                     'title': _("Validation Notification"),
        #                     'message':  _(f"The candidate {cd.partner_name or cd.name or ''} does not have email set at line {count}. Kindly review and correct"),
        #                     'type': 'danger',
        #                     'sticky': False
        #                 }
        #         }
        items =[]
        for rec in self.candidate_ids:
            offer = self.env['hr.offer'].create({
                'offer_stage':     'awaiting',
                'candidate_id':       rec.id,
                'date_generated':    fields.Datetime.now(),
                'offer_report_ids': self.offer_report_ids.ids,
                'date_expiry': self.date_expiry,
                'vendor_id': self.vendor_id,
                'department_id': self.department_id.id,
                'job_id': self.job_id.id,
                'mail_template_id': self.mail_template_id.id,

            })
            items.append(offer)
            if self.include_attachment:
                self.action_send_to_candidates(offer)
            # rec.email_sent = True
        return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                    'params': {
                        'title': _("Sucessfully sent offers"),
                        'message':  _(f"A total of {len(self.candidate_ids.ids)} was send successfully "),
                        'type': 'success',
                        'sticky': False
                    }
            }

    def _reopen(self):
        """Return an action that re-opens this same wizard record (refreshes the view)."""
        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
            'context': self.env.context,
            'name': "Offer",
        }

