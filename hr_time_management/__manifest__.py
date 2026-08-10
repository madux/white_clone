{
    "name": "CLEONHR Time Management",
    "version": "17.0.1.0.0",
    "category": "CleonHR-HR ADMIN",
    "summary": "Attendance, shifts, overtime and timesheet management",
    "depends": [
        "hr_attendance",
        "hr_holidays",
        "hr_timesheet",
        "hr_administration",
        "hr_employee",
        "mail",
        "web",
    ],
    "data": [
        "security/security.xml",
        "security/ir.model.access.csv",
        "views/time_management_action.xml",
        "views/menu.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "hr_time_management/static/src/time_management.js",
            "hr_time_management/static/src/time_management.xml",
            "hr_time_management/static/src/time_management.css",
        ],
    },
    "installable": True,
    "application": True,
    "license": "LGPL-3",
}
