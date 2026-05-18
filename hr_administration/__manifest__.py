# -*- coding: utf-8 -*-
{
    'name': 'CLEONHR Administration Dashboard',
    'version': '17.0.1.0.0',
    'category': 'Human Resources',
    'summary': 'Comprehensive HR Administration Dashboard with analytics and workforce management',
    'description': """
        HR Administration Dashboard for Odoo 17
        =========================================
        - Real-time HR Key Metrics
        - Workforce Analytics with Highcharts
        - Department Distribution
        - Leave Utilization by Department
        - Requires Attention Panel
        - Upcoming Events
        - Full integration with Odoo HR models
    """,
    'author': 'HR Administration',
    'website': '',
    'depends': [
        'base',
        'hr',
        'hr_holidays',
        'hr_contract',
        'hr_attendance',
        'mail',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/hr_administration_menu.xml',
    ],
    # 'assets': {
    #     'web.assets_backend': [
    #         'hr_administration/static/src/css/dashboard.css',
    #         # 'hr_administration/static/src/js/dashboard.js',
    #     ],
    # },
    'installable': True,
    'auto_install': False,
    'application': True,
    'license': 'LGPL-3',
}
