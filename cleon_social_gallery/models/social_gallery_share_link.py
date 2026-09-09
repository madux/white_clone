import uuid

from odoo import fields, models


class SocialGalleryShareLink(models.Model):
    _name = "social.gallery.share.link"
    _description = "Social Gallery Share Link"
    _order = "create_date desc"

    token = fields.Char(required=True, index=True, default=lambda self: uuid.uuid4().hex)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    media_id = fields.Many2one("social.gallery.media", ondelete="cascade", index=True)
    album_id = fields.Many2one("social.gallery.album", ondelete="cascade", index=True)
    is_external = fields.Boolean(default=False)
    password = fields.Char()
    expires_at = fields.Datetime()
    created_by = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user
    )
    active = fields.Boolean(default=True)
    recipient_user_ids = fields.Many2many(
        "res.users", "social_gallery_share_recipient_rel", "link_id", "user_id"
    )
