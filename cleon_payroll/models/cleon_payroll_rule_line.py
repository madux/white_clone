# -*- coding: utf-8 -*-
import math
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

# Models a user may pick in the builder and the prefix each one gets in the formula.
# NOTE: "payslip.struct_id" assumes your payslip has a struct_id field. Change if different.
SOURCE_MODELS = {
    "hr.contract": "contract",
    "hr.employee": "employee",
    "cleon.payroll.structure": "payslip.structure_id",
}
COMPATIBLE_TTYPES = ["integer", "float", "monetary", "char", "text"]

FUNCTIONS = {
    "SIN": "sin", "COS": "cos", "TAN": "tan", "SQRT": "sqrt",
    "ABS": "abs", "ROUND": "round", "MIN": "min", "MAX": "max",
}
FUNCTION_ENV = {
    "sin": math.sin, "cos": math.cos, "tan": math.tan, "sqrt": math.sqrt,
    "abs": abs, "round": round, "min": min, "max": max,
}


class CleonPayrollRuleLine(models.Model):
    _name = "cleon.payroll.rule.line"
    _description = "Cleon Payroll Rule Builder Line"
    _order = "rule_id, purpose, sequence, id"

    rule_id = fields.Many2one("cleon.payroll.rule", required=True, ondelete="cascade")
    sequence = fields.Integer(default=10)
    purpose = fields.Selection(
        [("condition", "Condition"), ("amount", "Amount"), ("base", "Taxable / Contribution Base")],
        required=True, default="amount")

    token_type = fields.Selection([
        ("field", "Field"),
        ("rule", "Rule Result"),
        ("category", "Category Total"),
        ("input", "Payslip Input"),
        ("worked_days", "Worked Days"),
        ("number", "Number"),
        ("text", "Text"),
        ("operator", "Operator"),
        ("function", "Function"),
    ], required=True, default="field", string="Type")

    # 1. TYPE (model)
    model_id = fields.Many2one(
        "ir.model", string="Model",
        domain=[("model", "in", list(SOURCE_MODELS))])
    # 2. FIELD LINK
    field_id = fields.Many2one(
        "ir.model.fields", string="Field",
        domain="[('model_id', '=', model_id), ('ttype', 'in', %s)]" % COMPATIBLE_TTYPES)
    # 3. COMPATIBLE FIELDS (technical names, comma separated)
    compatible_fields = fields.Char(compute="_compute_compatible_fields")

    ref_rule_id = fields.Many2one("cleon.payroll.rule", string="Rule")
    ref_category_id = fields.Many2one("cleon.payroll.category", string="Category")
    ref_code = fields.Char(string="Code", help="Input / worked-days code")
    number_value = fields.Float(digits=(16, 6))
    is_percent = fields.Boolean(string="%", help="Treat the number as a percentage (7 -> 0.07)")
    text_value = fields.Char(string="Text")

    operator = fields.Selection([
        ("+", "+"), ("-", "-"), ("*", "×"), ("/", "÷"), ("%", "mod"), ("**", "power"),
        ("(", "("), (")", ")"),
        (">", ">"), ("<", "<"), (">=", "≥"), ("<=", "≤"), ("==", "="), ("!=", "≠"),
        ("and", "AND"), ("or", "OR"),
    ])
    function = fields.Selection([(k, k) for k in FUNCTIONS])

    expr = fields.Char(compute="_compute_expr", string="Preview")

    @api.depends("model_id")
    def _compute_compatible_fields(self):
        Fields = self.env["ir.model.fields"].sudo()
        for line in self:
            if not line.model_id:
                line.compatible_fields = False
                continue
            flds = Fields.search([
                ("model_id", "=", line.model_id.id),
                ("ttype", "in", COMPATIBLE_TTYPES),
            ])
            line.compatible_fields = ", ".join(sorted(flds.mapped("name")))

    @api.onchange("token_type")
    def _onchange_token_type(self):
        self.model_id = self.field_id = self.ref_rule_id = self.ref_category_id = False
        self.ref_code = self.operator = self.function = self.text_value = False

    @api.onchange("model_id")
    def _onchange_model_id(self):
        self.field_id = False

    @api.depends("token_type", "model_id", "field_id", "ref_rule_id", "ref_category_id",
                 "ref_code", "number_value", "is_percent", "text_value", "operator", "function")
    def _compute_expr(self):
        for line in self:
            line.expr = line._to_token()

    def _to_token(self):
        self.ensure_one()
        t = self.token_type
        if t == "field":
            if not (self.model_id and self.field_id):
                return ""
            prefix = SOURCE_MODELS.get(self.model_id.model)
            return "%s.%s" % (prefix, self.field_id.name) if prefix else ""
        if t == "rule":
            return "rules.%s" % self.ref_rule_id.code if self.ref_rule_id and self.ref_rule_id.code else ""
        if t == "category":
            return "categories.%s" % self.ref_category_id.code if self.ref_category_id else ""
        if t == "input":
            return "inputs.%s" % self.ref_code if self.ref_code else ""
        if t == "worked_days":
            return "worked_days.%s" % self.ref_code if self.ref_code else ""
        if t == "number":
            val = (self.number_value or 0.0)
            val = val / 100.0 if self.is_percent else val
            return repr(val)
        if t == "text":
            return repr(self.text_value or "")
        if t == "operator":
            return self.operator or ""
        if t == "function":
            return FUNCTIONS.get(self.function, "")
        return ""

    @api.constrains("token_type", "model_id", "field_id", "ref_rule_id", "ref_category_id",
                    "ref_code", "operator", "function")
    def _check_complete(self):
        labels = dict(self._fields["token_type"].selection)
        for line in self:
            if not line._to_token():
                raise ValidationError(
                    _("Incomplete line (%s). Please fill the required value.")
                    % labels[line.token_type])
            if line.token_type == "rule" and line.ref_rule_id == line.rule_id:
                raise ValidationError(_("A rule cannot reference its own result."))