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

    is_external = fields.Boolean(
        string="External share",
        default=False,
        help="Share link accessible outside the organisation (password / watermark).",
    )
    watermark_enabled = fields.Boolean(default=False)
    access_log_ids = fields.One2many(
        "doc.share.access.log",
        "share_link_id",
        string="Access log",
    )

    document_id = fields.Many2one(
        "doc.document",
        string="Document",
        ondelete="cascade",
        index=True,
    )

    def is_valid(self):
        self.ensure_one()
        if not self.active or self.is_revoked:
            return False
        if self.expiry_date and self.expiry_date < fields.Datetime.now():
            return False
        return True

    def log_access(self, action="view", ip_address="", user_agent=""):
        self.ensure_one()
        self.env["doc.share.access.log"].sudo().create(
            {
                "share_link_id": self.id,
                "action": action,
                "ip_address": ip_address or "",
                "user_agent": (user_agent or "")[:500],
            }
        )
        self.sudo().write({"access_count": (self.access_count or 0) + 1})

    def serialize_for_api(self):
        self.ensure_one()
        return {
            "id": self.id,
            "token": self.token,
            "active": self.active,
            "access_type": self.access_type,
            "expiry_date": fields.Datetime.to_string(self.expiry_date)
            if self.expiry_date
            else "",
            "password_protected": bool(self.password_protected),
            "is_external": bool(self.is_external),
            "watermark_enabled": bool(self.watermark_enabled),
            "access_count": self.access_count or 0,
            "is_revoked": bool(self.is_revoked),
            "document_id": self.document_id.id or self.attachment_id.id or False,
        }


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
