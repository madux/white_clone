from odoo import api, fields, models, _
from datetime import datetime, time, timedelta

import pytz

from odoo.exceptions import AccessError, UserError, ValidationError


class CleonAttendanceRegularization(models.Model):
    _name = "cleon.attendance.regularization"
    _description = "Attendance Regularization Request"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "create_date desc"

    employee_id = fields.Many2one("hr.employee", required=True, default=lambda self: self.env.user.employee_id)
    attendance_id = fields.Many2one("hr.attendance")
    attendance_date = fields.Date(required=True, default=fields.Date.context_today, index=True)
    issue_type = fields.Selection([
        ("forgot_in", "Forgot to Clock In"), ("forgot_out", "Forgot to Clock Out"),
        ("incorrect_status", "Incorrect Attendance Status"),
        ("system_error", "System Error"), ("other", "Other"),
    ], required=True, default="other")
    requested_check_in = fields.Datetime(required=True)
    requested_check_out = fields.Datetime()
    reason = fields.Text(required=True)
    attachment_ids = fields.Many2many("ir.attachment", string="Supporting Documents")
    manager_comment = fields.Text()
    approver_id = fields.Many2one("res.users", readonly=True)
    decision_date = fields.Datetime(readonly=True)
    state = fields.Selection([
        ("draft", "Draft"), ("submitted", "Submitted"),
        ("approved", "Approved"), ("rejected", "Rejected"),
    ], default="draft", required=True, tracking=True)
    company_id = fields.Many2one(related="employee_id.company_id", store=True)

    _sql_constraints = [
        ("employee_attendance_date_unique", "unique(employee_id, attendance_date)", "Only one regularization request is allowed per employee and attendance date."),
    ]

    @api.constrains("reason")
    def _check_reason(self):
        for request in self:
            length = len((request.reason or "").strip())
            if length < 20 or length > 500:
                raise ValidationError(_("Regularization reason must contain between 20 and 500 characters."))

    @api.constrains("attendance_date")
    def _check_attendance_date(self):
        today = fields.Date.context_today(self)
        for request in self:
            policy = self.env["cleon.time.policy"].search([
                ("company_id", "=", request.employee_id.company_id.id),
            ], limit=1)
            window = (policy.regularization_window_days if policy else 0) or 30
            if request.attendance_date > today or request.attendance_date < today - timedelta(days=window):
                raise ValidationError(_("Attendance corrections can only be requested for the last %s days.") % window)

    def _is_manager(self):
        return self.env.user.has_group("base.group_system") or self.env.user.has_group(
            "hr_time_management.group_time_management_manager"
        )

    def _serialize(self):
        self.ensure_one()
        return {
            "id": self.id,
            "employee": self.employee_id.name,
            "attendance_date": fields.Date.to_string(self.attendance_date),
            "issue_type": self.issue_type,
            "issue_label": dict(self._fields["issue_type"].selection).get(self.issue_type),
            "requested_check_in": fields.Datetime.to_string(self.requested_check_in),
            "requested_check_out": fields.Datetime.to_string(self.requested_check_out) if self.requested_check_out else False,
            "reason": self.reason,
            "state": self.state,
            "submitted_on": fields.Datetime.to_string(self.create_date),
            "approver": self.approver_id.name or False,
            "decision_date": fields.Datetime.to_string(self.decision_date) if self.decision_date else False,
            "manager_comment": self.manager_comment or "",
            "attachment_count": len(self.attachment_ids),
        }

    @api.model
    def get_my_requests(self):
        employee = self.env.user.employee_id
        if not employee:
            raise UserError(_("Your user account is not linked to an employee record."))
        requests = self.search([("employee_id", "=", employee.id)], order="create_date desc")
        return [request._serialize() for request in requests]

    @api.model
    def get_manager_requests(self):
        if not self._is_manager():
            raise AccessError(_("Only Time Management managers can review attendance corrections."))
        requests = self.search([("company_id", "in", self.env.companies.ids)], order="create_date asc")
        return [request._serialize() for request in requests]

    @api.model
    def submit_request(self, values):
        employee = self.env.user.employee_id
        if not employee:
            raise UserError(_("Your user account is not linked to an employee record."))
        attendance_date = fields.Date.to_date(values.get("attendance_date"))
        if not attendance_date:
            raise ValidationError(_("Attendance date is required."))
        timezone = pytz.timezone(self.env.user.tz or "UTC")

        def to_utc(value, required=False):
            if not value:
                if required:
                    raise ValidationError(_("Requested clock-in time is required."))
                return False
            parsed = fields.Datetime.to_datetime(value)
            localized = timezone.localize(parsed).astimezone(pytz.UTC).replace(tzinfo=None)
            return localized

        requested_in = to_utc(values.get("requested_check_in"), required=True)
        requested_out = to_utc(values.get("requested_check_out"))
        day_start = timezone.localize(datetime.combine(attendance_date, time.min)).astimezone(pytz.UTC).replace(tzinfo=None)
        day_end = day_start + timedelta(days=1)
        if not (day_start <= requested_in < day_end) or (requested_out and not day_start <= requested_out < day_end):
            raise ValidationError(_("Requested times must fall on the selected attendance date."))
        if requested_out and requested_out <= requested_in:
            raise ValidationError(_("Requested check-out must be after check-in."))
        attendance = self.env["hr.attendance"].search([
            ("employee_id", "=", employee.id), ("check_in", ">=", day_start), ("check_in", "<", day_end),
        ], limit=1)
        request = self.create({
            "employee_id": employee.id,
            "attendance_id": attendance.id or False,
            "attendance_date": attendance_date,
            "issue_type": values.get("issue_type") or "other",
            "requested_check_in": requested_in,
            "requested_check_out": requested_out,
            "reason": (values.get("reason") or "").strip(),
        })
        request.action_submit()
        return request._serialize()

    @api.model
    def manager_decide(self, request_id, decision, comment=False):
        request = self.browse(request_id).exists()
        if not request:
            raise UserError(_("The regularization request no longer exists."))
        if not self._is_manager():
            raise AccessError(_("Only Time Management managers can review attendance corrections."))
        request.manager_comment = comment or False
        if decision == "approve":
            request.action_approve()
        elif decision == "reject":
            request.action_reject()
        else:
            raise ValidationError(_("Unknown manager decision."))
        return request._serialize()

    def action_submit(self):
        self._check_reason()
        self.filtered(lambda record: record.state == "draft").write({"state": "submitted"})

    def action_approve(self):
        Policy = self.env["cleon.time.policy"]
        for request in self:
            if not Policy._tm_can_approve(request, self.env.user):
                raise AccessError(_("You are not authorized to approve this attendance regularization request (self-approval is not permitted for Line Managers)."))
            if request.state != "submitted":
                raise UserError(_("Only submitted regularization requests can be approved."))
            if request.requested_check_out and request.requested_check_out <= request.requested_check_in:
                raise ValidationError(_("Requested check-out must be after check-in."))
            attendance = request.attendance_id
            before = {}
            if attendance:
                before = {
                    "check_in": fields.Datetime.to_string(attendance.check_in),
                    "check_out": fields.Datetime.to_string(attendance.check_out) if attendance.check_out else False,
                }
                attendance.sudo().write({
                    "check_in": request.requested_check_in,
                    "check_out": request.requested_check_out,
                    "cleon_edit_reason": request.reason,
                })
            else:
                attendance = self.env["hr.attendance"].sudo().create({
                    "employee_id": request.employee_id.id,
                    "check_in": request.requested_check_in,
                    "check_out": request.requested_check_out,
                    "cleon_edit_reason": request.reason,
                })
                request.sudo().attendance_id = attendance
            self.env["cleon.time.audit.log"].sudo().create({
                "attendance_id": attendance.id,
                "employee_id": request.employee_id.id,
                "action": "regularized",
                "reason": request.reason,
                "before_values": before,
                "after_values": {
                    "check_in": fields.Datetime.to_string(attendance.check_in),
                    "check_out": fields.Datetime.to_string(attendance.check_out) if attendance.check_out else False,
                },
                "company_id": request.company_id.id,
            })
            request.write({"state": "approved", "approver_id": self.env.user.id, "decision_date": fields.Datetime.now()})

    def action_reject(self):
        if not self._is_manager():
            raise AccessError(_("Only a Settings administrator can reject regularization requests."))
        if any(request.state != "submitted" for request in self):
            raise UserError(_("Only submitted regularization requests can be rejected."))
        for request in self:
            request.write({"state": "rejected", "approver_id": self.env.user.id, "decision_date": fields.Datetime.now()})
            self.env["cleon.time.audit.log"].sudo().create({
                "attendance_id": request.attendance_id.id or False,
                "employee_id": request.employee_id.id,
                "action": "rejected",
                "reason": request.manager_comment or _("Attendance regularization rejected"),
                "before_values": {"regularization_state": "submitted"},
                "after_values": {"regularization_state": "rejected"},
                "company_id": request.company_id.id,
            })

    def action_withdraw(self):
        if any(request.employee_id.user_id != self.env.user and not self._is_manager() for request in self):
            raise AccessError(_("You can only withdraw your own regularization requests."))
        if any(request.state != "submitted" for request in self):
            raise UserError(_("Only pending regularization requests can be withdrawn."))
        self.write({"state": "draft"})

    @api.model
    def withdraw_request(self, request_id):
        request = self.browse(request_id).exists()
        if not request:
            raise UserError(_("The regularization request no longer exists."))
        request.action_withdraw()
        return True
