# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class ComplianceReviewMilestone(models.Model):
    _name = "doc.compliance.review.milestone"
    _description = "Review schedule milestone"
    _order = "sequence, id"

    policy_id = fields.Many2one(
        "doc.compliance.policy", required=True, ondelete="cascade", index=True
    )
    sequence = fields.Integer(default=10)
    name = fields.Char(required=True)
    due_days = fields.Integer(string="Due within (days)", default=90)
    grace_period_days = fields.Integer(default=0)
    repeat_months = fields.Integer(
        string="Repeat every (months)", default=0, help="0 = one-off milestone."
    )
    reviewer_source = fields.Selection(
        [
            ("line_manager", "Line manager"),
            ("policy_owner", "Policy owner"),
            ("assigned_reviewer", "Assigned reviewer"),
        ],
        default="line_manager",
    )


class ComplianceTask(models.Model):
    _name = "doc.compliance.task"
    _description = "Compliance request task instance"
    _order = "due_date asc, id desc"

    policy_id = fields.Many2one("doc.compliance.policy", required=True, ondelete="cascade")
    employee_id = fields.Many2one("hr.employee", required=True, ondelete="cascade")
    cycle_id = fields.Many2one(
        "doc.compliance.request.cycle",
        ondelete="cascade",
        index=True,
    )
    definition_id = fields.Many2one(
        "doc.compliance.request.task.definition",
        ondelete="set null",
    )
    task_type = fields.Selection(
        [
            ("read", "Read"),
            ("acknowledge", "Acknowledge"),
            ("declaration", "Declaration"),
            ("complete_form", "Complete form"),
            ("upload_evidence", "Upload evidence"),
            ("custom", "Custom"),
        ],
        required=True,
        default="acknowledge",
    )
    requirement = fields.Selection(
        [("required", "Required"), ("optional", "Optional")],
        default="required",
    )
    title = fields.Char(required=True)
    instructions = fields.Text()
    due_date = fields.Date(index=True)
    status = fields.Selection(
        [
            ("todo", "To do"),
            ("waiting", "Waiting for verification"),
            ("done", "Done"),
            ("withdrawn", "Withdrawn"),
            ("reopened", "Reopened"),
            ("cancelled", "Cancelled"),
        ],
        default="todo",
        required=True,
        index=True,
    )
    content_version = fields.Char(
        help="Content version read or acknowledged for audit.",
    )
    acknowledged_version = fields.Char(
        help="Legacy alias for content version.",
    )
    declaration_comment = fields.Text()
    declaration_issue_declared = fields.Boolean(default=False)
    completed_at = fields.Datetime()
    rejection_reason = fields.Text()
    document_id = fields.Many2one("doc.document", ondelete="set null")
    submission_id = fields.Many2one("doc.template.submission", ondelete="set null")
    linked_org_policy_id = fields.Many2one(
        "doc.organizational.policy", ondelete="set null"
    )
    linked_document_id = fields.Many2one("doc.document", ondelete="set null")
    linked_form_id = fields.Many2one("doc.template", ondelete="set null")
    evidence_document_type_id = fields.Many2one("doc.document.type", ondelete="set null")
    declaration_text = fields.Text()

    def to_api_dict(self):
        self.ensure_one()
        linked_document = self.linked_document_id
        if not linked_document and self.linked_org_policy_id:
            linked_document = self.linked_org_policy_id.assignable_document()
        return {
            "id": self.id,
            "policy_id": self.policy_id.id,
            "policy_name": self.policy_id.name,
            "cycle_id": self.cycle_id.id if self.cycle_id else False,
            "definition_id": self.definition_id.id if self.definition_id else False,
            "task_type": self.task_type,
            "requirement": self.requirement,
            "title": self.title,
            "instructions": self.instructions or "",
            "due_date": str(self.due_date or ""),
            "status": self.status,
            "content_version": self.content_version or self.acknowledged_version or "",
            "declaration_text": self.declaration_text or "",
            "declaration_comment": self.declaration_comment or "",
            "declaration_issue_declared": bool(self.declaration_issue_declared),
            "document_id": self.document_id.id or False,
            "submission_id": self.submission_id.id or False,
            "linked_org_policy_id": self.linked_org_policy_id.id or False,
            "linked_org_policy_name": self.linked_org_policy_id.name or "",
            "linked_document_id": linked_document.id if linked_document else False,
            "linked_document_name": (
                linked_document.name if linked_document else self.linked_document_id.name or ""
            ),
            "linked_folder_id": linked_document.folder_id.id if linked_document else False,
            "linked_form_id": self.linked_form_id.id or False,
            "evidence_document_type_id": self.evidence_document_type_id.id or False,
            "rejection_reason": self.rejection_reason or "",
        }


