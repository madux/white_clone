from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging
from odoo.exceptions import UserError
import json
import ollama
_logger = logging.getLogger(__name__)
import requests
import textwrap

BEARER_TOKEN_FROM_DEEPSEEK = "rYT0upPZwNRIhi+fjgEvog=="
# _logger = logging.getLogger(__name__)


class HrGradeAi(models.TransientModel):
    """Shows how much tax each bracket contributed for a given taxable amount."""
    _name = "hr.grade_ai"
    _description = "AI determines salary band"

    grade_id = fields.Many2one("cleon.hr.grade", required=True, readonly=True)
    amount = fields.Integer(string="Starting Amount")
    ai_prompt = fields.Text()
    ai_response = fields.Text()
    payment_type = fields.Selection([
            ('monthly','Monthly'),
            ('annual','Per Annum'),
        ], default="monthly", string="Pay type")
    show_payroll_link = fields.Boolean(
                        string="Payroll menu Link",
                        default=True,
                        help="Used to hold widget in form view"
                    )


    def break_text_into_lines(self, text, line_length=40):
        """Wrap long text while preserving existing paragraphs."""
        if not text:
            return ""

        return "\n".join(
            textwrap.fill(
                paragraph,
                width=line_length,
                break_long_words=False,
                break_on_hyphens=False,
            ) if paragraph.strip() else ""
            for paragraph in text.splitlines()
        )


    def ask_ai(self, vals=None):
        """Send the AI prompt to TheHive AI and open the response form."""
        self.ensure_one()

        vals = vals or {}

        prompt = (
            vals.get("ai_prompt")
            if "ai_prompt" in vals
            else self.ai_prompt
        )

        if not prompt or not prompt.strip():
            raise ValidationError("Please provide an AI prompt.")

        # Configure the API key under:
        # Settings > Technical > Parameters > System Parameters
        # Key: thehive_ai.api_key
        api_key = self.env["ir.config_parameter"].sudo().get_param(
            "thehive_ai.api_key"
        )
        api_key = BEARER_TOKEN_FROM_DEEPSEEK

        if not api_key:
            raise ValidationError(
                "TheHive AI API key is not configured. "
                "Please set the system parameter 'thehive_ai.api_key'."
            )

        

        url = "https://api.thehive.ai/api/v3/chat/completions"

        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        payload = {
            "model": "deepseek-ai/deepseek-v4.1-flash",
            "temperature": 0.7,
            "top_p": 0.9,
            "stream": False,
            "max_tokens": 4096,
            "messages": [
                {
                    "role": "user",
                    "content": prompt,
                }
            ],
        }

        try:
            _logger.info("Sending prompt to TheHive AI.")

            response = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=60,
            )

            response.raise_for_status()
            result = response.json()

            ai_response_content = result["choices"][0]["message"]["content"]
            ai_response_response_content = result["choices"][0]["message"]["reasoning_content"]
            # ai_response = ai_response_content or ai_response_response_content 
            if not ai_response_content:
                raise UserError(
                    f"The AI returned suggestive response. {ai_response_response_content}"
                )
            formatted_text = self.break_text_into_lines(
                ai_response_content,
                line_length=40,
            )

            _logger.info("TheHive AI response received successfully.")

            return {
                "type": "ir.actions.act_window",
                "res_model": "hr.grade_ai",
                "name": "AI Prompt",
                "view_mode": "form",
                "target": "new",
                "context": {
                    "default_grade_id": self.grade_id.id,
                    "default_amount": 0,
                    "default_ai_prompt": prompt,
                    "default_ai_response": formatted_text,
                },
            }

        except requests.exceptions.RequestException as exc:
            _logger.exception("TheHive AI API request failed.")
            raise ValidationError(
                f"AI API request failed: {exc}"
            ) from exc

        except (ValueError, KeyError, IndexError, TypeError) as exc:
            _logger.exception("Could not parse the TheHive AI response.")
            raise ValidationError(
                f"Could not parse the AI response: {exc}"
            ) from exc

    def generate_salary_lines(self):
        '''compute the salary line'''
        if self.grade_id:
            if self.amount > 0:
                self.grade_id.starting_amount = self.amount 
                self.grade_id.action_generate_level_salaries(self.payment_type)
            else:
                raise ValidationError('Starting Amount must be greater than zero')
        else:
            raise ValidationError('Grade not provided')



