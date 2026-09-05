from odoo import fields, http
from odoo.http import request


class DocumentActions(http.Controller):
    @http.route("/api/document/acknowledge", type="json", auth="user", methods=["POST"], csrf=False)
    def acknowledge_document(self, id=None, **kwargs):
        document = request.env["doc.document"].browse(int(id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        document.check_access_rule("read")
        if document.folder_id.folder_type != "organizational" or document.state == "draft":
            return {"success": False, "message": "This document cannot be acknowledged."}
        acknowledgement = request.env["doc.document.acknowledgement"].search([
            ("document_id", "=", document.id), ("user_id", "=", request.env.user.id)
        ], limit=1)
        if not acknowledgement:
            acknowledgement = request.env["doc.document.acknowledgement"].create({"document_id": document.id})
        return {"success": True, "data": {"acknowledged": True, "acknowledged_at": acknowledgement.acknowledged_at}}

    @http.route("/api/document-review", type="json", auth="user", methods=["POST"], csrf=False)
    def review_document(self, id=None, action=None, reason=None, **kwargs):
        if not request.env.user.has_group("cleon_document_management.group_document_manager"):
            return {"success": False, "message": "Document manager access is required."}
        document = request.env["doc.document"].browse(int(id or 0)).exists()
        approval_model = request.env["doc.document.approval"]
        approval = approval_model.search([
            ("document_id", "=", document.id), ("approver_id", "=", request.env.user.id),
            ("state", "in", ["pending", "waiting"]),
        ], limit=1)
        if not document:
            return {"success": False, "message": "Document not found."}
        # A document manager may review a pending upload even when the folder
        # was configured without explicitly naming that manager as an approver.
        manager_override = False
        if not approval and request.env.user.has_group("cleon_document_management.group_document_manager"):
            approval = approval_model.search([
                ("document_id", "=", document.id),
                ("state", "in", ["pending", "waiting"]),
            ], order="sequence, id", limit=1)
            manager_override = bool(approval and approval.approver_id != request.env.user)
        if not approval:
            return {"success": False, "message": "No review task is assigned to this user."}
        if manager_override:
            approval.write({"state": "approved" if action == "approve" else "rejected", "decision_date": fields.Datetime.now(), "comment": reason or False})
            document.write({"state": "approved" if action == "approve" else "rejected"})
            document._update_approval_state()
        elif action == "approve":
            approval.action_approve()
        elif action == "reject":
            approval.comment = reason or False
            approval.action_reject()
        else:
            return {"success": False, "message": "Unsupported review action."}
        return {"success": True, "data": {"id": document.id, "state": document.state, "approval_state": document.approval_state}}
    @http.route("/api/document-action", type="json", auth="user", methods=["POST"], csrf=False)
    def document_action(self, id=None, action=None, **kwargs):
        document = request.env["doc.document"].browse(int(id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        document.check_access_rule("read")
        if action == "favorite":
            document.action_toggle_favorite()
        elif action == "pin":
            document.action_toggle_pin()
        elif action == "delete":
            document.action_move_to_recycle_bin()
            return {"success": True, "data": {"deleted": True}}
        elif action == "archive":
            document.action_archive()
        elif action == "deactivate":
            document.action_deactivate()
        elif action == "restore":
            document.action_restore()
        elif action == "activate":
            document.action_restore()
        elif action == "permanent_delete":
            document.unlink()
        else:
            return {"success": False, "message": "Unsupported document action."}
        return {"success": True, "data": {"id": document.id, "action": action}}

    @http.route("/api/document-lifecycle", type="json", auth="user", methods=["POST"], csrf=False)
    def document_lifecycle(self, lifecycle="archived", **kwargs):
        if not request.env.user.has_group("cleon_document_management.group_document_manager"):
            return {"success": False, "message": "Document manager access is required."}
        domain = [("deleted_at", "!=", False)] if lifecycle == "recycle_bin" else [("distribution_status", "=", "archived"), ("deleted_at", "=", False)]
        documents = request.env["doc.document"].search(domain, order="write_date desc")
        return {"success": True, "data": [{
            "id": doc.id,
            "name": doc.name,
            "description": doc.description or "",
            "folder_id": doc.folder_id.id,
            "folder_name": doc.folder_id.folder_name,
            "employee_id": doc.employee_id.id or False,
            "employee_name": doc.employee_id.name or "N/A",
            "document_type_id": doc.document_type_id.id,
            "document_type": doc.document_type_id.name,
            "state": doc.state,
            "approval_state": doc.approval_state,
            "ocr_state": doc.ocr_state,
            "has_expiry": doc.has_expiry,
            "expiry_date": doc.expiry_date,
            "mime_type": doc.mime_type,
            "file_size": doc.file_size,
            "attachment_id": doc.attachment_id.id,
            "created_at": doc.create_date,
            "write_date": doc.write_date,
            "deleted_at": doc.deleted_at,
            "recycle_bin_until": doc.recycle_bin_until,
            "distribution_status": doc.distribution_status,
        } for doc in documents]}
