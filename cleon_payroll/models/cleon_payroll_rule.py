# # -*- coding: utf-8 -*
# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError, AccessError
from odoo.tools.safe_eval import safe_eval, datetime as safe_datetime
from . import utils
from .cleon_payroll_rule_line import FUNCTION_ENV

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

# key: (label, rule_type, employee/employer rate %, category codes that form the base)
# Verify rates and base definitions with your tax advisor before going live.
CONTRIBUTION_PRESETS = {
    "pension_employee": ("Pension - Employee", "deduction", 8.0, ["BASIC", "HOUSING", "TRANSPORT"]),
    "pension_employer": ("Pension - Employer", "employer_contribution", 10.0, ["BASIC", "HOUSING", "TRANSPORT"]),
    "nhf": ("NHF - Employee", "deduction", 2.5, ["BASIC"]),
    "nhis_employee": ("NHIS - Employee", "deduction", 5.0, ["BASIC"]),
    "nsitf": ("NSITF - Employer", "employer_contribution", 1.0, ["GROSS"]),
}


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
        ("gross", "Gross"),
        ("deduction", "Deduction"),
        ("employer_contribution", "Employer Contribution"),
        ("net", "Net"),
    ], default="gross", required=True, tracking=True)

    appears_on_payslip = fields.Boolean(default=True, tracking=True)
    note = fields.Html()

    # ---- Condition ----
    condition_select = fields.Selection([
        ("none", "Normal"),
        ("range", "Wage Range"),
        ("builder", "Condition Builder"),
        ("python", "Programming Expression (admin)"),
    ], default="none", required=True, string="Condition")
    condition_python = fields.Text(
        string="Condition Formula",
        help="# available: employee, contract, payslip, categories, "
             "worked_days, inputs, result\nresult = True")
    raw_ai_text = fields.Text(
        string="Raw AI Text",
        help="AI - Generate a python formula that will Compute based on Nigeria tax law")

    condition_range_min = fields.Float(string="Wage Range Min")
    condition_range_max = fields.Float(string="Wage Range Max")

    # ---- Amount / Formula ----
    amount_select = fields.Selection([
        ("fixed", "Fixed Amount"),
        ("percentage", "Percentage"),
        ("builder", "Formula Builder"),
        ("bracket", "Tax Brackets"),
        ("contribution", "Contribution"),
        ("formula", "Python Formula (admin)"),
    ], default="fixed", required=True, string="Rule Formula", tracking=True)
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
    is_statutory = fields.Boolean(
        string="Statutory Rule",
        default=False,
        tracking=True,
    )
    show_payroll_link = fields.Boolean(
                    string="Payroll menu Link",
                    default=True,
                    help="Used to hold widget in form view"
                )
    is_government_rule = fields.Boolean(
        string="Government Payroll Rule",
        default=False,
        tracking=True,
    )
    # ---- Builder lines (one One2many per purpose) ----
    condition_line_ids = fields.One2many(
        "cleon.payroll.rule.line", "rule_id", string="Condition Lines",
        domain=[("purpose", "=", "condition")], copy=True)
    amount_line_ids = fields.One2many(
        "cleon.payroll.rule.line", "rule_id", string="Amount Lines",
        domain=[("purpose", "=", "amount")], copy=True)
    base_line_ids = fields.One2many(
        "cleon.payroll.rule.line", "rule_id", string="Base Lines",
        domain=[("purpose", "=", "base")], copy=True)
    condition_preview = fields.Char(compute="_compute_previews")
    amount_preview = fields.Char(compute="_compute_previews")
    base_preview = fields.Char(compute="_compute_previews")

    # ---- Tax brackets ----
    bracket_ids = fields.One2many("cleon.payroll.tax.bracket", "rule_id", copy=True)
    periods_per_year = fields.Integer(
        default=12, help="12 = monthly payroll, 52 = weekly, etc. "
                         "The base is annualised, taxed, then divided back.")

    # ---- Contributions ----
    contribution_preset = fields.Selection(
        [(k, v[0]) for k, v in CONTRIBUTION_PRESETS.items()],
        string="Statutory Template")
    contribution_rate = fields.Float(string="Rate (%)", digits=(16, 4))
    contribution_base_floor = fields.Float(
        string="Minimum Base", help="If the base is above 0 but below this, this value is used instead.")
    contribution_base_cap = fields.Float(
        string="Maximum Base", help="The base is limited to this value. 0 = no limit.")
    contribution_amount_cap = fields.Float(
        string="Maximum Amount", help="The contribution is limited to this value. 0 = no limit.")

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
    country_id = fields.Many2one(
            "res.country", string="Country",
            related="company_id.country_id"
    ) 
    active = fields.Boolean(
                string="Active",
                default=True,
            )   
    _sql_constraints = [
        ("code_company_uniq", "unique(code, company_id)",
         "Rule code must be unique per company."),
    ]

    # ------------------------------------------------------------------
    # Security: only administrators may choose the raw-code options
    # ------------------------------------------------------------------
    def _check_code_permission(self, vals):
        if self.env.su or self.env.user.has_group("base.group_system"):
            return
        if vals.get("condition_select") == "python" or vals.get("amount_select") == "formula":
            raise AccessError(_("Only administrators can use Python expressions. "
                                "Please use the builder, tax brackets or contribution options."))

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            self._check_code_permission(vals)
        return super().create(vals_list)

    def write(self, vals):
        self._check_code_permission(vals)
        return super().write(vals)

    # ------------------------------------------------------------------
    # Builder expressions
    # ------------------------------------------------------------------
    def _build_expression(self, purpose):
        self.ensure_one()
        lines = self["%s_line_ids" % purpose].sorted("sequence")
        return " ".join(t for t in (l._to_token() for l in lines) if t)

    @api.depends("condition_line_ids.expr", "condition_line_ids.sequence",
                 "amount_line_ids.expr", "amount_line_ids.sequence",
                 "base_line_ids.expr", "base_line_ids.sequence")
    def _compute_previews(self):
        for rule in self:
            rule.condition_preview = rule._build_expression("condition")
            rule.amount_preview = rule._build_expression("amount")
            rule.base_preview = rule._build_expression("base")

    @api.constrains("condition_select", "amount_select", "condition_line_ids",
                    "amount_line_ids", "base_line_ids")
    def _check_builder_expressions(self):
        """Dry-run each expression with dummy values so mistakes show up at save time."""
        class _Any(object):
            def __getattr__(self, a):
                return 1.0

            def __getitem__(self, a):
                return 1.0

        dummy = dict(FUNCTION_ENV, contract=_Any(), employee=_Any(), payslip=_Any(),
                     rules=_Any(), categories=_Any(), inputs=_Any(), worked_days=_Any())
        for rule in self:
            checks = [
                ("condition", rule.condition_select == "builder"),
                ("amount", rule.amount_select == "builder"),
                ("base", rule.amount_select in ("bracket", "contribution")),
            ]
            for purpose, active in checks:
                if not active:
                    continue
                expr = rule._build_expression(purpose)
                if not expr:
                    raise ValidationError(_("Rule %(rule)s: the %(p)s builder has no lines.",
                                            rule=rule.name, p=purpose))
                if expr.count("(") != expr.count(")"):
                    raise ValidationError(_("Rule %(rule)s: unbalanced parentheses in %(p)s.",
                                            rule=rule.name, p=purpose))
                try:
                    safe_eval(expr, dict(dummy))
                except ZeroDivisionError:
                    pass
                except Exception as e:
                    raise ValidationError(_("Rule %(rule)s: invalid %(p)s expression:\n%(expr)s\n\n%(err)s",
                                            rule=rule.name, p=purpose, expr=expr, err=e))

    @api.constrains("bracket_ids", "amount_select")
    def _check_brackets(self):
        for rule in self:
            if rule.amount_select != "bracket":
                continue
            brackets = rule.bracket_ids.sorted("sequence")
            if not brackets:
                raise ValidationError(_("Rule %s needs at least one tax bracket.") % rule.name)
            if brackets[0].lower_limit != 0:
                raise ValidationError(_("The first bracket must start at 0."))
            for prev, nxt in zip(brackets, brackets[1:]):
                if not prev.upper_limit:
                    raise ValidationError(_("Only the last bracket can have an open 'To'."))
                if nxt.lower_limit != prev.upper_limit:
                    raise ValidationError(_("Brackets must be continuous: %(a)s -> %(b)s.",
                                            a=prev.upper_limit, b=nxt.lower_limit))

    @api.constrains("contribution_rate", "amount_select")
    def _check_contribution(self):
        for rule in self:
            if rule.amount_select == "contribution" and rule.contribution_rate < 0:
                raise ValidationError(_("Contribution rate cannot be negative."))

    # ------------------------------------------------------------------
    # Evaluation helpers
    # ------------------------------------------------------------------
    def _get_localdict(self, employee, contract, payslip, categories_values,
                       rules_values, worked_days_values, inputs_values):
        self.ensure_one()
        return dict(FUNCTION_ENV, **{
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
        })

    def _satisfies_condition(self, localdict):
        self.ensure_one()
        if self.condition_select == "none":
            return True
        if self.condition_select == "range":
            wage = localdict["contract"].wage if localdict["contract"] else 0.0
            return self.condition_range_min <= wage <= self.condition_range_max
        if self.condition_select == "builder":
            try:
                return bool(safe_eval(self._build_expression("condition"), localdict))
            except Exception as e:
                raise UserError(_("Error in condition builder for rule %(rule)s:\n%(err)s",
                                  rule=self.name, err=e))
        if self.condition_select == "python":
            try:
                safe_eval(self.condition_python, localdict, mode="exec", nocopy=True)
            except Exception as e:
                raise UserError(_(
                    "Error evaluating condition for rule %(rule)s:\n%(err)s",
                    rule=self.name, err=e))
            return bool(localdict.get("result"))
        return True

    def _eval_base(self, localdict):
        """Evaluate the 'base' builder lines to a float."""
        self.ensure_one()
        try:
            return float(safe_eval(self._build_expression("base"), localdict))
        except Exception as e:
            raise UserError(_("Error in base formula for rule %(rule)s:\n%(err)s",
                              rule=self.name, err=e))

    # ---- Tax brackets ----
    def get_tax_breakdown(self, base_period):
        """Public helper (also usable from the payslip to show how the tax was built).
        Returns annual base, annual tax, per-period tax, effective rate and one row per band."""
        self.ensure_one()
        periods = self.periods_per_year or 12
        annual = max((base_period or 0.0) * periods, 0.0)
        rows, total = [], 0.0
        for b in self.bracket_ids.sorted("sequence"):
            if annual <= b.lower_limit:
                break
            upper = b.upper_limit or float("inf")
            taxable = min(annual, upper) - b.lower_limit
            tax = taxable * b.rate / 100.0
            total += tax
            rows.append({
                "lower": b.lower_limit, "upper": b.upper_limit,
                "rate": b.rate, "taxable": taxable, "tax": tax,
            })
        return {
            "annual": annual,
            "annual_tax": total,
            "period_tax": total / periods,
            "effective_rate": (total / annual * 100.0) if annual else 0.0,
            "rows": rows,
        }

    def _compute_bracket_tax(self, localdict):
        self.ensure_one()
        base = self._eval_base(localdict)
        return self.get_tax_breakdown(base)["period_tax"]

    # ---- Contributions ----
    def _compute_contribution(self, localdict):
        self.ensure_one()
        base = self._eval_base(localdict)
        if self.contribution_base_floor and 0 < base < self.contribution_base_floor:
            base = self.contribution_base_floor
        if self.contribution_base_cap:
            base = min(base, self.contribution_base_cap)
        amount = base * (self.contribution_rate / 100.0)
        if self.contribution_amount_cap:
            amount = min(amount, self.contribution_amount_cap)
        return amount

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

        if self.amount_select == "builder":
            try:
                amount = float(safe_eval(self._build_expression("amount"), localdict))
            except Exception as e:
                raise UserError(_("Error in formula builder for rule %(rule)s:\n%(err)s",
                                  rule=self.name, err=e))
            return amount, 1.0, 100.0

        if self.amount_select == "bracket":
            return self._compute_bracket_tax(localdict), 1.0, 100.0

        if self.amount_select == "contribution":
            return self._compute_contribution(localdict), 1.0, self.contribution_rate

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

    # ------------------------------------------------------------------
    # Buttons
    # ------------------------------------------------------------------
    def action_load_nigeria_bands(self):
        """Pre-fills editable data. Verify against the current Nigeria Tax Act / NRS guidance."""
        self.ensure_one()
        bands = [  # (from, to, rate %)
            (0, 800000, 0), (800000, 3000000, 15), (3000000, 12000000, 18),
            (12000000, 25000000, 21), (25000000, 50000000, 23), (50000000, 0, 25),
        ]
        self.bracket_ids.unlink()
        self.write({
            "amount_select": "bracket",
            "periods_per_year": 12,
            "bracket_ids": [
                (0, 0, {"sequence": i * 10, "lower_limit": lo, "upper_limit": hi, "rate": r})
                for i, (lo, hi, r) in enumerate(bands, 1)],
        })

    def action_apply_contribution_preset(self):
        """Fills rate, rule type and base lines from a statutory template.
        Base lines are built from category codes, missing categories are skipped."""
        self.ensure_one()
        if not self.contribution_preset:
            raise UserError(_("Please choose a statutory template first."))
        label, rtype, rate, codes = CONTRIBUTION_PRESETS[self.contribution_preset]
        cats = self.env["cleon.payroll.category"].search([("code", "in", codes)])
        by_code = {c.code: c for c in cats}
        found = [c for c in codes if c in by_code]
        if not found:
            raise UserError(_(
                "None of these payroll categories exist: %s.\n"
                "Create them (or build the base manually) and try again.") % ", ".join(codes))
        cmds = [(5, 0, 0)]
        seq = 10
        for i, code in enumerate(found):
            if i:
                cmds.append((0, 0, {"purpose": "base", "sequence": seq,
                                    "token_type": "operator", "operator": "+"}))
                seq += 10
            cmds.append((0, 0, {"purpose": "base", "sequence": seq,
                                "token_type": "category", "ref_category_id": by_code[code].id}))
            seq += 10
        self.write({
            "amount_select": "contribution",
            "rule_type": rtype,
            "contribution_rate": rate,
            "base_line_ids": cmds,
        })

    def action_open_tax_explain(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": _("Tax Explain / Simulator"),
            "res_model": "cleon.payroll.tax.explain",
            "view_mode": "form",
            "target": "current",
            "context": {"default_rule_id": self.id},
        }

    def open_record(self):
        view_id = self.env.ref('cleon_payroll.view_cleon_payroll_rule_form').id
        return {
            'name': "Rule",
            'view_mode': 'form',
            'view_id': view_id,
            'view_type': 'form',
            'res_model': self._name,
            'res_id': self.id,
            'type': 'ir.actions.act_window',
            'domain': [],
            'target': 'current'
        }

    def generate_AI_rule(self):
        raw_text = self.raw_ai_text
        if not raw_text:
            raise ValidationError('Please provide AI Prompt')
        data = utils.generate_text_with_ai(raw_text)
        explanation = data.get("explanation")
        python_code = data.get("python_code")
        self.amount_python_compute = python_code
        self.ai_response = explanation + python_code
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'cleon.payroll.rule',
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
        }


    
