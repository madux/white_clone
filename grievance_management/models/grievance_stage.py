# -*- coding: utf-8 -*-
from odoo import models, fields


class GrievanceStage(models.Model):
    _name = 'grievance.stage'
    _description = 'Grievance Status/Stage'
    _order = 'sequence, id'

    name = fields.Char(required=True, translate=True)
    sequence = fields.Integer(default=10)
    is_locked = fields.Boolean(string='System Stage', default=False,
                                help="System-defined stages cannot be deleted, only reordered.")
    is_closed = fields.Boolean(string='Closed Stage',
                                help="Cases in a closed stage are considered finished (Resolved/Closed).")
    fold = fields.Boolean(string='Folded in Kanban')
    active = fields.Boolean(default=True)
    color = fields.Integer(string='Color Index')
