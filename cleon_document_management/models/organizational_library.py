# -*- coding: utf-8 -*-
import logging
from datetime import timedelta
from urllib.error import URLError
from urllib.request import Request, urlopen

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError

_logger = logging.getLogger(__name__)

CONNECTORS = ("google_drive", "onedrive", "sharepoint", "dropbox")


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
    trigger = fields.Selection(
        [
            ("document_updated", "Document updated"),
            ("new_version", "New version created"),
            ("document_approved", "Document approved"),
            ("document_rejected", "Document rejected"),
            ("document_signed", "Document signed"),
            ("approaching_expiry", "Approaching expiry"),
            ("expired", "Document expired"),
        ],
        required=True,
    )
    condition = fields.Char(help="Optional expression evaluated at trigger time.")
    action = fields.Selection(
        [
            ("notify_owner", "Notify owner"),
            ("notify_audience", "Notify audience"),
            ("archive", "Archive document"),
        ],
        required=True,
        default="notify_owner",
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
            "condition": self.condition or "",
            "action": self.action,
            "status": self.status,
            "actor_id": self.actor_id.id,
            "last_run_at": self.last_run_at,
            "last_result": self.last_result or "",
        }

    def _condition_holds(self):
        self.ensure_one()
        expression = (self.condition or "").strip().lower()
        if not expression:
            return True
        document = self.document_id
        tokens = {
            "approved": document.approval_state == "approved" or document.state == "approved",
            "rejected": document.approval_state == "rejected" or document.state == "rejected",
            "expired": document.state == "expired",
            "active": document.active,
        }
        return any(token in expression and value for token, value in tokens.items()) or (
            expression in tokens and tokens[expression]
        )

    def execute(self, trigger):
        for rule in self:
            if rule.status != "active" or rule.trigger != trigger:
                continue
            if not rule._condition_holds():
                rule.write(
                    {
                        "last_run_at": fields.Datetime.now(),
                        "last_result": "skipped: condition not met",
                    }
                )
                continue
            try:
                rule._run_action()
                result = "ok"
            except Exception as error:  # noqa: BLE001
                _logger.exception("Automation %s failed", rule.id)
                result = str(error)
            rule.write({"last_run_at": fields.Datetime.now(), "last_result": result})
            self.env["doc.object.audit"].log(
                rule.document_id,
                "automation",
                _("Automation “%s” ran (%s)") % (rule.name, result),
            )

    def _run_action(self):
        self.ensure_one()
        document = self.document_id
        perm = self.env["doc.organizational.files.permission"]
        if self.action == "archive":
            if not perm.user_can_manage_org_document(self.actor_id):
                raise UserError(_("Automation actor cannot archive this document."))
            document.with_user(self.actor_id).action_archive()
            return
        partner = document.owner_id.partner_id if document.owner_id else False
        if partner:
            document.message_post(
                body=_("Automation “%s” fired on %s.") % (self.name, document.name),
                partner_ids=partner.ids,
                subtype_xmlid="mail.mt_note",
            )

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
        expired.execute("expired")
        approaching_rules.execute("approaching_expiry")


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

    @api.constrains("document_id")
    def _check_assignable_policy_document(self):
        for assignment in self:
            document = assignment.document_id
            if document and not document._assignable_as_employee_policy():
                raise ValidationError(
                    _("Only policy documents can be assigned to an employee.")
                )

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
