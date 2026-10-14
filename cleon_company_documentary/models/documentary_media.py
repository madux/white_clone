import uuid
from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class CompanyDocumentaryMedia(models.Model):
    _name = "company.documentary.media"
    _description = "Company Documentary Video"
    _inherit = ["mail.thread"]
    _order = "create_date desc"

    name = fields.Char(string="Title", required=True, index=True, tracking=True)
    description = fields.Html(sanitize=True)
    folder_id = fields.Many2one(
        "company.documentary.folder", required=True, ondelete="restrict", index=True
    )
    company_id = fields.Many2one(related="folder_id.company_id", store=True, index=True)
    owner_id = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user, readonly=True
    )
    uploaded_by = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user, readonly=True
    )
    tag_ids = fields.Many2many(
        "company.documentary.tag",
        "company_documentary_media_tag_rel",
        "media_id",
        "tag_id",
    )
    favorite_user_ids = fields.Many2many(
        "res.users",
        "company_documentary_media_favorite_rel",
        "media_id",
        "user_id",
        string="Favorites",
    )
    processing_state = fields.Selection(
        [
            ("uploading", "Uploading"),
            ("processing", "Processing"),
            ("ready", "Ready"),
            ("failed", "Failed"),
        ],
        default="uploading",
        required=True,
        index=True,
        tracking=True,
    )
    processing_error = fields.Text(readonly=True)
    active = fields.Boolean(default=True, index=True)
    deleted_at = fields.Datetime(readonly=True, index=True)
    deleted_by = fields.Many2one("res.users", readonly=True)
    original_filename = fields.Char(required=True)
    mime_type = fields.Char(required=True)
    file_size = fields.Integer(required=True)
    checksum = fields.Char(index=True)
    duration_seconds = fields.Float()
    storage_key = fields.Char(required=True, index=True, copy=False)
    variants = fields.Json(default=dict, copy=False)
    thumbnail_key = fields.Char(copy=False)
    thumbnail_source = fields.Selection(
        [("generated", "Generated"), ("custom", "Custom")],
        default="generated",
    )
    mandatory = fields.Boolean(string="Mandatory Training", default=False)
    completion_threshold = fields.Float(default=85.0)
    comments_enabled = fields.Boolean(default=False)
    download_policy = fields.Selection(
        [("inherit", "Inherit folder policy"), ("allow", "Allow downloads"), ("deny", "Block downloads")],
        default="inherit",
        required=True,
    )
    scope_mode = fields.Selection(
        [("inherited", "Inherit folder access"), ("override", "Use stricter media access")],
        default="inherited",
        required=True,
    )
    access_scope = fields.Selection(
        [("company", "All Employees"), ("department", "Specific Department")],
        default="company",
    )
    department_ids = fields.Many2many(
        "hr.department", "company_documentary_media_department_rel", "media_id", "department_id"
    )
    subtitle_ids = fields.One2many("company.documentary.subtitle", "media_id")
    watch_progress_ids = fields.One2many("company.documentary.watch", "media_id")
    view_count = fields.Integer(compute="_compute_engagement", store=True)
    unique_viewer_count = fields.Integer(compute="_compute_engagement", store=True)
    approval_status = fields.Selection(
        [
            ("draft", "Draft"),
            ("pending", "Pending Approval"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("scheduled", "Scheduled"),
        ],
        default="draft",
        required=True,
        index=True,
        tracking=True,
    )
    published_at = fields.Datetime(readonly=True)
    transcript = fields.Text()
    chapters = fields.Json(default=list)
    share_token = fields.Char(copy=False, index=True)
    is_official = fields.Boolean(default=False)
    replaces_media_id = fields.Many2one("company.documentary.media", ondelete="set null")
    approver_comment = fields.Text()
    approved_by_id = fields.Many2one("res.users", readonly=True)
    approved_at = fields.Datetime(readonly=True)

    @api.depends("watch_progress_ids", "watch_progress_ids.view_count", "watch_progress_ids.user_id")
    def _compute_engagement(self):
        for media in self:
            records = media.watch_progress_ids
            media.view_count = sum(records.mapped("view_count"))
            media.unique_viewer_count = len(records.mapped("user_id"))

    @api.constrains("file_size", "mime_type")
    def _check_media_values(self):
        allowed_types = {"video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"}
        for media in self:
            if media.file_size <= 0 or media.file_size > 10 * 1024 * 1024 * 1024:
                raise ValidationError(_("Video files must be greater than 0 and no larger than 10 GB."))
            if media.mime_type not in allowed_types:
                raise ValidationError(_("Only MP4, WebM, MOV, and AVI videos are supported."))
    @api.constrains("scope_mode", "access_scope", "department_ids")
    def _check_media_scope(self):
        for media in self:
            if media.scope_mode == "inherited":
                if media.department_ids:
                    raise ValidationError(_("Inherited media access cannot define separate targets."))
                continue
            if media.access_scope == "department" and not media.department_ids:
                raise ValidationError(_("Select a department for media access."))
            if media.access_scope == "company":
                raise ValidationError(_("Media overrides must be stricter than the folder."))
            if media.folder_id.access_scope == "department" and media.access_scope == "department":
                if media.department_ids and not set(media.department_ids.ids).issubset(
                    set(media.folder_id.department_ids.ids)
                ):
                    raise ValidationError(_("Media department must be within the folder department."))

    def _user_can_edit(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        return self.folder_id._user_can_edit(user) or self.owner_id == user

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            folder = self.env["company.documentary.folder"].browse(vals.get("folder_id")).exists()
            if not folder or not folder._user_can_edit():
                raise AccessError(_("You do not have permission to add videos to this folder."))
        return super().create(vals_list)

    def write(self, vals):
        for media in self:
            if not media._user_can_edit():
                raise AccessError(_("You do not have permission to edit this video."))
        return super().write(vals)

    def action_archive(self, reason=None):
        for media in self:
            media.lifecycle_archive(reason or _("Retired"))

    def action_restore(self):
        for media in self:
            if media.status == "deleted":
                media.lifecycle_restore_from_bin()
            elif media.status == "archived":
                media.with_context(lifecycle_write=True).write({"status": "archived", "active": True})

    def action_move_to_recycle_bin(self):
        for media in self:
            if not media._user_can_edit():
                raise AccessError(_("You do not have permission to delete this video."))
            media.lifecycle_soft_delete()

    def action_permanent_delete(self):
        for media in self:
            if not media.folder_id._is_documentary_manager():
                raise AccessError(_("Documentary Manager access is required to permanently delete videos."))
        return self.unlink()

    def action_approve(self, comment=None):
        for media in self:
            media.lifecycle_approve()

    def action_reject(self, comment=None):
        for media in self:
            media.lifecycle_return_for_correction(comment)

    def action_submit_for_approval(self):
        for media in self:
            media.lifecycle_submit_for_review()

    def _activate_replacement(self):
        """Pending revision goes live on publish (SRS §11)."""
        self.ensure_one()
        parent = self.replaces_media_id
        if not parent or not parent.exists():
            return
        parent.with_context(lifecycle_write=True).write({
            "pending_revision_id": False,
        })

    @api.model
    def _cron_process_pending_media(self):
        pending = self.sudo().search([("status", "=", "processing"), ("processing_state", "=", "processing")])
        for media in pending:
            media.lifecycle_complete_processing()

    @api.model
    def _cron_auto_archive(self):
        companies = self.env["res.company"].sudo().search([("documentary_auto_archive_months", ">", 0)])
        now = fields.Datetime.now()
        for company in companies:
            months = company.documentary_auto_archive_months
            cutoff = now - timedelta(days=months * 30)
            published = self.sudo().search([
                ("company_id", "=", company.id),
                ("status", "=", "published"),
                ("published_at", "!=", False),
                ("published_at", "<", cutoff),
            ])
            for media in published:
                media.lifecycle_archive(_("Auto-archived after %s months") % months)

    @api.model
    def _cron_purge_recycle_bin(self):
        now = fields.Datetime.now()
        due = self.sudo().search([
            ("status", "=", "deleted"),
            ("purge_date", "!=", False),
            ("purge_date", "<=", now),
            ("legal_hold", "=", False),
        ])
        for media in due:
            if media.company_id.documentary_disposition_review:
                continue
            media.action_permanent_delete()

    def unlink(self):
        if any(not media._user_can_edit() for media in self):
            raise AccessError(_("You do not have permission to delete this video."))
        return super().unlink()
