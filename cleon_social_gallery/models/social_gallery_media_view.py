from odoo import fields, models


class SocialGalleryMediaView(models.Model):
    _name = "social.gallery.media.view"
    _description = "Social Gallery Media View Log"
    _order = "view_date desc"

    media_id = fields.Many2one(
        "social.gallery.media", required=True, ondelete="cascade", index=True
    )
    user_id = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user, index=True
    )
    view_date = fields.Date(required=True, index=True)

    _sql_constraints = [
        (
            "media_user_day_uniq",
            "unique(media_id, user_id, view_date)",
            "Only one view per user per media per day.",
        ),
    ]
