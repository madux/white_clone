# -*- coding: utf-8 -*-
{
    'name': 'CLEONHR Employee Directory',
    'version': '17.0.1.0.0',
    'category': 'Human Resources',
    'summary': 'Manage employee incidents, warnings, and disciplinary cases',
    'description': """
        Employee Directory & Management
        =================================
        - Create and track employee incidents / warnings
        - Configurable incident stages with per-stage approvers
        - Configurable case types
        - Email notifications at each stage transition
        - Full audit trail via chatter
    """,
    'author': 'MAACH SOFTWARE',
    'depends': [
        'hr', 
        'mail', 
        'hr_administration', 
        'ik_multi_branch', 
        'hr_company_calendar', 
        'cleon_settings', 
        'hr_contract', 
        'hr_attendance',
        'hr_recruitment',
        'hr_warning'
        ],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        # 'data/hr_warning_stage_data.xml',
        # 'data/hr_warning_policy_data.xml',
        'data/mail_template.xml',
        # 'data/case_type_data.xml',
        # 'data/hr_warning_mail_template.xml',
        'views/hr_employee_form_view.xml',
        'views/hr_employee_view.xml',
        'views/hr_announcement.xml',
        # 'views/hr_warning_views.xml',
        # 'views/hr_warning_dialog_views.xml',
        # 'views/hr_warning_appeal_tree.xml',
        # 'views/hr_interim_measure.xml',
        # 'views/hr_policy.xml',
        # 'views/hr_warning_menus.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'hr_employee/static/src/css/hr_employee.css',
            'hr_employee/static/src/css/hr_employee_form.css',
            # 'hr_warning/static/src/xml/list_dropdown_action.xml',
            # 'hr_warning/static/src/js/list_dropdown_action.js',
            # 'hr_warning/static/src/component/**/*',
            # 'hr_warning/static/src/component/kanban_view_template.scss',
            'hr_employee/static/src/component/kanban_view_template.xml',
            'hr_employee/static/src/component/mail_discuss_template.xml',
            'hr_employee/static/src/component/mail_discuss_template.js',
            'hr_employee/static/src/component/kanban_view_template.js',

            # 'hr_warning/static/src/component/overwrite_template.xml',
        ],
    },
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
