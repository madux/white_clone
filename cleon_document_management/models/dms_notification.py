# -*- coding: utf-8 -*-
import logging
from datetime import datetime, timedelta

from odoo import _, api, fields, models

from .notification_catalog import PREFERENCE_GROUPS

_logger = logging.getLogger(__name__)

INBOX_RETENTION_DAYS = 90
MAX_EMAIL_RETRIES = 3


class DocNotificationRule(models.Model):
    _name = "doc.notification.rule"
    _description = "DMS notification rule (C4)"
    _order = "sequence, id"

    name = fields.Char(required=True)
    event_type = fields.Char(required=True, index=True)
    event_label = fields.Char()
    module = fields.Selection(
        [
            ("employee_files", "Employee Files"),
            ("organizational_files", "Organisational Files"),
            ("templates_forms", "Templates & Forms"),
            ("signatures", "Signatures"),
            ("approvals", "Approvals"),
            ("alerts", "Triggers & Alerts"),
            ("document_intelligence", "Document Intelligence"),
            ("platform", "Platform"),
            ("compliance", "Compliance"),
        ],
        index=True,
    )
    who_is_told = fields.Char()
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    channel_in_app = fields.Boolean(default=True)
    channel_email = fields.Boolean(default=False)
    required = fields.Boolean(
        default=False,
        help="Required events cannot be turned off by non–super-admins.",
    )
    timing = fields.Selection(
        [
            ("immediate", "Immediate"),
            ("digest", "Daily digest"),
            ("critical_immediate", "Critical (immediate)"),
        ],
        default="immediate",
        required=True,
    )
    preference_group = fields.Char(index=True)
    compliance_read_only = fields.Boolean(default=False)
    is_customized = fields.Boolean(
        default=False,
        help="When set, post-init seed will not overwrite this rule.",
    )
    recipient_mode = fields.Selection(
        [
            ("actor", "Actor"),
            ("owner", "Record owner"),
            ("approvers", "Approvers"),
            ("custom_users", "Specific users"),
            ("hr_admins", "HR Admins"),
            ("line_manager", "Line manager"),
            ("employee_subject", "Employee (subject)"),
            ("ef_stakeholders", "Employee, manager, HR"),
        ],
        default="owner",
        required=True,
    )
    recipient_config = fields.Text(default="{}")
    user_ids = fields.Many2many("res.users", string="Recipients")
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )

    _sql_constraints = [
        (
            "event_type_company_unique",
            "unique(event_type, company_id)",
            "Each notification event can only be configured once per company.",
        ),
    ]

    def serialize_for_api(self):
        self.ensure_one()
        return {
            "id": self.id,
            "name": self.name,
            "event_type": self.event_type,
            "event_label": self.event_label or self.name,
            "module": self.module or "",
            "who_is_told": self.who_is_told or "",
            "active": self.active,
            "channel_in_app": self.channel_in_app,
            "channel_email": self.channel_email,
            "required": self.required,
            "timing": self.timing,
            "preference_group": self.preference_group or "",
            "compliance_read_only": self.compliance_read_only,
            "recipient_mode": self.recipient_mode,
            "user_ids": self.user_ids.ids,
            "sequence": self.sequence,
        }


