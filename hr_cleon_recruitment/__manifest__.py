# -*- coding: utf-8 -*-
{
    'name': 'CleonHR Recruitment Management',
    'version': '17.0.1.0.0',
    'category': 'Recruitment',
    'summary': 'Manage Recruitment',
    'description': """
        Recruitment Management
        =================================
    """,
    'author': 'MaachSoftware',
    'depends': [
        'hr', 
        'hr_recruitment', 
        'hr_cbt_portal_recruitment', 
        # 'hr_employee'
        ],
    'data': [
        'security/security.xml',
        'security/ir.model.access.csv',
        # 'data/hr_recruitment_data.xml',
        # 'data/config_parameter.xml',
        'views/hr_recruitment_views.xml',
        'views/candidate_create_wizard.xml',
        'views/hr_recruitment_base.xml',
        'views/hr_offer_wizard.xml',
        # 'wizard/hr_confirm_wizard.xml',
        'views/hr_offer.xml',
        'views/talent_mobility.xml',
        # 'data/mail_templates.xml',
    ],
    'assets': {
        'web.assets_backend': [
            # 'hr_cleon_recruitment/static/src/component/**/*',
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
        ],
    },
    'installable': True,
    'application': True,
    'license': 'LGPL-3',
}
