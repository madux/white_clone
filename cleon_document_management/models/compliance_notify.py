import logging

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

    def _send_mail(self, users, subject, body_html):
        users = users.filtered(lambda user: user.email)
        if not users:
            return
        Mail = self.env["mail.mail"].sudo()
        for user in users:
            try:
                Mail.create({
                    "subject": subject,
                    "body_html": body_html,
                    "email_to": user.email,
                    "auto_delete": True,
                }).send()
            except Exception:
                _logger.exception("Compliance mail failed for %s", user.email)

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

    @api.model
    def notify_after_evaluation(self, policy, employee, evaluation, previous_status=False):
        if not evaluation or not policy.active:
            return
        code = policy.policy_type_id.code if policy.policy_type_id else ""
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
