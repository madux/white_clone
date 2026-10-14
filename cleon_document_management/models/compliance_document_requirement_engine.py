# -*- coding: utf-8 -*-
"""Lifecycle triggers for document requirement policies (EMS field → event_trigger)."""

from datetime import timedelta

from odoo import api, fields, models

# Fields watched on hr.employee write (mutually exclusive classification).
DOC_REQUIREMENT_CLASSIFY_FIELDS = (
    "department_id",
    "work_location_id",
    "branch_id",
    "grade_id",
    "grade_level",
)


class ComplianceDocumentRequirementEngine(models.AbstractModel):
    _name = "doc.compliance.document_requirement.engine"
    _description = "Document requirement lifecycle triggers"

    @api.model
    def _snapshot_employee_field(self, employee, field_name):
        if field_name not in employee._fields:
            return False
        value = employee[field_name]
        if isinstance(value, models.BaseModel):
            return value.id if value else False
        return value

    @api.model
    def _employee_field_changed(self, employee, field_name, before_value):
        if field_name not in employee._fields:
            return False
        return self._snapshot_employee_field(employee, field_name) != before_value

    @api.model
    def classify_document_requirement_event(self, employee, vals, before_snapshot):
        """Return at most one event_trigger for this write, or None."""
        before_snapshot = before_snapshot or {}
        if not before_snapshot:
            return None

        def changed(field_name):
            if field_name not in vals:
                return False
            return self._employee_field_changed(
                employee, field_name, before_snapshot.get(field_name)
            )

        if changed("department_id"):
            return "department_transfer"
        if changed("work_location_id") or changed("branch_id"):
            return "location_change"
        if changed("grade_id") or changed("grade_level"):
            return "promotion"
        return None

    @api.model
    def _employee_has_document_file(self, employee):
        return bool(
            self.env["doc.employee.file"]
            .sudo()
            .search(
                [
                    ("employee_id", "=", employee.id),
                    ("company_id", "=", employee.company_id.id),
                ],
                limit=1,
            )
        )

    @api.model
    def _onboarding_triggered_at(self, employee):
        start = self.env["doc.compliance.engine"]._employee_start_date(employee)
        return fields.Datetime.to_datetime(start)

    @api.model
    def document_requirement_event_started(self, policy, employee):
        """True when a lifecycle row exists for this policy's configured trigger."""
        if not policy.event_trigger:
            return True
        return bool(
            self.env["doc.compliance.lifecycle.request"]
            .sudo()
            .search_count(
                [
                    ("policy_id", "=", policy.id),
                    ("employee_id", "=", employee.id),
                    ("event_trigger", "=", policy.event_trigger),
                ],
                limit=1,
            )
        )

    @api.model
    def document_requirement_anchor_date(self, policy, employee):
        """Date used for due/grace when policy is event-triggered."""
        if not policy.event_trigger:
            return False
        Request = self.env["doc.compliance.lifecycle.request"].sudo()
        pending = Request.search(
            [
                ("policy_id", "=", policy.id),
                ("employee_id", "=", employee.id),
                ("event_trigger", "=", policy.event_trigger),
                ("status", "=", "pending"),
            ],
            order="triggered_at desc",
            limit=1,
        )
        request = pending or Request.search(
            [
                ("policy_id", "=", policy.id),
                ("employee_id", "=", employee.id),
                ("event_trigger", "=", policy.event_trigger),
            ],
            order="triggered_at desc",
            limit=1,
        )
        if not request:
            return False
        return fields.Date.to_date(request.triggered_at)


class CompliancePolicyDocumentRequirement(models.Model):
    _inherit = "doc.compliance.policy"

    @api.model
    def trigger_document_requirement_for_employees(
        self, employees, event_trigger, triggered_at=None
    ):
        if not event_trigger:
            return
        employees = employees.filtered("id")
        if not employees:
            return
        policies = self.search(
            [
                ("active", "=", True),
                ("policy_type_id.code", "=", "document_requirement"),
                ("event_trigger", "=", event_trigger),
            ]
        )
        if not policies:
            return
        engine = self.env["doc.compliance.document_requirement.engine"]
        for employee in employees:
            if not engine._employee_has_document_file(employee):
                continue
            for policy in policies:
                if not policy._applies_to_employee(employee):
                    continue
                policy._fire_document_requirement_event(
                    employee, event_trigger, triggered_at=triggered_at
                )

    def _fire_document_requirement_event(
        self, employee, event_trigger, triggered_at=None
    ):
        self.ensure_one()
        if self._policy_type_code() != "document_requirement":
            return
        if self.event_trigger != event_trigger:
            return
        today = fields.Date.context_today(self)
        if self.effective_date and self.effective_date > today:
            return
        triggered_at = triggered_at or fields.Datetime.now()
        due_days = max(self.due_days or 0, 0)
        due_date = fields.Date.to_date(triggered_at) + timedelta(days=due_days)
        Request = self.env["doc.compliance.lifecycle.request"].sudo()
        existing = Request.search(
            [
                ("policy_id", "=", self.id),
                ("employee_id", "=", employee.id),
                ("event_trigger", "=", event_trigger),
                ("status", "=", "pending"),
            ],
            limit=1,
        )
        if existing:
            existing.write(
                {"triggered_at": triggered_at, "due_date": due_date}
            )
        else:
            Request.create(
                {
                    "policy_id": self.id,
                    "employee_id": employee.id,
                    "event_trigger": event_trigger,
                    "triggered_at": triggered_at,
                    "due_date": due_date,
                }
            )
        self.evaluate_employee(employee)
