{
    "name": "CleonHR Time Management Foundation",
    "version": "17.0.2.0.1",
    "category": "CleonHR-HR ADMIN",
    "summary": "Shared time rules, calculation engine, permissions, approvals and audit",
    "depends": [
        "cleon_approval",
        "hr_administration",
        "hr_employee",
        "mail",
        "web",
    ],
    "data": [
        "data/data.xml",
        "security/security.xml",
        "security/ir.model.access.csv",
        "views/time_management_action.xml",
        "views/menu.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "hr_time_management/static/src/interface_switcher.js",
            "hr_time_management/static/src/interface_switcher.xml",
            "hr_time_management/static/src/interface_switcher.css",
            "hr_time_management/static/src/time_management.js",
            "hr_time_management/static/src/time_management.xml",
            "hr_time_management/static/src/time_management.css",
            "hr_time_management/static/src/overtime.css",
        ],
    },
    "installable": True,
    "application": False,
    "license": "LGPL-3",
}
