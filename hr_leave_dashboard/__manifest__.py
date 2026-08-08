{
    'name': 'CLEONHR Leave',
    'version': '17.0.1.0.0',
    'category': 'CleonHR-HR ADMIN',
    'depends': ['hr_holidays', 'web', 'hr_company_calendar', 'hr_administration'],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        'views/dashboard_action.xml',
        'views/leave_base.xml',
        'views/menu.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'hr_leave_dashboard/static/src/js/dashboard.js',
            'hr_leave_dashboard/static/src/css/dashboard.css',
            'hr_leave_dashboard/static/src/xml/dashboard.xml',
            'hr_leave_dashboard/static/src/js/leave_requests.js',
            'hr_leave_dashboard/static/src/css/leave_requests.css',
            'hr_leave_dashboard/static/src/xml/leave_requests.xml',
            'hr_leave_dashboard/static/src/components/calendar_sidebar.xml',
            'hr_leave_dashboard/static/src/components/calendar_sidebar.js',
        ],
    },
    'license': 'LGPL-3',
}
