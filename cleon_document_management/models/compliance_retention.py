# -*- coding: utf-8 -*-
"""Section 12 — compliance retention policy fields, tracking, and validation."""

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

RETENTION_ACTION_MODES = [
    ("report_only", "Report only"),
    ("owner_approval", "Owner approval batch"),
    ("automatic", "Automatic archive/delete"),
]

RETENTION_ITEM_STATES = [
    ("retaining", "Retaining"),
    ("due_archive", "Due to archive"),
    ("archived", "Archived"),
    ("due_delete", "Due to delete"),
    ("on_hold", "On legal hold"),
    ("blocked_backup", "Blocked — backup required"),
    ("blocked_error", "Blocked — action failed"),
    ("pending_owner", "Pending owner approval"),
    ("deleted", "Deleted"),
    ("reported", "Reported only"),
]

RETENTION_REPORT_REASONS = [
    ("archive", "Due to archive"),
    ("delete", "Due to delete"),
]


class DocDocumentDeletionRecord(models.Model):
    _name = "doc.document.deletion.record"
    _description = "Compliance retention deletion tombstone"
    _order = "deleted_at desc, id desc"

    document_id = fields.Many2one("doc.document", ondelete="set null", index=True)
    document_name = fields.Char(required=True)
    employee_id = fields.Many2one("hr.employee", ondelete="set null")
    document_type_id = fields.Many2one("doc.document.type", ondelete="set null")
    policy_id = fields.Many2one("doc.compliance.policy", ondelete="set null", index=True)
    retention_item_id = fields.Many2one(
        "doc.compliance.retention.item", ondelete="set null"
    )
    reason = fields.Selection(
        [("compliance_retention", "Compliance retention")],
        default="compliance_retention",
        required=True,
    )
    deleted_at = fields.Datetime(default=fields.Datetime.now, required=True)
    deleted_by_id = fields.Many2one("res.users", default=lambda self: self.env.user)
    archive_due = fields.Date()
    delete_due = fields.Date()
    policy_version_id = fields.Many2one("doc.compliance.policy.version", ondelete="set null")


