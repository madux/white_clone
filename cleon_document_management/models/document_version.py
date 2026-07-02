from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError 
from datetime import datetime, timedelta


class DocumentVersion(models.Model):

    _name = "doc.document.version"

    attachment_id = fields.Many2one(
        'doc.document'
    )

    version_number = fields.Integer()

    file_attachment = fields.Many2one(
        'ir.attachment'
    )

    uploaded_by = fields.Many2one(
        'res.users'
    )

    upload_date = fields.Datetime()

    change_note = fields.Char()
    active = fields.Boolean(default=True)