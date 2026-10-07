# -*- coding: utf-8 -*-
"""Runtime engine for Compliance Request policies."""

from datetime import timedelta

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class ComplianceRequestEngine(models.Model):
    _inherit = "doc.compliance.policy"

    def _active_exception_for_employee(self, employee, today=None):
        today = today or fields.Date.context_today(self)
        return self.env["doc.compliance.exception"].sudo().search(
            [
                ("policy_id", "=", self.id),
                ("employee_id", "=", employee.id),
                ("status", "=", "approved"),
                ("active", "=", True),
                ("valid_until", ">=", today),
            ],
            limit=1,
        )

    def _open_request_cycle(self, employee):
        Cycle = self.env["doc.compliance.request.cycle"].sudo()
        return Cycle.search(
            [
                ("policy_id", "=", self.id),
                ("employee_id", "=", employee.id),
                ("state", "=", "open"),
            ],
            limit=1,
        )

    def _withdraw_open_request_cycle(self, employee):
        cycle = self._open_request_cycle(employee)
        if not cycle:
            return
        cycle.write(
            {
                "state": "withdrawn",
                "closed_at": fields.Datetime.now(),
            }
        )
        cycle.task_ids.filtered(lambda t: t.status in ("todo", "waiting", "reopened")).write(
            {"status": "withdrawn"}
        )

    def _cycle_dates(self, trigger_date=None):
        self.ensure_one()
        today = fields.Date.context_today(self)
        trigger = trigger_date or today
        if self.effective_date and trigger < self.effective_date:
            trigger = self.effective_date
        due_days = max(self.due_days or 0, 1)
        grace_days = max(self.grace_period_days or 0, 0)
        due_date = trigger + timedelta(days=due_days)
        grace_end = due_date + timedelta(days=grace_days)
        return trigger, due_date, grace_end

    def _create_request_cycle(self, employee, trigger_kind, triggered_at=None):
        self.ensure_one()
        if not self._is_compliance_request():
            return self.env["doc.compliance.request.cycle"]
        if not self.active or not self._applies_to_employee(employee):
            return self.env["doc.compliance.request.cycle"]
        if self._active_exception_for_employee(employee):
            return self.env["doc.compliance.request.cycle"]
        if not self.request_task_definition_ids:
            return self.env["doc.compliance.request.cycle"]

        self._withdraw_open_request_cycle(employee)
        triggered_at = triggered_at or fields.Datetime.now()
        trigger_date = fields.Date.to_date(triggered_at)
        _, due_date, grace_end = self._cycle_dates(trigger_date)

        Cycle = self.env["doc.compliance.request.cycle"].sudo()
        cycle = Cycle.create(
            {
                "policy_id": self.id,
                "employee_id": employee.id,
                "trigger_kind": trigger_kind,
                "triggered_at": triggered_at,
                "opened_at": fields.Datetime.now(),
                "due_date": due_date,
                "grace_end_date": grace_end,
                "state": "open",
            }
        )
        Task = self.env["doc.compliance.task"].sudo()
        for definition in self.request_task_definition_ids.sorted("sequence"):
            Task.create(
                {
                    "policy_id": self.id,
                    "employee_id": employee.id,
                    "cycle_id": cycle.id,
                    "definition_id": definition.id,
                    "task_type": definition.task_type,
                    "requirement": definition.requirement,
                    "title": definition.name,
                    "instructions": definition.instructions,
                    "due_date": due_date,
                    "status": "todo",
                    "linked_org_policy_id": definition.linked_org_policy_id.id,
                    "linked_document_id": definition.linked_document_id.id,
                    "linked_form_id": definition.linked_form_id.id,
                    "evidence_document_type_id": definition.evidence_document_type_id.id,
                    "declaration_text": definition.declaration_text,
                }
            )
        self._grant_compliance_content_access_for_cycle(cycle, employee)
        self._notify_request_cycle_opened(employee, cycle)
        self.evaluate_employee(employee)
        return cycle

    def _notify_request_cycle_opened(self, employee, cycle):
        note = _(
            "Complete the tasks for %(policy)s by %(due)s.",
            policy=self.name,
            due=cycle.due_date,
        )
        recipients = self.env["res.users"]
        if employee.user_id:
            recipients |= employee.user_id
        if self.assigned_reviewer_id:
            recipients |= self.assigned_reviewer_id
        if recipients:
            self._schedule_activity(
                recipients,
                _("Compliance request: %s") % self.name,
                note,
                cycle.due_date,
            )

    def assign_request_cycle_for_trigger(self, employee, trigger_kind):
        self.ensure_one()
        if not self._is_compliance_request():
            return self.env["doc.compliance.request.cycle"]
        if self.request_trigger != trigger_kind:
            return self.env["doc.compliance.request.cycle"]
        return self._create_request_cycle(employee, trigger_kind)

    def _tasks_needed_met(self, tasks):
        self.ensure_one()
        required = tasks.filtered(lambda t: t.requirement == "required")
        done_required = required.filtered(lambda t: t.status == "done")
        mode = self.tasks_needed_mode or "all_required"
        if mode == "all_required":
            return bool(required) and len(done_required) == len(required)
        if mode == "any_required":
            return bool(done_required)
        minimum = max(self.tasks_needed_minimum or 1, 1)
        return len(done_required) >= minimum

    def _sync_request_cycle_state(self, cycle):
        self.ensure_one()
        if not cycle or cycle.state != "open":
            return
        today = fields.Date.context_today(self)
        tasks = cycle.task_ids
        if self._tasks_needed_met(tasks):
            cycle.write(
                {
                    "state": "compliant",
                    "closed_at": fields.Datetime.now(),
                }
            )
            return
        pending = tasks.filtered(
            lambda t: t.status in ("todo", "waiting", "reopened")
            and t.requirement == "required"
        )
        if not pending and not self._tasks_needed_met(tasks):
            if today > cycle.grace_end_date:
                cycle.write(
                    {
                        "state": "non_compliant",
                        "closed_at": fields.Datetime.now(),
                    }
                )

    def _request_cycle_status_payload(self, cycle, exception):
        today = fields.Date.context_today(self)
        if exception:
            return {
                "compliance_status": "exempt",
                "status": "excepted",
                "reason_code": "exception",
                "reason_message": _("Exception until %s") % exception.valid_until,
            }
        if not cycle:
            return {
                "compliance_status": "at_risk",
                "status": "partial",
                "reason_code": "no_cycle",
                "reason_message": _("No active compliance request cycle."),
            }
        if cycle.state == "compliant":
            return {
                "compliance_status": "compliant",
                "status": "compliant",
                "reason_code": "satisfied",
                "reason_message": _("All required tasks completed."),
            }
        if cycle.state == "non_compliant":
            return {
                "compliance_status": "non_compliant",
                "status": "non_compliant",
                "reason_code": "overdue",
                "reason_message": _("Compliance request overdue."),
            }
        if cycle.state == "withdrawn":
            return {
                "compliance_status": "pending",
                "status": "partial",
                "reason_code": "withdrawn",
                "reason_message": _("Previous cycle withdrawn."),
            }
        open_tasks = cycle.task_ids.filtered(
            lambda t: t.status in ("todo", "waiting", "reopened")
        )
        if today <= cycle.due_date:
            msg = _("%s task(s) outstanding · due %s") % (len(open_tasks), cycle.due_date)
            return {
                "compliance_status": "at_risk",
                "status": "partial",
                "reason_code": "due_in_days",
                "reason_message": msg,
            }
        if today <= cycle.grace_end_date:
            return {
                "compliance_status": "at_risk",
                "status": "partial",
                "reason_code": "grace_remaining",
                "reason_message": _("Overdue · grace until %s") % cycle.grace_end_date,
            }
        cycle.write(
            {
                "state": "non_compliant",
                "closed_at": fields.Datetime.now(),
            }
        )
        return {
            "compliance_status": "non_compliant",
            "status": "non_compliant",
            "reason_code": "overdue",
            "reason_message": _("Past non-compliance point."),
        }

    def evaluate_compliance_request_employee(self, employee):
        self.ensure_one()
        today = fields.Date.context_today(self)
        if (
            not self.active
            or (self.effective_date and self.effective_date > today)
            or not self._applies_to_employee(employee)
        ):
            return self.env["doc.compliance.evaluation"]

        Evaluation = self._sudo_evaluation_env()
        evaluation = Evaluation.search(
            [("policy_id", "=", self.id), ("employee_id", "=", employee.id)],
            limit=1,
        )
        previous_status = evaluation.status if evaluation else False
        exception = self._active_exception_for_employee(employee, today=today)
        cycle = self._open_request_cycle(employee)
        if cycle:
            self._sync_request_cycle_state(cycle)
            cycle = self._open_request_cycle(employee) or cycle
        else:
            Cycle = self.env["doc.compliance.request.cycle"].sudo()
            cycle = Cycle.search(
                [
                    ("policy_id", "=", self.id),
                    ("employee_id", "=", employee.id),
                ],
                order="opened_at desc",
                limit=1,
            )
        values = {
            "policy_id": self.id,
            "employee_id": employee.id,
            "evaluated_at": fields.Datetime.now(),
            "exception_id": exception.id if exception else False,
            "line_ids": [fields.Command.clear()],
        }
        if evaluation:
            evaluation.write(values)
        else:
            evaluation = Evaluation.create(values)
        evaluation._compute_results()
        self.env["doc.compliance.notify"].sudo().notify_after_evaluation(
            self, employee, evaluation, previous_status
        )
        return evaluation

    def _resolve_linked_content_version(self, task):
        if task.linked_org_policy_id:
            policy = task.linked_org_policy_id
            if policy.lifecycle_status != "active" or not policy.active:
                return None, _("This content is unavailable. Contact HR.")
            version = policy.version_number or policy.write_date
            return str(version), None
        if task.linked_document_id:
            doc = task.linked_document_id
            if not doc.active or doc.deleted_at:
                return None, _("This content is unavailable. Contact HR.")
            version = doc.latest_version_number or doc.write_date
            return str(version), None
        return None, _("Linked content is not configured.")

    def complete_request_task(self, task, payload):
        """Complete a task instance on behalf of the current user's employee."""
        self.ensure_one()
        task = task.sudo()
        if task.policy_id != self:
            raise ValidationError(_("Task does not belong to this policy."))
        employee = self.env.user.employee_id
        if not employee or task.employee_id != employee:
            raise AccessError(_("You can only complete your own compliance tasks."))
        if task.status not in ("todo", "reopened"):
            raise ValidationError(_("This task is not open for completion."))
        if task.cycle_id and task.cycle_id.state != "open":
            raise ValidationError(_("This compliance cycle is closed."))

        task_type = task.task_type
        if task_type in ("read", "acknowledge"):
            version, error = self._resolve_linked_content_version(task)
            if error:
                self._notify_content_unavailable(task, error)
                raise ValidationError(error)
            task.write(
                {
                    "status": "done",
                    "content_version": version,
                    "acknowledged_version": version,
                    "completed_at": fields.Datetime.now(),
                }
            )
        elif task_type == "declaration":
            accepted = bool(payload.get("accepted"))
            if not accepted:
                raise ValidationError(_("You must accept the declaration."))
            issue = bool(payload.get("issue_declared"))
            task.write(
                {
                    "status": "done",
                    "declaration_comment": payload.get("comment") or "",
                    "declaration_issue_declared": issue,
                    "completed_at": fields.Datetime.now(),
                }
            )
            if issue and self.assigned_reviewer_id:
                self._schedule_activity(
                    self.assigned_reviewer_id,
                    _("Declaration issue reported"),
                    task.declaration_comment or task.title,
                    task.due_date,
                )
        elif task_type == "upload_evidence":
            document_id = int(payload.get("document_id") or 0)
            document = self.env["doc.document"].browse(document_id).exists()
            if not document or document.employee_id != employee:
                raise ValidationError(_("Upload a valid employee document."))
            if (
                task.evidence_document_type_id
                and document.document_type_id != task.evidence_document_type_id
            ):
                raise ValidationError(_("Document type does not match this task."))
            needs_verify = document.document_type_id.verification_required
            task.write(
                {
                    "document_id": document.id,
                    "status": "waiting" if needs_verify else "done",
                    "completed_at": fields.Datetime.now()
                    if not needs_verify
                    else False,
                }
            )
            self._maybe_queue_verification(employee, document)
        elif task_type == "complete_form":
            submission_id = int(payload.get("submission_id") or 0)
            submission = self.env["doc.template.submission"].browse(submission_id).exists()
            if not submission or submission.employee_id != employee:
                raise ValidationError(_("Submit the assigned form first."))
            if submission.state not in ("submitted", "approved"):
                raise ValidationError(_("Form must be submitted before completing this task."))
            task.write(
                {
                    "submission_id": submission.id,
                    "status": "done",
                    "completed_at": fields.Datetime.now(),
                }
            )
        else:
            raise ValidationError(_("Unsupported task type."))

        if task.cycle_id:
            self._sync_request_cycle_state(task.cycle_id)
        self.evaluate_compliance_request_employee(employee)
        return task

    def _notify_content_unavailable(self, task, message):
        owner = self.owner_id or self.assigned_reviewer_id
        if owner:
            self._schedule_activity(
                owner,
                _("Compliance content unavailable"),
                message,
                task.due_date,
            )

    def reopen_tasks_for_content(self, org_policy=None, document=None):
        if not self.reopen_on_content_change:
            return
        domain = [
            ("policy_id", "=", self.id),
            ("status", "in", ("done", "waiting")),
            ("cycle_id.state", "=", "open"),
        ]
        if org_policy:
            domain.append(("linked_org_policy_id", "=", org_policy.id))
        if document:
            domain.append(("linked_document_id", "=", document.id))
        tasks = self.env["doc.compliance.task"].sudo().search(domain)
        for task in tasks.filtered(lambda t: t.task_type in ("read", "acknowledge")):
            task.write(
                {
                    "status": "reopened",
                    "content_version": False,
                    "acknowledged_version": False,
                    "completed_at": False,
                }
            )
            if task.employee_id.user_id:
                self._schedule_activity(
                    task.employee_id.user_id,
                    _("Compliance task reopened"),
                    _(
                        "Linked content was updated. Please review and acknowledge again: %s"
                    )
                    % task.title,
                    task.due_date,
                )

    @api.model
    def _cron_compliance_request_triggers(self):
        today = fields.Date.context_today(self)
        policies = self.search(
            [
                ("active", "=", True),
                ("policy_type_id.code", "=", "compliance_request"),
            ]
        )
        for policy in policies:
            if policy.request_trigger == "specific_date":
                if policy.request_start_date == today:
                    for employee in policy._target_employees():
                        policy.assign_request_cycle_for_trigger(
                            employee, "specific_date"
                        )
            elif policy.request_trigger == "recurring":
                if not policy.request_start_date or policy.request_start_date > today:
                    continue
                if not policy.repeat_every_months:
                    continue
                months = policy.repeat_every_months
                anchor = policy.request_start_date
                if anchor > today:
                    continue
                delta = relativedelta(today, anchor)
                elapsed_months = delta.years * 12 + delta.months
                if elapsed_months < 0 or elapsed_months % months != 0:
                    continue
                if policy.last_request_cycle_at:
                    last = fields.Date.to_date(policy.last_request_cycle_at)
                    if last == today:
                        continue
                for employee in policy._target_employees():
                    policy.assign_request_cycle_for_trigger(employee, "recurring")
                policy.last_request_cycle_at = fields.Datetime.now()

    @api.model
    def _cron_compliance_request_reminders(self):
        today = fields.Date.context_today(self)
        Cycle = self.env["doc.compliance.request.cycle"].sudo()
        open_cycles = Cycle.search([("state", "=", "open")])
        for cycle in open_cycles:
            policy = cycle.policy_id
            if not policy.active or not policy._is_compliance_request():
                continue
            frequency = max(policy.reminder_frequency_days or 0, 0)
            if frequency <= 0:
                continue
            policy.evaluate_compliance_request_employee(cycle.employee_id)
            if cycle.state != "open":
                continue
            employee = cycle.employee_id
            note = _(
                "Reminder: %(policy)s — complete your tasks by %(due)s.",
                policy=policy.name,
                due=cycle.due_date,
            )
            if employee.user_id:
                policy._schedule_activity(
                    employee.user_id,
                    _("Compliance reminder"),
                    note,
                    cycle.due_date,
                )

    @api.model
    def _cron_compliance_request_joined_scope(self):
        policies = self.search(
            [
                ("active", "=", True),
                ("policy_type_id.code", "=", "compliance_request"),
                ("request_trigger", "=", "joined_scope"),
            ]
        )
        for policy in policies:
            for employee in policy._target_employees():
                Cycle = policy.env["doc.compliance.request.cycle"].sudo()
                existing = Cycle.search(
                    [
                        ("policy_id", "=", policy.id),
                        ("employee_id", "=", employee.id),
                    ],
                    limit=1,
                )
                if not existing:
                    policy.assign_request_cycle_for_trigger(employee, "joined_scope")

    def write(self, vals):
        activating = vals.get("active") is True
        res = super().write(vals)
        if activating:
            for policy in self.filtered(
                lambda item: item._is_compliance_request()
                and item.request_trigger == "policy_effective"
            ):
                for employee in policy._target_employees():
                    policy.assign_request_cycle_for_trigger(
                        employee, "policy_effective"
                    )
        return res

    @api.model
    def trigger_compliance_request_for_employees(self, employees, trigger_kind):
        policies = self.search(
            [
                ("active", "=", True),
                ("policy_type_id.code", "=", "compliance_request"),
                ("request_trigger", "=", trigger_kind),
            ]
        )
        for policy in policies:
            for employee in employees:
                policy.assign_request_cycle_for_trigger(employee, trigger_kind)
