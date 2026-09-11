import hashlib
import logging
import math
import re
import uuid
from collections import defaultdict
from datetime import datetime, time, timedelta

from odoo import _, fields, http
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.http import request

from .storage import CloudflareR2Storage

_logger = logging.getLogger(__name__)

MANAGER_GROUP = "cleon_social_gallery.group_social_gallery_manager"
ADMIN_GROUP = "cleon_social_gallery.group_social_gallery_admin"
ALLOWED_MIME_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "video/mp4", "video/webm", "video/quicktime",
}
PART_SIZE = 8 * 1024 * 1024


def _int(value, default=0):
    try:
        return int(value or default)
    except (TypeError, ValueError):
        return default


def _safe_name(filename):
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", (filename or "media")).strip("-")
    return value[:180] or "media"


def _paginate(records, offset=0, limit=50):
    offset = max(_int(offset), 0)
    limit = min(max(_int(limit, 50), 1), 200)
    total = len(records)
    return records[offset:offset + limit], total, offset, limit


BRAND_PINK = "#e83e8c"
LEGACY_PURPLE = {"#9333ea", "#6e5be7", "#7c3aed", "#71639e", "#714b67"}


def _theme_color(value):
    color = (value or "").strip().lower()
    if not color or color in LEGACY_PURPLE:
        return BRAND_PINK
    return value.strip()