# from odoo import api, fields, models, _
# from odoo.exceptions import UserError
# from odoo.tools.safe_eval import safe_eval, datetime as safe_datetime
# from . import utils 
# from odoo.exceptions import ValidationError, UserError 

# import logging
# _logger = logging.getLogger(__name__)


# class BrowsableObject(object):
#     """Generic dict-like wrapper so formulas can do e.g. categories.BASIC
#     or rules.HOUSING instead of ugly dict[] syntax."""

#     def __init__(self, employee_id, values, env):
#         self.employee_id = employee_id
#         self.values = values
#         self.env = env

#     def __getattr__(self, attr):
#         return self.values.get(attr, 0.0)

#     def __getitem__(self, attr):
#         return self.values.get(attr, 0.0)

#     def get(self, attr, default=0.0):
#         return self.values.get(attr, default)


# class InputLine(BrowsableObject):
#     """inputs.CODE returns the amount of a payslip input line with that code."""

#     def __getattr__(self, attr):
#         line = self.values.get(attr)
#         return line.amount if line else 0.0


# class WorkedDays(BrowsableObject):
#     """worked_days.CODE returns the number of days/hours for that worked-days line."""

#     def __getattr__(self, attr):
#         line = self.values.get(attr)
#         return line.number_of_days if line else 0.0


