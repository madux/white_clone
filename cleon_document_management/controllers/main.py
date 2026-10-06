import json
from datetime import date, datetime, timedelta
from odoo import _, fields, http
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.http import request
from odoo.modules.module import get_resource_path
from odoo.osv import expression
import base64
import logging

from odoo.addons.cleon_document_management.controllers.access import (
    require_manage_document_types,
    require_manage_ef_tenant_config,
    require_manage_org_tenant_config,
    require_manage_retention_lifecycle,
    settings_panel_access_message,
)

_logger = logging.getLogger(__name__)


def _as_bool(value, default=False):
    """Coerce JSON-RPC params (bool, 0/1, \"true\"/\"false\" strings) reliably."""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in ("", "0", "false", "no", "off"):
            return False
        if normalized in ("1", "true", "yes", "on"):
            return True
    return bool(value)


def _attachment_bytes(attachment):
    """Return decoded attachment content for HTTP preview/download responses."""
    data = attachment.datas or b""
    return base64.b64decode(data)


def _uploaded_files():
    """Read both the new batch field and the legacy single-file field."""
    files = request.httprequest.files.getlist("files")
    return files or request.httprequest.files.getlist("file")


def _upload_type_ids():
    raw_list = request.httprequest.form.getlist("document_type_ids")
    if raw_list:
        parsed = []
        for raw in raw_list:
            if not raw:
                continue
            try:
                values = json.loads(raw)
                if isinstance(values, list):
                    parsed.extend([int(v) for v in values])
                elif isinstance(values, (int, str)):
                    parsed.append(int(values))
            except (TypeError, ValueError, json.JSONDecodeError):
                for part in str(raw).split(","):
                    part = part.strip()
                    if part.isdigit():
                        parsed.append(int(part))
        if parsed:
            return parsed

    raw = request.httprequest.form.get("document_type_id")
    if raw:
        try:
            return [int(raw)]
        except ValueError:
            pass
    return []


def _upload_expiry_dates():
    raw = request.httprequest.form.get("expiry_dates")
    if not raw:
        return []
    try:
        values = json.loads(raw)
        if isinstance(values, list):
            return values
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    return []


def _upload_replace_document_ids():
    raw = request.httprequest.form.get("replace_document_ids")
    if not raw:
        return []
    try:
        values = json.loads(raw)
        if isinstance(values, list):
            parsed = []
            for value in values:
                if value in (None, "", 0, "0", False):
                    parsed.append(None)
                else:
                    parsed.append(int(value))
            return parsed
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    return []


def _upload_change_notes():
    raw = request.httprequest.form.get("change_notes")
    if not raw:
        return []
    try:
        values = json.loads(raw)
        if isinstance(values, list):
            return [str(value or "") for value in values]
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    return []


def _upload_allow_separate_duplicates():
    raw = request.httprequest.form.get("allow_separate_duplicates")
    if not raw:
        return []
    try:
        values = json.loads(raw)
        if isinstance(values, list):
            return [bool(value) for value in values]
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    return []


def _conflict_payload(document, document_type):
    doc_versions = document.version_ids.mapped("version_number")
    policy = document_type.resolve_duplicate_detection_mode()
    return {
        "document_type_id": document_type.id,
        "document_type_name": document_type.name,
        "existing_document_id": document.id,
        "existing_name": document.name,
        "policy": policy,
        "enable_versioning": bool(document_type.enable_versioning),
        "version_count": len(document.version_ids),
        "latest_version_number": max(doc_versions or [0]),
    }


def _enforce_upload_conflict(employee, document_type, replace_document_id, allow_separate):
    if not employee or replace_document_id:
        return
    Document = request.env["doc.document"]
    conflict = Document.find_upload_conflict(employee, document_type)
    if not conflict:
        return
    policy = document_type.resolve_duplicate_detection_mode()
    type_name = document_type.name
    if policy == "prevent":
        raise ValidationError(
            _(
                "An active %(type)s document already exists for this employee. "
                "Use Update on the existing document.",
                type=type_name,
            )
        )
    if not allow_separate:
        raise ValidationError(
            _(
                "An active %(type)s document already exists (%(name)s). "
                "Update the existing document or confirm uploading a separate copy.",
                type=type_name,
                name=conflict.name,
            )
        )


def _upload_issue_dates():
    raw = request.httprequest.form.get("issue_dates")
    if not raw:
        return []
    try:
        values = json.loads(raw)
        if isinstance(values, list):
            return values
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    return []


def _upload_descriptions():
    raw = request.httprequest.form.get("descriptions")
    if not raw:
        return []
    try:
        values = json.loads(raw)
        if isinstance(values, list):
            return [str(value or "") for value in values]
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    return []


def _metadata_values_for_upload(document_type, issue_date, description, expiry_values):
    expiry_date = (expiry_values or {}).get("expiry_date") if expiry_values else None
    document_type.validate_upload_metadata(
        issue_date=issue_date or None,
        expiry_date=expiry_date,
        description=description,
    )
    values = {}
    if issue_date:
        values["issue_date"] = issue_date
    if description is not None:
        values["description"] = description
    return values


class _UploadBytes:
    """Minimal file-like object for approval execution from staged attachments."""

    def __init__(self, filename, content, mimetype):
        self.filename = filename or "document"
        self._content = content or b""
        self.mimetype = mimetype or "application/octet-stream"

    def read(self):
        return self._content


def _process_document_upload(
    upload,
    document_type,
    expiry_values,
    folder,
    employee=None,
    replace_document_id=None,
    change_note="",
    issue_date=None,
    description=None,
    allow_separate_duplicate=False,
):
    """Create a new document or version an existing one from an uploaded file."""
    if folder.folder_type == "organizational":
        request.env["doc.organizational.files.permission"].require_upload_org(
            request.env.user
        )
    folder.assert_unlocked(for_upload=True)
    Document = request.env["doc.document"]
    _metadata_values_for_upload(document_type, issue_date, description, expiry_values)
    _enforce_upload_conflict(
        employee,
        document_type,
        replace_document_id,
        allow_separate_duplicate,
    )
    if replace_document_id:
        document = Document.browse(int(replace_document_id)).exists()
        if not document:
            raise ValidationError(_("The document to update could not be found."))
        document.check_access_rule("read")
        if document.document_type_id.id != document_type.id:
            raise ValidationError(_("The document type does not match the existing file."))
        if employee and document.employee_id.id != employee.id:
            raise ValidationError(_("This file belongs to another employee."))
        if not document.active or document.deleted_at:
            raise ValidationError(_("Cannot create a new version for an inactive document."))
        document.replace_file_from_upload(
            upload.filename or document.name,
            upload.read(),
            upload.mimetype or "application/octet-stream",
            change_note=change_note,
            expiry_values=expiry_values or {},
            description=description,
            issue_date=issue_date,
        )
        return document

    attachment = request.env["ir.attachment"].sudo().create({
        "name": upload.filename or "document",
        "datas": base64.b64encode(upload.read()),
        "mimetype": upload.mimetype or "application/octet-stream",
    })
    create_vals = {
        "name": upload.filename or "Document",
        "folder_id": folder.id,
        "document_type_id": document_type.id,
        "attachment_id": attachment.id,
        **(expiry_values or {}),
    }
    if issue_date:
        create_vals["issue_date"] = issue_date
    if description is not None:
        create_vals["description"] = description
    if employee:
        create_vals["employee_id"] = employee.id
    document = Document.create(create_vals)
    if folder.folder_type == "organizational":
        request.env["doc.object.audit"].log(
            document,
            "upload",
            _("Uploaded %s") % document.name,
        )
        if not request.env["doc.org.malware.scanner"].process_org_document(document):
            raise ValidationError(
                _(
                    "This file was quarantined by the malware scanner and is not "
                    "available in the folder. For local dev, set CLEON_CLAMAV_ENABLED=0 "
                    "in .env and restart Odoo."
                )
            )
    return document


def _expiry_values_for_upload(document_type, expiry_date):
    if not document_type.expiry_applicable:
        return {}
    if not expiry_date:
        return None
    return {"has_expiry": True, "expiry_date": expiry_date}


def _expiring_documents_domain(env):
    return [
        ("has_expiry", "=", True),
        (
            "expiry_date",
            "<=",
            fields.Date.add(fields.Date.context_today(env.user), days=30),
        ),
        ("state", "=", "approved"),
        ("active", "=", True),
        ("deleted_at", "=", False),
    ]


def _serialize_expiring_document(document):
    folder = document.folder_id
    return {
        "id": document.id,
        "name": document.name,
        "document_type": document.document_type_id.name,
        "expiry_date": document.expiry_date,
        "folder_id": folder.id,
        "employee_id": document.employee_id.id or False,
        "folder_type": folder.folder_type,
    }