class DocNotificationUserPreference(models.Model):
    _name = "doc.notification.user.preference"
    _description = "Per-user notification email preferences"
    _rec_name = "user_id"

    user_id = fields.Many2one(
        "res.users", required=True, ondelete="cascade", index=True
    )
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    digest_enabled = fields.Boolean(default=False)
    email_signatures = fields.Boolean(default=True)
    email_documents = fields.Boolean(default=True)
    email_approvals = fields.Boolean(default=True)
    email_organizational = fields.Boolean(default=True)
    email_templates = fields.Boolean(default=True)
    email_compliance = fields.Boolean(default=True)
    email_alerts = fields.Boolean(default=True)
    email_platform = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "user_company_unique",
            "unique(user_id, company_id)",
            "One preference row per user and company.",
        ),
    ]

    _GROUP_FIELD_MAP = {
        "signatures": "email_signatures",
        "documents": "email_documents",
        "approvals": "email_approvals",
        "organizational": "email_organizational",
        "templates": "email_templates",
        "compliance": "email_compliance",
        "alerts": "email_alerts",
        "platform": "email_platform",
    }

    @api.model
    def _required_groups(self):
        return {code for code, _label, locked in PREFERENCE_GROUPS if locked}

    @api.model
    def get_or_create_for_user(self, user=None):
        user = user or self.env.user
        pref = self.sudo().search(
            [("user_id", "=", user.id), ("company_id", "=", user.company_id.id)],
            limit=1,
        )
        if not pref:
            pref = self.sudo().create(
                {"user_id": user.id, "company_id": user.company_id.id}
            )
        return pref

    def serialize_for_api(self):
        self.ensure_one()
        locked = self._required_groups()
        groups = []
        for code, label, req in PREFERENCE_GROUPS:
            field_name = self._GROUP_FIELD_MAP.get(code)
            enabled = bool(getattr(self, field_name, True)) if field_name else True
            groups.append(
                {
                    "code": code,
                    "label": label,
                    "email_enabled": enabled,
                    "locked": req or code in locked,
                }
            )
        return {
            "digest_enabled": self.digest_enabled,
            "groups": groups,
        }

    def email_allowed_for_group(self, group_code):
        self.ensure_one()
        if group_code in self._required_groups():
            return True
        field_name = self._GROUP_FIELD_MAP.get(group_code or "")
        if not field_name:
            return True
        return bool(getattr(self, field_name, True))


class DocNotification(models.Model):
    _name = "doc.notification"
    _description = "In-app notification (C4)"
    _order = "create_date desc, id desc"

    user_id = fields.Many2one("res.users", required=True, index=True, ondelete="cascade")
    title = fields.Char(required=True)
    body = fields.Text()
    event_type = fields.Char(index=True)
    res_model = fields.Char(index=True)
    res_id = fields.Integer(index=True)
    href = fields.Char()
    dedupe_key = fields.Char(index=True)
    read_at = fields.Datetime()
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )

    def serialize_for_api(self):
        self.ensure_one()
        href = self.href or self.env[
            "doc.notification.service"
        ]._resolve_href(self.res_model, self.res_id)
        return {
            "id": self.id,
            "title": self.title,
            "body": self.body or "",
            "event_type": self.event_type or "",
            "res_model": self.res_model or "",
            "res_id": self.res_id or 0,
            "href": href or "",
            "read_at": fields.Datetime.to_string(self.read_at) if self.read_at else False,
            "created_at": fields.Datetime.to_string(self.create_date),
        }

    @api.model
    def _cron_purge_old_notifications(self):
        cutoff = fields.Datetime.now() - timedelta(days=INBOX_RETENTION_DAYS)
        old = self.sudo().search([("create_date", "<", cutoff)])
        if old:
            old.unlink()

    @api.model
    def _cron_retry_failed_emails(self):
        return self.env["doc.notification.service"]._cron_retry_failed_emails()

    @api.model
    def _cron_send_digest_emails(self):
        return self.env["doc.notification.service"]._cron_send_digest_emails()


class DocNotificationDelivery(models.Model):
    _name = "doc.notification.delivery"
    _description = "Notification delivery log (C4)"
    _order = "create_date desc, id desc"

    notification_id = fields.Many2one("doc.notification", ondelete="set null")
    event_type = fields.Char(index=True)
    recipient_id = fields.Many2one("res.users", required=True, index=True)
    channel = fields.Selection(
        [("in_app", "In-app"), ("email", "Email")], required=True, default="in_app"
    )
    state = fields.Selection(
        [
            ("pending", "Pending"),
            ("sent", "Sent"),
            ("delivered", "Delivered"),
            ("failed", "Failed"),
            ("skipped", "Skipped"),
        ],
        default="pending",
        required=True,
        index=True,
    )
    subject = fields.Char()
    body_html = fields.Text()
    scheduled_at = fields.Datetime(index=True)
    error_message = fields.Text()
    skip_reason = fields.Char()
    retry_count = fields.Integer(default=0)
    dedupe_key = fields.Char(index=True)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )

    def serialize_for_api(self):
        self.ensure_one()
        return {
            "id": self.id,
            "event_type": self.event_type or "",
            "recipient_name": self.recipient_id.name,
            "recipient_id": self.recipient_id.id,
            "channel": self.channel,
            "state": self.state,
            "created_at": fields.Datetime.to_string(self.create_date),
            "error_message": self.error_message or "",
            "skip_reason": self.skip_reason or "",
        }


