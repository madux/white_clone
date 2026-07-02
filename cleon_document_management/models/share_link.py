import uuid
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError 
from datetime import datetime, timedelta


class ShareLink(models.Model):

    _name = "doc.share.link"

    attachment_id = fields.Many2one(
        'doc.document'
    )

    token = fields.Char(
        default=lambda self:str(uuid.uuid4())
    )
    active = fields.Boolean(default=True)
    access_type = fields.Selection([
        ('view_only','View'),
        ('download','Download')
    ])

    expiry_date = fields.Datetime()

    password = fields.Char()

    password_protected = fields.Boolean()

    shared_with_email = fields.Char()

    created_by = fields.Many2one(
        'res.users',
        default=lambda self:self.env.user
    )

    access_count = fields.Integer()

    is_revoked = fields.Boolean()