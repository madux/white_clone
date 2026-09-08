# -*- coding: utf-8 -*-
from odoo import fields, models


class CleonPayslipInputLine(models.Model):
    _name = "cleon.payslip.input.line"
    _description = "Cleon Payslip Input Line"
    _order = "payslip_id, sequence"

    payslip_id = fields.Many2one(
        "cleon.payslip", string="Payslip", required=True, ondelete="cascade")
    input_type_id = fields.Many2one(
        "cleon.payroll.input.type", string="Input Type", required=True)
    rule_type = fields.Selection([
                ("gross", "Gross / Allowance"),
                ("deduction", "Deduction"),
                ("employer_contribution", "Employer Contribution"),
                ("net", "Net"),
            ], default="gross", tracking=True)
    code = fields.Char(related="input_type_id.code", store=True)
    name = fields.Char(required=True)
    sequence = fields.Integer(default=10)
    amount = fields.Float(default=0.0)
