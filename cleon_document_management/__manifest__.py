# -*- coding: utf-8 -*-
{
    "name": "CLEON DOCUMENT MANAGEMENT",
    "version": "17.0.1.12.0",
    "category": "CleonHR Document Management",
    "sequence": -1,
    "summary": "CLEON DOCUMENT MANAGEMENT",
    "depends": ["base", "mail", "hr", "hr_administration", "hr_employee"],
    "author": "Chris Maduka [MAACH SOFTWARE]",
    "data": [
        "security/security_groups.xml",
        "security/ir.model.access.csv",
        "security/record_rules.xml",
        "views/document_view.xml",
        "views/compliance_views.xml",
        "views/menu.xml",
        "views/intelligence_views.xml",
        "data/compliance_cron.xml",
        "data/compliance_data.xml",
        "data/recycle_origin_backfill.xml",
        "data/intelligence_data.xml",
        "data/intelligence_cron.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "https://cdn.jsdelivr.net/npm/chart.js",
        ],
    },
    "installable": True,
    "auto_install": True,
    "application": False,
    "license": "LGPL-3",
    "post_init_hook": "post_init_hook",
}
