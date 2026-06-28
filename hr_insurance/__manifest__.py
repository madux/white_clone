# -*- coding: utf-8 -*-
{
    'name': 'CLEONHR Insurance (HMO)',
    'version': '17.0.1.0.0',
    'category': 'CleonHR-HR ADMIN',
    'summary': 'Comprehensive HR Administration Dashboard with analytics and workforce management',
    'description': """
        HR Insurance HMO for App* 17
        =========================================
        - Real-time HR Key Metrics
        - Workforce Analytics with Highcharts
        - Department Distribution
        - Leave Utilization by Department
        - Requires Attention Panel
        - Upcoming Events
        - Full integration with App* HR models
    """,
    'author': 'Maach Soft',
    'website': '',
    'depends': [
        'base',
        'hr',
        'cleon_settings',
        # 'hr_contract',
        # 'hr_attendance',
        # 'mail',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/hmo_checklist.xml',
        'data/hmo_setting_data.xml',
        'sequence/sequence.xml',
        'views/hmo_market_place.xml',
        'views/hr_insurance.xml',
        'views/hospital.xml',
        'views/hmo_enrollment.xml',
        'views/hmo_checklist.xml',
        'views/hmo_setting.xml',
        'views/menu.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'hr_insurance/static/src/css/hr_insurance.css',
            'hr_insurance/static/src/css/hmo_market_place.css',
            'hr_insurance/static/src/css/qms_css.css',
            'hr_insurance/static/src/css/qms_css.css',
            # 'hr_administration/static/src/js/dashboard.js',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': True,
    'license': 'LGPL-3',
}
