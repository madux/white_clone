# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class CleonRuleParameter(models.Model):
    """A dated value a rule reads (e.g. TRANSPORT_RATE 20% until 31 Oct, 25% from 01 Nov).
    Rates live here, never inside the rule (spec F4 problem 3)."""
    _name = "cleon.payroll.rule.parameter"
    _description = "Cleon Payroll Rule Parameter"
    _inherit = ["mail.thread"]
    _order = "code"

    name = fields.Char(required=True, tracking=True)
    code = fields.Char(required=True, tracking=True,
                       help="Used in builder/formulas as params.CODE")
    unit = fields.Selection([("percent", "Percentage"), ("amount", "Amount"),
                             ("number", "Number")], default="percent", required=True)
    company_id = fields.Many2one("res.company", default=lambda s: s.env.company)
    active = fields.Boolean(default=True)
    value_ids = fields.One2many("cleon.payroll.rule.parameter.value", "parameter_id", copy=True)
    current_value = fields.Float(compute="_compute_current_value", digits=(16, 4))

    _sql_constraints = [("code_company_uniq", "unique(code, company_id)",
                         "Parameter code must be unique per company.")]

    def _compute_current_value(self):
        today = fields.Date.context_today(self)
        for rec in self:
            val = rec.get_value(today)
            rec.current_value = val if val is not None else 0.0

    def get_value(self, on_date):
        """Value in force on on_date, or None when no dated value covers it."""
        self.ensure_one()
        for v in self.value_ids.sorted("date_from", reverse=True):
            if v.date_from <= on_date and (not v.date_to or v.date_to >= on_date):
                return v.value
        return None

    @api.model
    def get_values_map(self, on_date, company=None):
        """{code: value} for every parameter that has a value on on_date.
        Percentage parameters are returned as fractions (25 -> 0.25)."""
        domain = [("active", "=", True)]
        if company:
            domain += ["|", ("company_id", "=", False), ("company_id", "=", company.id)]
        out = {}
        for p in self.sudo().search(domain):
            val = p.get_value(on_date)
            if val is not None:
                out[p.code] = val / 100.0 if p.unit == "percent" else val
        return out


class CleonRuleParameterValue(models.Model):
    _name = "cleon.payroll.rule.parameter.value"
    _description = "Cleon Payroll Rule Parameter Dated Value"
    _order = "parameter_id, date_from"

    parameter_id = fields.Many2one("cleon.payroll.rule.parameter", required=True, ondelete="cascade")
    date_from = fields.Date(string="Effective From", required=True)
    date_to = fields.Date(string="Effective To", help="Empty = open ended.")
    value = fields.Float(digits=(16, 4), required=True,
                         help="For Percentage parameters enter 25 for 25%.")

    @api.constrains("date_from", "date_to", "parameter_id")
    def _check_overlap(self):
        far = fields.Date.to_date("9999-12-31")
        for rec in self:
            if rec.date_to and rec.date_to < rec.date_from:
                raise ValidationError(_("'Effective To' cannot be before 'Effective From'."))
            for other in rec.parameter_id.value_ids - rec:
                if rec.date_from <= (other.date_to or far) and other.date_from <= (rec.date_to or far):
                    raise ValidationError(_(
                        "Overlapping versions of %(p)s: %(a)s and %(b)s cannot both be in force.",
                        p=rec.parameter_id.code, a=rec.date_from, b=other.date_from))

    @api.constrains("date_from")
    def _check_period_locked(self):
        """An effective date inside a confirmed/paid period is refused."""
        Slip = self.env["cleon.payslip"].sudo()
        last = Slip.search([("state", "in", ("confirm", "paid"))], order="date_to desc", limit=1)
        for rec in self:
            if last and rec.date_from <= last.date_to and not self.env.context.get("allow_locked_period"):
                raise ValidationError(_(
                    "Effective date %(d)s falls inside a confirmed or paid period (up to %(l)s).",
                    d=rec.date_from, l=last.date_to))
