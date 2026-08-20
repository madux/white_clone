# -*- coding: utf-8 -*-
{
    "name": "CleonHR Workflows & Approvals Core",
    "summary": "Shared multi-level approval engine, SLA escalations, and activity tracking for CleonHR",
    "version": "17.0.1.0.0",
    "category": "Human Resources",
    "author": "CleonHR Team",
    "license": "LGPL-3",
    "depends": [
        "base",
        "mail",
        "hr",
        "hr_administration",
    ],
    "data": [
        "security/approval_security.xml",
        "security/ir.model.access.csv",
        "data/ir_cron_data.xml",
        "views/approval_views.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "cleon_approval/static/src/workflows_app.js",
            "cleon_approval/static/src/workflows_app.xml",
            "cleon_approval/static/src/workflows_app.css",
        ],
    },
    "installable": True,
    "application": False,
    "auto_install": False,
}
