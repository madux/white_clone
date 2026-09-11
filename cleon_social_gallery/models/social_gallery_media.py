import hashlib
import json
import uuid
from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


MANAGER_GROUP = "cleon_social_gallery.group_social_gallery_manager"
ADMIN_GROUP = "cleon_social_gallery.group_social_gallery_admin"

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
ALLOWED_MIME_TYPES = ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES


class SocialGalleryMedia(models.Model):
    _name = "social.gallery.media"
    _description = "Social Gallery Media"
    _inherit = ["mail.thread"]
    _order = "create_date desc"

    display_name = fields.Char(string="Title", required=True, index=True)
    description = fields.Text()
    album_id = fields.Many2one("social.gallery.album", ondelete="restrict", index=True)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    media_type = fields.Selection(
        [("image", "Image"), ("video", "Video")],
        required=True,
        index=True,
    )
    uploaded_by = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user, readonly=True
    )
    department_id = fields.Many2one("hr.department", index=True)
    branch_id = fields.Many2one("multi.branch", index=True)
    file_name = fields.Char(required=True)
    mime_type = fields.Char(required=True)
    file_size = fields.Integer(required=True)
    checksum = fields.Char(index=True)
    storage_key = fields.Char(required=True, index=True, copy=False)
    thumbnail_key = fields.Char(copy=False)
    accessible_description = fields.Text()
    tag_ids = fields.Many2many(
        "social.gallery.tag", "social_gallery_media_tag_rel", "media_id", "tag_id"
    )
    approval_status = fields.Selection(
        [
            ("pending", "Pending"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
        ],
        default="pending",
        required=True,
        index=True,
    )
    approver_comment = fields.Text()
    approved_by = fields.Many2one("res.users", readonly=True)
    approved_at = fields.Datetime(readonly=True)
    ai_review_status = fields.Selection(
        [("pending", "Pending"), ("passed", "Passed"), ("flagged", "Flagged")],
        default="pending",
        index=True,
    )
    ai_moderation_flags = fields.Json(default=list)
    ai_moderation_note = fields.Text()
    deleted_at = fields.Datetime(index=True)
    deleted_by = fields.Many2one("res.users")
    is_pinned = fields.Boolean(default=False)
    comments_enabled = fields.Boolean(default=True)
    share_token = fields.Char(copy=False, index=True)
    replaces_media_id = fields.Many2one("social.gallery.media", ondelete="set null")
    version = fields.Integer(default=1)
    edit_metadata = fields.Json(default=dict)
    view_count = fields.Integer(default=0)
    download_count = fields.Integer(default=0)
    like_count = fields.Integer(compute="_compute_like_count", store=True)
    comment_count = fields.Integer(compute="_compute_comment_count", store=True)
    active = fields.Boolean(default=True)

    @api.depends("like_ids")
    def _compute_like_count(self):
        for media in self:
            media.like_count = len(media.like_ids)

    @api.depends("comment_ids", "comment_ids.active")
    def _compute_comment_count(self):
        for media in self:
            media.comment_count = len(media.comment_ids.filtered("active"))

    like_ids = fields.One2many("social.gallery.like", "media_id")
    comment_ids = fields.One2many("social.gallery.comment", "media_id")
    report_ids = fields.One2many("social.gallery.report", "media_id")

    @api.constrains("file_size", "mime_type")
    def _check_media(self):
        for media in self:
            if media.file_size <= 0:
                raise ValidationError(_("File size must be greater than zero."))
            max_mb = media.company_id.sg_max_upload_mb or 25
            if media.file_size > max_mb * 1024 * 1024:
                raise ValidationError(_("File exceeds maximum upload size of %s MB.") % max_mb)
            if media.mime_type not in ALLOWED_MIME_TYPES:
                raise ValidationError(_("Unsupported file type: %s") % media.mime_type)

    def _is_gallery_admin(self, user=None):
        user = user or self.env.user
        return user.has_group(ADMIN_GROUP) or user.has_group("base.group_system")

    def _is_gallery_manager(self, user=None):
        user = user or self.env.user
        return self._is_gallery_admin(user) or user.has_group(MANAGER_GROUP)

    def _user_can_view(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        if self.company_id != user.company_id:
            return False
        if self.deleted_at and not self._is_gallery_manager(user):
            return False
        if self._is_gallery_manager(user):
            return True
        if self.approval_status != "approved":
            return self.uploaded_by == user
        if self.album_id and not self.album_id._user_can_view(user):
            return False
        return True

    def _user_can_edit(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        return self._is_gallery_manager(user) or self.uploaded_by == user

    def _user_can_moderate(self, user=None):
        return self._is_gallery_manager(user or self.env.user)

    def _run_ai_screening(self):
        self.ensure_one()
        flags = []
        if self.file_size > 50 * 1024 * 1024:
            flags.append("large_file")
        name_lower = (self.file_name or "").lower()
        for term in ("test", "nsfw", "explicit"):
            if term in name_lower:
                flags.append("suspicious_filename")
        self.ai_moderation_flags = flags
        self.ai_review_status = "flagged" if flags else "passed"
        if flags:
            self.ai_moderation_note = _("Automated screening flagged: %s") % ", ".join(flags)

    @api.model
    def _cron_purge_recycle_bin(self):
        for company in self.env["res.company"].search([]):
            days = company.sg_deleted_retention_days or 365
            cutoff = fields.Datetime.now() - timedelta(days=days)
            stale = self.search([
                ("company_id", "=", company.id),
                ("deleted_at", "!=", False),
                ("deleted_at", "<=", cutoff),
            ])
            stale.unlink()

    def action_approve(self, album_id=None, comment=None):
        for media in self:
            vals = {
                "approval_status": "approved",
                "approved_by": self.env.user.id,
                "approved_at": fields.Datetime.now(),
            }
            if album_id:
                vals["album_id"] = album_id
            if comment:
                vals["approver_comment"] = comment
            media.write(vals)

    def action_reject(self, comment=None):
        self.write({
            "approval_status": "rejected",
            "approver_comment": comment or "",
            "approved_by": self.env.user.id,
            "approved_at": fields.Datetime.now(),
        })

    def action_soft_delete(self):
        self.write({
            "deleted_at": fields.Datetime.now(),
            "deleted_by": self.env.user.id,
        })

    def action_restore(self):
        self.write({"deleted_at": False, "deleted_by": False})

    def _storage_keys(self):
        keys = []
        for media in self:
            if media.storage_key:
                keys.append(media.storage_key)
            if media.thumbnail_key:
                keys.append(media.thumbnail_key)
        return keys

    def _delete_storage_objects(self):
        from odoo.addons.cleon_social_gallery.controllers.storage import CloudflareR2Storage
        storage = CloudflareR2Storage(self.env)
        if storage.is_configured():
            storage.delete_objects(self._storage_keys())

    def unlink(self):
        self._delete_storage_objects()
        return super().unlink()

    @staticmethod
    def compute_checksum(content_bytes):
        return hashlib.sha256(content_bytes).hexdigest()

    def ensure_share_token(self):
        self.ensure_one()
        if not self.share_token:
            self.share_token = uuid.uuid4().hex
        return self.share_token
