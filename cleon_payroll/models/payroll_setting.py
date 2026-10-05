# -*- coding: utf-8 -*-
from odoo import api, fields, models,_
from odoo.exceptions import UserError
from datetime import datetime
from datetime import datetime, timedelta

class HrPayrollOvertimeRule(models.Model):
    _name = 'hr.payroll.overtime.rule'

    payroll_setup_id = fields.Many2one(
        'hr.payroll.setup'
    )
    applicable_employee_ids = fields.Many2one(
            'hr.employee',
            string= 'Applicable to Employee'
        )

    applicable_grade_ids = fields.Many2one(
                'hr.grade',
                string= 'Applicable to Employee'
            )

    applicable_level_ids = fields.Many2one(
                    'hr.level',
                    string= 'Applicable to Employee'
                )
    

    name = fields.Char(required=True)

    overtime_type = fields.Selection([
        ('normal', 'Normal Day'),
        ('weekend', 'Weekend'),
        ('holiday', 'Public Holiday')
    ])

    hour_from = fields.Float(string="Start time")
    hour_to = fields.Float(string="End time")
      
    overtime_fixed_rate = fields.Float(
        string='Overtime Rate (per/hr)'
    )
    today_allocated_hour_per_month = fields.Float(string="Allocated hour perday")
    
    multiplier = fields.Float()
    applicable_resource_ids = fields.Many2many(
        "resource.calendar", 
        string="Applicable Calendar Resource")

    @api.onchange('applicable_grade_ids', 'applicable_level_ids')
    def _onchange_applicable_grade_level(self):
        domain = []

        if self.applicable_grade_ids:
            domain.append(
                ('grade_id', 'in', self.applicable_grade_ids.ids)
            )

        if self.applicable_level_ids:
            domain.append(
                ('level_id', 'in', self.applicable_level_ids.ids)
            )

        if domain:
            employees = self.env['hr.employee'].search(domain)
            # self.applicable_employee_ids = [(6, 0, employees.ids)]

        return {
            'domain': {
                'applicable_employee_ids': domain
            }
        }

    

class hrPayrollSetup(models.Model):
    _name = 'hr.payroll.setup'
    _description = "Payroll setup"
    _order = "name"

    name = fields.Char(
            string='Name',
            required=True
        )
    auto_generate_payroll = fields.Boolean(
        default=True,
        string="Auto Generate Payroll"
    )

    payroll_cycle_ids = fields.One2many(
        "hr.payroll.cycle",
        "payroll_setup_id",
        string="Payroll Cycles"
    )
    more_overtime_rules = fields.Many2many(
            "hr.payroll.overtime.rule",
            string="More Overtime rules"
        )
    use_attendance_capture = fields.Boolean(
        string="Use Attendance capture", 
        default=False)

    overtime_enabled = fields.Boolean(
        string='Enable Overtime',
        default=True
    )
    compute_msg_text = fields.Text(store=True)

    overtime_type = fields.Selection([
        ('normal', 'Pay with hourly rate'),
        ('fixed_rate', 'Fixed Rate'),
        ('percentage', 'Percentage of Hourly Rate'),
    ], default='percentage')

    @api.onchange("overtime_type")
    def onchange_overtimetype(self):
        return self.get_overtimetype_info() 

    def get_overtimetype_info(self):
        percentage_compute_msg = f"""
        Overtime amount will be the percentage of 
        overtime percentage i.e {self.overtime_percentage /100 if self.overtime_percentage > 0 else 50 / 100}%
        multiplied by the calculated overtime hours using attendance or workentry. i.e 
        overtime hours  (10 hrs) *{self.overtime_percentage /100 if self.overtime_percentage > 0 else 50 / 100} % * hourly wage 2000 {self.env.user.company_id.currency_id.symbol} = 10,000
        """

        fixed_compute_msg = f"""
                Overtime amount will be the fixed rate of 
                overtime fixed rate perhour i.e {self.overtime_fixed_rate if self.overtime_fixed_rate > 0 else 5000} /100 {self.env.user.company_id.currency_id.symbol}
                multiplied by the calculated overtime hours using attendance or workentry. i.e 
                overtime hours (10 hrs) * {self.overtime_fixed_rate if self.overtime_fixed_rate > 0 else 5000} {self.env.user.company_id.currency_id.symbol} = 10,000
                """
        wage_perhour = f"""Overtime hours multiplied by Wage per hour : e.g 10hrs * 5000 {self.env.user.company_id.currency_id.symbol} per hour """
        msg = percentage_compute_msg if self.overtime_type == 'percentage' else fixed_compute_msg if self.overtime_type == 'fixed_rate' else wage_perhour
        self.compute_msg_text = msg 
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

    overtime_percentage = fields.Float(
        string='Overtime Percentage',
        default=150.0,
        help='150 means 1.5x normal hourly rate'
    )

    overtime_fixed_rate = fields.Float(
        string='Fixed Overtime Rate'
    )

    max_overtime_hours = fields.Float(
        string='Maximum Overtime Hours'
    )

    overtime_after_hours = fields.Float(
        string='Overtime Starts After (Hrs)',
        default=8.0,
        help='Hours worked beyond this are considered overtime'
    )
     
    default_overtime_rule_id = fields.Many2one(
                    'cleon.payroll.rule',
                    required=False,
                    domain="[('code', 'in', ['OVERTIME', 'ALLOWANCE', 'ALW'])]", 
                    # default=lambda self: self.env.ref('cleon_payroll.default_overtime_rule_id'), 
                    string= 'Default overtime Salary rule'
                )
    applicable_employee_ids = fields.Many2many(
                'hr.employee',
                string= 'Applicable to Employee'
            )
    
    applicable_grade_ids = fields.Many2one(
                'hr.grade',
                string= 'Applicable to Grades'
            )

    applicable_level_ids = fields.Many2one(
                    'hr.level',
                    string= 'Applicable to Level'
                )
    
    company_id = fields.Many2one(
        "res.company", string="Company",
        default=lambda self: self.env.company, required=True, tracking=True)
    applicable_location_ids = fields.Many2many("multi.branch", string="Applicable Locations")
    employee_count = fields.Integer(
        compute="_compute_employee_count", string="Employees")
    active = fields.Boolean(default=True)

    @api.depends("applicable_employee_ids")
    def _compute_employee_count(self):
        for rec in self:
            rec.employee_count = len(rec.applicable_employee_ids)

    @api.onchange('applicable_grade_ids', 'applicable_level_ids')
    def _onchange_applicable_grade_level(self):
        domain = []

        if self.applicable_grade_ids:
            domain.append(
                ('grade_id', 'in', self.applicable_grade_ids.ids)
            )

        if self.applicable_level_ids:
            domain.append(
                ('level_id', 'in', self.applicable_level_ids.ids)
            )

        if domain:
            employees = self.env['hr.employee'].search(domain)
            # self.applicable_employee_ids = [(6, 0, employees.ids)]

        return {
            'domain': {
                'applicable_employee_ids': domain
            }
        }

