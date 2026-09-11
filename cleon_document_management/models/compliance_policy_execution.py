import math
import random
from datetime import timedelta

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class ComplianceRenewalAlert(models.Model):
    _name = "doc.compliance.renewal.alert"
    _description = "Compliance Renewal Alert Log"
    _order = "sent_at desc"

    policy_id = fields.Many2one("doc.compliance.policy", required=True, ondelete="cascade", index=True)
    document_id = fields.Many2one("doc.document", required=True, ondelete="cascade", index=True)
    days_before = fields.Integer(required=True)
    sent_at = fields.Datetime(required=True, default=fields.Datetime.now)
    escalated_manager = fields.Boolean(default=False)
    escalated_hr = fields.Boolean(default=False)

    _sql_constraints = [
        (
            "policy_document_days_unique",
            "unique(policy_id, document_id, days_before)",
            "A renewal alert for this threshold was already sent.",
        ),
    ]


class ComplianceLifecycleRequest(models.Model):
    _name = "doc.compliance.lifecycle.request"
    _description = "Compliance Lifecycle Request"
    _order = "due_date asc, id desc"

    policy_id = fields.Many2one("doc.compliance.policy", required=True, ondelete="cascade", index=True)
    employee_id = fields.Many2one("hr.employee", required=True, ondelete="cascade", index=True)
    event_trigger = fields.Selection(
        [
            ("onboarding", "Onboarding"),
            ("promotion", "Promotion"),
            ("department_transfer", "Department Transfer"),
            ("location_change", "Location Change"),
            ("marital_status_change", "Marital Status Change"),
        ],
        required=True,
    )
    triggered_at = fields.Datetime(required=True, default=fields.Datetime.now)
    due_date = fields.Date(required=True, index=True)
    status = fields.Selection(
        [
            ("pending", "Pending"),
            ("fulfilled", "Fulfilled"),
            ("cancelled", "Cancelled"),
        ],
        default="pending",
        required=True,
        index=True,
    )
    last_reminder_at = fields.Datetime()
    fulfilled_at = fields.Datetime()

    _sql_constraints = [
        (
            "policy_employee_trigger_unique",
            "unique(policy_id, employee_id, event_trigger, triggered_at)",
            "This lifecycle request was already created.",
        ),
    ]


