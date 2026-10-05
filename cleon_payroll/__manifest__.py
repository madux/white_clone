# -*- coding: utf-8 -*-
{
    'name': 'Cleon Payroll',
    'version': '17.0.1.0.0',
    'category': 'Human Resources/Payroll',
    'summary': 'Custom Payroll System with dynamic rule/formula engine',
    'description': """
Cleon Payroll
=============
A fully custom payroll system built on Odoo 17 Community.

Key features:
- Multi-location organization setup
- Employee lifecycle via hr.employee / hr.contract
- Pay grades via hr.grade
- Dynamic, configurable payroll rules (cleon.payroll.rule) with a
  formula engine (fixed / percentage / python formula) evaluated
  against employee, contract, worked days, previously computed
  rule results and inputs - similar in spirit to Odoo's own
  hr_payroll rule engine but fully custom-built and namespaced.
- Payroll structures (cleon.payroll.structure) grouping rules
- Attendance & Leave aware worked-days computation
- Tax & statutory deduction rules linked to account.tax /
  account.account / account.journal
- Batch payroll runs (cleon.payslip.run) with daily/weekly/monthly
  frequency
- Payslips (cleon.payslip) with computed lines, approval workflow
  and journal entry posting
- Role based security groups
    """,
    'author': 'Cleon',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'mail',
        'hr',
        'hr_contract',
        'hr_attendance',
        'hr_holidays',
        'hr_employee',
        'account',
        'portal',
    ],
    'data': [
        'security/cleon_payroll_security.xml',
        'security/ir.model.access.csv',
        'data/cleon_payroll_sequence.xml',
        'data/cleon_payroll_data.xml',
        'data/cleon_cron.xml',
        'views/cleon_location_views.xml',
        'views/cleon_payroll_category_views.xml',
        'views/cleon_payroll_rule_views.xml',
        'views/cleon_payroll_structure_views.xml',
        'views/cleon_payroll_cycle.xml',
        'views/cleon_payroll_setup.xml',
        'views/hr_contract_views.xml',
        'views/hr_employee_views.xml',
        'views/cleon_payslip_views.xml',
        'views/cleon_payslip_run_views.xml',
        'views/cleon_payroll_input_views.xml',
        # 'views/hr_grade.xml',
        'report/cleon_payslip_report.xml',
        'report/cleon_payslip_report_template.xml',
        'views/cleon_payroll_menus.xml',
        'views/resource_calendar.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'cleon_payroll/static/src/css/cleon_payroll.css',
            'cleon_payroll/static/src/components/kanban_sidebar.js',
            'cleon_payroll/static/src/components/kanbar_sidebar.xml',
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
}
