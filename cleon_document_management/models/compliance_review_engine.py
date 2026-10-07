# -*- coding: utf-8 -*-
"""Runtime engine for Review Schedule policies (Section 13)."""

from datetime import timedelta

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError


class ComplianceReviewEngine(models.Model):
    _inherit = "doc.compliance.policy"

    def _review_trigger_date(self, employee):
        self.ensure_one()
        today = fields.Date.context_today(self)
        if self.review_trigger == "policy_effective":
            return self.effective_date or today
        if self.review_trigger == "employee_start":
            start = getattr(employee, "date_start", False) or employee.create_date
            return fields.Date.to_date(start) if start else today
        if self.review_start_date and self.review_trigger == "policy_effective":
            return self.review_start_date
        if self.review_trigger in ("joined_scope", "people_change"):
            return today
        return self.effective_date or today

    def _hr_users_for_employee(self, employee):
        managers = self.env.ref(
            "cleon_document_management.group_document_manager",
            raise_if_not_found=False,
        )
        admins = self.env.ref(
            "cleon_document_management.group_document_admin",
            raise_if_not_found=False,
        )
        groups = [g for g in (managers, admins) if g]
        if not groups:
            return self.env["res.users"]
        users = self.env["res.users"].search(
            [("groups_id", "in", [g.id for g in groups]), ("active", "=", True)]
        )
        if employee.department_id:
            users = users.filtered(
                lambda user: not user.employee_ids
                or employee.department_id in user.employee_ids.mapped("department_id")
            ) or users
        return users[:5]

    def _build_review_participants(self, employee):
        self.ensure_one()
        participants = []
        mode = self.review_reviewer_mode or "line_manager"
        manager_user = (
            employee.parent_id.user_id if employee.parent_id else False
        )
        employee_user = employee.user_id

        if mode == "line_manager":
            if manager_user:
                participants.append(("manager", manager_user))
        elif mode == "hr":
            for user in self._hr_users_for_employee(employee):
                participants.append(("hr", user))
        elif mode == "manager_and_hr":
            if manager_user:
                participants.append(("manager", manager_user))
            for user in self._hr_users_for_employee(employee):
                participants.append(("hr", user))
        elif mode == "assigned_reviewer":
            if self.assigned_reviewer_id:
                participants.append(("manager", self.assigned_reviewer_id))
        elif mode == "employee_and_manager":
            if employee_user:
                participants.append(("employee", employee_user))
            if manager_user:
                participants.append(("manager", manager_user))

        if not participants and self.owner_id:
            participants.append(("owner", self.owner_id))
        return participants

    def _milestone_anchor_due(self, trigger_date, milestone):
        months = milestone.offset_months or 0
        if milestone.due_days and not milestone.offset_months:
            return trigger_date + timedelta(days=milestone.due_days)
        return trigger_date + relativedelta(months=months)

    def _grace_end(self, due_date):
        grace = max(self.grace_period_days or 0, 0)
        return due_date + timedelta(days=grace)

    def _generate_reviews_for_employee(self, employee):
        self.ensure_one()
        if not self._is_review_schedule_policy():
            return self.env["doc.compliance.review.instance"]
        if not self.active or not self._applies_to_employee(employee):
            return self.env["doc.compliance.review.instance"]
        if self.env["doc.compliance.exception"].sudo().search_count(
            [
                ("policy_id", "=", self.id),
                ("employee_id", "=", employee.id),
                ("status", "=", "approved"),
                ("active", "=", True),
            ]
        ):
            return self.env["doc.compliance.review.instance"]

        Review = self.env["doc.compliance.review.instance"].sudo()
        Participant = self.env["doc.compliance.review.participant"].sudo()
        trigger_date = self._review_trigger_date(employee)
        created = Review.browse()
        participants_spec = self._build_review_participants(employee)
        reviewer_not_found = not participants_spec or (
            self.review_reviewer_mode == "line_manager"
            and not any(role == "manager" for role, _user in participants_spec)
            and participants_spec[0][0] == "owner"
        )

        for milestone in self.milestone_ids.sorted("sequence"):
            anchor_due = self._milestone_anchor_due(trigger_date, milestone)
            existing = Review.search(
                [
                    ("policy_id", "=", self.id),
                    ("milestone_id", "=", milestone.id),
                    ("employee_id", "=", employee.id),
                    ("anchor_due_date", "=", anchor_due),
                ],
                limit=1,
            )
            if existing:
                created |= existing
                continue
            due_date = anchor_due
            grace_end = self._grace_end(due_date)
            review = Review.create(
                {
                    "policy_id": self.id,
                    "milestone_id": milestone.id,
                    "employee_id": employee.id,
                    "anchor_due_date": anchor_due,
                    "due_date": due_date,
                    "grace_end_date": grace_end,
                    "state": "scheduled",
                    "reviewer_not_found": reviewer_not_found,
                    "reviewer_note": _("Reviewer not found")
                    if reviewer_not_found
                    else False,
                }
            )
            seq = 10
            for role, user in participants_spec:
                Participant.create(
                    {
                        "review_id": review.id,
                        "role": role,
                        "user_id": user.id,
                        "sequence": seq,
                        "state": "pending",
                    }
                )
                seq += 10
            if reviewer_not_found and self.owner_id:
                self._schedule_activity(
                    self.owner_id,
                    _("Review needs reviewer assignment"),
                    _(
                        "No reviewer for %(employee)s — %(milestone)s (%(policy)s)."
                    )
                    % {
                        "employee": employee.name,
                        "milestone": milestone.name,
                        "policy": self.name,
                    },
                    due_date,
                )
            created |= review
        if created:
            self.evaluate_employee(employee)
        return created

    def _schedule_next_repeat(self, review):
        milestone = review.milestone_id
        if not (
            milestone.repeat_every_months or milestone.repeat_every_years
        ):
            return
        next_anchor = review.anchor_due_date + relativedelta(
            months=milestone.repeat_every_months or 0,
            years=milestone.repeat_every_years or 0,
        )
        exists = self.env["doc.compliance.review.instance"].search_count(
            [
                ("policy_id", "=", self.id),
                ("milestone_id", "=", milestone.id),
                ("employee_id", "=", review.employee_id.id),
                ("anchor_due_date", "=", next_anchor),
            ]
        )
        if exists:
            return
        trigger_override = next_anchor - relativedelta(
            months=milestone.offset_months or 0
        )
        employee = review.employee_id
        Review = self.env["doc.compliance.review.instance"].sudo()
        Participant = self.env["doc.compliance.review.participant"].sudo()
        participants_spec = self._build_review_participants(employee)
        due_date = next_anchor
        review_vals = {
            "policy_id": self.id,
            "milestone_id": milestone.id,
            "employee_id": employee.id,
            "anchor_due_date": next_anchor,
            "due_date": due_date,
            "grace_end_date": self._grace_end(due_date),
            "state": "scheduled",
        }
        new_review = Review.create(review_vals)
        seq = 10
        for role, user in participants_spec:
            Participant.create(
                {
                    "review_id": new_review.id,
                    "role": role,
                    "user_id": user.id,
                    "sequence": seq,
                    "state": "pending",
                }
            )
            seq += 10

    def _process_review_states(self, today):
        Review = self.env["doc.compliance.review.instance"].sudo()
        reviews = Review.search(
            [
                ("policy_id", "=", self.id),
                ("state", "in", ("scheduled", "in_progress", "overdue")),
            ]
        )
        overdue_mode = self.review_overdue_mode or "after_grace"
        for review in reviews:
            if review.state == "completed":
                continue
            if overdue_mode == "after_due" and review.due_date < today:
                if review.state != "overdue":
                    review.write({"state": "overdue"})
                    self.evaluate_employee(review.employee_id)
            if review.grace_end_date and review.grace_end_date < today:
                if review.state not in ("escalated", "completed"):
                    review.write({"state": "escalated", "escalated": True})
                    self._escalate_review(review)
                    self.evaluate_employee(review.employee_id)

    def _escalate_review(self, review):
        employee = review.employee_id
        recipients = self.env["res.users"]
        if employee.parent_id and employee.parent_id.parent_id:
            manager = employee.parent_id.parent_id.user_id
            if manager:
                recipients |= manager
        if self.owner_id:
            recipients |= self.owner_id
        note = _(
            "Review “%(milestone)s” for %(employee)s is overdue after grace "
            "(policy %(policy)s)."
        ) % {
            "milestone": review.milestone_id.name,
            "employee": employee.name,
            "policy": self.name,
        }
        if recipients:
            self._schedule_activity(
                recipients,
                _("Review escalated"),
                note,
                fields.Date.context_today(self),
            )
        self.env["doc.compliance.audit.log"].sudo().log_event(
            "review_escalated",
            note,
            policy=self,
        )

    def action_start_review(self, review, user):
        review.ensure_one()
        if review.state not in ("scheduled", "overdue", "in_progress"):
            return review
        participant = review.participant_ids.filtered(
            lambda p: p.user_id == user and p.state == "pending"
        )
        if not participant and not user.has_group(
            "cleon_document_management.group_document_admin"
        ):
            raise AccessError(_("This review is not assigned to you."))
        review.write(
            {
                "state": "in_progress",
                "started_at": review.started_at or fields.Datetime.now(),
            }
        )
        return review

    def action_complete_review_participant(self, review, user, outcome="", submission_id=False):
        review.ensure_one()
        participant = review.participant_ids.filtered(lambda p: p.user_id == user)
        if not participant:
            raise AccessError(_("You are not a participant on this review."))
        participant.write(
            {"state": "done", "completed_at": fields.Datetime.now()}
        )
        today = fields.Date.context_today(self)
        pending_required = review.participant_ids.filtered(
            lambda p: p.state != "done"
        )
        mode = self.review_completion_mode or "all_scheduled"
        required_milestones = self.milestone_ids.filtered(
            lambda m: m.requirement == "required"
        )
        all_done = not pending_required
        if mode == "any_one":
            all_done = bool(participant)
        elif mode == "minimum_count":
            done_count = len(review.participant_ids.filtered(lambda p: p.state == "done"))
            all_done = done_count >= max(self.review_completion_minimum or 1, 1)

        if all_done or (
            mode == "all_scheduled" and not pending_required
        ):
            review.write(
                {
                    "state": "completed",
                    "completed_at": fields.Datetime.now(),
                    "completed_late": bool(review.due_date and review.due_date < today),
                    "outcome": outcome or review.outcome,
                    "submission_id": int(submission_id or 0) or review.submission_id.id,
                }
            )
            self._schedule_next_repeat(review)
            self.evaluate_employee(review.employee_id)
        return review

    @api.model
    def _cron_review_schedule(self):
        today = fields.Date.context_today(self)
        policies = self.sudo().search(
            [
                ("active", "=", True),
                ("lifecycle_status", "=", "active"),
                ("policy_type_id.code", "=", "review_schedule"),
            ]
        )
        for policy in policies:
            if policy.effective_date and policy.effective_date > today:
                continue
            for employee in policy._target_employees():
                policy._generate_reviews_for_employee(employee)
            policy._process_review_states(today)

    @api.model
    def reassign_reviews_for_manager_change(self, employee):
        Review = self.env["doc.compliance.review.instance"].sudo()
        Participant = self.env["doc.compliance.review.participant"].sudo()
        reviews = Review.search(
            [
                ("employee_id", "=", employee.id),
                ("state", "in", ("scheduled", "overdue")),
            ]
        )
        for review in reviews:
            if review.started_at:
                continue
            policy = review.policy_id
            old_parts = review.participant_ids.filtered(
                lambda p: p.role in ("manager", "employee")
            )
            old_parts.unlink()
            seq = 10
            for role, user in policy._build_review_participants(employee):
                if role not in ("manager", "employee"):
                    continue
                Participant.create(
                    {
                        "review_id": review.id,
                        "role": role,
                        "user_id": user.id,
                        "sequence": seq,
                        "state": "pending",
                    }
                )
                seq += 10


class ComplianceReviewEngineWrite(models.Model):
    _inherit = "doc.compliance.policy"

    def write(self, vals):
        res = super().write(vals)
        activating = vals.get("active") is True or (
            vals.get("lifecycle_status") == "active"
        )
        if activating:
            for policy in self.filtered(
                lambda item: item._is_review_schedule_policy()
                and item.review_trigger == "policy_effective"
            ):
                for employee in policy._target_employees():
                    policy._generate_reviews_for_employee(employee)
        return res


class ComplianceReviewInstance(models.Model):
    _inherit = "doc.compliance.review.instance"

    def user_can_access(self, user):
        self.ensure_one()
        if user.has_group("cleon_document_management.group_document_admin"):
            return True
        return bool(self.participant_ids.filtered(lambda p: p.user_id == user))
