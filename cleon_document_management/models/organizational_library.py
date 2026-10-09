# -*- coding: utf-8 -*-
import logging
from datetime import timedelta
from urllib.error import URLError
from urllib.request import Request, urlopen

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError

_logger = logging.getLogger(__name__)

CONNECTORS = ("google_drive", "onedrive", "sharepoint", "dropbox")

AUTOMATION_CONDITIONS = (
    ("always", "No extra condition"),
    ("doc_active", "Document is active"),
    ("approval_approved", "Approval is approved"),
    ("approval_not_pending", "Approval not pending"),
    ("approval_rejected", "Approval rejected"),
    ("has_expiry_date", "Has expiry date set"),
    ("expiry_in_warning_window", "Expiry within 14 days"),
    ("expiry_passed", "Expiry date reached"),
    ("not_on_legal_hold", "Not on legal hold"),
    ("signature_completed", "Signature completed"),
    ("owner_has_login", "Owner has a user account"),
)

AUTOMATION_CONDITION_MATRIX = {
    ("document_updated", "notify_owner"): (
        "always",
        "doc_active",
        "approval_approved",
        "approval_not_pending",
        "not_on_legal_hold",
        "owner_has_login",
    ),
    ("document_updated", "notify_audience"): (
        "always",
        "doc_active",
        "approval_approved",
        "approval_not_pending",
        "not_on_legal_hold",
    ),
    ("document_updated", "archive"): (
        "always",
        "doc_active",
        "approval_approved",
        "not_on_legal_hold",
    ),
    ("new_version", "notify_owner"): (
        "always",
        "doc_active",
        "approval_approved",
        "not_on_legal_hold",
        "owner_has_login",
    ),
    ("new_version", "notify_audience"): (
        "always",
        "doc_active",
        "approval_approved",
        "not_on_legal_hold",
    ),
    ("new_version", "archive"): ("always", "doc_active", "not_on_legal_hold"),
    ("document_approved", "notify_owner"): ("always", "doc_active", "owner_has_login"),
    ("document_approved", "notify_audience"): ("always", "doc_active"),
    ("document_approved", "archive"): ("always", "doc_active", "not_on_legal_hold"),
    ("document_rejected", "notify_owner"): (
        "always",
        "doc_active",
        "approval_rejected",
        "owner_has_login",
    ),
    ("document_rejected", "notify_audience"): (
        "always",
        "doc_active",
        "approval_rejected",
    ),
    ("document_rejected", "archive"): ("always", "doc_active", "not_on_legal_hold"),
    ("document_signed", "notify_owner"): (
        "always",
        "doc_active",
        "signature_completed",
        "owner_has_login",
    ),
    ("document_signed", "notify_audience"): (
        "always",
        "doc_active",
        "signature_completed",
    ),
    ("document_signed", "archive"): (
        "always",
        "doc_active",
        "signature_completed",
        "not_on_legal_hold",
    ),
    ("approaching_expiry", "notify_owner"): (
        "always",
        "doc_active",
        "has_expiry_date",
        "expiry_in_warning_window",
        "not_on_legal_hold",
        "owner_has_login",
    ),
    ("approaching_expiry", "notify_audience"): (
        "always",
        "doc_active",
        "has_expiry_date",
        "expiry_in_warning_window",
        "not_on_legal_hold",
    ),
    ("approaching_expiry", "archive"): (
        "always",
        "doc_active",
        "has_expiry_date",
        "expiry_in_warning_window",
        "not_on_legal_hold",
    ),
    ("expired", "notify_owner"): (
        "always",
        "expiry_passed",
        "doc_active",
        "not_on_legal_hold",
        "owner_has_login",
    ),
    ("expired", "notify_audience"): (
        "always",
        "expiry_passed",
        "doc_active",
        "not_on_legal_hold",
    ),
    ("expired", "archive"): ("always", "expiry_passed", "not_on_legal_hold"),
}

