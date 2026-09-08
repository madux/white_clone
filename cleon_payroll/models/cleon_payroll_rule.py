# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError
from odoo.tools.safe_eval import safe_eval, datetime as safe_datetime
from . import utils 
from odoo.exceptions import ValidationError, UserError 

import logging
_logger = logging.getLogger(__name__)


class BrowsableObject(object):
    """Generic dict-like wrapper so formulas can do e.g. categories.BASIC
    or rules.HOUSING instead of ugly dict[] syntax."""

    def __init__(self, employee_id, values, env):
        self.employee_id = employee_id
        self.values = values
        self.env = env

    def __getattr__(self, attr):
        return self.values.get(attr, 0.0)

    def __getitem__(self, attr):
        return self.values.get(attr, 0.0)

    def get(self, attr, default=0.0):
        return self.values.get(attr, default)


class InputLine(BrowsableObject):
    """inputs.CODE returns the amount of a payslip input line with that code."""

    def __getattr__(self, attr):
        line = self.values.get(attr)
        return line.amount if line else 0.0


class WorkedDays(BrowsableObject):
    """worked_days.CODE returns the number of days/hours for that worked-days line."""

    def __getattr__(self, attr):
        line = self.values.get(attr)
        return line.number_of_days if line else 0.0


FORMULA_HELP = _(
    "Available variables in the formula:\n"
    "  employee     : hr.employee record\n"
    "  contract     : hr.contract record\n"
    "  payslip      : cleon.payslip record\n"
    "  categories.CODE : running total already computed for that category\n"
    "  rules.CODE      : amount already computed for that rule code\n"
    "  worked_days.CODE: number of days/hours for a worked-days line\n"
    "  inputs.CODE     : amount of a payslip input line\n"
    "  result       : (set this) the computed amount\n"
    "  result_qty   : (optional) quantity multiplier, default 1.0\n"
    "  result_rate  : (optional) percentage rate, default 100\n"
)


