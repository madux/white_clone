from odoo import api, fields, models, _
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

    def action_submit(self):
        self._check_reason()
        self.filtered(lambda record: record.state == "draft").write({"state": "submitted"})

    def action_approve(self):
        if not self.env.user.has_group("base.group_system"):
            raise AccessError(_("Only a Settings administrator can approve regularization requests."))
        for request in self:
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
                attendance.write({
                    "check_in": request.requested_check_in,
                    "check_out": request.requested_check_out,
                    "cleon_edit_reason": request.reason,
                })
            else:
                attendance = self.env["hr.attendance"].create({
                    "employee_id": request.employee_id.id,
                    "check_in": request.requested_check_in,
                    "check_out": request.requested_check_out,
                    "cleon_edit_reason": request.reason,
                })
                request.attendance_id = attendance
            self.env["cleon.time.audit.log"].create({
                "attendance_id": attendance.id,
                "employee_id": request.employee_id.id,
                "action": "regularized",
                "reason": request.reason,
                "before_values": before,
                "after_values": {
                    "check_in": fields.Datetime.to_string(attendance.check_in),
                    "check_out": fields.Datetime.to_string(attendance.check_out) if attendance.check_out else False,
                },
            })
            request.write({"state": "approved", "approver_id": self.env.user.id, "decision_date": fields.Datetime.now()})

    def action_reject(self):
        if not self.env.user.has_group("base.group_system"):
            raise AccessError(_("Only a Settings administrator can reject regularization requests."))
        if any(request.state != "submitted" for request in self):
            raise UserError(_("Only submitted regularization requests can be rejected."))
        self.write({"state": "rejected", "approver_id": self.env.user.id, "decision_date": fields.Datetime.now()})

    def action_withdraw(self):
        if any(request.state != "submitted" for request in self):
            raise UserError(_("Only pending regularization requests can be withdrawn."))
        self.write({"state": "draft"})
