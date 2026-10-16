# -*- coding: utf-8 -*-
import re
from collections import defaultdict

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.addons.cleon_payroll.models.cleon_payroll_rule import BrowsableObject

READ_RE = re.compile(r"\b(rules|categories|params)\.([A-Za-z0-9_]+)")
NUMERIC = ("integer", "float", "monetary")
TYPE_LABELS = {"gross": "Gross", "deduction": "Deduction",
               "employer_contribution": "Employer Contribution", "net": "Net"}
# Editing any of these invalidates the last successful test.
RESET_FIELDS = {
    "condition_select", "amount_select", "amount_fixed", "amount_percentage",
    "amount_percentage_base", "amount_python_compute", "condition_python",
    "condition_range_min", "condition_range_max", "contribution_rate",
    "contribution_base_floor", "contribution_base_cap", "contribution_amount_cap",
    "lookup_table_id", "lookup_key_field_id", "lookup_not_found", "category_id",
    "bracket_ids", "periods_per_year",
}


class ParamValues(BrowsableObject):
    """params.CODE -> value in force on the payslip date. A missing value is an
    error that names the parameter, never a silent zero."""

    def __getattr__(self, attr):
        if attr in self.values:
            return self.values[attr]
        raise UserError(_("Rule Parameter %s has no value for this period.") % attr)

    def __getitem__(self, attr):
        return self.__getattr__(attr)


class _FakeSlip(object):
    """Minimal payslip stand-in so a rule can be tested without creating a payslip."""

    def __init__(self, date, employee, contract):
        self.id = False
        self.date_from = self.date_to = date
        self.employee_id = employee
        self.contract_id = contract
        self.structure_id = contract.cleon_structure_id
        self.basic_wage = contract.wage


