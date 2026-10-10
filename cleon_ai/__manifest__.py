# -*- coding: utf-8 -*-
{
    'name': 'Cleon AI',
    'version': '17.0.1.1.8',
    'category': 'Human Resources/Tools',
    'summary': 'Permission-aware Cleon AI Gateway and Global Assistant Shell',
    'author': 'CleonHR',
    'website': 'https://www.cleonhr.com',
    'license': 'LGPL-3',
    'depends': [
        'base',
        'web',
    ],
    'data': [
        'security/ir.model.access.csv',
        'data/ai_provider_parameters.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'cleon_ai/static/src/js/markdown.js',
            'cleon_ai/static/src/js/fullscreen_catalog.js',
            'cleon_ai/static/src/components/ai_assistant/ai_assistant.css',
            'cleon_ai/static/src/components/ai_assistant/ai_assistant.js',
            'cleon_ai/static/src/components/ai_assistant/ai_assistant.xml',
            'cleon_ai/static/src/components/ai_fullscreen/ai_fullscreen.css',
            'cleon_ai/static/src/components/ai_fullscreen/ai_fullscreen.js',
            'cleon_ai/static/src/components/ai_fullscreen/ai_fullscreen.xml',
        ],
    },
    'installable': True,
    'application': False,
    'auto_install': False,
}
