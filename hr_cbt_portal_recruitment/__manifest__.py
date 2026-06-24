# -*- coding: utf-8 -*-
{
    'name': "CLEONHR CBT Recruitment ",

    'summary': """
        Extend the default hr recruitment module from Odoo with EEDC specific requirements""",

    'description': """
        Extend the default hr recruitment module from Odoo with EEDC specific requirements
    """,

    'author': "MAACHSOFTWARE Ltd.",
    'license': 'LGPL-3',
    'category': 'Uncategorized',
    'sequence': 10,
    'version': '0.1',

    'depends': [
        'base',
        'hr_recruitment',
        'hr_recruitment_survey',
        'website_hr_recruitment',
        'survey'
        # 'eedc_addons',
        # 'hr_recruitment_sign',
    ],

    'data': [
        # 'data/data.xml',
        'security/security_view.xml',
        'security/ir.model.access.csv',
        'views/menu_inheritance.xml',
        'views/hr_job_views.xml',
        'views/hr_applicant_view.xml',
        'views/hr_applicant_pool.xml',
        'views/career.xml',
        'static/src/xml/website_hr_recruitment_templates.xml',
        'static/src/xml/hr_documentation_request.xml',
        'static/templates/hr_applicant_pool_form_template.xml',
        'views/hr_employee.xml',
        'views/hr_recruitment_request.xml',
        'views/hr_recruitment_stage_inherit.xml',
        'data/hr_recruitment_data.xml',
        'views/hr_documentation_view.xml',
        'views/survey_template_inherited_view.xml',
        # 'views/company_memo_inherit.xml',
        'views/survey_survey_views_inherited.xml',
        'wizard/survey_invite_inherit.xml',
        
        'wizard/hr_move_applicant.xml',
        'wizard/cbt_schedule_wizard_view.xml',
        'views/survey_templates.xml',

        'wizard/applicant_checklist_wizard.xml',
        'wizard/hr_confirmation_wizard.xml',
        'wizard/import_applicant_view.xml',
        'wizard/hr_recruitment_sign_view.xml',
        'wizard/score_sheet_export.xml',
        'wizard/applicant_send_mail_views_inherit.xml',
        # 'security/security_view.xml',
        'security/ir_rule.xml',
        'data/mail_template_data.xml',
        'data/survey_email.xml',
        'views/preloader.xml',
        'data/documentation_data.xml',
        'data/ir_config_parameter.xml'

    ],
    'assets': {
        'web.assets_frontend': [
        '/hr_cbt_portal_recruitment/static/src/js/recruitment_apply_form.js',
        '/hr_cbt_portal_recruitment/static/src/js/documentation_request.js',
        '/hr_cbt_portal_recruitment/static/src/css/hr_applicant_pool_form_templates.css',
        '/hr_cbt_portal_recruitment/static/src/js/hr_applicant_pool_form_templates.js',
    ]},
    'qweb': [
        # 'static/src/xml/custom_template.xml',
        # 'static/src/xml/website_hr_recruitment_templates.xml'
    ]
}
