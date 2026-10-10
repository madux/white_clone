# -*- coding: utf-8 -*-
from odoo import api, fields, models


class CleonPayrollTaxExplain(models.TransientModel):
    """Shows how much tax each bracket contributed for a given taxable amount."""
    _name = "cleon.payroll.tax.explain"
    _description = "Cleon Payroll Tax Explain / Simulator"

    rule_id = fields.Many2one("cleon.payroll.rule", required=True, readonly=True)
    periods_per_year = fields.Integer(related="rule_id.periods_per_year")
    base_period = fields.Float(string="Taxable Amount (per period)")
    annual_base = fields.Float(string="Annualised Taxable Amount", readonly=True)
    annual_tax = fields.Float(string="Annual Tax", readonly=True)
    period_tax = fields.Float(string="Tax per Period", readonly=True)
    effective_rate = fields.Float(string="Effective Rate (%)", readonly=True)
    line_ids = fields.One2many("cleon.payroll.tax.explain.line", "wizard_id", readonly=True)

    @api.onchange("rule_id", "base_period")
    def _onchange_calc(self):
        for w in self:
            if not w.rule_id:
                continue
            res = w.rule_id.get_tax_breakdown(w.base_period)
            w.annual_base = res["annual"]
            w.annual_tax = res["annual_tax"]
            w.period_tax = res["period_tax"]
            w.effective_rate = res["effective_rate"]
            w.line_ids = [(5, 0, 0)] + [(0, 0, r) for r in res["rows"]]


class CleonPayrollTaxExplainLine(models.TransientModel):
    _name = "cleon.payroll.tax.explain.line"
    _description = "Cleon Payroll Tax Explain Line"

    wizard_id = fields.Many2one("cleon.payroll.tax.explain", ondelete="cascade")
    lower = fields.Float(string="From")
    upper = fields.Float(string="To")
    rate = fields.Float(string="Rate (%)")
    taxable = fields.Float(string="Amount in Band")
    tax = fields.Float(string="Tax")