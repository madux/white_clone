from odoo import fields, models


class ResCompany(models.Model):
    _inherit = "res.company"

    sg_default_visibility = fields.Selection(
        [("public", "Public"), ("private", "Private")],
        default="public",
        string="Default Gallery Visibility",
    )
    sg_default_destination_album_id = fields.Many2one(
        "social.gallery.album",
        string="Default Destination Album",
        ondelete="set null",
    )
    sg_auto_approve_trusted = fields.Boolean(
        string="Auto-Approve Trusted Users",
        default=False,
    )
    sg_auto_create_monthly_album = fields.Boolean(
        string="Auto-Create Monthly Album",
        default=True,
    )
    sg_max_upload_mb = fields.Integer(string="Max Upload Size (MB)", default=25)
    sg_default_layout = fields.Selection(
        [("grid", "Grid"), ("list", "List"), ("masonry", "Masonry")],
        default="grid",
    )
    sg_theme_color = fields.Char(default="#e83e8c")
    sg_deleted_retention_days = fields.Integer(default=365)
    sg_notify_new_upload = fields.Boolean(default=True)
    sg_notify_approval_request = fields.Boolean(default=True)
    sg_notify_comments = fields.Boolean(default=True)
    sg_notify_likes = fields.Boolean(default=True)
    sg_notify_content_reports = fields.Boolean(
        string="Notify Managers on Content Reports",
        default=True,
    )
    sg_like_batch_size = fields.Integer(default=5)
    sg_weekly_digest = fields.Boolean(default=False)
    sg_allow_external_share = fields.Boolean(default=False)
    sg_ai_moderation_enabled = fields.Boolean(default=True)