class ComplianceVerificationItem(models.Model):
    _name = "doc.compliance.verification.item"
    _description = "Routed verification work item"
    _order = "create_date desc"

    policy_id = fields.Many2one("doc.compliance.policy", ondelete="cascade", index=True)
    employee_id = fields.Many2one("hr.employee", required=True, ondelete="cascade")
    document_id = fields.Many2one("doc.document", required=True, ondelete="cascade")
    verifier_id = fields.Many2one("res.users", required=True, index=True)
    status = fields.Selection(
        [
            ("pending", "Pending"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
        ],
        default="pending",
        index=True,
    )
    rejection_reason = fields.Text()
    rejection_reason_code = fields.Selection(
        selection=[
            ("illegible", "Illegible"),
            ("wrong_document", "Wrong document"),
            ("expired", "Expired"),
            ("details_mismatch", "Details do not match"),
            ("incomplete", "Incomplete"),
            ("other", "Other"),
        ],
    )
    submitted_at = fields.Datetime(default=fields.Datetime.now)
    sla_due_at = fields.Datetime()
    sla_reminder_sent = fields.Boolean(default=False, copy=False)
    sla_escalated = fields.Boolean(default=False, copy=False)
    verifier_not_found = fields.Boolean(default=False, copy=False)
    verifier_note = fields.Char()

    def _check_not_self_verify(self):
        for item in self:
            submitter = item.employee_id.user_id
            if submitter and item.verifier_id == submitter:
                raise ValidationError(_("You cannot verify your own submission."))

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        records._check_not_self_verify()
        return records

    def action_approve(self):
        self.env["doc.compliance.verification.service"].approve_items(
            self, self.env.user
        )

    def action_reject(self, reason, reason_code=None):
        code = reason_code or "other"
        note = reason or ""
        if code != "other":
            note = reason or ""
        self.env["doc.compliance.verification.service"].reject_items(
            self,
            self.env.user,
            code,
            note=note if code == "other" else (reason or ""),
        )

    @api.model
    def _cron_verification_sla(self):
        now = fields.Datetime.now()
        pending = self.search([("status", "=", "pending")])
        Audit = self.env["doc.compliance.audit.log"]
        for item in pending:
            if not item.sla_due_at or not item.policy_id:
                continue
            policy = item.policy_id
            sla_days = max(policy.verification_sla_days or 3, 1)
            escalate_at = item.sla_due_at + timedelta(days=sla_days)
            if now >= item.sla_due_at and not item.sla_reminder_sent:
                item.sla_reminder_sent = True
                Audit.log_event(
                    "verification_sla_reminder",
                    _("Verification SLA reminder"),
                    policy=policy,
                    employee=item.employee_id,
                    detail=item.document_id.name,
                )
            if now >= escalate_at and not item.sla_escalated:
                item.sla_escalated = True
                Audit.log_event(
                    "verification_sla_escalated",
                    _("Verification overdue (2× SLA)"),
                    policy=policy,
                    employee=item.employee_id,
                    detail=item.document_id.name,
                )


class CompliancePolicyWorkItems(models.AbstractModel):
    _inherit = "doc.compliance.policy"

    milestone_ids = fields.One2many(
        "doc.compliance.review.milestone", "policy_id", string="Review milestones"
    )
    request_task_instance_ids = fields.One2many(
        "doc.compliance.task",
        "policy_id",
        string="Compliance task instances",
    )
    verification_item_ids = fields.One2many(
        "doc.compliance.verification.item", "policy_id", string="Verification items"
    )

    def _resolve_verifier_user(self, employee):
        self.ensure_one()
        if self.verified_by == "line_manager":
            manager = employee.parent_id.user_id if employee.parent_id else False
            return manager if manager else self.owner_id
        if self.verified_by == "policy_owner":
            return self.owner_id
        if self.verified_by == "assigned_reviewer":
            return self.assigned_reviewer_id
        return self._admin_users()[:1]

    def _maybe_queue_verification(self, employee, document):
        self.ensure_one()
        document_type = document.document_type_id
        if not document_type.verification_required:
            return
        verifier = self._resolve_verifier_user(employee)
        verifier_not_found = False
        verifier_note = ""
        original = verifier
        if not verifier:
            verifier = self._admin_users()[:1]
            verifier_not_found = True
            verifier_note = _("Verifier not found; routed to HR administrator.")
        if employee.user_id and verifier == employee.user_id:
            verifier = self.owner_id or self._admin_users()[:1]
            verifier_note = _("Submitter cannot verify; routed to alternate verifier.")
        if not verifier:
            return
        if not original and not verifier_not_found:
            verifier_not_found = True
            verifier_note = _("Verifier not found; routed to HR administrator.")
        existing = self.env["doc.compliance.verification.item"].search(
            [
                ("document_id", "=", document.id),
                ("status", "=", "pending"),
            ],
            limit=1,
        )
        if existing:
            return
        sla_days = max(self.verification_sla_days or 3, 1)
        item = self.env["doc.compliance.verification.item"].create(
            {
                "policy_id": self.id,
                "employee_id": employee.id,
                "document_id": document.id,
                "verifier_id": verifier.id,
                "sla_due_at": fields.Datetime.now() + timedelta(days=sla_days),
                "verifier_not_found": verifier_not_found,
                "verifier_note": verifier_note,
            }
        )
        self.env["doc.compliance.verification.service"].clear_duplicate_upload_approvals(
            document
        )
        return item
