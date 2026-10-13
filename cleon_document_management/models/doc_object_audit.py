# -*- coding: utf-8 -*-
import hashlib
import json

from odoo import api, fields, models
from odoo.exceptions import AccessError

try:
    from odoo.http import request as http_request
except ImportError:
    http_request = None


class DocObjectAudit(models.Model):
    _inherit = "doc.object.audit"

    company_id = fields.Many2one(
        "res.company",
        index=True,
        default=lambda self: self.env.company,
    )
    module = fields.Char(index=True)
    result = fields.Selection(
        [("success", "Success"), ("denied", "Denied"), ("failed", "Failed")],
        default="success",
        required=True,
        index=True,
    )
    record_label = fields.Char(index=True)
    correlation_id = fields.Char(index=True)
    actor_ip = fields.Char()
    actor_user_agent = fields.Char()
    actor_role_label = fields.Char()
    what_path = fields.Char()
    changes_json = fields.Text()
    content_hash = fields.Char(index=True)
    prev_event_hash = fields.Char()

    @api.model
    def log(
        self,
        record,
        action,
        summary,
        details="",
        result="success",
        module=None,
        record_label=None,
        correlation_id=None,
        what_path=None,
        changes=None,
        **kwargs,
    ):
        if not record:
            return self.browse()
        action = self._normalize_action(action, record)
        vals = self._prepare_log_vals(
            record,
            action,
            summary,
            details=details,
            result=result,
            module=module,
            record_label=record_label,
            correlation_id=correlation_id,
            what_path=what_path,
            changes=changes,
        )
        actor_id = kwargs.pop("actor_id", None)
        occurred_at = kwargs.pop("occurred_at", None)
        if actor_id:
            vals["actor_id"] = actor_id
        if occurred_at:
            vals["occurred_at"] = occurred_at
        return self.create(vals)

    @api.model
    def _normalize_action(self, action, record):
        aliases = {
            "upload": "document_uploaded",
            "rename": "document_renamed",
            "move": "document_moved",
            "edit": "document_metadata_changed",
            "access": "access_changed",
            "create_template": "template_generated",
            "assign_policy": "policy_assigned",
            "compliance_share_grant": "access_granted",
            "compliance_share_revoke": "access_removed",
            "automation": "settings_changed",
            "registry_access_denied": "search_access_refused",
            "audit_access_denied": "audit_access_denied",
        }
        return aliases.get(action, action)

    @api.model
    def log_meta(
        self,
        action,
        summary,
        details="",
        result="success",
        module="audit",
        record_label=None,
        correlation_id=None,
        what_path=None,
        changes=None,
    ):
        company = self.env.company
        vals = self._prepare_log_vals(
            company,
            action,
            summary,
            details=details,
            result=result,
            module=module,
            record_label=record_label or summary,
            correlation_id=correlation_id,
            what_path=what_path,
            changes=changes,
        )
        return self.create(vals)

    @api.model
    def _prepare_log_vals(
        self,
        record,
        action,
        summary,
        details="",
        result="success",
        module=None,
        record_label=None,
        correlation_id=None,
        what_path=None,
        changes=None,
    ):
        company = getattr(record, "company_id", False)
        company_id = company.id if company else self.env.company.id
        module_key = module or self.env["doc.audit.query.service"].module_for_record(record)
        label = record_label or self.env["doc.audit.query.service"].record_label_for(record)
        ip_addr, user_agent = self._request_client_meta()
        role_label = self.env["doc.audit.query.service"].actor_role_label(self.env.user)
        normalized_result = result if result in ("success", "denied", "failed") else "success"
        if normalized_result == "success" and (
            "denied" in (action or "").lower()
            or "refused" in (summary or "").lower()
            or "denied" in (summary or "").lower()
        ):
            normalized_result = "denied"
        changes_json = ""
        if changes:
            changes_json = json.dumps(changes, sort_keys=True, default=str)
        vals = {
            "res_model": record._name,
            "res_id": record.id,
            "action": action,
            "summary": summary,
            "details": details or "",
            "company_id": company_id,
            "module": module_key,
            "result": normalized_result,
            "record_label": label,
            "correlation_id": correlation_id or "",
            "what_path": what_path or "",
            "actor_ip": ip_addr,
            "actor_user_agent": user_agent,
            "actor_role_label": role_label,
            "changes_json": changes_json,
        }
        return vals

    @api.model
    def _request_client_meta(self):
        if not http_request:
            return "", ""
        try:
            return (http_request.httprequest.remote_addr or "", (http_request.httprequest.user_agent.string or "")[:500])
        except Exception:
            return "", ""

    @api.model_create_multi
    def create(self, vals_list):
        Audit = self.env["doc.object.audit"]
        prepared = []
        company_prev = {}
        for vals in vals_list:
            row = dict(vals)
            company_id = row.setdefault("company_id", self.env.company.id)
            row.setdefault("module", "document_management")
            row.setdefault("result", "success")
            if company_id not in company_prev:
                last = Audit.search(
                    [("company_id", "=", company_id)],
                    order="id desc",
                    limit=1,
                )
                company_prev[company_id] = last.content_hash if last else ""
            prev_hash = company_prev[company_id]
            row["prev_event_hash"] = prev_hash
            row["content_hash"] = self._compute_content_hash(row, prev_hash)
            company_prev[company_id] = row["content_hash"]
            prepared.append(row)
        return super(DocObjectAudit, self).create(prepared)

    @api.model
    def _compute_content_hash(self, vals, prev_hash):
        payload = {
            "company_id": vals.get("company_id"),
            "res_model": vals.get("res_model"),
            "res_id": vals.get("res_id"),
            "action": vals.get("action"),
            "summary": vals.get("summary"),
            "details": vals.get("details") or "",
            "module": vals.get("module"),
            "result": vals.get("result"),
            "record_label": vals.get("record_label") or "",
            "correlation_id": vals.get("correlation_id") or "",
            "changes_json": vals.get("changes_json") or "",
            "prev_event_hash": prev_hash or "",
        }
        raw = json.dumps(payload, sort_keys=True, default=str).encode("utf-8")
        return hashlib.sha256(raw).hexdigest()

    def write(self, vals):
        if self.env.context.get("allow_audit_mutation"):
            return super(DocObjectAudit, self).write(vals)
        self._log_tamper_attempt("write")
        raise AccessError("Audit events cannot be modified.")

    def unlink(self):
        if self.env.context.get("allow_audit_mutation"):
            return super(DocObjectAudit, self).unlink()
        self._log_tamper_attempt("unlink")
        raise AccessError("Audit events cannot be deleted.")

    def _log_tamper_attempt(self, operation):
        try:
            self.env["doc.object.audit"].sudo().log_meta(
                "audit_tamper_%s" % operation,
                "Audit tamper attempt refused",
                details="ids=%s" % list(self.ids),
                result="denied",
                module="audit",
                record_label="Audit integrity",
            )
        except Exception:
            pass

    def serialize_for_api(self):
        self.ensure_one()
        base = super().serialize_for_api()
        base.update(
            {
                "module": self.module or "",
                "result": self.result or "success",
                "record_label": self.record_label or self.summary,
                "correlation_id": self.correlation_id or "",
                "what_path": self.what_path or "",
                "actor_ip": self.actor_ip or "",
                "actor_user_agent": self.actor_user_agent or "",
                "actor_role_label": self.actor_role_label or "",
                "changes_json": self.changes_json or "",
            }
        )
        return base
