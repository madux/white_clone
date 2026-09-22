# -*- coding: utf-8 -*-
from odoo import fields, models


class CleonPayrollInputType(models.Model):
    _name = "cleon.payroll.input.type"
    _description = "Cleon Payroll Input Type"
    _order = "name"

    name = fields.Char(required=True)
    code = fields.Char(required=True, help="Used in formulas as inputs.CODE")
    struct_ids = fields.Many2many(
        "cleon.payroll.structure", string="Available in Structures")
    rule_type = fields.Selection([
            ("gross", "Gross / Allowance"),
            ("deduction", "Deduction"),
            ("employer_contribution", "Employer Contribution"),
            ("net", "Net"),
        ], default="gross", required=True, tracking=True)
    _sql_constraints = [
        ("code_uniq", "unique(code)", "Input type code must be unique."),
    ]
