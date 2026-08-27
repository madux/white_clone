from odoo import fields, models


class CleonTimeAuditLog(models.Model):
    _name = "cleon.time.audit.log"
    _description = "Time Management Audit Log"
    _order = "create_date desc, id desc"

    attendance_id = fields.Many2one("hr.attendance", ondelete="set null", index=True)
    employee_id = fields.Many2one("hr.employee", index=True)
    user_id = fields.Many2one("res.users", required=True, default=lambda self: self.env.user)
    action = fields.Selection([
        ("created", "Created"), ("modified", "Modified"),
        ("regularized", "Regularized"), ("approved", "Approved"),
        ("rejected", "Rejected"), ("submitted", "Submitted"),
        ("withdrawn", "Withdrawn"), ("correction", "Corrections Requested"),
        ("accepted", "Accepted"),
    ], required=True, default="modified")
    reason = fields.Text()
    module_area = fields.Selection([
        ("attendance", "Attendance"), ("shift", "Shift"),
        ("timesheet", "Timesheet"), ("overtime", "Overtime"),
        ("regularization", "Regularization"), ("settings", "Settings"),
    ], default="attendance", index=True)
    entity_type = fields.Char(index=True)
    entity_name = fields.Char()
    entity_id = fields.Integer(index=True)
    details = fields.Text()
    status = fields.Selection([
        ("success", "Success"), ("failed", "Failed"), ("pending", "Pending"),
    ], default="success", required=True)
    source = fields.Selection([
        ("web", "Web"), ("mobile", "Mobile"), ("api", "API"), ("system", "System"),
    ], default="web", required=True)
    before_values = fields.Json()
    after_values = fields.Json()
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company)