# FORMULA_HELP = _(
#     "Available variables in the formula:\n"
#     "  employee     : hr.employee record\n"
#     "  contract     : hr.contract record\n"
#     "  payslip      : cleon.payslip record\n"
#     "  categories.CODE : running total already computed for that category\n"
#     "  rules.CODE      : amount already computed for that rule code\n"
#     "  worked_days.CODE: number of days/hours for a worked-days line\n"
#     "  inputs.CODE     : amount of a payslip input line\n"
#     "  result       : (set this) the computed amount\n"
#     "  result_qty   : (optional) quantity multiplier, default 1.0\n"
#     "  result_rate  : (optional) percentage rate, default 100\n"
# )


# class CleonPayrollRule(models.Model):
#     _name = "cleon.payroll.rule"
#     _description = "Cleon Payroll Rule"
#     _inherit = ["mail.thread"]
#     _order = "sequence, code"

#     name = fields.Char(required=True, tracking=True)
#     code = fields.Char(
#         required=True, tracking=True,
#         help="Short code used to reference this rule's result in other "
#              "formulas, e.g. rules.BASIC")
#     sequence = fields.Integer(default=100, tracking=True,
#                                help="Rules are computed in this order.")
#     active = fields.Boolean(default=True)
#     company_id = fields.Many2one(
#         "res.company", default=lambda self: self.env.company)

