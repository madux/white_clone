# -*- coding: utf-8 -*-
{
    'name': 'Cleon Payroll - Rule Builder & Parameters (F4)',
    'version': '17.0.1.0.0',
    'category': 'Human Resources/Payroll',
    'summary': 'Dated Rule Parameters, lookup tables, computed run order with cycle '
               'detection, rule lifecycle and test on a real person',
    'author': 'Cleon',
    'license': 'LGPL-3',
    'depends': ['cleon_payroll'],
    'data': [
        'security/ir.model.access.csv',
        'views/cleon_rule_parameter_views.xml',
        'views/cleon_lookup_views.xml',
        'wizard/cleon_rule_test_views.xml',
        'views/cleon_rule_inherit_views.xml',
    ],
    'installable': True,
    'application': False,
}
