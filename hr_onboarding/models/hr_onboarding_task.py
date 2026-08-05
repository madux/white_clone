# -*- coding: utf-8 -*-
from odoo import models, fields


class HrOnboardingTask(models.Model):
    _name = "hr.onboarding.task"
    _description = "Onboarding Checklist Task"
    _order = "due_date, id"

    onboarding_id = fields.Many2one(
        "hr.onboarding", required=True, ondelete="cascade", index=True,
    )
    name = fields.Char(required=True)
    category = fields.Selection(
        lambda self: self.env["hr.onboarding"].CATEGORIES,
        required=True,
    )
    responsible_id = fields.Many2one("res.users", string="Responsible")
    due_date = fields.Date()
    is_done = fields.Boolean(string="Done")
    done_date = fields.Datetime(readonly=True)

    def action_mark_done(self):
        for rec in self:
            rec.write({"is_done": True, "done_date": fields.Datetime.now()})

    def action_mark_undone(self):
        self.write({"is_done": False, "done_date": False})
