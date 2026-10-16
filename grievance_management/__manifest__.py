{
    'name': 'Grievance Management',
    'version': '17.0.1.0.0',
    'category': 'Human Resources',
    'summary': 'Employee Grievance Case Management, Escalation & Resolution Workflow',
    'description': """
Grievance Management
=====================
Track, investigate, escalate and resolve employee grievance cases.

Features
--------
* Configurable Grievance Types & Categories
* Kanban workflow (Submitted > Under Review > Investigation In Progress > Resolved > Closed)
* Automatic escalation rules (overdue cases, severe cases)
* Resolution definitions with dynamic required fields (compensation, follow-up, restorative action)
* Dashboard (stat cards, monthly trend, breakdown by type)
* Case list with priority, handler, days-open tracking
""",
    'author': 'Custom Development',
    'license': 'LGPL-3',
    'depends': ['base', 'mail', 'hr'],
    'data': [
        'security/grievance_security.xml',
        'security/ir.model.access.csv',
        'data/grievance_sequence.xml',
        'data/grievance_stage_data.xml',
        'data/grievance_category_data.xml',
        'data/grievance_type_data.xml',
        'data/grievance_resolution_data.xml',
        'data/grievance_cron_data.xml',
        'views/grievance_case_views.xml',
        'views/grievance_stage_views.xml',
        'views/grievance_category_views.xml',
        'views/grievance_type_views.xml',
        'views/grievance_escalation_views.xml',
        'views/grievance_resolution_views.xml',
        'views/grievance_dashboard_views.xml',
        'views/grievance_menus.xml',
    ],
    'installable': True,
    'application': True,
    'assets': {
        'web.assets_backend': [
            'grievance_management/static/src/scss/grievance_dashboard.scss',
            'grievance_management/static/src/js/grievance_dashboard.js',
            'grievance_management/static/src/xml/grievance_dashboard.xml',
            'grievance_management/static/src/js/list_view_template.js',
            'grievance_management/static/src/js/list_view_template.xml'
        ],
    },
}
