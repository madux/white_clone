from odoo import fields, models


class SocialGalleryLike(models.Model):
    _name = "social.gallery.like"
    _description = "Social Gallery Like"
    _order = "create_date desc"

    media_id = fields.Many2one(
        "social.gallery.media", required=True, ondelete="cascade", index=True
    )
    user_id = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user, index=True
    )

    _sql_constraints = [
        ("media_user_uniq", "unique(media_id, user_id)", "You can only like a media item once."),
    ]
