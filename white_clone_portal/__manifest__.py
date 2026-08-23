# -*- coding: utf-8 -*-
{
    'name': 'CLEONHR Portal ',
    'version': '17.0.2.0.0',
    'category': 'CRM',
    'summary': 'White Clone Portal with Dashboard',
    'description': """
        White Cleon Portal for App* 17 
    """,
    'author': 'Custom',
    'depends': [
        'base', 'portal', 'website', 'hr_administration',
        'hr_time_management', 'hr_leave_dashboard', 'cleon_home_menu',
    ],
    'data': [
        'views/menu_views.xml',
        # 'data/data.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'white_clone_portal/static/src/employee_portal.js',
            'white_clone_portal/static/src/employee_portal.xml',
            'white_clone_portal/static/src/employee_portal.css',
        ],
    },
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
