# -*- coding: utf-8 -*-
from odoo import models, fields


class GrievanceDocumentTemplate(models.Model):
    _name = 'grievance.document.template'
    _description = 'Grievance Document Template'
    _order = 'name'

    name = fields.Char(required=True)
    description = fields.Text()
    resolution_id = fields.Many2one('grievance.resolution', string='Linked Resolution')
    body = fields.Html(string='Template Body', sanitize_style=True)
    active = fields.Boolean(default=True)
