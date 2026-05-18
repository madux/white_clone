# -*- coding: utf-8 -*-
{
    'name': 'CLEONHR SETUP',
    'version': '17.0.1.0.0',
    'category': 'Settings',
    'summary': 'Comprehensive Setup config for cleon HR ',
    'description': """
        =========================================
        
    """,
    'author': 'Maach Software',
    'website': '',
    'depends': [
        'base',
    ],
    'data': [
        'security/ir.model.access.csv',
        'views/cleon_setting.xml',
        'views/favicon.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'cleon_settings/static/src/js/override_title.js',
            'cleon_settings/static/src/xml/status_widget.xml',
            'cleon_settings/static/src/css/status_widget.scss',
            'cleon_settings/static/src/js/status_widget.js',
            # 'hr_insurance/static/src/css/hr_insurance.css',
            # 'hr_insurance/static/src/css/hmo_market_place.css',
            # 'hr_insurance/static/src/css/qms_css.css',
            # 'hr_insurance/static/src/css/qms_css.css',
            # # 'hr_administration/static/src/js/dashboard.js',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
}
