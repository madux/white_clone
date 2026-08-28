# -*- coding: utf-8 -*-
{
    'name': 'CLEONHR Staff Directory',
    'version': '17.0.1.0.3',
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
        'data/hr_work_location_cron.xml',
        'security/ir.model.access.csv',
        'security/segment_rules.xml',
    ],
    'assets': {
        'web.assets_backend': [
            '/web/static/lib/Chart/Chart.js',
            'hr_staff_directory/static/src/js/staff_directory_dashboard.js',
            'hr_staff_directory/static/src/css/staff_directory.css',
            'hr_staff_directory/static/src/xml/staff_directory_dashboard.xml',

            'hr_staff_directory/static/src/components/toast/toast.css',
            'hr_staff_directory/static/src/components/toast/toast.js',
            'hr_staff_directory/static/src/components/toast/toast.xml',

            'hr_staff_directory/static/src/components/message/message.css',
            'hr_staff_directory/static/src/components/message/message.js',
            'hr_staff_directory/static/src/components/message/message.xml',

            'hr_staff_directory/static/src/components/people_list/people_list.css',

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
            
            'hr_staff_directory/static/src/components/profile_panel/profile_panel.css',
            'hr_staff_directory/static/src/components/profile_panel/profile_panel.js',
            'hr_staff_directory/static/src/components/profile_panel/profile_panel.xml',
            
            'hr_staff_directory/static/src/components/geographic_map/geographic_map.js',
            'hr_staff_directory/static/src/components/geographic_map/geographic_map.css',
            'hr_staff_directory/static/src/components/geographic_map/geographic_map.xml',

            'hr_staff_directory/static/src/components/relationship_graph/relationship_graph.js',
            'hr_staff_directory/static/src/components/relationship_graph/relationship_graph.css',
            'hr_staff_directory/static/src/components/relationship_graph/relationship_graph.xml',

            'hr_staff_directory/static/src/components/org_analysis/org_analysis.js',
            'hr_staff_directory/static/src/components/org_analysis/org_analysis.css',
            'hr_staff_directory/static/src/components/org_analysis/org_analysis.xml',
        ],
    },
    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
    'post_init_hook': 'post_init_hook',
}
