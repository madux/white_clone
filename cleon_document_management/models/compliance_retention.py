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
    ("pending_owner", "Pending owner approval"),
    ("deleted", "Deleted"),
    ("reported", "Reported only"),
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
        self.filtered(lambda b: b.state == "open").write({"state": "rejected"})


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
            if action == "archive" and item.state in ("due_archive", "pending_owner"):
                Engine._apply_archive(item, policy)
            elif action == "delete" and item.state in (
                "due_delete",
                "archived",
                "pending_owner",
            ):
                Engine._apply_delete(item, policy)


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
