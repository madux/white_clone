# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class CleonPayrollTaxBracket(models.Model):
    _name = "cleon.payroll.tax.bracket"
    _description = "Cleon Payroll Tax Bracket"
    _order = "rule_id, sequence, lower_limit"

    rule_id = fields.Many2one("cleon.payroll.rule", required=True, ondelete="cascade")
    sequence = fields.Integer(default=10)
    lower_limit = fields.Float(string="From (Annual)", required=True)
    upper_limit = fields.Float(string="To (Annual)", help="Leave 0 for 'and above'.")
    rate = fields.Float(string="Rate (%)", required=True)
    show_payroll_link = fields.Boolean(
                        string="Payroll menu Link",
                        default=True,
                        help="Used to hold widget in form view"
                    )
    @api.constrains("lower_limit", "upper_limit", "rate")
    def _check_values(self):
        for b in self:
            if b.rate < 0:
                raise ValidationError(_("Rate cannot be negative."))
            if b.upper_limit and b.upper_limit <= b.lower_limit:
                raise ValidationError(_("'To' must be greater than 'From'."))