LEGACY_CONDITION_MAP = {
    "": "always",
    "approved": "approval_approved",
    "rejected": "approval_rejected",
    "expired": "expiry_passed",
    "active": "doc_active",
}

SCHEDULED_AUTOMATION_TRIGGERS = ("approaching_expiry", "expired")

AUTOMATION_TRIGGER_SELECTION = [
    ("document_updated", "Document updated"),
    ("new_version", "New version created"),
    ("document_approved", "Document approved"),
    ("document_rejected", "Document rejected"),
    ("document_signed", "Document signed"),
    ("approaching_expiry", "Approaching expiry"),
    ("expired", "Document expired"),
]

AUTOMATION_ACTION_SELECTION = [
    ("notify_owner", "Notify owner"),
    ("notify_audience", "Notify audience"),
    ("archive", "Archive document"),
]

AUTOMATION_RUN_OUTCOMES = [
    ("success", "Success"),
    ("skipped_condition", "Skipped (condition)"),
    ("skipped_dedupe", "Skipped (already ran today)"),
    ("failed", "Failed"),
]

AUTOMATION_RUN_SOURCES = [
    ("event", "Event"),
    ("cron", "Scheduled"),
    ("manual", "Manual"),
]


class DocObjectAudit(models.Model):
    _name = "doc.object.audit"
    _description = "Organizational object audit"
    _order = "occurred_at desc, id desc"

    res_model = fields.Char(required=True, index=True)
    res_id = fields.Integer(required=True, index=True)
    action = fields.Char(required=True, index=True)
    summary = fields.Char(required=True)
    actor_id = fields.Many2one("res.users", default=lambda self: self.env.user, required=True)
    occurred_at = fields.Datetime(default=fields.Datetime.now, required=True, index=True)
    details = fields.Text()

    def serialize_for_api(self):
        self.ensure_one()
        return {
            "id": self.id,
            "action": self.action,
            "summary": self.summary,
            "actor_id": self.actor_id.id,
            "actor_name": self.actor_id.name,
            "occurred_at": self.occurred_at,
            "details": self.details or "",
        }

    @api.model
    def log(self, record, action, summary, details=""):
        if not record:
            return self.browse()
        return self.create(
            {
                "res_model": record._name,
                "res_id": record.id,
                "action": action,
                "summary": summary,
                "details": details or "",
            }
        )


class DocOrganizationalConnector(models.Model):
    _name = "doc.organizational.connector"
    _description = "Organizational Files cloud connector"
    _rec_name = "provider"

    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    provider = fields.Selection(
        [
            ("google_drive", "Google Drive"),
            ("onedrive", "OneDrive"),
            ("sharepoint", "SharePoint"),
            ("dropbox", "Dropbox"),
        ],
        required=True,
    )
    connected = fields.Boolean(default=False)
    connected_at = fields.Datetime()
    label = fields.Char()

    _sql_constraints = [
        (
            "company_provider_uniq",
            "unique(company_id, provider)",
            "Each connector can only be configured once per company.",
        )
    ]

    def serialize_for_api(self):
        self.ensure_one()
        labels = dict(self._fields["provider"].selection)
        return {
            "id": self.id,
            "provider": self.provider,
            "label": self.label or labels.get(self.provider, self.provider),
            "connected": bool(self.connected),
            "connected_at": self.connected_at,
        }

    @api.model
    def list_for_company(self):
        records = self.search([("company_id", "=", self.env.company.id)])
        by_provider = {item.provider: item for item in records}
        result = []
        labels = dict(self._fields["provider"].selection)
        for provider in CONNECTORS:
            item = by_provider.get(provider)
            if item:
                result.append(item.serialize_for_api())
            else:
                result.append(
                    {
                        "id": False,
                        "provider": provider,
                        "label": labels.get(provider, provider),
                        "connected": False,
                        "connected_at": False,
                    }
                )
        return result

    @api.model
    def set_connected(self, provider, connected):
        if provider not in CONNECTORS:
            raise UserError(_("Unknown connector."))
        record = self.search(
            [("company_id", "=", self.env.company.id), ("provider", "=", provider)],
            limit=1,
        )
        values = {
            "connected": bool(connected),
            "connected_at": fields.Datetime.now() if connected else False,
        }
        if record:
            record.write(values)
        else:
            record = self.create({"provider": provider, **values})
        return record.serialize_for_api()


