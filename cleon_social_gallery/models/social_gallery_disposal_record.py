from odoo import fields, models


class SocialGalleryDisposalRecord(models.Model):
    _name = "social.gallery.disposal.record"
    _description = "Social Gallery Disposal Record"
    _order = "purged_at desc"

    company_id = fields.Many2one("res.company", required=True, index=True)
    media_id = fields.Integer(string="Former Media ID", required=True)
    media_name = fields.Char()
    album_name = fields.Char()
    deleted_by_id = fields.Many2one("res.users")
    deleted_at = fields.Datetime()
    purged_at = fields.Datetime(required=True, default=fields.Datetime.now)
    retention_rule = fields.Char()
    approver_id = fields.Many2one("res.users")
    storage_keys_removed = fields.Json(default=list)
