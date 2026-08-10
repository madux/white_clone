from odoo import fields, models


class CleonAttendanceRegularization(models.Model):
    _name = "cleon.attendance.regularization"
    _description = "Attendance Regularization Request"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "create_date desc"

    employee_id = fields.Many2one("hr.employee", required=True, default=lambda self: self.env.user.employee_id)
    attendance_id = fields.Many2one("hr.attendance")
    requested_check_in = fields.Datetime(required=True)
    requested_check_out = fields.Datetime()
    reason = fields.Text(required=True)
    state = fields.Selection([
        ("draft", "Draft"), ("submitted", "Submitted"),
        ("approved", "Approved"), ("rejected", "Rejected"),
    ], default="draft", required=True, tracking=True)
    company_id = fields.Many2one(related="employee_id.company_id", store=True)
