from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError 
from datetime import datetime, timedelta


class DocumentType(models.Model):
    _name = "doc.document.type"

    name = fields.Char(required=True)

    category = fields.Selection([
        ('hr','HR'),
        ('finance','Finance'),
        ('legal','Legal'),
        ('compliance','Compliance')
    ])

    is_mandatory_default = fields.Boolean()

    default_retention_years = fields.Integer(default=7)
    active = fields.Boolean(default=True)
