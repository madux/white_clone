# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request


class CompanyDocumentaryRolesController(http.Controller):
    @http.route(
        "/api/company-documentary/roles/definitions",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def definitions(self, **kwargs):
        service = request.env["documentary.role.service"].sudo()
        return {"success": True, "data": service._definitions()}

    @http.route(
        "/api/company-documentary/roles/members",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def members(self, search="", limit=50, **kwargs):
        service = request.env["documentary.role.service"].sudo()
        return {
            "success": True,
            "data": service.list_members(search=search or "", limit=limit),
        }

    @http.route(
        "/api/company-documentary/roles/assign",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def assign(self, employee_id=None, assignments=None, **kwargs):
        service = request.env["documentary.role.service"].sudo()
        data = service.assign_roles(employee_id, assignments or [])
        return {"success": True, "data": data}
