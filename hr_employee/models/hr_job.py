from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging
_logger = logging.getLogger(__name__)

# class EhaBranch(models.Model):
#     _inherit = "multi.branch"


class HrJob(models.Model):
    _inherit = 'hr.job'

    
    min_salary_band = fields.Float(
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
    grade_id = fields.Many2one(
        'hr.grade',
        string='Grade', 
    )

    @api.onchange('max_salary_band')
    def onchange_max_salary_band(self):
        self.ensure_one()
        if self.max_salary_band > 0 and self.max_salary_band < self.min_salary_band:
            raise ValidationError("Max salary band cannot be lesser than min salary band")

    def _format_amount(self, amount):
        if amount >= 1_000_000_000:
            return f"{amount / 1_000_000_000:.1f}B".rstrip('0').rstrip('.')
        elif amount >= 1_000_000:
            return f"{amount / 1_000_000:.1f}M".rstrip('0').rstrip('.')
        elif amount >= 1_000:
            return f"{amount / 1_000:.1f}K".rstrip('0').rstrip('.')
        return str(int(amount))

    @api.depends('min_salary_band', 'max_salary_band')
    def _compute_salary_band(self):
        for rec in self:
            if rec.min_salary_band and rec.max_salary_band:
                rec.salary_band = (
                    f"{self._format_amount(rec.min_salary_band)} - "
                    f"{self._format_amount(rec.max_salary_band)}"
                )
            else:
                rec.salary_band = False

    def action_view_record(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'JOB ROLE',
            'res_model': self._name,
            'view_mode': 'form',
            'views': [
                # (False, 'list'),
                (False, 'form')
            ],
            'res_id': self.id,
            'target': 'new',
        }