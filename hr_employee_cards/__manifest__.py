{
    "name": "White HR Employee Cards",
    "version": "17.0.1.0.0",
    "summary": "Glassy htmx employee directory at /hr-employee",
    "description": """
        Renders hr.employee records as a glassy, neon-accented card grid
        at the /hr-employee route, using htmx for search and pagination
        without a page reload and without any custom JS framework.
    """,
    "category": "Human Resources",
    "author": "Your Company",
    "depends": ["hr"],
    "data": [
        "views/templates.xml",
    ],
    'assets': {
            'web.assets_frontend': [
                'hr_employee_cards/static/src/css/employee_cards.css',
                
    
            ],
    },
    "installable": True,
    "application": False,
    "license": "LGPL-3",
}
