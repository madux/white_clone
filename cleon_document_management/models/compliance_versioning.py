# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class CompliancePolicyVersion(models.Model):
    _name = "doc.compliance.policy.version"
    _description = "Compliance Policy Version"
    _order = "version_number desc, id desc"

    policy_id = fields.Many2one(
        "doc.compliance.policy", required=True, ondelete="cascade", index=True
    )
    version_number = fields.Integer(required=True, default=1)
    effective_from = fields.Date(required=True, default=fields.Date.context_today)
    is_current = fields.Boolean(default=True, index=True)
    snapshot_note = fields.Char(
        help="Short description of what changed in this version.",
    )
    minimum_documents = fields.Integer()
    grace_period_days = fields.Integer()
    due_days = fields.Integer()
    document_type_ids = fields.Many2many(
        "doc.document.type",
        "doc_compliance_version_document_type_rel",
        "version_id",
        "document_type_id",
    )

    _sql_constraints = [
        (
            "policy_version_unique",
            "unique(policy_id, version_number)",
            "Version number must be unique per policy.",
        ),
    ]


class ComplianceAssignment(models.Model):
    _name = "doc.compliance.assignment"
    _description = "Compliance Assignment"
    _order = "due_date asc, id desc"

    policy_id = fields.Many2one(
        "doc.compliance.policy", required=True, ondelete="cascade", index=True
    )
    version_id = fields.Many2one(
        "doc.compliance.policy.version", ondelete="restrict", index=True
    )
    employee_id = fields.Many2one(
        "hr.employee", required=True, ondelete="cascade", index=True
    )
    requirement_id = fields.Many2one(
        "doc.compliance.requirement", ondelete="restrict", index=True
    )
    document_type_id = fields.Many2one("doc.document.type", ondelete="restrict")
    cycle_key = fields.Char(default="default", index=True)
    trigger_date = fields.Date()
    due_date = fields.Date(index=True)
    grace_end_date = fields.Date()
    state = fields.Selection(
        [
            ("open", "Open"),
            ("satisfied", "Satisfied"),
            ("withdrawn", "Withdrawn"),
        ],
        default="open",
        required=True,
    )

    _sql_constraints = [
        (
            "assignment_unique",
            "unique(policy_id, employee_id, requirement_id, document_type_id, cycle_key)",
            "Duplicate assignment for this cycle.",
        ),
    ]


class ComplianceAuditLog(models.Model):
    _name = "doc.compliance.audit.log"
    _description = "Compliance Audit Log"
    _order = "create_date desc"

    policy_id = fields.Many2one("doc.compliance.policy", ondelete="set null", index=True)
    employee_id = fields.Many2one("hr.employee", ondelete="set null")
    event_type = fields.Char(required=True, index=True)
    summary = fields.Char(required=True)
    detail = fields.Text()
    user_id = fields.Many2one("res.users", default=lambda self: self.env.user)
    run_id = fields.Many2one("doc.compliance.evaluation.run", ondelete="set null")

    @api.model
    def log_event(self, event_type, summary, policy=None, employee=None, detail=None, run=None):
        self.sudo().create(
            {
                "policy_id": policy.id if policy else False,
                "employee_id": employee.id if employee else False,
                "event_type": event_type,
                "summary": summary,
                "detail": detail or "",
                "run_id": run.id if run else False,
            }
        )


class ComplianceRecheckJob(models.Model):
    _name = "doc.compliance.recheck.job"
    _description = "Deferred compliance re-check"
    _order = "run_at asc"

    employee_id = fields.Many2one("hr.employee", required=True, ondelete="cascade")
    policy_id = fields.Many2one("doc.compliance.policy", ondelete="cascade")
    run_at = fields.Datetime(required=True, index=True)
    state = fields.Selection(
        [("pending", "Pending"), ("done", "Done"), ("failed", "Failed")],
        default="pending",
        index=True,
    )
    reason = fields.Char()

    @api.model
    def schedule_employee(self, employee, policy=None, minutes=5, reason=""):
        run_at = fields.Datetime.now() + timedelta(minutes=minutes)
        existing = self.search(
            [
                ("employee_id", "=", employee.id),
                ("policy_id", "=", policy.id if policy else False),
                ("state", "=", "pending"),
            ],
            limit=1,
        )
        if existing:
            existing.write({"run_at": run_at, "reason": reason or existing.reason})
            return existing
        return self.create(
            {
                "employee_id": employee.id,
                "policy_id": policy.id if policy else False,
                "run_at": run_at,
                "reason": reason,
            }
        )

    @api.model
    def _cron_process_rechecks(self):
        now = fields.Datetime.now()
        jobs = self.search([("state", "=", "pending"), ("run_at", "<=", now)])
        Policy = self.env["doc.compliance.policy"]
        for job in jobs:
            try:
                if job.policy_id:
                    job.policy_id.evaluate_employee(job.employee_id)
                else:
                    policies = Policy.search([("active", "=", True)])
                    for policy in policies:
                        if policy._applies_to_employee(job.employee_id):
                            policy.evaluate_employee(job.employee_id)
                job.state = "done"
            except Exception as error:
                job.write({"state": "failed", "reason": str(error)[:255]})


