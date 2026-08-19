# -*- coding: utf-8 -*-
{
    'name': "CLEON DOCUMENT MANAGEMENT",
    'version': '2.0',
    'category': 'CleonHR Document Management',
    "sequence":-1,
    'summary': 'CLEON DOCUMENT MANAGEMENT',
    'depends': ['base','hr', 'hr_administration'], 
    'author': 'Chris Maduka [MAACH SOFTWARE]',
    'data': [ 
        # 'views/document_view.xml',
        'views/menu.xml',
        # 'data/ir_sequence_data.xml',
        'security/ir.model.access.csv', 
    ],
    'assets': {
        
        'web.assets_backend': [
            'https://cdn.jsdelivr.net/npm/chart.js',
             
        ],
    },

    'installable': True,
    'auto_install': True,
    'application': False,
    'license': 'LGPL-3',
}
