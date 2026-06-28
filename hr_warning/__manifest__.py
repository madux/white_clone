# -*- coding: utf-8 -*-
{
    'name': 'CleonHR Incident Mgt',
    'version': '17.0.1.0.0',
    'category': 'CleonHR-HR ADMIN',
    'summary': 'Manage employee incidents, warnings, and disciplinary cases',
    'description': """
        HR Warning & Incident Management
        =================================
        - Create and track employee incidents / warnings
        - Configurable incident stages with per-stage approvers
        - Configurable case types
        - Email notifications at each stage transition
        - Full audit trail via chatter
    """,
    'author': 'Your Company',
    'depends': ['hr', 'mail', 'hr_administration', 'ik_multi_branch', 'hr_company_calendar', 'cleon_settings'],
    'data': [
        'security/hr_warning_security.xml',
        'security/ir.model.access.csv',
        'data/hr_warning_stage_data.xml',
        'data/hr_warning_policy_data.xml',
        'data/hr_warning_data.xml',
        'data/case_type_data.xml',
        'data/hr_warning_mail_template.xml',
        'views/hr_warning_case_type_views.xml',
        'views/hr_warning_stage_views.xml',
        'views/hr_warning_views.xml',
        'views/hr_warning_dialog_views.xml',
        'views/hr_warning_appeal_tree.xml',
        'views/hr_interim_measure.xml',
        'views/hr_policy.xml',
        'views/hr_warning_menus.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'hr_warning/static/src/css/hr_warning.css',
            'hr_warning/static/src/xml/list_dropdown_action.xml',
            'hr_warning/static/src/js/list_dropdown_action.js',
            # 'hr_warning/static/src/js/form_controller.js',
            'hr_warning/static/src/component/**/*',
            'hr_warning/static/src/component/list_view_template.scss',
            'hr_warning/static/src/component/list_view_template.xml',
            'hr_warning/static/src/component/overwrite_template.xml',
            'hr_warning/static/src/component/list_view_template.js',
        ],
    },
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
