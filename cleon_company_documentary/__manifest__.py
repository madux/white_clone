# -*- coding: utf-8 -*-
{
    "name": "CLEON Company Documentary",
    "version": "17.0.1.0.8",
    "category": "Human Resources",
    "summary": "Secure company video library, streaming, and training compliance",
    "depends": ["base", "hr", "hr_employee", "cleon_document_management"],
    "author": "Chris Maduka [MAACH SOFTWARE]",
    "data": [
        "security/security_groups.xml",
        "security/ir.model.access.csv",
        "security/record_rules.xml",
        "data/cleanup.xml",
        "data/documentary_r2_config.xml",
        "data/documentary_cron.xml",
        "views/company_documentary_views.xml",
        "views/menu.xml",
    ],
    "installable": True,
    "application": True,
    "license": "LGPL-3",
    "post_init_hook": "post_init_hook",
}