class DocumentUICreation(http.Controller):

    @staticmethod
    def _settings_values():
        params = request.env["ir.config_parameter"].sudo()
        raw_approvers = params.get_param(
            "cleon_document_management.default_approver_ids", ""
        )
        config = request.env["doc.employee.files.config"].get_for_company()
        org_owned_ids = config.org_company_owned_user_ids.ids
        if not org_owned_ids:
            org_owned_ids = config.default_company_owned_admin_users(
                config.company_id
            ).ids
        return {
            "default_require_upload_approval": params.get_param(
                "cleon_document_management.default_require_upload_approval", "0"
            ) == "1",
            "default_approval_flow": params.get_param(
                "cleon_document_management.default_approval_flow", "any"
            ),
            "default_retention_period": params.get_param(
                "cleon_document_management.default_retention_period", "7"
            ),
            "recycle_bin_retention_days": int(
                params.get_param(
                    "cleon_document_management.recycle_bin_retention_days", "30"
                )
            ),
            "default_approver_ids": [
                int(value) for value in raw_approvers.split(",") if value.isdigit()
            ],
            "default_org_access_scope": config.default_org_access_scope or "private",
            "default_org_restricted_scope": config.default_org_restricted_scope
            or "department",
            "org_company_owned_user_ids": org_owned_ids,
            "org_company_owned_user_ids_saved": bool(
                config.org_company_owned_user_ids
            ),
            "default_company_owned_admin_user_ids": config.default_company_owned_admin_users(
                config.company_id
            ).ids,
            "org_approval_sla_hours": config.org_approval_sla_hours or 48,
            "org_approval_reminder_hours_before_sla": config.org_approval_reminder_hours_before_sla
            or 6,
            "org_approval_escalation_user_id": config.org_approval_escalation_user_id.id or False,
            "org_approval_delegate_user_id": config.org_approval_delegate_user_id.id or False,
            "org_approval_delegate_until": fields.Datetime.to_string(
                config.org_approval_delegate_until
            )
            if config.org_approval_delegate_until
            else False,
        }

    @staticmethod
    def _settings_denied():
        message = settings_panel_access_message()
        if message:
            return {"success": False, "message": message}
        return None

    @http.route(
        "/api/get-document-type",
        type="json",
        auth="user",
        methods=["GET", "POST"],
        csrf=False,
    )
    def get_document_types(self, **kwargs):
        """Return active document types available to document-management forms."""
        types = request.env["doc.document.type"].search([("active", "=", True)])
        return {
            "success": True,
            "data": [item.serialize_for_api() for item in types],
        }

    @http.route(
        "/api/create-document-type",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def create_document_type(self, **kwargs):
        """Create a document type without leaving the current document form."""
        try:
            require_manage_document_types()
        except AccessError as error:
            return {"success": False, "message": str(error)}

        name = (kwargs.get("name") or "").strip()
        if not name:
            return {"success": False, "message": "Document type name is required."}

        category = kwargs.get("category") or "other"
        valid_categories = {
            "hr",
            "finance",
            "legal",
            "identity",
            "employment",
            "medical",
            "training",
            "other",
        }
        if category not in valid_categories:
            return {
                "success": False,
                "message": "Select a valid document type category.",
            }

        model = request.env["doc.document.type"]
        if model.search([("name", "ilike", name)], limit=1):
            return {
                "success": False,
                "message": "A document type with this name already exists.",
            }

        values = {
            "name": name,
            "category": category,
            "description": (kwargs.get("description") or "").strip(),
            "is_mandatory_default": bool(kwargs.get("is_mandatory_default", False)),
            "expiry_applicable": bool(kwargs.get("expiry_applicable", False)),
            "require_upload_approval": bool(
                kwargs.get("require_upload_approval", False)
            ),
            "require_issue_date": bool(kwargs.get("require_issue_date", False)),
            "require_description": bool(kwargs.get("require_description", False)),
            "enable_versioning": bool(kwargs.get("enable_versioning", True)),
            "duplicate_detection_mode": kwargs.get("duplicate_detection_mode")
            or "inherit",
            "approval_flow": kwargs.get("approval_flow") or "any",
            "default_retention_years": max(
                int(kwargs.get("default_retention_years") or 7), 0
            ),
        }
        if values["duplicate_detection_mode"] not in {
            "inherit",
            "warn",
            "prevent",
            "allow_confirm",
        }:
            return {"success": False, "message": "Select a valid duplicate handling mode."}
        if values["approval_flow"] not in {"sequential", "random", "any"}:
            return {"success": False, "message": "Select a valid approval flow."}
        if kwargs.get("approver_ids") is not None:
            approver_ids = [
                int(value)
                for value in kwargs.get("approver_ids") or []
                if str(value).isdigit() or isinstance(value, int)
            ]
            users = request.env["res.users"].browse(approver_ids).exists()
            values["approver_ids"] = [fields.Command.set(users.ids)]
            values["approver_order"] = ",".join(str(user_id) for user_id in users.ids)
        item = model.create(values)
        return {
            "success": True,
            "message": "Document type created successfully.",
            "data": item.serialize_for_api(),
        }

    @http.route(
        "/api/settings", type="json", auth="user", methods=["POST"], csrf=False
    )
    def get_settings(self, **kwargs):
        denied = self._settings_denied()
        if denied:
            return denied
        types = request.env["doc.document.type"].with_context(active_test=False).search(
            [], order="sequence, name"
        )
        return {
            "success": True,
            "data": {
                "settings": self._settings_values(),
                "approvers": [
                    {"id": user.id, "name": user.name, "email": user.email or user.login}
                    for user in request.env["res.users"].search(
                        [("active", "=", True)], order="name"
                    )
                ],
                "document_types": [item.serialize_for_api() for item in types],
            },
        }

    @http.route(
        "/api/settings/document-type",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def save_settings_document_type(self, **kwargs):
        try:
            require_manage_document_types()
        except AccessError as error:
            return {"success": False, "message": str(error)}
        name = (kwargs.get("name") or "").strip()
        category = kwargs.get("category") or "other"
        valid_categories = {"hr", "finance", "legal", "identity", "employment", "medical", "training", "other"}
        if not name or category not in valid_categories:
            return {"success": False, "message": "A valid name and category are required."}
        flow = kwargs.get("approval_flow") or "any"
        if flow not in {"sequential", "random", "any"}:
            return {"success": False, "message": "Select a valid approval flow."}
        values = {
            "name": name,
            "category": category,
            "description": (kwargs.get("description") or "").strip(),
            "is_mandatory_default": bool(kwargs.get("is_mandatory_default", False)),
            "expiry_applicable": bool(kwargs.get("expiry_applicable", False)),
            "require_upload_approval": bool(kwargs.get("require_upload_approval", False)),
            "require_issue_date": bool(kwargs.get("require_issue_date", False)),
            "require_description": bool(kwargs.get("require_description", False)),
            "enable_versioning": bool(kwargs.get("enable_versioning", True)),
            "duplicate_detection_mode": kwargs.get("duplicate_detection_mode")
            or "inherit",
            "approval_flow": flow,
            "default_retention_years": max(int(kwargs.get("default_retention_years") or 7), 0),
            "sequence": int(kwargs.get("sequence") or 10),
        }
        dup_mode = values["duplicate_detection_mode"]
        if dup_mode not in {"inherit", "warn", "prevent", "allow_confirm"}:
            return {"success": False, "message": "Select a valid duplicate handling mode."}
        if kwargs.get("approver_ids") is not None:
            approver_ids = [
                int(value)
                for value in kwargs.get("approver_ids") or []
                if str(value).isdigit() or isinstance(value, int)
            ]
            users = request.env["res.users"].browse(approver_ids).exists()
            values["approver_ids"] = [fields.Command.set(users.ids)]
            values["approver_order"] = ",".join(str(user_id) for user_id in users.ids)
        model = request.env["doc.document.type"].with_context(active_test=False)
        item = model.browse(int(kwargs["id"])).exists() if kwargs.get("id") else model.browse()
        duplicate = model.search([("name", "ilike", name), ("id", "!=", item.id)], limit=1)
        if duplicate:
            return {"success": False, "message": "A document type with this name already exists."}
        try:
            if item:
                item.write(values)
            else:
                item = model.create(values)
        except ValidationError as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": item.serialize_for_api()}

    @http.route(
        "/api/settings/document-type/toggle",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def toggle_settings_document_type(self, id=None, **kwargs):
        try:
            require_manage_document_types()
        except AccessError as error:
            return {"success": False, "message": str(error)}
        item = request.env["doc.document.type"].with_context(active_test=False).browse(int(id or 0)).exists()
        if not item:
            return {"success": False, "message": "Document type not found."}
        item.write({"active": not item.active})
        return {"success": True, "active": item.active}

    @http.route(
        "/api/settings/document-type/delete",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def delete_settings_document_type(self, id=None, **kwargs):
        try:
            require_manage_document_types()
        except AccessError as error:
            return {"success": False, "message": str(error)}
        item = (
            request.env["doc.document.type"]
            .with_context(active_test=False)
            .browse(int(id or 0))
            .exists()
        )
        if not item:
            return {"success": False, "message": "Document type not found."}
        try:
            item.unlink()
        except ValidationError as error:
            return {"success": False, "message": str(error)}
        return {"success": True}

    @http.route(
        "/api/settings/save",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def save_settings(self, **kwargs):
        try:
            require_manage_retention_lifecycle()
            require_manage_ef_tenant_config()
            if any(
                key in kwargs
                for key in (
                    "default_org_access_scope",
                    "default_org_restricted_scope",
                    "org_company_owned_user_ids",
                    "org_approval_sla_hours",
                    "org_approval_reminder_hours_before_sla",
                    "org_approval_escalation_user_id",
                    "org_approval_delegate_user_id",
                    "org_approval_delegate_until",
                )
            ):
                require_manage_org_tenant_config()
        except AccessError as error:
            return {"success": False, "message": str(error)}
        flow = kwargs.get("default_approval_flow") or "any"
        retention = kwargs.get("default_retention_period") or "7"
        try:
            recycle_days = max(int(kwargs.get("recycle_bin_retention_days") or 30), 1)
        except (TypeError, ValueError):
            return {"success": False, "message": "Recycle-bin retention must be a valid number."}
        if flow not in {"sequential", "random", "any"}:
            return {"success": False, "message": "Select a valid approval flow."}
        if retention not in {"1", "3", "5", "7", "10", "permanent"}:
            return {"success": False, "message": "Select a valid default retention period."}
        require_approval = bool(kwargs.get("default_require_upload_approval"))
        approver_ids = [int(value) for value in (kwargs.get("default_approver_ids") or [])]
        approver_ids = request.env["res.users"].browse(approver_ids).exists().ids
        if require_approval:
            if not approver_ids:
                return {
                    "success": False,
                    "message": "Select at least one approver when upload approval is enabled.",
                }
            if flow == "sequential" and not approver_ids:
                return {
                    "success": False,
                    "message": "Select at least one approver for sequential approval.",
                }
        params = request.env["ir.config_parameter"].sudo()
        params.set_param("cleon_document_management.default_require_upload_approval", "1" if require_approval else "0")
        params.set_param("cleon_document_management.default_approval_flow", flow)
        params.set_param("cleon_document_management.default_retention_period", retention)
        params.set_param("cleon_document_management.recycle_bin_retention_days", str(recycle_days))
        params.set_param(
            "cleon_document_management.default_approver_ids",
            ",".join(str(value) for value in approver_ids),
        )
        config = request.env["doc.employee.files.config"].get_for_company()
        org_scope_values = {}
        allowed_org_scopes = {
            "all_staff",
            "department",
            "grade",
            "individual",
            "private",
            "company_owned",
            "admin_only",
        }
        if "default_org_access_scope" in kwargs:
            scope = (kwargs.get("default_org_access_scope") or "private").strip()
            if scope not in allowed_org_scopes:
                return {
                    "success": False,
                    "message": "Select a valid default organizational visibility.",
                }
            org_scope_values["default_org_access_scope"] = scope
        if "default_org_restricted_scope" in kwargs:
            restricted = (
                kwargs.get("default_org_restricted_scope") or "department"
            ).strip()
            if restricted not in {"department", "grade", "individual"}:
                return {
                    "success": False,
                    "message": "Select a valid default restricted visibility.",
                }
            org_scope_values["default_org_restricted_scope"] = restricted
        if "org_company_owned_user_ids" in kwargs:
            raw_ids = kwargs.get("org_company_owned_user_ids") or []
            user_ids = [
                int(value)
                for value in raw_ids
                if str(value).isdigit() or isinstance(value, int)
            ]
            users = request.env["res.users"].browse(user_ids).exists()
            org_scope_values["org_company_owned_user_ids"] = [
                fields.Command.set(users.ids)
            ]
        if org_scope_values:
            config.write(org_scope_values)
        org_approval_values = {}
        if "org_approval_sla_hours" in kwargs:
            try:
                org_approval_values["org_approval_sla_hours"] = max(
                    int(kwargs.get("org_approval_sla_hours") or 48), 1
                )
            except (TypeError, ValueError):
                return {
                    "success": False,
                    "message": "Organisational approval SLA must be a valid number of hours.",
                }
        if "org_approval_reminder_hours_before_sla" in kwargs:
            try:
                org_approval_values["org_approval_reminder_hours_before_sla"] = max(
                    int(kwargs.get("org_approval_reminder_hours_before_sla") or 6), 0
                )
            except (TypeError, ValueError):
                return {
                    "success": False,
                    "message": "Approval reminder lead time must be a valid number of hours.",
                }
        if "org_approval_escalation_user_id" in kwargs:
            escalation_id = int(kwargs.get("org_approval_escalation_user_id") or 0) or False
            if escalation_id:
                escalation_id = (
                    request.env["res.users"].browse(escalation_id).exists().id or False
                )
            org_approval_values["org_approval_escalation_user_id"] = escalation_id
        if "org_approval_delegate_user_id" in kwargs:
            delegate_id = int(kwargs.get("org_approval_delegate_user_id") or 0) or False
            if delegate_id:
                delegate_id = request.env["res.users"].browse(delegate_id).exists().id or False
            org_approval_values["org_approval_delegate_user_id"] = delegate_id
        if "org_approval_delegate_until" in kwargs:
            raw_until = kwargs.get("org_approval_delegate_until")
            org_approval_values["org_approval_delegate_until"] = (
                fields.Datetime.to_datetime(raw_until) if raw_until else False
            )
        if org_approval_values:
            config.write(org_approval_values)
        return {"success": True, "data": self._settings_values()}

    @http.route(
        "/api/create-folder", type="json", auth="user", methods=["POST"], csrf=False
    )
    def create_folder(self, **kwargs):
        """Create a document folder"""
        try:
            name = kwargs.get("nameElm")
            description = kwargs.get("descriptionElm")
            folder_type = kwargs.get("folder_type") or "organizational"
            if folder_type == "organizational":
                org_perm = request.env["doc.organizational.files.permission"]
                if not org_perm.user_can_create_folder(request.env.user):
                    return {
                        "success": False,
                        "message": "You do not have permission to create folders.",
                    }
                name = (name or "").strip()
                if not name:
                    return {"success": False, "message": "Folder name is required."}
                if len(name) > 100:
                    return {
                        "success": False,
                        "message": "Folder name must be 100 characters or fewer.",
                    }
                description = (description or "").strip()
                if len(description) > 500:
                    return {
                        "success": False,
                        "message": "Description must be 500 characters or fewer.",
                    }
                parent_id = kwargs.get("parent_id") or False
                duplicate_domain = [
                    ("folder_type", "=", "organizational"),
                    ("folder_name", "=", name),
                    ("active", "=", True),
                    ("deleted_at", "=", False),
                ]
                if parent_id:
                    duplicate_domain.append(("parent_id", "=", int(parent_id)))
                else:
                    duplicate_domain.append(("parent_id", "=", False))
                duplicate = request.env["doc.folder"].search(
                    duplicate_domain,
                    limit=1,
                )
                if duplicate:
                    return {
                        "success": False,
                        "message": "A folder with this name already exists.",
                    }
                approval = request.env["doc.organizational.approval.service"]
                approval_payload = {
                    key: kwargs.get(key)
                    for key in (
                        "name",
                        "nameElm",
                        "description",
                        "descriptionElm",
                        "parent_id",
                        "access_scope",
                        "folder_kind",
                        "organize_by",
                        "folder_color",
                        "retention_period",
                        "department_ids",
                        "grade_ids",
                        "employee_ids",
                        "allowed_document_type_ids",
                    )
                    if key in kwargs
                }
                approval_payload["name"] = name
                approval_payload["nameElm"] = name
                approval_payload["description"] = description
                approval_payload["descriptionElm"] = description
                gate = approval.submit_or_block(
                    request.env.user,
                    "create_folder",
                    approval_payload,
                    name=_("Create folder: %s") % name,
                )
                if not gate.get("execute"):
                    pending = gate.get("request")
                    return approval.pending_api_response(pending)
            elif not name:
                return {"success": False, "message": "Folder name is required."}

            folder_type = kwargs.get("folder_type") or "organizational"
            if folder_type not in ("employee", "organizational"):
                return {"success": False, "message": "Invalid folder type."}
            if folder_type == "employee":
                config = request.env["doc.employee.files.config"].get_for_company()
                if config.setup_complete:
                    return {
                        "success": False,
                        "message": "Employee folders are managed automatically after Employee Files setup.",
                    }
            settings = self._settings_values()
            parent = request.env["doc.folder"]
            parent_id = kwargs.get("parent_id") or False
            if parent_id:
                parent = request.env["doc.folder"].browse(int(parent_id)).exists()
                if not parent:
                    return {"success": False, "message": "Parent folder not found."}

            access_scope = kwargs.get("access_scope")
            inherit_access = False
            if folder_type == "employee":
                access_scope = access_scope or "individual"
            elif not access_scope and parent and parent.folder_type == "organizational":
                access_scope = parent.access_scope
                inherit_access = True
            elif not access_scope:
                access_scope = "all_staff"

            department_ids = list(kwargs.get("department_ids") or [])
            grade_ids = list(kwargs.get("grade_ids") or [])
            employee_ids = list(kwargs.get("employee_ids") or [])
            if inherit_access:
                if not department_ids:
                    department_ids = parent.department_ids.ids
                if not grade_ids:
                    grade_ids = parent.grade_ids.ids
                if not employee_ids:
                    employee_ids = parent.employee_ids.ids

            if folder_type == "organizational" and access_scope == "department" and not department_ids:
                return {"success": False, "message": "Select at least one department."}
            if folder_type == "organizational" and access_scope == "grade" and not grade_ids:
                return {"success": False, "message": "Select at least one grade."}
            if folder_type == "organizational" and access_scope == "individual" and not employee_ids:
                return {"success": False, "message": "Select at least one employee."}
            values = {
                "folder_name": name,
                "description": description or "",
                "folder_type": folder_type,
                "folder_kind": kwargs.get("folder_kind") or "folder",
                "access_scope": access_scope,
                "retention_period": kwargs.get("retention_period") or settings["default_retention_period"],
            }
            if folder_type == "organizational":
                values["organize_by"] = kwargs.get("organize_by") or "none"
            if parent:
                values["parent_id"] = parent.id
            Folder = request.env["doc.folder"]
            try:
                if folder_type == "employee":
                    values.update(
                        Folder._prepare_approval_values(
                            require_upload_approval=kwargs.get(
                                "require_upload_approval"
                            ),
                            approval_flow=kwargs.get("approval_flow"),
                            approver_ids=kwargs.get("approver_ids"),
                            settings=settings,
                        )
                    )
                else:
                    values.update(
                        Folder._prepare_approval_values(
                            require_upload_approval=False,
                            approval_flow="any",
                            approver_ids=[],
                        )
                    )
            except ValidationError as error:
                return {"success": False, "message": error.args[0]}
            if folder_type == "employee":
                departments = (
                    request.env["hr.department"]
                    .browse(kwargs.get("department_ids", []))
                    .exists()
                )
                if not departments:
                    return {
                        "success": False,
                        "message": "Select at least one existing department.",
                    }

                grades = (
                    request.env["hr.grade"]
                    .browse(kwargs.get("grade_ids", []))
                    .exists()
                )

                existing_folder = request.env["doc.folder"].search(
                    [
                        ("folder_type", "=", "employee"),
                        ("active", "=", True),
                        ("deleted_at", "=", False),
                        ("department_ids", "in", departments.ids),
                    ],
                    limit=1,
                )
                if existing_folder:
                    dept_names = ", ".join(departments.mapped("name"))
                    return {
                        "success": False,
                        "message": (
                            f"An employee folder already exists for {dept_names}."
                        ),
                    }

                employee_model = request.env["hr.employee"]
                domain = [
                    ("active", "=", True),
                    ("department_id", "in", departments.ids),
                ]
                if grades:
                    domain.append(("grade_id", "in", grades.ids))
                employees = employee_model.search(domain)

                values["access_scope"] = "department"
                values["department_ids"] = [
                    fields.Command.set(departments.ids)
                ]
                if grades:
                    values["grade_ids"] = [fields.Command.set(grades.ids)]
                values["employee_ids"] = [fields.Command.set(employees.ids)]
            if folder_type == "organizational":
                values["allowed_document_type_ids"] = [
                    fields.Command.set(
                        request.env["doc.document.type"]
                        .browse(kwargs.get("allowed_document_type_ids", []))
                        .exists()
                        .ids
                    )
                ]
                values["department_ids"] = [
                    fields.Command.set(
                        request.env["hr.department"]
                        .browse(department_ids)
                        .exists()
                        .ids
                    )
                ]
                values["grade_ids"] = [
                    fields.Command.set(
                        request.env["hr.grade"]
                        .browse(grade_ids)
                        .exists()
                        .ids
                    )
                ]
                values["employee_ids"] = [
                    fields.Command.set(
                        request.env["hr.employee"]
                        .browse(employee_ids)
                        .exists()
                        .ids
                    )
                ]
            FolderModel = request.env["doc.folder"]
            if folder_type == "organizational":
                folder = FolderModel.sudo().create(values)
            else:
                folder = FolderModel.create(values)
            if folder.folder_type == "employee":
                folder._assign_pending_approved_documents_for_employees(
                    folder.employee_ids
                )
                request.env["doc.folder"].sync_pending_upload_assignments()
            return {
                "success": True,
                "message": "Folder created successfully.",
                "data": {
                    "id": folder.id,
                    "name": folder.folder_name,
                    "description": folder.description,
                },
            }

        except Exception as e:
            _logger.exception(e)
            return {"success": False, "message": str(e)}

    # type='json',
    #     auth='user',
    #     methods=['POST'],
    #     csrf=False
    @http.route(
        ["/api/get-folder", "/api/get-folder/<int:id>"],
        type="json",
        auth="user",
        methods=["GET", "POST"],
        csrf=False,
    )
    def getfolder(self, id=None, **kwargs):
        """Get all folders or a specific folder"""

        Folder = request.env["doc.folder"]

        try:
            # Get a single folder
            if id:
                folder = Folder.browse(id)

                if not folder.exists():
                    return {"success": False, "message": "Folder not found."}

                return {
                    "success": True,
                    "count": 1,
                    "data": {
                        "data": {
                            "id": folder.id,
                            "folder_name": folder.folder_name or "N/A",
                            "description": folder.description or "N/A",
                            "last_modified": folder.write_date,
                            "owner_id": folder.owner_id.name or "N/A",
                            "document_count": folder.document_count,
                            "favorite": request.env.user in folder.favorite_user_ids,
                            "pinned": request.env.user in folder.pinned_user_ids,
                            "locked": folder.is_locked,
                            "active": folder.active,
                            "employee_ids": folder.employee_ids.ids,
                            "department_ids": folder.department_ids.ids,
                            "grade_ids": folder.grade_ids.ids,
                            "require_upload_approval": folder.require_upload_approval,
                            "approval_flow": folder.approval_flow,
                            "approver_ids": folder.approver_ids.ids,
                            "color": folder.color,
                            "color_hex": folder.color_hex or "",
                        }
                    },
                }

            # Get all folders
            folders = Folder.search(
                [("active", "=", True), ("is_pending_uploads", "=", False)]
            )

            return {
                "success": True,
                "count": len(folders),
                "data": {
                    "data": [
                        {
                            "id": folder.id,
                            "folder_name": folder.folder_name,
                            "folder_type": folder.folder_type,
                            "folder_kind": getattr(folder, "folder_kind", "folder") or "folder",
                            "parent_id": folder.parent_id.id if folder.parent_id else False,
                            "description": folder.description,
                            "folder_count": folder.document_count,
                            "last_modified": folder.write_date,
                            "owner_id": folder.owner_id.name or "N/A",
                            "owner_name": folder.owner_id.name or "N/A",
                            "access_scope": folder.access_scope,
                            "color": folder.color,
                            "color_hex": folder.color_hex or "",
                            "document_count": folder.document_count,
                            "favorite": request.env.user in folder.favorite_user_ids,
                            "pinned": request.env.user in folder.pinned_user_ids,
                            "locked": folder.is_locked,
                            "active": folder.active,
                            "collection_code": getattr(folder, "collection_code", "") or "",
                            "organize_by": getattr(folder, "organize_by", "none") or "none",
                            "employee_ids": folder.employee_ids.ids,
                            "department_ids": folder.department_ids.ids,
                            "grade_ids": folder.grade_ids.ids,
                            "require_upload_approval": folder.require_upload_approval,
                            "approval_flow": folder.approval_flow,
                            "approver_ids": folder.approver_ids.ids,
                        }
                        for folder in folders
                    ],
                    "total_count": len(folders.ids),
                },
            }

        except Exception as e:
            return {"success": False, "message": str(e)}

    @http.route(
        "/api/view-folder/<int:id>",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def view_folder(self, id, **kwargs):

        folder = request.env["doc.folder"].browse(id)

        if not folder.exists():
            return {"success": False, "message": "Folder not found."}

        return {
            "success": True,
            "data": {
                "id": folder.id,
                "folder_name": folder.folder_name,
                "description": folder.description,
                "owner": folder.owner_id.name,
                "document_count": folder.document_count,
                "last_modified": folder.write_date,
            },
        }

    @http.route(
        "/api/update-folder", type="json", auth="user", methods=["POST"], csrf=False
    )
    def update_folder(self, id=None, folder_name=None, description=None, **kwargs):

        try:
            folder = request.env["doc.folder"].browse(int(id))

            if not folder.exists():
                return {"success": False, "message": "Folder not found."}

            if folder.folder_type == "organizational":
                org_perm = request.env["doc.organizational.files.permission"]
                user = request.env.user
                can_manage = org_perm.user_can_manage_folders(user)
                can_share_access = org_perm.user_can_share_manage_access(user)
                if not can_manage and not can_share_access:
                    return {
                        "success": False,
                        "message": "You do not have permission to edit this folder.",
                    }
                if not can_manage:
                    renaming = (
                        folder_name is not None
                        and folder_name != folder.folder_name
                    )
                    redescribing = (
                        description is not None
                        and description != (folder.description or "")
                    )
                    if renaming or redescribing:
                        return {
                            "success": False,
                            "message": "You do not have permission to edit this folder.",
                        }
                    for blocked_key in (
                        "color_hex",
                        "color",
                        "organize_by",
                        "require_upload_approval",
                        "approval_flow",
                        "approver_ids",
                    ):
                        if blocked_key in kwargs:
                            return {
                                "success": False,
                                "message": "You do not have permission to edit this folder.",
                            }
                    if "access_scope" not in kwargs:
                        return {
                            "success": False,
                            "message": "You do not have permission to edit this folder.",
                        }

            write_values = {}
            if folder_name is not None:
                write_values["folder_name"] = folder_name
            if description is not None:
                write_values["description"] = description
            if any(
                key in kwargs
                for key in (
                    "require_upload_approval",
                    "approval_flow",
                    "approver_ids",
                )
            ):
                if folder.folder_type == "employee":
                    try:
                        write_values.update(
                            folder._prepare_approval_values(
                                require_upload_approval=kwargs.get(
                                    "require_upload_approval"
                                ),
                                approval_flow=kwargs.get("approval_flow"),
                                approver_ids=kwargs.get("approver_ids"),
                            )
                        )
                    except ValidationError as error:
                        return {"success": False, "message": error.args[0]}

            if folder.folder_type == "organizational" and "access_scope" in kwargs:
                try:
                    write_values.update(
                        folder._prepare_organizational_scope_values(
                            kwargs.get("access_scope"),
                            department_ids=kwargs.get("department_ids"),
                            grade_ids=kwargs.get("grade_ids"),
                            employee_ids=kwargs.get("employee_ids"),
                        )
                    )
                except ValidationError as error:
                    return {"success": False, "message": error.args[0]}

            if "color_hex" in kwargs:
                write_values["color_hex"] = kwargs.get("color_hex") or False
            if "color" in kwargs and kwargs.get("color") is not None:
                write_values["color"] = int(kwargs.get("color"))
            if "organize_by" in kwargs and folder.folder_type == "organizational":
                write_values["organize_by"] = kwargs.get("organize_by") or "none"

            approval_disabled = (
                folder.folder_type == "employee"
                and write_values.get("require_upload_approval") is False
            )
            if write_values:
                folder.write(write_values)
            if approval_disabled:
                request.env["doc.folder"].reconcile_pending_uploads_for_folder(folder)

            return {"success": True, "message": "Folder updated successfully."}

        except Exception as e:
            return {"success": False, "message": str(e)}

    @http.route(
        "/api/delete-folder", type="json", auth="user", methods=["POST"], csrf=False
    )
    def delete_folder(self, id=None, **kwargs):

        try:
            if not id:
                return {"success": False, "message": "Folder ID is required."}

            folder = request.env["doc.folder"].browse(int(id))

            if not folder.exists():
                return {"success": False, "message": "Folder not found."}

            folder.action_move_to_recycle_bin()

            return {"success": True, "message": "Folder moved to the recycle bin."}

        except Exception as e:
            return {"success": False, "message": str(e)}

    @http.route(
        "/api/delete-folders", type="json", auth="user", methods=["POST"], csrf=False
    )
    def delete_folders(self, folder_ids=None, **kwargs):
        try:
            ids = sorted(
                {int(value) for value in (folder_ids or []) if str(value).isdigit()}
            )
            if not ids:
                return {"success": False, "message": "Select at least one folder."}

            folders = request.env["doc.folder"].browse(ids).exists()
            if len(folders) != len(set(ids)):
                return {"success": False, "message": "One or more folders were not found."}

            org_perm = request.env["doc.organizational.files.permission"]
            user = request.env.user
            for folder in folders:
                folder.check_access_rule("read")
                if folder.folder_type == "organizational" and not org_perm.user_can_folder_delete(
                    user
                ):
                    return {
                        "success": False,
                        "message": "You do not have permission to delete one or more folders.",
                    }

            for folder in folders:
                folder.action_move_to_recycle_bin()

            return {
                "success": True,
                "message": f"Moved {len(folders)} folder(s) to the recycle bin.",
                "data": {"folder_ids": folders.ids},
            }

        except Exception as e:
            return {"success": False, "message": str(e)}

    @http.route(
        "/api/archive-folder", type="json", auth="user", methods=["POST"], csrf=False
    )
    def archive_folder(self, id=None, **kwargs):

        try:
            if not id:
                return {"success": False, "message": "Folder ID is required."}

            folder = request.env["doc.folder"].browse(int(id))

            if not folder.exists():
                return {"success": False, "message": "Folder not found."}

            folder.action_archive()

            return {"success": True, "message": "Folder archived successfully."}

        except Exception as e:
            return {"success": False, "message": str(e)}

    @http.route(
        "/api/folder/add-employees",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def add_employees_to_folder(
        self,
        id=None,
        employee_ids=None,
        force_move=False,
        move_from_folder_ids=None,
        **kwargs,
    ):
        folder = request.env["doc.folder"].browse(int(id or 0)).exists()
        if not folder:
            return {"success": False, "message": "Folder not found."}
        if folder.folder_type != "employee":
            return {
                "success": False,
                "message": "Only employee folders can contain employees.",
            }
        config = request.env["doc.employee.files.config"].get_for_company()
        if config.setup_complete:
            return {
                "success": False,
                "message": "Employee membership is managed by EMS after Employee Files setup.",
            }
        force_move = bool(kwargs.get("force_move", force_move))
        move_from_folder_ids = move_from_folder_ids or kwargs.get("move_from_folder_ids") or {}
        ids = [int(value) for value in (employee_ids or []) if str(value).isdigit()]
        employees = request.env["hr.employee"].browse(ids).exists()
        if not employees:
            return {"success": False, "message": "Select at least one employee."}

        conflicting_folders = request.env["doc.folder"].search(
            [
                ("folder_type", "=", "employee"),
                ("id", "!=", folder.id),
                ("employee_ids", "in", employees.ids),
            ]
        )
        if force_move:
            for other_folder in conflicting_folders:
                to_remove = other_folder.employee_ids.filtered(
                    lambda employee: employee.id in employees.ids
                )
                if to_remove:
                    other_folder.write(
                        {
                            "employee_ids": [
                                fields.Command.unlink(employee.id)
                                for employee in to_remove
                            ]
                        }
                    )
        elif move_from_folder_ids:
            for employee_id_raw, from_folder_id_raw in move_from_folder_ids.items():
                employee_id = int(employee_id_raw)
                from_folder = request.env["doc.folder"].browse(
                    int(from_folder_id_raw or 0)
                ).exists()
                if (
                    from_folder
                    and from_folder.folder_type == "employee"
                    and employee_id in from_folder.employee_ids.ids
                ):
                    from_folder.write(
                        {"employee_ids": [fields.Command.unlink(employee_id)]}
                    )

        folder.write(
            {
                "employee_ids": [
                    fields.Command.link(employee.id) for employee in employees
                ]
            }
        )
        folder._assign_pending_approved_documents_for_employees(employees)
        request.env["doc.folder"].sync_pending_upload_assignments()
        return {"success": True, "employee_ids": folder.employee_ids.ids}

    @http.route(
        "/api/folder/check-employee-conflicts",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def check_employee_conflicts(self, id=None, employee_ids=None, **kwargs):
        folder = request.env["doc.folder"].browse(int(id or 0)).exists()
        if not folder:
            return {"success": False, "message": "Folder not found."}
        ids = [int(value) for value in (employee_ids or []) if str(value).isdigit()]
        employees = request.env["hr.employee"].browse(ids).exists()
        already_in_folder = employees.filtered(
            lambda employee: employee.id in folder.employee_ids.ids
        ).ids
        other_folders = []
        for employee in employees.filtered(
            lambda item: item.id not in already_in_folder
        ):
            folders = request.env["doc.folder"].search(
                [
                    ("folder_type", "=", "employee"),
                    ("id", "!=", folder.id),
                    ("employee_ids", "in", employee.id),
                ]
            )
            for other in folders:
                other_folders.append(
                    {
                        "employee_id": employee.id,
                        "employee_name": employee.name,
                        "folder_id": other.id,
                        "folder_name": other.folder_name,
                    }
                )
        return {
            "success": True,
            "already_in_folder": already_in_folder,
            "other_folders": other_folders,
        }

    @http.route(
        "/api/check-upload-conflicts",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def check_upload_conflicts(self, employee_id=None, items=None, **kwargs):
        employee = request.env["hr.employee"].browse(int(employee_id or 0)).exists()
        if not employee:
            return {"success": False, "message": "Employee not found."}
        Document = request.env["doc.document"]
        DocumentType = request.env["doc.document.type"]
        conflicts = []
        seen_types = set()
        for item in items or []:
            try:
                document_type_id = int(item.get("document_type_id") or 0)
            except (TypeError, ValueError):
                continue
            if not document_type_id or document_type_id in seen_types:
                continue
            seen_types.add(document_type_id)
            document_type = DocumentType.browse(document_type_id).exists()
            if not document_type:
                continue
            conflict = Document.find_upload_conflict(employee, document_type)
            if conflict:
                conflicts.append(_conflict_payload(conflict, document_type))
        return {"success": True, "conflicts": conflicts}

    @http.route(
        "/api/check-upload-duplicates",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def check_upload_duplicates(self, employee_id=None, items=None, **kwargs):
        """Deprecated filename-based check; returns no matches."""
        return {"success": True, "matches": []}

    @http.route(
        "/api/get-document",
        type="json",
        auth="user",
        methods=["GET", "POST"],
        csrf=False,
    )
    def get_documents(self, folder_id=False, **kwargs):
        """List documents, optionally filtered by folder_id."""
        try:
            user = request.env.user
            env = request.env
            include_inactive = _as_bool(kwargs.get("include_inactive"))
            folder_id_int = int(folder_id) if folder_id else False
            is_doc_manager = user.has_group(
                "cleon_document_management.group_document_manager"
            ) or user.has_group(
                "cleon_document_management.group_document_admin"
            )
            use_folder_working_set = include_inactive and bool(folder_id_int)

            if use_folder_working_set:
                documents = (
                    env["doc.document"]
                    .sudo()
                    .with_context(active_test=False)
                    .search(
                        [
                            ("deleted_at", "=", False),
                            ("folder_id", "=", folder_id_int),
                        ],
                        order="create_date desc",
                    )
                )
                visible_documents = documents.filtered(
                    lambda document: document._visible_in_folder_document_list(
                        user, include_inactive=True
                    )
                )
            elif include_inactive and is_doc_manager:
                domain = [("deleted_at", "=", False)]
                if folder_id_int:
                    domain.append(("folder_id", "=", folder_id_int))
                documents = (
                    env["doc.document"]
                    .with_context(active_test=False)
                    .search(domain, order="create_date desc")
                )
                visible_documents = documents.filtered(
                    lambda document: document.folder_id.folder_type
                    != "organizational"
                    or document._organizational_user_can_access(user)
                )
            else:
                domain = [
                    ("active", "=", True),
                    ("deleted_at", "=", False),
                    ("folder_id.active", "=", True),
                    ("folder_id.deleted_at", "=", False),
                    ("folder_id.distribution_status", "=", "active"),
                ]
                if folder_id_int:
                    domain.append(("folder_id", "=", folder_id_int))
                documents = env["doc.document"].search(
                    domain, order="create_date desc"
                )
                visible_documents = documents.filtered(
                    lambda document: document.folder_id.folder_type
                    != "organizational"
                    or document._organizational_user_can_access(user)
                )
            return {
                "success": True,
                "count": len(visible_documents),
                "data": {
                    "data": [
                        document.serialize_for_api(
                            user,
                            favorite=user in document.favorite_user_ids,
                            pinned=user in document.pinned_user_ids,
                        )
                        for document in visible_documents
                    ],
                    "total_count": len(visible_documents.ids),
                },
            }
        except AccessError:
            return {
                "success": False,
                "message": _(
                    "Document access is not configured for your account. Contact your administrator."
                ),
            }

    @http.route(
        "/api/quick-access", type="json", auth="user", methods=["POST"], csrf=False
    )
    def quick_access(self, **kwargs):
        user = request.env.user
        folders = request.env["doc.folder"].search(
            [
                ("active", "=", True),
                ("is_pending_uploads", "=", False),
                ("pinned_user_ids", "in", user.id),
            ],
            order="write_date desc",
        )
        documents = request.env["doc.document"].search(
            [
                ("active", "=", True),
                ("deleted_at", "=", False),
                ("pinned_user_ids", "in", user.id),
            ],
            order="write_date desc",
        )
        return {
            "success": True,
            "data": {
                "folders": [
                    {
                        "id": folder.id,
                        "folder_name": folder.folder_name,
                        "description": folder.description or "",
                        "folder_type": folder.folder_type,
                        "color_hex": folder.color_hex or "",
                        "pinned": True,
                    }
                    for folder in folders
                ],
                "documents": [
                    document.serialize_for_api(user, pinned=True)
                    for document in documents
                ],
            },
        }

    @http.route(
        "/api/my-documents", type="json", auth="user", methods=["POST"], csrf=False
    )
    def my_documents(self, **kwargs):
        employee = request.env.user.employee_id
        domain = expression.OR([
            [
                ("owner_id", "=", request.env.user.id),
                ("folder_id.folder_type", "=", "employee"),
            ],
            [("employee_id", "=", employee.id or 0)],
        ])
        documents = request.env["doc.document"].search(
            domain + [
                ("active", "=", True),
                ("deleted_at", "=", False),
                ("folder_id.active", "=", True),
                ("folder_id.deleted_at", "=", False),
                ("folder_id.distribution_status", "=", "active"),
            ],
            order="write_date desc",
        )
        return {
            "success": True,
            "data": [
                document.serialize_for_api(request.env.user)
                for document in documents
            ],
        }

    @http.route(
        "/api/my-documents/upload",
        type="http",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def upload_my_document(self, **kwargs):
        """Upload a personal employee document as a draft."""
        employee = request.env.user.employee_id
        uploads = _uploaded_files()
        document_type_ids = _upload_type_ids()
        if not employee:
            return request.make_json_response(
                {
                    "success": False,
                    "message": "Your user account is not linked to an employee record.",
                },
                status=400,
            )
        if not uploads or not document_type_ids or len(document_type_ids) not in (1, len(uploads)):
            return request.make_json_response(
                {"success": False, "message": "File and document type are required."},
                status=400,
            )
        document_types = request.env["doc.document.type"].browse(list(set(document_type_ids))).exists()
        if len(document_types) != len(set(document_type_ids)):
            return request.make_json_response(
                {"success": False, "message": "Select a valid document type."},
                status=400,
            )
        if not employee.department_id:
            return request.make_json_response(
                {
                    "success": False,
                    "message": "Your employee record needs a department before uploading a document.",
                },
                status=400,
            )
        folder = request.env["doc.folder"].get_pending_upload_folder()
        if not folder:
            return request.make_json_response(
                {
                    "success": False,
                    "message": "Unable to prepare the upload destination.",
                },
                status=400,
            )
        documents = request.env["doc.document"]
        expiry_dates = _upload_expiry_dates()
        issue_dates = _upload_issue_dates()
        descriptions = _upload_descriptions()
        replace_document_ids = _upload_replace_document_ids()
        change_notes = _upload_change_notes()
        allow_separate = _upload_allow_separate_duplicates()
        try:
            for index, upload in enumerate(uploads):
                type_id = document_type_ids[0] if len(document_type_ids) == 1 else document_type_ids[index]
                document_type = document_types.filtered(lambda item: item.id == type_id)[:1]
                expiry_date = expiry_dates[index] if index < len(expiry_dates) else (expiry_dates[0] if len(expiry_dates) == 1 else False)
                issue_date = issue_dates[index] if index < len(issue_dates) else (issue_dates[0] if len(issue_dates) == 1 else False)
                description = descriptions[index] if index < len(descriptions) else (descriptions[0] if len(descriptions) == 1 else "")
                expiry_values = _expiry_values_for_upload(document_type, expiry_date)
                if expiry_values is None:
                    return request.make_json_response(
                        {
                            "success": False,
                            "message": f"An expiry date is required for {document_type.name}.",
                        },
                        status=400,
                    )
                replace_id = replace_document_ids[index] if index < len(replace_document_ids) else None
                change_note = change_notes[index] if index < len(change_notes) else ""
                allow_flag = allow_separate[index] if index < len(allow_separate) else False
                documents |= _process_document_upload(
                    upload,
                    document_type,
                    expiry_values,
                    folder,
                    employee=employee,
                    replace_document_id=replace_id,
                    change_note=change_note,
                    issue_date=issue_date or None,
                    description=description,
                    allow_separate_duplicate=allow_flag,
                )
        except (ValidationError, AccessError, UserError) as error:
            return request.make_json_response({"success": False, "message": str(error)}, status=400)
        request.env["doc.folder"].sync_pending_upload_assignments()
        return request.make_json_response(
            {"success": True, "data": {"id": documents[0].id, "name": documents[0].name}, "documents": [{"id": doc.id, "name": doc.name} for doc in documents]}
        )

    @http.route(
        "/api/employee-documents/upload",
        type="http",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def upload_employee_document(self, **kwargs):
        """Upload a document for a selected employee from the manager profile view."""
        if not request.env.user.has_group(
            "cleon_document_management.group_document_manager"
        ):
            return request.make_json_response(
                {"success": False, "message": "Document manager access is required."},
                status=403,
            )
        uploads = _uploaded_files()
        employee_id = request.httprequest.form.get("employee_id")
        document_type_ids = _upload_type_ids()
        if not uploads or not employee_id or not document_type_ids or len(document_type_ids) not in (1, len(uploads)):
            return request.make_json_response(
                {
                    "success": False,
                    "message": "File, employee, and document type are required.",
                },
                status=400,
            )
        employee = request.env["hr.employee"].browse(int(employee_id)).exists()
        document_types = request.env["doc.document.type"].browse(list(set(document_type_ids))).exists()
        if not employee or len(document_types) != len(set(document_type_ids)):
            return request.make_json_response(
                {
                    "success": False,
                    "message": "Select a valid employee and document type.",
                },
                status=400,
            )
        folder_model = request.env["doc.folder"]
        if not folder_model._employee_has_active_employee_folder(employee):
            return request.make_json_response(
                {
                    "success": False,
                    "message": "This employee must be assigned to a folder before you can upload documents for them.",
                },
                status=400,
            )
        folder = folder_model.resolve_manager_employee_upload_folder(employee)
        if not folder:
            return request.make_json_response(
                {
                    "success": False,
                    "message": "Unable to resolve an upload destination for this employee.",
                },
                status=400,
            )
        documents = request.env["doc.document"]
        expiry_dates = _upload_expiry_dates()
        issue_dates = _upload_issue_dates()
        descriptions = _upload_descriptions()
        replace_document_ids = _upload_replace_document_ids()
        change_notes = _upload_change_notes()
        allow_separate = _upload_allow_separate_duplicates()
        try:
            for index, upload in enumerate(uploads):
                type_id = document_type_ids[0] if len(document_type_ids) == 1 else document_type_ids[index]
                document_type = document_types.filtered(lambda item: item.id == type_id)[:1]
                expiry_date = expiry_dates[index] if index < len(expiry_dates) else (expiry_dates[0] if len(expiry_dates) == 1 else False)
                issue_date = issue_dates[index] if index < len(issue_dates) else (issue_dates[0] if len(issue_dates) == 1 else False)
                description = descriptions[index] if index < len(descriptions) else (descriptions[0] if len(descriptions) == 1 else "")
                expiry_values = _expiry_values_for_upload(document_type, expiry_date)
                if expiry_values is None:
                    return request.make_json_response(
                        {
                            "success": False,
                            "message": f"An expiry date is required for {document_type.name}.",
                        },
                        status=400,
                    )
                replace_id = replace_document_ids[index] if index < len(replace_document_ids) else None
                change_note = change_notes[index] if index < len(change_notes) else ""
                allow_flag = allow_separate[index] if index < len(allow_separate) else False
                documents |= _process_document_upload(
                    upload,
                    document_type,
                    expiry_values,
                    folder,
                    employee=employee,
                    replace_document_id=replace_id,
                    change_note=change_note,
                    issue_date=issue_date or None,
                    description=description,
                    allow_separate_duplicate=allow_flag,
                )
        except (ValidationError, AccessError, UserError) as error:
            return request.make_json_response({"success": False, "message": str(error)}, status=400)
        return request.make_json_response(
            {"success": True, "data": {"id": documents[0].id, "name": documents[0].name}, "documents": [{"id": doc.id, "name": doc.name} for doc in documents]}
        )

    @http.route(
        "/api/my-documents/request-approval",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def request_my_document_approval(self, id=None, **kwargs):
        """Submit an employee-owned draft to the document administrators."""
        document = request.env["doc.document"].browse(int(id or 0)).exists()
        if (
            not document
            or document.owner_id != request.env.user
            or document.employee_id != request.env.user.employee_id
        ):
            return {
                "success": False,
                "message": "You can only request approval for your own employee documents.",
            }
        if document.state not in ("draft", "rejected"):
            return {
                "success": False,
                "message": "Only draft or rejected documents can be submitted for approval.",
            }
        approval_model = request.env["doc.document.approval"].sudo()
        approval_model.search([("document_id", "=", document.id)]).unlink()
        approvers = request.env.ref(
            "cleon_document_management.group_document_admin"
        ).users.filtered(lambda user: user != request.env.user)
        if not approvers:
            approvers = request.env.ref(
                "cleon_document_management.group_document_admin"
            ).users
        if not approvers:
            return {
                "success": False,
                "message": "No document administrator is available to review this document.",
            }
        document.sudo().write(
            {
                "state": "processing",
                "approval_state": "pending",
                "approval_ids": [
                    fields.Command.create(
                        {
                            "approver_id": approver.id,
                            "sequence": sequence,
                            "state": "pending" if sequence == 1 else "waiting",
                        }
                    )
                    for sequence, approver in enumerate(approvers, start=1)
                ],
            }
        )
        document.sudo().message_post(
            body=_("%s submitted %s for review.")
            % (request.env.user.name, document.name),
            partner_ids=approvers.mapped("partner_id").ids,
            subtype_xmlid="mail.mt_note",
        )
        return {
            "success": True,
            "data": {
                "id": document.id,
                "state": document.state,
                "approval_state": document.approval_state,
            },
        }

    @http.route(
        "/api/my-workspace", type="json", auth="user", methods=["POST"], csrf=False
    )
    def my_workspace(self, **kwargs):
        try:
            return self._my_workspace_data()
        except AccessError:
            return {
                "success": False,
                "message": _(
                    "Document access is not configured for your account. Contact your administrator."
                ),
            }

    def _my_workspace_data(self):
        user = request.env.user
        employee = user.employee_id
        own_domain = [
            *expression.OR([
                [
                    ("owner_id", "=", user.id),
                    ("folder_id.folder_type", "=", "employee"),
                ],
                [("employee_id", "=", employee.id or 0)],
            ]),
        ]
        shared_base_domain = [
            ("folder_id.folder_type", "=", "organizational"),
            ("active", "=", True),
            ("deleted_at", "=", False),
            ("folder_id.active", "=", True),
            ("folder_id.deleted_at", "=", False),
            ("folder_id.distribution_status", "=", "active"),
            ("state", "!=", "draft"),
        ]
        employee_id = employee.id if employee else 0
        department_id = employee.department_id.id if employee and employee.department_id else 0
        grade_id = employee.grade_id.id if employee and employee.grade_id else 0
        employee_type_id = employee.employee_type_id.id if employee and employee.employee_type_id else 0
        branch_id = employee.branch_id.id if employee and employee.branch_id else 0
        shared_access = [
            [("allowed_user_ids", "in", [user.id])],
            [("allowed_group_ids", "in", user.groups_id.ids)],
            [("folder_id.allowed_user_ids", "in", [user.id])],
            [("folder_id.access_scope", "=", "all_staff")],
            [("folder_id.access_scope", "=", "department"), ("folder_id.department_ids", "in", [department_id])],
            [("folder_id.access_scope", "=", "grade"), ("folder_id.grade_ids", "in", [grade_id])],
            [("folder_id.access_scope", "=", "employment_type"), ("folder_id.employment_type_ids", "in", [employee_type_id])],
            [("folder_id.access_scope", "=", "business_unit"), ("folder_id.branch_ids", "in", [branch_id])],
            [("folder_id.access_scope", "=", "role"), ("folder_id.role_group_ids", "in", user.groups_id.ids)],
            [("folder_id.access_scope", "=", "individual"), ("folder_id.employee_ids", "in", [employee_id])],
        ]
        if user.has_group("cleon_document_management.group_document_admin"):
            shared_access.append([("folder_id.access_scope", "=", "admin_only")])
        shared_domain = shared_base_domain + expression.OR(shared_access)
        own = request.env["doc.document"].search(
            own_domain + [
                ("active", "=", True),
                ("deleted_at", "=", False),
                ("folder_id.active", "=", True),
                ("folder_id.deleted_at", "=", False),
                ("folder_id.distribution_status", "=", "active"),
            ],
            order="write_date desc",
        )
        Document = request.env["doc.document"]
        shared = Document.search(shared_domain, order="write_date desc")
        shared = shared.filter_for_organizational_access(user)
        combined = own | shared
        outstanding = []
        if employee:
            policies = request.env["doc.compliance.policy"].search(
                [("active", "=", True)]
            )
            for policy in policies:
                if not policy._applies_to_employee(employee):
                    continue
                evaluation = request.env["doc.compliance.evaluation"].search(
                    [("policy_id", "=", policy.id), ("employee_id", "=", employee.id)],
                    limit=1,
                )
                for line in evaluation.line_ids.filtered(lambda item: item.status in ("missing", "grace")):
                    document_type = line.document_type_id
                    if document_type:
                        outstanding.append(
                            {
                                "id": -(policy.id * 10000 + document_type.id + line.id),
                                "name": document_type.name,
                                "description": (
                                    "Required by %s · grace period"
                                    if line.status == "grace"
                                    else "Required by %s"
                                ) % policy.name,
                                "folder_id": False,
                                "folder_name": "Outstanding requirements",
                                "employee_id": employee.id,
                                "employee_name": employee.name,
                                "document_type_id": document_type.id,
                                "document_type": document_type.name,
                                "state": line.status,
                                "approval_state": "pending",
                                "ocr_state": "pending",
                                "has_expiry": False,
                                "expiry_date": False,
                                "mime_type": "",
                                "file_size": 0,
                                "attachment_id": False,
                                "created_at": "",
                                "write_date": "",
                            }
                        )

        def serialize(document):
            acknowledgement = document.acknowledgement_ids.filtered(
                lambda item: item.user_id == user
            )[:1]
            return document.serialize_for_api(
                user,
                shared_by=document.uploaded_by.name
                or document.owner_id.name
                or "Document administrator",
                shared_by_id=document.uploaded_by.id
                or document.owner_id.id
                or False,
                favorite=user in document.favorite_user_ids,
                acknowledged=bool(acknowledgement),
                acknowledged_at=(
                    fields.Datetime.to_string(acknowledgement.acknowledged_at)
                    if acknowledgement
                    else False
                ),
            )

        activities = [
            {
                "id": document.id,
                "document_id": document.id,
                "document": document.name,
                "folder": document.folder_id.folder_name,
                "event": (
                    "Updated"
                    if document.write_date != document.create_date
                    else "Added"
                ),
                "occurred_at": fields.Datetime.to_string(
                    document.write_date or document.create_date
                ),
            }
            for document in combined[:20]
        ]
        acknowledgements = request.env["doc.document.acknowledgement"].search(
            [("user_id", "=", user.id)],
            order="acknowledged_at desc",
            limit=20,
        )
        for acknowledgement in acknowledgements:
            document = acknowledgement.document_id
            if not document:
                continue
            activities.append(
                {
                    "id": 20_000_000 + acknowledgement.id,
                    "document_id": document.id,
                    "document": document.name,
                    "folder": document.folder_id.folder_name,
                    "event": "Acknowledged",
                    "occurred_at": fields.Datetime.to_string(
                        acknowledgement.acknowledged_at
                    ),
                }
            )
        activities.sort(key=lambda item: item.get("occurred_at") or "", reverse=True)
        activities = activities[:20]
        states = {
            state: len(combined.filtered(lambda item, value=state: item.state == value))
            for state in ("approved", "processing", "draft", "rejected", "expired")
        }
        expiry_cutoff = fields.Date.add(fields.Date.context_today(request.env.user), days=30)
        expiring = combined.filtered(
            lambda item: item.has_expiry
            and item.expiry_date
            and item.expiry_date <= expiry_cutoff
            and item.state == "approved"
        )
        return {
            "success": True,
            "data": {
                "my_files": [serialize(document) for document in own],
                "shared_documents": [
                    serialize(document) for document in shared if document not in own
                ],
                "outstanding": outstanding,
                "activity": activities,
                "expiring_documents": [
                    _serialize_expiring_document(document) for document in expiring
                ],
                "dashboard": {
                    "total": len(combined),
                    "expiring": len(expiring),
                    "states": states,
                },
            },
        }

    @http.route(
        "/api/my-pending-uploads",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def my_pending_uploads(self, **kwargs):
        user = request.env.user
        employee = user.employee_id
        if not employee:
            return {"success": True, "data": {"count": 0, "items": []}}
        request.env["doc.folder"].sync_pending_upload_assignments()
        pending_folders = request.env["doc.folder"].sudo().search(
            [("is_pending_uploads", "=", True)]
        )
        if not pending_folders:
            pending_folders = request.env["doc.folder"].get_pending_upload_folder()
        documents = request.env["doc.document"].search(
            [
                ("employee_id", "=", employee.id),
                ("folder_id", "in", pending_folders.ids),
                ("active", "=", True),
                ("deleted_at", "=", False),
            ],
            order="create_date desc",
        )
        own_documents = request.env["doc.document"].search(
            [
                "|",
                ("owner_id", "=", user.id),
                ("employee_id", "=", employee.id),
                ("active", "=", True),
                ("deleted_at", "=", False),
            ],
            order="create_date desc",
        )
        documents = documents | own_documents.filtered(
            lambda item: item.approval_state == "pending"
            or item.state in ("draft", "processing")
            or item.folder_id in pending_folders
        )
        status_labels = {
            "pending_review": "Pending review",
            "awaiting_folder": "Submitted — waiting for folder setup",
            "awaiting_folder_restore": "Awaiting folder restore",
        }
        items = []
        seen = set()
        for document in documents:
            if document.id in seen:
                continue
            seen.add(document.id)
            if document.approval_state == "pending":
                status = "pending_review"
            elif document.recycle_origin_folder_id:
                status = "awaiting_folder_restore"
            elif document.folder_id in pending_folders:
                status = "awaiting_folder"
            else:
                continue
            items.append(
                {
                    "id": document.id,
                    "name": document.name,
                    "document_type": document.document_type_id.name,
                    "approval_state": document.approval_state,
                    "state": document.state,
                    "status": status,
                    "status_label": status_labels[status],
                    "origin_folder_name": document.recycle_origin_folder_id.folder_name
                    or "",
                    "created_at": document.create_date,
                }
            )
        return {"success": True, "data": {"count": len(items), "items": items}}

    @http.route(
        "/api/my-compliance",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def my_compliance(self, **kwargs):
        user = request.env.user
        employee = user.employee_id
        if not employee:
            return {
                "success": True,
                "data": {
                    "evaluations": [],
                    "outstanding": [],
                    "summary": {
                        "compliant": 0,
                        "partial": 0,
                        "non_compliant": 0,
                        "outstanding_count": 0,
                    },
                },
            }
        evaluations = request.env["doc.compliance.evaluation"].search(
            [("employee_id", "=", employee.id)],
            order="evaluated_at desc",
        )
        evaluation_data = []
        outstanding = []
        for evaluation in evaluations:
            lines = []
            for line in evaluation.line_ids:
                line_data = {
                    "id": line.id,
                    "requirement": line.requirement_id.name,
                    "document_type": line.document_type_id.name,
                    "status": line.status,
                    "required_count": line.required_count,
                    "matched_count": line.matched_count,
                }
                lines.append(line_data)
                if line.status in ("missing", "grace"):
                    outstanding.append(
                        {
                            "policy": evaluation.policy_id.name,
                            "document_type": line.document_type_id.name,
                            "status": line.status,
                        }
                    )
            evaluation_data.append(
                {
                    "id": evaluation.id,
                    "policy_id": evaluation.policy_id.id,
                    "policy": evaluation.policy_id.name,
                    "policy_active": evaluation.policy_id.active,
                    "allow_waiver": evaluation.policy_id.allow_waiver,
                    "score": evaluation.score,
                    "status": evaluation.status,
                    "compliance_status": evaluation.compliance_status,
                    "reason_message": evaluation.reason_message or "",
                    "complete_count": evaluation.complete_count,
                    "missing_count": evaluation.missing_count,
                    "grace_count": evaluation.grace_count,
                    "evaluated_at": str(evaluation.evaluated_at or ""),
                    "lines": lines,
                }
            )
        inbox = {
            "todo": [],
            "waiting": [],
            "done": [],
            "coming_up": [],
            "exceptions": [],
        }
        for evaluation in evaluations:
            for line in evaluation.line_ids:
                item = {
                    "policy": evaluation.policy_id.name,
                    "document_type": line.document_type_id.name,
                    "compliance_status": line.compliance_status or line.status,
                    "reason_message": line.reason_message or "",
                    "due_date": str(line.due_date or ""),
                }
                status = item["compliance_status"]
                if status in ("non_compliant", "at_risk") and line.status != "pending":
                    inbox["todo"].append(item)
                elif status == "pending":
                    inbox["waiting"].append(item)
                elif status in ("compliant", "exempt"):
                    inbox["done"].append(item)
                else:
                    inbox["coming_up"].append(item)
        exceptions = request.env["doc.compliance.exception"].search(
            [
                ("employee_id", "=", employee.id),
                ("status", "in", ("draft", "approved")),
                ("active", "=", True),
            ]
        )
        for exc in exceptions:
            inbox["exceptions"].append(
                {
                    "policy": exc.policy_id.name,
                    "status": exc.status,
                    "valid_until": str(exc.valid_until or ""),
                }
            )
        summary = {
            "compliant": len(
                evaluations.filtered(lambda item: item.status == "compliant")
            ),
            "partial": len(
                evaluations.filtered(lambda item: item.status in ("partial", "grace"))
            ),
            "non_compliant": len(
                evaluations.filtered(lambda item: item.status == "non_compliant")
            ),
            "outstanding_count": len(outstanding),
        }
        open_tasks = request.env["doc.compliance.task"].search(
            [
                ("employee_id", "=", employee.id),
                ("cycle_id.state", "=", "open"),
                ("status", "in", ("todo", "waiting", "reopened")),
            ],
            order="due_date asc, id asc",
            limit=200,
        )
        return {
            "success": True,
            "data": {
                "employee_id": employee.id,
                "evaluations": evaluation_data,
                "outstanding": outstanding,
                "inbox": inbox,
                "summary": summary,
                "tasks": [task.to_api_dict() for task in open_tasks],
            },
        }

    @http.route(
        "/api/document-versions",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def get_document_versions(self, document_id=None, id=None, **kwargs):
        doc_id = int(document_id or id or kwargs.get("document_id") or 0)
        doc = request.env["doc.document"].browse(doc_id).exists()
        if not doc:
            return {"success": False, "message": "Document not found."}
        try:
            doc.assert_organizational_user_can_access(request.env.user)
        except AccessError:
            return {"success": False, "message": "You do not have access to this document."}
        versions = doc.version_ids.sorted(key=lambda item: item.version_number, reverse=True)
        return {
            "success": True,
            "count": len(versions),
            "data": [
                {
                    "id": version.id,
                    "version_number": version.version_number,
                    "uploaded_by": version.uploaded_by.name,
                    "upload_date": fields.Datetime.to_string(version.upload_date),
                    "change_note": version.change_note or "",
                    "file_size": version.file_attachment.file_size or 0,
                    "mime_type": version.file_attachment.mimetype or "",
                }
                for version in versions
            ],
        }

    @http.route(
        "/api/view-document/<int:id>",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def view_document(self, id, **kwargs):
        doc = request.env["doc.document"].browse(id).exists()
        if not doc:
            return {"success": False, "message": "Document not found."}
        try:
            doc.assert_organizational_user_can_access(request.env.user)
        except AccessError as error:
            return {
                "success": False,
                "message": error.args[0] if error.args else "You do not have access to this document.",
            }
        return {
            "success": True,
            "data": doc.serialize_for_api(
                request.env.user,
                extracted_text=doc.extracted_text,
            ),
        }

    @http.route(
        "/document-management/document/<int:doc_id>/preview",
        type="http",
        auth="user",
        methods=["GET"],
    )
    def preview_document(self, doc_id, **kwargs):
        doc = request.env["doc.document"].browse(doc_id).exists()
        if not doc or not doc.attachment_id:
            return request.not_found()
        try:
            doc.assert_organizational_user_can_access(request.env.user)
        except AccessError:
            return request.not_found()
        variant = request.httprequest.args.get("variant")
        if variant == "current":
            attachment = doc.attachment_id
        elif variant == "pending":
            attachment = doc.pending_attachment_id
        else:
            attachment = doc._effective_preview_attachment()
        if not attachment:
            return request.not_found()
        return request.make_response(
            _attachment_bytes(attachment),
            headers=[
                ("Content-Type", attachment.mimetype or "application/octet-stream"),
                ("Content-Disposition", f'inline; filename="{attachment.name}"'),
            ],
        )

    @http.route(
        "/api/upload-document",
        type="http",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def upload_document(self, **kwargs):
        uploads = _uploaded_files()
        folder_id = request.httprequest.form.get("folder_id")
        document_type_ids = _upload_type_ids()
        if not uploads or not folder_id or not document_type_ids or len(document_type_ids) not in (1, len(uploads)):
            return request.make_json_response(
                {
                    "success": False,
                    "message": "File, folder, and document type are required.",
                },
                status=400,
            )
        folder = request.env["doc.folder"].browse(int(folder_id)).exists()
        document_types = request.env["doc.document.type"].browse(list(set(document_type_ids))).exists()
        if not folder or folder.folder_type != "organizational" or len(document_types) != len(set(document_type_ids)):
            return request.make_json_response(
                {
                    "success": False,
                    "message": "A valid organizational folder and document type are required.",
                },
                status=400,
            )
        folder.check_access_rule("read")
        try:
            request.env["doc.organizational.files.permission"].require_upload_org(
                request.env.user
            )
        except AccessError as error:
            return request.make_json_response(
                {"success": False, "message": str(error)}, status=403
            )
        expiry_dates = _upload_expiry_dates()
        issue_dates = _upload_issue_dates()
        descriptions = _upload_descriptions()
        replace_document_ids = _upload_replace_document_ids()
        change_notes = _upload_change_notes()
        approval = request.env["doc.organizational.approval.service"]
        replace_action = any(value for value in replace_document_ids)
        action_key = "replace_version" if replace_action else "upload_link_import_scan"
        if not approval.user_can_execute_without_approval(request.env.user, action_key):
            staged = request.env["ir.attachment"].sudo()
            staged_ids = []
            for upload in uploads:
                staged_ids.append(
                    staged.create(
                        {
                            "name": upload.filename or "document",
                            "datas": base64.b64encode(upload.read()),
                            "mimetype": upload.mimetype or "application/octet-stream",
                        }
                    ).id
                )
            payload = {
                "folder_id": folder.id,
                "document_type_ids": document_type_ids,
                "expiry_dates": expiry_dates,
                "issue_dates": issue_dates,
                "descriptions": descriptions,
                "replace_document_ids": replace_document_ids,
                "change_notes": change_notes,
                "is_template": request.httprequest.form.get("is_template")
                in ("1", "true", "True"),
            }
            label = (
                _("Replace version (%s file(s))") % len(uploads)
                if replace_action
                else _("Upload %s file(s)") % len(uploads)
            )
            gate = approval.submit_or_block(
                request.env.user,
                action_key,
                payload,
                name=label,
            )
            if not gate.get("execute"):
                pending = gate.get("request")
                pending.write(
                    {"staging_attachment_ids": [fields.Command.set(staged_ids)]}
                )
                return request.make_json_response(approval.pending_api_response(pending))
            request.env["ir.attachment"].browse(staged_ids).sudo().unlink()
        documents = request.env["doc.document"]
        try:
            for index, upload in enumerate(uploads):
                type_id = document_type_ids[0] if len(document_type_ids) == 1 else document_type_ids[index]
                document_type = document_types.filtered(lambda item: item.id == type_id)[:1]
                expiry_date = expiry_dates[index] if index < len(expiry_dates) else (expiry_dates[0] if len(expiry_dates) == 1 else False)
                issue_date = issue_dates[index] if index < len(issue_dates) else (issue_dates[0] if len(issue_dates) == 1 else False)
                description = descriptions[index] if index < len(descriptions) else (descriptions[0] if len(descriptions) == 1 else "")
                expiry_values = _expiry_values_for_upload(document_type, expiry_date)
                if expiry_values is None:
                    return request.make_json_response(
                        {
                            "success": False,
                            "message": f"An expiry date is required for {document_type.name}.",
                        },
                        status=400,
                    )
                replace_id = replace_document_ids[index] if index < len(replace_document_ids) else None
                change_note = change_notes[index] if index < len(change_notes) else ""
                documents |= _process_document_upload(
                    upload,
                    document_type,
                    expiry_values,
                    folder,
                    replace_document_id=replace_id,
                    change_note=change_note,
                    issue_date=issue_date or None,
                    description=description,
                )
            if request.httprequest.form.get("is_template") in ("1", "true", "True"):
                documents.write({"is_template": True})
        except (ValidationError, AccessError, UserError) as error:
            return request.make_json_response({"success": False, "message": str(error)}, status=400)
        return request.make_json_response(
            {"success": True, "data": {"id": documents[0].id, "name": documents[0].name}, "documents": [{"id": doc.id, "name": doc.name} for doc in documents]}
        )

    @http.route(
        "/api/create-document", type="json", auth="user", methods=["POST"], csrf=False
    )
    def create_document(self, **kwargs):
        folder_id = kwargs.get("folder_id")
        name = kwargs.get("name")
        document_type_id = kwargs.get("document_type_id")
        if not name or not folder_id or not document_type_id:
            return {
                "success": False,
                "message": "name, folder_id, document_type_id required.",
            }
        folder = request.env["doc.folder"].browse(int(folder_id)).exists()
        if folder and folder.folder_type == "organizational":
            try:
                request.env["doc.organizational.files.permission"].require_upload_org(
                    request.env.user
                )
            except AccessError as error:
                return {"success": False, "message": str(error)}
        try:
            if folder:
                folder.assert_unlocked(for_upload=True)
            payload = {
                "name": name,
                "folder_id": folder_id,
                "document_type_id": document_type_id,
                "source_url": kwargs.get("source_url") or False,
                "description": kwargs.get("description") or kwargs.get("source_url") or "",
                "is_policy": bool(kwargs.get("is_policy")),
                "is_template": bool(kwargs.get("is_template")),
                "imported_from": kwargs.get("imported_from") or "native",
            }
            if kwargs.get("source_url") and not payload.get("attachment_id"):
                from odoo.addons.cleon_document_management.models.organizational_library import (
                    probe_source_url,
                )

                payload["link_status"] = probe_source_url(kwargs.get("source_url"))
                placeholder = request.env["ir.attachment"].sudo().create(
                    {
                        "name": f"{name}.url.txt",
                        "datas": base64.b64encode(b"external-link"),
                        "mimetype": "text/plain",
                        "res_model": "doc.document",
                    }
                )
                payload["attachment_id"] = placeholder.id
            if kwargs.get("is_policy") and not kwargs.get("source_url") and not kwargs.get(
                "attachment_id"
            ):
                file_name = (name or "").strip()
                if file_name and not file_name.lower().endswith(".pdf"):
                    file_name = f"{file_name}.pdf"
                elif not file_name:
                    file_name = "Policy.pdf"
                payload["name"] = file_name
                placeholder = request.env["ir.attachment"].sudo().create(
                    {
                        "name": file_name,
                        "datas": base64.b64encode(
                            b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
                            b"2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n"
                            b"trailer<</Size 2/Root 1 0 R>>\nstartxref\n0\n%%EOF"
                        ),
                        "mimetype": "application/pdf",
                        "res_model": "doc.document",
                    }
                )
                payload["attachment_id"] = placeholder.id
            if kwargs.get("linked_policy_id"):
                payload["linked_policy_id"] = int(kwargs["linked_policy_id"])
            doc = request.env["doc.document"].create(payload)
            linked_policy_id = int(kwargs.get("linked_policy_id") or 0)
            if linked_policy_id:
                policy = (
                    request.env["doc.compliance.policy"]
                    .browse(linked_policy_id)
                    .exists()
                )
                if policy:
                    policy.sudo().write({"source_document_id": doc.id})
        except UserError as error:
            return {"success": False, "message": error.args[0]}
        return {"success": True, "data": {"id": doc.id, "name": doc.name}}

    @http.route(
        "/document-management/document/version/<int:version_id>/preview",
        type="http",
        auth="user",
        methods=["GET"],
    )
    def preview_document_version(self, version_id, **kwargs):
        version = request.env["doc.document.version"].browse(version_id).exists()
        if not version or not version.file_attachment:
            return request.not_found()
        version.document_id.check_access_rule("read")
        attachment = version.file_attachment
        return request.make_response(
            _attachment_bytes(attachment),
            headers=[
                ("Content-Type", attachment.mimetype or "application/octet-stream"),
                ("Content-Disposition", f'inline; filename="{attachment.name}"'),
            ],
        )

    @http.route(
        "/document-management/document/<int:doc_id>/download",
        type="http",
        auth="user",
        methods=["GET"],
    )
    def download_document(self, doc_id, **kw):
        doc = request.env["doc.document"].browse(doc_id).exists()
        if not doc or not doc.attachment_id:
            return request.not_found()
        try:
            doc.assert_organizational_user_can_access(request.env.user)
        except AccessError:
            return request.not_found()
        attachment = doc.attachment_id
        return request.make_response(
            _attachment_bytes(attachment),
            headers=[
                ("Content-Type", attachment.mimetype or "application/octet-stream"),
                ("Content-Disposition", f'attachment; filename="{attachment.name}"'),
            ],
        )