class CompliancePolicyExecution(models.Model):
    _inherit = "doc.compliance.policy"

    lifecycle_request_ids = fields.One2many(
        "doc.compliance.lifecycle.request",
        "policy_id",
        string="Lifecycle Requests",
    )
    renewal_alert_ids = fields.One2many(
        "doc.compliance.renewal.alert",
        "policy_id",
        string="Renewal Alerts",
    )
    last_audit_at = fields.Datetime(readonly=True)

    def _policy_type_code(self):
        self.ensure_one()
        return self.policy_type_id.code if self.policy_type_id else ""

    def _parse_alert_days(self):
        self.ensure_one()
        values = []
        for chunk in (self.alert_schedule_days or "").split(","):
            chunk = chunk.strip()
            if not chunk:
                continue
            try:
                values.append(int(chunk))
            except (TypeError, ValueError):
                continue
        return sorted(set(values), reverse=True)

    def _admin_users(self):
        group = self.env.ref(
            "cleon_document_management.group_document_admin",
            raise_if_not_found=False,
        )
        return group.users if group else self.env["res.users"]

    def _manager_user(self, employee):
        manager = employee.parent_id.user_id if employee.parent_id else False
        return manager if manager and manager.active else self.env["res.users"]

    def _schedule_activity(self, users, summary, note, deadline):
        activity_type = self.env.ref("mail.mail_activity_data_todo", raise_if_not_found=False)
        if not activity_type or not users:
            return
        for user in users:
            self.activity_schedule(
                activity_type_id=activity_type.id,
                user_id=user.id,
                date_deadline=deadline,
                summary=summary,
                note=note,
            )

    def _send_renewal_mail(self, users, subject, body_html):
        users = users.filtered(lambda user: user.email)
        if not users:
            return
        Mail = self.env["mail.mail"].sudo()
        for user in users:
            Mail.create({
                "subject": subject,
                "body_html": body_html,
                "email_to": user.email,
                "auto_delete": True,
            }).send()

    def _documents_due_for_renewal(self, employee, today):
        self.ensure_one()
        if not self.document_type_ids:
            return self.env["doc.document"]
        return self.env["doc.document"].sudo().search([
            ("employee_id", "=", employee.id),
            ("document_type_id", "in", self.document_type_ids.ids),
            ("active", "=", True),
            ("deleted_at", "=", False),
            ("has_expiry", "=", True),
            ("expiry_date", "!=", False),
            ("expiry_date", ">=", today),
            ("state", "in", ["approved", "signed"]),
        ])

    def _process_renewal_alerts_for_employee(self, employee, today):
        self.ensure_one()
        RenewalAlert = self.env["doc.compliance.renewal.alert"].sudo()
        activity_type = self.env.ref("mail.mail_activity_data_todo", raise_if_not_found=False)
        for document in self._documents_due_for_renewal(employee, today):
            days_before = (document.expiry_date - today).days
            for threshold in self._parse_alert_days():
                if days_before != threshold:
                    continue
                existing = RenewalAlert.search([
                    ("policy_id", "=", self.id),
                    ("document_id", "=", document.id),
                    ("days_before", "=", threshold),
                ], limit=1)
                if existing:
                    continue
                note = _(
                    "%(document)s for %(employee)s expires on %(date)s (%(days)s days remaining).",
                    document=document.name,
                    employee=employee.name,
                    date=document.expiry_date,
                    days=days_before,
                )
                recipients = self.env["res.users"]
                employee_user = employee.user_id
                if employee_user:
                    recipients |= employee_user
                alert_vals = {
                    "policy_id": self.id,
                    "document_id": document.id,
                    "days_before": threshold,
                }
                if self.escalate_manager_days and days_before <= self.escalate_manager_days:
                    manager = self._manager_user(employee)
                    if manager:
                        recipients |= manager
                        alert_vals["escalated_manager"] = True
                if self.escalate_hr_days and days_before <= self.escalate_hr_days:
                    recipients |= self._admin_users()
                    alert_vals["escalated_hr"] = True
                self._send_renewal_mail(
                    recipients,
                    _("Document renewal alert: %s") % document.name,
                    "<p>%s</p>" % note,
                )
                if self.auto_request_renewal and activity_type and employee_user:
                    document.activity_schedule(
                        activity_type_id=activity_type.id,
                        user_id=employee_user.id,
                        date_deadline=document.expiry_date,
                        summary=_("Renew document before expiry"),
                        note=note,
                    )
                RenewalAlert.create(alert_vals)

    @api.model
    def _cron_renewal_alerts(self):
        today = fields.Date.context_today(self)
        policies = self.search([
            ("active", "=", True),
            ("policy_type_id.code", "=", "renewable_document"),
        ])
        for policy in policies:
            for employee in policy._target_employees():
                policy._process_renewal_alerts_for_employee(employee, today)

    def _create_lifecycle_request(self, employee, event_trigger, triggered_at=None):
        self.ensure_one()
        if self._policy_type_code() != "compliance_request":
            return self.env["doc.compliance.lifecycle.request"]
        if not self.event_trigger or self.event_trigger != event_trigger:
            return self.env["doc.compliance.lifecycle.request"]
        if not self._applies_to_employee(employee):
            return self.env["doc.compliance.lifecycle.request"]
        triggered_at = triggered_at or fields.Datetime.now()
        due_days = max(self.due_days or 0, 0)
        due_date = fields.Date.to_date(triggered_at) + timedelta(days=due_days)
        Request = self.env["doc.compliance.lifecycle.request"].sudo()
        existing = Request.search([
            ("policy_id", "=", self.id),
            ("employee_id", "=", employee.id),
            ("event_trigger", "=", event_trigger),
            ("status", "=", "pending"),
        ], limit=1)
        if existing:
            return existing
        request = Request.create({
            "policy_id": self.id,
            "employee_id": employee.id,
            "event_trigger": event_trigger,
            "triggered_at": triggered_at,
            "due_date": due_date,
        })
        note = _(
            "Collect documents for %(policy)s following %(event)s. Due by %(due)s.",
            policy=self.name,
            event=dict(request._fields["event_trigger"].selection).get(event_trigger, event_trigger),
            due=due_date,
        )
        recipients = self.env["res.users"]
        if employee.user_id:
            recipients |= employee.user_id
        if self.assigned_reviewer_id:
            recipients |= self.assigned_reviewer_id
        self._send_renewal_mail(
            recipients,
            _("Compliance request: %s") % self.name,
            "<p>%s</p>" % note,
        )
        self._schedule_activity(
            recipients,
            _("Compliance document request"),
            note,
            due_date,
        )
        self.evaluate_employee(employee)
        return request

    @api.model
    def _trigger_lifecycle_event(self, employees, event_trigger):
        policies = self.search([
            ("active", "=", True),
            ("policy_type_id.code", "=", "compliance_request"),
            ("event_trigger", "=", event_trigger),
        ])
        for policy in policies:
            for employee in employees:
                policy._create_lifecycle_request(employee, event_trigger)

    @api.model
    def _cron_lifecycle_reminders(self):
        today = fields.Date.context_today(self)
        Request = self.env["doc.compliance.lifecycle.request"].sudo()
        pending = Request.search([("status", "=", "pending")])
        for request in pending:
            policy = request.policy_id
            if not policy.active:
                continue
            frequency = max(policy.reminder_frequency_days or 0, 1)
            if request.last_reminder_at:
                next_reminder = fields.Datetime.to_datetime(request.last_reminder_at) + timedelta(days=frequency)
                if next_reminder > fields.Datetime.now():
                    continue
            evaluation = policy.evaluate_employee(request.employee_id)
            if evaluation.status == "compliant":
                request.write({
                    "status": "fulfilled",
                    "fulfilled_at": fields.Datetime.now(),
                })
                self.env["doc.compliance.notify"].sudo().notify_lifecycle_fulfilled(
                    policy, request.employee_id
                )
                continue
            overdue = request.due_date < today
            note = _(
                "Reminder: %(policy)s is still outstanding for %(employee)s. Due %(due)s.",
                policy=policy.name,
                employee=request.employee_id.name,
                due=request.due_date,
            )
            recipients = self.env["res.users"]
            employee_user = request.employee_id.user_id
            if employee_user:
                recipients |= employee_user
            if policy.assigned_reviewer_id:
                recipients |= policy.assigned_reviewer_id
            if overdue:
                recipients |= policy._admin_users()
            policy._send_renewal_mail(
                recipients,
                _("Compliance reminder: %s") % policy.name,
                "<p>%s</p>" % note,
            )
            policy._schedule_activity(
                recipients,
                _("Compliance reminder"),
                note,
                request.due_date,
            )
            request.last_reminder_at = fields.Datetime.now()

    def _audit_frequency_delta(self):
        self.ensure_one()
        return {
            "monthly": relativedelta(months=1),
            "quarterly": relativedelta(months=3),
            "semi_annually": relativedelta(months=6),
            "annually": relativedelta(years=1),
        }.get(self.audit_frequency)

    def _run_retention_audit(self):
        self.ensure_one()
        if self._policy_type_code() != "retention":
            return self.env["doc.compliance.evaluation.run"]
        employees = self._target_employees()
        if not employees:
            return self.env["doc.compliance.evaluation.run"]
        sample_pct = min(max(self.sample_pct or 100, 1), 100)
        sample_size = max(1, int(math.ceil(len(employees) * sample_pct / 100.0)))
        sampled = employees
        if sample_size < len(employees):
            sampled = self.env["hr.employee"].browse(
                random.sample(employees.ids, sample_size)
            )
        run = self.env["doc.compliance.evaluation.run"].sudo().create({
            "policy_id": self.id,
            "run_type": "audit",
            "evaluated_at": fields.Datetime.now(),
        })
        Evaluation = self._sudo_evaluation_env()
        for employee in sampled:
            self.evaluate_employee(employee)
        evaluations = Evaluation.search([("policy_id", "=", self.id), ("employee_id", "in", sampled.ids)])
        run.write({
            "employee_count": len(evaluations),
            "compliant_count": len(evaluations.filtered(lambda item: item.status == "compliant")),
            "partial_count": len(evaluations.filtered(lambda item: item.status in ("partial", "grace"))),
            "non_compliant_count": len(evaluations.filtered(lambda item: item.status == "non_compliant")),
            "excepted_count": len(evaluations.filtered(lambda item: item.status == "excepted")),
        })
        self.last_audit_at = run.evaluated_at
        self.env["doc.compliance.notify"].sudo().notify_retention_audit_gaps(
            self, run, sampled
        )
        if self.assigned_auditor_id:
            note = _(
                "Retention audit completed for %(policy)s. Sampled %(count)s employees.",
                policy=self.name,
                count=len(sampled),
            )
            self._schedule_activity(
                self.assigned_auditor_id,
                _("Retention audit completed"),
                note,
                fields.Date.context_today(self),
            )
        return run

    @api.model
    def _cron_retention_audits(self):
        now = fields.Datetime.now()
        policies = self.search([
            ("active", "=", True),
            ("policy_type_id.code", "=", "retention"),
        ])
        for policy in policies:
            delta = policy._audit_frequency_delta()
            if not delta:
                continue
            if policy.last_audit_at and policy.last_audit_at + delta > now:
                continue
            policy._run_retention_audit()
