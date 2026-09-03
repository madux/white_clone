# -*- coding: utf-8 -*-
{
    "name": "CLEON DOCUMENT MANAGEMENT",
    "version": "17.0.1.0.0",
    "category": "CleonHR Document Management",
    "sequence": -1,
    "summary": "CLEON DOCUMENT MANAGEMENT",
    "depends": ["base", "mail", "hr", "hr_administration", "hr_employee"],
    "author": "Chris Maduka [MAACH SOFTWARE]",
    "data": [
        "security/security_groups.xml",
        "security/ir.model.access.csv",
        "views/document_view.xml",
        "views/compliance_views.xml",
        "views/menu.xml",
        "data/compliance_cron.xml",
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
}
