# -*- coding: utf-8 -*-
from odoo import fields, models


class CleonPayrollCategory(models.Model):
    _inherit = "cleon.payroll.category"

    kind = fields.Selection([
        ("gross", "Gross"), ("deduction", "Deductions"),
        ("employer_contribution", "Employer Contribution"), ("net", "Net"),
    ], string="Classification",
        help="A rule's type must match its category's classification. "
             "A Deductions line can never add to Gross.")
