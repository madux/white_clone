{
    'name': 'CLEONHR Leave',
    'version': '17.0.1.0.0',
    'category': 'CleonHR-HR ADMIN',
    'depends': ['hr_holidays', 'web', 'hr_company_calendar', 'hr_administration'],
    'data': [
        'views/dashboard_action.xml',
        'views/leave_base.xml',
        'views/menu.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'hr_leave_dashboard/static/src/js/dashboard.js',
            'hr_leave_dashboard/static/src/css/dashboard.css',
            'hr_leave_dashboard/static/src/xml/dashboard.xml',
            'hr_leave_dashboard/static/src/components/calendar_sidebar.xml',
            'hr_leave_dashboard/static/src/components/calendar_sidebar.js',

            
        ],
    },
    'license': 'LGPL-3',
}