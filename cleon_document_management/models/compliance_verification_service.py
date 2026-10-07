# -*- coding: utf-8 -*-
from odoo import _, fields, models
from odoo.exceptions import AccessError, ValidationError

REJECTION_REASON_CODES = [
    ("illegible", "Illegible"),
    ("wrong_document", "Wrong document"),
    ("expired", "Expired"),
    ("details_mismatch", "Details do not match"),
    ("incomplete", "Incomplete"),
    ("other", "Other"),
]


class ComplianceVerificationService(models.AbstractModel):
    _name = "doc.compliance.verification.service"
    _description = "Compliance verification actions"

    def _format_rejection_message(self, reason_code, note=""):
        labels = dict(REJECTION_REASON_CODES)
        base = labels.get(reason_code) or reason_code or _("Rejected")
        if reason_code == "other" and (note or "").strip():
            return "%s: %s" % (base, note.strip())
        if note and reason_code != "other":
            return "%s — %s" % (base, note.strip())
        return base

    def user_can_act_on_item(self, item, user):
        if user.has_group("cleon_document_management.group_document_admin"):
            return True
        return item.verifier_id == user

    def clear_duplicate_upload_approvals(self, document):
        """Remove pending upload approval rows when compliance verification owns the gate."""
        document = document.exists()
        if not document or not document.document_type_id.verification_required:
            return
        pending_approvals = document.approval_ids.filtered(
            lambda approval: approval.state in ("pending", "waiting")
        )
        if pending_approvals:
            pending_approvals.sudo().unlink()

    def document_has_approved_verification(self, document):
        Item = self.env["doc.compliance.verification.item"].sudo()
        return bool(
            Item.search_count(
                [
                    ("document_id", "=", document.id),
                    ("status", "=", "approved"),
                ],
                limit=1,
            )
        )

    def document_pending_verification(self, document):
        Item = self.env["doc.compliance.verification.item"].sudo()
        return Item.search(
            [
                ("document_id", "=", document.id),
                ("status", "=", "pending"),
            ],
            limit=1,
        )

    def approve_items(self, items, user):
        items = items.exists()
        for item in items:
            if not self.user_can_act_on_item(item, user):
                raise AccessError(_("This verification is not assigned to you."))
        items._check_not_self_verify()
        for item in items:
            document = item.document_id.sudo()
            if document.pending_attachment_id:
                document._commit_pending_replacement()
            document.write(
                {
                    "approval_state": "approved",
                    "state": "approved",
                    "rejection_reason": False,
                }
            )
            item.write({"status": "approved"})
            self.clear_duplicate_upload_approvals(document)
            self.env["doc.compliance.recheck.job"].schedule_employee(
                item.employee_id, item.policy_id, reason="verification_approved"
            )
            Task = self.env["doc.compliance.task"].sudo()
            waiting = Task.search(
                [
                    ("document_id", "=", document.id),
                    ("employee_id", "=", item.employee_id.id),
                    ("status", "=", "waiting"),
                ],
                limit=1,
            )
            if waiting:
                waiting.write(
                    {
                        "status": "done",
                        "completed_at": fields.Datetime.now(),
                    }
                )
                if waiting.cycle_id:
                    waiting.policy_id._sync_request_cycle_state(waiting.cycle_id)

    def reject_items(self, items, user, reason_code, note=""):
        if not reason_code:
            raise ValidationError(_("A rejection reason is required."))
        message = self._format_rejection_message(reason_code, note)
        items = items.exists()
        for item in items:
            if not self.user_can_act_on_item(item, user):
                raise AccessError(_("This verification is not assigned to you."))
        for item in items:
            document = item.document_id.sudo()
            document.write(
                {
                    "approval_state": "rejected",
                    "rejection_reason": message,
                }
            )
            item.write(
                {
                    "status": "rejected",
                    "rejection_reason_code": reason_code,
                    "rejection_reason": message,
                }
            )
            self.clear_duplicate_upload_approvals(document)
            self.env["doc.compliance.recheck.job"].schedule_employee(
                item.employee_id, item.policy_id, reason="verification_rejected"
            )
            Task = self.env["doc.compliance.task"].sudo()
            waiting = Task.search(
                [
                    ("document_id", "=", document.id),
                    ("employee_id", "=", item.employee_id.id),
                    ("status", "in", ("waiting", "done")),
                ],
                limit=1,
            )
            if waiting:
                waiting.write(
                    {
                        "status": "reopened",
                        "rejection_reason": message,
                        "completed_at": False,
                        "document_id": False,
                    }
                )

    def item_display_status(self, item):
        if item.status != "pending":
            return item.status
        if item.sla_escalated:
            return "escalated"
        if not item.sla_due_at:
            return "pending"
        now = fields.Datetime.now()
        if item.sla_due_at < now:
            return "overdue"
        delta = item.sla_due_at - now
        if delta.total_seconds() <= 86400:
            return "due_soon"
        return "pending"

    def item_to_api_dict(self, item):
        document = item.document_id
        return {
            "id": item.id,
            "employee_id": item.employee_id.id,
            "employee_name": item.employee_id.name,
            "document_id": document.id,
            "document_name": document.name,
            "document_type": document.document_type_id.name or "",
            "policy_id": item.policy_id.id if item.policy_id else False,
            "policy_name": item.policy_id.name if item.policy_id else "",
            "sla_due_at": fields.Datetime.to_string(item.sla_due_at)
            if item.sla_due_at
            else "",
            "status": item.status,
            "display_status": self.item_display_status(item),
            "verifier_note": item.verifier_note or "",
            "reviewer_not_found": bool(item.verifier_not_found),
            "rejection_reason_code": item.rejection_reason_code or "",
            "can_act": self.user_can_act_on_item(item, self.env.user),
        }

    def item_detail_api_dict(self, item):
        data = self.item_to_api_dict(item)
        document = item.document_id
        versions = document.version_ids.sorted("version_number", reverse=True)
        previous = versions[:1]
        data.update(
            {
                "mime_type": document.mime_type or "",
                "issue_date": str(document.issue_date or ""),
                "expiry_date": str(document.expiry_date or ""),
                "description": document.description or "",
                "approval_state": document.approval_state,
                "state": document.state,
                "current_version_number": document.current_version_number or 0,
                "previous_version_id": previous.id if previous else False,
                "version_ids": [
                    {
                        "id": version.id,
                        "version_number": version.version_number,
                        "upload_date": str(version.upload_date or ""),
                    }
                    for version in versions
                ],
            }
        )
        return data
