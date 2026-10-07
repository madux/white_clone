# -*- coding: utf-8 -*-
"""Section 13 — Review Schedule policy configuration and review instances."""

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

REVIEW_TRIGGERS = [
    ("policy_effective", "Policy effective date"),
    ("employee_start", "Employee start date"),
    ("joined_scope", "Joined scope"),
    ("people_change", "Role / department / location change"),
]

REVIEW_REVIEWER_MODES = [
    ("line_manager", "Line manager"),
    ("hr", "HR (document managers)"),
    ("manager_and_hr", "Manager and HR"),
    ("assigned_reviewer", "Assigned reviewer"),
    ("employee_and_manager", "Employee and manager"),
]

REVIEW_COMPLETION_MODES = [
    ("all_scheduled", "All scheduled reviews"),
    ("any_one", "At least one required review"),
    ("minimum_count", "Minimum number of required reviews"),
]

REVIEW_OVERDUE_MODES = [
    ("after_due", "After due date"),
    ("after_grace", "After grace period"),
]

REVIEW_INSTANCE_STATES = [
    ("scheduled", "Scheduled"),
    ("in_progress", "In progress"),
    ("overdue", "Overdue"),
    ("escalated", "Escalated"),
    ("completed", "Completed"),
    ("cancelled", "Cancelled"),
]

PARTICIPANT_ROLES = [
    ("employee", "Employee"),
    ("manager", "Line manager"),
    ("hr", "HR"),
    ("owner", "Policy owner"),
]


class ComplianceReviewMilestone(models.Model):
    _inherit = "doc.compliance.review.milestone"

    offset_months = fields.Integer(
        string="Months after trigger",
        default=3,
        help="Review due date = trigger date + this many months.",
    )
    repeat_every_months = fields.Integer(
        string="Repeat every (months)",
        default=0,
        help="0 = does not repeat.",
    )
    repeat_every_years = fields.Integer(
        string="Repeat every (years)",
        default=0,
    )
    requirement = fields.Selection(
        [("required", "Required"), ("optional", "Optional")],
        default="required",
        required=True,
    )
    linked_form_id = fields.Many2one(
        "doc.template",
        string="Review form",
        ondelete="restrict",
        domain="[('kind', '=', 'form'), ('status', '=', 'published')]",
    )

    @api.constrains("offset_months")
    def _check_offset_months(self):
        for milestone in self:
            if milestone.offset_months is not None and milestone.offset_months < 0:
                raise ValidationError(_("Milestone timing cannot be negative."))

    def to_api_dict(self):
        self.ensure_one()
        return {
            "id": self.id,
            "sequence": self.sequence,
            "name": self.name,
            "offset_months": self.offset_months or 0,
            "repeat_every_months": self.repeat_every_months or 0,
            "repeat_every_years": self.repeat_every_years or 0,
            "requirement": self.requirement or "required",
            "linked_form_id": self.linked_form_id.id if self.linked_form_id else False,
            "linked_form_name": self.linked_form_id.name if self.linked_form_id else "",
        }


class ComplianceReviewParticipant(models.Model):
    _name = "doc.compliance.review.participant"
    _description = "Review schedule participant"
    _order = "sequence, id"

    review_id = fields.Many2one(
        "doc.compliance.review.instance",
        required=True,
        ondelete="cascade",
        index=True,
    )
    role = fields.Selection(PARTICIPANT_ROLES, required=True)
    user_id = fields.Many2one("res.users", required=True, index=True)
    sequence = fields.Integer(default=10)
    state = fields.Selection(
        [("pending", "Pending"), ("done", "Done")],
        default="pending",
        required=True,
    )
    completed_at = fields.Datetime()


class ComplianceReviewInstance(models.Model):
    _name = "doc.compliance.review.instance"
    _description = "Scheduled employee review (milestone instance)"
    _order = "due_date asc, id desc"

    policy_id = fields.Many2one(
        "doc.compliance.policy", required=True, ondelete="cascade", index=True
    )
    milestone_id = fields.Many2one(
        "doc.compliance.review.milestone", required=True, ondelete="restrict", index=True
    )
    employee_id = fields.Many2one("hr.employee", required=True, ondelete="cascade", index=True)
    anchor_due_date = fields.Date(
        required=True,
        index=True,
        help="Scheduled due for this cycle (used for repeats).",
    )
    due_date = fields.Date(required=True, index=True)
    grace_end_date = fields.Date(index=True)
    state = fields.Selection(
        REVIEW_INSTANCE_STATES, default="scheduled", required=True, index=True
    )
    reviewer_not_found = fields.Boolean(default=False)
    reviewer_note = fields.Char()
    started_at = fields.Datetime()
    completed_at = fields.Datetime()
    completed_late = fields.Boolean(default=False)
    outcome = fields.Text()
    submission_id = fields.Many2one("doc.template.submission", ondelete="set null")
    escalated = fields.Boolean(default=False)
    participant_ids = fields.One2many(
        "doc.compliance.review.participant", "review_id", string="Participants"
    )

    _sql_constraints = [
        (
            "review_instance_unique",
            "unique(policy_id, milestone_id, employee_id, anchor_due_date)",
            "This review cycle already exists for the employee.",
        ),
    ]

    def to_api_dict(self):
        self.ensure_one()
        today = fields.Date.context_today(self)
        display_status = self.state
        if self.state == "scheduled" and self.due_date:
            if self.due_date < today:
                display_status = "overdue"
            elif (self.due_date - today).days <= 7:
                display_status = "due_soon"
        return {
            "id": self.id,
            "policy_id": self.policy_id.id,
            "policy_name": self.policy_id.name,
            "milestone_id": self.milestone_id.id,
            "milestone_name": self.milestone_id.name,
            "employee_id": self.employee_id.id,
            "employee_name": self.employee_id.name,
            "due_date": str(self.due_date or ""),
            "grace_end_date": str(self.grace_end_date or ""),
            "state": self.state,
            "display_status": display_status,
            "reviewer_not_found": bool(self.reviewer_not_found),
            "reviewer_note": self.reviewer_note or "",
            "linked_form_id": self.milestone_id.linked_form_id.id
            if self.milestone_id.linked_form_id
            else False,
            "started_at": str(self.started_at or ""),
            "completed_at": str(self.completed_at or ""),
            "participants": [
                {
                    "id": p.id,
                    "role": p.role,
                    "user_id": p.user_id.id,
                    "user_name": p.user_id.name,
                    "state": p.state,
                }
                for p in self.participant_ids
            ],
        }


