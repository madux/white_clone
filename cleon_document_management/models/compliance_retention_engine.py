# -*- coding: utf-8 -*-
"""Daily compliance retention engine (Employee Files documents only)."""

from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import UserError


class ComplianceRetentionEngine(models.AbstractModel):
    _name = "doc.compliance.retention.engine"
    _description = "Compliance retention evaluation and actions"

    @api.model
    def _cron_run_all_policies(self):
        policies = self.env["doc.compliance.policy"].sudo().search(
            [
                ("active", "=", True),
                ("lifecycle_status", "=", "active"),
                ("policy_type_id.code", "=", "retention"),
            ]
        )
        for policy in policies:
            today = fields.Date.context_today(policy)
            if policy.effective_date and policy.effective_date > today:
                continue
            self.run_policy(policy)

    @api.model
    def run_policy(self, policy):
        policy.ensure_one()
        if not policy._is_retention_policy():
            return False
        version = policy._ensure_current_version()
        today = fields.Date.context_today(self)
        Item = self.env["doc.compliance.retention.item"].sudo()
        RetentionRule = self.env["doc.retention.policy"].sudo()
        documents = self._documents_for_policy(policy)
        touched_items = Item.browse()
        for document in documents:
            rule = RetentionRule.search(
                [
                    ("active", "=", True),
                    ("document_type_id", "=", document.document_type_id.id),
                ],
                limit=1,
            )
            if not rule:
                continue
            version_rows = document.version_ids
            if not version_rows:
                version_rows = [self.env["doc.document.version"].browse()]
            for doc_version in version_rows:
                item = self._upsert_item(
                    policy, version, document, doc_version, rule, today
                )
                if item:
                    touched_items |= item
        self._process_items(touched_items, policy, today)
        reported = touched_items.filtered(lambda i: i.state == "reported")
        run = self.env["doc.compliance.evaluation.run"].sudo().create(
            {
                "policy_id": policy.id,
                "run_type": "automatic",
                "evaluated_at": fields.Datetime.now(),
                "employee_count": len(touched_items),
                "compliant_count": len(
                    touched_items.filtered(lambda i: i.state == "retaining")
                ),
                "non_compliant_count": len(
                    touched_items.filtered(
                        lambda i: i.state
                        in (
                            "due_archive",
                            "due_delete",
                            "blocked_backup",
                            "blocked_error",
                            "on_hold",
                            "pending_owner",
                        )
                    )
                ),
                "partial_count": len(reported),
            }
        )
        self.env["doc.compliance.audit.log"].sudo().log_event(
            "retention_run_complete",
            _("Retention run completed for %s (%s items, %s reported)")
            % (policy.name, len(touched_items), len(reported)),
            policy=policy,
            run=run,
        )
        policy.write({"last_run_at": fields.Datetime.now()})
        return run

    @api.model
    def _documents_for_policy(self, policy):
        Document = self.env["doc.document"].sudo()
        employee_ids = policy._target_employees().ids
        if not employee_ids:
            return Document.browse()
        domain = [
            ("employee_id", "in", employee_ids),
            ("document_type_id", "in", policy.document_type_ids.ids),
            ("folder_id.folder_type", "=", "employee"),
            ("deleted_at", "=", False),
        ]
        return Document.search(domain)

    @api.model
    def _far_future(self):
        return fields.Date.from_string("9999-12-31")

    @api.model
    def _document_on_legal_hold(self, document):
        document.ensure_one()
        return bool(document.legal_hold_active)

    @api.model
    def _backup_blocks_action(self, rule, document):
        return bool(
            rule
            and rule.backup_required
            and not document.backup_confirmed_at
        )

    @api.model
    def _compute_schedule_state(self, document, archive_due, delete_due, today):
        """Schedule-only state before safeguards and action mode."""
        archived = document.distribution_status == "archived"
        if not archived:
            if archive_due and today >= archive_due:
                return "due_archive"
            return "retaining"
        if delete_due and today >= delete_due:
            return "due_delete"
        return "archived"

    @api.model
    def _upsert_item(self, policy, version, document, doc_version, rule, today):
        Item = self.env["doc.compliance.retention.item"].sudo()
        version_id = doc_version.id if doc_version else False
        item = Item.search(
            [
                ("policy_id", "=", policy.id),
                ("document_id", "=", document.id),
                ("document_version_id", "=", version_id),
            ],
            limit=1,
        )
        if item and item.state == "deleted":
            return item

        clock_start = document._retention_clock_start_date(
            rule.clock_start or "upload_date", doc_version
        )
        archive_due = rule.archive_due_date(clock_start)
        delete_due = rule.delete_due_date(clock_start)
        schedule_state = self._compute_schedule_state(
            document, archive_due, delete_due, today
        )

        state = schedule_state
        reported_reason = False
        if self._document_on_legal_hold(document):
            state = "on_hold"
        elif self._backup_blocks_action(rule, document):
            archive_reached = today >= (archive_due or today)
            delete_reached = (
                document.distribution_status == "archived"
                and today >= (delete_due or self._far_future())
            )
            if archive_reached or delete_reached:
                state = "blocked_backup"

        vals = {
            "policy_id": policy.id,
            "policy_version_id": version.id,
            "document_id": document.id,
            "document_version_id": version_id,
            "retention_rule_id": rule.id,
            "clock_start": clock_start,
            "archive_due": archive_due,
            "delete_due": delete_due,
            "state": state,
            "reported_reason": reported_reason,
            "last_evaluated_at": fields.Datetime.now(),
        }
        if state != "blocked_backup":
            vals["backup_block_notified_at"] = False
        if item:
            preserve = item.state in ("pending_owner", "blocked_error") and state not in (
                "on_hold",
                "blocked_backup",
                "deleted",
            )
            if not preserve:
                item.write(vals)
            else:
                item.write(
                    {
                        k: vals[k]
                        for k in vals
                        if k
                        not in ("state", "reported_reason")
                    }
                )
        else:
            item = Item.create(vals)
        return item

    @api.model
    def _process_items(self, items, policy, today):
        mode = policy.retention_action_mode or "report_only"
        for item in items:
            if item.state == "deleted":
                continue
            document = item.document_id.sudo()
            rule = item.retention_rule_id

            if self._document_on_legal_hold(document):
                if item.state != "on_hold":
                    item.write({"state": "on_hold"})
                    self._audit_safeguard(item, policy, "legal_hold")
                continue

            if self._backup_blocks_action(rule, document):
                if item.state != "blocked_backup":
                    item.write({"state": "blocked_backup"})
                    self._audit_safeguard(item, policy, "backup")
                self._notify_backup_blocked(item, policy)
                continue

            if item.state == "blocked_backup":
                continue

            archived = document.distribution_status == "archived"
            archive_due = item.archive_due
            delete_due = item.delete_due

            if not archived and archive_due and today >= archive_due:
                self._process_archive_leg(item, policy, today, mode)
                document.invalidate_recordset(["distribution_status"])
                archived = document.distribution_status == "archived"

            if archived and delete_due and today >= delete_due:
                self._process_delete_leg(item, policy, today, mode)
                continue

            if item.state in ("due_archive", "due_delete", "pending_owner", "blocked_error"):
                item.write({"state": self._compute_schedule_state(
                    document, archive_due, delete_due, today
                )})

    @api.model
    def _process_archive_leg(self, item, policy, today, mode):
        if mode == "report_only":
            item.write({"state": "reported", "reported_reason": "archive"})
            return
        if mode == "owner_approval":
            self._ensure_owner_batch(item, policy, today, "archive")
            return
        if mode == "automatic":
            self._apply_archive(item, policy)

    @api.model
    def _process_delete_leg(self, item, policy, today, mode):
        document = item.document_id
        if document.distribution_status != "archived":
            return
        if mode == "report_only":
            item.write({"state": "reported", "reported_reason": "delete"})
            return
        if mode == "owner_approval":
            notice_days = max(policy.retention_owner_notice_days or 14, 1)
            if not item.delete_notice_sent_at:
                item.write({"delete_notice_sent_at": today})
                self._send_delete_notice(item, policy)
                return
            notice_clear = item.delete_notice_sent_at + timedelta(days=notice_days)
            if today < notice_clear:
                return
            self._ensure_owner_batch(item, policy, today, "delete")
            return
        if mode == "automatic":
            self._apply_delete(item, policy)

    @api.model
    def _ensure_owner_batch(self, item, policy, today, action):
        due = item.archive_due if action == "archive" else item.delete_due
        if not due:
            return
        notice = max(policy.retention_owner_notice_days or 14, 1)
        notify_from = due - timedelta(days=notice)
        if action == "archive" and today < notify_from:
            return
        if action == "archive" and item.state not in (
            "due_archive",
            "pending_owner",
            "blocked_error",
        ):
            return
        if action == "delete" and item.state not in (
            "due_delete",
            "archived",
            "pending_owner",
            "blocked_error",
        ):
            return

        owner = policy.owner_id or item.document_id.owner_id
        if not owner:
            return
        Batch = self.env["doc.compliance.retention.owner.batch"].sudo()
        batch = Batch.search(
            [
                ("policy_id", "=", policy.id),
                ("owner_id", "=", owner.id),
                ("action", "=", action),
                ("due_date", "=", due),
                ("state", "=", "open"),
            ],
            limit=1,
        )
        if not batch:
            batch = Batch.create(
                {
                    "policy_id": policy.id,
                    "owner_id": owner.id,
                    "action": action,
                    "due_date": due,
                    "state": "open",
                }
            )
            batch._schedule_owner_notice(policy, action, due)
        item.write({"owner_batch_id": batch.id, "state": "pending_owner"})

    @api.model
    def _send_delete_notice(self, item, policy):
        owner = policy.owner_id or item.document_id.owner_id
        if not owner:
            return
        document = item.document_id
        policy._schedule_activity(
            owner,
            _("Retention: documents due for deletion"),
            _(
                "“%s” (and related items in this policy) are due for deletion under "
                "policy “%s”. Review before the notice period ends."
            )
            % (document.name, policy.name),
            item.delete_due or fields.Date.context_today(policy),
        )
        self.env["doc.compliance.audit.log"].sudo().log_event(
            "retention_delete_notice",
            _("Delete notice for %s under %s") % (document.name, policy.name),
            policy=policy,
        )

    @api.model
    def _notify_backup_blocked(self, item, policy):
        if item.backup_block_notified_at:
            return
        owner = policy.owner_id or item.document_id.owner_id
        if not owner:
            return
        document = item.document_id
        policy._schedule_activity(
            owner,
            _("Retention blocked: backup required"),
            _(
                "“%s” cannot be archived or deleted until backup is confirmed "
                "(policy “%s”)."
            )
            % (document.name, policy.name),
            fields.Date.context_today(policy),
        )
        item.write({"backup_block_notified_at": fields.Datetime.now()})
        self.env["doc.compliance.audit.log"].sudo().log_event(
            "retention_backup_blocked",
            _("Backup block for %s under %s") % (document.name, policy.name),
            policy=policy,
        )

    @api.model
    def _audit_safeguard(self, item, policy, kind):
        document = item.document_id
        self.env["doc.compliance.audit.log"].sudo().log_event(
            "retention_safeguard",
            _("Retention safeguard (%s) for %s under %s")
            % (kind, document.name, policy.name),
            policy=policy,
        )

    @api.model
    def _apply_archive(self, item, policy):
        document = item.document_id.sudo()
        if self._document_on_legal_hold(document):
            item.write({"state": "on_hold", "last_error": False})
            return
        rule = item.retention_rule_id
        if self._backup_blocks_action(rule, document):
            item.write({"state": "blocked_backup", "last_error": False})
            self._notify_backup_blocked(item, policy)
            return
        try:
            if document.distribution_status != "archived":
                document.with_context(skip_policy_admin_check=True).action_archive()
            item.write({"state": "archived", "last_error": False})
            self.env["doc.compliance.audit.log"].sudo().log_event(
                "retention_archived",
                _("Archived %s under retention policy %s")
                % (document.name, policy.name),
                policy=policy,
            )
        except (UserError, Exception) as error:
            item.write(
                {
                    "state": "blocked_error",
                    "last_error": str(error),
                }
            )
            self.env["doc.compliance.audit.log"].sudo().log_event(
                "retention_action_failed",
                _("Archive failed for %s: %s") % (document.name, error),
                policy=policy,
            )

    @api.model
    def _apply_delete(self, item, policy):
        document = item.document_id.sudo()
        if document.distribution_status != "archived":
            return
        if self._document_on_legal_hold(document):
            item.write({"state": "on_hold", "last_error": False})
            return
        rule = item.retention_rule_id
        if self._backup_blocks_action(rule, document):
            item.write({"state": "blocked_backup", "last_error": False})
            self._notify_backup_blocked(item, policy)
            return
        Tombstone = self.env["doc.document.deletion.record"].sudo()
        try:
            if not document.deleted_at:
                document.with_context(
                    skip_policy_admin_check=True
                ).action_move_to_recycle_bin()
            Tombstone.create(
                {
                    "document_id": document.id,
                    "document_name": document.name,
                    "employee_id": document.employee_id.id,
                    "document_type_id": document.document_type_id.id,
                    "policy_id": policy.id,
                    "retention_item_id": item.id,
                    "archive_due": item.archive_due,
                    "delete_due": item.delete_due,
                    "policy_version_id": item.policy_version_id.id,
                }
            )
            item.write({"state": "deleted", "last_error": False})
            self.env["doc.compliance.audit.log"].sudo().log_event(
                "retention_deleted",
                _("Deleted %s under retention policy %s")
                % (document.name, policy.name),
                policy=policy,
            )
            owner = document.owner_id
            if owner:
                policy._schedule_activity(
                    owner,
                    _("Document deleted by retention policy"),
                    _("“%s” was removed per policy “%s”.")
                    % (document.name, policy.name),
                    fields.Date.context_today(policy),
                )
        except (UserError, Exception) as error:
            item.write(
                {
                    "state": "blocked_error",
                    "last_error": str(error),
                }
            )
            self.env["doc.compliance.audit.log"].sudo().log_event(
                "retention_action_failed",
                _("Delete failed for %s: %s") % (document.name, error),
                policy=policy,
            )

    @api.model
    def preview_counts(self, document_type_ids, policy_scope):
        """Return archive/delete counts due within 90 days for wizard preview."""
        Policy = self.env["doc.compliance.policy"].sudo()
        fake = Policy.new(
            {
                "applies_to": policy_scope.get("applies_to") or "all",
            }
        )
        fake.department_ids = self.env["hr.department"].browse(
            policy_scope.get("department_ids") or []
        )
        fake.grade_ids = self.env["hr.grade"].browse(
            policy_scope.get("grade_ids") or []
        )
        fake.employee_ids = self.env["hr.employee"].browse(
            policy_scope.get("employee_ids") or []
        )
        fake.work_location_ids = self.env["hr.work.location"].browse(
            policy_scope.get("work_location_ids") or []
        )
        if "hr.core_employment_type" in self.env:
            fake.employment_type_ids = self.env["hr.core_employment_type"].browse(
                policy_scope.get("employment_type_ids") or []
            )
        fake.branch_ids = self.env["multi.branch"].browse(
            policy_scope.get("branch_ids") or []
        )
        fake.document_type_ids = self.env["doc.document.type"].browse(
            document_type_ids or []
        )
        today = fields.Date.context_today(self)
        horizon = today + timedelta(days=90)
        RetentionRule = self.env["doc.retention.policy"].sudo()
        archive_count = 0
        delete_count = 0
        for document in self._documents_for_policy(fake):
            rule = RetentionRule.search(
                [
                    ("active", "=", True),
                    ("document_type_id", "=", document.document_type_id.id),
                ],
                limit=1,
            )
            if not rule:
                continue
            clock = document._retention_clock_start_date(
                rule.clock_start or "upload_date", False
            )
            archive_due = rule.archive_due_date(clock)
            delete_due = rule.delete_due_date(clock)
            if archive_due and today <= archive_due <= horizon:
                archive_count += 1
            if delete_due and today <= delete_due <= horizon:
                delete_count += 1
        return {"archive_within_90_days": archive_count, "delete_within_90_days": delete_count}


class ComplianceRetentionOwnerBatch(models.Model):
    _inherit = "doc.compliance.retention.owner.batch"

    def _schedule_owner_notice(self, policy, action, due_date):
        self.ensure_one()
        if self.notified_at:
            return
        label = "archive" if action == "archive" else "delete"
        policy._schedule_activity(
            self.owner_id,
            _("Retention approval: %s due %s") % (label, due_date),
            _(
                "Review and approve the retention %s batch for policy “%s” "
                "(due %s)."
            )
            % (label, policy.name, due_date),
            due_date,
        )
        self.write({"notified_at": fields.Datetime.now()})
