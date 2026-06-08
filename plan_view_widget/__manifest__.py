{
    'name': 'Plan View Widget',
    'version': '17.0.1.0.0',
    'category': 'Technical',
    'summary': 'A custom plan/iframe view type that renders a local HTML route inside Odoo',
    'author': 'Custom',
    'depends': ['web'],
    'data': [
        'security/ir.model.access.csv',
        'views/plan_page_template.xml',
        'views/plan_view_demo.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'plan_view_widget/static/src/css/plan_view.css',
            'plan_view_widget/static/src/xml/plan_view.xml',
            'plan_view_widget/static/src/js/plan_view.js',
        ],
    },
    'installable': True,
    'application': False,
    'license': 'LGPL-3',
}