class HrLevel(models.Model):
    _name = "hr.level"
    _description = "HrLevel"
    _rec_name = "name"

    name = fields.Char(string="Name")
    description = fields.Text(
        string='Description',
        copy=False,
    )
   
    salary_band = fields.Float(
            string="S",
            store=True,
            copy=False,
        )
    salary = fields.Float(
                string="Salary Band",
                required=True,
                store=True,
                copy=False,
                default=0
            )
    country_id = fields.Many2one('res.country', string="Country")
    active = fields.Boolean(
        string='Active',
        copy=False,
        default=True
    )
    show_payroll_link = fields.Boolean(
            string="Payroll menu Link",
            default=True,
            help="Used to hold widget in form view"
        )


class HrLevelBand(models.Model):
    _name = "hr.level.band"
    _description = "HrLevel"
    _rec_name = "level_id"

    description = fields.Text(
        string='Description',
        copy=False,
    )
   
    salary = fields.Float(
            string="Wage Band (Per Month)",
            required=True,
            store=True,
            default=0,
            copy=False,
        )
    level_id = fields.Many2one('hr.level', string="Level")
    grade_id = fields.Many2one('cleon.hr.grade', string="Grade")
    active = fields.Boolean(
        string='Active',
        copy=False,
        default=True
    )


