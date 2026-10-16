# -*- coding: utf-8 -*-
from odoo import fields, models, _


class CleonRuleTest(models.TransientModel):
    """Pick any person and date, see what the rule pays and why (spec F4 'Test')."""
    _name = "cleon.payroll.rule.test"
    _description = "Cleon Payroll Rule Test"

    rule_id = fields.Many2one("cleon.payroll.rule", required=True, readonly=True)
    employee_id = fields.Many2one("hr.employee", required=True, string="Person")
    date = fields.Date(string="Period date", required=True, default=fields.Date.context_today)
    ran = fields.Boolean(readonly=True)
    condition_met = fields.Boolean(readonly=True)
    amount = fields.Float(readonly=True, digits=(16, 2))
    message = fields.Text(readonly=True)
    trace = fields.Text(readonly=True)

    def _reopen(self):
        return {"type": "ir.actions.act_window", "res_model": self._name,
                "res_id": self.id, "view_mode": "form", "target": "new"}

    def action_run(self):
        self.ensure_one()
        rule, emp = self.rule_id, self.employee_id
        contract = self.env["hr.contract"].search(
            [("employee_id", "=", emp.id), ("state", "=", "open")], limit=1)
        vals = {"ran": True, "condition_met": False, "amount": 0.0, "trace": False}
        if not contract:
            vals["message"] = _("%s has no running contract.") % emp.name
            self.write(vals)
            return self._reopen()
        missing = rule._find_missing_inputs(emp, contract)
        if missing:
            vals["message"] = ", ".join(missing)
            rule.write({"tested_ok": False})
            self.write(vals)
            return self._reopen()
        try:
            amount, met, trace = rule._simulate(emp, contract, self.date)
        except Exception as e:
            vals["message"] = _("Test failed: %s") % (e.args[0] if e.args else e)
            rule.write({"tested_ok": False})
            self.write(vals)
            return self._reopen()
        vals.update(condition_met=met, amount=amount, trace="\n".join(trace),
                    message=_("Condition true. Amount %(a)s.", a="{:,.2f}".format(amount)) if met
                    else _("Condition not met, nothing is paid."))
        rule.write({"tested_ok": True})
        self.write(vals)
        return self._reopen()
