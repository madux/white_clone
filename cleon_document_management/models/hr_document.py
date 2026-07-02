from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError 
from datetime import datetime, timedelta

class Document(models.Model):
    _name = "doc.document"
    _inherit = ['mail.thread','mail.activity.mixin']
    _description = "Document"

    name = fields.Char(required=True)

    folder_id = fields.Many2one(
        'doc.folder',
        required=True
    )

    attachment_id = fields.Many2one(
        'ir.attachment',
        required=True
    )

    document_type_id = fields.Many2one(
        'doc.document.type'
    )

    owner_id = fields.Many2one(
        'res.users',
        default=lambda self:self.env.user
    )

    employee_id = fields.Many2one(
        'hr.employee'
    )

    company_id = fields.Many2one(
        'res.company',
        default=lambda self:self.env.company
    )

    state = fields.Selection([
        ('draft','Draft'),
        ('pending','Pending Approval'),
        ('approved','Approved'),
        ('rejected','Rejected'),
        ('signed','Signed')
    ],default='draft')

    signature_required = fields.Boolean()

    expiry_date = fields.Date()

    version = fields.Integer(default=1)

    is_locked = fields.Boolean()

    active = fields.Boolean(default=True)