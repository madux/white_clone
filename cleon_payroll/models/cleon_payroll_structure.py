# -*- coding: utf-8 -*-
from odoo import fields, models, api, _


class CleonPayrollStructure(models.Model):
    _name = "cleon.payroll.structure"
    _description = "Cleon Payroll Structure"
    _inherit = ["mail.thread"]
    _order = "name"

    name = fields.Char(required=True, tracking=True)
    code = fields.Char(required=True, tracking=True)
    company_id = fields.Many2one(
        "res.company", default=lambda self: self.env.company)
    parent_id = fields.Many2one(
        "cleon.payroll.structure", string="Parent Structure",
        help="Rules of the parent structure are inherited.")
    rule_ids = fields.Many2many(
        "cleon.payroll.rule", string="Payroll Rules")
    rule_count = fields.Integer(compute="_compute_rule_count")

    @api.depends("rule_ids")
    def _compute_rule_count(self):
        for rec in self:
            rec.rule_count = len(rec.rule_ids)

    
    contract_ids = fields.One2many(
            "hr.contract", 'cleon_structure_id', string="Payroll contracts")
    contract_count = fields.Integer(compute="_compute_contracts_count")
    @api.depends("contract_ids")
    def _compute_contracts_count(self):
        for rec in self:
            rec.contract_count = len(rec.contract_ids)

    schedule_pay = fields.Selection([
        ("daily", "Daily"),
        ("weekly", "Weekly"),
        ("bi-weekly", "Bi-weekly"),
        ("monthly", "Monthly"),
    ], default="monthly", required=True, tracking=True)
    note = fields.Text()
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ("code_company_uniq", "unique(code, company_id)",
         "Structure code must be unique per company."),
    ]

    def get_all_rules(self):
        """Return rules ordered by sequence, including parent structure rules."""
        self.ensure_one()
        rules = self.rule_ids
        if self.parent_id:
            rules |= self.parent_id.get_all_rules()
        return rules.sorted(key=lambda r: (r.sequence, r.code))