class CompliancePolicyVersioning(models.AbstractModel):
    _inherit = "doc.compliance.policy"

    version_ids = fields.One2many(
        "doc.compliance.policy.version", "policy_id", string="Versions"
    )
    current_version_id = fields.Many2one(
        "doc.compliance.policy.version", copy=False, ondelete="set null"
    )
    owner_id = fields.Many2one(
        "res.users",
        string="Policy Owner",
        tracking=True,
        help="Receives escalations and configuration warnings for this policy.",
    )
    run_in_progress = fields.Boolean(default=False, copy=False)
    run_started_at = fields.Datetime(copy=False)
    no_document_due_days = fields.Integer(
        string="If No Document, Due Within (Days)",
        default=30,
        help="Renewable Document: deadline when employee has no current document.",
    )
    retention_action_mode = fields.Selection(
        [
            ("report_only", "Report only"),
            ("owner_approval", "Owner approval batch"),
            ("automatic", "Automatic archive/delete"),
            ("archive", "Archive when due (legacy)"),
            ("delete", "Delete when due (legacy)"),
        ],
        default="report_only",
    )
    verified_by = fields.Selection(
        [
            ("line_manager", "Line manager"),
            ("hr_admin", "HR administrator"),
            ("policy_owner", "Policy owner"),
            ("assigned_reviewer", "Assigned reviewer"),
        ],
        default="hr_admin",
    )
    verification_sla_days = fields.Integer(default=7)
    assignment_ids = fields.One2many(
        "doc.compliance.assignment", "policy_id", string="Assignments"
    )

    def _ensure_current_version(self):
        self.ensure_one()
        if self.current_version_id:
            return self.current_version_id
        Version = self.env["doc.compliance.policy.version"]
        version = Version.create(
            {
                "policy_id": self.id,
                "version_number": 1,
                "effective_from": self.effective_date or fields.Date.context_today(self),
                "minimum_documents": self.minimum_documents,
                "grace_period_days": self.grace_period_days,
                "due_days": self.due_days,
                "document_type_ids": [fields.Command.set(self.document_type_ids.ids)],
            }
        )
        self.current_version_id = version.id
        return version

    def _create_new_version(self, note="Material policy change"):
        self.ensure_one()
        current = self._ensure_current_version()
        current.is_current = False
        next_number = (current.version_number or 1) + 1
        version = self.env["doc.compliance.policy.version"].create(
            {
                "policy_id": self.id,
                "version_number": next_number,
                "effective_from": fields.Date.context_today(self),
                "is_current": True,
                "snapshot_note": note,
                "minimum_documents": self.minimum_documents,
                "grace_period_days": self.grace_period_days,
                "due_days": self.due_days,
                "document_type_ids": [fields.Command.set(self.document_type_ids.ids)],
            }
        )
        self.current_version_id = version.id
        self.env["doc.compliance.audit.log"].log_event(
            "policy_version",
            _("Policy version %s created") % next_number,
            policy=self,
            detail=note,
        )
        return version

    def _sync_assignments_for_employee(self, employee, line_payload, requirement, document_type):
        self.ensure_one()
        version = self._ensure_current_version()
        Assignment = self.env["doc.compliance.assignment"]
        assignment = Assignment.search(
            [
                ("policy_id", "=", self.id),
                ("employee_id", "=", employee.id),
                ("requirement_id", "=", requirement.id),
                ("document_type_id", "=", document_type.id),
                ("cycle_key", "=", "default"),
            ],
            limit=1,
        )
        vals = {
            "policy_id": self.id,
            "version_id": version.id,
            "employee_id": employee.id,
            "requirement_id": requirement.id,
            "document_type_id": document_type.id,
            "cycle_key": "default",
            "trigger_date": line_payload.get("due_date"),
            "due_date": line_payload.get("due_date"),
            "grace_end_date": line_payload.get("grace_end_date"),
            "state": "satisfied"
            if line_payload.get("compliance_status") == "compliant"
            else "open",
        }
        if assignment:
            assignment.write(vals)
        else:
            Assignment.create(vals)

    def _validate_document_types_for_activation(self):
        self.ensure_one()
        for document_type in self.document_type_ids:
            if not document_type.expires_rule:
                raise ValidationError(
                    _(
                        'Document type "%(name)s" must answer Expires before this policy can activate.',
                        name=document_type.name,
                    )
                )
            if not document_type.verification_rule:
                raise ValidationError(
                    _(
                        'Document type "%(name)s" must answer Verification required before activation.',
                        name=document_type.name,
                    )
                )
