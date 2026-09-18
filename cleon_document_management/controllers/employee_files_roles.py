# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request


class EmployeeFilesRolesController(http.Controller):
    @http.route(
        "/api/employee-files/roles",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def list_roles(self, **kwargs):
        service = request.env["doc.employee.files.role.service"]
        return {"success": True, "data": service.list_roles()}

    @http.route(
        "/api/employee-files/roles/save",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def save_role(self, **kwargs):
        service = request.env["doc.employee.files.role.service"]
        payload = kwargs.get("role") or kwargs
        return {"success": True, "data": service.save_role(payload)}

    @http.route(
        "/api/employee-files/roles/delete",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def delete_role(self, role_id=None, **kwargs):
        service = request.env["doc.employee.files.role.service"]
        rid = role_id or kwargs.get("id")
        service.delete_role(rid)
        return {"success": True}

    @http.route(
        "/api/employee-files/roles/members",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def list_members(self, search="", limit=50, **kwargs):
        service = request.env["doc.employee.files.role.service"]
        return {
            "success": True,
            "data": service.list_members(search=search or "", limit=limit),
        }

    @http.route(
        "/api/employee-files/roles/assign",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def assign_roles(self, user_id=None, role_ids=None, **kwargs):
        service = request.env["doc.employee.files.role.service"]
        uid = user_id or kwargs.get("user_id")
        ids = role_ids if role_ids is not None else kwargs.get("role_ids") or []
        data = service.assign_user_roles(uid, ids)
        return {"success": True, "data": data}

    @http.route(
        "/api/employee-files/roles/document-types",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def document_types(self, **kwargs):
        request.env["doc.employee.files.permission"].require_role_authoring(
            request.env.user
        )
        types = request.env["doc.document.type"].search([], order="sequence, name")
        return {
            "success": True,
            "data": [
                {
                    "id": doc_type.id,
                    "name": doc_type.name,
                    "category_group": doc_type.category or "",
                }
                for doc_type in types
            ],
        }