#     category_id = fields.Many2one(
#         "cleon.payroll.category", string="Category", required=True, tracking=True)

#     rule_type = fields.Selection([
#         ("gross", "Gross"),
#         ("deduction", "Deduction"),
#         ("employer_contribution", "Employer Contribution"),
#         ("net", "Net"),
#     ], default="gross", required=True, tracking=True)

#     appears_on_payslip = fields.Boolean(default=True, tracking=True)
#     note = fields.Html()

#     # ---- Condition ----
#     condition_select = fields.Selection([
#         ("none", "Always True"),
#         ("range", "Wage Range"),
#         ("python", "Programming Expression"),
#     ], default="none", required=True, string="Condition")
#     condition_python = fields.Text(
#         string="Condition Formula",
#         help="# available: employee, contract, payslip, categories, "
#                 "worked_days, inputs, result\nresult = True")
#     raw_ai_text = fields.Text(
#         string="Raw AI Text", 
#         help="AI - Generate a python formula that will Compute  based on Nigeria tax law")
    
#     condition_range_min = fields.Float(string="Wage Range Min")
#     condition_range_max = fields.Float(string="Wage Range Max")

#     # ---- Amount / Formula ----
#     amount_select = fields.Selection([
#         ("fixed", "Fixed Amount"),
#         ("percentage", "Percentage"),
#         ("formula", "Python Formula"),
#     ], default="fixed", required=True, string="Amount Type", tracking=True)
#     amount_fixed = fields.Float(string="Fixed Amount", digits="Payroll")
#     amount_percentage = fields.Float(string="Percentage (%)", digits="Payroll")
#     amount_percentage_base = fields.Char(
#         string="Percentage Based On",
#         help="Formula/expression evaluated to obtain the base amount, "
#              "e.g. contract.wage  or  categories.BASIC")
#     amount_python_compute = fields.Text(
#         string="Formula",
#         default="# amount_python_compute available: employee, contract, payslip, categories, "
#                 "rules, worked_days, inputs\nresult = contract.wage")
#     formula_help = fields.Text(default=FORMULA_HELP, readonly=True)
#     ai_response = fields.Text(readonly=True)

