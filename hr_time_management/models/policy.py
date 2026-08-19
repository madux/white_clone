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
    policy_type = fields.Selection([

        ("strict", "Strict Policy"), ("lenient", "Lenient Policy"),
    ], default="strict", required=True)
    selected_shift_id = fields.Many2one("cleon.hr.shift", string="Default Shift Template")
    half_day_hours = fields.Float(default=4.0)
    enable_time_round_off = fields.Boolean(default=True)
    round_off_interval = fields.Integer(default=15)
    enable_break_period = fields.Boolean(default=False)
    weekend_days = fields.Char(default="0,6", help="Comma-separated weekday numbers for weekend (0=Sun, 6=Sat)")
    enable_overtime = fields.Boolean(default=True)
    daily_overtime_enabled = fields.Boolean(default=True)
    weekly_overtime_enabled = fields.Boolean(default=True)
    weekly_overtime_threshold = fields.Float(default=40.0)
    weekly_overtime_rate = fields.Float(default=1.5)
    daily_overtime_approval = fields.Selection([("required", "Required"), ("auto", "Automatic"), ("none", "None")], default="required")
    weekly_overtime_approval = fields.Selection([("required", "Required"), ("auto", "Automatic"), ("none", "None")], default="required")
    weekend_overtime_approval = fields.Selection([("required", "Required"), ("auto", "Automatic"), ("none", "None")], default="required")
    holiday_overtime_approval = fields.Selection([("required", "Required"), ("auto", "Automatic"), ("none", "None")], default="required")
    launched = fields.Boolean(default=False)
    go_live_date = fields.Date()
    currency_id = fields.Many2one(related="company_id.currency_id", readonly=True)
    billable_tracking_enabled = fields.Boolean(default=True, string="Enable Billable Tracking")
    default_billing_rate = fields.Monetary(default=150.0, currency_field="currency_id", string="Default Billing Rate")


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
            "policy_type": policy.policy_type or "strict",
            "selected_shift_id": policy.selected_shift_id.id if policy.selected_shift_id else False,
            "work_week": policy.work_week or "five",
            "standard_hours": policy.standard_hours or 8,
            "half_day_hours": policy.half_day_hours or 4.0,
            "default_break_minutes": policy.default_break_minutes or 60,
            "default_grace_minutes": policy.default_grace_minutes or 15,
            "enable_time_round_off": policy.enable_time_round_off,
            "round_off_interval": policy.round_off_interval or 15,
            "enable_break_period": policy.enable_break_period,
            "weekend_days": [int(d) for d in (policy.weekend_days or "0,6").split(",") if d.isdigit()],
            "regularization_window_days": policy.regularization_window_days or 30,
            "clock_method": policy.clock_method or "manual",
            "enable_overtime": policy.enable_overtime,
            "daily_overtime_enabled": policy.daily_overtime_enabled,
            "daily_overtime_threshold": policy.daily_overtime_threshold or 8,
            "daily_overtime_rate": policy.daily_overtime_rate or 1.5,
            "daily_overtime_approval": policy.daily_overtime_approval or "required",
            "weekly_overtime_enabled": policy.weekly_overtime_enabled,
            "weekly_overtime_threshold": policy.weekly_overtime_threshold or 40,
            "weekly_overtime_rate": policy.weekly_overtime_rate or 1.5,
            "weekly_overtime_approval": policy.weekly_overtime_approval or "required",
            "weekend_overtime": policy.weekend_overtime,
            "weekend_overtime_rate": policy.weekend_overtime_rate or 2.0,
            "weekend_overtime_approval": policy.weekend_overtime_approval or "required",
            "holiday_overtime": policy.holiday_overtime,
            "holiday_overtime_rate": policy.holiday_overtime_rate or 2.5,
            "holiday_overtime_approval": policy.holiday_overtime_approval or "required",
            "overtime_request_mode": policy.overtime_request_mode or "both",
            "synchronization_frequency": policy.synchronization_frequency or "realtime",
            "payroll_integration": policy.payroll_integration,
            "performance_integration": policy.performance_integration,
            "employee_portal": policy.employee_portal,
            "leave_integration": policy.leave_integration,
            "launched": policy.launched,
            "go_live_date": fields.Date.to_string(policy.go_live_date) if policy.go_live_date else False,
            "billable_tracking_enabled": policy.billable_tracking_enabled if policy else True,
            "default_billing_rate": policy.default_billing_rate if policy else 150.0,
            "currency_symbol": policy.currency_id.symbol if policy and policy.currency_id else (self.env.company.currency_id.symbol or "$"),
        }

    @api.model
    def save_cleon_policy(self, values):
        if not self.env.user.has_group("base.group_system"):
            raise AccessError(_("Only Settings administrators can change company policy configuration."))
        values = dict(values)
        if "weekend_days" in values and isinstance(values["weekend_days"], list):
            values["weekend_days"] = ",".join(str(d) for d in values["weekend_days"])
        allowed = {
            "policy_type", "selected_shift_id", "work_week", "standard_hours", "half_day_hours",
            "default_break_minutes", "default_grace_minutes", "enable_time_round_off",
            "round_off_interval", "enable_break_period", "weekend_days", "regularization_window_days",
            "clock_method", "enable_overtime", "daily_overtime_enabled", "daily_overtime_threshold",
            "daily_overtime_rate", "daily_overtime_approval", "weekly_overtime_enabled",
            "weekly_overtime_threshold", "weekly_overtime_rate", "weekly_overtime_approval",
            "weekend_overtime", "weekend_overtime_rate", "weekend_overtime_approval",
            "holiday_overtime", "holiday_overtime_rate", "holiday_overtime_approval",
            "overtime_request_mode", "synchronization_frequency", "payroll_integration",
            "performance_integration", "employee_portal", "leave_integration",
            "launched", "go_live_date", "billable_tracking_enabled", "default_billing_rate",
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

    @api.model
    def _tm_role(self, user=None):
        user = user or self.env.user
        if user.has_group("base.group_system"):
            return "system_admin"
        if user.has_group("hr_time_management.group_time_management_hr_admin"):
            return "hr_admin"
        if user.has_group("hr_time_management.group_time_management_hr_manager"):
            return "hr_manager"
        if user.has_group("hr_time_management.group_time_management_line_manager") or user.has_group("hr_time_management.group_time_management_manager"):
            return "line_manager"
        return "employee"

    @api.model
    def _tm_scope_employee_ids(self, user=None):
        user = user or self.env.user
        role = self._tm_role(user)
        company_id = self.env.company.id
        Employee = self.env["hr.employee"]
        if role in ("system_admin", "hr_admin", "hr_manager"):
            return Employee.search([("company_id", "=", company_id), ("active", "=", True)]).ids
        if role == "line_manager":
            emp = user.employee_id
            if not emp:
                return []
            subordinates = Employee.search([("company_id", "=", company_id), ("parent_id", "=", emp.id), ("active", "=", True)]).ids
            return list(set([emp.id] + subordinates))
        emp = user.employee_id
        return [emp.id] if emp else []

    @api.model
    def _tm_can_configure(self, user=None):
        role = self._tm_role(user)
        return role in ("system_admin", "hr_admin")

    @api.model
    def _tm_can_approve(self, record, user=None):
        user = user or self.env.user
        role = self._tm_role(user)
        if role in ("system_admin", "hr_admin", "hr_manager"):
            return True
        if role == "line_manager":
            allowed_ids = self._tm_scope_employee_ids(user)
            target_emp = getattr(record, "employee_id", False)
            return bool(target_emp and target_emp.id in allowed_ids and target_emp.user_id != user)
        return False

    @api.model
    def _tm_capabilities(self):
        company = self.env.company
        policy = self.search([("company_id", "=", company.id)], limit=1)
        analytic_fields = self.env["account.analytic.line"]._fields if "account.analytic.line" in self.env else {}
        return {
            "payroll": "hr.payslip" in self.env or "cleon.payroll.entry" in self.env,
            "sales_timesheet": "sale.order.line" in self.env and "so_line" in analytic_fields,
            "project": "project.project" in self.env and "project.task" in self.env,
            "leave": "hr.leave" in self.env,
            "gps_configured": bool(policy and policy.clock_method in ("gps", "mixed")),
            "browser_geolocation_supported": True,
            "biometric_configured": bool(policy and policy.clock_method in ("biometric", "mixed")),
            "webauthn_supported_by_app": True,
            "biometric_terminal_connector": False,
        }

    @api.model
    def get_cleon_access(self):
        role = self._tm_role()
        capabilities = self._tm_capabilities()
        can_config = self._tm_can_configure()
        is_manager = role in ("system_admin", "hr_admin", "hr_manager", "line_manager")
        return {
            "role": role,
            "can_configure": can_config,
            "is_manager": is_manager,
            "capabilities": capabilities,
            "featureAccess": {
                "attendance": True,
                "shift": True,
                "tracking": True,
                "overtime": True,
                "settings": can_config,
            },
        }


