# -*- coding: utf-8 -*-
from odoo import models, fields


class GrievancePanel(models.Model):
    _name = 'grievance.panel'
    _description = 'Grievance Investigation Panel'
    _order = 'name'

    name = fields.Char(required=True)
    member_ids = fields.Many2many('res.users', string='Panel Members')
    description = fields.Text()
    active = fields.Boolean(default=True)
