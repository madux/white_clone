# -*- coding: utf-8 -*-
{
    'name': 'Cleon AI',
    'version': '17.0.1.0.0',
    'category': 'Human Resources/Tools',
    'summary': 'Permission-aware Cleon AI Gateway and Global Assistant Shell',
    'author': 'CleonHR',
    'website': 'https://www.cleonhr.com',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'web',
    ],
    'data': [],
    'assets': {
        'web.assets_backend': [
            'cleon_ai/static/src/components/ai_assistant/ai_assistant.css',
            'cleon_ai/static/src/components/ai_assistant/ai_assistant.js',
            'cleon_ai/static/src/components/ai_assistant/ai_assistant.xml',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
}