class ComplianceRetentionOwnerBatch(models.Model):
    _name = "doc.compliance.retention.owner.batch"
    _description = "Retention owner approval batch"
    _order = "due_date, id"

    policy_id = fields.Many2one(
        "doc.compliance.policy", required=True, ondelete="cascade", index=True
    )
    owner_id = fields.Many2one("res.users", required=True, index=True)
    action = fields.Selection(
        [("archive", "Archive"), ("delete", "Delete")],
        required=True,
    )
    due_date = fields.Date(required=True, index=True)
    state = fields.Selection(
        [
            ("open", "Open"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("expired", "Expired"),
        ],
        default="open",
        required=True,
        index=True,
    )
    notified_at = fields.Datetime()
    backup_blocked_notified_at = fields.Datetime(
        string="Backup block notice sent",
    )
    item_ids = fields.One2many(
        "doc.compliance.retention.item",
        "owner_batch_id",
        string="Items",
    )

    def action_approve(self):
        for batch in self.filtered(lambda b: b.state == "open"):
            batch.write({"state": "approved"})
            batch.item_ids._execute_batch_action(batch.action)

    def action_reject(self):
        open_batches = self.filtered(lambda b: b.state == "open")
        for batch in open_batches:
            for item in batch.item_ids:
                if batch.action == "archive":
                    item.write({"state": "due_archive", "owner_batch_id": False})
                else:
                    item.write({"state": "due_delete", "owner_batch_id": False})
        open_batches.write({"state": "rejected"})


class ComplianceRetentionItem(models.Model):
    _name = "doc.compliance.retention.item"
    _description = "Compliance retention tracking per document version"
    _order = "archive_due, id"

    policy_id = fields.Many2one(
        "doc.compliance.policy", required=True, ondelete="cascade", index=True
    )
    policy_version_id = fields.Many2one(
        "doc.compliance.policy.version", ondelete="set null", index=True
    )
    document_id = fields.Many2one(
        "doc.document", required=True, ondelete="cascade", index=True
    )
    document_version_id = fields.Many2one(
        "doc.document.version", ondelete="cascade", index=True
    )
    retention_rule_id = fields.Many2one("doc.retention.policy", ondelete="set null")
    clock_start = fields.Date()
    archive_due = fields.Date(index=True)
    delete_due = fields.Date(index=True)
    state = fields.Selection(RETENTION_ITEM_STATES, default="retaining", index=True)
    reported_reason = fields.Selection(
        RETENTION_REPORT_REASONS,
        string="Report reason",
        index=True,
    )
    delete_notice_sent_at = fields.Date(
        string="Delete notice sent",
        help="When the owner was notified that delete is approaching or due.",
    )
    backup_block_notified_at = fields.Datetime()
    last_error = fields.Text(string="Last action error")
    owner_batch_id = fields.Many2one(
        "doc.compliance.retention.owner.batch",
        ondelete="set null",
        index=True,
    )
    last_evaluated_at = fields.Datetime()

    _sql_constraints = [
        (
            "retention_item_unique",
            "unique(policy_id, document_id, document_version_id)",
            "Each document version can only be tracked once per retention policy.",
        ),
    ]

    def _execute_batch_action(self, action):
        Engine = self.env["doc.compliance.retention.engine"]
        for item in self:
            policy = item.policy_id
            if action == "archive" and item.state in (
                "due_archive",
                "pending_owner",
                "blocked_error",
            ):
                Engine._apply_archive(item, policy)
            elif action == "delete" and item.state in (
                "due_delete",
                "archived",
                "pending_owner",
                "blocked_error",
            ):
                if item.document_id.distribution_status != "archived":
                    continue
                Engine._apply_delete(item, policy)

    def to_report_dict(self):
        self.ensure_one()
        document = self.document_id
        employee = document.employee_id
        return {
            "id": self.id,
            "policy_id": self.policy_id.id,
            "policy": self.policy_id.name,
            "document_id": document.id,
            "document": document.name,
            "employee_id": employee.id if employee else False,
            "employee": employee.name if employee else "",
            "document_type": document.document_type_id.name
            if document.document_type_id
            else "",
            "state": self.state,
            "reported_reason": self.reported_reason or "",
            "archive_due": str(self.archive_due or ""),
            "delete_due": str(self.delete_due or ""),
            "clock_start": str(self.clock_start or ""),
            "last_evaluated_at": str(self.last_evaluated_at or ""),
            "last_error": self.last_error or "",
        }


class CompliancePolicyRetention(models.Model):
    _inherit = "doc.compliance.policy"

    retention_owner_notice_days = fields.Integer(
        string="Owner notice (days before action)",
        default=14,
    )

    def _is_retention_policy(self):
        self.ensure_one()
        return bool(
            self.policy_type_id and self.policy_type_id.code == "retention"
        )

    @api.constrains(
        "policy_type_id",
        "document_type_ids",
        "retention_action_mode",
        "retention_owner_notice_days",
        "active",
        "lifecycle_status",
    )
    def _check_retention_compliance_policy(self):
        RetentionPolicy = self.env["doc.retention.policy"].sudo()
        for policy in self:
            if not policy._is_retention_policy():
                continue
            if policy.lifecycle_status == "draft" or not policy.active:
                continue
            if policy.retention_action_mode == "owner_approval":
                if not policy.retention_owner_notice_days or policy.retention_owner_notice_days < 1:
                    raise ValidationError(
                        _("Owner approval mode requires notice days of at least 1.")
                    )
            if not policy.document_type_ids:
                raise ValidationError(
                    _("Select at least one document type for this retention policy.")
                )
            for document_type in policy.document_type_ids:
                rule = RetentionPolicy.search(
                    [
                        ("active", "=", True),
                        ("document_type_id", "=", document_type.id),
                    ],
                    limit=1,
                )
                if not rule or not rule.is_compliance_complete():
                    raise ValidationError(
                        _(
                            "Retention settings for document type “%s” are missing or "
                            "incomplete. Configure them under Settings → Retention."
                        )
                        % document_type.name
                    )
            overlap = self.search(
                [
                    ("id", "!=", policy.id),
                    ("active", "=", True),
                    ("lifecycle_status", "=", "active"),
                    ("policy_type_id.code", "=", "retention"),
                    ("document_type_ids", "in", policy.document_type_ids.ids),
                ],
                limit=1,
            )
            if overlap:
                raise ValidationError(
                    _(
                        "Another active retention policy already covers one of these "
                        "document types (%s)."
                    )
                    % overlap.name
                )

    def _validate_document_types_for_activation(self):
        retention = self.filtered(lambda p: p._is_retention_policy())
        other = self - retention
        for policy in retention:
            policy._check_retention_compliance_policy()
        if other:
            return super(CompliancePolicyRetention, other)._validate_document_types_for_activation()
        return True

    def retention_fields_api(self):
        self.ensure_one()
        return {
            "retention_action_mode": self.retention_action_mode or "report_only",
            "retention_owner_notice_days": self.retention_owner_notice_days or 0,
        }
