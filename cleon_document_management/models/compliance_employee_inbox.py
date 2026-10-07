# -*- coding: utf-8 -*-
from datetime import date

from odoo import _, api, fields, models
from odoo.exceptions import AccessError


class ComplianceEmployeeInbox(models.AbstractModel):
    _name = "doc.compliance.employee.inbox"
    _description = "Employee My Compliance inbox builder"

    @api.model
    def _document_submission_meta(self, document, employee):
        if not document:
            return {
                "document_id": False,
                "submitted_at": "",
                "submitted_by_hr": False,
                "submitted_by_name": "",
            }
        submitted_by_hr = bool(document.submitted_on_behalf_by)
        submitter = document.submitted_on_behalf_by or document.uploaded_by
        if not submitted_by_hr and employee.user_id and submitter:
            submitted_by_hr = submitter.id != employee.user_id.id
        return {
            "document_id": document.id,
            "submitted_at": fields.Datetime.to_string(document.create_date or ""),
            "submitted_by_hr": submitted_by_hr,
            "submitted_by_name": submitter.name if submitter else "",
        }

    @api.model
    def _primary_document_for_line(self, line):
        documents = line.document_ids.sorted(key=lambda d: d.create_date or "", reverse=True)
        if not documents:
            return self.env["doc.document"]
        for document in documents:
            if document.approval_state == "rejected":
                return document
        for document in documents:
            if document.approval_state == "pending" or line.compliance_status == "pending":
                return document
        return documents[0]

    @api.model
    def _line_tab_and_action(self, line, evaluation, today):
        policy = evaluation.policy_id
        compliance_status = line.compliance_status or ""
        reason_code = line.reason_code or ""
        reason_message = line.reason_message or ""

        if compliance_status == "pending" or line.status == "pending":
            return "waiting", "none", ""

        if reason_code == "rejected" or (
            line.status == "missing" and reason_code == "rejected"
        ):
            label = _("Rejected: %s") % (reason_message or _("Rejected"))
            return "todo", "resubmit", label

        if compliance_status in ("compliant", "exempt") or line.status == "complete":
            return "done", "view", ""

        if compliance_status == "non_compliant" or (
            line.status == "missing" and compliance_status == "at_risk"
        ):
            if reason_code == "rejected":
                label = _("Rejected: %s") % (reason_message or _("Rejected"))
                return "todo", "resubmit", label
            return "todo", "upload", ""

        if line.status in ("missing", "grace") or compliance_status == "at_risk":
            if line.due_date and line.due_date > today and line.status == "grace":
                return "coming_up", "upload", ""
            if line.due_date and line.due_date > today:
                return "coming_up", "none", ""
            return "todo", "upload", ""

        if line.status == "excepted":
            return "exceptions", "none", ""

        return "coming_up", "none", ""

    @api.model
    def _waiting_label(self, document, submitted_by_hr, submitted_by_name, submitted_at):
        if not document:
            return _("Waiting for verification")
        when = ""
        if submitted_at:
            try:
                dt = fields.Datetime.from_string(submitted_at)
                when = fields.Date.to_string(dt.date())
            except (TypeError, ValueError):
                when = str(submitted_at)[:10]
        base = _("Submitted %(date)s, waiting for verification") % {
            "date": when or _("recently"),
        }
        if submitted_by_hr and submitted_by_name:
            return _("%(base)s (Submitted by HR)") % {"base": base}
        return base

    @api.model
    def _serialize_line_item(self, line, evaluation, employee, today):
        policy = evaluation.policy_id
        requirement = line.requirement_id
        document = self._primary_document_for_line(line)
        submission = self._document_submission_meta(document, employee)
        tab, primary_action, status_label = self._line_tab_and_action(
            line, evaluation, today
        )
        rejection_message = ""
        if line.reason_code == "rejected" or (
            primary_action == "resubmit" and line.reason_message
        ):
            rejection_message = line.reason_message or _("Rejected")
            status_label = status_label or _("Rejected: %s") % rejection_message

        waiting_label = ""
        if tab == "waiting":
            waiting_label = self._waiting_label(
                document,
                submission["submitted_by_hr"],
                submission["submitted_by_name"],
                submission["submitted_at"],
            )

        title = line.document_type_id.name or requirement.name or policy.name
        compliance_status = line.compliance_status or line.status
        return {
            "id": "line-%s" % line.id,
            "kind": "document_requirement",
            "tab": tab,
            "evaluation_line_id": line.id,
            "evaluation_id": evaluation.id,
            "task_id": False,
            "exception_id": False,
            "title": title,
            "subtitle": policy.name,
            "policy_id": policy.id,
            "policy": policy.name,
            "policy_description": policy.description or "",
            "requirement_description": requirement.description or "",
            "instructions": requirement.description or policy.description or "",
            "document_type_id": line.document_type_id.id or False,
            "document_type": title,
            "document_type_name": title,
            "due_date": str(line.due_date or ""),
            "grace_end_date": str(line.grace_end_date or ""),
            "compliance_status": compliance_status,
            "reason_message": line.reason_message or "",
            "reason_code": line.reason_code or "",
            "status_label": status_label or "",
            "rejection_message": rejection_message,
            "primary_action": primary_action,
            "waiting_label": waiting_label,
            **submission,
        }

    @api.model
    def _serialize_task_item(self, task, employee):
        policy = task.policy_id
        tab = "todo"
        primary_action = "complete_task"
        status_label = ""
        waiting_label = ""

        if task.status == "waiting":
            tab = "waiting"
            primary_action = "none"
            document = task.document_id
            submission = self._document_submission_meta(document, employee)
            waiting_label = self._waiting_label(
                document,
                submission["submitted_by_hr"],
                submission["submitted_by_name"],
                submission["submitted_at"],
            )
        elif task.status == "done":
            tab = "done"
            primary_action = "view"
        elif task.status in ("todo", "reopened"):
            if task.rejection_reason:
                status_label = _("Rejected: %s") % task.rejection_reason
            if task.task_type == "upload_evidence":
                primary_action = "upload"
        else:
            return None

        submission = self._document_submission_meta(task.document_id, employee)
        return {
            "id": "task-%s" % task.id,
            "kind": "task",
            "tab": tab,
            "evaluation_line_id": False,
            "evaluation_id": False,
            "task_id": task.id,
            "exception_id": False,
            "title": task.title,
            "subtitle": policy.name,
            "policy_id": policy.id,
            "policy": policy.name,
            "policy_description": policy.description or "",
            "requirement_description": "",
            "instructions": task.instructions or policy.description or "",
            "document_type_id": task.evidence_document_type_id.id or False,
            "document_type": task.evidence_document_type_id.name or "",
            "document_type_name": task.evidence_document_type_id.name or "",
            "due_date": str(task.due_date or ""),
            "grace_end_date": "",
            "compliance_status": task.status,
            "reason_message": task.rejection_reason or "",
            "reason_code": "rejected" if task.rejection_reason else "",
            "status_label": status_label,
            "rejection_message": task.rejection_reason or "",
            "primary_action": primary_action,
            "waiting_label": waiting_label,
            "task_type": task.task_type,
            **submission,
        }

    @api.model
    def _serialize_exception_item(self, exc):
        tab = "exceptions"
        return {
            "id": "exception-%s" % exc.id,
            "kind": "exception",
            "tab": tab,
            "evaluation_line_id": False,
            "evaluation_id": False,
            "task_id": False,
            "exception_id": exc.id,
            "title": exc.policy_id.name,
            "subtitle": _("Waiver / exception"),
            "policy_id": exc.policy_id.id,
            "policy": exc.policy_id.name,
            "policy_description": exc.policy_id.description or "",
            "requirement_description": "",
            "instructions": exc.reason or "",
            "document_type_id": False,
            "document_type": "",
            "document_type_name": "",
            "due_date": str(exc.valid_until or ""),
            "grace_end_date": "",
            "compliance_status": exc.status,
            "reason_message": exc.reason or "",
            "reason_code": "",
            "status_label": exc.status,
            "rejection_message": "",
            "primary_action": "none",
            "waiting_label": "",
            "document_id": False,
            "submitted_at": "",
            "submitted_by_hr": False,
            "submitted_by_name": "",
            "valid_until": str(exc.valid_until or ""),
        }

    @api.model
    def build_for_employee(self, employee):
        today = fields.Date.context_today(self)
        evaluations = self.env["doc.compliance.evaluation"].search(
            [("employee_id", "=", employee.id)],
            order="evaluated_at desc",
        )
        items = []
        for evaluation in evaluations:
            for line in evaluation.line_ids:
                items.append(self._serialize_line_item(line, evaluation, employee, today))

        tasks = self.env["doc.compliance.task"].search(
            [
                ("employee_id", "=", employee.id),
                ("cycle_id.state", "=", "open"),
                ("status", "in", ("todo", "waiting", "reopened", "done")),
            ],
            order="due_date asc, id asc",
            limit=200,
        )
        for task in tasks:
            serialized = self._serialize_task_item(task, employee)
            if serialized:
                items.append(serialized)

        exceptions = self.env["doc.compliance.exception"].search(
            [
                ("employee_id", "=", employee.id),
                ("status", "in", ("draft", "approved")),
                ("active", "=", True),
            ]
        )
        for exc in exceptions:
            items.append(self._serialize_exception_item(exc))

        inbox = {key: [] for key in ("todo", "waiting", "done", "coming_up", "exceptions")}
        for item in items:
            tab = item.get("tab") or "todo"
            if tab not in inbox:
                tab = "todo"
            inbox[tab].append(item)

        overall_status = self._overall_status(evaluations, items, today)
        return {
            "items": items,
            "inbox": inbox,
            "inbox_summary": {key: len(inbox[key]) for key in inbox},
            "overall_status": overall_status,
        }

    @api.model
    def _overall_status(self, evaluations, items, today):
        if evaluations.filtered(lambda e: e.status == "non_compliant"):
            return "non_compliant"
        todo_items = [i for i in items if i.get("tab") == "todo"]
        if todo_items:
            return "at_risk"
        for evaluation in evaluations:
            if evaluation.status in ("partial", "grace"):
                return "at_risk"
        for item in items:
            due = item.get("due_date")
            if due and item.get("tab") == "todo":
                try:
                    due_date = fields.Date.from_string(due)
                    if due_date < today:
                        return "at_risk"
                except (TypeError, ValueError):
                    pass
        if evaluations:
            return "compliant"
        return "compliant"

    @api.model
    def get_item_detail(self, employee, kind, record_id):
        if kind == "document_requirement":
            line = self.env["doc.compliance.evaluation.line"].browse(int(record_id)).exists()
            if not line or line.evaluation_id.employee_id != employee:
                raise AccessError(_("You do not have access to this item."))
            evaluation = line.evaluation_id
            today = fields.Date.context_today(self)
            return self._serialize_line_item(line, evaluation, employee, today)
        if kind == "task":
            task = self.env["doc.compliance.task"].browse(int(record_id)).exists()
            if not task or task.employee_id != employee:
                raise AccessError(_("You do not have access to this item."))
            serialized = self._serialize_task_item(task, employee)
            if not serialized:
                raise AccessError(_("This task is not available."))
            return serialized
        if kind == "exception":
            exc = self.env["doc.compliance.exception"].browse(int(record_id)).exists()
            if not exc or exc.employee_id != employee:
                raise AccessError(_("You do not have access to this item."))
            return self._serialize_exception_item(exc)
        raise AccessError(_("Unknown inbox item."))
