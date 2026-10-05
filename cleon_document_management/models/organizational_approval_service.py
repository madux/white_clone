# -*- coding: utf-8 -*-
import base64
import json
from datetime import timedelta

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError

WITHOUT_APPROVAL_SUFFIX = "_without_approval"

ACTION_LABELS = {
    "create_folder": _("Create folder"),
    "upload_link_import_scan": _("Upload file"),
    "edit_rename_description_colour": _("Edit metadata"),
    "replace_version": _("Replace version"),
    "move": _("Move"),
    "delete": _("Delete"),
}


class DocOrganizationalApprovalService(models.AbstractModel):
    _name = "doc.organizational.approval.service"
    _description = "Organizational approval routing and execution"

    @api.model
    def _perm(self):
        return self.env["doc.organizational.files.permission"]

    @api.model
    def _config(self):
        return self.env["doc.employee.files.config"].get_for_company()

    @api.model
    def user_can_execute_without_approval(self, user, action_key):
        without_key = f"{action_key}{WITHOUT_APPROVAL_SUFFIX}"
        perms = self._perm().effective_org_permissions(user)
        if perms.get(without_key):
            return True
        if action_key == "create_folder" and perms.get("create_folder_without_approval"):
            return True
        if action_key == "upload_link_import_scan" and perms.get("upload_without_approval"):
            return True
        if action_key == "edit_rename_description_colour" and perms.get("edit_without_approval"):
            return True
        if action_key == "delete" and perms.get("delete_without_approval"):
            return True
        return False

    @api.model
    def user_may_request_action(self, user, action_key):
        perm = self._perm()
        if action_key == "create_folder":
            return perm.user_can_create_folder(user)
        if action_key == "upload_link_import_scan":
            return perm.user_can_upload_org(user)
        if action_key in ("edit_rename_description_colour", "replace_version"):
            return perm.user_can_manage_org_document(user)
        if action_key == "move":
            return perm.user_can_manage_org_document(user)
        if action_key == "delete":
            return perm.user_can_delete_org_document(user)
        return perm.user_has_org_permission(user, action_key)

    @api.model
    def _active_delegate_for(self, user):
        config = self._config()
        delegate = config.org_approval_delegate_user_id
        until = config.org_approval_delegate_until
        if not delegate or not until:
            return False
        if fields.Datetime.now() > until:
            return False
        return delegate

    @api.model
    def _escalation_approver(self):
        config = self._config()
        return config.org_approval_escalation_user_id or config.error_escalation_user_id

    @api.model
    def submit_or_block(self, user, action_key, payload, name=None):
        if not self.user_may_request_action(user, action_key):
            raise AccessError(_("You do not have permission for this action."))
        if self.user_can_execute_without_approval(user, action_key):
            return {"execute": True, "request": None}
        Request = self.env["doc.organizational.approval.request"]
        config = self._config()
        sla_hours = int(config.org_approval_sla_hours or 48)
        due_at = fields.Datetime.now() + timedelta(hours=sla_hours)
        label = ACTION_LABELS.get(action_key, action_key)
        payload = dict(payload or {})
        document_id = payload.get("document_id")
        folder_id = payload.get("folder_id") or payload.get("parent_id")
        request = Request.create(
            {
                "name": name or _("%s approval") % label,
                "action_key": action_key,
                "requested_by_id": user.id,
                "company_id": user.company_id.id,
                "due_at": due_at,
                "payload_json": json.dumps(payload),
                "folder_id": folder_id or False,
                "document_id": document_id or False,
            }
        )
        return {"execute": False, "request": request}

    @api.model
    def pending_api_response(self, request_rec):
        return {
            "success": True,
            "pending_approval": True,
            "approval_request_id": request_rec.id,
            "message": _(
                "Approval required. This will take effect after an approver signs off."
            ),
        }

    @api.model
    def list_requests(
        self,
        state=None,
        action_key=None,
        requested_by_id=None,
        overdue_only=False,
        limit=200,
    ):
        user = self.env.user
        perm = self._perm()
        is_approver = perm.user_can_approve_org_requests(
            user
        ) or perm.user_is_platform_admin(user)
        if is_approver:
            domain = [("company_id", "=", user.company_id.id)]
        else:
            domain = [("requested_by_id", "=", user.id)]
        if state and state != "all":
            if state == "escalated":
                domain.extend([("state", "=", "pending"), ("escalated_at", "!=", False)])
            else:
                domain.append(("state", "=", state))
        if action_key:
            domain.append(("action_key", "=", action_key))
        if requested_by_id:
            domain.append(("requested_by_id", "=", int(requested_by_id)))
        if overdue_only:
            domain.extend(
                [
                    ("state", "=", "pending"),
                    ("due_at", "!=", False),
                    ("due_at", "<", fields.Datetime.now()),
                ]
            )
        requests = self.env["doc.organizational.approval.request"].search(
            domain, limit=limit, order="create_date desc"
        )
        return [item.serialize_for_api() for item in requests]

    @api.model
    def _validate_approver(self, user, request):
        if request.requested_by_id == user and not self._perm().user_is_platform_admin(
            user
        ):
            raise UserError(_("You cannot approve your own request."))
        delegate = self._active_delegate_for(request.requested_by_id)
        escalation = self._escalation_approver()
        if not (
            self._perm().user_can_approve_org_requests(user)
            or self._perm().user_is_platform_admin(user)
            or (delegate and delegate.id == user.id)
            or (request.escalated_at and escalation and escalation.id == user.id)
        ):
            raise AccessError(_("You cannot decide this approval request."))

    @api.model
    def _validate_can_execute(self, request):
        payload = request.get_payload()
        action = request.action_key
        Document = self.env["doc.document"]
        Folder = self.env["doc.folder"]
        if action == "create_folder":
            parent_id = payload.get("parent_id")
            if parent_id:
                parent = Folder.browse(int(parent_id)).exists()
                if parent and (parent.locked or parent.is_locked):
                    raise UserError(_("Cannot complete: parent folder is locked."))
            return
        document_id = payload.get("document_id") or request.document_id.id
        bulk_document_ids = [
            int(value)
            for value in (payload.get("document_ids") or [])
            if str(value).isdigit()
        ]
        document_ids = bulk_document_ids or ([int(document_id)] if document_id else [])
        for doc_id in document_ids:
            document = Document.browse(int(doc_id)).exists()
            if not document or not document.active or document.deleted_at:
                raise UserError(_("Cannot complete: document is no longer available."))
            if document.legal_hold_active:
                raise UserError(_("Cannot complete: document is on legal hold."))
            try:
                document.folder_id.assert_unlocked()
            except UserError as error:
                raise UserError(_("Cannot complete: %s") % error.args[0]) from error
        if action == "move":
            dest_id = payload.get("destination_folder_id")
            dest = Folder.browse(int(dest_id or 0)).exists()
            if not dest or dest.folder_type != "organizational":
                raise UserError(_("Cannot complete: destination folder is invalid."))
            if dest.locked or dest.is_locked:
                raise UserError(_("Cannot complete: destination folder is locked."))

    @api.model
    def approve_request(self, request_id, note=""):
        user = self.env.user
        request = self.env["doc.organizational.approval.request"].browse(int(request_id))
        if not request or request.state != "pending":
            raise UserError(_("Approval request is not pending."))
        self._validate_approver(user, request)
        self._validate_can_execute(request)
        delegate = self._active_delegate_for(request.requested_by_id)
        self._execute_approved_request(request)
        request.write(
            {
                "state": "approved",
                "approver_id": user.id,
                "delegated_from_id": delegate.id if delegate and delegate.id == user.id else False,
                "decision_note": note or "",
                "executed_at": fields.Datetime.now(),
            }
        )
        return request.serialize_for_api()

    @api.model
    def reject_request(self, request_id, note=""):
        user = self.env.user
        if not (note or "").strip():
            raise UserError(_("A reason is required to reject a request."))
        request = self.env["doc.organizational.approval.request"].browse(int(request_id))
        if not request or request.state != "pending":
            raise UserError(_("Approval request is not pending."))
        self._validate_approver(user, request)
        delegate = self._active_delegate_for(request.requested_by_id)
        request.write(
            {
                "state": "rejected",
                "approver_id": user.id,
                "delegated_from_id": delegate.id if delegate and delegate.id == user.id else False,
                "decision_note": note.strip(),
            }
        )
        return request.serialize_for_api()

    @api.model
    def withdraw_request(self, request_id):
        user = self.env.user
        request = self.env["doc.organizational.approval.request"].browse(int(request_id))
        if not request or request.requested_by_id != user:
            raise AccessError(_("You can only withdraw your own requests."))
        if request.state != "pending":
            raise UserError(_("Only pending requests can be withdrawn."))
        request.write({"state": "cancelled"})
        return request.serialize_for_api()

    @api.model
    def bulk_approve(self, request_ids, note=""):
        results = {"approved": [], "failed": []}
        for request_id in request_ids or []:
            try:
                with self.env.cr.savepoint():
                    results["approved"].append(self.approve_request(request_id, note=note))
            except (UserError, AccessError) as error:
                results["failed"].append(
                    {"id": request_id, "message": error.args[0] if error.args else str(error)}
                )
        return results

    @api.model
    def bulk_reject(self, request_ids, note=""):
        results = {"rejected": [], "failed": []}
        for request_id in request_ids or []:
            try:
                with self.env.cr.savepoint():
                    results["rejected"].append(self.reject_request(request_id, note=note))
            except (UserError, AccessError) as error:
                results["failed"].append(
                    {"id": request_id, "message": error.args[0] if error.args else str(error)}
                )
        return results

    @api.model
    def _folder_vals_from_payload(self, payload):
        Folder = self.env["doc.folder"]
        settings = self.env["doc.employee.files.config"].get_for_company()
        name = (payload.get("name") or payload.get("nameElm") or "").strip()
        description = (payload.get("description") or payload.get("descriptionElm") or "").strip()
        access_scope = payload.get("access_scope") or settings.default_org_access_scope or "private"
        vals = {
            "folder_name": name,
            "description": description,
            "folder_type": "organizational",
            "folder_kind": payload.get("folder_kind") or "folder",
            "access_scope": access_scope,
            "organize_by": payload.get("organize_by") or "none",
            "parent_id": int(payload.get("parent_id") or 0) or False,
            "retention_period": payload.get("retention_period") or "7",
        }
        if payload.get("folder_color"):
            vals["folder_color"] = payload.get("folder_color")
        department_ids = [int(x) for x in (payload.get("department_ids") or []) if str(x).isdigit()]
        grade_ids = [int(x) for x in (payload.get("grade_ids") or []) if str(x).isdigit()]
        employee_ids = [int(x) for x in (payload.get("employee_ids") or []) if str(x).isdigit()]
        if department_ids:
            vals["department_ids"] = [fields.Command.set(department_ids)]
        if grade_ids:
            vals["grade_ids"] = [fields.Command.set(grade_ids)]
        if employee_ids:
            vals["employee_ids"] = [fields.Command.set(employee_ids)]
        allowed_types = [
            int(x) for x in (payload.get("allowed_document_type_ids") or []) if str(x).isdigit()
        ]
        if allowed_types:
            vals["allowed_document_type_ids"] = [fields.Command.set(allowed_types)]
        return vals

    @api.model
    def _execute_approved_request(self, request):
        payload = request.get_payload()
        action = request.action_key
        actor = request.requested_by_id or self.env.user
        env = self.env(user=actor)
        if action == "create_folder":
            folder = env["doc.folder"].create(self._folder_vals_from_payload(payload))
            request.folder_id = folder.id
            return folder
        if action == "edit_rename_description_colour":
            document = env["doc.document"].browse(int(payload.get("document_id"))).exists()
            if not document:
                raise UserError(_("Document not found."))
            updates = {}
            if payload.get("name"):
                updates["name"] = payload["name"]
            if "description" in payload:
                updates["description"] = payload.get("description") or ""
            if updates:
                document.write(updates)
            return document
        if action == "move":
            if payload.get("move_kind") == "folder":
                folder = env["doc.folder"].browse(int(payload.get("folder_id") or 0)).exists()
                parent = env["doc.folder"].browse(int(payload.get("parent_id") or 0)).exists()
                if not folder:
                    raise UserError(_("Folder not found."))
                folder.action_move_folder(parent or False)
                request.folder_id = folder.id
                return folder
            ids = [
                int(value)
                for value in (payload.get("document_ids") or [])
                if str(value).isdigit()
            ]
            destination = env["doc.folder"].browse(
                int(payload.get("destination_folder_id") or 0)
            ).exists()
            documents = env["doc.document"].browse(ids).exists()
            documents.write({"folder_id": destination.id})
            return documents
        if action == "delete":
            ids = [
                int(value)
                for value in (payload.get("document_ids") or [])
                if str(value).isdigit()
            ]
            if not ids and payload.get("document_id"):
                ids = [int(payload.get("document_id"))]
            documents = env["doc.document"].browse(ids).exists()
            if not documents:
                raise UserError(_("Document not found."))
            documents.action_move_to_recycle_bin()
            return documents
        if action in ("replace_version", "upload_link_import_scan"):
            return self._execute_staged_upload(request, payload, env)
        raise UserError(_("No executor configured for action %s") % action)

    @api.model
    def _execute_staged_upload(self, request, payload, env):
        from odoo.addons.cleon_document_management.controllers.main import (
            _UploadBytes,
            _expiry_values_for_upload,
            _process_document_upload,
        )

        folder = env["doc.folder"].browse(int(payload.get("folder_id") or 0)).exists()
        if not folder or folder.folder_type != "organizational":
            raise UserError(_("Destination folder is not available."))
        attachments = request.staging_attachment_ids.sorted("id")
        if not attachments:
            raise UserError(_("Staged upload files are missing for this request."))
        document_type_ids = payload.get("document_type_ids") or []
        expiry_dates = payload.get("expiry_dates") or []
        issue_dates = payload.get("issue_dates") or []
        descriptions = payload.get("descriptions") or []
        replace_document_ids = payload.get("replace_document_ids") or []
        change_notes = payload.get("change_notes") or []
        document_types = env["doc.document.type"].browse(
            list({int(value) for value in document_type_ids if str(value).isdigit()})
        ).exists()
        documents = env["doc.document"]
        for index, attachment in enumerate(attachments):
            type_id = (
                document_type_ids[0]
                if len(document_type_ids) == 1
                else document_type_ids[index]
            )
            document_type = document_types.filtered(lambda item: item.id == int(type_id))[:1]
            if not document_type:
                raise UserError(_("Document type is required for staged uploads."))
            expiry_date = (
                expiry_dates[index]
                if index < len(expiry_dates)
                else (expiry_dates[0] if len(expiry_dates) == 1 else False)
            )
            issue_date = (
                issue_dates[index]
                if index < len(issue_dates)
                else (issue_dates[0] if len(issue_dates) == 1 else False)
            )
            description = (
                descriptions[index]
                if index < len(descriptions)
                else (descriptions[0] if len(descriptions) == 1 else "")
            )
            expiry_values = _expiry_values_for_upload(document_type, expiry_date)
            if expiry_values is None:
                raise UserError(
                    _("An expiry date is required for %s.") % document_type.name
                )
            replace_id = (
                replace_document_ids[index]
                if index < len(replace_document_ids)
                else None
            )
            change_note = (
                change_notes[index] if index < len(change_notes) else ""
            )
            raw = base64.b64decode(attachment.datas or b"")
            upload = _UploadBytes(attachment.name, raw, attachment.mimetype)
            documents |= _process_document_upload(
                upload,
                document_type,
                expiry_values,
                folder,
                replace_document_id=replace_id,
                change_note=change_note,
                issue_date=issue_date or None,
                description=description,
            )
        if payload.get("is_template"):
            documents.write({"is_template": True})
        request.staging_attachment_ids.sudo().unlink()
        if documents:
            request.document_id = documents[0].id
        return documents

    @api.model
    def cron_sla_reminders(self):
        now = fields.Datetime.now()
        config = self._config()
        reminder_hours = int(config.org_approval_reminder_hours_before_sla or 6)
        pending = self.env["doc.organizational.approval.request"].search(
            [
                ("state", "=", "pending"),
                ("due_at", "!=", False),
                ("reminded_at", "=", False),
            ]
        )
        for request in pending:
            if request.due_at and request.due_at - timedelta(hours=reminder_hours) <= now:
                request.reminded_at = now
        overdue = self.env["doc.organizational.approval.request"].search(
            [
                ("state", "=", "pending"),
                ("due_at", "!=", False),
                ("due_at", "<", now),
                ("escalated_at", "=", False),
            ]
        )
        escalation_user = self._escalation_approver()
        for request in overdue:
            request.escalated_at = now
