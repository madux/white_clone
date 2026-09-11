from odoo import fields, models


class SocialGalleryAudit(models.Model):
    _name = "social.gallery.audit"
    _description = "Social Gallery Audit Log"
    _order = "create_date desc"

    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    event_type = fields.Selection(
        [
            ("created", "Created"),
            ("uploaded", "Uploaded"),
            ("modified", "Modified"),
            ("deleted", "Deleted"),
            ("restored", "Restored"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("reported", "Reported"),
            ("shared", "Shared"),
            ("exported", "Exported"),
        ],
        required=True,
        index=True,
    )
    entity_type = fields.Selection(
        [("album", "Album"), ("media", "Media"), ("comment", "Comment")],
        required=True,
        index=True,
    )
    album_id = fields.Many2one("social.gallery.album", ondelete="set null", index=True)
    media_id = fields.Many2one("social.gallery.media", ondelete="set null", index=True)
    user_id = fields.Many2one("res.users", required=True, default=lambda self: self.env.user)
    details = fields.Text()
    metadata = fields.Json(default=dict)
