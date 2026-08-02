# -*- coding: utf-8 -*-
from odoo import Command, api, fields, models, _
from odoo.exceptions import AccessError


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
        return {
            "show_welcome": bool(force) or (progress.state != "completed" and not dismissed),
            "state": progress.state,
            "current_step": progress.current_step,
        }

    @api.model
    def dismiss_welcome(self):
        progress = self._company_progress()
        progress.write({"dismissed_user_ids": [Command.link(self.env.user.id)]})
        return True

    @api.model
    def start_setup(self):
        progress = self._company_progress()
        progress.write({
            "state": "in_progress",
            "current_step": max(progress.current_step, 1),
            "dismissed_user_ids": [Command.unlink(self.env.user.id)],
        })
        return {"state": progress.state, "current_step": progress.current_step}
