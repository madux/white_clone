import json
from datetime import date, datetime, timedelta
from odoo import fields, http
from odoo.http import request, Response
from odoo.modules.module import get_resource_path
import base64
import logging

_logger = logging.getLogger(__name__)


class DocumentUICreation(http.Controller):

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
                            "description": folder.description,
                            "folder_count": folder.description,
                            "last_modified": folder.write_date,
                            "owner_id": folder.owner_id.name or "N/A",
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
        domain = [("active", "=", True)]
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
                    }
                    for d in documents
                ],
                "total_count": len(documents.ids),
            },
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
        attachment = doc.attachment_id
        data = attachment.datas or b""
        return request.make_response(
            base64.b64decode(data) if isinstance(data, str) else data,
            headers=[
                ("Content-Type", attachment.mimetype or "application/octet-stream"),
                ("Content-Disposition", f'attachment; filename="{attachment.name}"'),
            ],
        )