class CleonHrGrade(models.Model):
    _name = "cleon.hr.grade"
    _description = "HrGrade"
    _rec_name = "name"

    name = fields.Char(string="Name")
    min_salary_band = fields.Float(
        string="Min Salary Band",
        copy=False,
    )

    minimum_salary_band = fields.Float(
            string="Min Salary Band (Per month)",
            copy=False,
        )

    max_salary_band = fields.Float(
        string="Max Salary Band",
        copy=False,
    )
    salary_band = fields.Char(
        string="Salary Band (Per month)",
        compute="_compute_salary_band",
        store=True,
        copy=False,
    )

    leave_duration = fields.Integer(
        string="Leave Duration (Days)",
        copy=True,
    )
    level_band_ids = fields.One2many(
        "hr.level.band",
        "grade_id",
        string="Level Band",
        copy=False,
    )
    employee_ids = fields.One2many(
            "hr.employee",
            "grade_id",
            string="Employees",
            copy=True,
        )
    employee_count = fields.Integer(
        string="Employees count",
        copy=True,
        compute="_compute_employee_ids",
    )
    cash_advance_limit = fields.Float(
        string="Cash Advance limit",
        copy=True,
        default=20000,
    )
    active = fields.Boolean(
            string="Active", default=True)

    cash_approval_limit = fields.Float(
        string="Cash Approval limit",
        copy=True,
    )

    starting_amount = fields.Float(
            string="Starting Salary (Per month)",
            default=70000.0,
            required=True,
        )
    
    increment_percentage = fields.Float(
        string="Increment Percentage (%)",
        default=10.0,
        required=True,
    )

    country_id = fields.Many2one(
        'res.country',
            string="Country",
            default=lambda self: self.env.ref('base.ng').id,
        )
    show_payroll_link = fields.Boolean(
                            string="Payroll menu Link",
                            default=True,
                            help="Used to hold widget in form view"
                        )

    def generate_text_with_ai_light(self,prompt, model='llama3:latest'):
        # prompt = '''What is the salary for level 1 CONUASS 1 - Graduate Assistant in nigeria'''
        response = ollama.chat(model=model, messages=[
        {
        'role': 'user',
        'content': prompt,
        },
        ])

        data = response['message']['content']
        return data
 
    def action_generate_with_ai(self):
        raw_text = f'What is the lower step Basic current salary for {self.name} in {self.country_id.name} as at today?'
        if not raw_text:
            raise ValidationError('Please provide AI Prompt')
        if not self.structure_id:
            raise UserError(_("Please add a salary structure."))

        return {
            'type': 'ir.actions.act_window',
            'res_model': 'hr.grade_ai',
            'name': 'AI Prompt',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_grade_id': self.id, 
                'default_amount': 0,
                'default_ai_prompt': raw_text
            }
        }
        # prompt = f"""{raw_text} {{
        #                 "explanation": "Short explanation of the output",
        #                 "amount": "The {self.structure_id.name} Amount."
        #             }}
        #         USER REQUIREMENT:
        #         {raw_text[:120000]}"""
        # data = self.generate_text_with_ai(raw_text, model="llama3", prompt=prompt)
        
        # if data:
        #     ai_response = data.get("explanation")
        #     amount = data.get("amount")
        #     return {
        #         'type': 'ir.actions.act_window',
        #         'res_model': 'hr.grade_ai',
        #         'name': 'AI Prompt',
        #         'view_mode': 'form',
        #         'target': 'new',
        #         'context': {
        #             'default_grade_id': self.id, 
        #             'default_amount': 0,
        #             'default_ai_response': ai_response +'\n'+ amount
        #         }
        #     }
        # else:
        #     raise ValidationError("AI could not find data response for the structure provided")

    def generate_text_with_ai(self, raw_text, model="llama3", prompt=False):
        """
        Ask Ollama to generate Python code based on the supplied requirements.

        Returns:
            dict:
            {
                "explanation": "...",
                "amount": "..."
            }
        """

        if not raw_text:
            _logger.info("OLLAMA RESPONSE- No raw text provided: %s", raw_text)
            return None

        try:
            _logger.info("OLLAMA RESPONSE- MODEL IS : %s", model)
            
            response = ollama.chat(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                format="json",
                keep_alive="10m",
                options={
                    "temperature": 0,
                    "num_predict": 800,
                    "num_ctx": 4096, 
                },
            )

            _logger.info("OLLAMA RESPONSE: %s", response)

            # Support Ollama object response
            if hasattr(response, "message"):
                content = response.message.content
            else:
                content = response.get("message", {}).get("content")

            if not content:
                _logger.warning("Ollama returned empty content")
                return None

            _logger.info("OLLAMA CONTENT: %s", content)

            try:
                data = json.loads(content)
            except json.JSONDecodeError:
                _logger.error(
                    "Ollama returned invalid JSON: %s",
                    content
                )
                return None

            if not data:
                _logger.warning(
                    "Ollama did not return data: %s",
                    data
                )
                return None

            return data 

        except Exception as e:
            _logger.exception("Ollama AI generation failed: %s", e)
            return None

    def action_generate_level_salaries(self, payment_type="monthly"):
        for record in self:
            if not record.level_band_ids:
                raise UserError(_("Please add at least one level band."))

            if record.starting_amount > record.max_salary_band:
                raise UserError(_("Starting salary cannot be greater than max salary band."))
            
            if record.starting_amount < 0:
                raise UserError(_("Starting salary cannot be negative."))

            if record.increment_percentage < 0:
                raise UserError(_("Increment percentage cannot be negative."))

            salary = record.starting_amount
            if payment_type == 'annual':
                salary = record.starting_amount / 12 
            else:
                salary = record.starting_amount

            multiplier = 1 + (record.increment_percentage / 100.0)

            # Preserve the existing order of the level_band_ids lines.
            for index, line in enumerate(record.level_band_ids):
                if index == 0:
                    if payment_type == 'annual':
                        salary = record.starting_amount / 12 
                    else:
                        salary = record.starting_amount
                else:
                    salary *= multiplier

                line.salary = salary

        return True
        

    @api.depends('employee_ids.name')
    def _compute_employee_ids(self):
        for rec in self:
            if rec.employee_ids:
                rec.employee_count = sum(rec.employee_ids.ids)
            else:
                rec.employee_count = 0

    @api.onchange('max_salary_band')
    def onchange_max_salary_band(self):
        self.ensure_one()
        if self.max_salary_band > 0 and self.max_salary_band < self.minimum_salary_band:
            raise ValidationError("Max salary band cannot be lesser than min salary band")

    def _format_amount(self, amount):
        if amount >= 1_000_000_000:
            return f"{amount / 1_000_000_000:.1f}B".rstrip('0').rstrip('.')
        elif amount >= 1_000_000:
            return f"{amount / 1_000_000:.1f}M".rstrip('0').rstrip('.')
        elif amount >= 1_000:
            return f"{amount / 1_000:.1f}K".rstrip('0').rstrip('.')
        return str(int(amount))

    @api.depends('minimum_salary_band', 'max_salary_band')
    def _compute_salary_band(self):
        for rec in self:
            if rec.minimum_salary_band and rec.max_salary_band:
                rec.salary_band = (
                    f"{self._format_amount(rec.minimum_salary_band)} - "
                    f"{self._format_amount(rec.max_salary_band)}"
                )
            else:
                rec.salary_band = False



    
