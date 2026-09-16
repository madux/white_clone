# -*- coding: utf-8 -*-
from collections import defaultdict
from dateutil.relativedelta import relativedelta
from datetime import datetime
from odoo import api, fields, models, _
from odoo.exceptions import UserError


def _default_date_to(self):
    return fields.Date.context_today(self) + relativedelta(day=31)
 

class CleonPayslip(models.Model):
    _name = "cleon.payslip"
    _description = "Cleon Payslip"
    _inherit = ["mail.thread"]
    _order = "date_from desc, employee_id"

    name = fields.Char(required=True, default="New", tracking=True)
    number = fields.Char(related="name", store=False)
    employee_id = fields.Many2one(
        "hr.employee", required=True, tracking=True, ondelete="restrict")
    contract_id = fields.Many2one(
        "hr.contract", required=True, tracking=True, ondelete="restrict",
        domain="[('employee_id', '=', employee_id), ('state', '=', 'open')]")
    department_id = fields.Many2one('hr.department', related="employee_id.department_id")
    job_title = fields.Many2one('hr.job', related="employee_id.job_id")
    avatar_128 = fields.Binary(
            related="employee_id.avatar_128",
            store=True
        )
    employee_number = fields.Char(related="employee_id.employee_number")
    
    structure_id = fields.Many2one(
        "cleon.payroll.structure", string="Payroll Structure",
        required=True, tracking=True)
    company_id = fields.Many2one(
        "res.company", default=lambda self: self.env.company)
    payslip_run_id = fields.Many2one("cleon.payslip.run", string="Batch")

    date_from = fields.Date(required=True, default=fields.Date.context_today, tracking=True)
    date_to = fields.Date(required=True, tracking=True, default=_default_date_to)

    state = fields.Selection([
        ("draft", "Draft"),
        ("computed", "Computed"),
        ("confirm", "Confirmed"),
        ("paid", "Paid"),
        ("cancel", "Cancelled"),
    ], default="draft", tracking=True)

    line_ids = fields.One2many("cleon.payslip.line", "payslip_id", string="Payslip Lines")
    worked_days_line_ids = fields.One2many(
        "cleon.payslip.worked.days", "payslip_id", string="Worked Days")
    input_line_ids = fields.One2many(
        "cleon.payslip.input.line", "payslip_id", string="Other Inputs")

    basic_wage = fields.Float(string="Basic Wage", store=True)
    # basic_wage = fields.Float(related="contract_id.wage", string="Basic Wage", store=True)
    net_wage = fields.Float(compute="_compute_totals", store=True, digits="Payroll")
    gross_wage = fields.Float(compute="_compute_totals", store=True, digits="Payroll")
    total_deduction = fields.Float(compute="_compute_totals", store=True, digits="Payroll")
    total_employer_contribution = fields.Float(
        compute="_compute_totals", store=True, digits="Payroll")

    move_id = fields.Many2one("account.move", string="Journal Entry", readonly=True, copy=False)
    note = fields.Text()

    @api.depends("line_ids.amount", "line_ids.rule_type")
    def _compute_totals(self):
        for slip in self:
            gross = deduction = employer = net = 0.0
            for line in slip.line_ids:
                if line.rule_type in ("gross",):
                    gross += line.amount
                    net += line.amount
                elif line.rule_type == "deduction":
                    deduction += line.amount
                    net -= line.amount
                elif line.rule_type == "employer_contribution":
                    employer += line.amount
                elif line.rule_type == "net":
                    net = line.amount
            for oil in self.input_line_ids:
                if oil.rule_type in ("gross",):
                    gross += oil.amount
                    net += oil.amount
                elif oil.rule_type == "deduction":
                    deduction += oil.amount
                    net -= oil.amount
                elif oil.rule_type == "employer_contribution":
                    employer += oil.amount
                elif oil.rule_type == "net":
                    net = oil.amount
                    gross += oil.amount
                else:
                    net = oil.amount
                    gross += oil.amount
                
            slip.gross_wage = gross
            slip.total_deduction = deduction
            slip.total_employer_contribution = employer
            slip.net_wage = net

    @api.onchange("contract_id")
    def _onchange_contract_id(self):
        if self.contract_id:
            self.structure_id = self.contract_id.cleon_structure_id

    @api.onchange("employee_id")
    def _onchange_employee_id(self):
        if self.employee_id:
            contract = self.env["hr.contract"].search([
                ("employee_id", "=", self.employee_id.id),
                ("state", "=", "open"),
            ], limit=1)
            self.contract_id = contract
            self.structure_id = contract.cleon_structure_id

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("name", "New") == "New":
                vals["name"] = self.env["ir.sequence"].next_by_code(
                    "cleon.payslip") or "New"
        return super().create(vals_list)

    # ------------------------------------------------------------------
    # Worked days generation (Attendance & Leave integration)
    # ------------------------------------------------------------------
 
    def compute_hours_based_on_structure(self, employee, structure):
        '''5 days * 4 weeks = 20days/months 
        if monthly structure: 20 days * 8 hrs = 800 (/ 30 (20 days per month), 
        if weekly: 5days / wk * 1week = 5days  * 8hrs = 40 ( / '''
        structure_schedule_pay_type = structure.schedule_pay
        contract = employee.contract_id
        if structure_schedule_pay_type == 'weekly':
            hrs_per_week, days_per_week = self.get_resource_calendar(employee)
            total_hours = days_per_week * employee.resource_calendar_id.hours_per_day * 1
             # 5 days * 8 = 40 hours per week
            total_days = total_hours / employee.resource_calendar_id.hours_per_day
            # wage_per_days = contract.wage / total_days # wage = 500,000 / 20 = 25000
            # wage_per_hour = wage_per_days / employee.resource_calendar_id.hours_per_day  # wage = 500,000 / 20 / 8 = 3125

        elif structure_schedule_pay_type == 'bi-weekly':
            hrs_per_week, days_per_week = self.get_resource_calendar(employee)
            total_hours = days_per_week * 2 * employee.resource_calendar_id.hours_per_day 
            # 5 * 2 days * 8 = 80 hours 2per week
            total_days = total_hours / employee.resource_calendar_id.hours_per_day

        elif structure_schedule_pay_type == 'monthly':
            hrs_per_week, days_per_week = self.get_resource_calendar(employee)
            total_hours = (days_per_week * 4) * employee.resource_calendar_id.hours_per_day 
            total_days = total_hours / employee.resource_calendar_id.hours_per_day
            

            #  5 * 4 * 8 = 160 hrs
        else: # daily pay
            total_hours = employee.resource_calendar_id.hours_per_day  
            # 8 hrs per day
            total_days = total_hours / employee.resource_calendar_id.hours_per_day
        wage_per_days = contract.wage / total_days # wage = 500,000 / 20 = 25000
        wage_per_hour = wage_per_days / employee.resource_calendar_id.hours_per_day  # wage = 500,000 / 20 / 8 = 3125
        
        return total_hours, total_days, wage_per_days, wage_per_hour

                
    def get_resource_calendar(self, employee):
        '''to compute the total hours allocated per week of the employee'''
        employee_resource_calendar_id = employee.resource_calendar_id
        if not employee.resource_calendar_id:
            raise UserError('''
            Employee is not linked to resource calendar working days.
              Kindly set it to 40 hours per weeks at least''')
        lines = employee.resource_calendar_id.mapped('attendance_ids').filtered(
            lambda ca: ca.day_period not in ['lunch'])  # got ll the resource lines that is not break
        total_allocated_workhours = sum([ln.today_week_per_day for ln in lines]) # 8 hours * 5 days excluding breaks
        number_of_days_per_week = sum([ln.duration_days for ln in lines]) # 8 hours * 5 days excluding breaks
        return total_allocated_workhours, number_of_days_per_week

    def get_overtime_hours(self, worked_days_line_ids):
        '''wktime = worked_days (5) * hours_per_day(8) = 40
            determine overtime = worked_hours (48) - wktime(40) = 8hrs'''
        worked_days = sum([r.number_of_days for r in worked_days_line_ids])
        total_worked_hours = sum([r.number_of_hours for r in worked_days_line_ids])
        total_weeks, number_of_days_per_week = self.get_resource_calendar(self.employee_id) # 40 hrs / wk, 5 days per week
        # worked_hours =  number_of_days_per_week * hours_per_day
        wktime = worked_days * self.employee_id.resource_calendar_id.hours_per_day + 10 # e.g 20 days * 8 hrs = 160, add 10 for test of ovrrtime
        employee_legal_hours, total_days, wage_per_days, wage_per_hours = self.compute_hours_based_on_structure(self.employee_id, self.structure_id)
        overtime = wktime - employee_legal_hours # 170 -160 = 10 , if attendance there will be difference

        # raise UserError(f"""worked_days - {worked_days}, total_worked_hours - {total_worked_hours},
        # total_days_allocation - {total_days}, wktime - {wktime} === overtime - {overtime}""")
        return overtime, wage_per_hours
    
    def _get_worked_days_lines_vals(self):
        self.ensure_one()
        vals = []
        Attendance = self.env["hr.attendance"]
        attendances = Attendance.search([
            ("employee_id", "=", self.employee_id.id),
            ("check_in", ">=", self.date_from),
            ("check_in", "<=", self.date_to),
        ])
        # if self.use_attendnce_workentry and not attendances:
        #     pass # raise UserError(f'No workentry found for {self.employee_id.name}')
        total_weeks, total_days_allocation = self.get_resource_calendar(self.employee_id)
        # raise UserError(f"""{total_days_allocation}--{total_weeks}""")
        worked_hours, worked_days, wage_per_days, wage_per_hours = self.compute_hours_based_on_structure(self.employee_id, self.structure_id)
        # hours_per_day = self.contract_id.resource_calendar_id.hours_per_day
        worked_hours =  worked_hours if not attendances else sum([a.worked_hours for a in attendances])
        worked_days = worked_days if not attendances else len(attendances.mapped(lambda a: a.check_in.date()))
          
        vals.append((0, 0, {
            "name": _("Attendance Work entry"),
            "code": f"Entry {self.id}",
            "sequence": 1,
            "number_of_days": worked_days,
            "number_of_hours": worked_hours,
            # "work_overtime_hours": overtime_hours(),
        }))
 
        Leave = self.env["hr.leave"]
        leaves = Leave.search([
            ("employee_id", "=", self.employee_id.id),
            ("state", "=", "validate"),
            ("date_from", "<=", self.date_to),
            ("date_to", ">=", self.date_from),
        ])
        leave_by_type = defaultdict(float)
        for leave in leaves:
            leave_by_type[leave.holiday_status_id] += leave.number_of_days

        seq = 2
        for leave_type, days in leave_by_type.items():
            code = ("LEAVE" + (leave_type.name or "").upper()[:5]).replace(" ", "")
            vals.append((0, 0, {
                "name": leave_type.name,
                "code": code,
                "sequence": seq,
                "number_of_days": days,
                "number_of_hours": days * (self.contract_id.resource_calendar_id.hours_per_day or 8.0),
            }))
            seq += 1
        return vals

    def compute_worked_days(self):
        for slip in self:
            slip.worked_days_line_ids.unlink()
            slip.write({"worked_days_line_ids": slip._get_worked_days_lines_vals()})

    # ------------------------------------------------------------------
    # Core computation engine
    # ------------------------------------------------------------------
 
    def get_employee_with_overstime(self, slip, employee, overtime_hours, wage_per_hours):
        '''overtime_hours: difference of total_working hours in attendance / resources 
        eg 40 per week, if 5o hours was calculate i.e 50 - 40 = 10'''
        overtimes = self.env['hr.payroll.setup'].search([])
        overtime_amount = 0.0
        overtime_setup = False
        for ov in overtimes:
            overtime_setup = ov
            if employee.id in ov.applicable_employee_ids.ids:
                # employee_legal_hours, total_days, wage_per_days, wage_per_hours = self.compute_hours_based_on_structure(
                #                 slip.employee_id, slip.structure_id)
                contract = employee.contract_id
                monthly_salary = contract.wage
                # hourly_rate = monthly_salary / 173.33
                hourly_rate = wage_per_hours
                if ov.overtime_type == 'fixed_rate':
                    overtime_amount = overtime_hours * ov.overtime_fixed_rate
                    
                elif ov.overtime_type == 'percentage': # 
                    multiplier = ov.overtime_percentage / 100.0
                    overtime_amount = overtime_hours * wage_per_hours * multiplier
                else:
                    overtime_amount = overtime_hours * wage_per_hours

            employee_has_specific_ov = ov.mapped('more_overtime_rules').filtered(
                lambda emp: self.employee_id.id in emp.applicable_employee_ids.ids)
            if employee_has_specific_ov:
                ovr = employee_has_specific_ov[0]
                contract = employee.contract_id
                monthly_salary = contract.wage
                overtime_hours = ovr.today_allocated_hour_per_month - overtime_hours
                # hourly_rate = monthly_salary / 173.33
                hourly_rate = wage_per_hours

                if ov.overtime_type == 'fixed_rate':
                    overtime_amount = overtime_hours * ovr.overtime_fixed_rate
                elif ov.overtime_type == 'percentage': # 
                    multiplier = ov.overtime_percentage / 100.0
                    overtime_amount = overtime_hours * hourly_rate * multiplier
                else:
                    overtime_amount = overtime_hours * wage_per_hours
            break
        # raise UserError(f"yes it exist na wetin hours {overtime_hours}, amount {overtime_amount} wage per hour {wage_per_hours}")
        return overtime_setup, abs(overtime_amount)

    def action_compute_sheet(self):
        for slip in self:
            if not slip.structure_id:
                raise UserError(_("Please set a Payroll Structure before computing."))
            if not slip.worked_days_line_ids:
                slip.compute_worked_days()
            slip.line_ids.unlink()

            worked_days_values = {wd.code: wd for wd in slip.worked_days_line_ids}
            inputs_values = {inp.code: inp for inp in slip.input_line_ids if inp.code}

            categories_totals = defaultdict(float)
            rules_amounts = {}
            line_vals = []

            rules = slip.structure_id.get_all_rules()
            for rule in rules:
                localdict = rule._get_localdict(
                    slip.employee_id, slip.contract_id, slip,
                    dict(categories_totals), dict(rules_amounts),
                    worked_days_values, inputs_values)

                if not rule._satisfies_condition(localdict):
                    continue

                amount, qty, rate = rule._compute_amount(localdict)
                rules_amounts[rule.code] = amount
                if rule.category_id:
                    categories_totals[rule.category_id.code] += amount

                line_vals.append((0, 0, {
                    "rule_id": rule.id,
                    "name": rule.name,
                    "code": rule.code,
                    "sequence": rule.sequence,
                    "quantity": qty,
                    "rate": rate,
                    "amount": amount,
                    "appears_on_payslip": rule.appears_on_payslip,
                }))
                overtime_hours, wage_per_hours = self.get_overtime_hours(slip.worked_days_line_ids)
                overtime_setup, overtime_amount = self.get_employee_with_overstime(
                    slip, 
                    self.employee_id,
                    overtime_hours,
                    wage_per_hours
                )

                if overtime_amount > 0:
                    self._create_overtime_input(overtime_amount)
            slip.write({"line_ids": line_vals, "state": "computed"})
            slip._compute_totals()
        return True

    def _create_overtime_input(self, amount):
        self.ensure_one()

        input_type = self.env['cleon.payroll.input.type'].search([
            ('code', '=', 'OVERTIME')
        ], limit=1)

        if not input_type:
            return

        existing = self.input_line_ids.filtered(
            lambda l: l.code == 'OVERTIME'
        )

        if existing:
            existing.amount = amount
        else:
            self.input_line_ids = [(0, 0, {
                'input_type_id': input_type.id,
                'name': input_type.name,
                'amount': amount,
                'sequence': 10,
            })]

    def action_confirm(self):
        for slip in self:
            if slip.state != "computed":
                slip.action_compute_sheet()
            slip._create_account_move()
            slip.state = "confirm"

    def action_mark_paid(self):
        self.write({"state": "paid"})

    def action_cancel(self):
        self.write({"state": "cancel"})

    def action_draft(self):
        self.write({"state": "draft"})

    def _create_account_move(self):
        """Build a very simple journal entry from lines that carry
        debit/credit accounts on their rule. Left intentionally simple -
        extend per your Chart of Accounts / journal setup."""
        AccountMove = self.env["account.move"]
        journal = self.env["account.journal"].search(
            [("type", "=", "general"), ("company_id", "=", self.company_id.id)], limit=1)
        if not journal:
            return
        for slip in self:
            move_lines = []
            for line in slip.line_ids:
                if line.rule_id.account_debit_id:
                    move_lines.append((0, 0, {
                        "account_id": line.rule_id.account_debit_id.id,
                        "name": line.name,
                        "debit": abs(line.total),
                        "credit": 0.0,
                    }))
                if line.rule_id.account_credit_id:
                    move_lines.append((0, 0, {
                        "account_id": line.rule_id.account_credit_id.id,
                        "name": line.name,
                        "debit": 0.0,
                        "credit": abs(line.total),
                    }))
            if not move_lines:
                continue
            move = AccountMove.create({
                "journal_id": journal.id,
                "date": slip.date_to,
                "ref": slip.name,
                "line_ids": move_lines,
            })
            slip.move_id = move.id
