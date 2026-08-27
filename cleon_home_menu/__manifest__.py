# -*- coding: utf-8 -*-
{
    'name': 'CleonHR Home Menu',
    'version': '17.0.5.3',
    'summary': 'Persistent CleonHR application launcher sidebar',
    'description': """
CleonHR Application Rail
========================
Displays the CleonHR application launcher permanently on the left side
of every Odoo 17 backend screen. The standard action area and CleonHR
module sidebars are offset so the launcher never covers page content.

Features
--------
- Always-visible compact application rail
- Dynamically loads all installed apps from the database
- Click any app to navigate to that module
- Keyboard shortcut: H focuses the launcher
- Responsive (mobile friendly)
- No dependency on  JS framework – pure jQuery
    """,
    'category': 'Technical',
    'author': 'Custom',
    'license': 'LGPL-3',
    'depends': ['web','base_addons'],
    'data': [
    ],
    'assets': {
        'web.assets_backend': [
            'cleon_home_menu/static/src/css/home_menu_overlay.css',
            'cleon_home_menu/static/src/js/home_menu_overlay.js',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
}
