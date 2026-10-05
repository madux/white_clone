from odoo import _, fields, http
from odoo.exceptions import AccessError, UserError
from odoo.http import request


def _coerce_int_ids(values):
    return sorted({int(value) for value in (values or []) if str(value).isdigit()})


def _draft_policy_guard(document, action):
    try:
        document._check_draft_policy_allows_action(action)
    except UserError as error:
        return {"success": False, "message": error.args[0]}
    return None


def _user_can_ef_approve(document):
    perm = request.env["doc.employee.files.permission"]
    user = request.env.user
    if document.employee_id and document.folder_id.folder_type == "employee":
        return perm.user_can_on_document(user, document, "action_approve")
    return perm.user_is_platform_admin(user) or perm.user_has_legacy_manager(user)


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
        if action not in ("approve", "reject"):
            return {"success": False, "message": "Unsupported review action."}
        document = request.env["doc.document"].browse(int(id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        if not _user_can_ef_approve(document):
            return {"success": False, "message": "You do not have permission to review this document."}
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
        if not approval and flow != "sequential" and _user_can_ef_approve(document):
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
        if action == "reject" and not (reason or "").strip():
            return {
                "success": False,
                "message": "A rejection reason is required.",
            }
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
                "rejection_reason": document.rejection_reason or "",
                "review_decision_unread": bool(document.review_decision_unread),
                "last_review_decision": document.last_review_decision or None,
            },
        }

    def _user_owns_document_upload(self, document, user):
        if document.uploaded_by.id == user.id or document.owner_id.id == user.id:
            return True
        employee = user.employee_id
        return bool(employee and document.employee_id.id == employee.id)

    @http.route(
        "/api/my-review-alerts",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def my_review_alerts(self, **kwargs):
        user = request.env.user
        Document = request.env["doc.document"]
        documents = Document.search(
            [
                ("review_decision_unread", "=", True),
                ("active", "=", True),
                ("deleted_at", "=", False),
                "|",
                ("uploaded_by", "=", user.id),
                ("owner_id", "=", user.id),
            ],
            order="write_date desc",
            limit=30,
        )
        if user.employee_id:
            documents |= Document.search(
                [
                    ("review_decision_unread", "=", True),
                    ("active", "=", True),
                    ("deleted_at", "=", False),
                    ("employee_id", "=", user.employee_id.id),
                ],
                order="write_date desc",
                limit=30,
            )
        items = []
        seen = set()
        for document in documents:
            if document.id in seen:
                continue
            seen.add(document.id)
            if not self._user_owns_document_upload(document, user):
                continue
            if document.last_review_decision == "rejected":
                message = (
                    f'"{document.name}" was rejected.'
                    + (
                        f" {document.rejection_reason}"
                        if document.rejection_reason
                        else ""
                    )
                )
            else:
                message = f'"{document.name}" was approved.'
            items.append(
                {
                    "id": document.id,
                    "document_id": document.id,
                    "document": document.name,
                    "employee_id": document.employee_id.id or 0,
                    "message": message,
                    "rejection_reason": document.rejection_reason or "",
                    "last_review_decision": document.last_review_decision,
                    "created_at": document.write_date,
                }
            )
        return {"success": True, "data": {"count": len(items), "items": items}}

    @http.route(
        "/api/document/acknowledge-review-decision",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def acknowledge_review_decision(self, id=None, **kwargs):
        document = request.env["doc.document"].browse(int(id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        document.check_access_rule("read")
        if not self._user_owns_document_upload(document, request.env.user):
            return {
                "success": False,
                "message": "You can only dismiss alerts for your own documents.",
            }
        document.sudo().write({"review_decision_unread": False})
        return {
            "success": True,
            "data": {"id": document.id, "review_decision_unread": False},
        }

    @http.route(
        "/api/update-document", type="json", auth="user", methods=["POST"], csrf=False
    )
    def update_document(self, id=None, **kwargs):
        """Update document metadata through the same manager boundary as the model."""
        document = request.env["doc.document"].browse(int(id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        blocked = _draft_policy_guard(document, "update")
        if blocked:
            return blocked
        is_manager = request.env.user.has_group(
            "cleon_document_management.group_document_manager"
        )
        org_ok = (
            document.folder_id.folder_type == "organizational"
            and request.env["doc.organizational.files.permission"].user_can_manage_org_document(
                request.env.user
            )
        )
        if not is_manager and not org_ok:
            return {"success": False, "message": "Document manager access is required."}
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

        approval = request.env["doc.organizational.approval.service"]
        gate = approval.submit_or_block(
            request.env.user,
            "move",
            {
                "document_ids": documents.ids,
                "destination_folder_id": destination.id,
                "folder_id": documents[:1].folder_id.id if documents else False,
            },
            name=_("Move %s document(s)") % len(documents),
        )
        if not gate.get("execute"):
            return approval.pending_api_response(gate.get("request"))

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
        "/api/delete-document-version",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def delete_document_version(self, id=None, version_id=None, **kwargs):
        version = request.env["doc.document.version"].browse(
            int(version_id or id or 0)
        ).exists()
        if not version:
            return {"success": False, "message": "Version not found."}
        document = version.document_id
        document.check_access_rule("read")
        blocked = _draft_policy_guard(document, "delete")
        if blocked:
            return blocked
        document_id = document.id
        if not version._user_can_manage():
            return {
                "success": False,
                "message": "You do not have permission to delete this version.",
            }
        try:
            version.sudo().unlink()
        except AccessError as error:
            return {"success": False, "message": str(error)}
        return {
            "success": True,
            "message": "Version deleted.",
            "data": {"document_id": document_id},
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
        blocked = _draft_policy_guard(document, "delete")
        if blocked:
            return blocked
        document.action_move_to_recycle_bin()
        return {"success": True, "message": "Document moved to the recycle bin."}

    @http.route(
        "/api/documents-action", type="json", auth="user", methods=["POST"], csrf=False
    )
    def documents_action(self, document_ids=None, action=None, **kwargs):
        """Apply the same document action to many documents in one request."""
        ids = _coerce_int_ids(document_ids)
        if not ids:
            return {"success": False, "message": "Select at least one document."}
        if not action:
            return {"success": False, "message": "Action is required."}

        documents = request.env["doc.document"].browse(ids).exists()
        if len(documents) != len(set(ids)):
            return {"success": False, "message": "One or more documents were not found."}

        user = request.env.user
        org_perm = request.env["doc.organizational.files.permission"]
        org_documents = documents.filtered(
            lambda doc: doc.folder_id.folder_type == "organizational"
        )

        for document in documents:
            document.check_access_rule("read")

        if action not in ("favorite", "pin"):
            for document in documents:
                blocked = _draft_policy_guard(document, action)
                if blocked:
                    return blocked

        if action == "delete":
            if org_documents and not org_perm.user_can_delete_org_document(user):
                return {
                    "success": False,
                    "message": "You do not have permission to delete one or more documents.",
                }
            if org_documents:
                approval = request.env["doc.organizational.approval.service"]
                gate = approval.submit_or_block(
                    user,
                    "delete",
                    {
                        "document_ids": org_documents.ids,
                        "folder_id": org_documents[:1].folder_id.id,
                    },
                    name=_("Delete %s document(s)") % len(org_documents),
                )
                if not gate.get("execute"):
                    return approval.pending_api_response(gate.get("request"))
            documents.action_move_to_recycle_bin()
            return {
                "success": True,
                "message": _("Moved %s document(s) to the recycle bin.") % len(documents),
                "data": {"document_ids": documents.ids, "action": action},
            }

        if action == "archive":
            if org_documents and not org_perm.user_can_manage_org_document(user):
                return {
                    "success": False,
                    "message": "You do not have permission to archive one or more documents.",
                }
            documents.action_archive()
        elif action == "favorite":
            for document in documents:
                document.action_toggle_favorite()
        elif action == "pin":
            for document in documents:
                document.action_toggle_pin()
        elif action == "deactivate":
            if org_documents and not (
                org_perm.user_can_manage_org_document(user)
                or org_perm.user_can_delete_org_document(user)
                or org_perm.user_is_platform_admin(user)
                or org_perm.user_has_legacy_manager(user)
            ):
                return {
                    "success": False,
                    "message": "You do not have permission to deactivate one or more documents.",
                }
            documents.action_deactivate()
        elif action in ("restore", "activate"):
            if not user.has_group(
                "cleon_document_management.group_document_manager"
            ) and any(not document._user_owns_document() for document in documents):
                return {
                    "success": False,
                    "message": "You can only restore your own documents.",
                }
            documents.action_restore()
        elif action == "permanent_delete":
            if not user.has_group(
                "cleon_document_management.group_document_manager"
            ):
                return {
                    "success": False,
                    "message": "Document manager access is required.",
                }
            documents.unlink()
        else:
            return {"success": False, "message": "Unsupported bulk document action."}

        return {
            "success": True,
            "message": _("Updated %s document(s).") % len(documents),
            "data": {"document_ids": documents.ids, "action": action},
        }

    @http.route(
        "/api/document-action", type="json", auth="user", methods=["POST"], csrf=False
    )
    def document_action(self, id=None, action=None, **kwargs):
        document = request.env["doc.document"].browse(int(id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        document.check_access_rule("read")
        if action not in ("favorite", "pin"):
            blocked = _draft_policy_guard(document, action or "")
            if blocked:
                return blocked
        org_perm = request.env["doc.organizational.files.permission"]
        is_org = document.folder_id.folder_type == "organizational"
        if action == "favorite":
            document.action_toggle_favorite()
        elif action == "pin":
            document.action_toggle_pin()
        elif action == "delete":
            if is_org and not org_perm.user_can_delete_org_document(request.env.user):
                return {
                    "success": False,
                    "message": "You do not have permission to delete this document.",
                }
            if is_org:
                approval = request.env["doc.organizational.approval.service"]
                gate = approval.submit_or_block(
                    request.env.user,
                    "delete",
                    {
                        "document_id": document.id,
                        "folder_id": document.folder_id.id,
                    },
                    name=_("Delete document: %s") % document.name,
                )
                if not gate.get("execute"):
                    return approval.pending_api_response(gate.get("request"))
            document.action_move_to_recycle_bin()
            return {"success": True, "data": {"deleted": True}}
        elif action == "archive":
            if is_org and not org_perm.user_can_manage_org_document(request.env.user):
                return {
                    "success": False,
                    "message": "You do not have permission to archive this document.",
                }
            document.action_archive()
        elif action == "copy" and is_org:
            if not org_perm.user_can_manage_org_document(request.env.user):
                return {
                    "success": False,
                    "message": "You do not have permission to copy this document.",
                }
            destination_id = kwargs.get("folder_id") or document.folder_id.id
            destination = request.env["doc.folder"].browse(int(destination_id)).exists()
            if not destination or destination.folder_type != "organizational":
                return {"success": False, "message": "Destination folder not found."}
            try:
                destination.assert_unlocked(for_upload=True)
                copy = document.with_context(org_document_copy=True).copy(
                    default={
                        "folder_id": destination.id,
                        "name": f"{document.name} (Copy)",
                    }
                )
            except UserError as error:
                return {"success": False, "message": error.args[0]}
            return {
                "success": True,
                "data": copy.serialize_for_api(request.env.user),
            }
        elif action == "print":
            return {
                "success": True,
                "data": {
                    "document_id": document.id,
                    "print": True,
                },
            }
        elif action == "deactivate":
            if is_org and not (
                org_perm.user_can_manage_org_document(request.env.user)
                or org_perm.user_can_delete_org_document(request.env.user)
                or org_perm.user_is_platform_admin(request.env.user)
                or org_perm.user_has_legacy_manager(request.env.user)
            ):
                return {
                    "success": False,
                    "message": "You do not have permission to deactivate this document.",
                }
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
        data = []
        user = request.env.user
        for document in documents:
            payload = document.serialize_for_api(user)
            payload["location_label"] = document._lifecycle_location_label()
            data.append(payload)
        return {"success": True, "data": data}
