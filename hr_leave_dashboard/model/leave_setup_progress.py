# -*- coding: utf-8 -*-
from odoo import Command, api, fields, models, _
from odoo.exceptions import AccessError, ValidationError

class HrLeaveSetupProgress(models.Model):
    _name = "hr.leave.setup.progress"
    _description = "Leave Management Setup Progress"
    _rec_name = "company_id"

    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company,
        ondelete="cascade", index=True,
    )
    state = fields.Selection(
        [("not_started", "Not Started"), ("in_progress", "In Progress"),
         ("completed", "Completed")],
        required=True, default="not_started",
    )
    current_step = fields.Integer(default=0)
    dismissed_user_ids = fields.Many2many(
        "res.users", "hr_leave_setup_dismissed_user_rel",
        "progress_id", "user_id", string="Users Who Dismissed Welcome",
    )
    completed_by_id = fields.Many2one("res.users", readonly=True)
    completed_at = fields.Datetime(readonly=True)

    # FR-050: Checklist completion state fields
    check_leave_type = fields.Boolean(default=False)
    check_allocate_balance = fields.Boolean(default=False)
    check_set_country = fields.Boolean(default=False)
    check_review_request = fields.Boolean(default=False)
    check_run_report = fields.Boolean(default=False)

    _sql_constraints = [
        ("company_unique", "unique(company_id)",
         "Leave setup progress already exists for this company."),
    ]

    @api.model
    def _ensure_setup_admin(self):
        if not (self.env.user.has_group("base.group_system") or
                self.env.user.has_group("hr_holidays.group_hr_holidays_manager")):
            raise AccessError(_("Only a Time Off Administrator can manage leave setup."))

    @api.model
    def _company_progress(self):
        self._ensure_setup_admin()
        progress = self.search([("company_id", "=", self.env.company.id)], limit=1)
        return progress or self.create({"company_id": self.env.company.id})

    @api.model
    def get_welcome_state(self, force=False):
        progress = self._company_progress()
        dismissed = self.env.user in progress.dismissed_user_ids
        checklist = {
            "check_leave_type": progress.check_leave_type,
            "check_allocate_balance": progress.check_allocate_balance,
            "check_set_country": progress.check_set_country,
            "check_review_request": progress.check_review_request,
            "check_run_report": progress.check_run_report,
        }
        completed_count = sum(1 for v in checklist.values() if v)
        return {
            "show_welcome": bool(force) or (progress.state != "completed" and not dismissed),
            "state": progress.state,
            "current_step": progress.current_step,
            "checklist": checklist,
            "completed_count": completed_count,
        }

    @api.model
    def set_checklist_item(self, item_key, completed):
        """FR-050: Explicitly set checklist item completion state and persist."""
        progress = self._company_progress()
        valid_keys = {
            "check_leave_type": "check_leave_type",
            "check_allocate_balance": "check_allocate_balance",
            "check_set_country": "check_set_country",
            "check_review_request": "check_review_request",
            "check_run_report": "check_run_report",
        }
        field_name = valid_keys.get(item_key)
        if not field_name:
            raise ValidationError(_("Invalid leave setup checklist item."))

        progress.write({field_name: bool(completed)})
        return self.get_welcome_state()

    @api.model
    def dismiss_welcome(self):
        progress = self._company_progress()
        progress.write({"dismissed_user_ids": [Command.link(self.env.user.id)]})
        return True

    @api.model
    def start_setup(self):
        progress = self._company_progress()
        new_state = "completed" if progress.state == "completed" else "in_progress"
        progress.write({
            "state": new_state,
            "current_step": max(progress.current_step, 1),
            "dismissed_user_ids": [Command.unlink(self.env.user.id)],
        })
        return {"state": progress.state, "current_step": progress.current_step}

    @api.model
    def advance_step(self, step):
        """Save wizard progress to the given step number (1–5).
        If already completed, keeps state as completed to avoid corruption."""
        progress = self._company_progress()
        new_state = "completed" if progress.state == "completed" else "in_progress"
        progress.write({
            "state": new_state,
            "current_step": max(progress.current_step, int(step)),
        })
        return {"state": progress.state, "current_step": progress.current_step}

    @api.model
    def skip_wizard(self):
        """FR-017: User skips the wizard without completing setup.
        Dismisses the wizard for the current user without marking the company
        setup as completed. The wizard can still be re-opened via the header icons."""
        progress = self._company_progress()
        progress.write({"dismissed_user_ids": [Command.link(self.env.user.id)]})
        return True

    @api.model
    def complete_setup(self):
        """Mark setup as fully completed for this company."""
        progress = self._company_progress()
        progress.write({
            "state": "completed",
            "current_step": 5,
            "completed_by_id": self.env.user.id,
            "completed_at": fields.Datetime.now(),
        })
        return {"state": progress.state}
