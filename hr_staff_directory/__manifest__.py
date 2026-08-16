# -*- coding: utf-8 -*-
{
    'name': 'CLEONHR Staff Directory',
    'version': '17.0.1.0.2',
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
        'hr_skills',
        'mail',
        'web',
        'hr_administration',
    ],
    'data': [
        'views/assets.xml',
        'views/staff_directory_actions.xml',
        'views/menu.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'hr_staff_directory/static/src/js/staff_directory_dashboard.js',
            'hr_staff_directory/static/src/css/staff_directory.css',
            'hr_staff_directory/static/src/xml/staff_directory_dashboard.xml',
            
            'hr_staff_directory/static/src/components/bar_chart/bar_chart.js',
            'hr_staff_directory/static/src/components/bar_chart/bar_chart.css',
            'hr_staff_directory/static/src/components/bar_chart/bar_chart.xml',
            
            'hr_staff_directory/static/src/components/heatmap/heatmap.js',
            'hr_staff_directory/static/src/components/heatmap/heatmap.css',
            'hr_staff_directory/static/src/components/heatmap/heatmap.xml',
            
            'hr_staff_directory/static/src/components/org_chart/org_chart.js',
            'hr_staff_directory/static/src/components/org_chart/org_chart.css',
            'hr_staff_directory/static/src/components/org_chart/org_chart.xml',
            
            'hr_staff_directory/static/src/components/people_list/people_list.js',
            'hr_staff_directory/static/src/components/people_list/people_list.xml',
            
            'hr_staff_directory/static/src/components/profile_panel/profile_panel.js',
            'hr_staff_directory/static/src/components/profile_panel/profile_panel.xml',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
}
