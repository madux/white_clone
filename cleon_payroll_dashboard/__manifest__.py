# -*- coding: utf-8 -*-
{
    'name': 'Cleon Payroll Dashboard',
    'version': '17.0.1.0.0',
    'category': 'Human Resources/Payroll',
    'summary': 'Pink-themed payroll reporting dashboard (jQuery + Chart.js)',
    'description': """
Cleon Payroll Dashboard
========================
A standalone reporting dashboard for Cleon Payroll, served as a raw
HTML/CSS/jQuery page through a controller (no Odoo web assets/QWeb
client rendering involved), in the same spirit as an internal
'payroll-reporting' page.

- Sidebar navigation, each item swaps in its own report panel
- Offcanvas sidebar for mobile
- Accordion filters: Location (multi.branch, if installed), Department,
  Deduction Type, Payroll Structure, Date range
- KPI cards, line/bar/doughnut charts (Chart.js via CDN), responsive
  tables
- All data is pulled live from cleon_payroll (cleon.payslip,
  cleon.payslip.line, cleon.payslip.run, etc.) through JSON endpoints
    """,
    'author': 'Cleon',
    'license': 'LGPL-3',
    'depends': ['cleon_payroll', 'hr', 'cleon_home_menu'],
    'data': [
        'views/dashboard_menu.xml',
        'data/dashboard_demo_data.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'cleon_home_menu/static/src/js/home_menu_overlay.js',
            'cleon_home_menu/static/src/css/home_menu_overlay.css',
            'cleon_payroll_dashboard/static/src/js/payroll_dashboard.js',
            # 'cleon_payroll_dashboard/static/src/components/kanbar_sidebar.xml', 
            # 'cleon_payroll_dashboard/static/src/components/kanban_sidebar.js',   
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
}
