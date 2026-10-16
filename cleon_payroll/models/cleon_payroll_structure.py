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
    rule_count = fields.Integer(compute="_compute_rule_count", string="No. of Rules")
    is_government_structure = fields.Boolean(
        string="Government Payroll Structure",
        default=False,
        help="Identifies Nigerian public-sector payroll structures."
    )
    cleon_payroll_template_id = fields.Many2one(
            'cleon.payroll.template', 
            string='Payroll template', 
            # required=True,
            default=lambda self: self.env.ref('cleon_payroll.template_default_id', raise_if_not_found=False)
        )
    grade_ids = fields.Many2many(
                'cleon.hr.grade', 
                'structure_id', 
                string='Payroll Grade', 
            )
    hr_employees_ids = fields.One2many(
                    'hr.employee', 
                    'cleon_current_structure_id', 
                    string='Employees', 
                )
    country_id = fields.Many2one(
                "res.country", string="Country",
                related="company_id.country_id"
        ) 
    active = fields.Boolean(
            string="Active",
            default=True,
        )
    show_payroll_link = fields.Boolean(
                    string="Payroll menu Link",
                    default=True,
                    help="Used to hold widget in form view"
                )

    def action_open_employee_wizard(self):
        self.ensure_one()

        return {
            "name": _("Add Employees to Payroll Structure"),
            "type": "ir.actions.act_window",
            "res_model": "cleon.structure.employee.wizard",
            "view_mode": "form",
            "target": "new",
            "context": {
                "default_structure_id": self.id,
            },
        }
 
    @api.model_create_multi
    def create(self, vals_list):
        structures = super().create(vals_list)
        for structure in structures:
            if structure.cleon_payroll_template_id:
                structure.cleon_payroll_template_id.write({
                    'payroll_structure_ids': [(4, structure.id)]
                })

        return structures

    def write(self, vals):
        res = super().write(vals)

        for structure in self:
            if structure.cleon_payroll_template_id:
                structure.cleon_payroll_template_id.write({
                    'payroll_structure_ids': [(4, structure.id)]
                })

        return res
 
        
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

    @api.onchange("parent_id")
    def onchange_parent_id(self):
        for record in self:
            if record.parent_id:
                record.rule_ids = [
                    (6, 0, record.get_all_rules().ids)
                ]
                
        