class CleonPayrollRule(models.Model):
    _name = "cleon.payroll.rule"
    _description = "Cleon Payroll Rule"
    _inherit = ["mail.thread"]
    _order = "sequence, code"

    name = fields.Char(required=True, tracking=True)
    code = fields.Char(
        required=True, tracking=True,
        help="Short code used to reference this rule's result in other "
             "formulas, e.g. rules.BASIC")
    sequence = fields.Integer(default=100, tracking=True,
                               help="Rules are computed in this order.")
    active = fields.Boolean(default=True)
    company_id = fields.Many2one(
        "res.company", default=lambda self: self.env.company)

    category_id = fields.Many2one(
        "cleon.payroll.category", string="Category", required=True, tracking=True)

    rule_type = fields.Selection([
        ("gross", "Gross / Allowance"),
        ("deduction", "Deduction"),
        ("employer_contribution", "Employer Contribution"),
        ("net", "Net"),
    ], default="gross", required=True, tracking=True)

    appears_on_payslip = fields.Boolean(default=True, tracking=True)
    note = fields.Html()

    # ---- Condition ----
    condition_select = fields.Selection([
        ("none", "Always True"),
        ("range", "Wage Range"),
        ("python", "Programming Expression"),
    ], default="none", required=True, string="Condition")
    condition_python = fields.Text(
        string="Condition Formula",
        help="# available: employee, contract, payslip, categories, "
                "worked_days, inputs, result\nresult = True")
    raw_ai_text = fields.Text(
        string="Raw AI Text", 
        help="AI - Generate a python formula that will Compute  based on Nigeria tax law")
    
    condition_range_min = fields.Float(string="Wage Range Min")
    condition_range_max = fields.Float(string="Wage Range Max")

    # ---- Amount / Formula ----
    amount_select = fields.Selection([
        ("fixed", "Fixed Amount"),
        ("percentage", "Percentage"),
        ("formula", "Python Formula"),
    ], default="fixed", required=True, string="Amount Type", tracking=True)
    amount_fixed = fields.Float(string="Fixed Amount", digits="Payroll")
    amount_percentage = fields.Float(string="Percentage (%)", digits="Payroll")
    amount_percentage_base = fields.Char(
        string="Percentage Based On",
        help="Formula/expression evaluated to obtain the base amount, "
             "e.g. contract.wage  or  categories.BASIC")
    amount_python_compute = fields.Text(
        string="Formula",
        default="# amount_python_compute available: employee, contract, payslip, categories, "
                "rules, worked_days, inputs\nresult = contract.wage")
    formula_help = fields.Text(default=FORMULA_HELP, readonly=True)
    ai_response = fields.Text(readonly=True)

    struct_ids = fields.Many2many(
        "cleon.payroll.structure", string="Used in Structures")

    account_debit_id = fields.Many2one(
        "account.account", string="Debit Account",
        help="GL account debited when this rule is posted to accounting.")
    account_credit_id = fields.Many2one(
        "account.account", string="Credit Account",
        help="GL account credited when this rule is posted to accounting.")
    tax_id = fields.Many2one(
        "account.tax", string="Related Tax",
        help="Statutory tax/deduction this rule represents, if any.")

    _sql_constraints = [
        ("code_company_uniq", "unique(code, company_id)",
         "Rule code must be unique per company."),
    ]

    # ------------------------------------------------------------------
    # Evaluation helpers
    # ------------------------------------------------------------------
    def _get_localdict(self, employee, contract, payslip, categories_values,
                        rules_values, worked_days_values, inputs_values):
        self.ensure_one()
        return {
            "employee": employee,
            "contract": contract,
            "payslip": payslip,
            "categories": BrowsableObject(employee.id, categories_values, self.env),
            "rules": BrowsableObject(employee.id, rules_values, self.env),
            "worked_days": WorkedDays(employee.id, worked_days_values, self.env),
            "inputs": InputLine(employee.id, inputs_values, self.env),
            "result": None,
            "result_qty": 1.0,
            "result_rate": 100.0,
            "datetime": safe_datetime,
        }

    def _satisfies_condition(self, localdict):
        self.ensure_one()
        if self.condition_select == "none":
            return True
        if self.condition_select == "range":
            wage = localdict["contract"].wage if localdict["contract"] else 0.0
            return self.condition_range_min <= wage <= self.condition_range_max
        if self.condition_select == "python":
            try:
                safe_eval(self.condition_python, localdict, mode="exec", nocopy=True)
            except Exception as e:
                raise UserError(_(
                    "Error evaluating condition for rule %(rule)s:\n%(err)s",
                    rule=self.name, err=e))
            return bool(localdict.get("result"))
        return True

    def _compute_amount(self, localdict):
        """Returns (amount, qty, rate) for this rule given the localdict."""
        self.ensure_one()
        if self.amount_select == "fixed":
            return self.amount_fixed, 1.0, 100.0

        if self.amount_select == "percentage":
            base = 0.0
            if self.amount_percentage_base:
                try:
                    base = safe_eval(self.amount_percentage_base, localdict)
                except Exception as e:
                    raise UserError(_(
                        "Error evaluating percentage base for rule "
                        "%(rule)s:\n%(err)s", rule=self.name, err=e))
            amount = base * (self.amount_percentage / 100.0)
            return amount, 1.0, self.amount_percentage

        if self.amount_select == "formula":
            try:
                safe_eval(self.amount_python_compute, localdict,
                          mode="exec", nocopy=True)
            except Exception as e:
                raise UserError(_(
                    "Error evaluating formula for rule %(rule)s:\n%(err)s",
                    rule=self.name, err=e))
            result = localdict.get("result") or 0.0
            qty = localdict.get("result_qty", 1.0)
            rate = localdict.get("result_rate", 100.0)
            return float(result) * float(qty) * (float(rate) / 100.0), qty, rate

        return 0.0, 1.0, 100.0

    def open_record(self):
        view_id = self.env.ref('cleon_payroll.view_cleon_payroll_rule_form').id
        ret = {
            'name': "Rule",
            'view_mode': 'form',
            'view_id': view_id,
            'view_type': 'form',
            'res_model': self._name,
            'res_id': self.id,
            'type': 'ir.actions.act_window',
            'domain': [],
            'target': 'new'
            }
        return ret

    def generate_AI_rule(self):
        raw_text = self.raw_ai_text
        if not raw_text:
            raise ValidationError('Please provide AI Prompt')
        data = utils.generate_text_with_ai(raw_text)
        # if data:
        #     try:
        explanation = data.get("explanation")
        python_code = data.get("python_code")
        self.amount_python_compute = python_code
        self.ai_response = explanation + python_code

            # except Exception as e:
            #     raise UserError('No AI server is down at the moment') 
        return {
                'type': 'ir.actions.act_window',
                'res_model': 'cleon.payroll.rule',
                'res_id': self.id,
                'view_mode': 'form',
                'target': 'new',
            }