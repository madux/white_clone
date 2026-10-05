# -*- coding: utf-8 -*-
from odoo import api, fields, models


class CleonPayslipRun(models.Model):
    _name = "cleon.payslip.run"
    _description = "Cleon Payroll Run (Batch)"
    _inherit = ["mail.thread"]
    _order = "date_start desc"

    name = fields.Char(required=True, tracking=True, default="New")
    schedule_pay = fields.Selection([
        ("daily", "Daily"),
        ("weekly", "Weekly"),
        ("bi-weekly", "Bi-weekly"),
        ("monthly", "Monthly"),
    ], default="monthly", required=True, tracking=True)
    date_start = fields.Date(required=True, tracking=True)
    date_end = fields.Date(required=True, tracking=True)
    company_id = fields.Many2one(
        "res.company", default=lambda self: self.env.company)
    state = fields.Selection([
        ("draft", "Draft"),
        ("verify", "Confirmed"),
        ("close", "Closed"),
    ], default="draft", tracking=True, string="Status")
    slip_ids = fields.One2many("cleon.payslip", "payslip_run_id", string="Payslips")
    slip_count = fields.Integer(compute="_compute_slip_count")
    clear_existing_payslip = fields.Boolean(
            string='Clear Existing Payslips', 
            help="This will help avoid duplicates", 
            default=True
        )
    @api.depends("slip_ids")
    def _compute_slip_count(self):
        for rec in self:
            rec.slip_count = len(rec.slip_ids)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("name", "New") == "New":
                vals["name"] = self.env["ir.sequence"].next_by_code(
                    "cleon.payslip.run") or "New"
        return super().create(vals_list)

    def action_generate_payslips(self):
        """Generate one payslip per active employee with a running contract
        whose structure schedule matches this run's schedule_pay."""
        Payslip = self.env["cleon.payslip"]
        Contract = self.env["hr.contract"]
        existing_payslip = self.env['cleon.payslip'].search([
            ('employee_id', '=', contract.employee_id.id),
            ('payslip_run_id', '=', contract.employee_id.id),
        ], limit=1)
        if self.clear_existing_payslip:
            existing_payslip.slip_ids.unlink()
            existing_payslip.unlink()
        for run in self:
            contracts = Contract.search([
                ("state", "=", "open"),
                ("cleon_schedule_pay", "=", run.schedule_pay),
                ("company_id", "=", run.company_id.id),
            ])
            existing_employees = run.slip_ids.employee_id
            for contract in contracts:
                
                if contract.employee_id in existing_employees:
                    continue
                Payslip.create({
                    'name': f'{contract.employee_id.name} - {run.date_start} to {run.date_end} - {self.id}',
                    "employee_id": contract.employee_id.id,
                    "contract_id": contract.id,
                    "structure_id": contract.cleon_structure_id.id,
                    "date_from": run.date_start,
                    "date_to": run.date_end,
                    "payslip_run_id": run.id,
                    'basic_wage': contract.wage

                })
            run.state = "verify"
        return True

    def action_confirm_payslips(self):
        for run in self:
            run.slip_ids.filtered(
                lambda p: p.state == "draft").action_compute_sheet()
            run.slip_ids.action_confirm()

    def action_view_payslips(self):
        self.ensure_one()
        action = self.env["ir.actions.actions"]._for_xml_id(
            "cleon_payroll.action_cleon_payslip")
        action["domain"] = [("payslip_run_id", "=", self.id)]
        action["context"] = {"default_payslip_run_id": self.id}
        return action

    def open_record(self):
        view_id = self.env.ref('cleon_payroll.view_cleon_payslip_run_form').id
        ret = {
            'name': "Payroll run",
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
