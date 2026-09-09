import math
import re
import uuid
from datetime import datetime, timedelta
from collections import defaultdict

from odoo import _, fields, http
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.http import request

from .storage import CloudflareR2Storage


MANAGER_GROUP = "cleon_company_documentary.group_company_documentary_manager"
ADMIN_GROUP = "cleon_company_documentary.group_company_documentary_admin"
ALLOWED_MIME_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
PART_SIZE = 8 * 1024 * 1024


def _int(value, default=0):
    try:
        return int(value or default)
    except (TypeError, ValueError):
        return default


def _safe_name(filename):
    value = re.sub(r"[^A-Za-z0-9._-]+", "-", (filename or "video")).strip("-")
    return value[:180] or "video"


class CompanyDocumentaryController(http.Controller):
    def _user(self):
        return request.env.user

    def _is_manager(self):
        return self._user().has_group(MANAGER_GROUP)

    def _is_admin(self):
        return self._user().has_group(ADMIN_GROUP)

    def _error(self, message):
        return {"success": False, "message": message}

    def _folder(self, folder_id, edit=False):
        folder = request.env["company.documentary.folder"].sudo().browse(_int(folder_id)).exists()
        if not folder or folder.company_id != self._user().company_id:
            raise UserError(_("Documentary folder not found."))
        allowed = folder._user_can_edit(self._user()) if edit else folder._user_can_view(self._user())
        if not allowed:
            raise AccessError(_("You do not have access to this documentary folder."))
        return folder

    def _media(self, media_id, edit=False):
        media = request.env["company.documentary.media"].sudo().browse(_int(media_id)).exists()
        if not media or media.company_id != self._user().company_id:
            raise UserError(_("Documentary video not found."))
        allowed = media._user_can_edit(self._user()) if edit else media._user_can_view(self._user())
        if not allowed:
            raise AccessError(_("You do not have access to this documentary video."))
        return media

    def _audit(self, event_type, folder=None, media=None, metadata=None):
        request.env["company.documentary.audit"].sudo().create({
            "event_type": event_type,
            "folder_id": folder.id if folder else (media.folder_id.id if media else False),
            "media_id": media.id if media else False,
            "user_id": self._user().id,
            "employee_id": self._user().employee_id.id if self._user().employee_id else False,
            "metadata": metadata or {},
        })

    @staticmethod
    def _folder_data(folder, user):
        return {
            "id": folder.id,
            "name": folder.name,
            "description": folder.description or "",
            "parent_id": folder.parent_id.id or False,
            "company_id": folder.company_id.id,
            "owner_id": folder.owner_id.id,
            "access_scope": folder.access_scope,
            "department_ids": folder.department_ids.ids,
            "grade_ids": folder.grade_ids.ids,
            "employee_ids": folder.employee_ids.ids,
            "editor_ids": folder.editor_ids.ids,
            "allow_download": folder.allow_download,
            "archived": folder.archived,
            "deleted_at": folder.deleted_at,
            "media_count": folder.media_count,
            "can_edit": folder._user_can_edit(user),
            "is_pinned": user in folder.pinned_user_ids,
        }

    @staticmethod
    def _settings_data(company):
        return {
            "require_upload_approval": company.documentary_require_upload_approval,
            "default_mandatory": company.documentary_default_mandatory,
            "default_comments_enabled": company.documentary_default_comments_enabled,
            "default_allow_download": company.documentary_default_allow_download,
            "default_completion_threshold": company.documentary_default_completion_threshold,
            "deleted_retention_days": company.documentary_deleted_retention_days,
            "auto_transcription": company.documentary_auto_transcription,
        }

    def _media_data(self, media, user):
        progress = request.env["company.documentary.watch"].sudo().search([
            ("media_id", "=", media.id),
            ("user_id", "=", user.id),
        ], limit=1)
        retention_days = media.company_id.documentary_deleted_retention_days or 365
        purge_date = False
        if media.deleted_at:
            purge_date = fields.Datetime.to_string(
                fields.Datetime.from_string(media.deleted_at) + timedelta(days=retention_days)
            )
        return {
            "id": media.id,
            "title": media.name,
            "description": media.description or "",
            "folder_id": media.folder_id.id,
            "folder_name": media.folder_id.name,
            "owner_id": media.owner_id.id,
            "original_filename": media.original_filename,
            "mime_type": media.mime_type,
            "file_size": media.file_size,
            "duration_seconds": media.duration_seconds,
            "processing_state": media.processing_state,
            "processing_error": media.processing_error or "",
            "deleted_at": media.deleted_at,
            "thumbnail_available": bool(media.thumbnail_key),
            "variants": media.variants or {},
            "tag_ids": media.tag_ids.ids,
            "tags": media.tag_ids.mapped("name"),
            "download_allowed": media._user_can_download(user),
            "mandatory": media.mandatory,
            "completion_threshold": media.completion_threshold,
            "comments_enabled": media.comments_enabled,
            "scope_mode": media.scope_mode,
            "access_scope": media.access_scope,
            "department_ids": media.department_ids.ids,
            "grade_ids": media.grade_ids.ids,
            "employee_ids": media.employee_ids.ids,
            "subtitles": [{
                "id": subtitle.id,
                "name": subtitle.name,
                "language": subtitle.language,
                "format": subtitle.format,
                "is_default": subtitle.is_default,
            } for subtitle in media.subtitle_ids.filtered("active")],
            "favorite": user in media.favorite_user_ids,
            "view_count": media.view_count,
            "unique_viewer_count": media.unique_viewer_count,
            "created_at": media.create_date,
            "updated_at": media.write_date,
            "can_edit": media._user_can_edit(user),
            "approval_status": media.approval_status,
            "publish_at": media.publish_at or False,
            "published_at": media.published_at or False,
            "transcript": media.transcript or "",
            "chapters": media.chapters or [],
            "share_token": media.share_token or False,
            "is_official": media.is_official,
            "replaces_media_id": media.replaces_media_id.id or False,
            "approver_comment": media.approver_comment or "",
            "approved_by_name": media.approved_by_id.name if media.approved_by_id else False,
            "approved_at": media.approved_at or False,
            "purge_date": purge_date,
            "watch_progress": {
                "position_seconds": progress.position_seconds,
                "completion_percent": progress.completion_percent,
                "completed": progress.completed,
                "last_watched_at": progress.last_watched_at,
            } if progress else None,
        }

    @http.route("/api/company-documentary/storage/config", type="json", auth="user", methods=["POST"], csrf=False)
    def storage_config(self, check=False, **values):
        if not self._is_admin():
            return self._error(_("Documentary Administrator access is required."))
        storage = CloudflareR2Storage(request.env)
        try:
            keys = {key: values[key] for key in storage.PARAMS if key in values}
            status = storage.save_config(keys) if keys else storage.public_status()
            if check and status["configured"]:
                status.update(storage.check_connection())
            return {"success": True, "data": status}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))
        except Exception:
            return self._error(_("Cloudflare R2 could not be reached."))

    @http.route("/api/company-documentary/folders", type="json", auth="user", methods=["POST"], csrf=False)
    def list_folders(self, parent_id=None, search="", include_archived=False, **kwargs):
        domain = [("company_id", "=", self._user().company_id.id)]
        if parent_id is not None:
            domain.append(("parent_id", "=", _int(parent_id)))
        if not include_archived or not self._is_manager():
            domain.extend([("archived", "=", False), ("deleted_at", "=", False)])
        if search:
            domain.append(("name", "ilike", search.strip()))
        folders = request.env["company.documentary.folder"].sudo().search(domain, order="name")
        if not (include_archived and self._is_manager()):
            folders = folders.filtered(lambda folder: folder._user_can_view(self._user()))
        return {"success": True, "data": [self._folder_data(folder, self._user()) for folder in folders]}

    @http.route("/api/company-documentary/folders/create", type="json", auth="user", methods=["POST"], csrf=False)
    def create_folder(self, name=None, description=None, parent_id=None, **values):
        if not self._is_manager():
            return self._error(_("Documentary Manager access is required."))
        if not name or not name.strip():
            return self._error(_("A folder name is required."))
        try:
            parent = self._folder(parent_id, edit=True) if parent_id else None
            payload = {
                "name": name.strip(),
                "description": description or False,
                "parent_id": parent.id if parent else False,
                "company_id": self._user().company_id.id,
                "owner_id": self._user().id,
                "access_scope": values.get("access_scope", "company"),
                "allow_download": bool(values.get("allow_download", False)),
            }
            for key in ("department_ids", "grade_ids", "employee_ids", "editor_ids"):
                if key in values:
                    payload[key] = [(6, 0, [_int(value) for value in values[key]])]
            folder = request.env["company.documentary.folder"].sudo().create(payload)
            self._audit("folder_created", folder=folder)
            return {"success": True, "data": self._folder_data(folder, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/company-documentary/folders/update", type="json", auth="user", methods=["POST"], csrf=False)
    def update_folder(self, id=None, **values):
        try:
            folder = self._folder(id, edit=True)
            payload = {key: values[key] for key in ("name", "description", "allow_download", "access_scope", "parent_id") if key in values}
            for key in ("department_ids", "grade_ids", "employee_ids", "editor_ids"):
                if key in values:
                    payload[key] = [(6, 0, [_int(value) for value in values[key]])]
            if "parent_id" in payload:
                if payload["parent_id"]:
                    parent = self._folder(payload["parent_id"], edit=True)
                    payload["parent_id"] = parent.id
                else:
                    payload["parent_id"] = False
            if not payload:
                return self._error(_("No folder fields were provided."))
            folder.write(payload)
            self._audit("folder_updated", folder=folder)
            return {"success": True, "data": self._folder_data(folder, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/company-documentary/folders/action", type="json", auth="user", methods=["POST"], csrf=False)
    def folder_action(self, id=None, action=None, **kwargs):
        try:
            folder = self._folder(id, edit=True)
            if action == "archive":
                folder.action_archive()
                event = "folder_archived"
            elif action == "restore":
                folder.action_restore()
                event = "folder_updated"
            elif action == "delete":
                folder.action_move_to_recycle_bin()
                event = "folder_deleted"
            elif action == "purge":
                if folder.media_ids:
                    return self._error(_("Move or delete the videos in a folder before permanently deleting it."))
                folder.unlink()
                return {"success": True, "data": {"purged": True, "id": _int(id)}}
            else:
                return self._error(_("Unsupported folder action."))
            self._audit(event, folder=folder)
            return {"success": True, "data": self._folder_data(folder, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/company-documentary/media", type="json", auth="user", methods=["POST"], csrf=False)
    def list_media(self, folder_id=None, search="", include_archived=False, recycle_bin=False,
                   mandatory=None, processing_state=None, approval_status=None,
                   date_from=None, date_to=None, **kwargs):
        if recycle_bin:
            if not self._is_manager():
                return self._error(_("Documentary Manager access is required."))
            domain = [
                ("company_id", "=", self._user().company_id.id),
                ("deleted_at", "!=", False),
            ]
        else:
            domain = [("company_id", "=", self._user().company_id.id)]
            if folder_id is not None:
                domain.append(("folder_id", "=", _int(folder_id)))
            if not include_archived or not self._is_manager():
                domain.append(("active", "=", True))
                domain.append(("deleted_at", "=", False))
        if search:
            domain += [
                "|", "|",
                ("name", "ilike", search.strip()),
                ("original_filename", "ilike", search.strip()),
                ("tag_ids.name", "ilike", search.strip()),
            ]
        if mandatory is not None:
            domain.append(("mandatory", "=", bool(mandatory)))
        if processing_state:
            domain.append(("processing_state", "=", processing_state))
        if approval_status:
            domain.append(("approval_status", "=", approval_status))
        if date_from:
            domain.append(("create_date", ">=", date_from))
        if date_to:
            domain.append(("create_date", "<=", date_to + " 23:59:59"))
        media = request.env["company.documentary.media"].sudo().search(domain, order="create_date desc")
        if recycle_bin:
            media = media.filtered(lambda item: item._user_can_edit(self._user()))
        elif not (include_archived and self._is_manager()):
            media = media.filtered(lambda item: item._user_can_view(self._user()) or item._user_can_edit(self._user()))
        return {"success": True, "data": [self._media_data(item, self._user()) for item in media]}

    @http.route("/api/company-documentary/tags", type="json", auth="user", methods=["POST"], csrf=False)
    def list_tags(self, search="", create=False, name=None, color=0, **kwargs):
        if create:
            if not self._is_manager() or not name or not name.strip():
                return self._error(_("Documentary Manager access and a tag name are required."))
            existing = request.env["company.documentary.tag"].sudo().search([
                ("company_id", "=", self._user().company_id.id), ("name", "=", name.strip())
            ], limit=1)
            tag = existing or request.env["company.documentary.tag"].sudo().create({
                "name": name.strip(), "color": _int(color), "company_id": self._user().company_id.id,
            })
            return {"success": True, "data": {"id": tag.id, "name": tag.name, "color": tag.color}}
        domain = [("company_id", "=", self._user().company_id.id), ("active", "=", True)]
        if search:
            domain.append(("name", "ilike", search.strip()))
        tags = request.env["company.documentary.tag"].sudo().search(domain, order="name")
        return {"success": True, "data": [{"id": tag.id, "name": tag.name, "color": tag.color} for tag in tags]}

    @http.route("/api/company-documentary/audience", type="json", auth="user", methods=["POST"], csrf=False)
    def audience_options(self, search="", **kwargs):
        if not self._is_manager():
            return self._error(_("Documentary Manager access is required."))
        term = (search or "").strip()
        departments = request.env["hr.department"].sudo().search([
            ("company_id", "=", self._user().company_id.id),
            *([("name", "ilike", term)] if term else []),
        ], limit=50, order="name")
        employees = request.env["hr.employee"].sudo().search([
            ("company_id", "=", self._user().company_id.id),
            ("active", "=", True),
            *([("name", "ilike", term)] if term else []),
        ], limit=50, order="name")
        grades = request.env["hr.grade"].sudo().search(
            [*([("name", "ilike", term)] if term else [])], limit=50, order="name"
        )
        return {"success": True, "data": {
            "departments": [{"id": item.id, "name": item.name} for item in departments],
            "grades": [{"id": item.id, "name": item.name} for item in grades],
            "employees": [{
                "id": item.id,
                "name": item.name,
                "email": item.work_email or item.private_email or "",
                "department_id": item.department_id.id or False,
                "department": item.department_id.name or "",
                "grade_id": item.grade_id.id or False,
                "grade": item.grade_id.name or "",
            } for item in employees],
        }}

    @http.route("/api/company-documentary/uploads/session", type="json", auth="user", methods=["POST"], csrf=False)
    def upload_session(self, upload_id=None, **kwargs):
        upload = request.env["company.documentary.upload"].sudo().browse(_int(upload_id)).exists()
        if not upload or upload.initiated_by != self._user():
            return self._error(_("Upload session not found."))
        return {"success": True, "data": {
            "upload_id": upload.id,
            "media_id": upload.media_id.id,
            "state": upload.state,
            "part_size": upload.part_size,
            "total_parts": upload.total_parts,
            "uploaded_parts": upload.uploaded_parts or {},
            "expires_at": upload.expires_at,
        }}

    @http.route("/api/company-documentary/uploads/initiate", type="json", auth="user", methods=["POST"], csrf=False)
    def initiate_upload(self, folder_id=None, filename=None, mime_type=None, file_size=0, **values):
        try:
            folder = self._folder(folder_id, edit=True)
            size = _int(file_size)
            if mime_type not in ALLOWED_MIME_TYPES:
                return self._error(_("Only MP4, WebM, and MOV videos are supported."))
            if size <= 0 or size > 10 * 1024 * 1024 * 1024:
                return self._error(_("Video files must be greater than 0 and no larger than 10 GB."))
            storage = CloudflareR2Storage(request.env)
            object_key = "%s/%s/original/%s" % (self._user().company_id.id, uuid.uuid4(), _safe_name(filename))
            provider_upload_id = storage.initiate_multipart(object_key, mime_type)
            total_parts = max(1, math.ceil(size / PART_SIZE))
            company = self._user().company_id
            require_approval = company.documentary_require_upload_approval
            publish_at = values.get("publish_at") or False
            approval_status = "pending" if require_approval else ("scheduled" if publish_at else "approved")
            media = request.env["company.documentary.media"].sudo().create({
                "name": (values.get("title") or filename or "Untitled video").strip(),
                "description": values.get("description") or False,
                "folder_id": folder.id,
                "owner_id": self._user().id,
                "uploaded_by": self._user().id,
                "original_filename": filename or "video",
                "mime_type": mime_type,
                "file_size": size,
                "storage_key": object_key,
                "mandatory": bool(values.get("mandatory", company.documentary_default_mandatory)),
                "completion_threshold": float(values.get("completion_threshold", company.documentary_default_completion_threshold) or 85),
                "comments_enabled": bool(values.get("comments_enabled", company.documentary_default_comments_enabled)),
                "scope_mode": values.get("scope_mode", "inherited"),
                "access_scope": values.get("access_scope", "employee"),
                "department_ids": [(6, 0, [_int(value) for value in values.get("department_ids", [])])],
                "grade_ids": [(6, 0, [_int(value) for value in values.get("grade_ids", [])])],
                "employee_ids": [(6, 0, [_int(value) for value in values.get("employee_ids", [])])],
                "tag_ids": [(6, 0, [_int(value) for value in values.get("tag_ids", [])])],
                "download_policy": values.get("download_policy", "allow" if company.documentary_default_allow_download else "inherit"),
                "approval_status": approval_status,
                "publish_at": publish_at or False,
                "is_official": bool(values.get("is_official", False)),
                "replaces_media_id": _int(values.get("replaces_media_id")) or False,
            })
            upload = request.env["company.documentary.upload"].sudo().create({
                "name": filename or media.name,
                "media_id": media.id,
                "initiated_by": self._user().id,
                "object_key": object_key,
                "provider_upload_id": provider_upload_id,
                "part_size": PART_SIZE,
                "total_parts": total_parts,
                "expires_at": fields.Datetime.now() + timedelta(hours=24),
            })
            self._audit("media_uploaded", media=media, metadata={"event": "upload_initiated"})
            return {"success": True, "data": {
                "media": self._media_data(media, self._user()),
                "upload_id": upload.id,
                "provider": "cloudflare_r2",
                "part_size": PART_SIZE,
                "total_parts": total_parts,
                "expires_at": upload.expires_at,
            }}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))
        except Exception:
            return self._error(_("The video upload could not be initialized."))

    @http.route("/api/company-documentary/uploads/part-url", type="json", auth="user", methods=["POST"], csrf=False)
    def upload_part_url(self, upload_id=None, part_number=None, **kwargs):
        try:
            upload = request.env["company.documentary.upload"].sudo().browse(_int(upload_id)).exists()
            if not upload or upload.state != "initiated" or upload.initiated_by != self._user():
                return self._error(_("Upload session not found."))
            if upload.expires_at < fields.Datetime.now():
                upload.write({"state": "expired"})
                return self._error(_("This upload session has expired."))
            part = _int(part_number)
            if part < 1 or part > upload.total_parts:
                return self._error(_("Invalid upload part number."))
            url = CloudflareR2Storage(request.env).sign_part(upload.object_key, upload.provider_upload_id, part)
            return {"success": True, "data": {"part_number": part, "url": url, "expires_in": 900}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))
        except Exception:
            return self._error(_("A signed upload URL could not be created."))

    @http.route("/api/company-documentary/uploads/record-part", type="json", auth="user", methods=["POST"], csrf=False)
    def record_upload_part(self, upload_id=None, part_number=None, etag=None, **kwargs):
        """Persist completed multipart parts so an interrupted upload can resume safely."""
        try:
            upload = request.env["company.documentary.upload"].sudo().browse(_int(upload_id)).exists()
            if not upload or upload.state != "initiated" or upload.initiated_by != self._user():
                return self._error(_("Upload session not found."))
            part = _int(part_number)
            if part < 1 or part > upload.total_parts or not etag:
                return self._error(_("Invalid uploaded part."))
            recorded = upload.uploaded_parts or []
            if isinstance(recorded, dict):
                recorded = list(recorded.values())
            normalized = [
                {"PartNumber": _int(item.get("PartNumber", item.get("part_number"))), "ETag": item.get("ETag", item.get("etag"))}
                for item in recorded if item.get("ETag", item.get("etag"))
            ]
            normalized = [item for item in normalized if item["PartNumber"] != part]
            normalized.append({"PartNumber": part, "ETag": etag})
            upload.write({"uploaded_parts": sorted(normalized, key=lambda item: item["PartNumber"])})
            return {"success": True, "data": {"part_number": part, "uploaded_parts": upload.uploaded_parts}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))
        except Exception:
            return self._error(_("The upload progress could not be saved."))

    @http.route("/api/company-documentary/uploads/complete", type="json", auth="user", methods=["POST"], csrf=False)
    def complete_upload(self, upload_id=None, parts=None, **kwargs):
        try:
            upload = request.env["company.documentary.upload"].sudo().browse(_int(upload_id)).exists()
            if not upload or upload.state != "initiated" or upload.initiated_by != self._user():
                return self._error(_("Upload session not found."))
            if upload.expires_at < fields.Datetime.now():
                upload.write({"state": "expired"})
                return self._error(_("This upload session has expired."))
            normalized = sorted([
                {"PartNumber": _int(part.get("PartNumber", part.get("part_number"))), "ETag": part.get("ETag", part.get("etag"))}
                for part in (parts or [])
                if part.get("ETag", part.get("etag"))
            ], key=lambda item: item["PartNumber"])
            expected = list(range(1, upload.total_parts + 1))
            if [part["PartNumber"] for part in normalized] != expected:
                return self._error(_("Every uploaded part must be supplied before completion."))
            CloudflareR2Storage(request.env).complete_multipart(upload.object_key, upload.provider_upload_id, normalized)
            upload.write({"state": "completed", "uploaded_parts": normalized})
            media = upload.media_id
            company = self._user().company_id
            now = fields.Datetime.now()
            completion_values = {"processing_state": "ready"}
            if not company.documentary_require_upload_approval:
                if media.publish_at and media.publish_at > now:
                    completion_values["approval_status"] = "scheduled"
                else:
                    completion_values["approval_status"] = "approved"
                    completion_values["published_at"] = now
            media.write(completion_values)
            if completion_values.get("approval_status") == "approved":
                media._activate_replacement()
            self._audit("media_uploaded", media=media, metadata={"event": "upload_completed"})
            return {"success": True, "data": self._media_data(media, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))
        except Exception:
            return self._error(_("The video upload could not be completed."))

    @http.route("/api/company-documentary/uploads/abort", type="json", auth="user", methods=["POST"], csrf=False)
    def abort_upload(self, upload_id=None, **kwargs):
        try:
            upload = request.env["company.documentary.upload"].sudo().browse(_int(upload_id)).exists()
            if not upload or upload.state != "initiated" or upload.initiated_by != self._user():
                return self._error(_("Upload session not found."))
            CloudflareR2Storage(request.env).abort_multipart(upload.object_key, upload.provider_upload_id)
            upload.write({"state": "aborted"})
            upload.media_id.unlink()
            return {"success": True, "data": {"aborted": True}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))
        except Exception:
            return self._error(_("The video upload could not be cancelled."))

    @http.route("/api/company-documentary/media/update", type="json", auth="user", methods=["POST"], csrf=False)
    def update_media(self, id=None, **values):
        try:
            media = self._media(id, edit=True)
            payload = {key: values[key] for key in (
                "name", "description", "mandatory", "completion_threshold", "comments_enabled",
                "download_policy", "scope_mode", "access_scope", "duration_seconds", "thumbnail_key",
                "transcript", "chapters", "publish_at", "is_official",
            ) if key in values}
            for key in ("department_ids", "grade_ids", "employee_ids", "tag_ids"):
                if key in values:
                    payload[key] = [(6, 0, [_int(value) for value in values[key]])]
            if not payload:
                return self._error(_("No video fields were provided."))
            media.write(payload)
            self._audit("media_updated", media=media)
            return {"success": True, "data": self._media_data(media, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/company-documentary/media/processing", type="json", auth="user", methods=["POST"], csrf=False)
    def update_processing(self, id=None, processing_state=None, processing_error=None, variants=None, duration_seconds=None, **kwargs):
        if not self._is_manager():
            return self._error(_("Documentary Manager access is required."))
        if processing_state not in ("processing", "ready", "failed"):
            return self._error(_("Unsupported processing state."))
        try:
            media = self._media(id, edit=True)
            payload = {"processing_state": processing_state, "processing_error": processing_error or False}
            if variants is not None:
                payload["variants"] = variants
            if duration_seconds is not None:
                payload["duration_seconds"] = max(float(duration_seconds), 0)
            media.write(payload)
            self._audit("media_updated", media=media, metadata={"processing_state": processing_state})
            return {"success": True, "data": self._media_data(media, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/company-documentary/media/asset-url", type="json", auth="user", methods=["POST"], csrf=False)
    def media_asset_url(self, id=None, asset_type=None, filename=None, mime_type=None, **kwargs):
        try:
            media = self._media(id, edit=True)
            if asset_type not in ("thumbnail", "subtitle"):
                return self._error(_("Unsupported documentary asset type."))
            if asset_type == "thumbnail" and not (mime_type or "").startswith("image/"):
                return self._error(_("A thumbnail must be an image."))
            if asset_type == "subtitle" and mime_type not in ("text/vtt", "application/x-subrip", "text/plain"):
                return self._error(_("A subtitle must be a VTT or SRT file."))
            extension = _safe_name(filename or asset_type).split(".")[-1]
            object_key = "%s/%s/%s-%s.%s" % (
                self._user().company_id.id, media.id, asset_type, uuid.uuid4(), extension
            )
            url = CloudflareR2Storage(request.env).sign_put_object(object_key, mime_type or "application/octet-stream")
            if asset_type == "thumbnail":
                media.write({"thumbnail_key": object_key, "thumbnail_source": "custom"})
            self._audit("media_updated", media=media, metadata={"asset_type": asset_type})
            return {"success": True, "data": {"url": url, "storage_key": object_key, "expires_in": 900}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))
        except Exception:
            return self._error(_("A signed asset upload URL could not be created."))

    @http.route("/api/company-documentary/media/asset-read-url", type="json", auth="user", methods=["POST"], csrf=False)
    def media_asset_read_url(self, id=None, asset_type=None, subtitle_id=None, **kwargs):
        try:
            media = self._media(id)
            if asset_type == "thumbnail":
                key = media.thumbnail_key
            elif asset_type == "subtitle":
                subtitle = request.env["company.documentary.subtitle"].sudo().browse(_int(subtitle_id)).exists()
                if not subtitle or subtitle.media_id != media:
                    return self._error(_("Subtitle track not found."))
                key = subtitle.storage_key
            else:
                return self._error(_("Unsupported documentary asset type."))
            if not key:
                return self._error(_("The requested asset is not available."))
            url = CloudflareR2Storage(request.env).signed_object_url(key)
            return {"success": True, "data": {"url": url, "expires_in": 600}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))
        except Exception:
            return self._error(_("A secure asset URL could not be created."))

    @http.route("/api/company-documentary/media/subtitles", type="json", auth="user", methods=["POST"], csrf=False)
    def create_subtitle(self, media_id=None, name=None, language="en", format="vtt", filename=None, mime_type=None, **kwargs):
        if format not in ("vtt", "srt"):
            return self._error(_("Subtitle format must be VTT or SRT."))
        try:
            media = self._media(media_id, edit=True)
            object_key = "%s/%s/subtitles/%s-%s.%s" % (
                self._user().company_id.id, media.id, language, uuid.uuid4(), format
            )
            url = CloudflareR2Storage(request.env).sign_put_object(
                object_key, mime_type or ("text/vtt" if format == "vtt" else "application/x-subrip")
            )
            subtitle = request.env["company.documentary.subtitle"].sudo().create({
                "name": name or filename or language,
                "media_id": media.id,
                "language": language,
                "format": format,
                "storage_key": object_key,
                "is_default": not bool(media.subtitle_ids),
            })
            return {"success": True, "data": {"id": subtitle.id, "url": url, "storage_key": object_key, "expires_in": 900}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))
        except Exception:
            return self._error(_("A signed subtitle upload URL could not be created."))

    @http.route("/api/company-documentary/comments", type="json", auth="user", methods=["POST"], csrf=False)
    def comments(self, media_id=None, body=None, action="list", comment_id=None, **kwargs):
        try:
            media = self._media(media_id)
            if not media.comments_enabled and action != "list":
                return self._error(_("Comments are disabled for this video."))
            comment_model = request.env["company.documentary.comment"].sudo()
            if action == "create":
                if not body or not body.strip():
                    return self._error(_("A comment cannot be empty."))
                mentioned_ids = []
                for token in re.findall(r"@([\w\s.-]+)", body.strip()):
                    match = request.env["res.users"].sudo().search([
                        ("name", "ilike", token.strip()),
                        ("company_ids", "in", self._user().company_id.id),
                    ], limit=1)
                    if match:
                        mentioned_ids.append(match.id)
                comment = comment_model.create({
                    "media_id": media.id,
                    "user_id": self._user().id,
                    "body": body.strip(),
                    "mentioned_user_ids": [(6, 0, mentioned_ids)],
                })
                if self._user().employee_id:
                    request.env["company.documentary.watch.event"].sudo().create({
                        "media_id": media.id, "user_id": self._user().id,
                        "employee_id": self._user().employee_id.id, "event_type": "comment",
                    })
            if action == "delete":
                comment = comment_model.browse(_int(comment_id)).exists()
                if not comment or comment.media_id != media:
                    return self._error(_("Comment not found."))
                if comment.user_id != self._user() and not self._is_manager():
                    return self._error(_("You can only delete your own comments."))
                comment.unlink()
            records = comment_model.search([("media_id", "=", media.id), ("active", "=", True)], order="create_date asc")
            return {"success": True, "data": [{
                "id": item.id,
                "body": item.body,
                "user_id": item.user_id.id,
                "user_name": item.user_id.name,
                "created_at": item.create_date,
                "mentioned_user_ids": item.mentioned_user_ids.ids,
                "mentioned_names": item.mentioned_user_ids.mapped("name"),
            } for item in records]}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/company-documentary/media/action", type="json", auth="user", methods=["POST"], csrf=False)
    def media_action(self, id=None, action=None, **kwargs):
        try:
            media = self._media(id, edit=action != "favorite")
            if action == "archive":
                media.action_archive()
                event = "media_archived"
            elif action == "restore":
                media.action_restore()
                event = "media_updated"
            elif action == "delete":
                media.action_move_to_recycle_bin()
                event = "media_deleted"
            elif action == "purge":
                media.action_permanent_delete()
                return {"success": True, "data": {"purged": True, "id": media.id}}
            elif action == "favorite":
                command = (fields.Command.unlink(self._user().id)
                           if self._user() in media.favorite_user_ids
                           else fields.Command.link(self._user().id))
                media.sudo().write({"favorite_user_ids": [command]})
                if self._user().employee_id:
                    request.env["company.documentary.watch.event"].sudo().create({
                        "media_id": media.id,
                        "user_id": self._user().id,
                        "employee_id": self._user().employee_id.id,
                        "event_type": "favorite",
                    })
                event = "media_updated"
            else:
                return self._error(_("Unsupported media action."))
            self._audit(event, media=media)
            return {"success": True, "data": self._media_data(media, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/company-documentary/media/batch-action", type="json", auth="user", methods=["POST"], csrf=False)
    def media_batch_action(self, ids=None, action=None, target_folder_id=None, **kwargs):
        if action not in ("archive", "delete", "restore", "favorite", "move", "purge"):
            return self._error(_("Unsupported batch action."))
        try:
            media_records = request.env["company.documentary.media"].sudo().browse(
                [_int(value) for value in (ids or [])]
            ).exists().filtered(lambda item: item.company_id == self._user().company_id)
            if not media_records:
                return self._error(_("Select at least one video."))
            target = self._folder(target_folder_id, edit=True) if action == "move" else None
            for media in media_records:
                if action == "favorite":
                    if not media._user_can_view(self._user()):
                        raise AccessError(_("You do not have permission to favorite one of the selected videos."))
                elif not media._user_can_edit(self._user()):
                    raise AccessError(_("You do not have permission to update one of the selected videos."))
                if action == "archive":
                    media.action_archive()
                elif action == "delete":
                    media.action_move_to_recycle_bin()
                elif action == "restore":
                    media.action_restore()
                elif action == "purge":
                    media.action_permanent_delete()
                elif action == "favorite":
                    command = (fields.Command.unlink(self._user().id)
                               if self._user() in media.favorite_user_ids
                               else fields.Command.link(self._user().id))
                    media.sudo().write({"favorite_user_ids": [command]})
                    if self._user().employee_id:
                        request.env["company.documentary.watch.event"].sudo().create({
                            "media_id": media.id,
                            "user_id": self._user().id,
                            "employee_id": self._user().employee_id.id,
                            "event_type": "favorite",
                        })
                elif action == "move":
                    if not target or not target._user_can_edit(self._user()):
                        raise AccessError(_("You do not have permission to move videos to that folder."))
                    media.write({"folder_id": target.id})
            return {"success": True, "data": {"updated_ids": media_records.ids, "action": action}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/company-documentary/media/stream-url", type="json", auth="user", methods=["POST"], csrf=False)
    def stream_url(self, id=None, quality=None, **kwargs):
        try:
            media = self._media(id)
            storage_key = (media.variants or {}).get(quality) if quality else None
            storage_key = storage_key or media.storage_key
            url = CloudflareR2Storage(request.env).signed_object_url(storage_key)
            self._audit("streamed", media=media)
            return {"success": True, "data": {"url": url, "quality": quality or "original", "expires_in": 600}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))
        except Exception:
            return self._error(_("A secure streaming URL could not be created."))

    @http.route("/api/company-documentary/media/download-url", type="json", auth="user", methods=["POST"], csrf=False)
    def download_url(self, id=None, **kwargs):
        try:
            media = self._media(id)
            if not media._user_can_download(self._user()):
                return self._error(_("Downloads are disabled for this video."))
            url = CloudflareR2Storage(request.env).signed_object_url(media.storage_key, download=True, filename=media.original_filename)
            if self._user().employee_id:
                request.env["company.documentary.watch.event"].sudo().create({
                    "media_id": media.id, "user_id": self._user().id,
                    "employee_id": self._user().employee_id.id, "event_type": "download",
                })
            self._audit("downloaded", media=media)
            return {"success": True, "data": {"url": url, "expires_in": 600}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))
        except Exception:
            return self._error(_("A secure download URL could not be created."))

    @http.route("/api/company-documentary/watch-progress", type="json", auth="user", methods=["POST"], csrf=False)
    def watch_progress(self, media_id=None, position_seconds=0, watched_seconds=0, completion_percent=0, completed=False, session_id=None, event_type="progress", delta_seconds=0, **kwargs):
        try:
            media = self._media(media_id)
            employee = self._user().employee_id
            if not employee:
                return self._error(_("A linked employee record is required to save watch progress."))
            percent = min(max(float(completion_percent or 0), 0), 100)
            is_completed = bool(completed) or percent >= media.completion_threshold
            delta = max(float(delta_seconds or 0), 0)
            event_type = event_type if event_type in ("start", "progress", "complete") else "progress"
            values = {
                "media_id": media.id,
                "user_id": self._user().id,
                "employee_id": employee.id,
                "position_seconds": max(float(position_seconds or 0), 0),
                "watched_seconds": delta,
                "completion_percent": percent,
                "completed": is_completed,
                "last_watched_at": fields.Datetime.now(),
            }
            progress = request.env["company.documentary.watch"].sudo().search([("media_id", "=", media.id), ("user_id", "=", self._user().id)], limit=1)
            if progress:
                percent = max(percent, progress.completion_percent)
                is_completed = progress.completed or is_completed
                values["completion_percent"] = percent
                values["completed"] = is_completed
                start_exists = bool(session_id and request.env["company.documentary.watch.event"].sudo().search_count([
                    ("media_id", "=", media.id), ("user_id", "=", self._user().id),
                    ("session_id", "=", session_id), ("event_type", "=", "start"),
                ]))
                values["watched_seconds"] = progress.watched_seconds + delta
                values["view_count"] = progress.view_count + (1 if event_type == "start" and not start_exists else 0)
                if is_completed and not progress.completed:
                    values["completed_at"] = fields.Datetime.now()
                progress.write(values)
            else:
                values["view_count"] = 1 if event_type == "start" else 0
                if is_completed:
                    values["completed_at"] = fields.Datetime.now()
                progress = request.env["company.documentary.watch"].sudo().create(values)
            if event_type == "start" or delta > 0 or is_completed:
                request.env["company.documentary.watch.event"].sudo().create({
                    "media_id": media.id,
                    "user_id": self._user().id,
                    "employee_id": employee.id,
                    "session_id": session_id or False,
                    "event_type": "complete" if is_completed and event_type != "start" else event_type,
                    "position_seconds": max(float(position_seconds or 0), 0),
                    "delta_seconds": delta,
                    "completion_percent": percent,
                })
            self._audit("progress_updated", media=media, metadata={"completion_percent": percent})
            return {"success": True, "data": {
                "position_seconds": progress.position_seconds,
                "watched_seconds": progress.watched_seconds,
                "completion_percent": progress.completion_percent,
                "completed": progress.completed,
            }}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    def _analytics_dashboard_data(self, date_from=None, date_to=None, department_id=None, folder_id=None, media_id=None):
        now = fields.Datetime.from_string(fields.Datetime.now())
        try:
            start = datetime.strptime(date_from, "%Y-%m-%d") if date_from else now - timedelta(days=29)
            end = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1) if date_to else now + timedelta(days=1)
        except (TypeError, ValueError):
            raise ValidationError(_("Analytics dates must use YYYY-MM-DD format."))
        company = self._user().company_id
        media_domain = [("company_id", "=", company.id), ("active", "=", True), ("deleted_at", "=", False)]
        if folder_id:
            media_domain.append(("folder_id", "=", _int(folder_id)))
        if media_id:
            media_domain.append(("id", "=", _int(media_id)))
        media = request.env["company.documentary.media"].sudo().search(media_domain)
        media_ids = set(media.ids)
        employee_model = request.env["hr.employee"].sudo()
        employees = employee_model.search([("company_id", "=", company.id), ("active", "=", True)])
        if department_id:
            employees = employees.filtered(lambda employee: employee.department_id.id == _int(department_id))
        employee_ids = set(employees.ids)
        event_model = request.env["company.documentary.watch.event"].sudo()
        events = event_model.search([
            ("media_id", "in", list(media_ids)),
            ("happened_at", ">=", start),
            ("happened_at", "<", end),
        ]) if media_ids else event_model
        if department_id:
            events = events.filtered(lambda event: event.department_id.id == _int(department_id))
        starts = events.filtered(lambda event: event.event_type == "start")
        completes = events.filtered(lambda event: event.event_type == "complete")
        started_pairs = {(event.media_id.id, event.employee_id.id) for event in starts}
        completed_pairs_in_period = {(event.media_id.id, event.employee_id.id) for event in completes}
        activity_events = events.filtered(lambda event: event.event_type in ("start", "progress", "complete"))
        active_user_ids = set(activity_events.mapped("user_id").ids)
        started_employee_ids = set(starts.mapped("employee_id").ids)
        total_watch_seconds = sum(events.mapped("delta_seconds"))
        watch_by_user = defaultdict(float)
        for event in events:
            watch_by_user[event.user_id.id] += event.delta_seconds
        watch_values = sorted(watch_by_user.values())
        average_watch_seconds = total_watch_seconds / len(watch_values) if watch_values else 0
        median_watch_seconds = watch_values[len(watch_values) // 2] if watch_values else 0
        progress = request.env["company.documentary.watch"].sudo().search([( "media_id", "in", list(media_ids))]) if media_ids else request.env["company.documentary.watch"]
        progress = progress.filtered(lambda item: not employee_ids or item.employee_id.id in employee_ids)
        completion_values = progress.mapped("completion_percent")
        completed_pairs = {(item.media_id.id, item.employee_id.id) for item in progress if item.completed}

        def eligible_for(item):
            values = employees
            folder = item.folder_id
            scope = item.access_scope if item.scope_mode == "override" else folder.access_scope
            if scope == "department":
                ids = (item.department_ids if item.scope_mode == "override" else folder.department_ids).ids
                values = values.filtered(lambda employee: employee.department_id.id in ids)
            elif scope == "grade":
                ids = (item.grade_ids if item.scope_mode == "override" else folder.grade_ids).ids
                values = values.filtered(lambda employee: employee.grade_id.id in ids)
            elif scope == "employee":
                ids = (item.employee_ids if item.scope_mode == "override" else folder.employee_ids).ids
                values = values.filtered(lambda employee: employee.id in ids)
            return set(values.ids)

        eligible_ids = set().union(*(eligible_for(item) for item in media)) if media else set()
        mandatory_assignments = sum(len(eligible_for(item)) for item in media.filtered("mandatory"))
        mandatory_completed = len({pair for pair in completed_pairs if any(item.id == pair[0] and item.mandatory for item in media)})
        engaged_users = set(activity_events.filtered(lambda event: event.completion_percent >= 25 or event.event_type in ("favorite", "comment", "download")).mapped("employee_id").ids)

        def day_rows():
            rows = []
            cursor = start.date()
            while cursor < end.date():
                day_events = events.filtered(lambda event: event.happened_at.date() == cursor)
                day_starts = day_events.filtered(lambda event: event.event_type == "start")
                rows.append({
                    "date": cursor.isoformat(),
                    "views": len(day_starts),
                    "unique_viewers": len(set(day_starts.mapped("employee_id").ids)),
                    "watch_seconds": round(sum(day_events.mapped("delta_seconds")), 2),
                    "average_completion": round(sum(day_events.mapped("completion_percent")) / len(day_events), 2) if day_events else 0,
                })
                cursor += timedelta(days=1)
            return rows

        departments = defaultdict(lambda: {"id": False, "name": "Unassigned", "eligible": 0, "views": 0, "viewer_ids": set(), "watch_seconds": 0, "completion": []})
        for employee in employees:
            key = employee.department_id.id or 0
            departments[key]["id"] = employee.department_id.id or False
            departments[key]["name"] = employee.department_id.name or "Unassigned"
            departments[key]["eligible"] += 1
        for event in events:
            key = event.department_id.id or 0
            departments[key]["id"] = event.department_id.id or False
            departments[key]["name"] = event.department_id.name or "Unassigned"
            if event.event_type == "start":
                departments[key]["views"] += 1
                departments[key]["viewer_ids"].add(event.employee_id.id)
            departments[key]["watch_seconds"] += event.delta_seconds
        for item in progress:
            key = item.employee_id.department_id.id or 0
            departments[key]["completion"].append(item.completion_percent)
        department_rows = []
        for value in departments.values():
            viewer_rate = value["viewer_ids"] and len(value["viewer_ids"]) / value["eligible"] * 100 if value["eligible"] else 0
            completion = sum(value["completion"]) / len(value["completion"]) if value["completion"] else 0
            score = viewer_rate * 0.4 + completion * 0.4 + min(value["watch_seconds"] / max(len(value["viewer_ids"]), 1) / 60, 100) * 0.2
            performance = "Excellent" if score >= 80 else "Healthy" if score >= 60 else "Needs attention" if score >= 40 else "At risk"
            department_rows.append({"id": value["id"], "name": value["name"], "eligible_employees": value["eligible"], "unique_viewers": len(value["viewer_ids"]), "viewer_rate": round(viewer_rate, 2), "total_views": value["views"], "average_watch_seconds": round(value["watch_seconds"] / len(value["viewer_ids"]), 2) if value["viewer_ids"] else 0, "average_completion": round(completion, 2), "performance_score": round(score, 2), "performance": performance})
        department_rows.sort(key=lambda row: row["total_views"], reverse=True)

        content_rows = []
        for item in media:
            item_events = events.filtered(lambda event: event.media_id == item)
            item_progress = progress.filtered(lambda record: record.media_id == item)
            item_starts = item_events.filtered(lambda event: event.event_type == "start")
            content_rows.append({"id": item.id, "title": item.name, "folder_name": item.folder_id.name, "mandatory": item.mandatory, "total_views": len(item_starts), "unique_viewers": len(set(item_starts.mapped("employee_id").ids)), "watch_seconds": round(sum(item_events.mapped("delta_seconds")), 2), "average_completion": round(sum(item_progress.mapped("completion_percent")) / len(item_progress), 2) if item_progress else 0, "completion_rate": round(len(item_progress.filtered("completed")) / len(item_progress) * 100, 2) if item_progress else 0})
        content_rows.sort(key=lambda row: row["total_views"], reverse=True)
        distribution = {"strong": 0, "developing": 0, "at_risk": 0}
        completion_bands = {"under_25": 0, "between_25_75": 0, "over_75": 0}
        for item in progress:
            key = "strong" if item.completion_percent >= 75 else "developing" if item.completion_percent >= 40 else "at_risk"
            distribution[key] += 1
            if item.completion_percent < 25:
                completion_bands["under_25"] += 1
            elif item.completion_percent < 75:
                completion_bands["between_25_75"] += 1
            else:
                completion_bands["over_75"] += 1
        caption_events = events.filtered(lambda event: event.event_type == "caption")
        caption_users = len(set(caption_events.mapped("user_id").ids))
        recent_viewer_events = starts.sorted(key=lambda event: event.happened_at, reverse=True)[:10]
        recent_viewers = [{
            "user_name": event.user_id.name,
            "employee_name": event.employee_id.name,
            "media_title": event.media_id.name,
            "happened_at": event.happened_at,
        } for event in recent_viewer_events]
        pending_approval_count = request.env["company.documentary.media"].sudo().search_count([
            ("company_id", "=", company.id),
            ("approval_status", "=", "pending"),
            ("deleted_at", "=", False),
        ])
        middle = start + (end - start) / 2
        first_views = len(starts.filtered(lambda event: event.happened_at < middle))
        second_views = len(starts.filtered(lambda event: event.happened_at >= middle))
        return {"success": True, "data": {
            "period": {"from": start.date().isoformat(), "to": (end - timedelta(days=1)).date().isoformat()},
            "overview": {"total_views": len(starts), "unique_viewers": len(active_user_ids), "eligible_employees": len(eligible_ids), "viewer_rate": round(len(started_employee_ids & eligible_ids) / len(eligible_ids) * 100, 2) if eligible_ids else 0, "total_watch_seconds": round(total_watch_seconds, 2), "average_watch_seconds": round(average_watch_seconds, 2), "median_watch_seconds": round(median_watch_seconds, 2), "completion_rate": round(len(completed_pairs_in_period & started_pairs) / len(started_pairs) * 100, 2) if started_pairs else 0, "average_completion": round(sum(completion_values) / len(completion_values), 2) if completion_values else 0, "engagement_rate": round(len(engaged_users & eligible_ids) / len(eligible_ids) * 100, 2) if eligible_ids else 0, "mandatory_assignments": mandatory_assignments, "mandatory_completed": mandatory_completed, "compliance_rate": round(mandatory_completed / mandatory_assignments * 100, 2) if mandatory_assignments else 0},
            "views_over_time": day_rows(), "departments": department_rows, "department_chart": [{"name": row["name"], "views": row["total_views"], "viewer_rate": row["viewer_rate"], "completion": row["average_completion"]} for row in department_rows],             "engagement_distribution": distribution, "engagement_over_time": day_rows(), "content_performance": content_rows[:25], "trends": {"period_change_percent": round((second_views - first_views) / first_views * 100, 2) if first_views else (100 if second_views else 0), "rising": content_rows[:5], "declining": sorted(content_rows, key=lambda row: row["completion_rate"])[:5], "at_risk": sorted([row for row in content_rows if row["mandatory"]], key=lambda row: (row["completion_rate"], -row["total_views"]))[:5]},
            "caption_usage": {
                "events": len(caption_events),
                "unique_viewers": caption_users,
                "usage_rate": round(caption_users / len(active_user_ids) * 100, 2) if active_user_ids else 0,
            },
            "completion_bands": completion_bands,
            "recent_viewers": recent_viewers,
            "approval_compliance": {
                "pending_count": pending_approval_count,
                "approved_count": request.env["company.documentary.media"].sudo().search_count([
                    ("company_id", "=", company.id),
                    ("approval_status", "=", "approved"),
                    ("deleted_at", "=", False),
                ]),
            },
        }}

    @http.route("/api/company-documentary/analytics", type="json", auth="user", methods=["POST"], csrf=False)
    def analytics(self, media_id=None, **kwargs):
        if not self._is_manager():
            return self._error(_("Documentary Manager access is required."))
        if not media_id:
            try:
                return self._analytics_dashboard_data(
                    date_from=kwargs.get("date_from"),
                    date_to=kwargs.get("date_to"),
                    department_id=kwargs.get("department_id"),
                    folder_id=kwargs.get("folder_id"),
                    media_id=kwargs.get("filter_media_id"),
                )
            except (UserError, AccessError, ValidationError) as error:
                return self._error(str(error))
        try:
            media = self._media(media_id, edit=True)
            progress = request.env["company.documentary.watch"].sudo().search([("media_id", "=", media.id)])
            completed = progress.filtered("completed")
            return {"success": True, "data": {
                "media_id": media.id,
                "view_count": sum(progress.mapped("view_count")),
                "unique_viewers": len(progress.mapped("user_id")),
                "average_completion_percent": sum(progress.mapped("completion_percent")) / len(progress) if progress else 0,
                "completed_viewers": len(completed),
                "required_completion_threshold": media.completion_threshold,
            }}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/company-documentary/analytics/summary", type="json", auth="user", methods=["POST"], csrf=False)
    def analytics_summary(self, **kwargs):
        if not self._is_manager():
            return self._error(_("Documentary Manager access is required."))
        try:
            return self._analytics_dashboard_data(
                date_from=kwargs.get("date_from"),
                date_to=kwargs.get("date_to"),
                department_id=kwargs.get("department_id"),
                folder_id=kwargs.get("folder_id"),
                media_id=kwargs.get("media_id"),
            )
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/company-documentary/continue-watching", type="json", auth="user", methods=["POST"], csrf=False)
    def continue_watching(self, **kwargs):
        progress = request.env["company.documentary.watch"].sudo().search([
            ("user_id", "=", self._user().id),
            ("completed", "=", False),
            ("position_seconds", ">", 0),
        ], order="last_watched_at desc", limit=24)
        items = []
        for record in progress:
            media = record.media_id
            if media._user_can_view(self._user()):
                payload = self._media_data(media, self._user())
                payload["watch_progress"] = {
                    "position_seconds": record.position_seconds,
                    "completion_percent": record.completion_percent,
                    "completed": record.completed,
                    "last_watched_at": record.last_watched_at,
                }
                items.append(payload)
        return {"success": True, "data": items}

    @http.route("/api/company-documentary/recycle-bin", type="json", auth="user", methods=["POST"], csrf=False)
    def recycle_bin(self, **kwargs):
        if not self._is_manager():
            return self._error(_("Documentary Manager access is required."))
        media = request.env["company.documentary.media"].sudo().search([
            ("company_id", "=", self._user().company_id.id),
            ("deleted_at", "!=", False),
        ], order="deleted_at desc")
        folders = request.env["company.documentary.folder"].sudo().search([
            ("company_id", "=", self._user().company_id.id),
            ("deleted_at", "!=", False),
        ], order="deleted_at desc")
        media = media.filtered(lambda item: item._user_can_edit(self._user()))
        folders = folders.filtered(lambda item: item._user_can_edit(self._user()))
        return {"success": True, "data": {
            "media": [self._media_data(item, self._user()) for item in media],
            "folders": [self._folder_data(item, self._user()) for item in folders],
        }}

    @http.route("/api/company-documentary/recycle-bin/clear", type="json", auth="user", methods=["POST"], csrf=False)
    def clear_recycle_bin(self, **kwargs):
        if not self._is_manager():
            return self._error(_("Documentary Manager access is required."))
        media = request.env["company.documentary.media"].sudo().search([
            ("company_id", "=", self._user().company_id.id),
            ("deleted_at", "!=", False),
        ])
        media = media.filtered(lambda item: item._user_can_edit(self._user()))
        count = len(media)
        media.action_permanent_delete()
        return {"success": True, "data": {"purged_count": count}}

    @http.route("/api/company-documentary/settings", type="json", auth="user", methods=["POST"], csrf=False)
    def documentary_settings(self, save=False, **values):
        company = self._user().company_id
        if save:
            if not self._is_admin():
                return self._error(_("Documentary Administrator access is required."))
            payload = {}
            for key, field in (
                ("require_upload_approval", "documentary_require_upload_approval"),
                ("default_mandatory", "documentary_default_mandatory"),
                ("default_comments_enabled", "documentary_default_comments_enabled"),
                ("default_allow_download", "documentary_default_allow_download"),
                ("default_completion_threshold", "documentary_default_completion_threshold"),
                ("deleted_retention_days", "documentary_deleted_retention_days"),
                ("auto_transcription", "documentary_auto_transcription"),
            ):
                if key in values:
                    payload[field] = values[key]
            if payload:
                company.write(payload)
        return {"success": True, "data": self._settings_data(company)}

    @http.route("/api/company-documentary/folders/pin", type="json", auth="user", methods=["POST"], csrf=False)
    def pin_folder(self, id=None, pinned=True, **kwargs):
        try:
            folder = self._folder(id)
            command = fields.Command.link(self._user().id) if pinned else fields.Command.unlink(self._user().id)
            folder.sudo().write({"pinned_user_ids": [command]})
            return {"success": True, "data": self._folder_data(folder, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/company-documentary/media/approval", type="json", auth="user", methods=["POST"], csrf=False)
    def media_approval(self, id=None, action=None, comment=None, publish_at=None, **kwargs):
        if not self._is_manager():
            return self._error(_("Documentary Manager access is required."))
        try:
            media = self._media(id, edit=True)
            if action == "approve":
                if publish_at:
                    media.write({"publish_at": publish_at})
                media.action_approve(comment)
            elif action == "reject":
                media.action_reject(comment)
            elif action == "submit":
                media.action_submit_for_approval()
            elif action == "cancel_schedule":
                media.write({"publish_at": False, "approval_status": "approved", "published_at": fields.Datetime.now()})
            else:
                return self._error(_("Unsupported approval action."))
            self._audit("media_updated", media=media, metadata={"approval_action": action})
            return {"success": True, "data": self._media_data(media, self._user())}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/company-documentary/media/batch-update", type="json", auth="user", methods=["POST"], csrf=False)
    def media_batch_update(self, ids=None, **values):
        try:
            media_records = request.env["company.documentary.media"].sudo().browse(
                [_int(value) for value in (ids or [])]
            ).exists().filtered(lambda item: item.company_id == self._user().company_id)
            if not media_records:
                return self._error(_("Select at least one video."))
            payload = {key: values[key] for key in (
                "mandatory", "comments_enabled", "download_policy", "scope_mode", "access_scope",
            ) if key in values}
            for key in ("department_ids", "grade_ids", "employee_ids", "tag_ids"):
                if key in values:
                    payload[key] = [(6, 0, [_int(value) for value in values[key]])]
            if not payload:
                return self._error(_("No update fields were provided."))
            for media in media_records:
                if not media._user_can_edit(self._user()):
                    raise AccessError(_("You do not have permission to update one of the selected videos."))
                media.write(payload)
            return {"success": True, "data": {"updated_ids": media_records.ids}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/company-documentary/media/share", type="json", auth="user", methods=["POST"], csrf=False)
    def media_share(self, id=None, **kwargs):
        try:
            media = self._media(id)
            media._ensure_share_token()
            host = request.httprequest.host_url.rstrip("/")
            return {"success": True, "data": {
                "url": "%s/company-documentary?share=%s" % (host, media.share_token),
                "token": media.share_token,
            }}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))

    @http.route("/api/company-documentary/media/caption-event", type="json", auth="user", methods=["POST"], csrf=False)
    def caption_event(self, media_id=None, **kwargs):
        try:
            media = self._media(media_id)
            employee = self._user().employee_id
            if employee:
                request.env["company.documentary.watch.event"].sudo().create({
                    "media_id": media.id,
                    "user_id": self._user().id,
                    "employee_id": employee.id,
                    "event_type": "caption",
                })
            return {"success": True, "data": {"recorded": True}}
        except (UserError, AccessError, ValidationError) as error:
            return self._error(str(error))