class DocDocumentAutomation(models.Model):
    _name = "doc.document.automation"
    _description = "Organizational document automation"
    _order = "id desc"

    name = fields.Char(required=True)
    document_id = fields.Many2one("doc.document", required=True, ondelete="cascade", index=True)
    trigger = fields.Selection(AUTOMATION_TRIGGER_SELECTION, required=True)
    condition = fields.Selection(
        selection=AUTOMATION_CONDITIONS,
        default="always",
        required=True,
    )
    notify_user_ids = fields.Many2many(
        "res.users",
        "doc_document_automation_notify_user_rel",
        "automation_id",
        "user_id",
        string="Notify users",
    )
    action = fields.Selection(
        AUTOMATION_ACTION_SELECTION,
        required=True,
        default="notify_owner",
    )
    run_ids = fields.One2many(
        "doc.document.automation.run",
        "automation_id",
        string="Run history",
    )
    status = fields.Selection(
        [("active", "Active"), ("disabled", "Disabled")],
        default="active",
        required=True,
    )
    actor_id = fields.Many2one("res.users", default=lambda self: self.env.user, required=True)
    last_run_at = fields.Datetime()
    last_result = fields.Char()

    def serialize_for_api(self):
        self.ensure_one()
        return {
            "id": self.id,
            "name": self.name,
            "document_id": self.document_id.id,
            "trigger": self.trigger,
            "condition": self.condition or "always",
            "action": self.action,
            "status": self.status,
            "actor_id": self.actor_id.id,
            "last_run_at": self.last_run_at,
            "last_result": self.last_result or "",
            "notify_user_ids": self.notify_user_ids.ids,
            "notify_users": [
                {"id": user.id, "name": user.name, "email": user.email or ""}
                for user in self.notify_user_ids
            ],
        }

    @api.model
    def _normalize_condition_value(self, raw):
        key = (raw or "always").strip().lower()
        if key in dict(AUTOMATION_CONDITIONS):
            return key
        return LEGACY_CONDITION_MAP.get(key, "always")

    @api.model
    def allowed_conditions(self, trigger, action):
        return AUTOMATION_CONDITION_MATRIX.get((trigger, action), ("always",))

    @api.model
    def _validate_condition_for_rule(self, trigger, action, condition):
        allowed = self.allowed_conditions(trigger, action)
        if condition not in allowed:
            raise ValidationError(
                _("Condition “%s” is not allowed for this trigger and action.")
                % (condition or "")
            )

    def _check_notify_audience(self):
        for rule in self:
            if rule.action == "notify_audience":
                if not rule.notify_user_ids:
                    raise ValidationError(
                        _("Select at least one user to notify for “%s”.") % rule.name
                    )
                allowed = rule.document_id._automation_notify_candidate_users()
                invalid = rule.notify_user_ids - allowed
                if invalid:
                    raise ValidationError(
                        _("Some notify users cannot access this document: %s")
                        % ", ".join(invalid.mapped("name"))
                    )
            elif rule.notify_user_ids:
                raise ValidationError(
                    _("Notify users are only used when the action is Notify audience.")
                )

    @api.constrains("trigger", "action", "condition")
    def _constrain_condition_matrix(self):
        for rule in self:
            self._validate_condition_for_rule(rule.trigger, rule.action, rule.condition)

    @api.constrains("action", "notify_user_ids", "document_id")
    def _constrain_notify_audience(self):
        self._check_notify_audience()

    @api.model_create_multi
    def create(self, vals_list):
        normalized = []
        for vals in vals_list:
            item = dict(vals)
            trigger = item.get("trigger")
            action = item.get("action")
            if trigger and action:
                item["condition"] = self._normalize_condition_value(item.get("condition"))
                self._validate_condition_for_rule(trigger, action, item["condition"])
            if item.get("action") == "notify_owner":
                item["notify_user_ids"] = [(5, 0, 0)]
            normalized.append(item)
        return super().create(normalized)

    def write(self, vals):
        if vals.get("action") == "notify_owner":
            vals = dict(vals, notify_user_ids=[(5, 0, 0)])
        if any(field in vals for field in ("trigger", "action", "condition")):
            for rule in self:
                trigger = vals.get("trigger", rule.trigger)
                action = vals.get("action", rule.action)
                condition = self._normalize_condition_value(
                    vals.get("condition", rule.condition)
                )
                self._validate_condition_for_rule(trigger, action, condition)
                if "condition" in vals or trigger != rule.trigger or action != rule.action:
                    vals = dict(vals, condition=condition)
        return super().write(vals)

    def _document_is_active(self, document):
        return (
            document.active
            and not document.deleted_at
            and document.distribution_status == "active"
        )

    def _condition_holds(self):
        self.ensure_one()
        document = self.document_id.sudo()
        today = fields.Date.context_today(self)
        approaching = today + timedelta(days=14)
        key = self.condition or "always"
        if key == "always":
            return True
        if key == "doc_active":
            return self._document_is_active(document)
        if key == "approval_approved":
            return document.approval_state == "approved" or document.state == "approved"
        if key == "approval_not_pending":
            return document.approval_state != "pending"
        if key == "approval_rejected":
            return document.approval_state == "rejected" or document.state == "rejected"
        if key == "has_expiry_date":
            return bool(document.has_expiry and document.expiry_date)
        if key == "expiry_in_warning_window":
            return (
                document.has_expiry
                and document.expiry_date
                and document.expiry_date > today
                and document.expiry_date <= approaching
            )
        if key == "expiry_passed":
            return document.state == "expired" or (
                document.has_expiry
                and document.expiry_date
                and document.expiry_date <= today
            )
        if key == "not_on_legal_hold":
            return not document.legal_hold_active
        if key == "signature_completed":
            return bool(
                self.env["doc.document.signature.request"].search_count(
                    [
                        ("document_id", "=", document.id),
                        ("state", "=", "completed"),
                    ]
                )
            )
        if key == "owner_has_login":
            return bool(document.owner_id and document.owner_id.active)
        return False

    def _should_skip_scheduled_run(self):
        self.ensure_one()
        if self.trigger not in SCHEDULED_AUTOMATION_TRIGGERS:
            return False
        if self.last_result != "ok" or not self.last_run_at:
            return False
        today = fields.Date.context_today(self)
        last_day = fields.Date.to_date(self.last_run_at)
        return last_day == today

    def _log_automation_run(
        self,
        trigger,
        source,
        outcome,
        result_message,
        condition_met,
    ):
        self.ensure_one()
        notify_count = 0
        if self.action == "notify_audience":
            notify_count = len(self.notify_user_ids)
        self.env["doc.document.automation.run"].create(
            {
                "automation_id": self.id,
                "document_id": self.document_id.id,
                "trigger": trigger,
                "outcome": outcome,
                "result_message": result_message or "",
                "condition": self.condition,
                "condition_met": bool(condition_met),
                "action": self.action,
                "actor_id": self.actor_id.id,
                "notify_user_count": notify_count,
                "source": source,
            }
        )

    def execute(self, trigger, source="event"):
        for rule in self:
            if rule.status != "active" or rule.trigger != trigger:
                continue
            if rule._should_skip_scheduled_run():
                rule._log_automation_run(
                    trigger,
                    source,
                    "skipped_dedupe",
                    "Already ran successfully today",
                    False,
                )
                continue
            condition_met = rule._condition_holds()
            if not condition_met:
                rule.write(
                    {
                        "last_run_at": fields.Datetime.now(),
                        "last_result": "skipped: condition not met",
                    }
                )
                rule._log_automation_run(
                    trigger,
                    source,
                    "skipped_condition",
                    "skipped: condition not met",
                    False,
                )
                continue
            try:
                rule._run_action()
                result = "ok"
                outcome = "success"
            except Exception as error:  # noqa: BLE001
                _logger.exception("Automation %s failed", rule.id)
                result = str(error)
                outcome = "failed"
            rule.write({"last_run_at": fields.Datetime.now(), "last_result": result})
            rule._log_automation_run(trigger, source, outcome, result, True)
            self.env["doc.object.audit"].log(
                rule.document_id,
                "automation",
                _("Automation “%s” ran (%s)") % (rule.name, result),
            )

    def _automation_notification_body(self, document):
        labels = dict(self._fields["trigger"].selection)
        trigger_label = labels.get(self.trigger, self.trigger)
        return _("Automation “%s” ran for %s (%s).") % (
            self.name,
            document.name,
            trigger_label,
        )

    def _post_automation_notification(self, document, partners):
        partners = partners.filtered(lambda partner: partner)
        if not partners:
            raise UserError(_("No recipients to notify."))
        body = self._automation_notification_body(document)
        document.message_post(
            body=body,
            partner_ids=partners.ids,
            subtype_xmlid="mail.mt_comment",
        )
        notify = self.env["doc.notification.service"]
        for partner in partners:
            user = partner.user_ids[:1]
            if not user:
                continue
            notify.notify(
                "org.access_shared",
                _("Organisational file update: %s") % document.name,
                {
                    "title": _("Organisational file update"),
                    "body": body,
                    "res_model": "doc.document",
                    "res_id": document.id,
                    "owner_user_id": user.id,
                },
            )

    def _run_action(self):
        self.ensure_one()
        document = self.document_id.sudo()
        perm = self.env["doc.organizational.files.permission"]
        if self.action == "archive":
            if document.legal_hold_active:
                raise UserError(_("Cannot archive a document on legal hold."))
            if document.folder_id.folder_type == "employee":
                if not document.with_user(self.actor_id)._can_ef_manage_document(
                    "action_archive"
                ):
                    raise UserError(_("Automation actor cannot archive this document."))
            elif not perm.user_can_manage_org_document(self.actor_id):
                raise UserError(_("Automation actor cannot archive this document."))
            document.with_user(self.actor_id).with_context(
                skip_document_automation=True
            ).action_archive()
            return
        if self.action == "notify_owner":
            owner = (
                document.owner_id
                or document.uploaded_by
                or document.create_uid
                or self.actor_id
            )
            if not owner:
                raise UserError(_("Document has no owner to notify."))
            partner = owner.partner_id
            if not partner:
                raise UserError(_("Document has no owner to notify."))
            self._post_automation_notification(document, partner)
            return
        if self.action == "notify_audience":
            partners = self.notify_user_ids.mapped("partner_id")
            self._post_automation_notification(document, partners)
            return

    @api.model
    def _cron_run_expiry_automations(self):
        today = fields.Date.context_today(self)
        approaching = today + timedelta(days=14)
        expired = self.search(
            [
                ("status", "=", "active"),
                ("trigger", "=", "expired"),
                ("document_id.has_expiry", "=", True),
                ("document_id.expiry_date", "<=", today),
            ]
        )
        approaching_rules = self.search(
            [
                ("status", "=", "active"),
                ("trigger", "=", "approaching_expiry"),
                ("document_id.has_expiry", "=", True),
                ("document_id.expiry_date", "<=", approaching),
                ("document_id.expiry_date", ">", today),
            ]
        )
        expired.execute("expired", source="cron")
        approaching_rules.execute("approaching_expiry", source="cron")


