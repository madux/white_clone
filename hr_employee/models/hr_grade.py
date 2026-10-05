from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging
_logger = logging.getLogger(__name__)
 

class HrLevel(models.Model):
    _name = "hr.level"
    _description = "HrLevel"
    _rec_name = "name"

    name = fields.Char(string="Name")
    description = fields.Text(
        string='Description',
        copy=False,
    )
    country_id = fields.Many2one('res.country', string="Country")
    active = fields.Boolean(
        string='Active',
        copy=False,
        default=True
    )


class HrGrade(models.Model):
    _name = "hr.grade"
    _description = "HrGrade"
    _rec_name = "name"

    name = fields.Char(string="Name")
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

    