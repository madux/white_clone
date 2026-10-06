# -*- coding: utf-8 -*-
"""Daily compliance retention engine (Employee Files documents only)."""

from datetime import timedelta

from odoo import api, fields, models, _


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
                        in ("due_archive", "due_delete", "blocked_backup", "on_hold")
                    )
                ),
            }
        )
        self.env["doc.compliance.audit.log"].sudo().log_event(
            "retention_run_complete",
            _("Retention run completed for %s (%s items)") % (policy.name, len(touched_items)),
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
        clock_start = document._retention_clock_start_date(
            rule.clock_start or "upload_date", doc_version
        )
        archive_due = rule.archive_due_date(clock_start)
        delete_due = rule.delete_due_date(clock_start)
        state = "retaining"
        if document.legal_hold_active:
            state = "on_hold"
        elif rule.backup_required and not document.backup_confirmed_at:
            if today >= (archive_due or today):
                state = "blocked_backup"
        elif today >= (delete_due or fields.Date.from_string("9999-12-31")):
            state = "due_delete"
        elif document.distribution_status == "archived":
            state = "archived" if today < (delete_due or today) else "due_delete"
        elif today >= (archive_due or fields.Date.from_string("9999-12-31")):
            state = "due_archive"
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
            "last_evaluated_at": fields.Datetime.now(),
        }
        if item:
            if item.state == "deleted":
                return item
            item.write(vals)
        else:
            item = Item.create(vals)
        return item

    @api.model
    def _process_items(self, items, policy, today):
        mode = policy.retention_action_mode or "report_only"
        for item in items:
            if item.state in ("deleted", "on_hold", "blocked_backup"):
                continue
            if mode == "report_only":
                if item.state in ("due_archive", "due_delete"):
                    item.write({"state": "reported"})
                continue
            if mode == "owner_approval":
                self._maybe_owner_batch(item, policy, today)
                continue
            if mode == "automatic":
                if item.state == "due_archive":
                    self._apply_archive(item, policy)
                elif item.state in ("due_delete", "archived"):
                    if item.document_id.distribution_status == "archived":
                        self._apply_delete(item, policy)

    @api.model
    def _maybe_owner_batch(self, item, policy, today):
        notice = max(policy.retention_owner_notice_days or 14, 1)
        owner = policy.owner_id or item.document_id.owner_id
        if not owner:
            return
        for action, due in (("archive", item.archive_due), ("delete", item.delete_due)):
            if not due:
                continue
            notify_from = due - timedelta(days=notice)
            if today < notify_from or today > due:
                continue
            if action == "archive" and item.state != "due_archive":
                continue
            if action == "delete" and item.state not in ("due_delete", "archived"):
                continue
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
    def _apply_archive(self, item, policy):
        document = item.document_id.sudo()
        if document.legal_hold_active:
            item.write({"state": "on_hold"})
            return
        rule = item.retention_rule_id
        if rule and rule.backup_required and not document.backup_confirmed_at:
            item.write({"state": "blocked_backup"})
            return
        if document.distribution_status != "archived":
            document.with_context(skip_policy_admin_check=True).action_archive()
        item.write({"state": "archived"})
        self.env["doc.compliance.audit.log"].sudo().log_event(
            "retention_archived",
            _("Archived %s under retention policy %s")
            % (document.name, policy.name),
            policy=policy,
        )

    @api.model
    def _apply_delete(self, item, policy):
        document = item.document_id.sudo()
        if document.legal_hold_active:
            item.write({"state": "on_hold"})
            return
        rule = item.retention_rule_id
        if rule and rule.backup_required and not document.backup_confirmed_at:
            item.write({"state": "blocked_backup"})
            return
        Tombstone = self.env["doc.document.deletion.record"].sudo()
        if not document.deleted_at:
            document.with_context(skip_policy_admin_check=True).action_move_to_recycle_bin()
        Tombstone.create(
            {
                "document_id": document.id,
                "document_name": document.name,
                "employee_id": document.employee_id.id,
                "document_type_id": document.document_type_id.id,
                "policy_id": policy.id,
                "retention_item_id": item.id,
            }
        )
        item.write({"state": "deleted"})
        self.env["doc.compliance.audit.log"].sudo().log_event(
            "retention_deleted",
            _("Deleted %s under retention policy %s") % (document.name, policy.name),
            policy=policy,
        )
        owner = document.owner_id
        if owner:
            policy._schedule_activity(
                owner,
                _("Document deleted by retention policy"),
                _("“%s” was removed per policy “%s”.") % (document.name, policy.name),
                fields.Date.context_today(policy),
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
