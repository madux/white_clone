# -*- coding: utf-8 -*-
{
    'name': 'CLEONHR Portal ',
    'version': '17.0.1.0.0',
    'category': 'CRM',
    'summary': 'White Clone Portal with Dashboard',
    'description': """
        White Cleon Portal for Odoo 17 
    """,
    'author': 'Custom',
    'depends': ['base', 'portal', 'website'],
    'data': [
        'views/menu_views.xml',
        # 'data/data.xml',
    ],
    'assets': {
        
    },
    'installable': True,
    'application': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
