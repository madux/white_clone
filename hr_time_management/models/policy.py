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
    regularization_window_days = fields.Integer(default=30, required=True)
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
        "standard_hours", "default_break_minutes", "default_grace_minutes", "regularization_window_days",
        "daily_overtime_threshold", "daily_overtime_rate",
        "weekend_overtime_rate", "holiday_overtime_rate",
    )
    def _check_time_values(self):
        for policy in self:
            if policy.standard_hours <= 0 or policy.standard_hours > 24:
                raise ValidationError(_("Standard working hours must be greater than 0 and no more than 24."))
            if policy.default_break_minutes < 0 or policy.default_grace_minutes < 0:
                raise ValidationError(_("Break and grace periods cannot be negative."))
            if policy.regularization_window_days < 1 or policy.regularization_window_days > 365:
                raise ValidationError(_("The regularization window must be between 1 and 365 days."))
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
            "regularization_window_days": policy.regularization_window_days or 30,
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
            "regularization_window_days",
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

    @api.model
    def get_settings_overview(self):
        if not self.env.user.has_group("base.group_system"):
            raise AccessError(_("Only Settings administrators can view configuration."))
        company = self.env.company
        policy = self.search([("company_id", "=", company.id)], limit=1)
        Shift = self.env["cleon.hr.shift"]
        Timesheet = self.env["cleon.time.sheet"]

        # --- Attendance status ---
        att_items = []
        if policy:
            clock = dict(self.fields_get(["clock_method"])["clock_method"]["selection"]).get(policy.clock_method, policy.clock_method)
            att_items = [
                _("Clock Method: %s") % clock,
                _("Working Hours: %sh/day") % int(policy.standard_hours),
                _("Grace Period: %s min") % policy.default_grace_minutes,
                _("Break: %s min") % policy.default_break_minutes,
            ]
            att_status = "configured"
        else:
            att_status = "not_set"

        # --- Shift Management status ---
        shifts = Shift.search([("company_id", "=", company.id)])
        shift_count = len(shifts)
        assignments = self.env["cleon.hr.shift.assignment"].search_count([("company_id", "=", company.id)])
        shift_items = [
            _("Shifts Created: %d") % shift_count,
            _("Assignments: %d") % assignments,
            _("Shift Swapping: Enabled") if shift_count else _("No shifts configured yet"),
        ]
        shift_status = "configured" if shift_count >= 2 else ("partial" if shift_count >= 1 else "not_set")

        # --- Overtime status ---
        ot_rules = self.env["cleon.overtime.request"].search_count([("company_id", "=", company.id)])
        ot_items = []
        if policy:
            ot_items = [
                _("Daily OT Threshold: %sh") % int(policy.daily_overtime_threshold),
                _("Daily Rate: %sx") % policy.daily_overtime_rate,
                _("Weekend: %s") % ((_("%.1fx") % policy.weekend_overtime_rate) if policy.weekend_overtime else _("Disabled")),
                _("Holiday: %s") % ((_("%.1fx") % policy.holiday_overtime_rate) if policy.holiday_overtime else _("Disabled")),
            ]
            ot_status = "configured"
        else:
            ot_status = "not_set"

        # --- Time Tracking status ---
        sheet_count = Timesheet.search_count([("company_id", "=", company.id)]) if "cleon.time.sheet" in self.env else 0
        track_items = [
            _("Time Tracking: Enabled"),
            _("Timesheets Logged: %d") % sheet_count,
            _("Approval Required: Yes"),
        ]
        track_status = "configured"

        # --- Onboarding checklist ---
        checklist = {
            "set_shifts": shift_count > 0,
            "assign_employees": assignments > 0,
            "configure_ot": bool(policy and policy.daily_overtime_threshold),
            "enable_timesheets": True,
            "launched": bool(policy and policy.launched),
        }

        return {
            "attendance": {"status": att_status, "items": att_items},
            "shift": {"status": shift_status, "items": shift_items},
            "overtime": {"status": ot_status, "items": ot_items},
            "tracking": {"status": track_status, "items": track_items},
            "checklist": checklist,
        }