class DocDocumentAutomationRun(models.Model):
    _name = "doc.document.automation.run"
    _description = "Organizational document automation run"
    _order = "occurred_at desc, id desc"

    automation_id = fields.Many2one(
        "doc.document.automation",
        required=True,
        ondelete="cascade",
        index=True,
    )
    document_id = fields.Many2one(
        "doc.document",
        required=True,
        ondelete="cascade",
        index=True,
    )
    occurred_at = fields.Datetime(
        default=fields.Datetime.now,
        required=True,
        index=True,
    )
    trigger = fields.Selection(AUTOMATION_TRIGGER_SELECTION, required=True)
    outcome = fields.Selection(AUTOMATION_RUN_OUTCOMES, required=True, index=True)
    result_message = fields.Char()
    condition = fields.Selection(AUTOMATION_CONDITIONS, required=True)
    condition_met = fields.Boolean(default=False)
    action = fields.Selection(AUTOMATION_ACTION_SELECTION, required=True)
    actor_id = fields.Many2one("res.users", required=True)
    notify_user_count = fields.Integer(default=0)
    source = fields.Selection(
        AUTOMATION_RUN_SOURCES,
        required=True,
        default="event",
    )

    def serialize_for_api(self):
        self.ensure_one()
        trigger_labels = dict(AUTOMATION_TRIGGER_SELECTION)
        action_labels = dict(AUTOMATION_ACTION_SELECTION)
        outcome_labels = dict(AUTOMATION_RUN_OUTCOMES)
        condition_labels = dict(AUTOMATION_CONDITIONS)
        source_labels = dict(AUTOMATION_RUN_SOURCES)
        return {
            "id": self.id,
            "automation_id": self.automation_id.id,
            "document_id": self.document_id.id,
            "occurred_at": self.occurred_at,
            "trigger": self.trigger,
            "trigger_label": trigger_labels.get(self.trigger, self.trigger),
            "outcome": self.outcome,
            "outcome_label": outcome_labels.get(self.outcome, self.outcome),
            "result_message": self.result_message or "",
            "condition": self.condition,
            "condition_label": condition_labels.get(self.condition, self.condition),
            "condition_met": bool(self.condition_met),
            "action": self.action,
            "action_label": action_labels.get(self.action, self.action),
            "actor_id": self.actor_id.id,
            "actor_name": self.actor_id.name,
            "notify_user_count": self.notify_user_count,
            "source": self.source,
            "source_label": source_labels.get(self.source, self.source),
        }


