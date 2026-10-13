# -*- coding: utf-8 -*-
from odoo import api, models


def _emitter(env):
    return env["doc.audit.emitter.service"]


class ComplianceAuditLogBridge(models.Model):
    _inherit = "doc.compliance.audit.log"

    @api.model
    def log_event(self, event_type, summary, policy=None, employee=None, detail=None, run=None):
        super().log_event(
            event_type,
            summary,
            policy=policy,
            employee=employee,
            detail=detail,
            run=run,
        )
        anchor = policy or (run and run.policy_id) or self.env.company
        et = (event_type or "").lower()
        action = "compliance_status_changed"
        if run and "start" in et:
            action = "compliance_run_started"
        elif run and ("finish" in et or "complete" in et):
            action = "compliance_run_finished"
        elif "exception" in et:
            action = "compliance_exception_decided"
        elif "retention" in et:
            action = "compliance_retention_action"
        elif "verif" in et:
            action = "compliance_sent_to_verification"
        _emitter(self.env).section31(
            action,
            anchor,
            summary,
            details=detail or "",
            module="compliance",
        )


class TemplateAuditEventBridge(models.Model):
    _inherit = "doc.template.audit.event"

    @api.model
    def log_event(self, event_type, action, detail=None, severity="info", **kwargs):
        event = super().log_event(
            event_type,
            action,
            detail=detail,
            severity=severity,
            **kwargs,
        )
        template = event.template_id
        anchor = template or event.document_id or self.env.company
        action_key = (action or event_type or "template_edited").lower()
        mapping = {
            "create": "template_created",
            "upload": "template_created",
            "activate": "template_activated",
            "deactivate": "template_deactivated",
            "archive": "template_archived",
            "assign": "template_assigned",
            "generate": "template_generated",
            "share": "template_shared",
            "submit": "form_request_submitted",
            "approve": "form_request_decided",
            "reject": "form_request_decided",
            "fill": "form_filled",
        }
        s31 = mapping.get(action_key, "template_edited")
        for key, mapped in mapping.items():
            if key in action_key:
                s31 = mapped
                break
        result = "failed" if severity == "error" else "success"
        _emitter(self.env).section31(
            s31,
            anchor,
            detail or action or event_type,
            module="templates_forms",
            result=result,
        )
        return event


class DocFolderLockAuditBridge(models.Model):
    _inherit = "doc.folder.lock.audit"

    @api.model_create_multi
    def create(self, vals_list):
        rows = super().create(vals_list)
        for row in rows:
            action = "folder_locked" if row.action == "lock" else "folder_unlocked"
            _emitter(self.env).section31(
                action,
                row.folder_id,
                row.folder_id.display_name,
                module="organizational_files",
            )
        return rows


class DocRoleAssignmentAuditBridge(models.Model):
    _inherit = "doc.role.assignment.audit"

    @api.model_create_multi
    def create(self, vals_list):
        rows = super().create(vals_list)
        for row in rows:
            action = "role_assigned" if row.action == "grant" else "role_removed"
            _emitter(self.env).section31(
                action,
                row.user_id,
                "%s %s" % (action.replace("_", " "), row.user_id.name),
                module="settings",
                what_path="Users & Roles",
            )
        return rows


class DocWorkspaceAccessLogBridge(models.Model):
    _inherit = "doc.workspace.access.log"

    @api.model_create_multi
    def create(self, vals_list):
        rows = super().create(vals_list)
        for row in rows:
            event = (row.event or "").lower()
            if "invite" in event or "created" in event:
                action = "user_invited"
            elif "accept" in event:
                action = "user_accepted"
            elif "revoke" in event or "suspend" in event:
                action = "user_suspended"
            elif "deactiv" in event:
                action = "user_deactivated"
            else:
                action = "access_changed"
            grant = row.grant_id
            anchor = grant or row.owner_id
            _emitter(self.env).section31(
                action,
                anchor,
                event,
                module="workspace",
                details=str(row.detail or ""),
            )
        return rows


class DocNotificationAlertBridge(models.Model):
    _inherit = "doc.notification"

    @api.model_create_multi
    def create(self, vals_list):
        rows = super().create(vals_list)
        for row in rows:
            anchor = None
            if row.res_model and row.res_id:
                anchor = self.env[row.res_model].browse(row.res_id).exists()
            _emitter(self.env).section31(
                "alert_raised",
                anchor or row.user_id,
                row.title,
                module="workspace",
                details=row.body or "",
            )
        return rows

    def write(self, vals):
        if vals.get("read_at"):
            for row in self:
                if not row.read_at:
                    _emitter(self.env).section31(
                        "alert_acknowledged",
                        row.user_id,
                        row.title,
                        module="workspace",
                    )
        return super().write(vals)