class CompliancePolicyReviewSchedule(models.Model):
    _inherit = "doc.compliance.policy"

    review_trigger = fields.Selection(REVIEW_TRIGGERS, string="When reviews start")
    review_start_date = fields.Date(string="Anchor date")
    review_reviewer_mode = fields.Selection(
        REVIEW_REVIEWER_MODES,
        string="Reviewer",
        default="line_manager",
    )
    review_completion_mode = fields.Selection(
        REVIEW_COMPLETION_MODES,
        default="all_scheduled",
        string="Reviews needed",
    )
    review_completion_minimum = fields.Integer(default=1)
    review_overdue_mode = fields.Selection(
        REVIEW_OVERDUE_MODES,
        default="after_grace",
        string="Mark as overdue",
    )

    def _is_review_schedule_policy(self):
        self.ensure_one()
        return bool(
            self.policy_type_id and self.policy_type_id.code == "review_schedule"
        )

    @api.constrains(
        "policy_type_id",
        "milestone_ids",
        "review_reviewer_mode",
        "review_completion_mode",
        "review_completion_minimum",
        "assigned_reviewer_id",
        "active",
        "lifecycle_status",
    )
    def _check_review_schedule_policy(self):
        for policy in self:
            if not policy._is_review_schedule_policy():
                continue
            if policy.lifecycle_status == "draft" or not policy.active:
                continue
            names = policy.milestone_ids.mapped("name")
            if len(names) != len(set(names)):
                raise ValidationError(
                    _("Each milestone name must be unique within this policy.")
                )
            if not policy.milestone_ids.filtered(
                lambda m: m.requirement == "required"
            ):
                raise ValidationError(
                    _("Add at least one required milestone for this review schedule.")
                )
            if policy.review_reviewer_mode == "assigned_reviewer":
                if not policy.assigned_reviewer_id:
                    raise ValidationError(
                        _("Assigned reviewer mode requires a named reviewer.")
                    )
            if policy.review_completion_mode == "minimum_count":
                required_count = len(
                    policy.milestone_ids.filtered(
                        lambda m: m.requirement == "required"
                    )
                )
                minimum = max(policy.review_completion_minimum or 0, 1)
                if minimum > required_count:
                    raise ValidationError(
                        _(
                            "Minimum reviews needed cannot exceed required milestones."
                        )
                    )
            if not policy.review_trigger:
                raise ValidationError(_("Select when this review schedule starts."))

    def _validate_document_types_for_activation(self):
        review = self.filtered(lambda p: p._is_review_schedule_policy())
        other = self - review
        for policy in review:
            policy._check_review_schedule_policy()
        if other:
            return super(CompliancePolicyReviewSchedule, other)._validate_document_types_for_activation()
        return True

    def _sync_review_milestones(self, payloads):
        self.ensure_one()
        Milestone = self.env["doc.compliance.review.milestone"]
        existing = {item.id: item for item in self.milestone_ids}
        keep_ids = []
        for index, payload in enumerate(payloads or []):
            name = (payload.get("name") or "").strip()
            if not name:
                raise ValidationError(_("Each milestone requires a name."))
            vals = {
                "policy_id": self.id,
                "sequence": (index + 1) * 10,
                "name": name,
                "offset_months": int(payload.get("offset_months") or 0),
                "repeat_every_months": int(payload.get("repeat_every_months") or 0),
                "repeat_every_years": int(payload.get("repeat_every_years") or 0),
                "requirement": payload.get("requirement") or "required",
                "linked_form_id": int(payload.get("linked_form_id") or 0) or False,
            }
            mid = int(payload.get("id") or 0)
            if mid and mid in existing:
                existing[mid].write(vals)
                keep_ids.append(mid)
            else:
                keep_ids.append(Milestone.create(vals).id)
        unlink = self.milestone_ids.filtered(lambda item: item.id not in keep_ids)
        if unlink:
            unlink.unlink()

    def review_fields_api(self):
        self.ensure_one()
        return {
            "review_trigger": self.review_trigger or "",
            "review_start_date": str(self.review_start_date or ""),
            "review_reviewer_mode": self.review_reviewer_mode or "line_manager",
            "review_completion_mode": self.review_completion_mode or "all_scheduled",
            "review_completion_minimum": self.review_completion_minimum or 1,
            "review_overdue_mode": self.review_overdue_mode or "after_grace",
            "review_milestones": [
                milestone.to_api_dict() for milestone in self.milestone_ids
            ],
        }

    @api.model
    def trigger_review_schedule_for_employees(self, employees, trigger_kind):
        policies = self.sudo().search(
            [
                ("active", "=", True),
                ("lifecycle_status", "=", "active"),
                ("policy_type_id.code", "=", "review_schedule"),
                ("review_trigger", "=", trigger_kind),
            ]
        )
        for policy in policies:
            for employee in employees:
                if policy._applies_to_employee(employee):
                    policy._generate_reviews_for_employee(employee)