class HrGrade(models.Model):
    _name = "hr.grade"
    _description = "HrGrade"
    _rec_name = "name"

    name = fields.Char(string="Name")
    min_salary_band = fields.Float(
        string="Min Salary Band",
        copy=False,
    )

    minimum_salary_band = fields.Float(
            string="Min Salary Band",
            copy=False,
        )

    max_salary_band = fields.Float(
        string="Max Salary Band",
        copy=False,
    )
    salary_band = fields.Char(
        string="Salary Band",
        compute="_compute_salary_band",
        store=True,
        copy=False,
    )

    leave_duration = fields.Integer(
        string="Leave Duration (Days)",
        copy=True,
    )
    employee_ids = fields.One2many(
        "hr.employee",
        "grade_id",
        string="Employees",
        copy=True,
    )
    employee_count = fields.Integer(
        string="Employees count",
        copy=True,
        compute="_compute_employee_ids",
    )
    cash_advance_limit = fields.Float(
        string="Cash Advance limit",
        copy=True,
        default=20000,
    )
    active = fields.Boolean(
            string="Active")

    cash_approval_limit = fields.Float(
        string="Cash Approval limit",
        copy=True,
    )

    @api.depends('employee_ids.name')
    def _compute_employee_ids(self):
        for rec in self:
            if rec.employee_ids:
                rec.employee_count = sum(rec.employee_ids.ids)
            else:
                rec.employee_count = 0

    @api.onchange('max_salary_band')
    def onchange_max_salary_band(self):
        self.ensure_one()
        if self.max_salary_band > 0 and self.max_salary_band < self.minimum_salary_band:
            raise ValidationError("Max salary band cannot be lesser than min salary band")

    def _format_amount(self, amount):
        if amount >= 1_000_000_000:
            return f"{amount / 1_000_000_000:.1f}B".rstrip('0').rstrip('.')
        elif amount >= 1_000_000:
            return f"{amount / 1_000_000:.1f}M".rstrip('0').rstrip('.')
        elif amount >= 1_000:
            return f"{amount / 1_000:.1f}K".rstrip('0').rstrip('.')
        return str(int(amount))

    @api.depends('minimum_salary_band', 'max_salary_band')
    def _compute_salary_band(self):
        for rec in self:
            if rec.minimum_salary_band and rec.max_salary_band:
                rec.salary_band = (
                    f"{self._format_amount(rec.minimum_salary_band)} - "
                    f"{self._format_amount(rec.max_salary_band)}"
                )
            else:
                rec.salary_band = False

    