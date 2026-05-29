{
    'name': 'Calendar Field Widget',
    'version': '17.0.1.0.0',
    'category': 'Technical',
    'summary': 'Inline full calendar widget for date/datetime fields',
    'description': """
        Adds a custom field widget `calendar_field_widget` that renders a full
        interactive monthly calendar inside any Odoo 17 form view field.
        - Navigate months (prev / next / today)
        - Select a date – updates the field value
        - Double-click a day to create a calendar.event on that day
        - Shows coloured event dots fetched from calendar.event
        - "Open Calendar" button jumps to the standard Odoo calendar view
    """,
    'author': 'Your Company',
    'depends': ['web', 'calendar'],
    'data': [],
    'assets': {
        'web.assets_backend': [
            'calendar_field_widget/static/src/css/calendar_field_widget.css',
            'calendar_field_widget/static/src/xml/calendar_field_widget.xml',
            'calendar_field_widget/static/src/js/calendar_field_widget.js',
        ],
    },
    'installable': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
