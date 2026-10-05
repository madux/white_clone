# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request


class OrganizationalApprovalController(http.Controller):
    @http.route(
        "/api/organizational/approvals",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def list_approvals(self, state=None, **kwargs):
        service = request.env["doc.organizational.approval.service"]
        return {
            "success": True,
            "data": service.list_requests(
                state=state or kwargs.get("state"),
                action_key=kwargs.get("action_key"),
                requested_by_id=kwargs.get("requested_by_id"),
                overdue_only=bool(kwargs.get("overdue_only")),
                limit=int(kwargs.get("limit") or 200),
            ),
        }

    @http.route(
        "/api/organizational/approvals/approve",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def approve(self, request_id=None, note="", **kwargs):
        service = request.env["doc.organizational.approval.service"]
        rid = request_id or kwargs.get("id")
        return {
            "success": True,
            "data": service.approve_request(rid, note=note or kwargs.get("note") or ""),
        }

    @http.route(
        "/api/organizational/approvals/reject",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def reject(self, request_id=None, note="", **kwargs):
        service = request.env["doc.organizational.approval.service"]
        rid = request_id or kwargs.get("id")
        return {
            "success": True,
            "data": service.reject_request(rid, note=note or kwargs.get("note") or ""),
        }

    @http.route(
        "/api/organizational/approvals/withdraw",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def withdraw(self, request_id=None, **kwargs):
        service = request.env["doc.organizational.approval.service"]
        rid = request_id or kwargs.get("id")
        return {
            "success": True,
            "data": service.withdraw_request(rid),
        }

    @http.route(
        "/api/organizational/approvals/bulk-approve",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def bulk_approve(self, request_ids=None, note="", **kwargs):
        service = request.env["doc.organizational.approval.service"]
        ids = request_ids or kwargs.get("request_ids") or []
        return {
            "success": True,
            "data": service.bulk_approve(ids, note=note or kwargs.get("note") or ""),
        }

    @http.route(
        "/api/organizational/approvals/bulk-reject",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def bulk_reject(self, request_ids=None, note="", **kwargs):
        service = request.env["doc.organizational.approval.service"]
        ids = request_ids or kwargs.get("request_ids") or []
        return {
            "success": True,
            "data": service.bulk_reject(ids, note=note or kwargs.get("note") or ""),
        }
