# -*- coding: utf-8 -*-
{
    "name": "HR Pre-Onboarding",
    "version": "17.0.1.0.0",
    "summary": "Track candidates from offer acceptance through document "
                "collection to conversion into employees.",
    "category": "Human Resources",
    "depends": ["hr", "hr_recruitment", "mail", "web"],
    "data": [
        "security/ir.model.access.csv",
        "data/mail_template_data.xml",
        "views/hr_preonboarding_views.xml",
        "views/offer_document_views.xml",
        "views/offer_document_templates.xml",
    ],
    "installable": True,
    "application": True,
    "license": "LGPL-3",
}
