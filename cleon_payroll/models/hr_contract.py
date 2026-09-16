# -*- coding: utf-8 -*-
from odoo import fields, models


class HrContract(models.Model):
    _inherit = "hr.contract"

    cleon_structure_id = fields.Many2one(
        "cleon.payroll.structure", string="Payroll Structure",
        help="Determines which set of payroll rules apply to this contract.")
    cleon_schedule_pay = fields.Selection([
        ("daily", "Daily"),
        ("weekly", "Weekly"),
        ("biweekly", "Bi-weekly"),
        ("monthly", "Monthly"),
    ], string="Payroll Frequency", default="monthly")
    employee_number = fields.Char(related="employee_id.employee_number")
    department_id = fields.Many2one('hr.department', related="employee_id.department_id")
    job_title = fields.Many2one('hr.job', related="employee_id.job_id")
    cleon_bank_account_id = fields.Many2one(
        "res.partner.bank", string="Salary Bank Account")
    avatar_128 = fields.Binary(
        related="employee_id.avatar_128",
        store=True
    )
    employee_photo_url = fields.Char(
        compute="_compute_employee_photo_url"
        )
    def _compute_employee_photo_url(self):
        for rec in self:
            if rec.employee_id:
                rec.employee_photo_url = (
                    f"/web/image/hr.employee/{rec.employee_id.id}/avatar_128"
                )
            else:
                rec.employee_photo_url = False