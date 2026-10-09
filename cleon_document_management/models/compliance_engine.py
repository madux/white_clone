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
        if trigger < effective:
            trigger = effective
        due_days = due_days if due_days is not None else max(policy.due_days or 0, 0)
        grace_days = (
            grace_days
            if grace_days is not None
            else max(policy.grace_period_days or 0, 0)
        )
        due_date = trigger + timedelta(days=due_days)
        grace_end = due_date + timedelta(days=grace_days)
        return {
            "trigger_date": trigger,
            "due_date": due_date,
            "grace_end_date": grace_end,
            "non_compliance_date": grace_end + timedelta(days=1)
            if grace_days
            else due_date + timedelta(days=1),
        }

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
                ("state", "in", ["approved", "signed", "pending"]),
            ],
            order="write_date desc",
        )

    @api.model
    def _document_is_verified(self, document, document_type):
        if document_type.verification_required:
            service = self.env["doc.compliance.verification.service"].sudo()
            if service.document_pending_verification(document):
                return False
            return service.document_has_approved_verification(document)
        workflow = self.env["doc.approval.workflow.service"].get_upload_approval_config()
        if not workflow["require_upload_approval"]:
            return True
        if document.approval_state == "approved" or document.state in (
            "approved",
            "signed",
        ):
            return True
        if document.approval_state == "rejected":
            return False
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
            if not self._document_is_verified(document, document_type):
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
            comp = "at_risk" if today <= dates["grace_end_date"] else "non_compliant"
            return {
                "status": "grace" if comp == "at_risk" else "missing",
                "compliance_status": comp,
                "reason_code": "expiry_missing",
                "reason_message": "Expiry date missing",
                "required_count": required,
                "matched_count": 0,
                "document_ids": documents.ids,
                "due_date": dates["due_date"],
                "grace_end_date": dates["grace_end_date"],
            }

        if today <= dates["due_date"]:
            comp = "at_risk"
            legacy = "grace"
            reason = "due_in_days"
            msg = "Due %s" % dates["due_date"]
        elif today <= dates["grace_end_date"]:
            comp = "at_risk"
            legacy = "grace"
            reason = "grace_remaining"
            msg = "Overdue · grace until %s" % dates["grace_end_date"]
        else:
            comp = "non_compliant"
            legacy = "missing"
            reason = "overdue"
            msg = "Overdue since %s" % dates["due_date"]

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
            if today <= alt["due_date"]:
                comp, legacy, reason, msg = (
                    "at_risk",
                    "grace",
                    "no_document",
                    "Document missing · due %s" % alt["due_date"],
                )
            elif today <= alt["grace_end_date"]:
                comp, legacy, reason, msg = (
                    "at_risk",
                    "grace",
                    "no_document_grace",
                    "Document missing · grace until %s" % alt["grace_end_date"],
                )
            else:
                comp, legacy, reason, msg = (
                    "non_compliant",
                    "missing",
                    "no_document_overdue",
                    "Document missing · overdue since %s" % alt["due_date"],
                )

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
