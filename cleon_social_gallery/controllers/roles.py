# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request


class SocialGalleryRolesController(http.Controller):
    @http.route(
        "/api/social-gallery/roles/definitions",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def definitions(self, **kwargs):
        service = request.env["gallery.role.service"].sudo()
        return {"success": True, "data": service._definitions()}

    @http.route(
        "/api/social-gallery/roles/members",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def members(self, search="", limit=50, **kwargs):
        service = request.env["gallery.role.service"].sudo()
        return {
            "success": True,
            "data": service.list_members(search=search or "", limit=limit),
        }

    @http.route(
        "/api/social-gallery/roles/assign",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def assign(self, employee_id=None, assignments=None, **kwargs):
        service = request.env["gallery.role.service"].sudo()
        data = service.assign_roles(employee_id, assignments or [])
        return {"success": True, "data": data}
