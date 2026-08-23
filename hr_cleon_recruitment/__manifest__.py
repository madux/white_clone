# -*- coding: utf-8 -*-
{
    'name': 'CleonHR Recruitment',
    'version': '17.0.1.0.0',
    'category': 'CleonHR-Recruitment',
    'summary': 'Manage Recruitment',
    'description': """
        Recruitment Management
        =================================
    """,
    'author': 'MaachSoftware',
    'depends': [
        'hr',
        'base_addons',
        'hr_recruitment', 
        'hr_cbt_portal_recruitment', 
        'ik_multi_branch',
        'survey',
        'hr_employee',
        # 'hr_employee'
        ],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        # 'data/hr_recruitment_data.xml',
        # 'data/config_parameter.xml',
        'views/job_form_view.xml',
        'views/hr_candidate_profile_form.xml',
        'views/hr_recruitment_views.xml',
        'views/candidate_create_wizard.xml',
        # Defines the creation form used by hr_recruitment_base below.
        'views/job_creation_process.xml',
        'views/hr_recruitment_base.xml',
        'views/hr_offer_wizard.xml',
        'wizard/survey_question.xml',
        # 'wizard/hr_confirm_wizard.xml',
        'views/hr_offer.xml',
        'views/talent_mobility.xml',
        # 'views/job_create_wizard.xml',
        'data/mail_templates.xml',
        'views/menu.xml',

    ],
    'assets': {
        'web.assets_backend': [
            'https://unpkg.com/lucide@latest',
            # 'hr_cleon_recruitment/static/src/component/**/*',
            "hr_cleon_recruitment/static/src/js/job_tab_controller.js",
            "hr_cleon_recruitment/static/src/xml/job_tabs.xml",
            # "hr_cleon_recruitment/static/src/xml/job_view_controller.xml",
            'hr_cleon_recruitment/static/src/component/list_view_template.scss',
            'hr_cleon_recruitment/static/src/component/list_view_template.xml',
            'hr_cleon_recruitment/static/src/component/list_view_template.js',
            'hr_cleon_recruitment/static/src/css/candidate_wizard.css',
            'hr_cleon_recruitment/static/src/css/offer.css',
            'hr_cleon_recruitment/static/src/component/candidate_css.scss',
            'hr_cleon_recruitment/static/src/component/offer.scss',
            'hr_cleon_recruitment/static/src/component/form_view_template.js',
            'hr_cleon_recruitment/static/src/component/form_view_template.xml',
            # 'hr_cleon_recruitment/static/src/component/talent_widget.js',
            # 'hr_cleon_recruitment/static/src/component/talent_mobility.scss',
            'hr_cleon_recruitment/static/src/css/talent_mobility.scss',
            'hr_cleon_recruitment/static/src/css/job_views.scss',
        ],
    },
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
