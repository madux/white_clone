# -*- coding: utf-8 -*-
{
    'name': 'CLEONHR Portal ',
    'version': '17.0.3.0.0',
    'category': 'CRM',
    'summary': 'White Clone Portal with Dashboard',
    'description': """
        White Cleon Portal for App* 17 
    """,
    'author': 'Custom',
    'depends': [
        'base', 'web', 'portal', 'website', 'cleon_home_menu',
    ],
    'data': [
        'views/menu_views.xml',
        # 'data/data.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'white_clone_portal/static/src/portal_registry.js',
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
