# -*- coding: utf-8 -*-
{
    'name': 'CLEONHR Staff Directory',
    'version': '17.0.1.0.0',
    'category': 'CleonHR-HR ADMIN',
    'summary': 'Comprehensive Staff Directory Dashboard with workforce analytics',
    'description': """
        Staff Directory Dashboard for CleonHR
        ======================================
        - Real-time Staff KPI Metrics
        - Headcount Growth Trend (area chart)
        - Department Distribution (horizontal bar chart)
        - Employment Type & Gender distribution (donut charts)
        - Recent Activities, Upcoming Birthdays, Work Anniversaries
        - Compliance Status, Training Progress, Work Location
        - Probation Periods & Contract Renewals
        - Performance Ratings & Skills Overview
        - Diversity & Inclusion Metrics
    """,
    'author': 'CleonHR',
    'website': '',
    'depends': [
        'base',
        'hr',
        'hr_holidays',
        'hr_contract',
        'mail',
        'hr_administration',
    ],
    'data': [
        'views/staff_directory_actions.xml',
        'views/menu.xml',
    ],
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
}
