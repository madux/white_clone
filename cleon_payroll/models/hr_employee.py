# -*- coding: utf-8 -*-
from odoo import api, fields, models

class HrGrade(models.Model):
    _inherit = 'hr.grade'

    leave_duration = fields.Integer()

    employee_count = fields.Integer(
            string="Employees count",
            copy=True, 
        )
    min_salary_band = fields.Float(
            string="Min Salary Band",
            copy=False,
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

    max_salary_band = fields.Float(
        string="Max Salary Band",
        copy=False,
    )
    cash_approval_limit = fields.Float(
            string="Cash Approval limit",
            copy=True,
        )
    salary_band = fields.Char(
        string="Salary Band",
        store=True,
        copy=False,
    )


class HrEmployee(models.Model):
    _inherit = "hr.employee"

    cleon_location_id = fields.Many2one(
        "cleon.location", string="Work Location")
    cleon_payslip_count = fields.Integer(
        compute="_compute_cleon_payslip_count", string="Payslips")
    cleon_current_structure_id = fields.Many2one(
        "cleon.payroll.structure", string="Payroll Structure",
        related="contract_id.cleon_structure_id", readonly=True, store=False)

    def _compute_cleon_payslip_count(self):
        payslip_data = self.env["cleon.payslip"]._read_group(
            [("employee_id", "in", self.ids)], ["employee_id"], ["__count"])
        mapped = {employee.id: count for employee, count in payslip_data}
        for emp in self:
            emp.cleon_payslip_count = mapped.get(emp.id, 0)

    def action_view_cleon_payslips(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id(
            "cleon_payroll.action_cleon_payslip")
        action["domain"] = [("employee_id", "=", self.id)]
        action["context"] = {"default_employee_id": self.id}
        return action
