import json
from datetime import date, datetime, timedelta
from odoo import _, fields, http
from odoo.http import request, Response
from odoo.modules.module import get_resource_path
import base64
import logging

_logger = logging.getLogger(__name__)


class DocumentUICreation(http.Controller):

    @http.route(
        "/api/get-document-type", type="json", auth="user", methods=["GET", "POST"], csrf=False
    )
    def get_document_types(self, **kwargs):
        """Return active document types available to document-management forms."""
        types = request.env["doc.document.type"].search([("active", "=", True)])
        return {
            "success": True,
            "data": [{
                "id": item.id,
                "name": item.name,
                "category": item.category,
                "description": item.description or "",
                "is_mandatory_default": item.is_mandatory_default,
                "default_retention_years": item.default_retention_years,
                "active": item.active,
            } for item in types],
        }

    @http.route(
        "/api/create-document-type", type="json", auth="user", methods=["POST"], csrf=False
    )
    def create_document_type(self, **kwargs):
        """Create a document type without leaving the current document form."""
        if not request.env.user.has_group("cleon_document_management.group_document_manager"):
            return {"success": False, "message": "Only document managers can create document types."}

        name = (kwargs.get("name") or "").strip()
        if not name:
            return {"success": False, "message": "Document type name is required."}

        category = kwargs.get("category") or "other"
        valid_categories = {"hr", "finance", "legal", "identity", "employment", "medical", "training", "other"}
        if category not in valid_categories:
            return {"success": False, "message": "Select a valid document type category."}

        model = request.env["doc.document.type"]
        if model.search([("name", "ilike", name)], limit=1):
            return {"success": False, "message": "A document type with this name already exists."}

        item = model.create({
            "name": name,
            "category": category,
            "description": (kwargs.get("description") or "").strip(),
            "is_mandatory_default": bool(kwargs.get("is_mandatory_default", False)),
            "default_retention_years": max(int(kwargs.get("default_retention_years") or 7), 0),
        })
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
                "active": item.active,
            },
        }

    @http.route(
        [
            "/document-management/_next/hmr",
            "/_next/hmr",
            "/<path:path>/_next/hmr",
        ],
        type="http",
        auth="public",
        csrf=False,
        cors="*",
        save_session=False,
    )
    def hmr_noop(self, **kwargs):
        """Intercept Next.js WebSocket/EventSource HMR pings to keep Werkzeug logs clean."""
        return Response(status=204)

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
            values = {
                "folder_name": name,
                "description": description or "",
                "folder_type": folder_type,
                "access_scope": kwargs.get("access_scope") or ("individual" if folder_type == "employee" else "all_staff"),
                "retention_period": kwargs.get("retention_period") or "7",
                "require_upload_approval": bool(kwargs.get("require_upload_approval", False)),
            }
            if folder_type == "employee":
                basis = kwargs.get("folder_basis") or "individual"
                employee_model = request.env["hr.employee"]
                employees = employee_model.browse(kwargs.get("employee_ids", [])).exists()
                if basis == "department":
                    departments = request.env["hr.department"].browse(kwargs.get("department_ids", [])).exists()
                    employees = employee_model.search([("active", "=", True), ("department_id", "in", departments.ids)])
                    values["access_scope"] = "department"
                elif basis == "grade":
                    grades = request.env["hr.grade"].browse(kwargs.get("grade_ids", [])).exists()
                    employees = employee_model.search([("active", "=", True), ("grade_id", "in", grades.ids)])
                    values["access_scope"] = "grade"
                values["employee_ids"] = [fields.Command.set(employees.ids)]
            if folder_type == "organizational":
                values["allowed_document_type_ids"] = [fields.Command.set(
                    request.env["doc.document.type"].browse(kwargs.get("allowed_document_type_ids", [])).exists().ids
                )]
            folder = request.env["doc.folder"].create(values)
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
                        }
                    },
                }

            # Get all folders
            folders = Folder.search([("active", "=", True)])

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
                            "folder_count": folder.description,
                            "last_modified": folder.write_date,
                            "owner_id": folder.owner_id.name or "N/A",
                            "owner_name": folder.owner_id.name or "N/A",
                            "access_scope": folder.access_scope,
                            "color": folder.color,
                            "document_count": len(folder.document_ids.ids),
                            "favorite": request.env.user in folder.favorite_user_ids,
                            "pinned": request.env.user in folder.pinned_user_ids,
                            "locked": folder.is_locked,
                            "active": folder.active,
                            "employee_ids": folder.employee_ids.ids,
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
                "document_count": len(folder.document_ids),
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

            folder.write(
                {
                    "folder_name": folder_name,
                    "description": description,
                }
            )

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

            folder.unlink()

            return {"success": True, "message": "Folder deleted successfully."}

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

            # Requires active field on the model
            folder.write({"active": False})

            return {"success": True, "message": "Folder archived successfully."}

        except Exception as e:
            return {"success": False, "message": str(e)}

    @http.route("/api/folder/add-employees", type="json", auth="user", methods=["POST"], csrf=False)
    def add_employees_to_folder(self, id=None, employee_ids=None, **kwargs):
        folder = request.env["doc.folder"].browse(int(id or 0)).exists()
        if not folder:
            return {"success": False, "message": "Folder not found."}
        if folder.folder_type != "employee":
            return {"success": False, "message": "Only employee folders can contain employees."}
        employees = request.env["hr.employee"].browse(employee_ids or []).exists()
        if not employees:
            return {"success": False, "message": "Select at least one employee."}
        folder.write({"employee_ids": [fields.Command.link(employee.id) for employee in employees]})
        return {"success": True, "employee_ids": folder.employee_ids.ids}

    @http.route(
        "/api/get-document",
        type="json",
        auth="user",
        methods=["GET", "POST"],
        csrf=False,
    )
    def get_documents(self, folder_id=False, **kwargs):
        """List documents, optionally filtered by folder_id."""
        domain = [] if kwargs.get("include_inactive") and request.env.user.has_group("cleon_document_management.group_document_manager") else [("active", "=", True)]
        if folder_id:
            domain.append(("folder_id", "=", int(folder_id)))

        documents = request.env["doc.document"].search(domain, order="create_date desc")
        return {
            "success": True,
            "count": len(documents),
            "data": {
                "data": [
                    {
                        "id": d.id,
                        "name": d.name,
                        "description": d.description,
                        "folder_id": d.folder_id.id,
                        "folder_name": d.folder_id.folder_name,
                        "employee_id": d.employee_id.id or False,
                        "employee_name": d.employee_id.name or "N/A",
                        "document_type_id": d.document_type_id.id,
                        "document_type": d.document_type_id.name,
                        "state": d.state,
                        "approval_state": d.approval_state,
                        "ocr_state": d.ocr_state,
                        "has_expiry": d.has_expiry,
                        "expiry_date": d.expiry_date,
                        "mime_type": d.mime_type,
                        "file_size": d.file_size,
                        "attachment_id": d.attachment_id.id,
                        "created_at": d.create_date,
                        "write_date": d.write_date,
                        "active": d.active,
                        "favorite": request.env.user in d.favorite_user_ids,
                        "pinned": request.env.user in d.pinned_user_ids,
                        "distribution_status": d.distribution_status,
                    }
                    for d in documents
                ],
                "total_count": len(documents.ids),
            },
        }

    @http.route("/api/quick-access", type="json", auth="user", methods=["POST"], csrf=False)
    def quick_access(self, **kwargs):
        user = request.env.user
        folders = request.env["doc.folder"].search([("active", "=", True), ("pinned_user_ids", "in", user.id)], order="write_date desc")
        documents = request.env["doc.document"].search([("active", "=", True), ("deleted_at", "=", False), ("pinned_user_ids", "in", user.id)], order="write_date desc")
        return {"success": True, "data": {"folders": [{"id": folder.id, "folder_name": folder.folder_name, "description": folder.description or "", "folder_type": folder.folder_type, "pinned": True} for folder in folders], "documents": [{"id": document.id, "name": document.name, "description": document.description or "", "folder_id": document.folder_id.id, "folder_name": document.folder_id.folder_name, "employee_id": document.employee_id.id or False, "employee_name": document.employee_id.name or "N/A", "document_type_id": document.document_type_id.id, "document_type": document.document_type_id.name, "state": document.state, "approval_state": document.approval_state, "ocr_state": document.ocr_state, "has_expiry": document.has_expiry, "expiry_date": document.expiry_date, "mime_type": document.mime_type, "file_size": document.file_size, "attachment_id": document.attachment_id.id, "created_at": document.create_date, "write_date": document.write_date, "pinned": True} for document in documents]}}

    @http.route("/api/my-documents", type="json", auth="user", methods=["POST"], csrf=False)
    def my_documents(self, **kwargs):
        employee = request.env.user.employee_id
        domain = ["|"]
        domain += [("owner_id", "=", request.env.user.id)]
        domain += [("employee_id", "=", employee.id or 0)]
        documents = request.env["doc.document"].search(
            domain + [("active", "=", True), ("deleted_at", "=", False)],
            order="write_date desc",
        )
        return {"success": True, "data": [{
            "id": d.id, "name": d.name, "description": d.description or "",
            "folder_id": d.folder_id.id, "folder_name": d.folder_id.folder_name,
            "employee_id": d.employee_id.id or False, "employee_name": d.employee_id.name or "N/A",
            "document_type_id": d.document_type_id.id, "document_type": d.document_type_id.name,
            "state": d.state, "approval_state": d.approval_state, "ocr_state": d.ocr_state,
            "has_expiry": d.has_expiry, "expiry_date": d.expiry_date, "mime_type": d.mime_type,
            "file_size": d.file_size, "attachment_id": d.attachment_id.id,
            "created_at": d.create_date, "write_date": d.write_date,
        } for d in documents]}

    @http.route("/api/my-documents/upload", type="http", auth="user", methods=["POST"], csrf=False)
    def upload_my_document(self, **kwargs):
        """Upload a personal employee document as a draft."""
        employee = request.env.user.employee_id
        upload = request.httprequest.files.get("file")
        document_type_id = request.httprequest.form.get("document_type_id")
        if not employee:
            return request.make_json_response({"success": False, "message": "Your user account is not linked to an employee record."}, status=400)
        if not upload or not document_type_id:
            return request.make_json_response({"success": False, "message": "File and document type are required."}, status=400)
        document_type = request.env["doc.document.type"].browse(int(document_type_id)).exists()
        if not document_type:
            return request.make_json_response({"success": False, "message": "Select a valid document type."}, status=400)
        folder = request.env["doc.folder"].link_employee_to_department_folder(employee)
        if not folder:
            return request.make_json_response({"success": False, "message": "Your employee record needs a department before uploading a document."}, status=400)
        content = upload.read()
        attachment = request.env["ir.attachment"].sudo().create({
            "name": upload.filename or "employee-document",
            "datas": base64.b64encode(content),
            "mimetype": upload.mimetype or "application/octet-stream",
        })
        document = request.env["doc.document"].create({
            "name": upload.filename or "Employee document",
            "folder_id": folder.id,
            "employee_id": employee.id,
            "document_type_id": document_type.id,
            "attachment_id": attachment.id,
            "state": "draft",
            "approval_state": "not_required",
        })
        return request.make_json_response({"success": True, "data": {"id": document.id, "name": document.name}})

    @http.route("/api/my-documents/request-approval", type="json", auth="user", methods=["POST"], csrf=False)
    def request_my_document_approval(self, id=None, **kwargs):
        """Submit an employee-owned draft to the document administrators."""
        document = request.env["doc.document"].browse(int(id or 0)).exists()
        if not document or document.owner_id != request.env.user or document.employee_id != request.env.user.employee_id:
            return {"success": False, "message": "You can only request approval for your own employee documents."}
        if document.state not in ("draft", "rejected"):
            return {"success": False, "message": "Only draft or rejected documents can be submitted for approval."}
        approval_model = request.env["doc.document.approval"].sudo()
        approval_model.search([("document_id", "=", document.id)]).unlink()
        approvers = request.env.ref("cleon_document_management.group_document_admin").users.filtered(lambda user: user != request.env.user)
        if not approvers:
            approvers = request.env.ref("cleon_document_management.group_document_admin").users
        if not approvers:
            return {"success": False, "message": "No document administrator is available to review this document."}
        document.sudo().write({
            "state": "processing",
            "approval_state": "pending",
            "approval_ids": [fields.Command.create({"approver_id": approver.id, "sequence": sequence, "state": "pending" if sequence == 1 else "waiting"}) for sequence, approver in enumerate(approvers, start=1)],
        })
        document.sudo().message_post(
            body=_("%s submitted %s for review.") % (request.env.user.name, document.name),
            partner_ids=approvers.mapped("partner_id").ids,
            subtype_xmlid="mail.mt_note",
        )
        return {"success": True, "data": {"id": document.id, "state": document.state, "approval_state": document.approval_state}}

    @http.route("/api/my-workspace", type="json", auth="user", methods=["POST"], csrf=False)
    def my_workspace(self, **kwargs):
        user = request.env.user
        employee = user.employee_id
        own_domain = ["|", ("owner_id", "=", user.id), ("employee_id", "=", employee.id or 0)]
        shared_domain = [
            ("folder_id.folder_type", "=", "organizational"),
            ("active", "=", True),
            ("deleted_at", "=", False),
            ("state", "!=", "draft"),
            "|", ("allowed_user_ids", "in", [user.id]),
            "|", ("allowed_group_ids", "in", user.groups_id.ids),
            "|", ("folder_id.allowed_user_ids", "in", [user.id]),
            "&", ("folder_id.access_scope", "=", "role"),
            ("folder_id.role_group_ids", "in", user.groups_id.ids),
        ]
        own = request.env["doc.document"].search(own_domain + [("active", "=", True), ("deleted_at", "=", False)], order="write_date desc")
        shared = request.env["doc.document"].search(shared_domain, order="write_date desc")
        combined = own | shared
        outstanding = []
        if employee:
            policies = request.env["doc.compliance.policy"].search([("active", "=", True)])
            for policy in policies:
                if not policy._applies_to_employee(employee):
                    continue
                for document_type in policy.document_type_ids:
                    matching = combined.filtered(lambda item, type_id=document_type.id: item.employee_id == employee and item.document_type_id.id == type_id and item.state not in ("rejected", "expired"))
                    if not matching:
                        outstanding.append({
                            "id": -(policy.id * 10000 + document_type.id), "name": document_type.name,
                            "description": "Required by %s" % policy.name, "folder_id": False,
                            "folder_name": "Outstanding requirements", "employee_id": employee.id,
                            "employee_name": employee.name, "document_type_id": document_type.id,
                            "document_type": document_type.name, "state": "missing",
                            "approval_state": "pending", "ocr_state": "pending", "has_expiry": False,
                            "expiry_date": False, "mime_type": "", "file_size": 0, "attachment_id": False,
                            "created_at": False, "write_date": False,
                        })

        def serialize(document):
            return {
                "id": document.id, "name": document.name, "description": document.description or "",
                "folder_id": document.folder_id.id, "folder_name": document.folder_id.folder_name,
                "employee_id": document.employee_id.id or False, "employee_name": document.employee_id.name or "N/A",
                "document_type_id": document.document_type_id.id, "document_type": document.document_type_id.name,
                "state": document.state, "approval_state": document.approval_state, "distribution_status": document.distribution_status, "ocr_state": document.ocr_state,
                "has_expiry": document.has_expiry, "expiry_date": document.expiry_date, "mime_type": document.mime_type,
                "file_size": document.file_size, "attachment_id": document.attachment_id.id,
                "created_at": document.create_date, "write_date": document.write_date,
                "favorite": user in document.favorite_user_ids,
                "acknowledged": bool(document.acknowledgement_ids.filtered(lambda item: item.user_id == user)),
            }

        activities = [{
            "id": document.id, "document_id": document.id, "document": document.name,
            "folder": document.folder_id.folder_name, "event": "Updated" if document.write_date != document.create_date else "Added",
            "occurred_at": document.write_date or document.create_date,
        } for document in combined[:20]]
        states = {state: len(combined.filtered(lambda item, value=state: item.state == value)) for state in ("approved", "processing", "draft", "rejected", "expired")}
        return {"success": True, "data": {
            "my_files": [serialize(document) for document in own],
            "shared_documents": [serialize(document) for document in shared if document not in own],
            "outstanding": outstanding,
            "activity": activities,
            "dashboard": {
                "total": len(combined), "expiring": len(combined.filtered(lambda item: item.has_expiry and item.expiry_date)),
                "states": states,
            },
        }}

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
        return {
            "success": True,
            "data": {
                "id": doc.id,
                "name": doc.name,
                "description": doc.description,
                "folder_id": doc.folder_id.id,
                "folder_name": doc.folder_id.folder_name,
                "employee_id": doc.employee_id.id,
                "employee_name": doc.employee_id.name,
                "document_type_id": doc.document_type_id.id,
                "document_type": doc.document_type_id.name,
                "state": doc.state,
                "approval_state": doc.approval_state,
                "has_expiry": doc.has_expiry,
                "expiry_date": doc.expiry_date,
                "mime_type": doc.mime_type,
                "file_size": doc.file_size,
                "attachment_id": doc.attachment_id.id,
                "extracted_text": doc.extracted_text,
            },
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
        data = attachment.datas or b""
        return request.make_response(
            base64.b64decode(data) if isinstance(data, str) else data,
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
        upload = request.httprequest.files.get("file")
        folder_id = request.httprequest.form.get("folder_id")
        document_type_id = request.httprequest.form.get("document_type_id")
        if not upload or not folder_id or not document_type_id:
            return request.make_json_response({"success": False, "message": "File, folder, and document type are required."}, status=400)
        folder = request.env["doc.folder"].browse(int(folder_id)).exists()
        document_type = request.env["doc.document.type"].browse(int(document_type_id)).exists()
        if not folder or folder.folder_type != "organizational" or not document_type:
            return request.make_json_response({"success": False, "message": "A valid organizational folder and document type are required."}, status=400)
        folder.check_access_rule("read")
        content = upload.read()
        attachment = request.env["ir.attachment"].create({
            "name": upload.filename or "document",
            "datas": base64.b64encode(content),
            "mimetype": upload.mimetype or "application/octet-stream",
        })
        document = request.env["doc.document"].create({
            "name": upload.filename or "Document",
            "folder_id": folder.id,
            "document_type_id": document_type.id,
            "attachment_id": attachment.id,
        })
        return request.make_json_response({"success": True, "data": {"id": document.id, "name": document.name}})

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
        data = attachment.datas or b""
        return request.make_response(
            base64.b64decode(data) if isinstance(data, str) else data,
            headers=[
                ("Content-Type", attachment.mimetype or "application/octet-stream"),
                ("Content-Disposition", f'attachment; filename="{attachment.name}"'),
            ],
        )
