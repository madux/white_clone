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
        ("rejected", "Rejected"),
    ], required=True, default="modified")
    reason = fields.Text()
    before_values = fields.Json()
    after_values = fields.Json()
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company)
