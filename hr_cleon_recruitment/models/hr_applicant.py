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
    location = fields.Char(string="Location")
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
    
    offer_id = fields.Many2one("hr.offer", "Offer Reference", readonly="1")
    email_sent = fields.Boolean(string="Email sent", help="This tracks the emails sent")

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

    