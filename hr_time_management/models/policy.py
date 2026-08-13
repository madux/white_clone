from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class CleonTimePolicy(models.Model):
    _name = "cleon.time.policy"
    _description = "CleonHR Time Management Company Policy"
    _rec_name = "company_id"

    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)
    active = fields.Boolean(default=True)
    work_week = fields.Selection([
        ("five", "5-day week"), ("six", "6-day week"), ("custom", "Custom"),
    ], default="five", required=True)
    standard_hours = fields.Float(default=8.0, required=True)
    default_break_minutes = fields.Integer(default=60)
    default_grace_minutes = fields.Integer(default=15)
    clock_method = fields.Selection([
        ("manual", "Manual"), ("biometric", "Biometric"),
        ("gps", "GPS-based"), ("ip", "IP-based"), ("mixed", "Multiple Methods"),
    ], default="manual", required=True)
    weekend_overtime = fields.Boolean(default=True)
    holiday_overtime = fields.Boolean(default=True)
    daily_overtime_threshold = fields.Float(default=8.0)
    daily_overtime_rate = fields.Float(default=1.5)
    weekend_overtime_rate = fields.Float(default=2.0)
    holiday_overtime_rate = fields.Float(default=2.5)
    overtime_request_mode = fields.Selection([
        ("automatic", "Automatic"), ("manual", "Manual Request"), ("both", "Automatic and Manual"),
    ], default="both", required=True)
    synchronization_frequency = fields.Selection([
        ("realtime", "Real-time"), ("daily", "Daily"), ("weekly", "Weekly"),
    ], default="realtime", required=True)
    payroll_integration = fields.Boolean()
    performance_integration = fields.Boolean()
    employee_portal = fields.Boolean(default=True)
    leave_integration = fields.Boolean(default=True)
    launched = fields.Boolean(default=False)
    go_live_date = fields.Date()

    _sql_constraints = [
        ("time_policy_company_unique", "unique(company_id)", "Only one Time Management policy is allowed per company."),
    ]

    @api.constrains(
        "standard_hours", "default_break_minutes", "default_grace_minutes",
        "daily_overtime_threshold", "daily_overtime_rate",
        "weekend_overtime_rate", "holiday_overtime_rate",
    )
    def _check_time_values(self):
        for policy in self:
            if policy.standard_hours <= 0 or policy.standard_hours > 24:
                raise ValidationError(_("Standard working hours must be greater than 0 and no more than 24."))
            if policy.default_break_minutes < 0 or policy.default_grace_minutes < 0:
                raise ValidationError(_("Break and grace periods cannot be negative."))
            if policy.daily_overtime_threshold < 0:
                raise ValidationError(_("The daily overtime threshold cannot be negative."))
            if min(policy.daily_overtime_rate, policy.weekend_overtime_rate, policy.holiday_overtime_rate) < 0:
                raise ValidationError(_("Overtime multiplier rates cannot be negative."))

    @api.model
    def get_cleon_policy(self):
        if not self.env.user.has_group("base.group_system"):
            raise AccessError(_("Only Settings administrators can view company policy configuration."))
        policy = self.search([("company_id", "=", self.env.company.id)], limit=1)
        return {
            "id": policy.id,
            "work_week": policy.work_week or "five",
            "standard_hours": policy.standard_hours or 8,
            "default_break_minutes": policy.default_break_minutes or 0,
            "default_grace_minutes": policy.default_grace_minutes or 0,
            "clock_method": policy.clock_method or "manual",
            "daily_overtime_threshold": policy.daily_overtime_threshold or 8,
            "daily_overtime_rate": policy.daily_overtime_rate or 1.5,
            "weekend_overtime": policy.weekend_overtime,
            "weekend_overtime_rate": policy.weekend_overtime_rate or 2.0,
            "holiday_overtime": policy.holiday_overtime,
            "holiday_overtime_rate": policy.holiday_overtime_rate or 2.5,
            "overtime_request_mode": policy.overtime_request_mode or "both",
            "synchronization_frequency": policy.synchronization_frequency or "realtime",
            "payroll_integration": policy.payroll_integration,
            "performance_integration": policy.performance_integration,
            "employee_portal": policy.employee_portal,
            "leave_integration": policy.leave_integration,
            "launched": policy.launched,
            "go_live_date": fields.Date.to_string(policy.go_live_date) if policy.go_live_date else False,
        }

    @api.model
    def save_cleon_policy(self, values):
        if not self.env.user.has_group("base.group_system"):
            raise AccessError(_("Only Settings administrators can change company policy configuration."))
        allowed = {
            "work_week", "standard_hours", "default_break_minutes", "default_grace_minutes",
            "clock_method", "daily_overtime_threshold", "weekend_overtime", "holiday_overtime",
            "daily_overtime_rate", "weekend_overtime_rate", "holiday_overtime_rate",
            "overtime_request_mode", "synchronization_frequency", "payroll_integration",
            "performance_integration", "employee_portal", "leave_integration",
            "launched", "go_live_date",
        }
        clean = {key: value for key, value in values.items() if key in allowed}
        policy = self.search([("company_id", "=", self.env.company.id)], limit=1)
        if policy:
            policy.write(clean)
        else:
            clean["company_id"] = self.env.company.id
            policy = self.create(clean)
        return policy.get_cleon_policy()
