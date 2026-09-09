from odoo import fields, models


class SocialGalleryUpload(models.Model):
    _name = "social.gallery.upload"
    _description = "Social Gallery Multipart Upload Session"
    _order = "create_date desc"

    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    user_id = fields.Many2one("res.users", required=True, default=lambda self: self.env.user)
    album_id = fields.Many2one("social.gallery.album", ondelete="set null")
    object_key = fields.Char(required=True, index=True)
    upload_id = fields.Char(required=True, index=True)
    file_name = fields.Char(required=True)
    mime_type = fields.Char(required=True)
    file_size = fields.Integer(required=True)
    parts = fields.Json(default=list)
    state = fields.Selection(
        [("active", "Active"), ("completed", "Completed"), ("aborted", "Aborted")],
        default="active",
        index=True,
    )
    media_id = fields.Many2one("social.gallery.media", ondelete="set null")
