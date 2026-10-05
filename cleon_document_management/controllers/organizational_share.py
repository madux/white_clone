# -*- coding: utf-8 -*-
import uuid

from odoo import http
from odoo.http import request


class OrganizationalShareController(http.Controller):
    @http.route(
        "/api/organizational/documents/share-links",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def list_document_shares(self, document_id=None, **kwargs):
        perm = request.env["doc.organizational.files.permission"]
        if not perm.user_can_external_share(request.env.user):
            return {"success": False, "message": "External share is not permitted."}
        doc_id = int(document_id or kwargs.get("document_id") or 0)
        document = request.env["doc.document"].browse(doc_id).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        document.check_access_rule("read")
        links = request.env["doc.share.link"].search(
            [
                "|",
                ("document_id", "=", document.id),
                ("attachment_id", "=", document.id),
                ("is_external", "=", True),
            ]
        )
        return {
            "success": True,
            "data": [link.serialize_for_api() for link in links],
        }

    @http.route(
        "/api/organizational/documents/share-links/create",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def create_document_share(self, **kwargs):
        perm = request.env["doc.organizational.files.permission"]
        if not perm.user_can_external_share(request.env.user):
            return {"success": False, "message": "External share is not permitted."}
        doc_id = int(kwargs.get("document_id") or 0)
        document = request.env["doc.document"].browse(doc_id).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        document.check_access_rule("read")
        link = request.env["doc.share.link"].create(
            {
                "attachment_id": document.id,
                "document_id": document.id,
                "is_external": True,
                "access_type": kwargs.get("access_type") or "view_only",
                "password_protected": bool(kwargs.get("password_protected")),
                "password": kwargs.get("password") or False,
                "watermark_enabled": bool(kwargs.get("watermark_enabled")),
                "expiry_date": kwargs.get("expiry_date") or False,
                "token": str(uuid.uuid4()),
            }
        )
        return {"success": True, "data": link.serialize_for_api()}

    @http.route(
        "/api/organizational/documents/share-links/revoke",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def revoke_share(self, share_id=None, **kwargs):
        perm = request.env["doc.organizational.files.permission"]
        if not perm.user_can_external_share(request.env.user):
            return {"success": False, "message": "External share is not permitted."}
        sid = int(share_id or kwargs.get("share_id") or 0)
        link = request.env["doc.share.link"].browse(sid).exists()
        if not link:
            return {"success": False, "message": "Share link not found."}
        link.write({"active": False, "is_revoked": True})
        return {"success": True}

    @http.route(
        "/public/org-share/<string:token>",
        type="http",
        auth="public",
        methods=["GET"],
        csrf=False,
    )
    def public_share_view(self, token, **kwargs):
        link = (
            request.env["doc.share.link"]
            .sudo()
            .search([("token", "=", token), ("is_external", "=", True)], limit=1)
        )
        if not link or not link.is_valid():
            return request.make_response("Link expired or revoked.", status=404)
        link.log_access(
            action="view",
            ip_address=request.httprequest.remote_addr or "",
            user_agent=request.httprequest.user_agent.string or "",
        )
        document = link.document_id or link.attachment_id
        if not document:
            return request.make_response("Document unavailable.", status=404)
        attachment = document.attachment_id.sudo()
        if not attachment:
            return request.make_response("File unavailable.", status=404)
        content = attachment.datas
        headers = [
            ("Content-Type", attachment.mimetype or "application/octet-stream"),
            ("Content-Disposition", f'inline; filename="{attachment.name}"'),
        ]
        import base64

        return request.make_response(base64.b64decode(content or b""), headers=headers)
