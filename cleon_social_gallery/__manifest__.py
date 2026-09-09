# -*- coding: utf-8 -*-
{
    "name": "CLEON Social Gallery",
    "version": "17.0.1.0.0",
    "category": "Human Resources",
    "summary": "Corporate photo albums, social feed, and culture engagement",
    "depends": ["base", "hr", "hr_employee", "mail", "cleon_document_management"],
    "author": "Chris Maduka [MAACH SOFTWARE]",
    "data": [
        "security/security_groups.xml",
        "security/ir.model.access.csv",
        "security/record_rules.xml",
        "data/social_gallery_r2_config.xml",
        "data/social_gallery_cron.xml",
        "views/social_gallery_views.xml",
        "views/menu.xml",
    ],
    "installable": True,
    "application": True,
    "license": "LGPL-3",
    "post_init_hook": "post_init_hook",
}
