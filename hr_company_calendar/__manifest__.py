# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

{
    'name': 'CLEON COMPANY CALENDAR',
    'version': '1.6',
    'category': 'Human Resources/Time Off',
    'sequence': 85,
    'summary': 'Allocate PTOs and follow leaves requests',
    'description': """
Manage time off requests and allocations
=====================================

This application controls 
A synchronization with an internal agenda (Meetings of the CRM module) is also possible in order to automatically create a meeting when a time off request is accepted by setting up a type of meeting in time off Type.
""",
    'depends': ['hr', 'calendar', 'resource'],
    'data': [
    ],
     
    'installable': True,
    'application': True,
    'assets': {
        'web.assets_backend': [
            'hr_company_calendar/static/src/**/*',
            "hr_company_calendar/static/src/views/calendar/calendar_controller.xml",
            "hr_company_calendar/static/src/views/calendar/calendar_controller.js",
            "hr_company_calendar/static/src/views/calendar/calendar_controller.scss",
            # 'hr_company_calendar/static/src/views/calendar/calendar_controller.xml',
            # Don't include dark mode files in light mode
            # ('remove', 'hr_holidays/static/src/**/*.dark.scss'),
        ],
       
        # "web.assets_web_dark": [
        #     'hr_holidays/static/src/**/*.dark.scss',
        # ],
        # 'web.tests_assets': [
        #     'hr_holidays/static/tests/helpers/**/*',
        # ],
        # 'web.qunit_suite_tests': [
        #     'hr_holidays/static/tests/**/*.js',
        #     ('remove', 'hr_holidays/static/tests/tours/**/*'),
        #     ('remove', 'hr_holidays/static/tests/helpers/**/*'),
        # ],
        # 'web.assets_tests': [
        #     '/hr_holidays/static/tests/tours/**/*'
        # ],
    },
    # 'post_init_hook': '_hr_holiday_post_init',
    'license': 'LGPL-3',
}