#     struct_ids = fields.Many2many(
#         "cleon.payroll.structure", string="Used in Structures")

#     account_debit_id = fields.Many2one(
#         "account.account", string="Debit Account",
#         help="GL account debited when this rule is posted to accounting.")
#     account_credit_id = fields.Many2one(
#         "account.account", string="Credit Account",
#         help="GL account credited when this rule is posted to accounting.")
#     tax_id = fields.Many2one(
#         "account.tax", string="Related Tax",
#         help="Statutory tax/deduction this rule represents, if any.")

#     _sql_constraints = [
#         ("code_company_uniq", "unique(code, company_id)",
#          "Rule code must be unique per company."),
#     ]

#     # ------------------------------------------------------------------
#     # Evaluation helpers
#     # ------------------------------------------------------------------
#     def _get_localdict(self, employee, contract, payslip, categories_values,
#                         rules_values, worked_days_values, inputs_values):
#         self.ensure_one()
#         return {
#             "employee": employee,
#             "contract": contract,
#             "payslip": payslip,
#             "categories": BrowsableObject(employee.id, categories_values, self.env),
#             "rules": BrowsableObject(employee.id, rules_values, self.env),
#             "worked_days": WorkedDays(employee.id, worked_days_values, self.env),
#             "inputs": InputLine(employee.id, inputs_values, self.env),
#             "result": None,
#             "result_qty": 1.0,
#             "result_rate": 100.0,
#             "datetime": safe_datetime,
#         }

