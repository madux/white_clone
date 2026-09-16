# -*- coding: utf-8 -*-
from odoo import fields, models, api


class CleonPayslipLine(models.Model):
    _name = "cleon.payslip.line"
    _description = "Cleon Payslip Line"
    _order = "payslip_id, sequence, id"

    payslip_id = fields.Many2one(
        "cleon.payslip", string="Payslip", required=True, ondelete="cascade")
    rule_id = fields.Many2one(
        "cleon.payroll.rule", string="Rule", required=True, ondelete="restrict")
    category_id = fields.Many2one(
        related="rule_id.category_id", store=True, string="Category")
    rule_type = fields.Selection(related="rule_id.rule_type", store=True)
    name = fields.Char(required=True)
    code = fields.Char(required=True)
    sequence = fields.Integer(default=100)
    quantity = fields.Float(default=1.0)
    rate = fields.Float(default=100.0)
    amount = fields.Float(digits="Payroll")
    total = fields.Float(compute="_compute_total", store=True, digits="Payroll")
    appears_on_payslip = fields.Boolean(default=True)
    employee_id = fields.Many2one(related="payslip_id.employee_id", store=True)

    @api.depends('amount')
    def _compute_total(self):
        for line in self:
            line.total = line.amount
