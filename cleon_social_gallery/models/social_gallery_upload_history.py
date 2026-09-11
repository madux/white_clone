from odoo import fields, models


class SocialGalleryUploadHistory(models.Model):
    _name = "social.gallery.upload.history"
    _description = "Social Gallery Upload History"
    _order = "create_date desc"

    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    user_id = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user, index=True
    )
    file_name = fields.Char(required=True)
    file_size = fields.Integer()
    mime_type = fields.Char()
    status = fields.Selection(
        [("success", "Success"), ("failed", "Failed")],
        required=True,
        index=True,
    )
    error_message = fields.Text()
    media_id = fields.Many2one("social.gallery.media", ondelete="set null")
    album_id = fields.Many2one("social.gallery.album", ondelete="set null")
