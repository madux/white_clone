# -*- coding: utf-8 -*-
from odoo import api, fields, models

class CleonHrGrade(models.Model):
    _inherit = 'cleon.hr.grade'
    _description="Payroll Grade"

    structure_id = fields.Many2one(
        'cleon.payroll.structure',
        string="Structure",
        copy=False,
    )
    show_payroll_link = fields.Boolean(
                    string="Payroll menu Link",
                    default=True,
                    help="Used to hold widget in form view"
                )
    