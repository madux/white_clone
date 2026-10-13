# -*- coding: utf-8 -*-
from odoo import _, api, fields, models


def _s31(env, action, record, summary=None, **kwargs):
    emitter = env.get("doc.audit.emitter.service")
    if emitter:
        emitter.section31(action, record, summary, **kwargs)


class DocDocumentSection31(models.Model):
    _inherit = "doc.document"

    @api.model_create_multi
    def create(self, vals_list):
        documents = super().create(vals_list)
        if not self.env.context.get("audit_suppress_create"):
            for document in documents:
                _s31(
                    self.env,
                    "document_created",
                    document,
                    _("Created %s") % document.name,
                )
        return documents

    def write(self, vals):
        before = {doc.id: {k: doc[k] for k in vals if k in doc._fields} for doc in self}
        result = super().write(vals)
        for doc in self:
            snap = before.get(doc.id, {})
            if "name" in vals and snap.get("name") != doc.name:
                _s31(self.env, "document_renamed", doc, doc.name)
            if "folder_id" in vals and snap.get("folder_id") != doc.folder_id.id:
                _s31(self.env, "document_moved", doc, doc.name)
            if {"description", "document_type_id", "employee_id"} & set(vals):
                _s31(self.env, "document_metadata_changed", doc, doc.name)
            if "is_locked" in vals:
                _s31(
                    self.env,
                    "document_locked" if doc.is_locked else "document_unlocked",
                    doc,
                    doc.name,
                )
            if "state" in vals and snap.get("state") != doc.state:
                if doc.state == "quarantined":
                    _s31(self.env, "document_quarantined", doc, doc.name, result="failed")
        return result

    def unlink(self):
        for document in self:
            _s31(
                self.env,
                "document_permanently_deleted",
                document,
                _("Permanently deleted %s") % document.name,
            )
        return super().unlink()

    def action_move_to_recycle_bin(self):
        super().action_move_to_recycle_bin()
        for document in self:
            _s31(
                self.env,
                "document_deleted",
                document,
                _("Moved to recycle bin: %s") % document.name,
            )

    def action_archive(self):
        super().action_archive()
        for document in self:
            _s31(self.env, "document_archived", document, document.name)

    def action_restore(self):
        super().action_restore()
        for document in self:
            _s31(self.env, "document_restored", document, document.name)

    def action_deactivate(self):
        super().action_deactivate()
        for document in self:
            _s31(self.env, "document_archived", document, document.name)

    def _create_version_snapshot(self, change_note=""):
        versions = super()._create_version_snapshot(change_note=change_note)
        for version in versions:
            _s31(
                self.env,
                "document_version_added",
                version.document_id,
                _("New version v%s") % version.version_number,
            )
        return versions


class DocFolderSection31(models.Model):
    _inherit = "doc.folder"

    @api.model_create_multi
    def create(self, vals_list):
        folders = super().create(vals_list)
        for folder in folders:
            if folder.folder_type == "organizational":
                _s31(self.env, "folder_created", folder, folder.folder_name)
        return folders

    def write(self, vals):
        rename = "folder_name" in vals
        move = "parent_id" in vals
        archive = {"active", "distribution_status", "deleted_at"} & set(vals)
        access = bool(
            set(vals)
            & {
                "org_access_scope",
                "org_department_ids",
                "org_grade_ids",
                "org_employee_ids",
            }
        )
        desc = "description" in vals or "colour" in vals
        result = super().write(vals)
        for folder in self:
            if folder.folder_type != "organizational":
                continue
            if rename:
                _s31(self.env, "folder_renamed", folder, folder.folder_name)
            if move:
                _s31(self.env, "folder_moved", folder, folder.folder_name)
            if desc:
                _s31(self.env, "folder_description_changed", folder, folder.folder_name)
            if access:
                _s31(self.env, "folder_access_changed", folder, folder.folder_name)
            if archive and not folder.active:
                _s31(self.env, "folder_archived", folder, folder.folder_name)
        return result

    def unlink(self):
        for folder in self:
            if folder.folder_type == "organizational":
                _s31(self.env, "folder_deleted", folder, folder.folder_name)
        return super().unlink()


class DocShareLinkSection31(models.Model):
    _inherit = "doc.share.link"

    @api.model_create_multi
    def create(self, vals_list):
        links = super().create(vals_list)
        for link in links:
            doc = link.document_id or link.attachment_id
            if doc:
                _s31(
                    self.env,
                    "external_link_created",
                    doc,
                    _("Share link created"),
                )
        return links

    def write(self, vals):
        if vals.get("is_revoked"):
            for link in self:
                doc = link.document_id or link.attachment_id
                if doc:
                    _s31(self.env, "external_link_revoked", doc, _("Share revoked"))
        return super().write(vals)

    def log_access(self, action="view", ip_address="", user_agent=""):
        result = super().log_access(
            action=action, ip_address=ip_address, user_agent=user_agent
        )
        for link in self:
            doc = link.document_id or link.attachment_id
            if doc:
                _s31(
                    self.env,
                    "external_link_opened",
                    doc,
                    _("Share link %s") % action,
                    actor_ip=ip_address,
                    actor_user_agent=user_agent,
                )
        return result


