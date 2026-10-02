{
    "name": "Employee Portal - Time Integration",
    "version": "17.0.1.0.0",
    "depends": ["white_clone_portal", "hr_time_management"],
    "assets": {"web.assets_backend": [
        "white_clone_portal_time/static/src/portal_time.js",
        "white_clone_portal_time/static/src/portal_time.xml",
    ]},
    "auto_install": True,
    "installable": True,
    "license": "LGPL-3",
}
