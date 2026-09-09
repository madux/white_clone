from odoo import fields, models


class SocialGalleryReport(models.Model):
    _name = "social.gallery.report"
    _description = "Social Gallery Content Report"
    _order = "create_date desc"

    media_id = fields.Many2one(
        "social.gallery.media", required=True, ondelete="cascade", index=True
    )
    reporter_id = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user, readonly=True
    )
    reason = fields.Selection(
        [
            ("inappropriate", "Inappropriate Content"),
            ("harassment", "Harassment"),
            ("privacy", "Privacy Violation"),
            ("copyright", "Copyright Issue"),
            ("other", "Other"),
        ],
        required=True,
    )
    details = fields.Text()
    status = fields.Selection(
        [("open", "Open"), ("dismissed", "Dismissed"), ("removed", "Content Removed")],
        default="open",
        index=True,
    )
    resolved_by = fields.Many2one("res.users", readonly=True)
    resolved_at = fields.Datetime(readonly=True)
