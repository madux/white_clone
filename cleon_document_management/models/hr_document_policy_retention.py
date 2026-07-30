from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError 
from datetime import datetime, timedelta

class RetentionPolicy(models.Model):

    _name = "doc.retention.policy"

    name = fields.Char()

    description = fields.Text()

    document_type_id = fields.Many2one(
        'doc.document.type'
    )
    retention_value = fields.Integer()

    retention_unit = fields.Selection([
        ('days','Days'),
        ('months','Months'),
        ('years','Years')
    ])

    trigger_event = fields.Selection([
        ('upload_date','Upload Date'),
        ('expiry_date','Expiry Date'),
        ('termination_date','Termination Date')
    ])

    action_after_expiry = fields.Selection([
        ('archive','Archive'),
        ('delete','Delete'),
        ('flag_for_review','Flag'),
        ('notify_owner','Notify')
    ])

    applies_to_folder_ids = fields.Many2many(
        'doc.folder'
    )

    active = fields.Boolean(default=True)