class DocLegalHoldSection31(models.Model):
    _inherit = "doc.legal.hold"

    @api.model_create_multi
    def create(self, vals_list):
        holds = super().create(vals_list)
        for hold in holds:
            anchor = hold.document_id or hold.folder_id or hold
            _s31(self.env, "legal_hold_placed", anchor, hold.name)
        return holds

    def write(self, vals):
        if vals.get("active") is False or vals.get("released_at"):
            for hold in self:
                if not hold.active:
                    anchor = hold.document_id or hold.folder_id or hold
                    _s31(self.env, "legal_hold_released", anchor, hold.name)
        return super().write(vals)


class DocDocumentAcknowledgementSection31(models.Model):
    _inherit = "doc.document.acknowledgement"

    @api.model_create_multi
    def create(self, vals_list):
        rows = super().create(vals_list)
        for row in rows:
            document = row.document_id
            if not document:
                continue
            _s31(
                self.env(user=row.user_id),
                "policy_acknowledged",
                document,
                _("Acknowledged %s") % document.name,
                actor_id=row.user_id.id,
                occurred_at=row.acknowledged_at,
                what_path=_("My Workspace → Shared"),
            )
        return rows


class DocOrganizationalApprovalRequestSection31(models.Model):
    _inherit = "doc.organizational.approval.request"

    @api.model_create_multi
    def create(self, vals_list):
        rows = super().create(vals_list)
        if not self.env.context.get("audit_suppress_approval_create"):
            for row in rows:
                anchor = row.document_id or row.folder_id or row
                _s31(
                    self.env,
                    "approval_request_created",
                    anchor,
                    row.name,
                )
        return rows

    def write(self, vals):
        if "state" in vals:
            mapping = {
                "approved": "approval_approved",
                "rejected": "approval_rejected",
                "cancelled": "approval_withdrawn",
                "expired": "approval_withdrawn",
            }
            for row in self:
                action = mapping.get(vals["state"])
                if action:
                    anchor = row.document_id or row.folder_id or row
                    _s31(self.env, action, anchor, row.name)
        if vals.get("escalated_at"):
            for row in self:
                anchor = row.document_id or row.folder_id or row
                _s31(self.env, "approval_escalated", anchor, row.name)
        if vals.get("reminded_at"):
            for row in self:
                anchor = row.document_id or row.folder_id or row
                _s31(self.env, "approval_reminded", anchor, row.name)
        return super().write(vals)


class DocEmployeeFileSection31(models.Model):
    _inherit = "doc.employee.file"

    @api.model_create_multi
    def create(self, vals_list):
        rows = super().create(vals_list)
        for row in rows:
            _s31(
                self.env,
                "ef_file_initialized",
                row,
                row.display_name,
            )
        return rows


class DocQuarantineFileSection31(models.Model):
    _inherit = "doc.quarantine.file"

    @api.model_create_multi
    def create(self, vals_list):
        rows = super().create(vals_list)
        for row in rows:
            if row.document_id:
                _s31(
                    self.env,
                    "document_quarantined",
                    row.document_id,
                    _("Quarantined %s") % row.document_id.name,
                    result="failed",
                )
        return rows


class DocPolicyEmployeeAssignmentSection31(models.Model):
    _inherit = "doc.policy.employee.assignment"

    @api.model_create_multi
    def create(self, vals_list):
        rows = super().create(vals_list)
        for row in rows:
            doc = row.document_id
            if not doc:
                continue
            _s31(self.env, "policy_assigned", doc, doc.name)
            if row.requested_signature:
                _s31(self.env, "policy_signature_required", doc, doc.name)
        return rows


class DocOrganizationalPolicySection31(models.Model):
    _inherit = "doc.organizational.policy"

    @api.model_create_multi
    def create(self, vals_list):
        rows = super().create(vals_list)
        for row in rows:
            _s31(self.env, "policy_added", row.document_id or row.folder_id, row.name)
        return rows

    def write(self, vals):
        before = {p.id: p.lifecycle_status for p in self}
        result = super().write(vals)
        if "lifecycle_status" in vals:
            for policy in self:
                status = policy.lifecycle_status
                prev = before.get(policy.id)
                if status == prev:
                    continue
                anchor = policy.document_id or policy.folder_id
                if status == "active":
                    _s31(self.env, "policy_activated", anchor, policy.name)
                elif status == "archived":
                    _s31(self.env, "policy_archived", anchor, policy.name)
        return result


class DocIntelligenceMessageSection31(models.Model):
    _inherit = "doc.intelligence.message"

    @api.model_create_multi
    def create(self, vals_list):
        rows = super().create(vals_list)
        for row in rows:
            if row.role == "user" and row.content:
                _s31(
                    self.env,
                    "ai_assistant_used",
                    self.env.company,
                    _("AI assistant question"),
                    details="conversation_id=%s" % (row.conversation_id.id or 0),
                    module="document_intelligence",
                )
        return rows
