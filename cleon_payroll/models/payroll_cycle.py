from dateutil.relativedelta import relativedelta
from odoo import api, fields, models, _
from odoo.exceptions import UserError
from datetime import datetime


class HrPayrollCycle(models.Model):
    _name = "hr.payroll.cycle"
    _description = "Payroll Cycle"

    name = fields.Char(required=True)

    payroll_setup_id = fields.Many2one(
        "hr.payroll.setup",
        required=False,
        ondelete="cascade"
    )

    active = fields.Boolean(default=True)

    frequency = fields.Selection([
        ("daily", "Daily"),
        ('weekly', 'Weekly'),
        ('biweekly', 'Bi Weekly'),
        ('monthly', 'Monthly'),
    ], required=True, default='monthly')

    structure_ids = fields.Many2many(
        'cleon.payroll.structure',
        string='Applicable Structures'
    )

    company_id = fields.Many2one(
        'res.company',
        default=lambda self: self.env.company
    )

    next_run_date = fields.Date(
        required=True
    )

    last_run_date = fields.Date()

    auto_compute = fields.Boolean(
        string='Auto Compute Payslips'
    )

    auto_confirm = fields.Boolean(
        string='Auto Confirm Payslips'
    )
    clear_existing_payslip = fields.Boolean(
            string='Clear Existing Payslips', 
            help="This will help avoid duplicates", 
            default=True
        )

    last_run_id = fields.Many2one(
    'cleon.payslip.run'
)

    run_count = fields.Integer(
        # compute='_compute_run_count'
    )
    generate_journal_entry = fields.Boolean()
    email_payslips = fields.Boolean()
    include_new_hires = fields.Boolean(default=True)
    include_terminated = fields.Boolean(default=False)

    def _get_next_run_date(self):
        self.ensure_one()

        if self.frequency == 'weekly':
            return self.next_run_date + relativedelta(days=7)

        elif self.frequency == 'biweekly':
            return self.next_run_date + relativedelta(days=14)

        return self.next_run_date + relativedelta(months=1)

    def generate_payroll_run(self):
        '''THIS runs based on the set cycle'''
        self.ensure_one()

        if self.frequency == 'weekly':
            date_start = self.next_run_date
            date_end = date_start + relativedelta(days=6)

        elif self.frequency == 'biweekly':
            date_start = self.next_run_date
            date_end = date_start + relativedelta(days=13)

        else:
            date_start = self.next_run_date
            date_end = (
                date_start
                + relativedelta(months=1)
                - relativedelta(days=1)
            )

        run = self.env['cleon.payslip.run'].create({
            'name': f"{self.name} - {date_start}",
            'schedule_pay': self.frequency,
            'date_start': date_start,
            'date_end': date_end,
            'company_id': self.company_id.id,
        })

        self._generate_payslips(run)

        self.last_run_date = self.next_run_date
        self.next_run_date = self._get_next_run_date()

        return run

    def _generate_payslips(self, run):
        Contract = self.env['hr.contract']

        contracts = Contract.search([
            ('state', '=', 'open'),
            ('cleon_structure_id', 'in', self.structure_ids.ids),
            ('cleon_schedule_pay', '=', self.frequency),
            ('company_id', '=', self.company_id.id)
        ])

        payslips = [] 
        for contract in contracts:
            vals = {
                'name': f'{contract.employee_id.name} - {run.date_start} to {run.date_end} - {self.id}',
                'employee_id': contract.employee_id.id,
                'contract_id': contract.id,
                'structure_id': contract.cleon_structure_id.id,
                'date_from': run.date_start,
                'date_to': run.date_end,
                'company_id': run.company_id.id,
                'payslip_run_id': run.id,
                'basic_wage': contract.wage
            }
            
            payslip = self.env['cleon.payslip'].create(vals)

            payslips.append(payslip)

        if self.auto_compute:
            for slip in payslips:
                slip.action_compute_sheet()

                if self.auto_confirm:
                    slip.action_confirm()
        msg = f"""Generated total of {run.slip_count} Payslips"""
        return {
                    'type': 'ir.actions.client',
                    'tag': 'display_notification',
                    'params': {
                        'title': _('Overtime Computation tip'),
                        'message': _(msg),
                        'type': 'success',
                        'sticky': False,
                    }
                }

    @api.model
    def cron_generate_payroll_cycles(self):

        today = fields.Date.today()

        cycles = self.search([
            ('active', '=', True),
            ('next_run_date', '=', today)
        ])

        for cycle in cycles:
            cycle.generate_payroll_run()