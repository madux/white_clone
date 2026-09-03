import uuid
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta


class ShareLink(models.Model):

    _name = "doc.share.link"

    attachment_id = fields.Many2one("doc.document")

    token = fields.Char(default=lambda self: str(uuid.uuid4()))
    active = fields.Boolean(default=True)
    access_type = fields.Selection([("view_only", "View"), ("download", "Download")])

    expiry_date = fields.Datetime()

    password = fields.Char()

    password_protected = fields.Boolean()

    shared_with_email = fields.Char()

    created_by = fields.Many2one("res.users", default=lambda self: self.env.user)

    access_count = fields.Integer()

    is_revoked = fields.Boolean()


class FolderShareLink(models.Model):
    _name = "doc.folder.share.link"
    _description = "Folder Share Link"

    folder_id = fields.Many2one(
        "doc.folder",
        required=True,
        ondelete="cascade",
    )

    token = fields.Char(
        required=True,
        copy=False,
        default=lambda self: self.env["ir.sequence"].next_by_code("doc.folder.share"),
    )

    permission = fields.Selection(
        [
            ("viewer", "Viewer"),
            ("editor", "Editor"),
        ],
        required=True,
        default="viewer",
    )

    expiry_option = fields.Selection(
        [
            ("24_hours", "24 Hours"),
            ("7_days", "7 Days"),
            ("30_days", "30 Days"),
            ("90_days", "90 Days"),
            ("custom", "Custom Date"),
        ],
        default="7_days",
        required=True,
    )

    expiry_date = fields.Datetime()

    password_protected = fields.Boolean()

    password_hash = fields.Char(
        copy=False,
    )

    allow_download = fields.Boolean(default=False)
    allow_printing = fields.Boolean(default=False)

    active = fields.Boolean(default=True)

    created_by = fields.Many2one(
        "res.users",
        default=lambda self: self.env.user,
        readonly=True,
    )

    @api.constrains("expiry_option", "expiry_date")
    def _check_custom_expiry(self):
        for share in self:
            if share.expiry_option == "custom" and not share.expiry_date:
                raise ValidationError("A custom expiry date is required.")

    def get_expiry_date(self):
        self.ensure_one()

        now = fields.Datetime.now()

        durations = {
            "24_hours": timedelta(hours=24),
            "7_days": timedelta(days=7),
            "30_days": timedelta(days=30),
            "90_days": timedelta(days=90),
        }

        if self.expiry_option == "custom":
            return self.expiry_date

        return now + durations[self.expiry_option]