class CleonPayrollRule(models.Model):
    _inherit = "cleon.payroll.rule"

    # ---- lifecycle (AC-RS-008) ----
    state = fields.Selection([
        ("draft", "Draft"), ("pending", "Pending approval"),
        ("active", "Active"), ("superseded", "Superseded"),
    ], default="active", required=True, tracking=True, copy=False)
    is_ai_assisted = fields.Boolean(string="AI-assisted", readonly=True, copy=False, tracking=True)
    tested_ok = fields.Boolean(string="Tested", readonly=True, copy=False)

    # ---- level 5: lookup ----
    amount_select = fields.Selection(
        selection_add=[("lookup", "Lookup Table")], ondelete={"lookup": "set default"})
    lookup_table_id = fields.Many2one("cleon.payroll.lookup.table", string="Lookup Table")
    lookup_key_field_id = fields.Many2one(
        "ir.model.fields", string="Look up by",
        domain="[('model', 'in', ['hr.employee', 'hr.contract']), "
               "('ttype', 'in', ['char', 'many2one', 'selection', 'integer'])]",
        ondelete="set null")
    lookup_not_found = fields.Selection(
        [("error", "Stop with an error"), ("zero", "Pay zero")], default="error",
        string="If not found")

    # ---- "Percentage based on" is a dropdown of components, never free text (AC-RS-001) ----
    percentage_base_rule_id = fields.Many2one("cleon.payroll.rule", string="Based on (rule)")
    percentage_base_category_id = fields.Many2one("cleon.payroll.category", string="Based on (category)")

    # ---- declared reads drive the order (AC-RS-003 / AC-RS-009) ----
    reads_rules = fields.Char(compute="_compute_reads", store=True, string="Reads (rules)")
    reads_categories = fields.Char(compute="_compute_reads", store=True, string="Reads (categories)")
    reads_params = fields.Char(compute="_compute_reads", store=True, string="Reads (parameters)")
    rule_level = fields.Selection(
        [("1", "1 Simple"), ("2", "2 Conditional"), ("3", "3 Aggregation"),
         ("4", "4 Dated steps"), ("5", "5 Lookup"), ("6", "6 Advanced")],
        compute="_compute_reads", store=True, string="Level")

    # ------------------------------------------------------------------
    def _read_sources(self):
        self.ensure_one()
        parts = [self.amount_percentage_base or ""]
        if self.condition_select == "builder":
            parts.append(self._build_expression("condition"))
        if self.amount_select == "builder":
            parts.append(self._build_expression("amount"))
        if self.amount_select in ("bracket", "contribution"):
            parts.append(self._build_expression("base"))
        if self.condition_select == "python":
            parts.append(self.condition_python or "")
        if self.amount_select == "formula":
            parts.append(self.amount_python_compute or "")
        return " ".join(parts)

    @api.depends("condition_select", "amount_select", "amount_percentage_base",
                 "condition_python", "amount_python_compute", "lookup_table_id",
                 "condition_line_ids.expr", "amount_line_ids.expr", "base_line_ids.expr")
    def _compute_reads(self):
        Param = self.env["cleon.payroll.rule.parameter"].sudo()
        for r in self:
            found = defaultdict(set)
            for kind, code in READ_RE.findall(r._read_sources()):
                found[kind].add(code)
            r.reads_rules = ", ".join(sorted(found["rules"]))
            r.reads_categories = ", ".join(sorted(found["categories"]))
            r.reads_params = ", ".join(sorted(found["params"]))
            dated = bool(found["params"]) and any(
                len(p.value_ids) > 1 for p in Param.search([("code", "in", list(found["params"]))]))
            if r.condition_select == "python" or r.amount_select == "formula":
                level = "6"
            elif r.amount_select in ("lookup", "bracket"):
                level = "5"
            elif dated:
                level = "4"
            elif r.amount_select == "contribution" or len(found["rules"]) + len(found["categories"]) > 1:
                level = "3"
            elif r.condition_select in ("range", "builder"):
                level = "2"
            else:
                level = "1"
            r.rule_level = level

    def _get_read_codes(self, kind):
        self.ensure_one()
        value = {"rules": self.reads_rules, "categories": self.reads_categories,
                 "params": self.reads_params}[kind]
        return {c.strip() for c in (value or "").split(",") if c.strip()}

    # ------------------------------------------------------------------
    # Dropdown -> expression
    # ------------------------------------------------------------------
    @api.onchange("percentage_base_rule_id")
    def _onchange_percentage_base_rule(self):
        if self.percentage_base_rule_id:
            self.percentage_base_category_id = False
            self.amount_percentage_base = "rules.%s" % self.percentage_base_rule_id.code

    @api.onchange("percentage_base_category_id")
    def _onchange_percentage_base_category(self):
        if self.percentage_base_category_id:
            self.percentage_base_rule_id = False
            self.amount_percentage_base = "categories.%s" % self.percentage_base_category_id.code

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------
    @api.constrains("category_id", "rule_type")
    def _check_type_matches_category(self):
        """One classification: a Deductions line can never add to Gross (AC-RS-004)."""
        for r in self:
            kind = r.category_id.kind
            if kind and kind != r.rule_type:
                raise ValidationError(_(
                    "A %(cat)s line cannot add to %(typ)s. Category '%(cat)s' is classified "
                    "as %(kind)s.", cat=r.category_id.name, typ=TYPE_LABELS.get(r.rule_type),
                    kind=TYPE_LABELS.get(kind)))

    @api.constrains("reads_rules", "reads_categories", "category_id", "code", "struct_ids")
    def _check_cycles(self):
        self.mapped("struct_ids")._check_rule_cycles()

    # ------------------------------------------------------------------
    # Engine hooks
    # ------------------------------------------------------------------
    def _get_localdict(self, employee, contract, payslip, categories_values,
                       rules_values, worked_days_values, inputs_values):
        d = super()._get_localdict(employee, contract, payslip, categories_values,
                                   rules_values, worked_days_values, inputs_values)
        on_date = (payslip and payslip.date_to) or fields.Date.today()
        pvals = self.env["cleon.payroll.rule.parameter"].get_values_map(on_date, self.company_id)
        d["params"] = ParamValues(employee.id, pvals, self.env)
        return d

    def _compute_amount(self, localdict):
        self.ensure_one()
        if self.amount_select == "lookup":
            return self._compute_lookup(localdict), 1.0, 100.0
        return super()._compute_amount(localdict)

    def _compute_lookup(self, localdict):
        self.ensure_one()
        field = self.lookup_key_field_id
        if not (self.lookup_table_id and field):
            raise UserError(_("Rule %s: choose a lookup table and what to look up by.") % self.name)
        holder = localdict["employee"] if field.model == "hr.employee" else localdict["contract"]
        raw = holder[field.name] if holder else False
        key = (raw.display_name if raw else False) if field.ttype == "many2one" else raw
        if not key:
            raise UserError(_("%s missing") % field.field_description)
        value = self.lookup_table_id.lookup(key)
        if value is None:
            if self.lookup_not_found == "zero":
                return 0.0
            raise UserError(_("'%(k)s' was not found in %(t)s.", k=key, t=self.lookup_table_id.name))
        return value

    # ------------------------------------------------------------------
    # Test on a real person (AC-RS-006, 010, 012, 013)
    # ------------------------------------------------------------------
    def _find_missing_inputs(self, employee, contract):
        """Names every HR field the rule reads that is empty. Missing data is never zero."""
        self.ensure_one()
        missing = []
        lines = (self.condition_line_ids | self.amount_line_ids | self.base_line_ids)
        pairs = [(l.model_id.model, l.field_id) for l in lines
                 if l.token_type == "field" and l.field_id]
        if self.amount_select == "lookup" and self.lookup_key_field_id:
            pairs.append((self.lookup_key_field_id.model, self.lookup_key_field_id))
        for model, field in pairs:
            if field.ttype in NUMERIC:
                continue
            holder = employee if model == "hr.employee" else contract if model == "hr.contract" else None
            if holder is not None and not holder[field.name]:
                label = _("%s missing") % field.field_description
                if label not in missing:
                    missing.append(label)
        return missing

    def _collect_dependencies(self):
        """The rule plus every rule it reads, transitively."""
        self.ensure_one()
        Rule = self.env["cleon.payroll.rule"]
        pool = Rule.search([("state", "=", "active"),
                            ("company_id", "in", [self.company_id.id, False])])
        needed, todo = self, self
        while todo:
            nxt = Rule
            for r in todo:
                rcodes, ccodes = r._get_read_codes("rules"), r._get_read_codes("categories")
                nxt |= pool.filtered(lambda p: p.code in rcodes or (
                    p.category_id.code in ccodes and p.category_id != r.category_id))
            todo = nxt - needed
            needed |= todo
        return needed

    def _simulate(self, employee, contract, on_date):
        """Runs this rule (and what it reads) for one person on one date. Returns
        (amount, condition_met, trace_lines)."""
        self.ensure_one()
        slip = _FakeSlip(on_date, employee, contract)
        ordered = self.env["cleon.payroll.structure"]._sort_rules_by_reads(self._collect_dependencies())
        cats, amounts, trace = defaultdict(float), {}, []
        for r in ordered:
            ld = r._get_localdict(employee, contract, slip, dict(cats), dict(amounts), {}, {})
            if not r._satisfies_condition(ld):
                trace.append("%s: condition not met" % r.code)
                if r == self:
                    return 0.0, False, trace
                continue
            amount, qty, rate = r._compute_amount(ld)
            amounts[r.code] = amount
            if r.category_id:
                cats[r.category_id.code] += amount
            trace.append("%s = %.2f" % (r.code, amount))
        return amounts.get(self.code, 0.0), True, trace

    def action_open_test(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window", "name": _("Test rule"),
                "res_model": "cleon.payroll.rule.test", "view_mode": "form",
                "view_id": self.env.ref('cleon_payroll_rules.view_cleon_rule_test_form').id,
                "target": "new", "context": {"default_rule_id": self.id}}

    # ------------------------------------------------------------------
    # Lifecycle + AI
    # ------------------------------------------------------------------
    def _reset_tested(self):
        rules = self.filtered("tested_ok")
        if rules:
            rules.write({"tested_ok": False})

    def write(self, vals):
        if RESET_FIELDS & set(vals) and "tested_ok" not in vals:
            vals = dict(vals, tested_ok=False)
        return super().write(vals)

    def _can_approve(self):
        if self.env.su or self.env.user.has_group("base.group_system"):
            return True
        try:
            return self.env.user.has_group("cleon_payroll.group_payroll_manager")
        except ValueError:
            return False

    def action_submit(self):
        for r in self:
            if r.state != "draft":
                raise UserError(_("Only a draft rule can be submitted."))
        self.write({"state": "pending"})

    def action_approve(self):
        if not self._can_approve():
            raise AccessError(_("Only a Payroll Manager can approve a rule."))
        for r in self:
            if r.state != "pending":
                raise UserError(_("Rule %s is not pending approval.") % r.name)
            if not r.tested_ok:
                raise UserError(_("Test rule %s on a real person before approving it.") % r.name)
        self.write({"state": "active"})

    def action_set_draft(self):
        self.write({"state": "draft", "tested_ok": False})

    def action_supersede(self):
        self.write({"state": "superseded"})

    def generate_AI_rule(self):
        """AI output lands as a Draft rule marked AI-assisted, never active; statutory
        rules cannot be generated this way (AC-RS-005). An active rule is never
        overwritten: the suggestion goes into a draft copy."""
        self.ensure_one()
        if self.is_statutory:
            raise UserError(_("Statutory rules cannot be generated with AI."))
        target = self
        if self.state == "active":
            target = self.copy({
                "name": _("%s (AI draft)") % self.name,
                "code": "%s_AI%s" % (self.code, fields.Datetime.now().strftime("%H%M%S")),
                "state": "draft", "raw_ai_text": self.raw_ai_text,
            })
        res = super(CleonPayrollRule, target).generate_AI_rule()
        target.write({"is_ai_assisted": True, "state": "draft", "tested_ok": False})
        return res
