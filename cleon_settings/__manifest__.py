# -*- coding: utf-8 -*-
{
    'name': 'CLEONHR SETUP',
    'version': '17.0.1.5.1',
    'category': 'Settings',
    'summary': 'Comprehensive Setup config for cleon HR ',
    'description': 'Comprehensive Setup config for Cleon HR',
    'author': 'Maach Software',
    'website': '',
    # Do not depend on hr_employee (fragile if its own deps are missing).
    # Do not load homepage.xml (nested website.layout hangs installs).
    'depends': ['base', 'hr', 'base_addons', 'cleon_license'],
    'data': [
        'security/ir.model.access.csv',
        'views/cleon_setting.xml',
        'views/cleon_login.xml',
    ],
    'assets': {
        # Login page uses website/frontend layout → frontend assets
        'web.assets_frontend': [
            'cleon_settings/static/src/css/cleon_login.css',
            'cleon_settings/static/src/js/cleon_login.js',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
}
