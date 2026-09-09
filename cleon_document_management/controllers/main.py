import json
from datetime import date, datetime, timedelta
from odoo import _, fields, http
from odoo.exceptions import AccessError, ValidationError
from odoo.http import request
from odoo.modules.module import get_resource_path
from odoo.osv import expression
import base64
import logging

_logger = logging.getLogger(__name__)


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


def _expiry_values_for_upload(document_type, expiry_date):
    if not document_type.expiry_applicable:
        return {}
    if not expiry_date:
        return None
    return {"has_expiry": True, "expiry_date": expiry_date}


class DocumentUICreation(http.Controller):

    @staticmethod
    def _settings_values():
        params = request.env["ir.config_parameter"].sudo()
        raw_approvers = params.get_param(
            "cleon_document_management.default_approver_ids", ""
        )
        return {
            "default_require_upload_approval": params.get_param(
                "cleon_document_management.default_require_upload_approval", "0"
            ) == "1",
            "default_approval_flow": params.get_param(
                "cleon_document_management.default_approval_flow", "any"
            ),
            "default_access_scope": params.get_param(
                "cleon_document_management.default_access_scope", "all_staff"
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
        }

    @staticmethod
    def _require_settings_manager():
        return request.env.user.has_group(
            "cleon_document_management.group_document_manager"
        )

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
            "data": [
                {
                    "id": item.id,
                    "name": item.name,
                    "category": item.category,
                    "description": item.description or "",
                    "is_mandatory_default": item.is_mandatory_default,
                    "default_retention_years": item.default_retention_years,
                    "expiry_applicable": item.expiry_applicable,
                    "active": item.active,
                }
                for item in types
            ],
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
        if not request.env.user.has_group(
            "cleon_document_management.group_document_manager"
        ):
            return {
                "success": False,
                "message": "Only document managers can create document types.",
            }

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

        item = model.create(
            {
                "name": name,
                "category": category,
                "description": (kwargs.get("description") or "").strip(),
                "is_mandatory_default": bool(kwargs.get("is_mandatory_default", False)),
                "expiry_applicable": bool(kwargs.get("expiry_applicable", False)),
                "default_retention_years": max(
                    int(kwargs.get("default_retention_years") or 7), 0
                ),
            }
        )
        return {
            "success": True,
            "message": "Document type created successfully.",
            "data": {
                "id": item.id,
                "name": item.name,
                "category": item.category,
                "description": item.description or "",
                "is_mandatory_default": item.is_mandatory_default,
                "default_retention_years": item.default_retention_years,
                "expiry_applicable": item.expiry_applicable,
                "active": item.active,
            },
        }

    @http.route(
        "/api/settings", type="json", auth="user", methods=["POST"], csrf=False
    )
    def get_settings(self, **kwargs):
        if not self._require_settings_manager():
            return {"success": False, "message": "Document manager access is required."}
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
                "document_types": [
                    {
                        "id": item.id,
                        "name": item.name,
                        "category": item.category,
                        "description": item.description or "",
                        "is_mandatory_default": item.is_mandatory_default,
                        "default_retention_years": item.default_retention_years,
                        "expiry_applicable": item.expiry_applicable,
                        "active": item.active,
                    }
                    for item in types
                ],
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
        if not self._require_settings_manager():
            return {"success": False, "message": "Document manager access is required."}
        name = (kwargs.get("name") or "").strip()
        category = kwargs.get("category") or "other"
        valid_categories = {"hr", "finance", "legal", "identity", "employment", "medical", "training", "other"}
        if not name or category not in valid_categories:
            return {"success": False, "message": "A valid name and category are required."}
        values = {
            "name": name,
            "category": category,
            "description": (kwargs.get("description") or "").strip(),
            "is_mandatory_default": bool(kwargs.get("is_mandatory_default", False)),
            "expiry_applicable": bool(kwargs.get("expiry_applicable", False)),
            "default_retention_years": max(int(kwargs.get("default_retention_years") or 7), 0),
            "sequence": int(kwargs.get("sequence") or 10),
        }
        model = request.env["doc.document.type"].with_context(active_test=False)
        item = model.browse(int(kwargs["id"])).exists() if kwargs.get("id") else model.browse()
        duplicate = model.search([("name", "ilike", name), ("id", "!=", item.id)], limit=1)
        if duplicate:
            return {"success": False, "message": "A document type with this name already exists."}
        if item:
            item.write(values)
        else:
            item = model.create(values)
        return {"success": True, "data": {"id": item.id}}

    @http.route(
        "/api/settings/document-type/toggle",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def toggle_settings_document_type(self, id=None, **kwargs):
        if not self._require_settings_manager():
            return {"success": False, "message": "Document manager access is required."}
        item = request.env["doc.document.type"].with_context(active_test=False).browse(int(id or 0)).exists()
        if not item:
            return {"success": False, "message": "Document type not found."}
        item.write({"active": not item.active})
        return {"success": True, "active": item.active}

    @http.route(
        "/api/settings/save",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def save_settings(self, **kwargs):
        if not self._require_settings_manager():
            return {"success": False, "message": "Document manager access is required."}
        flow = kwargs.get("default_approval_flow") or "any"
        scope = kwargs.get("default_access_scope") or "all_staff"
        retention = kwargs.get("default_retention_period") or "7"
        try:
            recycle_days = max(int(kwargs.get("recycle_bin_retention_days") or 30), 1)
        except (TypeError, ValueError):
            return {"success": False, "message": "Recycle-bin retention must be a valid number."}
        if flow not in {"sequential", "random", "any"}:
            return {"success": False, "message": "Select a valid approval flow."}
        if scope not in {"all_staff", "department", "grade", "individual", "admin_only"}:
            return {"success": False, "message": "Select a valid default access scope."}
        if retention not in {"1", "3", "5", "7", "10", "permanent"}:
            return {"success": False, "message": "Select a valid default retention period."}
        approver_ids = [int(value) for value in (kwargs.get("default_approver_ids") or [])]
        approver_ids = request.env["res.users"].browse(approver_ids).exists().ids
        if flow == "sequential" and not kwargs.get("default_require_upload_approval"):
            return {"success": False, "message": "Sequential workflows require approval to be enabled."}
        if flow == "sequential" and not approver_ids:
            return {"success": False, "message": "Select at least one approver for sequential approval."}
        params = request.env["ir.config_parameter"].sudo()
        params.set_param("cleon_document_management.default_require_upload_approval", "1" if kwargs.get("default_require_upload_approval") else "0")
        params.set_param("cleon_document_management.default_approval_flow", flow)
        params.set_param("cleon_document_management.default_access_scope", scope)
        params.set_param("cleon_document_management.default_retention_period", retention)
        params.set_param("cleon_document_management.recycle_bin_retention_days", str(recycle_days))
        params.set_param(
            "cleon_document_management.default_approver_ids",
            ",".join(str(value) for value in approver_ids),
        )
        return {"success": True, "data": self._settings_values()}

    @http.route(
        "/api/create-folder", type="json", auth="user", methods=["POST"], csrf=False
    )
    def create_folder(self, **kwargs):
        """Create a document folder"""
        try:
            name = kwargs.get("nameElm")
            description = kwargs.get("descriptionElm")
            if not name:
                return {"success": False, "message": "Folder name is required."}

            folder_type = kwargs.get("folder_type") or "organizational"
            if folder_type not in ("employee", "organizational"):
                return {"success": False, "message": "Invalid folder type."}
            settings = self._settings_values()
            access_scope = kwargs.get("access_scope") or (
                "individual" if folder_type == "employee" else settings["default_access_scope"]
            )
            if folder_type == "organizational" and access_scope == "department" and not kwargs.get("department_ids"):
                return {"success": False, "message": "Select at least one department."}
            if folder_type == "organizational" and access_scope == "grade" and not kwargs.get("grade_ids"):
                return {"success": False, "message": "Select at least one grade."}
            if folder_type == "organizational" and access_scope == "individual" and not kwargs.get("employee_ids"):
                return {"success": False, "message": "Select at least one employee."}
            values = {
                "folder_name": name,
                "description": description or "",
                "folder_type": folder_type,
                "access_scope": access_scope,
                "retention_period": kwargs.get("retention_period") or settings["default_retention_period"],
            }
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
                        .browse(kwargs.get("department_ids", []))
                        .exists()
                        .ids
                    )
                ]
                values["grade_ids"] = [
                    fields.Command.set(
                        request.env["hr.grade"]
                        .browse(kwargs.get("grade_ids", []))
                        .exists()
                        .ids
                    )
                ]
                values["employee_ids"] = [
                    fields.Command.set(
                        request.env["hr.employee"]
                        .browse(kwargs.get("employee_ids", []))
                        .exists()
                        .ids
                    )
                ]
            folder = request.env["doc.folder"].create(values)
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
                            "description": folder.description,
                            "folder_count": folder.document_count,
                            "last_modified": folder.write_date,
                            "owner_id": folder.owner_id.name or "N/A",
                            "owner_name": folder.owner_id.name or "N/A",
                            "access_scope": folder.access_scope,
                            "color": folder.color,
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

            write_values = {
                "folder_name": folder_name,
                "description": description,
            }
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

            folder.write(write_values)

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
        "/api/check-upload-duplicates",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def check_upload_duplicates(self, employee_id=None, items=None, **kwargs):
        employee = request.env["hr.employee"].browse(int(employee_id or 0)).exists()
        if not employee:
            return {"success": False, "message": "Employee not found."}
        matches = []
        for item in items or []:
            filename = (item.get("filename") or "").strip()
            try:
                document_type_id = int(item.get("document_type_id") or 0)
            except (TypeError, ValueError):
                continue
            if not filename or not document_type_id:
                continue
            documents = request.env["doc.document"].search(
                [
                    ("active", "=", True),
                    ("deleted_at", "=", False),
                    ("employee_id", "=", employee.id),
                    ("document_type_id", "=", document_type_id),
                    ("name", "=ilike", filename),
                ]
            )
            for document in documents:
                doc_versions = document.version_ids.mapped("version_number")
                matches.append(
                    {
                        "filename": filename,
                        "document_type_id": document_type_id,
                        "id": document.id,
                        "name": document.name,
                        "version_count": len(document.version_ids),
                        "latest_version_number": max(doc_versions or [0]),
                    }
                )
        return {"success": True, "matches": matches}

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
            domain = (
                []
                if kwargs.get("include_inactive")
                and request.env.user.has_group(
                    "cleon_document_management.group_document_manager"
                )
                else [
                    ("active", "=", True),
                    ("deleted_at", "=", False),
                    ("folder_id.active", "=", True),
                    ("folder_id.deleted_at", "=", False),
                    ("folder_id.distribution_status", "=", "active"),
                ]
            )
            if folder_id:
                domain.append(("folder_id", "=", int(folder_id)))

            documents = request.env["doc.document"].search(domain, order="create_date desc")
            user = request.env.user
            return {
                "success": True,
                "count": len(documents),
                "data": {
                    "data": [
                        document.serialize_for_api(
                            user,
                            favorite=user in document.favorite_user_ids,
                            pinned=user in document.pinned_user_ids,
                        )
                        for document in documents
                    ],
                    "total_count": len(documents.ids),
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
        for index, upload in enumerate(uploads):
            type_id = document_type_ids[0] if len(document_type_ids) == 1 else document_type_ids[index]
            document_type = document_types.filtered(lambda item: item.id == type_id)[:1]
            expiry_date = expiry_dates[index] if index < len(expiry_dates) else (expiry_dates[0] if len(expiry_dates) == 1 else False)
            expiry_values = _expiry_values_for_upload(document_type, expiry_date)
            if expiry_values is None:
                return request.make_json_response(
                    {
                        "success": False,
                        "message": f"An expiry date is required for {document_type.name}.",
                    },
                    status=400,
                )
            attachment = request.env["ir.attachment"].sudo().create({
                "name": upload.filename or "employee-document",
                "datas": base64.b64encode(upload.read()),
                "mimetype": upload.mimetype or "application/octet-stream",
            })
            documents |= request.env["doc.document"].create({
                "name": upload.filename or "Employee document",
                "folder_id": folder.id,
                "employee_id": employee.id,
                "document_type_id": type_id,
                "attachment_id": attachment.id,
                **expiry_values,
            })
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
        folder = request.env["doc.folder"].resolve_manager_employee_upload_folder(
            employee
        )
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
        for index, upload in enumerate(uploads):
            type_id = document_type_ids[0] if len(document_type_ids) == 1 else document_type_ids[index]
            document_type = document_types.filtered(lambda item: item.id == type_id)[:1]
            expiry_date = expiry_dates[index] if index < len(expiry_dates) else (expiry_dates[0] if len(expiry_dates) == 1 else False)
            expiry_values = _expiry_values_for_upload(document_type, expiry_date)
            if expiry_values is None:
                return request.make_json_response(
                    {
                        "success": False,
                        "message": f"An expiry date is required for {document_type.name}.",
                    },
                    status=400,
                )
            attachment = request.env["ir.attachment"].sudo().create({
                "name": upload.filename or "employee-document",
                "datas": base64.b64encode(upload.read()),
                "mimetype": upload.mimetype or "application/octet-stream",
            })
            documents |= request.env["doc.document"].create({
                "name": upload.filename or "Employee document", "folder_id": folder.id,
                "employee_id": employee.id, "document_type_id": type_id,
                "attachment_id": attachment.id,
                **expiry_values,
            })
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
        shared = request.env["doc.document"].search(
            shared_domain, order="write_date desc"
        )
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
                                "created_at": False,
                                "write_date": False,
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
                "occurred_at": document.write_date or document.create_date,
            }
            for document in combined[:20]
        ]
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
            "awaiting_folder": "Awaiting folder assignment",
            "awaiting_folder_restore": "Awaiting folder restore",
        }
        items = []
        seen = set()
        for document in documents:
            if document.id in seen:
                continue
            seen.add(document.id)
            if document.approval_state == "pending" or document.state in (
                "draft",
                "processing",
            ):
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
                    "policy": evaluation.policy_id.name,
                    "policy_active": evaluation.policy_id.active,
                    "score": evaluation.score,
                    "status": evaluation.status,
                    "complete_count": evaluation.complete_count,
                    "missing_count": evaluation.missing_count,
                    "grace_count": evaluation.grace_count,
                    "evaluated_at": str(evaluation.evaluated_at or ""),
                    "lines": lines,
                }
            )
        summary = {
            "compliant": len(
                evaluations.filtered(lambda item: item.status == "compliant")
            ),
            "partial": len(
                evaluations.filtered(lambda item: item.status == "partial")
            ),
            "non_compliant": len(
                evaluations.filtered(lambda item: item.status == "non_compliant")
            ),
            "outstanding_count": len(outstanding),
        }
        return {
            "success": True,
            "data": {
                "evaluations": evaluation_data,
                "outstanding": outstanding,
                "summary": summary,
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
        doc.check_access_rule("read")
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
            doc.check_access_rule("read")
        except AccessError:
            return {"success": False, "message": "You do not have access to this document."}
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
        doc.check_access_rule("read")
        attachment = doc.attachment_id
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
        documents = request.env["doc.document"]
        expiry_dates = _upload_expiry_dates()
        for index, upload in enumerate(uploads):
            type_id = document_type_ids[0] if len(document_type_ids) == 1 else document_type_ids[index]
            document_type = document_types.filtered(lambda item: item.id == type_id)[:1]
            expiry_date = expiry_dates[index] if index < len(expiry_dates) else (expiry_dates[0] if len(expiry_dates) == 1 else False)
            expiry_values = _expiry_values_for_upload(document_type, expiry_date)
            if expiry_values is None:
                return request.make_json_response(
                    {
                        "success": False,
                        "message": f"An expiry date is required for {document_type.name}.",
                    },
                    status=400,
                )
            attachment = request.env["ir.attachment"].create({
                "name": upload.filename or "document",
                "datas": base64.b64encode(upload.read()),
                "mimetype": upload.mimetype or "application/octet-stream",
            })
            documents |= request.env["doc.document"].create({
                "name": upload.filename or "Document", "folder_id": folder.id,
                "document_type_id": type_id, "attachment_id": attachment.id,
                **expiry_values,
            })
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
        doc = request.env["doc.document"].create(
            {
                "name": name,
                "folder_id": folder_id,
                "document_type_id": document_type_id,
            }
        )
        return {"success": True, "data": {"id": doc.id, "name": doc.name}}

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
        doc.check_access_rule("read")
        attachment = doc.attachment_id
        return request.make_response(
            _attachment_bytes(attachment),
            headers=[
                ("Content-Type", attachment.mimetype or "application/octet-stream"),
                ("Content-Disposition", f'attachment; filename="{attachment.name}"'),
            ],
        )
