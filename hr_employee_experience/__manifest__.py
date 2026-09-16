{
    'name': 'CLEONHR Employee Experience',
    'version': '17.0.1.0.0',
    'category': 'CleonHR-HR ADMIN',
    'depends': ['hr_company_calendar', 'hr_administration', 'hr_employee'],
    'data': [
        # 'security/security.xml',
        'security/ir.model.access.csv',
        # 'data/sequence_data.xml',
        'views/action.xml',
        'views/dashboard.xml',
        'views/experience_recognition.xml',
        'views/experience_message.xml',
        'views/experience_knowledge.xml',
        'views/video_watched.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'hr_employee_experience/static/src/css/style.css',
            'hr_employee_experience/static/src/css/qms_css.css',

            # 'hr_employee_experience/static/src/xml/admin_sidebar.xml',
            # 'hr_employee_experience/static/src/js/admin_sidebar.js',



        ],
    },
    'license': 'LGPL-3',
}
