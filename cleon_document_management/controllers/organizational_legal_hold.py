# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request


class OrganizationalLegalHoldController(http.Controller):
    @http.route(
        "/api/organizational/legal-holds",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def list_holds(self, document_id=None, folder_id=None, **kwargs):
        perm = request.env["doc.organizational.files.permission"]
        perm.require_org_library(request.env.user)
        domain = [("company_id", "=", request.env.company.id)]
        if document_id:
            domain.append(("document_id", "=", int(document_id)))
        if folder_id:
            domain.append(("folder_id", "=", int(folder_id)))
        holds = request.env["doc.legal.hold"].search(domain, order="create_date desc")
        return {"success": True, "data": [hold.serialize_for_api() for hold in holds]}

    @http.route(
        "/api/organizational/legal-holds/place",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def place_hold(self, **kwargs):
        perm = request.env["doc.organizational.files.permission"]
        if not perm.user_can_legal_hold(request.env.user):
            return {"success": False, "message": "Legal hold permission required."}
        hold = request.env["doc.legal.hold"].create(
            {
                "name": kwargs.get("name") or "Legal hold",
                "reason": kwargs.get("reason") or "",
                "document_id": kwargs.get("document_id") or False,
                "folder_id": kwargs.get("folder_id") or False,
                "company_id": request.env.company.id,
            }
        )
        return {"success": True, "data": hold.serialize_for_api()}

    @http.route(
        "/api/organizational/legal-holds/release",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def release_hold(self, hold_id=None, **kwargs):
        perm = request.env["doc.organizational.files.permission"]
        if not perm.user_can_legal_hold(request.env.user):
            return {"success": False, "message": "Legal hold permission required."}
        from odoo import fields

        hold = request.env["doc.legal.hold"].browse(int(hold_id or kwargs.get("hold_id") or 0))
        if not hold:
            return {"success": False, "message": "Hold not found."}
        hold.write(
            {
                "active": False,
                "released_by_id": request.env.user.id,
                "released_at": fields.Datetime.now(),
            }
        )
        return {"success": True, "data": hold.serialize_for_api()}
