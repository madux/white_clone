import hashlib
import json
import uuid
from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError


MANAGER_GROUP = "cleon_social_gallery.group_social_gallery_manager"
ADMIN_GROUP = "cleon_social_gallery.group_social_gallery_admin"

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
ALLOWED_MIME_TYPES = ALLOWED_IMAGE_TYPES | ALLOWED_VIDEO_TYPES
NON_BLOCKING_AI_FLAGS = frozenset({"moderation_unavailable", "large_file"})
SEVERE_AI_FLAG_TERMS = (
    "explicit",
    "nsfw",
    "nude",
    "nudity",
    "porn",
    "sexual",
    "violence",
    "violent",
    "hateful",
    "hate",
    "gore",
)


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
        [
            ("pending", "Pending"),
            ("passed", "Passed"),
            ("flagged", "Flagged"),
            ("dismissed", "Dismissed"),
            ("skipped", "Skipped"),
        ],
        default="pending",
        index=True,
    )
    ai_moderation_flags = fields.Json(default=list)
    ai_moderation_note = fields.Text()
    deleted_at = fields.Datetime(index=True)
    deleted_by = fields.Many2one("res.users")
    deleted_with_album_id = fields.Many2one("social.gallery.album", ondelete="set null", index=True)
    delete_reason = fields.Selection(
        [("deleted", "Deleted"), ("withdrawn", "Withdrawn"), ("with_album", "Deleted With Album")],
        copy=False,
    )
    withdrawn = fields.Boolean(default=False, index=True)
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
    purge_date = fields.Datetime(index=True)
    legal_hold = fields.Boolean(default=False, index=True)
    legal_hold_reason = fields.Char()
    disposition_state = fields.Selection(
        [
            ("none", "None"),
            ("due", "Due for Disposal"),
            ("approved", "Approved for Disposal"),
        ],
        default="none",
        index=True,
    )
    storage_tier = fields.Selection(
        [("standard", "Standard"), ("cold", "Cold")],
        default="standard",
        index=True,
    )
    needs_processing = fields.Boolean(default=True, index=True)
    rejected_at = fields.Datetime()

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
    view_log_ids = fields.One2many("social.gallery.media.view", "media_id")

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
        if self.album_id:
            if self.album_id.status != "approved" and not self._is_gallery_manager(user):
                return self.uploaded_by == user
            if not self.album_id._user_can_view(user):
                return False
        return True

    def _user_can_edit(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        if self._is_gallery_manager(user):
            return True
        return self.uploaded_by == user

    def _user_can_delete(self, user=None):
        return self._is_gallery_manager(user or self.env.user)

    def _user_can_withdraw(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        return (
            self.uploaded_by == user
            and self.approval_status == "pending"
            and not self.deleted_at
        )

    def _user_can_moderate(self, user=None):
        user = user or self.env.user
        if not self._is_gallery_manager(user):
            return False
        return self.uploaded_by != user

    def _is_unassigned(self):
        self.ensure_one()
        return self.approval_status == "pending" and not self.album_id

    def record_view(self, user=None, from_review=False):
        self.ensure_one()
        user = user or self.env.user
        if from_review and self._is_gallery_manager(user):
            return False
        today = fields.Date.context_today(self)
        View = self.env["social.gallery.media.view"].sudo()
        existing = View.search([
            ("media_id", "=", self.id),
            ("user_id", "=", user.id),
            ("view_date", "=", today),
        ], limit=1)
        if existing:
            return False
        View.create({
            "media_id": self.id,
            "user_id": user.id,
            "view_date": today,
        })
        self.sudo().write({"view_count": self.view_count + 1})
        return True

    def _blocking_moderation_flags(self, flags=None):
        self.ensure_one()
        values = flags if flags is not None else (self.ai_moderation_flags or [])
        return [flag for flag in values if flag not in NON_BLOCKING_AI_FLAGS]

    def _is_severe_moderation_flag(self, flag):
        flag_lower = str(flag or "").lower()
        return any(term in flag_lower for term in SEVERE_AI_FLAG_TERMS)

    def _mark_manual_review_only(self):
        """Skip AI screening and route the upload to the manual approval queue."""
        for media in self:
            media.write({
                "approval_status": "pending",
                "ai_review_status": "skipped",
                "ai_moderation_flags": [],
                "ai_moderation_note": _("AI review is disabled. Waiting for manual approval."),
                "approved_by": False,
                "approved_at": False,
            })

    def _enforce_ai_screening_outcome(self):
        self.ensure_one()
        blocking_flags = self._blocking_moderation_flags()
        if not blocking_flags:
            return

        note = self.ai_moderation_note or _("Automated screening flagged: %s") % ", ".join(
            blocking_flags
        )
        severe = any(self._is_severe_moderation_flag(flag) for flag in blocking_flags)
        if severe:
            self.write({
                "approval_status": "rejected",
                "approver_comment": note,
                "approved_by": False,
                "approved_at": False,
                "ai_review_status": "flagged",
                "ai_moderation_note": note,
            })
            return

        if self.approval_status == "approved":
            self.write({
                "approval_status": "pending",
                "approved_by": False,
                "approved_at": False,
                "ai_review_status": "flagged",
                "ai_moderation_note": note,
            })

    def _moderate_image(self, image_bytes=None, image_mime=None):
        self.ensure_one()
        from .gallery_huggingface import (
            moderate_media as huggingface_moderate,
            huggingface_configured,
        )
        from .gallery_ollama import moderate_media as ollama_moderate, ollama_configured
        from .gallery_openrouter import moderate_media as openrouter_moderate, openrouter_configured

        providers = []
        if huggingface_configured(self.env):
            providers.append(huggingface_moderate)
        if ollama_configured(self.env):
            providers.append(ollama_moderate)
        if openrouter_configured(self.env):
            providers.append(openrouter_moderate)

        for moderate in providers:
            flags, note = moderate(
                self.env,
                self,
                image_bytes=image_bytes,
                image_mime=image_mime,
            )
            if flags != ["moderation_unavailable"]:
                return flags, note

        return ["moderation_unavailable"], _(
            "No AI moderation provider is configured. Set HF_TOKEN, start Ollama "
            "(ollama pull llava), or set OPENROUTER_API_KEY."
        )

    def _run_ai_screening(self, image_bytes=None, image_mime=None):
        self.ensure_one()
        company = self.company_id
        if company and not company.sg_ai_moderation_enabled:
            self._mark_manual_review_only()
            return

        flags = []
        note = ""
        if self.file_size > 50 * 1024 * 1024:
            flags.append("large_file")
        name_lower = (self.file_name or "").lower()
        for term in ("nsfw", "explicit"):
            if term in name_lower:
                flags.append("suspicious_filename")

        if company.sg_ai_moderation_enabled:
            if self.media_type == "image" and image_bytes:
                ai_flags, ai_note = self._moderate_image(
                    image_bytes=image_bytes,
                    image_mime=image_mime or self.mime_type or "image/jpeg",
                )
                flags.extend(ai_flags)
                note = ai_note or note
            elif self.media_type == "image":
                flags.append("moderation_unavailable")
                note = _("Image bytes were not available for automated screening.")

        self.ai_moderation_flags = list(dict.fromkeys(flags))
        blocking_flags = [flag for flag in flags if flag not in NON_BLOCKING_AI_FLAGS]
        self.ai_review_status = "flagged" if blocking_flags else "passed"
        if flags:
            self.ai_moderation_note = note or _("Automated screening flagged: %s") % ", ".join(flags)
        else:
            self.ai_moderation_note = note or ""
        self._enforce_ai_screening_outcome()

    def _create_disposal_record(self):
        Disposal = self.env["social.gallery.disposal.record"].sudo()
        for media in self:
            Disposal.create({
                "company_id": media.company_id.id,
                "media_id": media.id,
                "media_name": media.display_name,
                "album_name": media.album_id.name if media.album_id else "",
                "deleted_by_id": media.deleted_by.id if media.deleted_by else False,
                "deleted_at": media.deleted_at,
                "purged_at": fields.Datetime.now(),
                "retention_rule": "recycle_bin",
                "approver_id": self.env.user.id if media.disposition_state == "approved" else False,
                "storage_keys_removed": media._storage_keys(),
            })

    @api.model
    def _cron_process_uploads(self):
        from .gallery_media_processing import process_media_thumbnail
        pending = self.search([
            ("needs_processing", "=", True),
            ("storage_key", "!=", False),
        ], limit=50)
        for media in pending:
            process_media_thumbnail(self.env, media)

    @api.model
    def _cron_lifecycle_tiers(self):
        """Mark aged non-active objects as cold tier (FR-254 metadata; R2 lifecycle is bucket policy)."""
        for company in self.env["res.company"].search([]):
            days = company.sg_lifecycle_cold_after_days or 90
            cutoff = fields.Datetime.now() - timedelta(days=days)
            cold_candidates = self.search([
                ("company_id", "=", company.id),
                ("storage_tier", "=", "standard"),
                ("deleted_at", "!=", False),
                ("deleted_at", "<=", cutoff),
            ])
            cold_candidates.write({"storage_tier": "cold"})

    @api.model
    def _cron_purge_recycle_bin(self):
        now = fields.Datetime.now()
        for company in self.env["res.company"].search([]):
            due = self.search([
                ("company_id", "=", company.id),
                ("purge_date", "!=", False),
                ("purge_date", "<=", now),
                "|",
                ("deleted_at", "!=", False),
                ("approval_status", "=", "rejected"),
            ])
            for media in due:
                if media._is_on_legal_hold():
                    continue
                if company.sg_disposition_review and media.disposition_state != "approved":
                    if media.disposition_state != "due":
                        media.disposition_state = "due"
                    continue
                media._create_disposal_record()
                media.unlink()

    @api.model
    def _cron_purge_audit_logs(self):
        Audit = self.env["social.gallery.audit"].sudo()
        for company in self.env["res.company"].search([]):
            days = company.sg_audit_retention_days or 730
            cutoff = fields.Datetime.now() - timedelta(days=days)
            stale = Audit.search([
                ("company_id", "=", company.id),
                ("create_date", "<=", cutoff),
            ])
            stale.unlink()

    def action_duplicate(self):
        from odoo.addons.cleon_social_gallery.controllers.storage import CloudflareR2Storage
        import uuid

        created = self.env["social.gallery.media"]
        storage = CloudflareR2Storage(self.env)
        for media in self:
            if not self.env.user.has_group(MANAGER_GROUP) and not self.env.user.has_group(ADMIN_GROUP):
                raise AccessError(_("Only supervisors and administrators can duplicate media."))
            new_key = media.storage_key
            if storage.is_configured():
                safe = media.file_name or "media"
                new_key = "social-gallery/%s/%s-%s" % (
                    media.company_id.id, uuid.uuid4().hex, safe
                )
                storage.copy_object(media.storage_key, new_key)
            copy = media.copy({
                "display_name": _("%s (copy)") % media.display_name,
                "storage_key": new_key,
                "thumbnail_key": False,
                "approval_status": "approved",
                "approved_by": self.env.user.id,
                "approved_at": fields.Datetime.now(),
                "view_count": 0,
                "download_count": 0,
                "like_ids": [(5, 0, 0)],
                "version": 1,
                "replaces_media_id": False,
                "needs_processing": media.media_type == "image",
            })
            created |= copy
        return created

    def action_approve(self, album_id=None, comment=None, reviewer=None):
        reviewer = reviewer or self.env.user
        Album = self.env["social.gallery.album"]
        for media in self:
            if media.approval_status != "pending":
                reviewer_name = media.approved_by.name if media.approved_by else _("another reviewer")
                raise UserError(_("Already reviewed by %s.") % reviewer_name)
            if media.uploaded_by == reviewer:
                raise AccessError(_("You cannot approve media you uploaded."))
            target_album_id = album_id or (media.album_id.id if media.album_id else False)
            if not target_album_id:
                raise UserError(_("Select an approved album before approving."))
            album = Album.browse(target_album_id).exists()
            if not album or album.deleted_at or album.status != "approved":
                raise UserError(_("Choose an approved, non-deleted album."))
            vals = {
                "approval_status": "approved",
                "approved_by": reviewer.id,
                "approved_at": fields.Datetime.now(),
                "album_id": album.id,
                "ai_review_status": "skipped",
            }
            if comment:
                vals["approver_comment"] = comment
            media.write(vals)

    def action_reject(self, comment=None, reviewer=None):
        reviewer = reviewer or self.env.user
        if not (comment or "").strip():
            raise UserError(_("A rejection reason is required."))
        for media in self:
            if media.approval_status != "pending":
                reviewer_name = media.approved_by.name if media.approved_by else _("another reviewer")
                raise UserError(_("Already reviewed by %s.") % reviewer_name)
            if media.uploaded_by == reviewer:
                raise AccessError(_("You cannot reject media you uploaded."))
            rejected_at = fields.Datetime.now()
            days = media.company_id.sg_rejected_retention_days or 90
            media.write({
                "approval_status": "rejected",
                "approver_comment": comment.strip(),
                "approved_by": reviewer.id,
                "approved_at": rejected_at,
                "rejected_at": rejected_at,
                "purge_date": rejected_at + timedelta(days=days),
                "ai_review_status": "dismissed",
            })

    def _is_on_legal_hold(self):
        self.ensure_one()
        company = self.company_id
        if company.sg_tenant_legal_hold:
            return True
        if self.legal_hold:
            return True
        if self.album_id and self.album_id.legal_hold:
            return True
        return False

    def _retention_days_for_media(self):
        self.ensure_one()
        company = self.company_id
        if self.deleted_at or self.withdrawn:
            return company.sg_deleted_retention_days or 30
        if self.approval_status == "rejected":
            return company.sg_rejected_retention_days or 90
        return company.sg_deleted_retention_days or 30

    def action_soft_delete(self, reason="deleted"):
        now = fields.Datetime.now()
        for media in self:
            days = media._retention_days_for_media()
            media.write({
                "deleted_at": now,
                "deleted_by": self.env.user.id,
                "delete_reason": reason,
                "purge_date": now + timedelta(days=days),
                "disposition_state": "none",
            })

    def action_withdraw(self):
        for media in self:
            if not media._user_can_withdraw():
                raise AccessError(_("Only pending uploads can be withdrawn by their owner."))
            now = fields.Datetime.now()
            days = media.company_id.sg_deleted_retention_days or 30
            media.write({
                "deleted_at": now,
                "deleted_by": self.env.user.id,
                "delete_reason": "withdrawn",
                "withdrawn": True,
                "purge_date": now + timedelta(days=days),
            })

    def action_restore(self, album_id=None):
        for media in self:
            prior_status = media.approval_status
            vals = {
                "deleted_at": False,
                "deleted_by": False,
                "delete_reason": False,
                "withdrawn": False,
                "deleted_with_album_id": False,
            }
            if album_id:
                vals["album_id"] = album_id
            elif media.album_id and media.album_id.deleted_at:
                raise UserError(
                    _("Restore the album first or choose another approved album.")
                )
            media.write(vals)

    def action_rereview_after_edit(self):
        for media in self:
            if media.uploaded_by != self.env.user and not media._is_gallery_manager():
                raise AccessError(_("You cannot edit this media."))
            if media.approval_status == "approved" and not media._is_gallery_manager():
                media.write({
                    "approval_status": "pending",
                    "approved_by": False,
                    "approved_at": False,
                })

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
        if not self.env.context.get("skip_storage_delete"):
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
