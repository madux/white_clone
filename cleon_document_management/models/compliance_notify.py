import logging
from datetime import timedelta

from odoo import _, api, fields, models

_logger = logging.getLogger(__name__)


class ComplianceNotificationLog(models.Model):
    _name = "doc.compliance.notification.log"
    _description = "Compliance Notification Log"
    _order = "sent_at desc"

    policy_id = fields.Many2one("doc.compliance.policy", required=True, ondelete="cascade", index=True)
    employee_id = fields.Many2one("hr.employee", ondelete="cascade", index=True)
    notification_kind = fields.Char(required=True, index=True)
    reference_date = fields.Date(required=True, index=True)
    sent_at = fields.Datetime(required=True, default=fields.Datetime.now)

    _sql_constraints = [
        (
            "policy_employee_kind_date_unique",
            "unique(policy_id, employee_id, notification_kind, reference_date)",
            "This notification was already sent today.",
        ),
    ]


class ComplianceNotify(models.AbstractModel):
    _name = "doc.compliance.notify"
    _description = "Compliance Notification Helpers"

    def _admin_users(self):
        group = self.env.ref(
            "cleon_document_management.group_document_admin",
            raise_if_not_found=False,
        )
        return group.users if group else self.env["res.users"]

    def _already_sent(self, policy, employee, notification_kind, reference_date):
        domain = [
            ("policy_id", "=", policy.id),
            ("notification_kind", "=", notification_kind),
            ("reference_date", "=", reference_date),
        ]
        if employee:
            domain.append(("employee_id", "=", employee.id))
        else:
            domain.append(("employee_id", "=", False))
        return bool(self.env["doc.compliance.notification.log"].sudo().search(domain, limit=1))

    def _log_sent(self, policy, employee, notification_kind, reference_date):
        self.env["doc.compliance.notification.log"].sudo().create({
            "policy_id": policy.id,
            "employee_id": employee.id if employee else False,
            "notification_kind": notification_kind,
            "reference_date": reference_date,
        })

    def _days_since_last_kind(self, policy, employee, notification_kind):
        log = self.env["doc.compliance.notification.log"].sudo().search(
            [
                ("policy_id", "=", policy.id),
                ("employee_id", "=", employee.id),
                ("notification_kind", "=", notification_kind),
            ],
            order="reference_date desc, id desc",
            limit=1,
        )
        if not log:
            return None
        today = fields.Date.context_today(self)
        return (today - log.reference_date).days

    def _request_oversight_recipients(self, policy, employee, severe=False):
        recipients = self.env["res.users"]
        if employee.user_id:
            recipients |= employee.user_id
        if policy.assigned_reviewer_id:
            recipients |= policy.assigned_reviewer_id
        if severe:
            recipients |= self._admin_users()
        return recipients.filtered(lambda user: user.active)

    def _outstanding_request_task_summary(self, cycle):
        tasks = cycle.task_ids.filtered(
            lambda task: task.status in ("todo", "waiting", "reopened")
        )
        titles = ", ".join(tasks.mapped("title"))
        return titles or _("required tasks")

    def _deliver_request_notice(
        self,
        policy,
        employee,
        cycle,
        kind,
        reference_date,
        subject,
        note,
        activity_summary=None,
        severe=False,
    ):
        if self._already_sent(policy, employee, kind, reference_date):
            return
        recipients = self._request_oversight_recipients(policy, employee, severe=severe)
        if not recipients:
            return
        deadline = cycle.due_date if cycle else fields.Date.context_today(self)
        self._send_mail(
            recipients,
            subject,
            "<p>%s</p>" % note,
            dedupe_key="compliance-request:%s:%s:%s"
            % (kind, policy.id, employee.id),
        )
        if activity_summary:
            policy._schedule_activity(
                recipients,
                activity_summary,
                note,
                deadline,
            )
        self._log_sent(policy, employee, kind, reference_date)

    @api.model
    def notify_compliance_request_after_evaluation(
        self, policy, employee, evaluation, previous_status=False
    ):
        if not policy.active or not employee or not evaluation:
            return
        cycle = policy._open_request_cycle(employee)
        if not cycle:
            Cycle = self.env["doc.compliance.request.cycle"].sudo()
            cycle = Cycle.search(
                [
                    ("policy_id", "=", policy.id),
                    ("employee_id", "=", employee.id),
                ],
                order="opened_at desc",
                limit=1,
            )
        if not cycle:
            return

        today = fields.Date.context_today(self)
        status = evaluation.status
        reason = evaluation.reason_code or ""

        if status == "non_compliant":
            if previous_status != "non_compliant":
                note = _(
                    "%(employee)s is non-compliant for %(policy)s. "
                    "Tasks were not completed before the grace period ended (%(grace)s).",
                    employee=employee.name,
                    policy=policy.name,
                    grace=cycle.grace_end_date,
                )
                self._deliver_request_notice(
                    policy,
                    employee,
                    cycle,
                    "request_non_compliant",
                    today,
                    _("Compliance request failed: %s") % policy.name,
                    note,
                    activity_summary=_("Compliance request non-compliant"),
                    severe=True,
                )
            return

        if cycle.state != "open":
            return

        if reason == "grace_remaining":
            grace_start = cycle.due_date + timedelta(days=1)
            note = _(
                "%(employee)s is past the due date for %(policy)s. "
                "Grace period ends %(grace)s. Outstanding: %(tasks)s.",
                employee=employee.name,
                policy=policy.name,
                grace=cycle.grace_end_date,
                tasks=self._outstanding_request_task_summary(cycle),
            )
            self._deliver_request_notice(
                policy,
                employee,
                cycle,
                "request_grace_escalation",
                grace_start,
                _("Compliance grace period: %s") % policy.name,
                note,
                activity_summary=_("Compliance request in grace period"),
            )
            return

        escalate_days = max(policy.escalate_hr_days or 0, 0)
        if (
            escalate_days
            and reason == "due_in_days"
            and today <= cycle.due_date
        ):
            days_left = (cycle.due_date - today).days
            if 0 <= days_left <= escalate_days:
                note = _(
                    "%(employee)s has %(days)s day(s) to complete %(policy)s "
                    "(due %(due)s). Outstanding: %(tasks)s.",
                    employee=employee.name,
                    days=days_left,
                    policy=policy.name,
                    due=cycle.due_date,
                    tasks=self._outstanding_request_task_summary(cycle),
                )
                self._deliver_request_notice(
                    policy,
                    employee,
                    cycle,
                    "request_hr_due_soon",
                    cycle.due_date,
                    _("Compliance due soon: %s") % policy.name,
                    note,
                    activity_summary=_("Compliance request due soon"),
                )

        if status == "partial" and reason == "due_in_days":
            frequency = max(policy.reminder_frequency_days or 0, 0)
            min_gap = frequency if frequency > 0 else 1
            since = self._days_since_last_kind(
                policy, employee, "request_tasks_outstanding"
            )
            if since is not None and since < min_gap:
                return
            note = _(
                "%(employee)s still has open tasks for %(policy)s (due %(due)s): %(tasks)s.",
                employee=employee.name,
                policy=policy.name,
                due=cycle.due_date,
                tasks=self._outstanding_request_task_summary(cycle),
            )
            self._deliver_request_notice(
                policy,
                employee,
                cycle,
                "request_tasks_outstanding",
                today,
                _("Compliance tasks outstanding: %s") % policy.name,
                note,
                activity_summary=_("Compliance tasks outstanding"),
            )

    @api.model
    def notify_request_cycle_non_compliant(self, policy, cycle):
        employee = cycle.employee_id
        if not employee:
            return
        today = fields.Date.context_today(self)
        note = _(
            "%(employee)s is non-compliant for %(policy)s. "
            "The grace period ended on %(grace)s. Outstanding: %(tasks)s.",
            employee=employee.name,
            policy=policy.name,
            grace=cycle.grace_end_date,
            tasks=self._outstanding_request_task_summary(cycle),
        )
        self._deliver_request_notice(
            policy,
            employee,
            cycle,
            "request_non_compliant",
            today,
            _("Compliance request failed: %s") % policy.name,
            note,
            activity_summary=_("Compliance request non-compliant"),
            severe=True,
        )

    @api.model
    def notify_request_cycle_reminder(self, policy, cycle):
        employee = cycle.employee_id
        if not employee or cycle.state != "open":
            return
        frequency = max(policy.reminder_frequency_days or 0, 0)
        if frequency <= 0:
            return
        now = fields.Datetime.now()
        if cycle.last_reminder_at:
            next_allowed = fields.Datetime.to_datetime(cycle.last_reminder_at) + timedelta(
                days=frequency
            )
            if now < next_allowed:
                return
        today = fields.Date.context_today(self)
        note = _(
            "Reminder: %(policy)s — complete tasks by %(due)s. Outstanding: %(tasks)s.",
            policy=policy.name,
            due=cycle.due_date,
            tasks=self._outstanding_request_task_summary(cycle),
        )
        self._deliver_request_notice(
            policy,
            employee,
            cycle,
            "request_reminder",
            today,
            _("Compliance reminder: %s") % policy.name,
            note,
            activity_summary=_("Compliance reminder"),
        )
        cycle.sudo().write({"last_reminder_at": now})

    def _send_mail(self, users, subject, body_html, dedupe_key=None):
        users = users.filtered(lambda user: user.active)
        if not users:
            return
        import re

        notify = self.env["doc.notification.service"]
        body_text = re.sub(r"<[^>]+>", "", body_html or subject or "")
        for user in users:
            key = dedupe_key
            if key:
                key = "%s:%s" % (key, user.id)
            notify.notify(
                "compliance.policy_reminder",
                subject,
                {
                    "title": subject,
                    "body": body_text,
                    "owner_user_id": user.id,
                },
                dedupe_key=key,
            )

    def _schedule_activity(self, record, users, summary, note, deadline):
        activity_type = self.env.ref("mail.mail_activity_data_todo", raise_if_not_found=False)
        if not activity_type or not users or not record:
            return
        for user in users:
            record.activity_schedule(
                activity_type_id=activity_type.id,
                user_id=user.id,
                date_deadline=deadline,
                summary=summary,
                note=note,
            )

    def _notify_sms_if_available(self, employee, message):
        phone = employee.mobile_phone or employee.work_phone
        if not phone:
            return
        Sms = self.env.get("sms.sms")
        if not Sms:
            _logger.info(
                "Compliance SMS skipped for %s (no sms module): %s",
                employee.name,
                message,
            )
            return
        try:
            Sms.create({"number": phone, "body": message}).send()
        except Exception:
            _logger.exception("Compliance SMS failed for employee %s", employee.id)

    @api.model
    def notify_employee_action_required(self, policy, employee, evaluation):
        """Notify employee (portal) or HR (no portal) that compliance action is needed."""
        if not evaluation or not policy.active or not employee:
            return
        today = fields.Date.context_today(self)
        kind = "employee_action_required"
        if self._already_sent(policy, employee, kind, today):
            return
        actionable = evaluation.line_ids.filtered(
            lambda line: line.reason_code == "rejected"
            or (
                line.status in ("missing", "grace")
                and line.compliance_status not in ("pending", "compliant", "exempt")
            )
        )
        if not actionable:
            return
        missing_names = ", ".join(
            actionable.mapped("document_type_id.name") or actionable.mapped("requirement_id.name")
        )
        note = _(
            "Action needed for %(policy)s: %(items)s",
            policy=policy.name,
            items=missing_names or _("required items"),
        )
        if employee.has_compliance_portal_access() and employee.user_id:
            self._send_mail(
                employee.user_id,
                _("Compliance action needed: %s") % policy.name,
                "<p>%s</p><p>Open My Compliance in CleanHR Document Management.</p>"
                % note,
            )
        else:
            recipients = self._admin_users()
            if policy.assigned_reviewer_id:
                recipients |= policy.assigned_reviewer_id
            self._send_mail(
                recipients,
                _("Submit compliance documents for %s") % employee.name,
                "<p>%(employee)s does not have portal access. Please submit on their behalf.</p><p>%(note)s</p>"
                % {"employee": employee.name, "note": note},
            )
            self._notify_sms_if_available(
                employee,
                _("HR action needed: compliance documents for %s.") % employee.name,
            )
        self._log_sent(policy, employee, kind, today)

    @api.model
    def notify_after_evaluation(self, policy, employee, evaluation, previous_status=False):
        if not evaluation or not policy.active:
            return
        self.notify_employee_action_required(policy, employee, evaluation)
        code = policy.policy_type_id.code if policy.policy_type_id else ""
        if code == "compliance_request":
            self.notify_compliance_request_after_evaluation(
                policy, employee, evaluation, previous_status
            )
            return
        if code != "document_requirement":
            return
        today = fields.Date.context_today(self)
        status = evaluation.status
        if status in ("partial",) and evaluation.grace_count:
            kind = "requirement_grace"
            if self._already_sent(policy, employee, kind, today):
                return
            note = _(
                "You have documents still within the grace period for %(policy)s.",
                policy=policy.name,
            )
            recipients = employee.user_id if employee.user_id else self.env["res.users"]
            self._send_mail(recipients, _("Grace period reminder: %s") % policy.name, "<p>%s</p>" % note)
            self._log_sent(policy, employee, kind, today)
            return

        if status in ("non_compliant", "partial") and evaluation.missing_count:
            kind = "requirement_missing"
            if self._already_sent(policy, employee, kind, today) and status == previous_status:
                return
            missing_types = evaluation.line_ids.filtered(
                lambda line: line.status == "missing"
            ).mapped("document_type_id.name")
            note = _(
                "Missing documents for %(policy)s: %(types)s",
                policy=policy.name,
                types=", ".join(missing_types) or _("required items"),
            )
            recipients = self.env["res.users"]
            if employee.user_id:
                recipients |= employee.user_id
            recipients |= self._admin_users()
            self._send_mail(
                recipients,
                _("Missing documents: %s") % policy.name,
                "<p>%s</p>" % note,
            )
            self._log_sent(policy, employee, kind, today)

    @api.model
    def notify_lifecycle_fulfilled(self, policy, employee):
        today = fields.Date.context_today(self)
        kind = "lifecycle_fulfilled"
        if self._already_sent(policy, employee, kind, today):
            return
        note = _("Your documents for %(policy)s are now complete. Thank you.") % {
            "policy": policy.name,
        }
        if employee.user_id:
            self._send_mail(
                employee.user_id,
                _("Compliance complete: %s") % policy.name,
                "<p>%s</p>" % note,
            )
        self._log_sent(policy, employee, kind, today)

    @api.model
    def notify_manual_request(self, policy, employee, subject, body_html, due_date):
        today = fields.Date.context_today(self)
        kind = "manual_request"
        recipients = employee.user_id if employee.user_id else self.env["res.users"]
        if not recipients:
            return
        self._send_mail(recipients, subject, body_html)
        self._log_sent(policy, employee, kind, today)
        if due_date:
            self._schedule_activity(
                policy,
                recipients,
                _("Compliance request: %s") % policy.name,
                _("Please submit the requested documents by %s.") % due_date,
                due_date,
            )

    @api.model
    def notify_retention_audit_gaps(self, policy, run, sampled_employees):
        today = fields.Date.context_today(self)
        kind = "retention_audit_gaps"
        if self._already_sent(policy, False, kind, today):
            return
        if not run.non_compliant_count and not run.partial_count:
            return
        note = _(
            "Review audit for %(policy)s found %(non_compliant)s non-compliant and "
            "%(partial)s partial results from %(count)s sampled employees.",
            policy=policy.name,
            non_compliant=run.non_compliant_count,
            partial=run.partial_count,
            count=run.employee_count,
        )
        recipients = self._admin_users()
        if policy.assigned_auditor_id:
            recipients |= policy.assigned_auditor_id
        self._send_mail(
            recipients,
            _("Review audit gaps: %s") % policy.name,
            "<p>%s</p>" % note,
        )
        self._log_sent(policy, False, kind, today)
