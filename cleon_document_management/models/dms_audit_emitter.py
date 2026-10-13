# -*- coding: utf-8 -*-
import json
import uuid

from odoo import _, api, models


class DocAuditEmitterService(models.AbstractModel):
    _name = "doc.audit.emitter.service"
    _description = "Central audit event helpers (Section 31)"

    @api.model
    def new_correlation_id(self, prefix="chg"):
        return "%s-%s" % (prefix, uuid.uuid4().hex[:12])

    @api.model
    def _format_value(self, value):
        if value is False or value is None:
            return ""
        if isinstance(value, (list, tuple, dict)):
            return json.dumps(value, default=str, sort_keys=True)
        return str(value)

    @api.model
    def diff_dict(self, before, after, keys=None):
        changes = []
        key_list = keys or sorted(set(before.keys()) | set(after.keys()))
        for key in key_list:
            old = self._format_value(before.get(key))
            new = self._format_value(after.get(key))
            if old != new:
                changes.append({"field": key, "before": old, "after": new})
        return changes

    @api.model
    def log_settings_changes(
        self,
        anchor,
        tab_label,
        what_path,
        changes,
        action="settings_changed",
        summary=None,
        correlation_id=None,
    ):
        if not changes:
            return self.env["doc.object.audit"].browse()
        corr = correlation_id or self.new_correlation_id("settings")
        Audit = self.env["doc.object.audit"]
        events = Audit.browse()
        for index, change in enumerate(changes):
            field = change.get("field") or "field"
            events |= Audit.log(
                anchor,
                action,
                summary or _("Settings: %s changed") % field,
                module="settings",
                what_path=what_path or (_("Settings → %s") % tab_label),
                correlation_id=corr,
                changes={field: {"before": change.get("before"), "after": change.get("after")}},
                details=_("Tab: %s") % tab_label,
            )
        return events

    @api.model
    def snapshot_record(self, record, field_names):
        data = {}
        for name in field_names:
            if name not in record._fields:
                continue
            field = record._fields[name]
            value = record[name]
            if field.type == "many2many":
                data[name] = sorted(value.ids)
            elif field.type == "many2one":
                data[name] = value.id if value else False
            else:
                data[name] = value
        return data

    @api.model
    def log_config_parameter_changes(self, param_keys, tab_label, anchor=None):
        anchor = anchor or self.env.company
        params = self.env["ir.config_parameter"].sudo()
        before = {key: params.get_param(key, "") for key in param_keys}
        return before

    @api.model
    def emit_param_diffs(self, before, param_keys, tab_label, what_path=None):
        params = self.env["ir.config_parameter"].sudo()
        after = {key: params.get_param(key, "") for key in param_keys}
        changes = self.diff_dict(before, after, param_keys)
        return self.log_settings_changes(
            self.env.company,
            tab_label,
            what_path or (_("Settings → %s") % tab_label),
            changes,
        )

    @api.model
    def log_document_view(self, document, source="document"):
        if not document or not document.exists():
            return self.env["doc.object.audit"].browse()
        if source == "search_preview":
            action = "document_previewed"
            label = _("Search preview")
            path = _("Search → Preview")
        elif source in ("search_result", "search"):
            action = "search_result_opened"
            label = _("Search result opened")
            path = _("Search → Open")
        else:
            action = "document_viewed"
            label = _("Viewed")
            path = _("Document")
        return self.section31(
            action,
            document,
            "%s — %s" % (label, document.name),
            what_path=path,
            details="source=%s" % source,
        )

    @api.model
    def log_document_access_denied(self, document, source="search", reason=""):
        if not document or not document.exists():
            return self.env["doc.object.audit"].log_meta(
                "search_access_denied",
                _("Search access refused"),
                result="denied",
                module="workspace",
                details=reason or source,
            )
        return self.section31(
            "search_access_refused" if "search" in source else "access_denied",
            document,
            _("Access denied (%s)") % source,
            result="denied",
            details=reason,
        )

    @api.model
    def mirror_intelligence_event(self, event):
        if not event:
            return
        target = None
        if event.target_model and event.target_id:
            target = self.env[event.target_model].browse(event.target_id).exists()
        anchor = target or self.env.company
        changes = {}
        if event.before_value or event.after_value:
            changes = {
                "value": {
                    "before": event.before_value or "",
                    "after": event.after_value or "",
                }
            }
        result = "success"
        if event.severity == "error":
            result = "failed"
        action = (event.action or "intelligence_job_finished").lower()
        if "start" in action:
            s31 = "intelligence_job_started"
        elif "fail" in action or event.severity == "error":
            s31 = "intelligence_job_failed"
        elif "export" in action:
            s31 = "intelligence_export"
        elif "refus" in action:
            s31 = "intelligence_refusal"
        elif "dataset" in action and "share" in action:
            s31 = "intelligence_dataset_shared"
        elif "dataset" in action:
            s31 = "intelligence_dataset_saved"
        else:
            s31 = "intelligence_job_finished"
        self.env["doc.object.audit"].log(
            anchor,
            s31,
            event.detail or event.action or "Document Intelligence",
            module="document_intelligence",
            result=result,
            correlation_id=event.correlation_id or "",
            changes=changes or None,
            what_path=_("Document Intelligence → %s") % (event.category or ""),
        )

    @api.model
    def log_signature_state(self, request, new_state):
        action_map = {
            "requested": ("signature_request_created", _("Signature request created")),
            "completed": ("signature_completed", _("Document signed")),
            "declined": ("signature_declined", _("Signature declined")),
            "expired": ("signature_expired", _("Signature request expired")),
        }
        action, summary = action_map.get(
            new_state, ("signature_request_sent", _("Signature updated"))
        )
        doc = request.document_id
        return self.env["doc.object.audit"].log(
            doc,
            action,
            "%s — %s" % (summary, doc.name),
            module="signatures",
            record_label=doc.name,
            what_path=_("Signatures → %s") % request.signer_employee_id.name,
            details="request_id=%s state=%s" % (request.id, new_state),
        )

    @api.model
    def section31(
        self,
        action,
        record=None,
        summary=None,
        module=None,
        result="success",
        **kwargs,
    ):
        from .dms_audit_catalog import SECTION31_ACTIONS

        module = module or SECTION31_ACTIONS.get(action)
        query = self.env["doc.audit.query.service"]
        if record and record._name != "res.company":
            module = module or query.module_for_record(record)
            label = summary or kwargs.get("record_label") or query.record_label_for(record)
            return self.env["doc.object.audit"].log(
                record,
                action,
                label,
                module=module or "document_management",
                result=result,
                record_label=kwargs.pop("record_label", None) or label,
                **kwargs,
            )
        company = self.env.company
        return self.env["doc.object.audit"].log_meta(
            action,
            summary or action.replace("_", " ").title(),
            module=module or "audit",
            result=result,
            record_label=kwargs.get("record_label"),
            **kwargs,
        )