class SocialGalleryController(http.Controller):
    def _user(self):
        return request.env.user

    def _company(self):
        return self._user().company_id

    def _is_manager(self):
        user = self._user()
        return (
            user.has_group("base.group_system")
            or user.has_group(ADMIN_GROUP)
            or user.has_group(MANAGER_GROUP)
        )

    def _is_admin(self):
        user = self._user()
        return user.has_group("base.group_system") or user.has_group(ADMIN_GROUP)

    def _error(self, message):
        return {"success": False, "message": message}

    def _audit(self, event_type, entity_type, album=None, media=None, details="", metadata=None):
        request.env["social.gallery.audit"].sudo().create({
            "company_id": self._company().id,
            "event_type": event_type,
            "entity_type": entity_type,
            "album_id": album.id if album else (media.album_id.id if media and media.album_id else False),
            "media_id": media.id if media else False,
            "user_id": self._user().id,
            "details": details,
            "metadata": metadata or {},
        })

    def _album(self, album_id, edit=False):
        album = request.env["social.gallery.album"].sudo().browse(_int(album_id)).exists()
        if not album or album.company_id != self._company():
            raise UserError(_("Album not found."))
        allowed = album._user_can_edit(self._user()) if edit else album._user_can_view(self._user())
        if not allowed:
            raise AccessError(_("You do not have access to this album."))
        return album

    def _media(self, media_id, edit=False):
        media = request.env["social.gallery.media"].sudo().browse(_int(media_id)).exists()
        if not media or media.company_id != self._company():
            raise UserError(_("Media not found."))
        allowed = media._user_can_edit(self._user()) if edit else media._user_can_view(self._user())
        if not allowed:
            raise AccessError(_("You do not have access to this media."))
        return media

    @staticmethod
    def _album_preview_media(album, user):
        preview = request.env["social.gallery.media"].sudo().search([
            ("album_id", "=", album.id),
            ("approval_status", "=", "approved"),
            ("deleted_at", "=", False),
        ], order="create_date desc", limit=1)
        if preview and preview._user_can_view(user):
            return preview
        return False

    @staticmethod
    def _album_data(album, user):
        preview = SocialGalleryController._album_preview_media(album, user)
        return {
            "id": album.id,
            "name": album.name,
            "description": album.description or "",
            "company_id": album.company_id.id,
            "created_by": album.created_by.id,
            "created_by_name": album.created_by.name,
            "cover_available": bool(album.cover_storage_key),
            "preview_media_id": preview.id if preview else False,
            "preview_media_type": preview.media_type if preview else False,
            "visibility": album.visibility,
            "access_scope": album.access_scope,
            "department_ids": album.department_ids.ids,
            "branch_ids": album.branch_ids.ids,
            "employee_ids": album.employee_ids.ids,
            "status": album.status,
            "is_pinned": user in album.pinned_user_ids,
            "event_name": album.event_name or "",
            "media_count": album.media_count,
            "photo_count": album.photo_count,
            "video_count": album.video_count,
            "total_size": album.total_size,
            "create_date": fields.Datetime.to_string(album.create_date),
            "can_edit": album._user_can_edit(user),
        }

    def _media_data(self, media, user):
        liked = request.env["social.gallery.like"].sudo().search_count([
            ("media_id", "=", media.id), ("user_id", "=", user.id),
        ]) > 0
        retention_days = media.company_id.sg_deleted_retention_days or 365
        purge_date = False
        if media.deleted_at:
            purge_date = fields.Datetime.to_string(
                fields.Datetime.from_string(media.deleted_at) + timedelta(days=retention_days)
            )
        return {
            "id": media.id,
            "display_name": media.display_name,
            "description": media.description or "",
            "album_id": media.album_id.id if media.album_id else False,
            "album_name": media.album_id.name if media.album_id else "",
            "media_type": media.media_type,
            "uploaded_by": media.uploaded_by.id,
            "uploaded_by_name": media.uploaded_by.name,
            "department_id": media.department_id.id if media.department_id else False,
            "branch_id": media.branch_id.id if media.branch_id else False,
            "file_name": media.file_name,
            "mime_type": media.mime_type,
            "file_size": media.file_size,
            "checksum": media.checksum or "",
            "accessible_description": media.accessible_description or "",
            "tag_ids": media.tag_ids.ids,
            "tags": media.tag_ids.mapped("name"),
            "approval_status": media.approval_status,
            "approver_comment": media.approver_comment or "",
            "ai_review_status": media.ai_review_status,
            "ai_moderation_flags": media.ai_moderation_flags or [],
            "ai_moderation_note": media.ai_moderation_note or "",
            "deleted_at": media.deleted_at,
            "purge_date": purge_date,
            "is_pinned": media.is_pinned,
            "comments_enabled": media.comments_enabled,
            "share_token": media.share_token or "",
            "replaces_media_id": media.replaces_media_id.id if media.replaces_media_id else False,
            "version": media.version,
            "edit_metadata": media.edit_metadata or {},
            "view_count": media.view_count,
            "download_count": media.download_count,
            "like_count": media.like_count,
            "comment_count": media.comment_count,
            "liked_by_me": liked,
            "thumbnail_available": bool(media.thumbnail_key),
            "create_date": fields.Datetime.to_string(media.create_date),
            "can_edit": media._user_can_edit(user),
            "can_moderate": media._user_can_moderate(user),
        }

    @staticmethod
    def _settings_data(company):
        return {
            "default_visibility": company.sg_default_visibility,
            "default_destination_album_id": company.sg_default_destination_album_id.id or False,
            "auto_approve_trusted": company.sg_auto_approve_trusted,
            "auto_create_monthly_album": company.sg_auto_create_monthly_album,
            "max_upload_mb": company.sg_max_upload_mb,
            "default_layout": company.sg_default_layout,
            "theme_color": _theme_color(company.sg_theme_color),
            "deleted_retention_days": company.sg_deleted_retention_days,
            "notify_new_upload": company.sg_notify_new_upload,
            "notify_approval_request": company.sg_notify_approval_request,
            "notify_comments": company.sg_notify_comments,
            "notify_likes": company.sg_notify_likes,
            "notify_content_reports": company.sg_notify_content_reports,
            "like_batch_size": company.sg_like_batch_size,
            "weekly_digest": company.sg_weekly_digest,
            "allow_external_share": company.sg_allow_external_share,
            "ai_moderation_enabled": company.sg_ai_moderation_enabled,
        }

    def _comment_data(self, comment):
        return {
            "id": comment.id,
            "media_id": comment.media_id.id,
            "user_id": comment.user_id.id,
            "user_name": comment.user_id.name,
            "body": comment.body,
            "parent_id": comment.parent_id.id if comment.parent_id else False,
            "mentioned_user_ids": comment.mentioned_user_ids.ids,
            "is_hidden": comment.is_hidden,
            "is_edited": comment.is_edited,
            "create_date": fields.Datetime.to_string(comment.create_date),
            "replies": [self._comment_data(r) for r in comment.child_ids.filtered("active")],
        }

    def _is_trusted_user(self, user=None):
        user = user or self._user()
        return bool(request.env["social.gallery.trusted.user"].sudo().search_count([
            ("company_id", "=", self._company().id), ("user_id", "=", user.id),
        ]))

    def _notify(self):
        return request.env["social.gallery.notify"].sudo()

    def _resolve_share_link(self, token, password=None):
        link = request.env["social.gallery.share.link"].sudo().search([
            ("token", "=", (token or "").strip()),
            ("active", "=", True),
            ("company_id", "=", self._company().id),
        ], limit=1)
        if not link:
            raise UserError(_("Share link not found or expired."))
        if link.expires_at and fields.Datetime.from_string(link.expires_at) < fields.Datetime.now():
            raise UserError(_("This share link has expired."))
        if link.password:
            if not link.check_password(password):
                raise AccessError(_("Incorrect share password."))
            if not (link.password or "").startswith("pbkdf2_sha256$") and password:
                link.sudo().write(
                    {"password": link._prepare_password(password)}
                )
        if link.recipient_user_ids and self._user() not in link.recipient_user_ids and not self._is_manager():
            raise AccessError(_("You are not authorized to view this shared content."))
        return link

    def _resolve_auto_album(self):
        company = self._company()
        if company.sg_default_destination_album_id:
            return company.sg_default_destination_album_id
        month_label = fields.Date.today().strftime("Gallery — %B %Y")
        album = request.env["social.gallery.album"].sudo().search([
            ("company_id", "=", company.id), ("name", "=", month_label),
        ], limit=1)
        if album:
            return album
        if company.sg_auto_create_monthly_album:
            return request.env["social.gallery.album"].sudo().create({
                "name": month_label,
                "company_id": company.id,
                "created_by": self._user().id,
                "visibility": company.sg_default_visibility,
                "status": "approved",
            })
        return False

    # ── Storage ─────────────────────────────────────────────────────────────

    @http.route("/api/social-gallery/storage/config", type="json", auth="user", methods=["POST"], csrf=False)
    def storage_config(self, check=False, **kwargs):
        if not self._is_admin():
            return self._error(_("Only gallery administrators can view storage settings."))
        try:
            storage = CloudflareR2Storage(request.env)
            status = storage.public_status()
            if check and status["configured"]:
                status.update(storage.check_connection())
            return {"success": True, "data": status}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))
        except Exception:
            return self._error(_("Cloudflare R2 could not be reached."))

    # ── Albums ──────────────────────────────────────────────────────────────

    @http.route("/api/social-gallery/albums", type="json", auth="user", methods=["POST"], csrf=False)
    def albums_list(self, search="", status="", sort="newest", offset=0, limit=48, **kwargs):
        try:
            domain = [("company_id", "=", self._company().id), ("active", "=", True)]
            if search:
                domain.append(("name", "ilike", search))
            if status:
                domain.append(("status", "=", status))
            albums = request.env["social.gallery.album"].sudo().search(domain)
            user = self._user()
            visible = albums.filtered(lambda a: a._user_can_view(user))
            if sort == "name":
                visible = visible.sorted(key=lambda a: a.name.lower())
            elif sort == "photos":
                visible = visible.sorted(key=lambda a: a.photo_count, reverse=True)
            elif sort == "size":
                visible = visible.sorted(key=lambda a: a.total_size, reverse=True)
            elif sort == "oldest":
                visible = visible.sorted(key=lambda a: a.create_date)
            else:
                visible = visible.sorted(key=lambda a: a.create_date, reverse=True)
            page, total, offset, limit = _paginate(visible, offset, limit)
            return {
                "success": True,
                "data": [self._album_data(a, user) for a in page],
                "total": total,
                "offset": offset,
                "limit": limit,
            }
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/albums/create", type="json", auth="user", methods=["POST"], csrf=False)
    def albums_create(self, **kwargs):
        try:
            name = (kwargs.get("name") or "").strip()
            if not name:
                raise UserError(_("Album name is required."))
            status = kwargs.get("status") or "approved"
            if not self._is_manager() and kwargs.get("visibility") != "private":
                status = "pending"
            album = request.env["social.gallery.album"].sudo().create({
                "name": name,
                "description": kwargs.get("description") or "",
                "company_id": self._company().id,
                "created_by": self._user().id,
                "visibility": kwargs.get("visibility") or self._company().sg_default_visibility,
                "access_scope": kwargs.get("access_scope") or "company",
                "department_ids": [(6, 0, kwargs.get("department_ids") or [])],
                "branch_ids": [(6, 0, kwargs.get("branch_ids") or [])],
                "employee_ids": [(6, 0, kwargs.get("employee_ids") or [])],
                "status": status,
                "event_name": kwargs.get("event_name") or "",
            })
            self._audit("created", "album", album=album, details=album.name)
            return {"success": True, "data": self._album_data(album, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/albums/update", type="json", auth="user", methods=["POST"], csrf=False)
    def albums_update(self, id, **kwargs):
        try:
            album = self._album(id, edit=True)
            vals = {}
            for key in ("name", "description", "visibility", "access_scope", "status", "event_name"):
                if key in kwargs and kwargs[key] is not None:
                    vals[key] = kwargs[key]
            for key in ("department_ids", "branch_ids", "employee_ids"):
                if key in kwargs:
                    vals[key] = [(6, 0, kwargs[key] or [])]
            if vals:
                album.write(vals)
                self._audit("modified", "album", album=album)
            return {"success": True, "data": self._album_data(album, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/albums/action", type="json", auth="user", methods=["POST"], csrf=False)
    def albums_action(self, id, action, **kwargs):
        try:
            album = self._album(id, edit=True)
            if action == "archive":
                album.write({"status": "archived"})
            elif action == "restore":
                album.write({"status": "approved"})
            elif action == "delete":
                album.write({"active": False})
                self._audit("deleted", "album", album=album)
            elif action == "approve" and self._is_manager():
                album.write({"status": "approved"})
                self._audit("approved", "album", album=album)
            elif action == "reject" and self._is_manager():
                album.write({"status": "rejected"})
                self._audit("rejected", "album", album=album)
            else:
                raise UserError(_("Unsupported album action."))
            return {"success": True, "data": self._album_data(album, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/albums/pin", type="json", auth="user", methods=["POST"], csrf=False)
    def albums_pin(self, id, pinned=True, **kwargs):
        try:
            album = self._album(id)
            user = self._user()
            if pinned:
                album.pinned_user_ids = [(4, user.id)]
            else:
                album.pinned_user_ids = [(3, user.id)]
            return {"success": True, "data": self._album_data(album, user)}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    # ── Media ───────────────────────────────────────────────────────────────

    @http.route("/api/social-gallery/media", type="json", auth="user", methods=["POST"], csrf=False)
    def media_list(self, album_id=None, search="", media_type="", approval_status="", include_deleted=False, sort="newest", offset=0, limit=48, **kwargs):
        try:
            domain = [("company_id", "=", self._company().id), ("active", "=", True)]
            if album_id:
                domain.append(("album_id", "=", _int(album_id)))
            if search:
                domain.append("|")
                domain.extend([("display_name", "ilike", search), ("file_name", "ilike", search)])
            if media_type:
                domain.append(("media_type", "=", media_type))
            if approval_status:
                domain.append(("approval_status", "=", approval_status))
            if not include_deleted:
                domain.append(("deleted_at", "=", False))
            media = request.env["social.gallery.media"].sudo().search(domain)
            user = self._user()
            visible = media.filtered(lambda m: m._user_can_view(user))
            if sort == "name":
                visible = visible.sorted(key=lambda m: m.display_name.lower())
            elif sort == "oldest":
                visible = visible.sorted(key=lambda m: m.create_date)
            elif sort == "size":
                visible = visible.sorted(key=lambda m: m.file_size, reverse=True)
            else:
                visible = visible.sorted(key=lambda m: m.create_date, reverse=True)
            page, total, offset, limit = _paginate(visible, offset, limit)
            return {
                "success": True,
                "data": [self._media_data(m, user) for m in page],
                "total": total,
                "offset": offset,
                "limit": limit,
            }
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/media/update", type="json", auth="user", methods=["POST"], csrf=False)
    def media_update(self, id, **kwargs):
        try:
            media = self._media(id, edit=True)
            vals = {}
            for key in ("display_name", "description", "accessible_description", "comments_enabled", "is_pinned", "edit_metadata"):
                if key in kwargs:
                    vals[key] = kwargs[key]
            if "tag_ids" in kwargs:
                vals["tag_ids"] = [(6, 0, kwargs["tag_ids"] or [])]
            if "album_id" in kwargs and kwargs["album_id"]:
                self._album(kwargs["album_id"], edit=True)
                vals["album_id"] = _int(kwargs["album_id"])
            if vals:
                media.write(vals)
                self._audit("modified", "media", media=media)
            return {"success": True, "data": self._media_data(media, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/media/action", type="json", auth="user", methods=["POST"], csrf=False)
    def media_action(self, id, action, **kwargs):
        try:
            media = self._media(id, edit=action in ("delete", "restore", "purge", "pin", "unpin"))
            user = self._user()
            if action == "delete":
                media.action_soft_delete()
                self._audit("deleted", "media", media=media)
            elif action == "restore" and self._is_manager():
                media.action_restore()
                self._audit("restored", "media", media=media)
            elif action == "purge" and self._is_admin():
                media_id = media.id
                media.unlink()
                return {"success": True, "data": {"purged": True, "id": media_id}}
            elif action == "pin":
                media.is_pinned = True
            elif action == "unpin":
                media.is_pinned = False
            elif action == "view":
                media.view_count += 1
            else:
                raise UserError(_("Unsupported media action."))
            return {"success": True, "data": self._media_data(media, user)}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/media/batch-action", type="json", auth="user", methods=["POST"], csrf=False)
    def media_batch_action(self, ids, action, album_id=None, comment=None, **kwargs):
        try:
            if not self._is_manager():
                raise AccessError(_("Only managers can perform batch actions."))
            media = request.env["social.gallery.media"].sudo().browse([_int(i) for i in (ids or [])]).exists()
            media = media.filtered(lambda m: m.company_id == self._company())
            if action == "approve":
                media.action_approve(album_id=_int(album_id) if album_id else None, comment=comment)
            elif action == "reject":
                media.action_reject(comment=comment)
            elif action == "delete":
                media.action_soft_delete()
            elif action == "restore":
                media.action_restore()
            elif action == "move":
                album = self._album(album_id, edit=True)
                media.write({"album_id": album.id})
            else:
                raise UserError(_("Unsupported batch action."))
            return {"success": True, "data": {"count": len(media)}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/media/approval", type="json", auth="user", methods=["POST"], csrf=False)
    def media_approval(self, id, action, album_id=None, comment=None, **kwargs):
        try:
            if not self._is_manager():
                raise AccessError(_("Only managers can approve media."))
            media = self._media(id)
            if action == "approve":
                media.action_approve(album_id=_int(album_id) if album_id else None, comment=comment)
                self._audit("approved", "media", media=media)
            elif action == "reject":
                media.action_reject(comment=comment)
                self._audit("rejected", "media", media=media)
            else:
                raise UserError(_("Unsupported approval action."))
            return {"success": True, "data": self._media_data(media, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/media/move", type="json", auth="user", methods=["POST"], csrf=False)
    def media_move(self, id, album_id, **kwargs):
        try:
            media = self._media(id, edit=True)
            album = self._album(album_id, edit=True)
            media.album_id = album.id
            self._audit("modified", "media", media=media, details="Moved to %s" % album.name)
            return {"success": True, "data": self._media_data(media, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/media/report", type="json", auth="user", methods=["POST"], csrf=False)
    def media_report(self, id, reason, details="", **kwargs):
        try:
            media = self._media(id)
            report = request.env["social.gallery.report"].sudo().create({
                "media_id": media.id,
                "reporter_id": self._user().id,
                "reason": reason,
                "details": details,
            })
            self._audit("reported", "media", media=media, details=reason)
            self._notify().notify_content_report(report)
            return {"success": True, "data": {"id": report.id}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/media/similar", type="json", auth="user", methods=["POST"], csrf=False)
    def media_similar(self, id, **kwargs):
        try:
            media = self._media(id)
            domain = [
                ("company_id", "=", self._company().id),
                ("id", "!=", media.id),
                ("deleted_at", "=", False),
                ("approval_status", "=", "approved"),
            ]
            if media.album_id:
                domain.append(("album_id", "=", media.album_id.id))
            similar = request.env["social.gallery.media"].sudo().search(domain, limit=12)
            user = self._user()
            return {"success": True, "data": [self._media_data(m, user) for m in similar if m._user_can_view(user)]}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/media/versions", type="json", auth="user", methods=["POST"], csrf=False)
    def media_versions(self, id, **kwargs):
        try:
            media = self._media(id)
            chain = request.env["social.gallery.media"].sudo().search([
                "|", ("id", "=", media.id),
                ("replaces_media_id", "=", media.replaces_media_id.id if media.replaces_media_id else media.id),
            ], order="version desc")
            user = self._user()
            return {"success": True, "data": [self._media_data(m, user) for m in chain if m._user_can_view(user)]}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    # ── Uploads ─────────────────────────────────────────────────────────────

    @http.route("/api/social-gallery/uploads/initiate", type="json", auth="user", methods=["POST"], csrf=False)
    def uploads_initiate(self, file_name, mime_type, file_size, album_id=None, **kwargs):
        try:
            if mime_type not in ALLOWED_MIME_TYPES:
                raise UserError(_("Unsupported file type."))
            max_mb = self._company().sg_max_upload_mb or 25
            if _int(file_size) > max_mb * 1024 * 1024:
                raise UserError(_("File exceeds maximum upload size."))
            if album_id:
                self._album(album_id, edit=True)
            storage = CloudflareR2Storage(request.env)
            if not storage.is_configured():
                raise UserError(_("Storage is not configured."))
            try:
                storage.ensure_bucket_cors()
            except Exception:
                _logger.warning("Could not refresh Social Gallery R2 CORS policy", exc_info=True)
            safe = _safe_name(file_name)
            object_key = "social-gallery/%s/%s-%s" % (self._company().id, uuid.uuid4().hex, safe)
            upload_id = storage.initiate_multipart(object_key, mime_type)
            session = request.env["social.gallery.upload"].sudo().create({
                "company_id": self._company().id,
                "user_id": self._user().id,
                "album_id": _int(album_id) if album_id else False,
                "object_key": object_key,
                "upload_id": upload_id,
                "file_name": file_name,
                "mime_type": mime_type,
                "file_size": _int(file_size),
            })
            part_count = max(1, math.ceil(_int(file_size) / PART_SIZE))
            return {"success": True, "data": {
                "session_id": session.id,
                "object_key": object_key,
                "upload_id": upload_id,
                "part_size": PART_SIZE,
                "part_count": part_count,
            }}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/uploads/part-url", type="json", auth="user", methods=["POST"], csrf=False)
    def uploads_part_url(self, session_id, part_number, **kwargs):
        try:
            session = request.env["social.gallery.upload"].sudo().browse(_int(session_id)).exists()
            if not session or session.user_id != self._user() or session.state != "active":
                raise UserError(_("Upload session not found."))
            storage = CloudflareR2Storage(request.env)
            url = storage.sign_part(session.object_key, session.upload_id, _int(part_number))
            return {"success": True, "data": {"url": url, "part_number": _int(part_number)}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/uploads/record-part", type="json", auth="user", methods=["POST"], csrf=False)
    def uploads_record_part(self, session_id, part_number, etag, **kwargs):
        try:
            session = request.env["social.gallery.upload"].sudo().browse(_int(session_id)).exists()
            if not session or session.user_id != self._user() or session.state != "active":
                raise UserError(_("Upload session not found."))
            parts = list(session.parts or [])
            parts.append({"PartNumber": _int(part_number), "ETag": etag})
            session.parts = parts
            return {"success": True, "data": {"parts_recorded": len(parts)}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/uploads/complete", type="json", auth="user", methods=["POST"], csrf=False)
    def uploads_complete(self, session_id, display_name=None, description=None, checksum=None, duplicate_acknowledged=False, **kwargs):
        try:
            session = request.env["social.gallery.upload"].sudo().browse(_int(session_id)).exists()
            if not session or session.user_id != self._user() or session.state != "active":
                raise UserError(_("Upload session not found."))
            storage = CloudflareR2Storage(request.env)

            if checksum and not duplicate_acknowledged:
                dup = request.env["social.gallery.media"].sudo().search([
                    ("company_id", "=", self._company().id),
                    ("checksum", "=", checksum),
                    ("deleted_at", "=", False),
                ], limit=1)
                if dup:
                    storage.abort_multipart(session.object_key, session.upload_id)
                    session.state = "aborted"
                    return {"success": True, "data": {"duplicate_warning": True, "duplicate_id": dup.id}}

            parts = sorted(session.parts or [], key=lambda p: p["PartNumber"])
            storage.complete_multipart(session.object_key, session.upload_id, parts)
            session.state = "completed"

            media_type = "video" if session.mime_type.startswith("video/") else "image"
            employee = self._user().employee_id
            company = self._company()
            if not company.sg_ai_moderation_enabled:
                approval_status = "pending"
            else:
                trusted = self._is_trusted_user()
                auto_approve = trusted and company.sg_auto_approve_trusted
                approval_status = "approved" if auto_approve or self._is_manager() else "pending"
            album = session.album_id or self._resolve_auto_album()

            media = request.env["social.gallery.media"].sudo().create({
                "display_name": display_name or session.file_name,
                "description": description or "",
                "album_id": album.id if album else False,
                "company_id": company.id,
                "media_type": media_type,
                "uploaded_by": self._user().id,
                "department_id": employee.department_id.id if employee and employee.department_id else False,
                "branch_id": getattr(employee, "branch_id", False) and employee.branch_id.id or False,
                "file_name": session.file_name,
                "mime_type": session.mime_type,
                "file_size": session.file_size,
                "checksum": checksum or "",
                "storage_key": session.object_key,
                "approval_status": approval_status,
                "comments_enabled": True,
            })
            session.media_id = media.id

            if not company.sg_ai_moderation_enabled:
                media._mark_manual_review_only()
            elif media_type == "image" and session.object_key:
                image_bytes = storage.get_object_bytes(session.object_key)
                if image_bytes:
                    from odoo.addons.cleon_social_gallery.models.gallery_thumbnail import generate_image_thumbnail

                    thumb_bytes, thumb_mime = generate_image_thumbnail(image_bytes)
                    if thumb_bytes:
                        thumb_key = "%s-thumb.jpg" % session.object_key.rsplit(".", 1)[0]
                        if storage.put_object_bytes(thumb_key, thumb_bytes, thumb_mime):
                            media.thumbnail_key = thumb_key
                media._run_ai_screening(
                    image_bytes=image_bytes,
                    image_mime=session.mime_type,
                )

            request.env["social.gallery.upload.history"].sudo().create({
                "company_id": company.id,
                "user_id": self._user().id,
                "file_name": session.file_name,
                "file_size": session.file_size,
                "mime_type": session.mime_type,
                "status": "success",
                "media_id": media.id,
                "album_id": album.id if album else False,
            })
            self._audit("uploaded", "media", media=media)
            self._notify().notify_new_upload(media)
            if approval_status == "pending":
                self._notify().notify_approval_request(media)
            return {"success": True, "data": self._media_data(media, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            request.env["social.gallery.upload.history"].sudo().create({
                "company_id": self._company().id,
                "user_id": self._user().id,
                "file_name": kwargs.get("file_name") or "unknown",
                "status": "failed",
                "error_message": str(error),
            })
            return self._error(str(error))

    @http.route("/api/social-gallery/uploads/abort", type="json", auth="user", methods=["POST"], csrf=False)
    def uploads_abort(self, session_id, **kwargs):
        try:
            session = request.env["social.gallery.upload"].sudo().browse(_int(session_id)).exists()
            if session and session.user_id == self._user() and session.state == "active":
                storage = CloudflareR2Storage(request.env)
                storage.abort_multipart(session.object_key, session.upload_id)
                session.state = "aborted"
            return {"success": True, "data": {"aborted": True}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/asset-url", type="json", auth="user", methods=["POST"], csrf=False)
    def asset_url(self, media_id, download=False, **kwargs):
        try:
            media = self._media(media_id)
            storage = CloudflareR2Storage(request.env)
            url = storage.signed_object_url(
                media.storage_key, download=download, filename=media.file_name
            )
            if download:
                media.download_count += 1
            return {"success": True, "data": {"url": url}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/thumbnail-url", type="json", auth="user", methods=["POST"], csrf=False)
    def thumbnail_url(self, media_id, **kwargs):
        try:
            media = self._media(media_id)
            key = media.thumbnail_key or media.storage_key
            storage = CloudflareR2Storage(request.env)
            return {"success": True, "data": {"url": storage.signed_object_url(key)}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    # ── Comments & Likes ────────────────────────────────────────────────────

    @http.route("/api/social-gallery/comments", type="json", auth="user", methods=["POST"], csrf=False)
    def comments(self, media_id, action="list", body="", parent_id=None, comment_id=None, mentioned_user_ids=None, **kwargs):
        try:
            media = self._media(media_id)
            if action == "list":
                comments = request.env["social.gallery.comment"].sudo().search([
                    ("media_id", "=", media.id), ("parent_id", "=", False), ("active", "=", True),
                ], order="create_date asc")
                visible = comments.filtered(lambda c: not c.is_hidden or self._is_manager())
                return {"success": True, "data": [self._comment_data(c) for c in visible]}
            if not media.comments_enabled and not self._is_manager():
                raise UserError(_("Comments are disabled for this media."))
            if action == "create":
                comment = request.env["social.gallery.comment"].sudo().create({
                    "media_id": media.id,
                    "body": body,
                    "parent_id": _int(parent_id) if parent_id else False,
                    "mentioned_user_ids": [(6, 0, mentioned_user_ids or [])],
                })
                self._notify().notify_comment(comment)
                return {"success": True, "data": self._comment_data(comment)}
            if action == "edit" and comment_id:
                comment = request.env["social.gallery.comment"].sudo().browse(_int(comment_id)).exists()
                if not comment or comment.media_id.id != media.id:
                    raise UserError(_("Comment not found."))
                if comment.user_id != self._user() and not self._is_manager():
                    raise AccessError(_("You cannot edit this comment."))
                comment.write({"body": body, "is_edited": True})
                return {"success": True, "data": self._comment_data(comment)}
            if action == "delete" and comment_id:
                comment = request.env["social.gallery.comment"].sudo().browse(_int(comment_id)).exists()
                if not comment or comment.media_id.id != media.id:
                    raise UserError(_("Comment not found."))
                if comment.user_id != self._user() and not self._is_manager():
                    raise AccessError(_("You cannot delete this comment."))
                comment.active = False
                return {"success": True, "data": {"deleted": True}}
            if action == "hide" and comment_id and self._is_manager():
                comment = request.env["social.gallery.comment"].sudo().browse(_int(comment_id)).exists()
                if not comment or comment.media_id.id != media.id:
                    raise UserError(_("Comment not found."))
                comment.is_hidden = True
                return {"success": True, "data": self._comment_data(comment)}
            raise UserError(_("Unsupported comment action."))
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/likes", type="json", auth="user", methods=["POST"], csrf=False)
    def likes(self, media_id, action="toggle", **kwargs):
        try:
            media = self._media(media_id)
            Like = request.env["social.gallery.like"].sudo()
            existing = Like.search([("media_id", "=", media.id), ("user_id", "=", self._user().id)], limit=1)
            if action == "toggle":
                if existing:
                    existing.unlink()
                    liked = False
                else:
                    Like.create({"media_id": media.id, "user_id": self._user().id})
                    liked = True
                    self._notify().notify_like(media, self._user())
                media.invalidate_recordset(["like_count"])
                return {"success": True, "data": {"liked": liked, "like_count": media.like_count}}
            return {"success": True, "data": {"liked": bool(existing), "like_count": media.like_count}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    # ── Share ─────────────────────────────────────────────────────────────────

    @http.route("/api/social-gallery/share", type="json", auth="user", methods=["POST"], csrf=False)
    def share(self, media_id=None, album_id=None, action="create", link_id=None, **kwargs):
        try:
            Share = request.env["social.gallery.share.link"].sudo()
            if action == "create":
                vals = {
                    "company_id": self._company().id,
                    "created_by": self._user().id,
                    "is_external": kwargs.get("is_external", False),
                    "password": kwargs.get("password") or False,
                    "expires_at": kwargs.get("expires_at") or False,
                    "recipient_user_ids": [(6, 0, kwargs.get("recipient_user_ids") or [])],
                }
                media = album = None
                if media_id:
                    media = self._media(media_id)
                    vals["media_id"] = media.id
                elif album_id:
                    album = self._album(album_id)
                    vals["album_id"] = album.id
                else:
                    raise UserError(_("Media or album is required."))
                if vals["is_external"] and not self._company().sg_allow_external_share:
                    raise UserError(_("External sharing is disabled."))
                link = Share.create(vals)
                self._audit(
                    "shared",
                    "media" if media else "album",
                    media=media,
                    album=album,
                )
                return {"success": True, "data": {
                    "id": link.id,
                    "token": link.token,
                    "url": "/social-gallery?share=%s" % link.token,
                }}
            if action == "deactivate" and link_id:
                link = Share.browse(_int(link_id)).exists()
                if link.created_by != self._user() and not self._is_admin():
                    raise AccessError(_("You cannot deactivate this link."))
                link.active = False
                return {"success": True, "data": {"deactivated": True}}
            raise UserError(_("Unsupported share action."))
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/share/resolve", type="json", auth="user", methods=["POST"], csrf=False)
    def share_resolve(self, token, password=None, **kwargs):
        try:
            link = self._resolve_share_link(token, password=password)
            user = self._user()
            if link.media_id:
                media = link.media_id
                if media.company_id != self._company() or media.deleted_at:
                    raise UserError(_("Media not found."))
                return {"success": True, "data": {
                    "type": "media",
                    "media": self._media_data(media, user),
                }}
            if link.album_id:
                album = link.album_id
                if not album._user_can_view(user):
                    raise AccessError(_("You do not have access to this album."))
                media = request.env["social.gallery.media"].sudo().search([
                    ("album_id", "=", album.id),
                    ("approval_status", "=", "approved"),
                    ("deleted_at", "=", False),
                ])
                visible = media.filtered(lambda m: m._user_can_view(user))
                return {"success": True, "data": {
                    "type": "album",
                    "album": self._album_data(album, user),
                    "media": [self._media_data(m, user) for m in visible],
                }}
            raise UserError(_("Share link has no content."))
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    # ── Queues ──────────────────────────────────────────────────────────────

    @http.route("/api/social-gallery/pending", type="json", auth="user", methods=["POST"], csrf=False)
    def pending_review(self, **kwargs):
        try:
            if not self._is_manager():
                raise AccessError(_("Only managers can view the pending queue."))
            media = request.env["social.gallery.media"].sudo().search([
                ("company_id", "=", self._company().id),
                ("approval_status", "=", "pending"),
                ("deleted_at", "=", False),
            ], order="create_date asc")
            user = self._user()
            return {"success": True, "data": [self._media_data(m, user) for m in media]}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/pending-ai", type="json", auth="user", methods=["POST"], csrf=False)
    def pending_ai(self, **kwargs):
        try:
            if not self._is_manager():
                raise AccessError(_("Only managers can view AI review."))
            media = request.env["social.gallery.media"].sudo().search([
                ("company_id", "=", self._company().id),
                ("ai_review_status", "=", "flagged"),
                ("deleted_at", "=", False),
            ], order="create_date asc")
            user = self._user()
            return {"success": True, "data": [self._media_data(m, user) for m in media]}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/flagged", type="json", auth="user", methods=["POST"], csrf=False)
    def flagged_content(self, action="list", report_id=None, resolution="", **kwargs):
        try:
            if not self._is_manager():
                raise AccessError(_("Only managers can manage flagged content."))
            Report = request.env["social.gallery.report"].sudo()
            if action == "list":
                reports = Report.search([
                    ("media_id.company_id", "=", self._company().id),
                    ("status", "=", "open"),
                ], order="create_date desc")
                user = self._user()
                return {"success": True, "data": [{
                    "id": r.id,
                    "media_id": r.media_id.id,
                    "media": self._media_data(r.media_id, user),
                    "reason": r.reason,
                    "details": r.details or "",
                    "reporter_name": r.reporter_id.name,
                    "create_date": fields.Datetime.to_string(r.create_date),
                } for r in reports]}
            report = Report.browse(_int(report_id)).exists()
            if not report:
                raise UserError(_("Report not found."))
            if action == "dismiss":
                report.write({"status": "dismissed", "resolved_by": self._user().id, "resolved_at": fields.Datetime.now()})
            elif action == "remove":
                report.media_id.action_soft_delete()
                report.write({"status": "removed", "resolved_by": self._user().id, "resolved_at": fields.Datetime.now()})
            elif action == "batch_dismiss":
                reports = Report.browse([_int(i) for i in (kwargs.get("report_ids") or [])]).exists()
                reports = reports.filtered(lambda item: item.media_id.company_id == self._company())
                reports.write({
                    "status": "dismissed",
                    "resolved_by": self._user().id,
                    "resolved_at": fields.Datetime.now(),
                })
                return {"success": True, "data": {"count": len(reports)}}
            elif action == "batch_remove":
                reports = Report.browse([_int(i) for i in (kwargs.get("report_ids") or [])]).exists()
                reports = reports.filtered(lambda item: item.media_id.company_id == self._company())
                for item in reports:
                    item.media_id.action_soft_delete()
                    item.write({
                        "status": "removed",
                        "resolved_by": self._user().id,
                        "resolved_at": fields.Datetime.now(),
                    })
                return {"success": True, "data": {"count": len(reports)}}
            return {"success": True, "data": {"resolved": True}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    # ── Employee views ──────────────────────────────────────────────────────

    @http.route("/api/social-gallery/contributions", type="json", auth="user", methods=["POST"], csrf=False)
    def contributions(self, status="", **kwargs):
        try:
            domain = [
                ("company_id", "=", self._company().id),
                ("uploaded_by", "=", self._user().id),
                ("active", "=", True),
                ("deleted_at", "=", False),
            ]
            if status:
                domain.append(("approval_status", "=", status))
            media = request.env["social.gallery.media"].sudo().search(domain, order="create_date desc")
            user = self._user()
            return {"success": True, "data": [self._media_data(m, user) for m in media]}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/upload-history", type="json", auth="user", methods=["POST"], csrf=False)
    def upload_history(self, **kwargs):
        try:
            domain = [("company_id", "=", self._company().id)]
            if not self._is_manager():
                domain.append(("user_id", "=", self._user().id))
            history = request.env["social.gallery.upload.history"].sudo().search(domain, order="create_date desc", limit=200)
            return {"success": True, "data": [{
                "id": h.id,
                "file_name": h.file_name,
                "file_size": h.file_size,
                "mime_type": h.mime_type or "",
                "status": h.status,
                "error_message": h.error_message or "",
                "media_id": h.media_id.id if h.media_id else False,
                "create_date": fields.Datetime.to_string(h.create_date),
            } for h in history]}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    # ── Admin ─────────────────────────────────────────────────────────────────

    @http.route("/api/social-gallery/recycle-bin", type="json", auth="user", methods=["POST"], csrf=False)
    def recycle_bin(self, **kwargs):
        try:
            if not self._is_manager():
                raise AccessError(_("Only managers can view the recycle bin."))
            media = request.env["social.gallery.media"].sudo().search([
                ("company_id", "=", self._company().id),
                ("deleted_at", "!=", False),
            ], order="deleted_at desc")
            user = self._user()
            return {"success": True, "data": [self._media_data(m, user) for m in media]}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/recycle-bin/clear", type="json", auth="user", methods=["POST"], csrf=False)
    def recycle_bin_clear(self, ids=None, **kwargs):
        try:
            if not self._is_admin():
                raise AccessError(_("Only administrators can permanently delete items."))
            media = request.env["social.gallery.media"].sudo().browse([_int(i) for i in (ids or [])]).exists()
            media = media.filtered(lambda m: m.company_id == self._company() and m.deleted_at)
            count = len(media)
            media.unlink()
            return {"success": True, "data": {"purged": count}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/audit", type="json", auth="user", methods=["POST"], csrf=False)
    def audit_log(self, event_type="", entity_type="", offset=0, limit=100, **kwargs):
        try:
            if not self._is_manager():
                raise AccessError(_("Only managers can view audit logs."))
            domain = [("company_id", "=", self._company().id)]
            if event_type:
                domain.append(("event_type", "=", event_type))
            if entity_type:
                domain.append(("entity_type", "=", entity_type))
            offset = max(_int(offset), 0)
            limit = min(max(_int(limit, 100), 1), 200)
            Audit = request.env["social.gallery.audit"].sudo()
            total = Audit.search_count(domain)
            logs = Audit.search(domain, order="create_date desc", offset=offset, limit=limit)
            return {
                "success": True,
                "data": [{
                    "id": log.id,
                    "event_type": log.event_type,
                    "entity_type": log.entity_type,
                    "album_id": log.album_id.id if log.album_id else False,
                    "media_id": log.media_id.id if log.media_id else False,
                    "user_name": log.user_id.name,
                    "details": log.details or "",
                    "create_date": fields.Datetime.to_string(log.create_date),
                } for log in logs],
                "total": total,
                "offset": offset,
                "limit": limit,
            }
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/scope-targets", type="json", auth="user", methods=["POST"], csrf=False)
    def scope_targets(self, **kwargs):
        try:
            company = self._company()
            departments = request.env["hr.department"].sudo().search([
                "|", ("company_id", "=", company.id), ("company_id", "=", False),
            ])
            employees = request.env["hr.employee"].sudo().search([
                ("company_id", "=", company.id),
                ("active", "=", True),
            ])
            branches = []
            if "multi.branch" in request.env:
                branches = request.env["multi.branch"].sudo().search([])
            return {
                "success": True,
                "data": {
                    "departments": [{"id": d.id, "name": d.name} for d in departments],
                    "branches": [{"id": b.id, "name": b.name} for b in branches],
                    "employees": [
                        {
                            "id": e.id,
                            "name": e.name,
                            "department": e.department_id.name if e.department_id else "",
                        }
                        for e in employees
                    ],
                    "branches_available": bool(branches),
                },
            }
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/settings", type="json", auth="user", methods=["POST"], csrf=False)
    def settings(self, **kwargs):
        try:
            company = self._company()
            if not kwargs.get("save") and not self._is_admin():
                raise AccessError(_("Only administrators can view gallery settings."))
            if kwargs.get("save"):
                if not self._is_admin():
                    raise AccessError(_("Only administrators can change settings."))
                field_map = {
                    "default_visibility": "sg_default_visibility",
                    "default_destination_album_id": "sg_default_destination_album_id",
                    "auto_approve_trusted": "sg_auto_approve_trusted",
                    "auto_create_monthly_album": "sg_auto_create_monthly_album",
                    "max_upload_mb": "sg_max_upload_mb",
                    "default_layout": "sg_default_layout",
                    "theme_color": "sg_theme_color",
                    "deleted_retention_days": "sg_deleted_retention_days",
                    "notify_new_upload": "sg_notify_new_upload",
                    "notify_approval_request": "sg_notify_approval_request",
                    "notify_comments": "sg_notify_comments",
                    "notify_likes": "sg_notify_likes",
                    "notify_content_reports": "sg_notify_content_reports",
                    "like_batch_size": "sg_like_batch_size",
                    "weekly_digest": "sg_weekly_digest",
                    "allow_external_share": "sg_allow_external_share",
                    "ai_moderation_enabled": "sg_ai_moderation_enabled",
                }
                vals = {}
                for api_key, odoo_field in field_map.items():
                    if api_key in kwargs:
                        vals[odoo_field] = kwargs[api_key]
                if vals:
                    company.write(vals)
            return {"success": True, "data": self._settings_data(company)}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/users/search", type="json", auth="user", methods=["POST"], csrf=False)
    def users_search(self, search="", limit=20, **kwargs):
        try:
            if not self._is_admin():
                raise AccessError(_("Only administrators can search users."))
            term = (search or "").strip()
            company = self._company()
            domain = [
                ("share", "=", False),
                ("active", "=", True),
                ("company_id", "=", company.id),
            ]
            if term:
                domain += [
                    "|", "|",
                    ("name", "ilike", term),
                    ("login", "ilike", term),
                    ("email", "ilike", term),
                ]
            users = request.env["res.users"].sudo().search(
                domain,
                limit=min(max(_int(limit, 20), 1), 50),
                order="name",
            )
            return {"success": True, "data": [{
                "id": user.id,
                "name": user.name,
                "email": user.email or user.login or "",
            } for user in users]}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/trusted-users", type="json", auth="user", methods=["POST"], csrf=False)
    def trusted_users(self, action="list", user_id=None, **kwargs):
        try:
            if not self._is_admin():
                raise AccessError(_("Only administrators can manage trusted users."))
            Trusted = request.env["social.gallery.trusted.user"].sudo()
            if action == "list":
                records = Trusted.search([("company_id", "=", self._company().id)])
                return {"success": True, "data": [{
                    "id": r.id,
                    "user_id": r.user_id.id,
                    "user_name": r.user_id.name,
                    "notes": r.notes or "",
                } for r in records]}
            if action == "add" and user_id:
                record = Trusted.create({
                    "company_id": self._company().id,
                    "user_id": _int(user_id),
                    "notes": kwargs.get("notes") or "",
                })
                return {"success": True, "data": {"id": record.id}}
            if action == "remove" and user_id:
                Trusted.search([
                    ("company_id", "=", self._company().id),
                    ("user_id", "=", _int(user_id)),
                ]).unlink()
                return {"success": True, "data": {"removed": True}}
            raise UserError(_("Unsupported trusted user action."))
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/tags", type="json", auth="user", methods=["POST"], csrf=False)
    def tags(self, action="list", name="", tag_id=None, **kwargs):
        try:
            Tag = request.env["social.gallery.tag"].sudo()
            if action == "list":
                tags = Tag.search([("company_id", "=", self._company().id)], order="name")
                return {"success": True, "data": [{"id": t.id, "name": t.name, "color": t.color} for t in tags]}
            if action == "create" and name:
                tag = Tag.create({"name": name.strip(), "company_id": self._company().id})
                return {"success": True, "data": {"id": tag.id, "name": tag.name}}
            if action == "delete" and tag_id and self._is_manager():
                Tag.browse(_int(tag_id)).unlink()
                return {"success": True, "data": {"deleted": True}}
            raise UserError(_("Unsupported tag action."))
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/duplicates/scan", type="json", auth="user", methods=["POST"], csrf=False)
    def duplicates_scan(self, **kwargs):
        try:
            if not self._is_manager():
                raise AccessError(_("Only managers can scan for duplicates."))
            media = request.env["social.gallery.media"].sudo().search([
                ("company_id", "=", self._company().id),
                ("deleted_at", "=", False),
                ("checksum", "!=", False),
            ])
            groups = defaultdict(list)
            for item in media:
                groups[item.checksum].append(item)
            duplicates = []
            user = self._user()
            for checksum, items in groups.items():
                if len(items) > 1:
                    duplicates.append({
                        "checksum": checksum,
                        "count": len(items),
                        "items": [self._media_data(m, user) for m in items],
                    })
            return {"success": True, "data": duplicates}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/duplicates/action", type="json", auth="user", methods=["POST"], csrf=False)
    def duplicates_action(self, ids, action="delete", **kwargs):
        try:
            if not self._is_manager():
                raise AccessError(_("Only managers can manage duplicates."))
            media = request.env["social.gallery.media"].sudo().browse([_int(i) for i in (ids or [])]).exists()
            media = media.filtered(lambda m: m.company_id == self._company())
            if action == "delete":
                media.action_soft_delete()
            return {"success": True, "data": {"count": len(media)}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    def _album_dashboard_data(self, album, user):
        return self._album_data(album, user)

    @http.route("/api/social-gallery/analytics/dashboard", type="json", auth="user", methods=["POST"], csrf=False)
    def analytics_dashboard(self, **kwargs):
        try:
            company = self._company()
            Media = request.env["social.gallery.media"].sudo()
            Album = request.env["social.gallery.album"].sudo()
            base_domain = [("company_id", "=", company.id), ("deleted_at", "=", False)]
            all_media = Media.search(base_domain)
            approved = all_media.filtered(lambda m: m.approval_status == "approved")
            today = fields.Date.today()
            today_start = fields.Datetime.to_string(datetime.combine(today, time.min))
            week_start = fields.Datetime.to_string(datetime.combine(today - timedelta(days=6), time.min))
            today_uploads = Media.search_count(base_domain + [("create_date", ">=", today_start)])
            week_uploads = Media.search_count(base_domain + [("create_date", ">=", week_start)])
            pending = Media.search_count(base_domain + [("approval_status", "=", "pending")])

            dept_stats = defaultdict(lambda: {"uploads": 0, "likes": 0, "comments": 0})
            for m in approved:
                dept_name = m.department_id.name if m.department_id else "Unassigned"
                dept_stats[dept_name]["uploads"] += 1
                dept_stats[dept_name]["likes"] += m.like_count
                dept_stats[dept_name]["comments"] += m.comment_count

            top_contributors = defaultdict(int)
            for m in approved:
                top_contributors[m.uploaded_by.name] += 1

            recent_activity = request.env["social.gallery.audit"].sudo().search([
                ("company_id", "=", company.id),
            ], order="create_date desc", limit=20)

            albums = Album.search([("company_id", "=", company.id), ("active", "=", True)], order="create_date desc", limit=6)
            user = self._user()
            visible_approved = approved.filtered(lambda m: m._user_can_view(user))
            trending = sorted(
                visible_approved,
                key=lambda m: (m.like_count or 0) + (m.comment_count or 0) * 2 + (m.view_count or 0) * 0.1,
                reverse=True,
            )[:8]
            recent_media = visible_approved.sorted("create_date", reverse=True)[:8]

            upload_trend = []
            for offset in range(6, -1, -1):
                day = today - timedelta(days=offset)
                day_start = fields.Datetime.to_string(datetime.combine(day, time.min))
                day_end = fields.Datetime.to_string(datetime.combine(day, time.max))
                upload_trend.append({
                    "date": fields.Date.to_string(day),
                    "label": day.strftime("%a"),
                    "count": Media.search_count(base_domain + [
                        ("create_date", ">=", day_start),
                        ("create_date", "<=", day_end),
                    ]),
                })

            employee = user.employee_id
            user_department = employee.department_id.name if employee and employee.department_id else False

            def _engagement_score(stats):
                return stats["uploads"] * 10 + stats["likes"] * 3 + stats["comments"] * 5

            dept_rows = []
            for dept_name, stats in dept_stats.items():
                score = _engagement_score(stats)
                dept_rows.append({
                    "department": dept_name,
                    "uploads": stats["uploads"],
                    "likes": stats["likes"],
                    "comments": stats["comments"],
                    "engagement_score": score,
                })
            dept_rows.sort(key=lambda row: row["engagement_score"], reverse=True)
            leader_score = dept_rows[0]["engagement_score"] if dept_rows else 0
            total_score = sum(row["engagement_score"] for row in dept_rows) or 1
            for index, row in enumerate(dept_rows, start=1):
                row["rank"] = index
                row["gap_to_leader"] = max(leader_score - row["engagement_score"], 0)
                row["score_share"] = round((row["engagement_score"] / total_score) * 100, 1) if total_score else 0
                row["is_user_department"] = bool(user_department and row["department"] == user_department)

            return {"success": True, "data": {
                "total_albums": Album.search_count([("company_id", "=", company.id), ("active", "=", True)]),
                "total_media": len(approved),
                "photo_count": len(approved.filtered(lambda m: m.media_type == "image")),
                "video_count": len(approved.filtered(lambda m: m.media_type == "video")),
                "storage_used": sum(approved.mapped("file_size")),
                "today_uploads": today_uploads,
                "week_uploads": week_uploads,
                "pending_approvals": pending,
                "total_likes": sum(approved.mapped("like_count")),
                "total_comments": sum(approved.mapped("comment_count")),
                "total_views": sum(approved.mapped("view_count")),
                "upload_trend": upload_trend,
                "user_department": user_department or False,
                "leaderboard_period": "all_time",
                "department_engagement": dept_rows,
                "top_contributors": [
                    {"name": k, "uploads": v} for k, v in sorted(top_contributors.items(), key=lambda x: x[1], reverse=True)[:10]
                ],
                "recent_albums": [self._album_dashboard_data(a, user) for a in albums if a._user_can_view(user)],
                "trending_media": [self._media_data(m, user) for m in trending],
                "recent_media": [self._media_data(m, user) for m in recent_media],
                "recent_activity": [{
                    "event_type": log.event_type,
                    "entity_type": log.entity_type,
                    "user_name": log.user_id.name,
                    "details": log.details or "",
                    "album_id": log.album_id.id if log.album_id else False,
                    "media_id": log.media_id.id if log.media_id else False,
                    "create_date": fields.Datetime.to_string(log.create_date),
                } for log in recent_activity],
            }}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/social-gallery/export/brand", type="json", auth="user", methods=["POST"], csrf=False)
    def export_brand(self, album_ids=None, **kwargs):
        try:
            if not self._is_admin():
                raise AccessError(_("Only administrators can export brand content."))
            albums = request.env["social.gallery.album"].sudo().browse([_int(i) for i in (album_ids or [])]).exists()
            albums = albums.filtered(lambda a: a.company_id == self._company() and a.status == "approved")
            user = self._user()
            payload = {
                "organization": self._company().name,
                "exported_at": fields.Datetime.to_string(fields.Datetime.now()),
                "albums": [],
            }
            for album in albums:
                media = request.env["social.gallery.media"].sudo().search([
                    ("album_id", "=", album.id),
                    ("approval_status", "=", "approved"),
                    ("deleted_at", "=", False),
                ], limit=50)
                payload["albums"].append({
                    "name": album.name,
                    "description": album.description or "",
                    "media": [{
                        "title": m.display_name,
                        "description": m.description or "",
                        "accessible_description": m.accessible_description or "",
                        "media_type": m.media_type,
                        "uploaded_by": m.uploaded_by.name,
                        "create_date": fields.Datetime.to_string(m.create_date),
                    } for m in media if m._user_can_view(user)],
                })
            self._audit("exported", "album", details="Employer brand export", metadata={"album_count": len(albums)})
            return {"success": True, "data": payload}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))
