# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class HrLeaveTypeApprovalStage(models.Model):
    _name = "hr.leave.type.approval.stage"
    _description = "Leave Type Approval Stage"
    _order = "sequence, id"

    leave_type_id = fields.Many2one(
        "hr.leave.type", required=True, ondelete="cascade", index=True,
    )
    sequence = fields.Integer(required=True, default=10)
    approver_type = fields.Selection([
        ("direct_manager", "Direct Manager"),
        ("department_head", "Department Head"),
        ("hr_manager", "HR Manager"),
        ("hr_director", "HR Director"),
        ("finance_director", "Finance Director"),
        ("ceo", "CEO / Managing Director"),
    ], required=True, default="direct_manager")
    escalation_value = fields.Integer(string="Escalate After", default=2)
    escalation_unit = fields.Selection(
        [("hours", "Hours"), ("days", "Days")], required=True, default="days",
    )

    @api.constrains("escalation_value")
    def _check_escalation_value(self):
        if any(stage.escalation_value < 0 for stage in self):
            raise ValidationError(_("Escalation time cannot be negative."))


class HrLeaveApprovalLine(models.Model):
    _name = "hr.leave.approval.line"
    _description = "Leave Request Approval Timeline"
    _order = "sequence, id"

    leave_id = fields.Many2one("hr.leave", required=True, ondelete="cascade", index=True)
    sequence = fields.Integer(required=True, default=10)
    level = fields.Integer(required=True, default=1)
    approver_type = fields.Selection(
        related="stage_id.approver_type", store=True, readonly=True,
    )
    stage_id = fields.Many2one(
        "hr.leave.type.approval.stage", required=True, ondelete="restrict",
    )
    approver_id = fields.Many2one("res.users", readonly=True)
    status = fields.Selection([
        ("waiting", "Waiting"),
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("skipped", "Skipped"),
    ], required=True, default="waiting", readonly=True, index=True)
    deadline = fields.Datetime(readonly=True)
    actioned_at = fields.Datetime(readonly=True)
    actioned_by_id = fields.Many2one("res.users", readonly=True)
    comments = fields.Text(readonly=True)
    escalated = fields.Boolean(readonly=True, copy=False)
    escalated_at = fields.Datetime(readonly=True, copy=False)

    def _deadline_from_stage(self, start=None):
        self.ensure_one()
        start = start or fields.Datetime.now()
        value = max(self.stage_id.escalation_value, 0)
        delta = timedelta(hours=value) if self.stage_id.escalation_unit == "hours" else timedelta(days=value)
        return start + delta if value else False


class HrLeaveBlackoutPeriod(models.Model):
    _name = "hr.leave.blackout.period"
    _description = "Leave Request Blackout Period"
    _order = "date_from, id"

    name = fields.Char(required=True)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company,
        ondelete="cascade", index=True,
    )
    date_from = fields.Date(required=True, index=True)
    date_to = fields.Date(required=True, index=True)
    leave_type_ids = fields.Many2many("hr.leave.type", string="Leave Types")
    department_ids = fields.Many2many("hr.department", string="Departments")
    active = fields.Boolean(default=True)
    reason = fields.Text()

    @api.constrains("date_from", "date_to")
    def _check_dates(self):
        for period in self:
            if period.date_to < period.date_from:
                raise ValidationError(_("A blackout period must end on or after its start date."))


class HrLeaveAccrualRun(models.Model):
    _name = "hr.leave.accrual.run"
    _description = "Processed Leave Accrual Period"
    _order = "effective_date desc, id desc"

    employee_id = fields.Many2one("hr.employee", required=True, ondelete="restrict", index=True)
    leave_type_id = fields.Many2one("hr.leave.type", required=True, ondelete="restrict", index=True)
    period_key = fields.Char(required=True, index=True)
    effective_date = fields.Date(required=True, index=True)
    amount = fields.Float(required=True)
    allocation_id = fields.Many2one("hr.leave.allocation", ondelete="restrict")
    reason = fields.Char(required=True)

    _sql_constraints = [(
        "employee_type_period_unique",
        "unique(employee_id, leave_type_id, period_key)",
        "This employee's leave accrual has already been processed for the period.",
    )]
