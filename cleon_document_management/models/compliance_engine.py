# -*- coding: utf-8 -*-
"""Spec-aligned compliance evaluation helpers (Section 5, 9–14)."""

from datetime import timedelta

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models


COMPLIANCE_STATUSES = (
    "compliant",
    "at_risk",
    "pending",
    "non_compliant",
    "exempt",
)

LINE_STATUSES = ("complete", "grace", "missing", "excepted", "pending")


class ComplianceEngine(models.AbstractModel):
    _name = "doc.compliance.engine"
    _description = "Compliance evaluation engine"

    @api.model
    def _employee_start_date(self, employee):
        today = fields.Date.context_today(self)
        start = employee.contract_id.date_start if employee.contract_id else False
        if not start and employee.create_date:
            start = fields.Date.to_date(employee.create_date)
        return start or today

    @api.model
    def _assignment_dates(self, policy, employee, due_days=None, grace_days=None):
        today = fields.Date.context_today(self)
        effective = policy.effective_date or today
        trigger = self._employee_start_date(employee)
        code = policy.policy_type_id.code if policy.policy_type_id else ""
        if code == "document_requirement" and policy.event_trigger:
            anchor = self.env[
                "doc.compliance.document_requirement.engine"
            ].document_requirement_anchor_date(policy, employee)
            if anchor:
                trigger = anchor
        if trigger < effective:
            trigger = effective
        due_days = due_days if due_days is not None else max(policy.due_days or 0, 0)
        if grace_days is None:
            grace_days = (
                max(policy.grace_period_days or 0, 0)
                if getattr(policy, "grace_period_enabled", False)
                else 0
            )
        elif not getattr(policy, "grace_period_enabled", False):
            grace_days = 0
        due_date = trigger + timedelta(days=due_days)
        grace_end = due_date + timedelta(days=grace_days)
        mode = self._effective_non_compliance_mode(policy)
        if mode == "after_due":
            non_compliance_date = due_date + timedelta(days=1)
        elif mode == "never":
            non_compliance_date = False
        else:
            non_compliance_date = grace_end + timedelta(days=1) if grace_days else due_date + timedelta(days=1)
        return {
            "trigger_date": trigger,
            "due_date": due_date,
            "grace_end_date": grace_end,
            "non_compliance_date": non_compliance_date,
        }

    @api.model
    def _effective_non_compliance_mode(self, policy):
        mode = policy.non_compliance_mode or "after_grace"
        if not getattr(policy, "grace_period_enabled", False) and mode == "after_grace":
            return "after_due"
        return mode

    @api.model
    def _missing_document_timeline_status(self, policy, dates, today):
        """Map overdue missing documents to compliance + legacy line status."""
        due = dates["due_date"]
        grace_end = dates["grace_end_date"]
        mode = self._effective_non_compliance_mode(policy)
        if today <= due:
            return (
                "at_risk",
                "grace",
                "due_in_days",
                "Due %s" % due,
            )
        if mode == "never":
            return (
                "at_risk",
                "grace",
                "overdue_no_auto",
                "Overdue · no automatic non-compliance",
            )
        if mode == "after_due":
            return (
                "non_compliant",
                "missing",
                "overdue",
                "Overdue since %s" % due,
            )
        if today <= grace_end:
            return (
                "at_risk",
                "grace",
                "grace_remaining",
                "Overdue · grace until %s" % grace_end,
            )
        return (
            "non_compliant",
            "missing",
            "overdue",
            "Overdue since %s" % due,
        )

    @api.model
    def _current_documents(self, employee, document_type):
        today = fields.Date.context_today(self)
        Document = self.env["doc.document"].sudo()
        return Document.search(
            [
                ("employee_id", "=", employee.id),
                ("document_type_id", "=", document_type.id),
                ("active", "=", True),
                ("deleted_at", "=", False),
                ("state", "in", ["approved", "signed", "pending", "rejected"]),
            ],
            order="write_date desc",
        )

    @api.model
    def _document_is_verified(self, document, document_type, policy=None):
        requires_verification = False
        if policy and hasattr(policy, "policy_requires_compliance_verification"):
            requires_verification = policy.policy_requires_compliance_verification(
                document_type
            )
        if requires_verification:
            service = self.env["doc.compliance.verification.service"].sudo()
            if service.document_pending_verification(document):
                return False
            return service.document_has_approved_verification(document)
        if document.approval_state == "rejected" or document.state == "rejected":
            return False
        workflow = self.env["doc.approval.workflow.service"].get_upload_approval_config()
        if not workflow["require_upload_approval"]:
            return True
        if document.approval_state == "approved" or document.state in (
            "approved",
            "signed",
        ):
            return True
        return document.approval_state in ("pending", "submitted") or document.state == "pending"

    @api.model
    def evaluate_document_type_line(
        self,
        policy,
        employee,
        document_type,
        requirement,
        exception,
        today=None,
        renewal_window_days=60,
    ):
        """Return line payload: legacy status, compliance_status, reason_code, reason_message."""
        today = today or fields.Date.context_today(self)
        dates = self._assignment_dates(
            policy,
            employee,
            grace_days=requirement.grace_period_days,
        )
        if exception:
            return {
                "status": "excepted",
                "compliance_status": "exempt",
                "reason_code": "exception",
                "reason_message": "Exception until %s" % exception.valid_until,
                "required_count": requirement.minimum_documents,
                "matched_count": 0,
                "document_ids": [],
                "due_date": dates["due_date"],
                "grace_end_date": dates["grace_end_date"],
            }

        documents = self._current_documents(employee, document_type)
        valid_docs = self.env["doc.document"]
        pending_doc = self.env["doc.document"]
        rejected_doc = self.env["doc.document"]

        expires = document_type.expiry_configured
        if expires is None:
            expires = document_type.expiry_applicable

        for document in documents:
            if expires:
                if not document.has_expiry or not document.expiry_date:
                    continue
                if document.expiry_date < today:
                    continue
            if not self._document_is_verified(document, document_type, policy=policy):
                if document.approval_state == "rejected":
                    rejected_doc = document
                else:
                    pending_doc = document
                continue
            valid_docs |= document

        count = len(valid_docs)
        required = max(requirement.minimum_documents, 1)

        if pending_doc and not valid_docs:
            return {
                "status": "pending",
                "compliance_status": "pending",
                "reason_code": "awaiting_verification",
                "reason_message": "Awaiting verification",
                "required_count": required,
                "matched_count": 0,
                "document_ids": pending_doc.ids,
                "due_date": dates["due_date"],
                "grace_end_date": dates["grace_end_date"],
            }

        if rejected_doc and not valid_docs:
            return {
                "status": "missing",
                "compliance_status": "at_risk"
                if today <= dates["grace_end_date"]
                else "non_compliant",
                "reason_code": "rejected",
                "reason_message": rejected_doc.rejection_reason or "Rejected",
                "required_count": required,
                "matched_count": 0,
                "document_ids": rejected_doc.ids,
                "due_date": dates["due_date"],
                "grace_end_date": dates["grace_end_date"],
            }

        if count >= required:
            code = policy.policy_type_id.code if policy.policy_type_id else ""
            if code == "renewable_document" and valid_docs:
                nearest = min(valid_docs.mapped("expiry_date"))
                days_left = (nearest - today).days if nearest else 9999
                if days_left <= renewal_window_days:
                    return {
                        "status": "complete",
                        "compliance_status": "at_risk",
                        "reason_code": "expiring",
                        "reason_message": "Expiring in %s days" % days_left,
                        "required_count": required,
                        "matched_count": count,
                        "document_ids": valid_docs.ids,
                        "due_date": dates["due_date"],
                        "grace_end_date": dates["grace_end_date"],
                    }
            return {
                "status": "complete",
                "compliance_status": "compliant",
                "reason_code": "satisfied",
                "reason_message": "All documents verified",
                "required_count": required,
                "matched_count": count,
                "document_ids": valid_docs.ids,
                "due_date": dates["due_date"],
                "grace_end_date": dates["grace_end_date"],
            }

        missing_expiry = False
        if expires:
            for document in documents.filtered(lambda d: d.state in ("approved", "signed")):
                if document.has_expiry and not document.expiry_date:
                    missing_expiry = True
                    break
                if document.has_expiry and document.expiry_date and document.expiry_date < today:
                    missing_expiry = True
                    break

        if missing_expiry and not valid_docs:
            comp, legacy, reason, msg = self._missing_document_timeline_status(
                policy, dates, today
            )
            return {
                "status": legacy,
                "compliance_status": comp,
                "reason_code": reason if reason != "due_in_days" else "expiry_missing",
                "reason_message": msg if reason != "due_in_days" else "Expiry date missing",
                "required_count": required,
                "matched_count": 0,
                "document_ids": documents.ids,
                "due_date": dates["due_date"],
                "grace_end_date": dates["grace_end_date"],
            }

        comp, legacy, reason, msg = self._missing_document_timeline_status(
            policy, dates, today
        )

        code = policy.policy_type_id.code if policy.policy_type_id else ""
        if code == "renewable_document" and not documents:
            no_doc_days = max(policy.no_document_due_days or 30, 1)
            alt = self._assignment_dates(
                policy,
                employee,
                due_days=no_doc_days,
                grace_days=requirement.grace_period_days,
            )
            dates = alt
            comp, legacy, reason, msg = self._missing_document_timeline_status(
                policy, alt, today
            )
            if reason == "due_in_days":
                reason = "no_document"
                msg = "Document missing · due %s" % alt["due_date"]
            elif reason == "grace_remaining":
                reason = "no_document_grace"
                msg = "Document missing · grace until %s" % alt["grace_end_date"]
            elif reason == "overdue":
                reason = "no_document_overdue"
                msg = "Document missing · overdue since %s" % alt["due_date"]
            elif reason == "overdue_no_auto":
                reason = "no_document_overdue"
                msg = "Document missing · overdue (no automatic non-compliance)"

        return {
            "status": legacy,
            "compliance_status": comp,
            "reason_code": reason,
            "reason_message": msg,
            "required_count": required,
            "matched_count": count,
            "document_ids": valid_docs.ids,
            "due_date": dates["due_date"],
            "grace_end_date": dates["grace_end_date"],
        }

    @api.model
    def aggregate_evaluation_status(self, line_payloads, exception):
        if exception and line_payloads:
            return "excepted", "exempt", "exception", "Exception active"
        if not line_payloads:
            return "non_compliant", "non_compliant", "no_requirements", "No requirements"
        statuses = {p["compliance_status"] for p in line_payloads}
        if statuses == {"compliant"}:
            return "compliant", "compliant", "satisfied", "All requirements met"
        if "non_compliant" in statuses and len(statuses) == 1:
            return "non_compliant", "non_compliant", "overdue", "Non-compliant"
        if statuses <= {"compliant", "exempt"}:
            return "compliant", "compliant", "satisfied", "All requirements met"
        if "pending" in statuses and "non_compliant" not in statuses:
            return "partial", "pending", "awaiting_verification", "Awaiting verification"
        if "non_compliant" in statuses:
            return "non_compliant", "non_compliant", "overdue", "Non-compliant"
        return "partial", "at_risk", "at_risk", "At risk"
