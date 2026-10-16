# -*- coding: utf-8 -*-
from odoo import api, fields, models
from odoo.addons.cleon_payroll.models import cleon_payroll_rule_line as base_line

# FIX: the payslip field is `structure_id`, not `struct_id`, so tokens built from
# the structure model would raise at compute time.
base_line.SOURCE_MODELS["cleon.payroll.structure"] = "payslip.structure_id"


class _AnyNum(object):
    """Dry-run stand-in so the save-time validator accepts params.CODE."""
    def __getattr__(self, attr):
        return 1.0

    def __getitem__(self, attr):
        return 1.0


base_line.FUNCTION_ENV.setdefault("params", _AnyNum())


class CleonPayrollRuleLine(models.Model):
    _inherit = "cleon.payroll.rule.line"

    token_type = fields.Selection(
        selection_add=[("param", "Rule Parameter")], ondelete={"param": "set default"})
    ref_param_id = fields.Many2one("cleon.payroll.rule.parameter", string="Parameter")

    def _to_token(self):
        self.ensure_one()
        if self.token_type == "param":
            return "params.%s" % self.ref_param_id.code if self.ref_param_id else ""
        return super()._to_token()

    @api.depends("token_type", "model_id", "field_id", "ref_rule_id", "ref_category_id",
                 "ref_code", "number_value", "is_percent", "text_value", "operator",
                 "function", "ref_param_id")
    def _compute_expr(self):
        for line in self:
            line.expr = line._to_token()

    @api.onchange("token_type")
    def _onchange_token_type(self):
        super()._onchange_token_type()
        self.ref_param_id = False

    # Any edit to a builder line invalidates the last successful test of its rule.
    @api.model_create_multi
    def create(self, vals_list):
        recs = super().create(vals_list)
        recs.mapped("rule_id")._reset_tested()
        return recs

    def write(self, vals):
        res = super().write(vals)
        self.mapped("rule_id")._reset_tested()
        return res

    def unlink(self):
        rules = self.mapped("rule_id")
        res = super().unlink()
        rules._reset_tested()
        return res
