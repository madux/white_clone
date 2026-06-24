# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError
import base64
import io
import re
import logging
import requests
import fitz
import ollama
import json
from io import BytesIO
_logger = logging.getLogger(__name__)

EMAIL_RE = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
PHONE_RE = re.compile(r'(\+?\d[\d\s\-\(\)]{8,}\d)')
WEBSITE_RE = re.compile(
    r'(https?://[^\s,]+|www\.[^\s,]+|(?:linkedin\.com|github\.com|portfolio\.[^\s,]+)/[^\s,]+)',
    re.IGNORECASE
)

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

    extract_option = fields.Selection([
        ('ai',   'AI'),
        ('haiku',   'haiku'),
        ('sonnet',   'sonnet'),
        ('regex',     'Regex'),
    ], default='regex', required=True, string="Extract option")

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

    # ===================================================================
    # AI CV EXTRACTOR 
    # ── Resume Upload / AI Extractor ─────────────────────────────────
    # applicant_id is OPTIONAL: if not set, we create a new hr.applicant
    # from the parsed CV data. If set, we enrich the existing record.
    applicant_id = fields.Many2one('hr.applicant', string='Existing Applicant')

    def action_add_candidate_resume(self):
        self.ensure_one()
        if not self.resume_file:
            raise UserError(_("Please attach a file."))
        if not self.resume_file_name:
            raise UserError(_("The uploaded file has no filename — cannot determine its type."))
        return self.return_data_result()

        # raw_bytes = base64.b64decode(self.resume_file)

        # 1. Resolve target applicant: use existing, or create a stub now
        # applicant = self.applicant_id
        # if not applicant:
        #     vals = {'partner_name': self.resume_file_name, 'name': f'Application for {self.resume_file_name}'}  # placeholder name, overwritten after parsing
        #     if self.job_id:
        #         vals['job_id'] = self.job_id.id
        #     applicant = self.env['hr.applicant'].create(vals)

        # # 2. Attach the file to the applicant record
        # attachment = self.env['ir.attachment'].create({
        #     'name': self.resume_file_name,
        #     'datas': self.resume_file,
        #     'res_model': 'hr.applicant',
        #     'res_id': applicant.id,
        #     'mimetype': self._guess_mimetype(self.resume_file_name),
        # })
        # applicant.message_post(
        #     body=_("CV uploaded and parsed."),
        #     attachment_ids=[attachment.id],
        # )

        # 3. Extract raw text depending on file type
        # text = self._extract_text(raw_bytes, self.resume_file_name)
        # if not text or not text.strip():
        #     raise UserError(_("Could not extract any text from this file."))

        # 4. Parse structured fields (regex + LLM) — implemented on hr.applicant
        # data = applicant._parse_cv_text(text)

        # 5. Apply parsed data
        # applicant._apply_parsed_cv_data(data)

        # return {
        #     'type': 'ir.actions.act_window',
        #     'res_model': 'hr.applicant',
        #     'res_id': applicant.id,
        #     'view_mode': 'form',
        #     'target': 'current',
        # }

    def _guess_mimetype(self, filename):
        lower = (filename or '').lower()
        if lower.endswith('.pdf'):
            return 'application/pdf'
        elif lower.endswith('.png'):
            return 'image/png'
        elif lower.endswith(('.jpg', '.jpeg')):
            return 'image/jpeg'
        elif lower.endswith('.txt'):
            return 'text/plain'
        return 'application/octet-stream'

    def _extract_text(self, raw_bytes, filename):
        lower = filename.lower()
        if lower.endswith('.pdf'):
            return self._extract_pdf_text(raw_bytes)
        elif lower.endswith(('.png', '.jpg', '.jpeg')):
            return self._extract_image_text_ocr(raw_bytes)
        elif lower.endswith('.txt'):
            try:
                return raw_bytes.decode('utf-8', errors='ignore')
            except Exception as e:
                _logger.error("TXT decode failed: %s", e)
                return None
        else:
            raise UserError(_("Unsupported file type: %s. Use PDF, TXT, PNG, or JPG.") % filename)

    def _extract_pdf_text(self, raw_bytes):
        """Try native text extraction first; fall back to OCR for scanned PDFs."""
        text = self._extract_pdf_text_native(raw_bytes)
        if self._is_text_sufficient(text):
            return text
        _logger.info("Native PDF extraction insufficient, falling back to OCR.")
        return self._extract_pdf_text_ocr(raw_bytes)

    def _extract_pdf_text_native(self, raw_bytes):
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(raw_bytes))
            return "\n".join((page.extract_text() or '') for page in reader.pages)
        except Exception as e:
            _logger.error("Native PDF extraction failed: %s", e)
            return None

    def _is_text_sufficient(self, text):
        return bool(text) and len(text.strip()) > 200

    def _extract_pdf_text_ocr(self, raw_bytes):
        try:
            import pytesseract
            from pdf2image import convert_from_bytes

            images = convert_from_bytes(raw_bytes, dpi=300)
            text_chunks = []
            for i, image in enumerate(images):
                page_text = pytesseract.image_to_string(image, lang='eng')
                text_chunks.append(page_text)
                _logger.info("OCR extracted %d chars from page %d", len(page_text), i + 1)
            return "\n".join(text_chunks)
        except Exception as e:
            _logger.error("OCR extraction failed: %s", e)
            return None

    def _extract_image_text_ocr(self, raw_bytes):
        try:
            import pytesseract
            from PIL import Image
            image = Image.open(io.BytesIO(raw_bytes))
            return pytesseract.image_to_string(image, lang='eng')
        except Exception as e:
            _logger.error("Image OCR failed: %s", e)
            return None

    def return_data_result(self):
        raw_text = self._extract_resume_text()
        if self.extract_option == "ai":
            data = self.generate_text_with_ai(raw_text)
            if not data: 
                raise UserError(_("AI Could not extract any text from this file."))

            # raise UserError(data)
            applicant = self.create_applicant_from_resume(data)
        else:
            '''use normal regex'''
            data = self.parse_resume(raw_text)
            if not data: 
                raise UserError(_("Could not extract any text from this file."))
            _logger.info(f"""Our ai data is {data}""")
            applicant = self.create_applicant_from_resume(data)
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'hr.applicant',
            'res_id': applicant.id,
            'view_mode': 'form',
            'target': 'current',
        }

    def parse_resume(self, text):
        result = {
            "name": "",
            "email": "",
            "phone": "",
            "education": [],
            "experiences": [],
            "skills": [],
        }

        # ----------------------------
        # Clean text
        # ----------------------------
        text = re.sub(r'\r', '', text)

        lines = [
            line.strip()
            for line in text.split('\n')
            if line.strip()
        ]

        # ----------------------------
        # Name
        # Usually first line
        # ----------------------------
        if lines:
            result["name"] = lines[0].title()

        # ----------------------------
        # Email
        # ----------------------------
        email_match = re.search(
            r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}',
            text
        )

        if email_match:
            result["email"] = email_match.group()

        # ----------------------------
        # Phone
        # ----------------------------
        phone_match = re.search(
            r'(\+?\d[\d\s\-\(\)]{8,}\d)',
            text
        )

        if phone_match:
            result["phone"] = phone_match.group().strip()

        # ----------------------------
        # Education
        # ----------------------------
        education_match = re.search(
            r'EDUCATION(.*?)(PROFESSIONAL EXPERIENCE|EXPERIENCE)',
            text,
            re.DOTALL | re.IGNORECASE
        )

        if education_match:
            education_text = education_match.group(1)

            year_match = re.search(
                r'(\d{4})\s*-\s*(\d{4})',
                education_text
            )

            result["education"].append({
                "description": education_text.strip(),
                "year_from": year_match.group(1) if year_match else "",
                "year_to": year_match.group(2) if year_match else "",
            })

        # ----------------------------
        # Experience
        # ----------------------------
        exp_match = re.search(
            r'PROFESSIONAL EXPERIENCE(.*?)(PROJECTS|SKILLS|CERTIFICATIONS|COURSES|AWARDS)',
            text,
            re.DOTALL | re.IGNORECASE
        )
        if exp_match:
            exp_text = exp_match.group(1)
            experience_blocks = re.split(
                r'\n\s*(?=[A-Z][A-Za-z\s\(\)/\-]{3,}\n)',
                exp_text
            )

            for block in experience_blocks:

                block = block.strip()

                if len(block) < 20:
                    continue

                lines_block = [
                    x.strip()
                    for x in block.splitlines()
                    if x.strip()
                ]

                if len(lines_block) < 2:
                    continue

                title = lines_block[0]

                company = lines_block[1]

                duration_match = re.search(
                    r'([A-Z][a-z]{2,}\.?\s*\d{4}\s*[–\-]\s*(?:Present|[A-Z][a-z]{2,}\.?\s*\d{4}))',
                    block
                )

                result["experiences"].append({
                    "job_title": title,
                    "company": company,
                    "duration": duration_match.group(1) if duration_match else "",
                    "description": block,
                })

        # ----------------------------
        # Skills
        # ----------------------------
        skills_match = re.search(
            r'SKILLS(.*?)(COURSES|CERTIFICATIONS|AWARDS)',
            text,
            re.DOTALL | re.IGNORECASE
        )

        if skills_match:

            skills_text = skills_match.group(1)

            skills = re.findall(
                r':\s*([^\n]+)',
                skills_text
            )

            for skill_line in skills:
                result["skills"].extend(
                    [
                        x.strip()
                        for x in skill_line.split(',')
                        if x.strip()
                    ]
                )

        return result

    def clean_resume_text(self, text):
        # Remove common PDF bullet characters
        text = text.replace('\uf06c', '')
        text = text.replace('•', '')
        text = text.replace('◦', '')
        text = text.replace('▪', '')

        # Remove excessive whitespace
        text = re.sub(r'[ \t]+', ' ', text)
        text = re.sub(r'\n{2,}', '\n', text)
        #text = text.replace('\n', '')

        return text.strip()
     
    def _extract_resume_text(self):
        self.ensure_one()
        if not self.resume_file:
            return ""
        pdf_content = base64.b64decode(self.resume_file)
        doc = fitz.open(
            stream= BytesIO(pdf_content).read(),
            filetype="pdf"
        )
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text
    
    def create_applicant_from_resume(self, data):
        self.ensure_one()

        # -------------------------
        # Flatten education
        # -------------------------
        education_text = ""

        for edu in data.get("education", []):
            education_text += (
                f"Description: {edu.get('description')}\n"
                f"From: {edu.get('year_from')} - To: {edu.get('year_to')}\n\n"
            )

        # -------------------------
        # Flatten experiences
        # -------------------------
        experience_text = ""

        for exp in data.get("experiences", []):
            experience_text += (
                f"Job Title: {exp.get('job_title')}\n"
                f"Company: {exp.get('company')}\n"
                f"Duration: {exp.get('duration')}\n"
                f"Description: {exp.get('description')}\n"
                f"{'-'*40}\n"
            )

        # -------------------------
        # Flatten skills
        # -------------------------
        skills_text = ", ".join(data.get("skills", []))

        # -------------------------
        # Create applicant
        # -------------------------
        vals = {
            "name": f"Application for - {data.get("name")}",
            "partner_name": data.get("name"),
            "email_from": data.get("email"),
            "partner_phone": data.get("phone"),
            "job_id": self.job_id.id,
            # TEXT fields in 66your model
            "qualifications_text": education_text,
            "experience_text": experience_text,
            "skills_text": skills_text,
        }
        applicant = self.env["hr.applicant"].create(vals)
        return applicant

    def generate_text_with_ai(self, raw_text,model='llama3'):
        try:

            prompt = f"""Extract the following fields from this CV text and return
                ONLY a valid JSON object — no explanation, no markdown fences.

            Schema:
            {{
            "first_name": "",
            "last_name": "",
            "email": "",
            "phone": "",
            "website": "",
            "skills": [],
            "qualifications": [],
            "experience": [
                {{"company": "", "title": "", "duration": "", "summary": ""}}
            ]
            }}

            CV TEXT:
            \"\"\"{raw_text[:8000]}\"\"\"
            """

            response = ollama.chat(
                model=model,
                messages=[{'role': 'user', 'content': prompt}],
                format='json',          # forces structured JSON output, no free text
                keep_alive='30m',       # keep model loaded in RAM between calls
                options={
                    'num_predict': 800, # cap output length -> faster
                    'temperature': 0,   # deterministic, slightly faster + more consistent
                },
            )

            content = response['message']['content']
            if not content:
                _logger.info("AI could not return any data")
                return None

            try:
                data = json.loads(content)
            except json.JSONDecodeError:
                _logger.info("Model returned invalid JSON:", content)
                return None
            return data

        except Exception as e:
            print("CV parsing failed:", e)
            return None

        
    # def _generate_text_with_AI(self, raw_text):
    #     try:
    #         import ollama
    #         command_prompt = """Don't add any text in your response. just return only the
    #         result in python dictionary so i can used it to populate my database table"""
    #         default_prompt=f"""
    #         from the {raw_text}, extract email: 'maduka' phone: 0909876879 
    #         this is my cv name: maduka sopulu,
    #         """
    #         prompt = default_prompt
    #         # prompt = self.user_prompt or default_prompt
    #         ollama_prompt = f"{prompt}-{command_prompt}"
    #         response = ollama.chat(model='llama3', messages=[
    #         {
    #             'role': 'user',
    #             'content': ollama_prompt
    #         },
    #         ])

    #         # print(response['message']['content'])
    #         result = response['message']['content']
    #         if not result:
    #             raise UserError("AI could not return any data")
    #         else:
    #             return response['message']['content']
        
    #     except Exception as e:
    #         _logger.error("Native PDF extraction failed: %s", e)
    #         return None

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
        if not self.job_id.offer_report_ids:
            raise UserError(_('Contact admin to set up an offer template.'))
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

    def action_add_candidate_resume2(self):
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
        # Example:
        # https://www.linkedin.com/in/maduka-sopulu-christopher-350b15111/

        slug = self.linkedin_url.rstrip('/').split('/')[-1]

        # Remove LinkedIn numeric identifier at the end if present
        parts = slug.split('-')
        if parts and parts[-1].isalnum() and any(ch.isdigit() for ch in parts[-1]):
            parts = parts[:-1]

        name = " ".join(parts).title()

        f, m, l = '', '', ''

        if name:
            fml = name.split()

            if len(fml) == 1:
                f = fml[0]

            elif len(fml) == 2:
                f = fml[0]
                l = fml[1]

            else:
                f = fml[0]
                m = " ".join(fml[1:-1])
                l = fml[-1]

        #print(f, m, l)

        applicant = self.env['hr.applicant'].create({
            'partner_name':  f"{name}",
            'first_name': f,
            'middle_name':  m,
            'last_name':  l,
            'linkedin_profile': self.linkedin_url,
            'job_id':        self.job_id.id,
            'name': f"Application for - {name}",
        })

        return {
            'type': 'ir.actions.act_window',
            'res_model': 'hr.applicant',
            'res_id': applicant.id,
            'view_mode': 'form',
            'target': 'current',
        }