# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError
import base64


class HrApplicantCandidateWizard(models.TransientModel):
    _name = 'hr.applicant.candidate.wizard'
    _description = 'Add Candidate Wizard'

    # ── Mode field controls which screen is visible ──────────────────────────
    mode = fields.Selection([
        ('select',   'Select Method'),
        ('manual',   'Manual Entry'),
        ('resume',   'Upload Resume'),
        ('bulk',     'Bulk Upload'),
        ('linkedin', 'LinkedIn Import'),
    ], default='select', required=True)

    # ── Manual Entry fields ──────────────────────────────────────────────────
    first_name          = fields.Char(string='First Name')
    last_name           = fields.Char(string='Last Name')
    email_from          = fields.Char(string='Email')
    partner_phone       = fields.Char(string='Phone')
    partner_name        = fields.Char(string='Location')
    years_experience    = fields.Integer(string='Years of Experience')
    salary_expected     = fields.Float(string='Current Salary')
    salary_proposed     = fields.Float(string='Expected Salary')
    job_id              = fields.Many2one('hr.job', string='Apply to Job')

    # ── Resume Upload fields ─────────────────────────────────────────────────
    resume_file         = fields.Binary(string='Resume File')
    resume_file_name    = fields.Char(string='Resume File Name')

    # ── Bulk Upload fields ───────────────────────────────────────────────────
    csv_file            = fields.Binary(string='CSV File')
    csv_file_name       = fields.Char(string='CSV File Name')
    bulk_resume_files   = fields.Binary(string='Bulk Resume Files')

    # ── LinkedIn fields ──────────────────────────────────────────────────────
    linkedin_url = fields.Char(string='LinkedIn Profile URL')

    # ════════════════════════════════════════════════════════════════════
    #  Mode navigation actions
    # ════════════════════════════════════════════════════════════════════
    def _reopen(self):
        """Return an action that re-opens this same wizard record (refreshes the view)."""
        return {
            'type': 'ir.actions.act_window',
            'res_model': "hr.applicant.candidate.wizard",
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
            'context': self.env.context,
            'name': "Add candidate",
        }

    def action_mode_select(self):
        self.mode = 'select'
        return self._reopen()

    def action_mode_manual(self):
        self.mode = 'manual'
        return self._reopen()

    def action_mode_resume(self):
        self.mode = 'resume'
        return self._reopen()

    def action_mode_bulk(self):
        self.mode = 'bulk'
        return self._reopen()

    def action_mode_linkedin(self):
        self.mode = 'linkedin'
        return self._reopen()

    # ════════════════════════════════════════════════════════════════════
    #  Submit actions
    # ════════════════════════════════════════════════════════════════════

    def action_add_candidate_manual(self):
        """Create hr.applicant from manual form data."""
        if not self.first_name or not self.last_name:
            raise UserError(_('First Name and Last Name are required.'))
        if not self.email_from:
            raise UserError(_('Email is required.'))

        full_name = f"{self.first_name} {self.last_name}".strip()

        applicant = self.env['hr.applicant'].create({
            'name':     'Application for - ' + full_name or '',
            'partner_name':     full_name,
            'email_from':       self.email_from,
            'partner_phone':    self.partner_phone,
            'job_id':           self.job_id.id,
            'salary_expected':  self.salary_expected,
            'salary_proposed':  self.salary_proposed,
        })

        return {
            'type': 'ir.actions.act_window',
            'res_model': 'hr.applicant',
            'res_id': applicant.id,
            'view_mode': 'form',
            'target': 'current',
        }

    def action_add_candidate_resume(self):
        """Process uploaded resume (stub – plug in your AI extraction here)."""
        if not self.resume_file:
            raise UserError(_('Please upload a resume file.'))

        # TODO: call AI extraction service here
        # extracted = self._extract_resume(self.resume_file, self.resume_file_name)

        applicant = self.env['hr.applicant'].create({
            'partner_name': self.resume_file_name or _('Imported Candidate'),
            'job_id': self.job_id.id,
            'name':     'Application - Imported Candidate',

        })

        # Attach the resume
        self.env['ir.attachment'].create({
            'name':     self.resume_file_name or 'resume',
            'datas':    self.resume_file,
            'res_model': 'hr.applicant',
            'res_id':   applicant.id,
        })

        return {
            'type': 'ir.actions.act_window',
            'res_model': 'hr.applicant',
            'res_id': applicant.id,
            'view_mode': 'form',
            'target': 'current',
        }

    def action_choose_csv(self):
        """Trigger CSV upload (handled client-side via binary widget)."""
        if not self.csv_file:
            raise UserError(_('Please choose a CSV file first.'))
        # TODO: parse CSV and bulk-create applicants
        return {'type': 'ir.actions.act_window_close'}

    def action_choose_resumes(self):
        """Trigger bulk resume upload."""
        if not self.bulk_resume_files:
            raise UserError(_('Please choose resume files first.'))
        # TODO: iterate files and create applicants
        return {'type': 'ir.actions.act_window_close'}

    def action_download_csv_template(self):
        """Return a downloadable CSV template."""
        csv_content = "firstName,lastName,email,phone,location,position,experience\nJohn,Doe,john.doe@example.com,+1 555 123 4567,San Francisco CA,Software Engineer,5\n"
        csv_bytes   = base64.b64encode(csv_content.encode('utf-8'))

        attachment = self.env['ir.attachment'].create({
            'name':     'candidate_template.csv',
            'datas':    csv_bytes,
            'mimetype': 'text/csv',
        })

        return {
            'type': 'ir.actions.act_url',
            'url':  f'/web/content/{attachment.id}?download=true',
            'target': 'self',
        }

    def action_import_linkedin(self):
        """Import candidate from LinkedIn (stub – plug in your scraper here)."""
        if not self.linkedin_url:
            raise UserError(_('Please enter a LinkedIn profile URL.'))
        if 'linkedin.com/in/' not in self.linkedin_url:
            raise UserError(_('Please enter a valid LinkedIn profile URL (e.g. https://www.linkedin.com/in/username).'))

        # TODO: fetch LinkedIn public profile data
        name = self.linkedin_url.rstrip('/').split('/')[-1].replace('-', ' ').title(),
        applicant = self.env['hr.applicant'].create({
            'partner_name':  name,
            'linkedin_profile': self.linkedin_url,
            'job_id':        self.job_id.id,
            'name': name,
        })

        return {
            'type': 'ir.actions.act_window',
            'res_model': 'hr.applicant',
            'res_id': applicant.id,
            'view_mode': 'form',
            'target': 'current',
        }