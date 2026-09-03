import json
from datetime import date, datetime, timedelta
from odoo import http
from odoo.http import request
from odoo.modules.module import get_resource_path

import logging

_logger = logging.getLogger(__name__)


class DocumentUICreation(http.Controller):

    @http.route("/document-management", type="http", auth="user")
    def dashboard_index(self, **kw):
        # Get actual file path inside the module
        file_path = get_resource_path(
            "cleon_document_management",  # your module name
            "static/src/html",  # folder path inside module
            "index.html",  # file name
        )
        if not file_path:
            return "HTML file not found."

        # Read HTML file content
        with open(file_path, "r", encoding="utf-8") as f:
            html = f.read()
        user = request.env.user
        data = {
            "user_id": user.id,
            "user_name": user.name,
            "user_email": user.email or "",
        }
        # Return raw HTML content
        return request.make_response(
            html,
            headers=[("Content-Type", "text/html"), ("defaultData", json.dumps(data))],
        )

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

            folder = request.env["doc.folder"].create(
                {
                    "folder_name": name,
                    "description": description or "",
                }
            )
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
                        }
                    },
                }

            # Get all folders
            folders = Folder.search([])

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
