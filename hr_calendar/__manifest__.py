# -*- coding: utf-8 -*-
{
    'name': 'CLEONHR COMPANY CALENDER',
    'version': '17.0.1.0.0',
    'category': 'Settings',
    'summary': 'Comprehensive Setup config for cleon HR Company Calendar',
    'author': 'Maach Software',
    'website': '',
    'depends': [
        'base',
        'web',
    ],
    'assets': {
        'web.assets_backend': [
            # 'hr_calendar/static/src/js/calendar_header_button.js',
            # 'hr_calendar/static/src/xml/calendar_header_button.xml',
            # 'hr_calendar/static/src/xml/calendar_header_button.xml',
            'hr_calendar/static/src/**/*'
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
}