#     def _satisfies_condition(self, localdict):
#         self.ensure_one()
#         if self.condition_select == "none":
#             return True
#         if self.condition_select == "range":
#             wage = localdict["contract"].wage if localdict["contract"] else 0.0
#             return self.condition_range_min <= wage <= self.condition_range_max
#         if self.condition_select == "python":
#             try:
#                 safe_eval(self.condition_python, localdict, mode="exec", nocopy=True)
#             except Exception as e:
#                 raise UserError(_(
#                     "Error evaluating condition for rule %(rule)s:\n%(err)s",
#                     rule=self.name, err=e))
#             return bool(localdict.get("result"))
#         return True

#     def _compute_amount(self, localdict):
#         """Returns (amount, qty, rate) for this rule given the localdict."""
#         self.ensure_one()
#         if self.amount_select == "fixed":
#             return self.amount_fixed, 1.0, 100.0

#         if self.amount_select == "percentage":
#             base = 0.0
#             if self.amount_percentage_base:
#                 try:
#                     base = safe_eval(self.amount_percentage_base, localdict)
#                 except Exception as e:
#                     raise UserError(_(
#                         "Error evaluating percentage base for rule "
#                         "%(rule)s:\n%(err)s", rule=self.name, err=e))
#             amount = base * (self.amount_percentage / 100.0)
#             return amount, 1.0, self.amount_percentage

#         if self.amount_select == "formula":
#             try:
#                 safe_eval(self.amount_python_compute, localdict,
#                           mode="exec", nocopy=True)
#             except Exception as e:
#                 raise UserError(_(
#                     "Error evaluating formula for rule %(rule)s:\n%(err)s",
#                     rule=self.name, err=e))
#             result = localdict.get("result") or 0.0
#             qty = localdict.get("result_qty", 1.0)
#             rate = localdict.get("result_rate", 100.0)
#             return float(result) * float(qty) * (float(rate) / 100.0), qty, rate

#         return 0.0, 1.0, 100.0

#     def open_record(self):
#         view_id = self.env.ref('cleon_payroll.view_cleon_payroll_rule_form').id
#         ret = {
#             'name': "Rule",
#             'view_mode': 'form',
#             'view_id': view_id,
#             'view_type': 'form',
#             'res_model': self._name,
#             'res_id': self.id,
#             'type': 'ir.actions.act_window',
#             'domain': [],
#             'target': 'new'
#             }
#         return ret

#     def generate_AI_rule(self):
#         raw_text = self.raw_ai_text
#         if not raw_text:
#             raise ValidationError('Please provide AI Prompt')
#         data = utils.generate_text_with_ai(raw_text)
#         # if data:
#         #     try:
#         explanation = data.get("explanation")
#         python_code = data.get("python_code")
#         self.amount_python_compute = python_code
#         self.ai_response = explanation + python_code

#             # except Exception as e:
#             #     raise UserError('No AI server is down at the moment') 
#         return {
#                 'type': 'ir.actions.act_window',
#                 'res_model': 'cleon.payroll.rule',
#                 'res_id': self.id,
#                 'view_mode': 'form',
#                 'target': 'new',
#             }