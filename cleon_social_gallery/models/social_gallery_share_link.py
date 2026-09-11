import uuid

from odoo import api, fields, models

from .gallery_share_security import hash_share_password, verify_share_password


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

    @api.model
    def _prepare_password(self, password):
        return hash_share_password(password)

    def check_password(self, password):
        self.ensure_one()
        return verify_share_password(password, self.password)

    @api.model_create_multi
    def create(self, vals_list):
        prepared = []
        for vals in vals_list:
            row = dict(vals)
            if row.get("password"):
                row["password"] = self._prepare_password(row["password"])
            prepared.append(row)
        return super().create(prepared)

    def write(self, vals):
        if vals.get("password"):
            vals = dict(vals)
            vals["password"] = self._prepare_password(vals["password"])
        return super().write(vals)