class DocPolicyEmployeeAssignment(models.Model):
    _name = "doc.policy.employee.assignment"
    _description = "Policy assigned to an employee file"
    _order = "id desc"

    policy_id = fields.Many2one("doc.compliance.policy", ondelete="cascade")
    organizational_policy_id = fields.Many2one(
        "doc.organizational.policy",
        string="Organizational policy",
        ondelete="cascade",
        index=True,
    )
    employee_id = fields.Many2one("hr.employee", required=True, ondelete="cascade", index=True)
    document_id = fields.Many2one("doc.document", ondelete="set null")
    compliance_cycle_id = fields.Many2one(
        "doc.compliance.request.cycle",
        string="Compliance cycle",
        ondelete="cascade",
        index=True,
    )
    requested_signature = fields.Boolean(default=False)
    notified_at = fields.Datetime()
    assigned_by_id = fields.Many2one("res.users", default=lambda self: self.env.user)

    @api.constrains("policy_id", "organizational_policy_id")
    def _check_policy_reference(self):
        for assignment in self:
            has_compliance = bool(assignment.policy_id)
            has_org = bool(assignment.organizational_policy_id)
            if has_compliance == has_org:
                raise ValidationError(
                    _("Link exactly one policy (organizational or compliance).")
                )

    @api.constrains("document_id", "policy_id")
    def _check_assignable_policy_document(self):
        for assignment in self:
            document = assignment.document_id
            if not document:
                continue
            compliance_policy = assignment.policy_id
            if compliance_policy and compliance_policy._is_compliance_request():
                if document.folder_id.folder_type != "organizational":
                    raise ValidationError(
                        _("Compliance content assignments require an organizational document.")
                    )
                continue
            if not document._assignable_as_employee_policy():
                raise ValidationError(
                    _("Only policy documents can be assigned to an employee.")
                )

    @api.model
    def create_compliance_content_assignment(
        self, cycle, employee, compliance_policy, org_policy=None, document=None
    ):
        cycle = cycle.sudo()
        employee = employee.sudo()
        compliance_policy = compliance_policy.sudo()
        document = document.sudo().exists() if document else self.env["doc.document"]
        org_policy = org_policy.sudo().exists() if org_policy else self.env[
            "doc.organizational.policy"
        ]
        if not document:
            return self.env["doc.policy.employee.assignment"]
        domain = [
            ("compliance_cycle_id", "=", cycle.id),
            ("employee_id", "=", employee.id),
            ("document_id", "=", document.id),
        ]
        existing = self.search(domain, limit=1)
        if existing:
            return existing
        values = {
            "policy_id": compliance_policy.id,
            "employee_id": employee.id,
            "document_id": document.id,
            "compliance_cycle_id": cycle.id,
        }
        assignment = self.create(values)
        self.env["doc.object.audit"].sudo().log(
            document,
            "compliance_share_grant",
            _("Granted compliance content access for cycle %s") % cycle.id,
        )
        return assignment

    def serialize_for_api(self):
        self.ensure_one()
        policy_name = ""
        policy_id = False
        if self.organizational_policy_id:
            policy_name = self.organizational_policy_id.name
            policy_id = self.organizational_policy_id.id
        elif self.policy_id:
            policy_name = self.policy_id.name
            policy_id = self.policy_id.id
        return {
            "id": self.id,
            "policy_id": policy_id,
            "policy_name": policy_name,
            "organizational_policy_id": self.organizational_policy_id.id or False,
            "employee_id": self.employee_id.id,
            "employee_name": self.employee_id.name,
            "document_id": self.document_id.id or False,
            "requested_signature": bool(self.requested_signature),
            "notified_at": self.notified_at,
        }

    def action_notify(self):
        for assignment in self:
            user = assignment.employee_id.user_id
            if assignment.organizational_policy_id:
                policy_name = assignment.organizational_policy_id.name
            else:
                policy_name = assignment.policy_id.name
            body = _("Policy “%s” was assigned to you.") % policy_name
            if user and user.partner_id and assignment.policy_id:
                assignment.policy_id.message_post(
                    body=body,
                    partner_ids=user.partner_id.ids,
                    subtype_xmlid="mail.mt_comment",
                )
            assignment.notified_at = fields.Datetime.now()
            if assignment.requested_signature and assignment.document_id:
                request = self.env["doc.document.signature.request"].create(
                    {
                        "document_id": assignment.document_id.id,
                        "signer_employee_id": assignment.employee_id.id,
                    }
                )
                request.action_request_via_provider()


class DocDocumentVersionRestore(models.Model):
    _inherit = "doc.document.version"

    def action_restore_as_new_version(self):
        self.ensure_one()
        document = self.document_id
        if not self.file_attachment:
            raise UserError(_("This version has no file to restore."))
        document._create_version_snapshot(
            change_note=_("Restored from version %s") % self.version_number
        )
        restored = self.file_attachment.copy(
            {
                "name": self.file_attachment.name,
                "res_model": document._name,
                "res_id": document.id,
            }
        )
        document.write({"attachment_id": restored.id})
        self.env["doc.object.audit"].log(
            document,
            "restore_version",
            _("Restored version %s as a new version") % self.version_number,
        )
        return True


def probe_source_url(url):
    if not url:
        return "none"
    try:
        request = Request(url, method="HEAD")
        with urlopen(request, timeout=4) as response:
            status = getattr(response, "status", 200)
            return "ok" if 200 <= int(status) < 400 else "broken"
    except URLError:
        return "broken"
    except Exception:  # noqa: BLE001
        return "unchecked"
