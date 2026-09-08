from odoo import fields, http
from odoo.http import request


class DocumentActions(http.Controller):
    @http.route(
        "/api/document/acknowledge",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def acknowledge_document(self, id=None, **kwargs):
        document = request.env["doc.document"].browse(int(id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        document.check_access_rule("read")
        if (
            document.folder_id.folder_type != "organizational"
            or document.state == "draft"
        ):
            return {
                "success": False,
                "message": "This document cannot be acknowledged.",
            }
        acknowledgement = request.env["doc.document.acknowledgement"].search(
            [("document_id", "=", document.id), ("user_id", "=", request.env.user.id)],
            limit=1,
        )
        if not acknowledgement:
            acknowledgement = request.env["doc.document.acknowledgement"].create(
                {"document_id": document.id}
            )
        return {
            "success": True,
            "data": {
                "acknowledged": True,
                "acknowledged_at": acknowledgement.acknowledged_at,
            },
        }

    @http.route(
        "/api/document-review", type="json", auth="user", methods=["POST"], csrf=False
    )
    def review_document(self, id=None, action=None, reason=None, **kwargs):
        if not request.env.user.has_group(
            "cleon_document_management.group_document_manager"
        ):
            return {"success": False, "message": "Document manager access is required."}
        if action not in ("approve", "reject"):
            return {"success": False, "message": "Unsupported review action."}
        document = request.env["doc.document"].browse(int(id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        approval_model = request.env["doc.document.approval"]
        flow = document._get_effective_approval_flow()
        approval = approval_model.search(
            [
                ("document_id", "=", document.id),
                ("approver_id", "=", request.env.user.id),
                ("state", "=", "pending"),
            ],
            limit=1,
        )
        manager_override = False
        if (
            not approval
            and flow != "sequential"
            and request.env.user.has_group(
                "cleon_document_management.group_document_manager"
            )
        ):
            approval = approval_model.search(
                [
                    ("document_id", "=", document.id),
                    ("state", "=", "pending"),
                ],
                order="sequence, id",
                limit=1,
            )
            manager_override = bool(
                approval and approval.approver_id != request.env.user
            )
        if not approval:
            waiting = approval_model.search(
                [
                    ("document_id", "=", document.id),
                    ("approver_id", "=", request.env.user.id),
                    ("state", "=", "waiting"),
                ],
                limit=1,
            )
            if waiting:
                return {
                    "success": False,
                    "message": "Previous approval steps must be completed before you can review this document.",
                }
            return {
                "success": False,
                "message": "No review task is assigned to this user.",
            }
        if manager_override:
            approval.write(
                {
                    "state": "approved" if action == "approve" else "rejected",
                    "decision_date": fields.Datetime.now(),
                    "comment": reason or False,
                }
            )
            document.write({"state": "approved" if action == "approve" else "rejected"})
            document._update_approval_state()
        elif action == "approve":
            approval.action_approve()
        elif action == "reject":
            approval.comment = reason or False
            approval.action_reject()
        if action == "approve":
            request.env["doc.folder"].sync_pending_upload_assignments()
        return {
            "success": True,
            "data": {
                "id": document.id,
                "state": document.state,
                "approval_state": document.approval_state,
            },
        }

    @http.route(
        "/api/update-document", type="json", auth="user", methods=["POST"], csrf=False
    )
    def update_document(self, id=None, **kwargs):
        """Update document metadata through the same manager boundary as the model."""
        if not request.env.user.has_group(
            "cleon_document_management.group_document_manager"
        ):
            return {"success": False, "message": "Document manager access is required."}
        document = request.env["doc.document"].browse(int(id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        allowed = {
            key: kwargs[key]
            for key in (
                "name",
                "description",
                "document_type_id",
                "folder_id",
                "employee_id",
                "has_expiry",
                "expiry_date",
            )
            if key in kwargs
        }
        if not allowed:
            return {"success": False, "message": "No document fields were provided."}
        document.write(allowed)
        return {"success": True, "message": "Document updated successfully."}

    @http.route(
        "/api/move-documents", type="json", auth="user", methods=["POST"], csrf=False
    )
    def move_documents(self, document_ids=None, destination_folder_id=None, **kwargs):
        """Move one or more documents to another folder of the same kind."""
        if not request.env.user.has_group(
            "cleon_document_management.group_document_manager"
        ):
            return {"success": False, "message": "Document manager access is required."}

        ids = [int(value) for value in (document_ids or []) if str(value).isdigit()]
        destination = request.env["doc.folder"].browse(
            int(destination_folder_id or 0)
        ).exists()
        documents = request.env["doc.document"].browse(ids).exists()
        if not ids or len(documents) != len(set(ids)):
            return {"success": False, "message": "Select at least one valid document."}
        if not destination:
            return {"success": False, "message": "Destination folder not found."}
        if not destination.active or destination.deleted_at:
            return {"success": False, "message": "The destination folder is not active."}

        source_types = set(documents.mapped("folder_id.folder_type"))
        if len(source_types) != 1 or destination.folder_type not in source_types:
            return {
                "success": False,
                "message": "Documents can only be moved between folders of the same type.",
            }
        if destination.folder_type != "organizational":
            return {
                "success": False,
                "message": "Move employees from the employee folder view so their files move with them.",
            }

        try:
            documents.write({"folder_id": destination.id})
        except Exception as error:
            return {"success": False, "message": str(error)}
        return {
            "success": True,
            "message": f"Moved {len(documents)} document(s) to {destination.folder_name}.",
            "data": {"document_ids": documents.ids, "folder_id": destination.id},
        }

    @http.route(
        "/api/delete-document", type="json", auth="user", methods=["POST"], csrf=False
    )
    def delete_document(self, id=None, **kwargs):
        """Move a document to the recycle bin instead of deleting it immediately."""
        if not request.env.user.has_group(
            "cleon_document_management.group_document_manager"
        ):
            return {"success": False, "message": "Document manager access is required."}
        document = request.env["doc.document"].browse(int(id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        document.action_move_to_recycle_bin()
        return {"success": True, "message": "Document moved to the recycle bin."}

    @http.route(
        "/api/document-action", type="json", auth="user", methods=["POST"], csrf=False
    )
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
            if not request.env.user.has_group(
                "cleon_document_management.group_document_manager"
            ) and not document._user_owns_document():
                return {
                    "success": False,
                    "message": "You can only restore your own documents.",
                }
            document.action_restore()
        elif action == "activate":
            if not request.env.user.has_group(
                "cleon_document_management.group_document_manager"
            ) and not document._user_owns_document():
                return {
                    "success": False,
                    "message": "You can only restore your own documents.",
                }
            document.action_restore()
        elif action == "permanent_delete":
            if not request.env.user.has_group(
                "cleon_document_management.group_document_manager"
            ):
                return {
                    "success": False,
                    "message": "Document manager access is required.",
                }
            document.unlink()
        else:
            return {"success": False, "message": "Unsupported document action."}
        return {"success": True, "data": {"id": document.id, "action": action}}

    @http.route(
        "/api/document-lifecycle",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def document_lifecycle(self, lifecycle="archived", **kwargs):
        user = request.env.user
        is_manager = user.has_group(
            "cleon_document_management.group_document_manager"
        )
        domain = (
            [("deleted_at", "!=", False)]
            if lifecycle == "recycle_bin"
            else [("distribution_status", "=", "archived"), ("deleted_at", "=", False)]
        )
        if not is_manager:
            employee = user.employee_id
            domain = domain + [
                "|",
                ("owner_id", "=", user.id),
                ("employee_id", "=", employee.id if employee else 0),
            ]
        documents = request.env["doc.document"].with_context(active_test=False).search(
            domain, order="write_date desc"
        )
        return {
            "success": True,
            "data": [
                document.serialize_for_api(request.env.user)
                for document in documents
            ],
        }