class DocNotificationService(models.AbstractModel):
    _name = "doc.notification.service"
    _description = "Platform notification dispatch (C4)"

    @api.model
    def dispatch(self, event_type, payload=None, dedupe_key=None):
        """Backward-compatible alias for notify()."""
        payload = payload or {}
        subject = payload.get("title") or event_type.replace(".", " ").title()
        return self.notify(event_type, subject, payload, dedupe_key=dedupe_key)

    @api.model
    def notify(self, event_type, subject, context=None, dedupe_key=None):
        context = dict(context or {})
        try:
            rules = self.env["doc.notification.rule"].sudo().search(
                [
                    ("active", "=", True),
                    ("event_type", "=", event_type),
                    ("company_id", "=", self.env.company.id),
                ],
                limit=1,
            )
            if not rules:
                _logger.info("Notification skipped (no rule): %s", event_type)
                return {"created": 0, "skipped": "no_rule"}
            rule = rules[0]
            if not rule.channel_in_app and not rule.channel_email:
                return {"created": 0, "skipped": "channels_off"}

            payload = context
            payload.setdefault("title", subject)
            user_ids = self._resolve_recipients(rule, payload)
            if not user_ids:
                return {"created": 0, "skipped": "no_recipients"}

            title = payload.get("title") or subject
            body = payload.get("body") or ""
            res_model = payload.get("res_model") or ""
            res_id = int(payload.get("res_id") or 0)
            href = payload.get("href") or self._resolve_href(res_model, res_id)
            item_dedupe = dedupe_key or self._default_dedupe_key(
                event_type, res_model, res_id
            )

            Notification = self.env["doc.notification"].sudo()
            Delivery = self.env["doc.notification.delivery"].sudo()
            created = 0
            delivery_ids = []
            today_start = self._today_start_datetime()

            for user_id in user_ids:
                user = self.env["res.users"].sudo().browse(user_id)
                if not user.exists():
                    continue
                if res_model and res_id and not self._user_can_access_record(
                    user, res_model, res_id
                ):
                    Delivery.create(
                        {
                            "event_type": event_type,
                            "recipient_id": user_id,
                            "channel": "in_app",
                            "state": "skipped",
                            "skip_reason": "no_access",
                            "dedupe_key": item_dedupe,
                        }
                    )
                    continue

                if rule.channel_in_app:
                    if not self._dedupe_hit(
                        Notification, user_id, event_type, item_dedupe, today_start
                    ):
                        note = Notification.create(
                            {
                                "user_id": user_id,
                                "title": title,
                                "body": body,
                                "event_type": event_type,
                                "res_model": res_model,
                                "res_id": res_id,
                                "href": href,
                                "dedupe_key": item_dedupe,
                            }
                        )
                        delivery = Delivery.create(
                            {
                                "notification_id": note.id,
                                "event_type": event_type,
                                "recipient_id": user_id,
                                "channel": "in_app",
                                "state": "delivered",
                                "dedupe_key": item_dedupe,
                            }
                        )
                        created += 1
                        delivery_ids.append(delivery.id)

                if rule.channel_email:
                    self._queue_email_for_user(
                        rule, user, event_type, subject, body, href, item_dedupe
                    )

            return {"created": created, "delivery_ids": delivery_ids}
        except Exception:
            _logger.exception("Notification notify failed for %s", event_type)
            return {"created": 0, "error": "notify_failed"}

    @api.model
    def _today_start_datetime(self):
        today = fields.Date.context_today(self)
        return fields.Datetime.to_datetime(today)

    @api.model
    def _default_dedupe_key(self, event_type, res_model, res_id):
        if res_model and res_id:
            return "%s:%s:%s" % (event_type, res_model, res_id)
        return event_type

    @api.model
    def _dedupe_hit(self, Notification, user_id, event_type, dedupe_key, today_start):
        domain = [
            ("user_id", "=", user_id),
            ("event_type", "=", event_type),
            ("dedupe_key", "=", dedupe_key),
            ("create_date", ">=", today_start),
        ]
        if Notification.search(domain, limit=1):
            return True
        Delivery = self.env["doc.notification.delivery"].sudo()
        return bool(
            Delivery.search(
                [
                    ("recipient_id", "=", user_id),
                    ("event_type", "=", event_type),
                    ("dedupe_key", "=", dedupe_key),
                    ("channel", "=", "email"),
                    ("create_date", ">=", today_start),
                    ("state", "in", ("sent", "delivered", "pending")),
                ],
                limit=1,
            )
        )

    @api.model
    def _queue_email_for_user(
        self, rule, user, event_type, subject, body, href, dedupe_key
    ):
        pref = self.env["doc.notification.user.preference"].get_or_create_for_user(
            user
        )
        if not pref.email_allowed_for_group(rule.preference_group):
            return
        today_start = self._today_start_datetime()
        Delivery = self.env["doc.notification.delivery"].sudo()
        if Delivery.search(
            [
                ("recipient_id", "=", user.id),
                ("event_type", "=", event_type),
                ("dedupe_key", "=", dedupe_key),
                ("channel", "=", "email"),
                ("create_date", ">=", today_start),
                ("state", "in", ("sent", "delivered", "pending")),
            ],
            limit=1,
        ):
            return

        body_html = "<p>%s</p>" % (body or subject)
        if href:
            body_html += '<p><a href="%s">Open in CleonHR</a></p>' % href

        timing = rule.timing or "immediate"
        scheduled_at = False
        if timing == "digest" and pref.digest_enabled:
            scheduled_at = self._next_digest_datetime(user.company_id)

        delivery = Delivery.create(
            {
                "event_type": event_type,
                "recipient_id": user.id,
                "channel": "email",
                "state": "pending",
                "subject": subject,
                "body_html": body_html,
                "scheduled_at": scheduled_at,
                "dedupe_key": dedupe_key,
            }
        )
        if timing in ("immediate", "critical_immediate") or not pref.digest_enabled:
            self._attempt_email_delivery(delivery)
        return delivery

    @api.model
    def _next_digest_datetime(self, company):
        tz_name = (
            self.env["ir.config_parameter"]
            .sudo()
            .get_param("cleon_document_management.org_timezone", "UTC")
            or "UTC"
        )
        try:
            import pytz

            tz = pytz.timezone(tz_name)
            now = datetime.now(tz)
            target = now.replace(hour=9, minute=0, second=0, microsecond=0)
            if now >= target:
                target = target + timedelta(days=1)
            return fields.Datetime.to_string(target.astimezone(pytz.UTC).replace(tzinfo=None))
        except Exception:
            tomorrow = fields.Date.context_today(self) + timedelta(days=1)
            return fields.Datetime.to_string(
                datetime.combine(tomorrow, datetime.min.time()).replace(hour=9)
            )

    @api.model
    def _attempt_email_delivery(self, delivery):
        delivery = delivery.sudo()
        user = delivery.recipient_id
        if not user.email:
            delivery.write(
                {"state": "failed", "error_message": "Recipient has no email"}
            )
            return False
        try:
            Mail = self.env["mail.mail"].sudo()
            mail = Mail.create(
                {
                    "subject": delivery.subject or _("Notification"),
                    "body_html": delivery.body_html or "",
                    "email_to": user.email,
                    "auto_delete": True,
                }
            )
            mail.send()
            delivery.write({"state": "sent"})
            return True
        except Exception as exc:
            _logger.exception("Email delivery failed for delivery %s", delivery.id)
            retry = delivery.retry_count + 1
            vals = {
                "retry_count": retry,
                "error_message": str(exc),
                "state": "failed" if retry >= MAX_EMAIL_RETRIES else "pending",
            }
            delivery.write(vals)
            return False

    @api.model
    def _cron_retry_failed_emails(self):
        Delivery = self.env["doc.notification.delivery"].sudo()
        pending = Delivery.search(
            [
                ("channel", "=", "email"),
                ("state", "in", ("pending", "failed")),
                ("retry_count", "<", MAX_EMAIL_RETRIES),
            ],
            limit=200,
        )
        now = fields.Datetime.now()
        for delivery in pending:
            if delivery.scheduled_at and delivery.scheduled_at > now:
                continue
            if delivery.state == "failed" and delivery.retry_count >= MAX_EMAIL_RETRIES:
                continue
            self._attempt_email_delivery(delivery)

    @api.model
    def _cron_send_digest_emails(self):
        Delivery = self.env["doc.notification.delivery"].sudo()
        now = fields.Datetime.now()
        digest_lines = Delivery.search(
            [
                ("channel", "=", "email"),
                ("state", "=", "pending"),
                ("scheduled_at", "!=", False),
                ("scheduled_at", "<=", now),
            ]
        )
        by_user = {}
        for line in digest_lines:
            by_user.setdefault(line.recipient_id.id, []).append(line)
        for user_id, lines in by_user.items():
            user = self.env["res.users"].sudo().browse(user_id)
            if not user.email:
                for line in lines:
                    line.write({"state": "failed", "error_message": "No email"})
                continue
            parts = []
            for line in lines:
                parts.append(line.body_html or line.subject or "")
            subject = _("Your CleonHR notification digest")
            body = "".join(parts)
            try:
                self.env["mail.mail"].sudo().create(
                    {
                        "subject": subject,
                        "body_html": body,
                        "email_to": user.email,
                        "auto_delete": True,
                    }
                ).send()
                for line in lines:
                    line.write({"state": "sent"})
            except Exception as exc:
                _logger.exception("Digest failed for user %s", user_id)
                for line in lines:
                    line.write(
                        {
                            "state": "failed",
                            "error_message": str(exc),
                            "retry_count": line.retry_count + 1,
                        }
                    )

    @api.model
    def open_notification(self, notification_id, user=None):
        user = user or self.env.user
        note = self.env["doc.notification"].sudo().search(
            [("id", "=", notification_id), ("user_id", "=", user.id)], limit=1
        )
        if not note:
            return {"permission_denied": True, "message": "Not found"}
        note.write({"read_at": fields.Datetime.now()})
        if note.res_model and note.res_id:
            if not self._user_can_access_record(user, note.res_model, note.res_id):
                return {"permission_denied": True, "message": "No access"}
        href = note.href or self._resolve_href(note.res_model, note.res_id)
        return {"permission_denied": False, "href": href or "/pages/my-workspace"}

    @api.model
    def _resolve_href(self, res_model, res_id):
        if res_model == "doc.document" and res_id:
            doc = self.env["doc.document"].sudo().browse(res_id)
            if not doc.exists():
                return ""
            if doc.folder_id and doc.folder_id.folder_type == "organizational":
                return "/pages/organization/document?id=%s" % res_id
            return "/pages/employee/document?id=%s" % res_id
        return ""

    @api.model
    def _user_can_access_record(self, user, res_model, res_id):
        if res_model == "doc.document" and res_id:
            doc = self.env["doc.document"].sudo().browse(res_id)
            if not doc.exists():
                return False
            try:
                doc.with_user(user).check_access_rights("read")
                doc.with_user(user).check_access_rule("read")
                if doc.folder_id and doc.folder_id.folder_type == "organizational":
                    return doc._organizational_user_can_access(user)
                perm = self.env["doc.employee.files.permission"]
                return perm.user_can_on_document(user, doc, "action_view")
            except Exception:
                return False
        return True

    @api.model
    def _resolve_recipients(self, rule, payload):
        if isinstance(rule, str):
            rules = self.env["doc.notification.rule"].sudo().search(
                [
                    ("active", "=", True),
                    ("event_type", "=", rule),
                    ("company_id", "=", self.env.company.id),
                ]
            )
            user_ids = set()
            for r in rules:
                user_ids.update(self._resolve_recipients(r, payload))
            return list(user_ids)
        user_ids = set()
        mode = rule.recipient_mode
        if mode == "custom_users":
            user_ids.update(rule.user_ids.ids)
        elif mode == "actor":
            uid = int(payload.get("actor_user_id") or self.env.user.id)
            user_ids.add(uid)
        elif mode == "owner":
            uid = int(payload.get("owner_user_id") or 0)
            if uid:
                user_ids.add(uid)
        elif mode == "approvers":
            for uid in payload.get("approver_user_ids") or []:
                user_ids.add(int(uid))
        elif mode == "hr_admins":
            group = self.env.ref(
                "cleon_document_management.group_document_admin",
                raise_if_not_found=False,
            )
            if group:
                user_ids.update(group.users.ids)
        elif mode == "line_manager":
            uid = self._line_manager_user_id(payload)
            if uid:
                user_ids.add(uid)
        elif mode == "employee_subject":
            uid = self._employee_user_id(payload)
            if uid:
                user_ids.add(uid)
        elif mode == "ef_stakeholders":
            uid = self._employee_user_id(payload)
            if uid:
                user_ids.add(uid)
            mgr = self._line_manager_user_id(payload)
            if mgr:
                user_ids.add(mgr)
            group = self.env.ref(
                "cleon_document_management.group_document_admin",
                raise_if_not_found=False,
            )
            if group:
                user_ids.update(group.users.ids)
        else:
            uid = int(payload.get("user_id") or payload.get("owner_user_id") or 0)
            if uid:
                user_ids.add(uid)
        extra = payload.get("extra_user_ids") or []
        for uid in extra:
            user_ids.add(int(uid))
        for uid in payload.get("target_user_ids") or []:
            user_ids.add(int(uid))
        return [uid for uid in user_ids if uid]

    @api.model
    def _employee_user_id(self, payload):
        employee_id = payload.get("employee_id")
        if employee_id:
            employee = self.env["hr.employee"].sudo().browse(int(employee_id))
            if employee.user_id:
                return employee.user_id.id
        doc_id = payload.get("res_id") if payload.get("res_model") == "doc.document" else 0
        if doc_id:
            doc = self.env["doc.document"].sudo().browse(int(doc_id))
            if doc.employee_id and doc.employee_id.user_id:
                return doc.employee_id.user_id.id
        return 0

    @api.model
    def _line_manager_user_id(self, payload):
        employee_id = payload.get("employee_id")
        employee = False
        if employee_id:
            employee = self.env["hr.employee"].sudo().browse(int(employee_id))
        elif payload.get("res_model") == "doc.document" and payload.get("res_id"):
            doc = self.env["doc.document"].sudo().browse(int(payload["res_id"]))
            employee = doc.employee_id
        if employee and employee.parent_id and employee.parent_id.user_id:
            return employee.parent_id.user_id.id
        return 0

    @api.model
    def send_test_email(self, to_email, subject=None, body=None):
        subject = subject or _("CleonHR test email")
        body = body or _("<p>This is a test message from CleonHR Document Management.</p>")
        try:
            self.env["mail.mail"].sudo().create(
                {
                    "subject": subject,
                    "body_html": body,
                    "email_to": to_email,
                    "auto_delete": True,
                }
            ).send()
            return {"success": True}
        except Exception as exc:
            return {"success": False, "message": str(exc)}
