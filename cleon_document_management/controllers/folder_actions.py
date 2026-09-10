import uuid
from markupsafe import escape

from odoo import fields, http
from odoo.exceptions import AccessError, ValidationError
from odoo.http import request


class DocumentFolderActions(http.Controller):
    @staticmethod
    def _folder(folder):
        return {
            "id": folder.id,
            "folder_name": folder.folder_name,
            "description": folder.description or "",
            "favorite": request.env.user in folder.favorite_user_ids,
            "pinned": request.env.user in folder.pinned_user_ids,
            "locked": folder.is_locked,
            "active": folder.active,
            "distribution_status": folder.distribution_status,
            "deleted_at": folder.deleted_at,
            "recycle_bin_until": folder.recycle_bin_until,
        }

    @http.route("/api/folder-action", type="json", auth="user", methods=["POST"], csrf=False)
    def folder_action(self, id=None, action=None, **kwargs):
        folder = request.env["doc.folder"].browse(int(id or 0)).exists()
        if not folder:
            return {"success": False, "message": "Folder not found."}
        folder.check_access_rule("read")

        if action == "favorite":
            folder.action_toggle_favorite()
        elif action == "pin":
            folder.action_toggle_pin()
        elif action == "lock":
            folder.action_lock()
        elif action == "unlock":
            folder.action_unlock()
        elif action == "archive":
            folder.action_archive()
        elif action == "delete":
            folder.action_move_to_recycle_bin()
        elif action == "restore":
            folder.action_restore()
        elif action == "permanent_delete":
            try:
                folder.action_permanent_delete()
            except ValidationError as error:
                return {"success": False, "message": error.args[0]}
            return {"success": True, "message": "Folder permanently deleted."}
        elif action == "force_permanent_delete":
            if not request.env.user.has_group(
                "cleon_document_management.group_document_manager"
            ):
                return {
                    "success": False,
                    "message": "Document manager access is required.",
                }
            try:
                folder.action_force_permanent_delete()
            except (ValidationError, AccessError) as error:
                return {"success": False, "message": error.args[0]}
            return {
                "success": True,
                "message": "Folder and all linked documents were permanently deleted.",
            }
        elif action == "duplicate":
            folder = folder.action_duplicate()
        elif action == "share":
            if not request.env.user.has_group(
                "cleon_document_management.group_document_manager"
            ):
                return {
                    "success": False,
                    "message": "Document manager access is required to share folders.",
                }
            permission = kwargs.get("permission", "viewer")
            expiry_option = kwargs.get("expiry_option", "7_days")
            share = request.env["doc.folder.share.link"].create({
                "folder_id": folder.id,
                "token": str(uuid.uuid4()),
                "permission": permission if permission in ("viewer", "editor") else "viewer",
                "expiry_option": expiry_option,
                "allow_download": bool(kwargs.get("allow_download", False)),
                "allow_printing": bool(kwargs.get("allow_printing", False)),
            })
            return {"success": True, "data": {"token": share.token, "url": f"/document-management/shared/folder/{share.token}"}}
        else:
            return {"success": False, "message": "Unsupported folder action."}

        return {"success": True, "data": self._folder(folder)}

    @http.route(
        "/api/folder/move-recycle-documents",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def move_recycle_documents(
        self, folder_id=None, destination_folder_id=None, release_only=False, **kwargs
    ):
        if not request.env.user.has_group(
            "cleon_document_management.group_document_manager"
        ):
            return {"success": False, "message": "Document manager access is required."}
        folder = request.env["doc.folder"].with_context(active_test=False).browse(
            int(folder_id or 0)
        ).exists()
        if not folder or not folder.deleted_at:
            return {"success": False, "message": "Recycled folder not found."}
        try:
            if release_only:
                moved_count = folder.action_release_recycle_linked_documents()
                message = (
                    f"Kept {moved_count} document(s) in pending uploads."
                    if moved_count
                    else "No linked documents to release."
                )
            else:
                moved_count = folder.action_move_recycle_linked_documents(
                    destination_folder_id
                )
                if not moved_count:
                    return {
                        "success": False,
                        "message": "This folder has no linked documents to move.",
                    }
                message = f"Moved {moved_count} document(s) to the selected folder."
        except ValidationError as error:
            return {"success": False, "message": error.args[0]}
        except AccessError as error:
            return {"success": False, "message": error.args[0]}
        return {
            "success": True,
            "message": message,
            "data": {
                "moved_count": moved_count,
                "linked_document_count": len(folder._get_recycle_linked_documents()),
            },
        }

    @http.route(
        "/api/folder/check-employee-conflicts",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def check_employee_conflicts(self, folder_id=None, employee_ids=None, **kwargs):
        folder = request.env["doc.folder"].browse(int(folder_id or 0)).exists()
        if not folder or folder.folder_type != "employee":
            return {"success": False, "message": "Employee folder not found."}
        ids = [int(value) for value in (employee_ids or []) if str(value).isdigit()]
        if not ids:
            return {"success": False, "message": "Select at least one employee."}

        employees = request.env["hr.employee"].browse(ids).exists()
        already_in_folder = []
        conflicts = []
        for employee in employees:
            if employee in folder.employee_ids:
                already_in_folder.append(
                    {
                        "employee_id": employee.id,
                        "employee_name": employee.name,
                    }
                )
                continue
            other_folder = request.env["doc.folder"].search(
                [
                    ("folder_type", "=", "employee"),
                    ("employee_ids", "in", employee.id),
                    ("id", "!=", folder.id),
                    ("active", "=", True),
                    ("deleted_at", "=", False),
                ],
                limit=1,
            )
            if other_folder:
                conflicts.append(
                    {
                        "employee_id": employee.id,
                        "employee_name": employee.name,
                        "folder_id": other_folder.id,
                        "folder_name": other_folder.folder_name,
                    }
                )

        return {
            "success": True,
            "already_in_folder": already_in_folder,
            "conflicts": conflicts,
        }

    @http.route(
        "/api/folder/check-department-folder-conflicts",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def check_department_folder_conflicts(self, department_ids=None, **kwargs):
        ids = [
            int(value)
            for value in (department_ids or kwargs.get("department_ids") or [])
            if str(value).isdigit()
        ]
        if not ids:
            return {"success": False, "message": "Select at least one department."}

        departments = request.env["hr.department"].browse(ids).exists()
        conflicts = []
        for department in departments:
            folder = request.env["doc.folder"].search(
                [
                    ("folder_type", "=", "employee"),
                    ("active", "=", True),
                    ("deleted_at", "=", False),
                    ("department_ids", "in", [department.id]),
                ],
                limit=1,
            )
            if folder:
                conflicts.append(
                    {
                        "department_id": department.id,
                        "department_name": department.name,
                        "folder_id": folder.id,
                        "folder_name": folder.folder_name,
                    }
                )

        return {"success": True, "conflicts": conflicts}

    @http.route("/api/folder/remove-employees", type="json", auth="user", methods=["POST"], csrf=False)
    def remove_employees_from_folder(self, id=None, employee_ids=None, **kwargs):
        if not request.env.user.has_group("cleon_document_management.group_document_manager"):
            return {"success": False, "message": "Document manager access is required."}
        folder = request.env["doc.folder"].browse(int(id or 0)).exists()
        if not folder or folder.folder_type != "employee":
            return {"success": False, "message": "Employee folder not found."}
        ids = [int(value) for value in (employee_ids or [])]
        if not ids:
            return {"success": False, "message": "Select at least one employee."}
        removed = folder.employee_ids.filtered(lambda employee: employee.id in ids)
        if removed:
            # Employee folders are the employee's personal document space;
            # removing the employee also removes all of their personal files.
            request.env["doc.document"].sudo().search([
                ("folder_id.folder_type", "=", "employee"),
                ("employee_id", "in", removed.ids),
            ]).unlink()
            folder.write({"employee_ids": [fields.Command.unlink(employee.id) for employee in removed]})
        return {"success": True, "employee_ids": folder.employee_ids.ids}

    @http.route("/api/folder/move-employees", type="json", auth="user", methods=["POST"], csrf=False)
    def move_employees_between_folders(self, id=None, employee_ids=None, destination_folder_id=None, **kwargs):
        if not request.env.user.has_group("cleon_document_management.group_document_manager"):
            return {"success": False, "message": "Document manager access is required."}
        source = request.env["doc.folder"].browse(int(id or 0)).exists()
        destination = request.env["doc.folder"].browse(int(destination_folder_id or 0)).exists()
        if not source or source.folder_type != "employee":
            return {"success": False, "message": "Employee source folder not found."}
        if not destination or destination.folder_type != "employee" or not destination.active or destination.deleted_at:
            return {"success": False, "message": "Choose an active employee destination folder."}
        if source == destination:
            return {"success": False, "message": "Choose a different destination folder."}
        ids = [int(value) for value in (employee_ids or []) if str(value).isdigit()]
        employees = source.employee_ids.filtered(lambda employee: employee.id in ids)
        if not employees or len(employees) != len(set(ids)):
            return {"success": False, "message": "Select valid employees from this folder."}
        documents = request.env["doc.document"].search([
            ("folder_id", "=", source.id),
            ("employee_id", "in", employees.ids),
        ])
        try:
            destination.write({"employee_ids": [fields.Command.link(employee.id) for employee in employees]})
            if documents:
                documents.write({"folder_id": destination.id})
            source.write({"employee_ids": [fields.Command.unlink(employee.id) for employee in employees]})
        except Exception as error:
            return {"success": False, "message": str(error)}
        return {
            "success": True,
            "message": f"Moved {len(employees)} employee(s) to {destination.folder_name}.",
            "employee_ids": employees.ids,
        }

    @http.route("/api/folder-lifecycle", type="json", auth="user", methods=["POST"], csrf=False)
    def folder_lifecycle(self, lifecycle="archived", **kwargs):
        if not request.env.user.has_group(
            "cleon_document_management.group_document_manager"
        ):
            return {"success": True, "data": []}
        request.env["doc.folder"].backfill_recycle_origin_links()
        domain = (
            [("deleted_at", "!=", False)]
            if lifecycle == "recycle_bin"
            else [("distribution_status", "=", "archived"), ("deleted_at", "=", False)]
        )
        folders = request.env["doc.folder"].with_context(active_test=False).search(
            domain, order="write_date desc"
        )
        return {"success": True, "data": [{
            "id": folder.id,
            "record_type": "folder",
            "name": folder.folder_name,
            "folder_name": folder.folder_name,
            "description": folder.description or "",
            "folder_type": folder.folder_type,
            "document_count": folder.document_count,
            "linked_document_count": len(folder._get_recycle_linked_documents()),
            "active": folder.active,
            "distribution_status": folder.distribution_status,
            "deleted_at": folder.deleted_at,
            "recycle_bin_until": folder.recycle_bin_until,
            "write_date": folder.write_date,
        } for folder in folders]}

    @http.route(
        "/document-management/shared/folder/<string:token>",
        type="http",
        auth="public",
        methods=["GET"],
        csrf=False,
    )
    def shared_folder(self, token):
        share = request.env["doc.folder.share.link"].sudo().search(
            [("token", "=", token), ("active", "=", True)], limit=1
        )
        if not share or share.get_expiry_date() < fields.Datetime.now():
            return request.not_found()
        folder = share.folder_id.sudo()
        documents = request.env["doc.document"].sudo().search(
            [("folder_id", "=", folder.id), ("active", "=", True)], order="name"
        )
        items = "".join(
            f"<li><strong>{escape(document.name)}</strong>"
            f"<span>{escape(document.document_type_id.name)}</span></li>"
            for document in documents
        )
        html = f"""<!doctype html><html><head><meta charset='utf-8'>
        <meta name='viewport' content='width=device-width,initial-scale=1'>
        <title>{escape(folder.folder_name)} | CleonHR</title>
        <style>body{{font-family:Arial,sans-serif;background:#f8fafc;color:#1e293b;padding:40px}}main{{max-width:720px;margin:auto;background:white;border:1px solid #e2e8f0;border-radius:20px;padding:28px;box-shadow:0 16px 40px #e2e8f044}}h1{{margin:0 0 8px}}p{{color:#64748b}}ul{{list-style:none;padding:0;border-top:1px solid #e2e8f0}}li{{display:flex;justify-content:space-between;gap:20px;padding:16px 0;border-bottom:1px solid #e2e8f0}}li span{{color:#be1463;font-size:13px}}</style>
        </head><body><main><p>Shared CleonHR folder</p><h1>{escape(folder.folder_name)}</h1>
        <p>{escape(folder.description or '')}</p><ul>{items or '<li>No documents available.</li>'}</ul></main></body></html>"""
        share.sudo().write({"access_count": share.access_count + 1})
        return request.make_response(html, headers=[("Content-Type", "text/html; charset=utf-8")])
