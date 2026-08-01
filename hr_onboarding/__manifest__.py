# -*- coding: utf-8 -*-
{
    "name": "HR Onboarding Dashboard",
    "version": "17.0.1.0.0",
    "summary": "Onboarding dashboard, new-joiner intake form, and probation "
                "tracking built on core Odoo HR models.",
    "category": "Human Resources",
    "depends": ["hr", "hr_contract", "mail", "web"],
    "data": [
        "security/ir.model.access.csv",
        "data/ir_sequence_data.xml",
        "views/hr_onboarding_backend_views.xml",
        "views/hr_onboarding_templates.xml",
        "views/hr_onboarding_wizard_template.xml",
        "views/hr_probation_templates.xml",
    ],
    "installable": True,
    "application": True,
    "license": "LGPL-3",
}
