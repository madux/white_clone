from datetime import timedelta

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError

from .documentary_constants import DOCUMENTARY_STATUSES


class CompanyDocumentaryMediaLifecycle(models.Model):
    _inherit = "company.documentary.media"

    status = fields.Selection(
        DOCUMENTARY_STATUSES,
        default="processing",
        required=True,
        index=True,
        tracking=True,
    )
    category = fields.Selection(
        selection="_category_selection",
        default="general",
        required=True,
        index=True,
    )
    keywords = fields.Char(help="Comma-separated search keywords")
    is_internal_only = fields.Boolean(
        string="Internal Only",
        default=False,
        help="Disables employee download in the player.",
    )
    current_version_number = fields.Integer(default=0, readonly=True)
    live_version_id = fields.Many2one("company.documentary.version", readonly=True, copy=False)
    pending_revision_id = fields.Many2one(
        "company.documentary.media",
        string="Pending Revision",
        ondelete="set null",
        copy=False,
    )
    version_ids = fields.One2many("company.documentary.version", "media_id")
    share_link_ids = fields.One2many("company.documentary.share.link", "media_id")
    submitted_by_id = fields.Many2one("res.users", readonly=True, copy=False)
    submitted_at = fields.Datetime(readonly=True)
    return_reason = fields.Text(readonly=True)
    published_by_id = fields.Many2one("res.users", readonly=True)
    archived_by_id = fields.Many2one("res.users", readonly=True)
    archive_reason = fields.Text(readonly=True)
    status_before_deletion = fields.Selection(DOCUMENTARY_STATUSES, readonly=True, copy=False)
    purge_date = fields.Datetime(readonly=True, index=True)
    legal_hold = fields.Boolean(default=False, index=True)
    review_decided_by_id = fields.Many2one("res.users", readonly=True)
    review_decided_at = fields.Datetime(readonly=True)
    resolution = fields.Char(readonly=True)
    codec = fields.Char(readonly=True)
    review_banner_active = fields.Boolean(default=False)
    is_hero = fields.Boolean(
        string="Home hero video",
        default=False,
        index=True,
        help="Shown as the featured video on Documentary Home. Only one per company.",
    )

    @api.model
    def _category_selection(self):
        from .documentary_constants import DOCUMENTARY_CATEGORIES

        return DOCUMENTARY_CATEGORIES

    def _is_manager(self, user=None):
        user = user or self.env.user
        return self.folder_id._is_documentary_manager(user)

    def _is_documentary_admin(self, user=None):
        user = user or self.env.user
        return user.has_group("base.group_system") or user.has_group(
            "cleon_company_documentary.group_company_documentary_admin"
        )

    def _is_approver(self, user=None):
        """Supervisors and administrators may review submissions."""
        return self._is_manager(user)

    def _is_publisher(self, user=None):
        """SRS: only administrators publish to the library."""
        return self._is_documentary_admin(user)

    def _audit_lifecycle(self, event, from_status=None, to_status=None, extra=None):
        meta = dict(extra or {})
        if from_status:
            meta["from_status"] = from_status
        if to_status:
            meta["to_status"] = to_status
        meta["version_number"] = self.current_version_number
        self.env["company.documentary.audit"].sudo().create({
            "event_type": event,
            "media_id": self.id,
            "user_id": self.env.user.id,
            "employee_id": self.env.user.employee_id.id if self.env.user.employee_id else False,
            "metadata": meta,
        })

    def _notify_lifecycle(self, event, extra=None):
        self.env["company.documentary.notification.service"].sudo().notify_lifecycle(
            self, event, extra=extra
        )

    def _transition(self, to_status, **values):
        self.ensure_one()
        from_status = self.status
        if from_status == to_status:
            return
        values["status"] = to_status
        self.with_context(lifecycle_write=True).write(values)
        self._audit_lifecycle("lifecycle_transition", from_status=from_status, to_status=to_status)

    def _assert_not_locked_for_review(self):
        self.ensure_one()
        if self.status == "pending_review":
            raise UserError(_("This documentary is pending review and cannot be edited."))

    def lifecycle_mark_processing_failed(self, reason):
        self.ensure_one()
        self._transition(
            "processing_failed",
            processing_state="failed",
            processing_error=reason or _("Processing failed."),
        )
        self._audit_lifecycle("processing_failed", extra={"reason": reason})
        self._notify_lifecycle("processing_failed", extra={"reason": reason})

    def lifecycle_complete_processing(self):
        """Called when async processing finishes (or stub completes)."""
        for media in self:
            if media.status not in ("processing",):
                continue
            media.write({
                "processing_state": "ready",
                "processing_error": False,
            })
            if media.current_version_number == 0:
                media._create_version_from_current(change_note=_("Initial upload"), is_live=False)
            media._transition("draft")

    def lifecycle_submit_for_review(self):
        for media in self:
            if media.status not in ("draft", "returned"):
                raise UserError(_("Only draft or returned documentaries can be submitted for review."))
            media._assert_can_edit()
            media._transition(
                "pending_review",
                submitted_by_id=media.env.user.id,
                submitted_at=fields.Datetime.now(),
            )
            media._audit_lifecycle("submitted")
            media._notify_lifecycle("submitted")

    def lifecycle_withdraw(self):
        for media in self:
            if media.status != "pending_review":
                raise UserError(_("Only pending review items can be withdrawn."))
            if media.submitted_by_id != media.env.user:
                raise UserError(_("Only the submitter can withdraw this submission."))
            media._transition("draft")
            media._audit_lifecycle("withdrawn")

    def _assert_reviewer_not_submitter(self):
        self.ensure_one()
        if self.submitted_by_id and self.submitted_by_id == self.env.user:
            raise AccessError(_("You cannot review your own submission."))

    def lifecycle_approve(self):
        for media in self:
            if media.status != "pending_review":
                raise UserError(_("Only pending review items can be approved."))
            media._assert_reviewer_not_submitter()
            if media.review_decided_by_id:
                raise UserError(_("Already decided by %s") % media.review_decided_by_id.name)
            media._transition(
                "approved",
                review_decided_by_id=media.env.user.id,
                review_decided_at=fields.Datetime.now(),
            )
            media._audit_lifecycle("approved")
            media._notify_lifecycle("approved")

    def lifecycle_approve_and_publish(self):
        for media in self:
            if media.status != "pending_review":
                raise UserError(_("Only pending review items can be approved and published."))
            media._assert_reviewer_not_submitter()
            if media.review_decided_by_id:
                raise UserError(_("Already decided by %s") % media.review_decided_by_id.name)
            media._transition(
                "approved",
                review_decided_by_id=media.env.user.id,
                review_decided_at=fields.Datetime.now(),
            )
            media._audit_lifecycle("approved")
            media.lifecycle_publish(notify_audience=False)

    def lifecycle_return_for_correction(self, reason):
        reason = (reason or "").strip()
        if len(reason) < 10:
            raise ValidationError(_("A return reason of at least 10 characters is required."))
        for media in self:
            if media.status != "pending_review":
                raise UserError(_("Only pending review items can be returned."))
            media._assert_reviewer_not_submitter()
            if media.review_decided_by_id:
                raise UserError(_("Already decided by %s") % media.review_decided_by_id.name)
            media._transition(
                "returned",
                return_reason=reason,
                review_decided_by_id=media.env.user.id,
                review_decided_at=fields.Datetime.now(),
            )
            media._audit_lifecycle("returned", extra={"reason": reason})
            media._notify_lifecycle("returned", extra={"reason": reason})

    def lifecycle_publish(self, notify_audience=False):
        for media in self:
            media._assert_can_publish()
            now = fields.Datetime.now()
            media._promote_live_version(now)
            media._transition(
                "published",
                published_at=now,
                published_by_id=media.env.user.id,
            )
            media._revoke_external_share_links()
            media._audit_lifecycle("published", extra={"notify_audience": notify_audience})
            media._notify_lifecycle("published")

    def lifecycle_archive(self, reason):
        reason = (reason or "").strip()
        if len(reason) < 3:
            raise ValidationError(_("An archive reason is required."))
        for media in self:
            if media.status != "published":
                raise UserError(_("Only published documentaries can be archived."))
            media._transition(
                "archived",
                active=False,
                archived_by_id=media.env.user.id,
                archive_reason=reason,
            )
            media._revoke_external_share_links()
            media._audit_lifecycle("archived", extra={"reason": reason})

    def lifecycle_republish_request(self):
        company = self.env.company
        for media in self:
            if media.status != "archived":
                raise UserError(_("Only archived documentaries can be republished."))
            if company.documentary_require_upload_approval:
                media.write({
                    "status": "pending_review",
                    "submitted_by_id": media.env.user.id,
                    "submitted_at": fields.Datetime.now(),
                    "review_decided_by_id": False,
                    "review_decided_at": False,
                })
                media._audit_lifecycle("republish_requested")
            else:
                media.lifecycle_publish()

    def lifecycle_soft_delete(self):
        for media in self:
            if media.status == "deleted":
                continue
            before = media.status
            purge = media._compute_purge_date(fields.Datetime.now())
            media._transition(
                "deleted",
                status_before_deletion=before,
                active=False,
                deleted_at=fields.Datetime.now(),
                deleted_by=media.env.user.id,
                purge_date=purge,
            )
            media._revoke_external_share_links()
            media._audit_lifecycle("deleted")

    def lifecycle_restore_from_bin(self):
        for media in self:
            if media.status != "deleted":
                raise UserError(_("This item is not in the recycle bin."))
            restore_status = media.status_before_deletion or "draft"
            if restore_status == "published":
                restore_status = "archived"
            media.write({
                "status": restore_status,
                "active": True,
                "deleted_at": False,
                "deleted_by": False,
                "purge_date": False,
            })
            media._audit_lifecycle("restored", to_status=restore_status)

    def _assert_can_edit(self):
        self.ensure_one()
        if not self._user_can_edit():
            raise AccessError(_("You do not have permission to edit this video."))
        self._assert_not_locked_for_review()

    def _assert_can_publish(self):
        self.ensure_one()
        if self.processing_state != "ready":
            raise UserError(_("Processing is not complete."))
        if not self.name or not self.category:
            raise UserError(_("Title and category are required before publishing."))
        if self.scope_mode == "override" and self.access_scope == "department" and not self.department_ids:
            raise UserError(_("Audience department is required."))
        if not self.thumbnail_key:
            raise UserError(_("A thumbnail is required before publishing."))
        if self.status not in ("approved", "draft"):
            raise UserError(_("Only approved or draft documentaries can be published."))
        company = self.company_id
        if (
            self.status == "draft"
            and company.documentary_require_upload_approval
            and not self._is_documentary_admin()
        ):
            raise UserError(_("Upload approval is required before publishing."))
        if not self._is_publisher():
            raise AccessError(_("Documentary Administrator access is required to publish."))

    def _compute_purge_date(self, deleted_at):
        company = self.company_id
        years = company.documentary_retention_years or 7
        return deleted_at + timedelta(days=years * 365)

    def _create_version_from_current(self, change_note="", is_live=False):
        self.ensure_one()
        next_number = (self.current_version_number or 0) + 1
        captions = [
            {
                "language": sub.language,
                "name": sub.name,
                "format": sub.format,
            }
            for sub in self.subtitle_ids.filtered("active")
        ]
        version = self.env["company.documentary.version"].sudo().create({
            "media_id": self.id,
            "version_number": next_number,
            "is_live": is_live,
            "storage_key": self.storage_key,
            "variants": self.variants or {},
            "thumbnail_key": self.thumbnail_key,
            "duration_seconds": self.duration_seconds,
            "resolution": self.resolution,
            "codec": self.codec,
            "file_size": self.file_size,
            "transcript_snapshot": self.transcript or "",
            "captions_snapshot": captions,
            "change_note": change_note,
            "created_by_id": self.env.user.id,
        })
        self.write({"current_version_number": next_number, "live_version_id": version.id if is_live else self.live_version_id.id})
        self._audit_lifecycle("version_created", extra={"version_number": next_number})
        return version

    def _promote_live_version(self, when=None):
        self.ensure_one()
        when = when or fields.Datetime.now()
        if self.live_version_id:
            self.live_version_id.write({"is_live": False, "live_to": when})
        version = self._create_version_from_current(change_note=_("Published"), is_live=True)
        version.write({"is_live": True, "live_from": when})

    def _revoke_external_share_links(self):
        for media in self:
            links = media.share_link_ids.filtered(lambda link: not link.revoked_at)
            links.write({
                "revoked_at": fields.Datetime.now(),
                "revoked_by_id": media.env.user.id,
            })

    def _assert_can_purge(self):
        self.ensure_one()
        if self.legal_hold:
            raise UserError(_("This documentary is on legal hold and cannot be purged."))
        if self.purge_date and fields.Datetime.now() < self.purge_date:
            raise UserError(_("Permanent delete is not allowed before the purge date."))

    def action_permanent_delete(self):
        for media in self:
            if not media.folder_id._is_documentary_manager():
                raise AccessError(_("Documentary Manager access is required to permanently delete videos."))
            media._assert_can_purge()
            media._write_disposition_record()
        return super(CompanyDocumentaryMediaLifecycle, self).action_permanent_delete()

    def _write_disposition_record(self):
        self.ensure_one()
        self.env["company.documentary.disposition"].sudo().create({
            "media_id": self.id,
            "title": self.name,
            "deleted_by_id": self.deleted_by.id if self.deleted_by else False,
            "deleted_at": self.deleted_at,
            "purged_at": fields.Datetime.now(),
            "retention_rule": "purge",
            "company_id": self.company_id.id,
        })

    def _employee_visible_status(self):
        self.ensure_one()
        return self.status == "published"

    def _user_can_view(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        if self._user_can_edit(user) or self.folder_id._is_documentary_manager(user):
            return not self.deleted_at or self.status == "deleted"
        if self.status != "published":
            return False
        if self.deleted_at or not self.active:
            return False
        if self.processing_state != "ready":
            return False
        if not self.folder_id._user_can_view(user):
            return False
        company = self.company_id
        if company.documentary_department_restrictions:
            return self._audience_matches_employee(user)
        return True

    def _audience_matches_employee(self, user=None):
        user = user or self.env.user
        employee = user.employee_id
        if not employee:
            return False
        scope = self.access_scope if self.scope_mode == "override" else self.folder_id.access_scope
        if scope == "company":
            return True
        if scope == "department":
            departments = (
                self.department_ids if self.scope_mode == "override" else self.folder_id.department_ids
            )
            return bool(employee.department_id and employee.department_id in departments)
        return False

    def _is_published_for(self, user=None):
        user = user or self.env.user
        if self._user_can_edit(user) or self.folder_id._is_documentary_manager(user):
            return True
        return self._user_can_view(user)

    def _user_can_download(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        if not self._user_can_view(user):
            return False
        if self.is_internal_only:
            if self._is_manager(user):
                return True
            return False
        company = self.company_id
        if self._is_manager(user):
            return True
        if not company.documentary_employee_download:
            return False
        if self.download_policy == "deny":
            return False
        if self.download_policy == "allow":
            return True
        return self.folder_id.allow_download

    def write(self, vals):
        if vals.get("is_hero"):
            for media in self:
                self.env["company.documentary.media"].sudo().search([
                    ("company_id", "=", media.company_id.id),
                    ("is_hero", "=", True),
                    ("id", "!=", media.id),
                ]).write({"is_hero": False})
        if "status" in vals and not self.env.context.get("lifecycle_write"):
            raise UserError(_("Status can only change through lifecycle actions."))
        if "approval_status" in vals:
            raise UserError(_("Legacy approval status is no longer used."))
        if not self.env.context.get("lifecycle_write"):
            locked = self.filtered(lambda media: media.status == "pending_review")
            if locked and any(key not in ("message_follower_ids", "message_ids") for key in vals):
                raise UserError(_("Pending review documentaries are locked."))
        return super().write(vals)
