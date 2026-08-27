import ipaddress
from datetime import timedelta
from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError


class CleonTimePolicy(models.Model):
    _name = "cleon.time.policy"
    _description = "CleonHR Time Management Company Policy"
    _rec_name = "company_id"

    _WIZARD_STEP_FIELDS = {
        1: {"policy_type", "work_week", "standard_hours", "half_day_hours"},
        2: {"default_break_minutes", "default_grace_minutes", "round_off_interval"},
        3: {"clock_method", "office_latitude", "office_longitude", "gps_radius_meters", "ip_whitelist"},
        4: {
            "enable_overtime", "daily_overtime_threshold", "daily_overtime_rate",
            "weekly_overtime_enabled", "weekly_overtime_threshold", "weekly_overtime_rate",
            "weekend_overtime_rate", "holiday_overtime_rate", "overtime_auto_approve_max_hours",
        },
        5: {"regularization_window_days", "regularization_require_approval", "regularization_fallback_approver"},
        6: {"overtime_require_approval", "overtime_fallback_approver", "overtime_notify_employee"},
        7: {"billable_tracking_enabled", "default_billing_rate", "payroll_integration"},
    }
    _CLOCK_METHOD_FIELDS = {"clock_method", "office_latitude", "office_longitude", "gps_radius_meters", "ip_whitelist"}

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
    interface_switching_enabled = fields.Boolean(
        default=True,
        string="Allow Admin/Employee View Switching",
        help="Allow eligible managers linked to an employee to switch to the Employee Portal.",
    )
    leave_integration = fields.Boolean(default=True)
    attendance_app_available = fields.Boolean(default=True, string="Attendance Application Available")
    shift_app_available = fields.Boolean(default=True, string="Shift Management Application Available")
    tracking_app_available = fields.Boolean(default=True, string="Time Tracking Application Available")
    overtime_app_available = fields.Boolean(default=True, string="Overtime Application Available")
    policy_type = fields.Selection([

        ("strict", "Strict Policy"), ("lenient", "Lenient Policy"),
    ], default="strict", required=True)
    selected_shift_id = fields.Many2one(
        "cleon.hr.shift", string="Default Shift Template", check_company=True
    )
    half_day_hours = fields.Float(default=4.0)
    enable_time_round_off = fields.Boolean(default=True)
    round_off_interval = fields.Integer(default=15)
    enable_break_period = fields.Boolean(default=False)
    weekend_days = fields.Char(default="5,6", help="Comma-separated weekday numbers for weekend (0=Mon, 5=Sat, 6=Sun)")
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
    office_latitude = fields.Float(string="Office Latitude", digits=(10, 7), default=0.0)
    office_longitude = fields.Float(string="Office Longitude", digits=(10, 7), default=0.0)
    gps_radius_meters = fields.Float(string="Allowed GPS Radius (meters)", default=200.0)
    ip_whitelist = fields.Text(string="Allowed IP Addresses / Subnets", help="Comma or newline separated list of allowed IP addresses or CIDR subnets")
    overtime_auto_approve_max_hours = fields.Float(string="Max Auto-Approve Hours", default=2.0)
    regularization_require_approval = fields.Boolean(default=True, string="Require Regularization Approval")
    regularization_fallback_approver = fields.Selection([
        ("direct_manager", "Direct Manager"),
        ("department_head", "Department Head"),
        ("hr_manager", "HR Manager"),
    ], default="direct_manager", string="Regularization Fallback Approver")
    overtime_require_approval = fields.Boolean(default=True, string="Require Overtime Approval")
    overtime_fallback_approver = fields.Selection([
        ("manager", "Direct Manager"),
        ("dept", "Department Head"),
        ("hr_manager", "HR Manager"),
    ], default="manager", string="Overtime Fallback Approver")
    overtime_notify_employee = fields.Boolean(default=True, string="Notify Employee on Overtime Decision")
    wizard_step = fields.Integer(default=1, string="Wizard Current Step")
    wizard_completed_steps = fields.Char(default="", string="Wizard Completed Steps")
    wizard_status = fields.Selection([
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
    ], default="in_progress", string="Wizard Status")

    @api.model
    def get_approval_chain_summary(self, workflow_code="time_overtime"):
        company = self.env.company
        wft = self.env["cleon.approval.workflow.type"].sudo().search([("code", "=", workflow_code)], limit=1)
        if not wft:
            return {"has_chain": False, "chain_name": "", "level_count": 0, "steps": []}
        chain = self.env["cleon.approval.chain"].sudo().search([
            ("company_id", "=", company.id),
            ("workflow_type_id", "=", wft.id),
            ("active", "=", True),
            ("is_default", "=", True),
        ], limit=1)
        if not chain:
            return {"has_chain": False, "chain_name": "", "level_count": 0, "steps": []}
        steps = []
        for step in chain.step_ids.sorted("sequence"):
            approver_label = step.name
            if step.approver_type == "line_manager":
                approver_label = _("Direct Manager")
            elif step.approver_type == "group" and step.approver_group_id:
                approver_label = step.approver_group_id.name
            elif step.approver_type == "specific_user" and step.specific_user_id:
                approver_label = step.specific_user_id.name
            steps.append({
                "sequence": step.sequence,
                "name": step.name,
                "label": approver_label,
                "sla_timeout_hours": step.sla_timeout_hours,
                "sla_action": step.sla_action,
            })
        return {
            "has_chain": True,
            "chain_id": chain.id,
            "chain_name": chain.name,
            "level_count": len(steps),
            "steps": steps,
            "step_flow": " → ".join(s["label"] for s in steps),
        }


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
    def get_runtime_policy(self):
        """Safe non-sensitive policy RPC callable by ordinary employees for UI/runtime behavior."""
        policy = self.search([("company_id", "=", self.env.company.id)], limit=1)
        return {
            "standard_hours": policy.standard_hours if policy else 8.0,
            "half_day_hours": policy.half_day_hours if policy else 4.0,
            "default_break_minutes": policy.default_break_minutes if policy else 60,
            "default_grace_minutes": policy.default_grace_minutes if policy else 15,
            "regularization_window_days": policy.regularization_window_days if policy else 30,
            "clock_method": policy.clock_method if policy else "manual",
            "enable_overtime": policy.enable_overtime if policy else True,
            "overtime_auto_approve_max_hours": policy.overtime_auto_approve_max_hours if policy else 2.0,
            "regularization_require_approval": policy.regularization_require_approval if policy else True,
            "overtime_require_approval": policy.overtime_require_approval if policy else True,
            "overtime_notify_employee": policy.overtime_notify_employee if policy else True,
            "weekend_days": [int(d.strip()) for d in (policy.weekend_days or "5,6").split(",") if d.strip().isdigit()] if policy else [5, 6],
        }

    @api.model
    def _tm_feature_access(self, policy=None):
        """Return the applications enabled for the current company subscription."""
        policy = policy or self.sudo().search([("company_id", "=", self.env.company.id)], limit=1)
        # Existing databases had no subscription switches. Keep all applications
        # available until an administrator explicitly changes the policy.
        return {
            "attendance": not policy or bool(policy.attendance_app_available),
            "shift": not policy or bool(policy.shift_app_available),
            "tracking": not policy or bool(policy.tracking_app_available),
            "overtime": not policy or bool(policy.overtime_app_available),
        }

    @api.model
    def get_cleon_policy(self):
        """Restricted administrative policy object containing financial billing rates and security configs."""
        if not (self.env.su or self._tm_can_configure()):
            raise AccessError(_("Only Settings administrators can view administrative policy configuration."))
        policy = self.search([("company_id", "=", self.env.company.id)], limit=1)
        return {
            "id": policy.id if policy else False,
            "policy_type": policy.policy_type if policy else "strict",
            "selected_shift_id": policy.selected_shift_id.id if policy and policy.selected_shift_id else False,
            "work_week": policy.work_week if policy else "five",
            "standard_hours": policy.standard_hours if policy else 8,
            "half_day_hours": policy.half_day_hours if policy else 4.0,
            "default_break_minutes": policy.default_break_minutes if policy else 60,
            "default_grace_minutes": policy.default_grace_minutes if policy else 15,
            "enable_time_round_off": policy.enable_time_round_off if policy else False,
            "round_off_interval": policy.round_off_interval if policy else 15,
            "enable_break_period": policy.enable_break_period if policy else False,
            "weekend_days": [int(d.strip()) for d in (policy.weekend_days or "5,6").split(",") if d.strip().isdigit()] if policy else [5, 6],
            "regularization_window_days": policy.regularization_window_days if policy else 30,
            "clock_method": policy.clock_method if policy else "manual",
            "enable_overtime": policy.enable_overtime if policy else True,
            "daily_overtime_enabled": policy.daily_overtime_enabled if policy else True,
            "daily_overtime_threshold": policy.daily_overtime_threshold if policy else 8,
            "daily_overtime_rate": policy.daily_overtime_rate if policy else 1.5,
            "daily_overtime_approval": policy.daily_overtime_approval if policy else "required",
            "weekly_overtime_enabled": policy.weekly_overtime_enabled if policy else True,
            "weekly_overtime_threshold": policy.weekly_overtime_threshold if policy else 40,
            "weekly_overtime_rate": policy.weekly_overtime_rate if policy else 1.5,
            "weekly_overtime_approval": policy.weekly_overtime_approval if policy else "required",
            "weekend_overtime": policy.weekend_overtime if policy else True,
            "weekend_overtime_rate": policy.weekend_overtime_rate if policy else 2.0,
            "weekend_overtime_approval": policy.weekend_overtime_approval if policy else "required",
            "holiday_overtime": policy.holiday_overtime if policy else True,
            "holiday_overtime_rate": policy.holiday_overtime_rate if policy else 2.5,
            "holiday_overtime_approval": policy.holiday_overtime_approval if policy else "required",
            "overtime_request_mode": policy.overtime_request_mode if policy else "both",
            "synchronization_frequency": policy.synchronization_frequency if policy else "realtime",
            "payroll_integration": policy.payroll_integration if policy else True,
            "performance_integration": policy.performance_integration if policy else True,
            "employee_portal": policy.employee_portal if policy else True,
            "interface_switching_enabled": policy.interface_switching_enabled if policy else True,
            "leave_integration": policy.leave_integration if policy else True,
            "attendance_app_available": policy.attendance_app_available if policy else True,
            "shift_app_available": policy.shift_app_available if policy else True,
            "tracking_app_available": policy.tracking_app_available if policy else True,
            "overtime_app_available": policy.overtime_app_available if policy else True,
            "launched": policy.launched if policy else False,
            "go_live_date": fields.Date.to_string(policy.go_live_date) if policy and policy.go_live_date else False,
            "billable_tracking_enabled": policy.billable_tracking_enabled if policy else True,
            "default_billing_rate": policy.default_billing_rate if policy else 150.0,
            "currency_symbol": policy.currency_id.symbol if policy and policy.currency_id else (self.env.company.currency_id.symbol or "$"),
            "office_latitude": policy.office_latitude if policy else 0.0,
            "office_longitude": policy.office_longitude if policy else 0.0,
            "gps_radius_meters": policy.gps_radius_meters if policy else 200.0,
            "ip_whitelist": policy.ip_whitelist or "" if policy else "",
            "overtime_auto_approve_max_hours": policy.overtime_auto_approve_max_hours if policy else 2.0,
            "regularization_require_approval": policy.regularization_require_approval if policy else True,
            "regularization_fallback_approver": policy.regularization_fallback_approver if policy else "direct_manager",
            "overtime_require_approval": policy.overtime_require_approval if policy else True,
            "overtime_fallback_approver": policy.overtime_fallback_approver if policy else "manager",
            "overtime_notify_employee": policy.overtime_notify_employee if policy else True,
            "wizard_step": policy.wizard_step if policy else 1,
            "wizard_completed_steps": [int(s.strip()) for s in (policy.wizard_completed_steps or "").split(",") if s.strip().isdigit()] if policy else [],
            "wizard_status": policy.wizard_status if policy else "in_progress",
        }

    @api.model
    def get_wizard_state(self):
        if not (self.env.su or self._tm_can_configure()):
            raise AccessError(_("Only Settings administrators can view setup wizard progress."))
        policy = self.search([("company_id", "=", self.env.company.id)], limit=1)
        if not policy:
            policy = self.create({"company_id": self.env.company.id})

        completed_list = [int(s.strip()) for s in (policy.wizard_completed_steps or "").split(",") if s.strip().isdigit()]

        next_incomplete = next((step for step in range(1, 8) if step not in completed_list), 8)
        return {
            "wizard_step": 8 if policy.wizard_status == "completed" else next_incomplete,
            "wizard_completed_steps": completed_list,
            "wizard_status": policy.wizard_status or "in_progress",
            "launched": policy.launched or False,
            "go_live_date": fields.Date.to_string(policy.go_live_date) if policy.go_live_date else False,
            "policy": policy.get_cleon_policy(),
            "shifts": self.env["cleon.hr.shift"].get_shift_management_data().get("shifts", []),
            "approval_overtime_chain": self.get_approval_chain_summary("time_overtime"),
            "approval_regularization_chain": self.get_approval_chain_summary("time_regularization"),
            "approval_timesheet_chain": self.get_approval_chain_summary("time_timesheet"),
        }

    @api.model
    def save_wizard_step(self, step_number, step_data=None):
        if not (self.env.su or self._tm_can_configure()):
            raise AccessError(_("Only Settings administrators can update setup wizard configuration."))
        step_number = int(step_number)
        if step_number < 1 or step_number > 7:
            raise ValidationError(_("Invalid wizard step number: %s") % step_number)

        policy = self.search([("company_id", "=", self.env.company.id)], limit=1)
        if not policy:
            policy = self.create({"company_id": self.env.company.id})

        allowed = self._WIZARD_STEP_FIELDS[step_number]
        clean = {key: value for key, value in dict(step_data or {}).items() if key in allowed}
        self._validate_wizard_step(policy, step_number, clean)
        if clean:
            self.save_cleon_policy(clean)

        completed_set = set([int(s.strip()) for s in (policy.wizard_completed_steps or "").split(",") if s.strip().isdigit()])
        completed_set.add(step_number)
        completed_str = ",".join(str(s) for s in sorted(completed_set))

        next_incomplete = next((step for step in range(1, 8) if step not in completed_set), 8)
        policy.write({
            "wizard_step": next_incomplete,
            "wizard_completed_steps": completed_str,
        })
        return self.get_wizard_state()

    def _validated_clock_method_values(self, policy, values):
        """Validate and normalize clock settings for every administrative save path."""
        candidate = {
            key: values.get(key, policy[key])
            for key in self._CLOCK_METHOD_FIELDS
        }
        valid_methods = {item[0] for item in self._fields["clock_method"].selection}
        method = candidate["clock_method"]
        if method not in valid_methods:
            raise ValidationError(_("Unsupported attendance clock method: %s") % method)
        try:
            latitude = float(candidate["office_latitude"] or 0.0)
            longitude = float(candidate["office_longitude"] or 0.0)
            radius = float(candidate["gps_radius_meters"] if candidate["gps_radius_meters"] is not None else 200.0)
        except (TypeError, ValueError):
            raise ValidationError(_("GPS coordinates and radius must be numeric."))

        if method in ("gps", "mixed"):
            if not -90.0 <= latitude <= 90.0:
                raise ValidationError(_("Latitude must be between -90.0 and 90.0 degrees."))
            if not -180.0 <= longitude <= 180.0:
                raise ValidationError(_("Longitude must be between -180.0 and 180.0 degrees."))
            if latitude == 0.0 and longitude == 0.0:
                raise ValidationError(_("GPS attendance requires configured office coordinates."))
            if radius <= 0.0:
                raise ValidationError(_("GPS radius must be greater than 0 meters."))

        whitelist = str(candidate["ip_whitelist"] or "")
        if method in ("ip", "mixed"):
            entries = [entry.strip() for entry in whitelist.replace("\n", ",").split(",") if entry.strip()]
            if not entries:
                raise ValidationError(_("IP attendance requires at least one allowed IP address or subnet."))
            for entry in entries:
                try:
                    ipaddress.ip_network(entry, strict=False)
                except ValueError:
                    raise ValidationError(_("Invalid IP address or subnet: %s") % entry)

        return {
            "clock_method": method,
            "office_latitude": latitude,
            "office_longitude": longitude,
            "gps_radius_meters": radius,
            "ip_whitelist": whitelist,
        }

    def _validate_wizard_step(self, policy, step_number, values):
        candidate = lambda field: values.get(field, policy[field])
        if step_number == 1:
            if not 0 < float(candidate("standard_hours")) <= 24:
                raise ValidationError(_("Standard working hours must be greater than 0 and no more than 24."))
            if not 0 < float(candidate("half_day_hours")) < float(candidate("standard_hours")):
                raise ValidationError(_("Half-day hours must be greater than 0 and less than standard working hours."))
        elif step_number == 2:
            if min(int(candidate("default_break_minutes")), int(candidate("default_grace_minutes")), int(candidate("round_off_interval"))) < 0:
                raise ValidationError(_("Break, grace, and rounding values cannot be negative."))
        elif step_number == 3:
            self._validated_clock_method_values(policy, values)
        elif step_number == 4:
            numeric_fields = (
                "daily_overtime_threshold", "daily_overtime_rate", "weekly_overtime_threshold",
                "weekly_overtime_rate", "weekend_overtime_rate", "holiday_overtime_rate",
                "overtime_auto_approve_max_hours",
            )
            if min(float(candidate(field)) for field in numeric_fields) < 0:
                raise ValidationError(_("Overtime thresholds, limits, and multiplier rates cannot be negative."))
        elif step_number == 5 and not 1 <= int(candidate("regularization_window_days")) <= 365:
            raise ValidationError(_("The regularization window must be between 1 and 365 days."))
        elif step_number == 7 and float(candidate("default_billing_rate")) < 0:
            raise ValidationError(_("The default billing rate cannot be negative."))

    @api.model
    def launch_policy(self, launch_data=None):
        if not (self.env.su or self._tm_can_configure()):
            raise AccessError(_("Only Settings administrators can launch system go-live."))
        policy = self.search([("company_id", "=", self.env.company.id)], limit=1)
        if not policy:
            policy = self.create({"company_id": self.env.company.id})

        completed_set = set([int(s.strip()) for s in (policy.wizard_completed_steps or "").split(",") if s.strip().isdigit()])
        required_steps = {1, 2, 3, 4, 5, 6, 7}
        if not required_steps.issubset(completed_set):
            missing = sorted(list(required_steps - completed_set))
            raise ValidationError(_("Cannot launch go-live: Setup wizard steps 1–7 must all be completed prior to launch. Missing steps: %s") % missing)

        launch_data = launch_data or {}
        go_live_date_str = launch_data.get("go_live_date") or fields.Date.to_string(fields.Date.today())

        completed_set.add(8)
        completed_str = ",".join(str(s) for s in sorted(completed_set))

        policy.write({
            "launched": True,
            "go_live_date": fields.Date.from_string(go_live_date_str),
            "wizard_status": "completed",
            "wizard_step": 8,
            "wizard_completed_steps": completed_str,
        })

        if "cleon.time.audit.log" in self.env:
            self.env["cleon.time.audit.log"].sudo().create({
                "company_id": self.env.company.id,
                "user_id": self.env.user.id,
                "action": "modified",
                "module_area": "settings",
                "entity_type": "cleon.time.policy",
                "entity_id": policy.id,
                "entity_name": _("System Go-Live Launch"),
                "details": _("System Go-Live launched on %s") % go_live_date_str,
            })

        return self.get_wizard_state()

    @api.model
    def save_cleon_policy(self, values):
        if not (self.env.su or self._tm_can_configure()):
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
            "performance_integration", "employee_portal", "interface_switching_enabled", "leave_integration",
            "attendance_app_available", "shift_app_available", "tracking_app_available", "overtime_app_available",
            "billable_tracking_enabled", "default_billing_rate",
            "overtime_auto_approve_max_hours", "regularization_require_approval", "regularization_fallback_approver",
            "overtime_require_approval", "overtime_fallback_approver", "overtime_notify_employee",
            "office_latitude", "office_longitude", "gps_radius_meters", "ip_whitelist",
        }
        clean = {key: value for key, value in values.items() if key in allowed}
        if "selected_shift_id" in clean:
            shift_id = int(clean["selected_shift_id"]) if clean["selected_shift_id"] else False
            if shift_id:
                shift = self.env["cleon.hr.shift"].browse(shift_id).exists()
                if not shift or shift.company_id != self.env.company:
                    raise ValidationError(_("Select a shift template belonging to the active company."))
            clean["selected_shift_id"] = shift_id
        policy = self.search([("company_id", "=", self.env.company.id)], limit=1)
        if not policy:
            policy = self.create({"company_id": self.env.company.id})
        if self._CLOCK_METHOD_FIELDS.intersection(clean):
            normalized = self._validated_clock_method_values(policy, clean)
            clean.update({key: normalized[key] for key in self._CLOCK_METHOD_FIELDS if key in clean})
        if policy:
            policy.write(clean)
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

    default_shift_id = fields.Many2one("cleon.hr.shift", string="Default Company Shift")

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
            emp = user.employee_id or Employee.sudo().search([("user_id", "=", user.id), ("company_id", "=", company_id)], limit=1)
            if not emp:
                return []
            subordinates = Employee.sudo().search([("company_id", "=", company_id), ("parent_id", "=", emp.id), ("active", "=", True)]).ids
            return list(set([emp.id] + subordinates))
        emp = user.employee_id or Employee.sudo().search([("user_id", "=", user.id), ("company_id", "=", company_id)], limit=1)
        return [emp.id] if emp else []

    @api.model
    def _tm_can_configure(self, user=None):
        role = self._tm_role(user)
        return role in ("system_admin", "hr_admin")

    @api.model
    def _tm_can_configure_shift_templates(self, user=None):
        role = self._tm_role(user)
        return role in ("system_admin", "hr_admin", "hr_manager")

    @api.model
    def _tm_can_manage_shift_assignment(self, employee=None, user=None):
        user = user or self.env.user
        role = self._tm_role(user)
        if role in ("system_admin", "hr_admin", "hr_manager"):
            return True
        if role == "line_manager" and employee:
            user_emp = user.employee_id or self.env["hr.employee"].sudo().search([("user_id", "=", user.id), ("company_id", "=", self.env.company.id)], limit=1)
            if user_emp and user_emp.id == employee.id:
                return False
            allowed_ids = self._tm_scope_employee_ids(user)
            return employee.id in allowed_ids
        return False

    @api.model
    def _tm_can_approve(self, record, user=None):
        user = user or self.env.user
        role = self._tm_role(user)
        if record._name == "cleon.shift.swap.request":
            user_emp = user.employee_id or self.env["hr.employee"].sudo().search([("user_id", "=", user.id), ("company_id", "=", self.env.company.id)], limit=1)
            if user_emp and (user_emp.id == record.requester_id.id or user_emp.id == record.target_employee_id.id):
                return False
        if role in ("system_admin", "hr_admin", "hr_manager"):
            return True
        if role == "line_manager":
            allowed_ids = self._tm_scope_employee_ids(user)
            target_emp = getattr(record, "employee_id", False) or getattr(record, "requester_id", False)
            return bool(target_emp and target_emp.id in allowed_ids and target_emp.sudo().user_id != user)
        return False

    @api.model
    def _tm_capabilities(self):
        company = self.env.company
        policy = self.search([("company_id", "=", company.id)], limit=1)
        analytic_fields = self.env["account.analytic.line"]._fields if "account.analytic.line" in self.env else {}

        has_hr_payroll = "hr.payslip" in self.env
        has_cleon_payroll = "cleon.payroll.entry" in self.env
        payroll_engine_installed = has_hr_payroll or has_cleon_payroll

        has_biometric_connector = False
        if "cleon.biometric.device" in self.env:
            device_model = self.env["cleon.biometric.device"].sudo()
            if "company_id" in device_model._fields:
                has_biometric_connector = bool(device_model.search_count([("company_id", "=", company.id)]))
            else:
                has_biometric_connector = bool(device_model.search_count([]))
        elif "hr.attendance.device" in self.env:
            device_model = self.env["hr.attendance.device"].sudo()
            if "company_id" in device_model._fields:
                has_biometric_connector = bool(device_model.search_count([("company_id", "=", company.id)]))
            else:
                has_biometric_connector = bool(device_model.search_count([]))

        ready_ot_count = self.env["cleon.overtime.request"].sudo().search_count([
            ("company_id", "=", company.id),
            ("state", "=", "approved"),
            ("payroll_state", "=", "ready"),
            ("employee_id.employee_number", "!=", False),
        ]) if "cleon.overtime.request" in self.env else 0

        target_engine = "hr_payroll" if has_hr_payroll else ("cleon_payroll" if has_cleon_payroll else "csv_contract")
        payroll_enabled = bool(policy and policy.payroll_integration)

        # Strict GPS Validation: non-zero lat/long and positive radius
        gps_configured = bool(
            policy and policy.clock_method in ("gps", "mixed")
            and policy.office_latitude != 0.0
            and policy.office_longitude != 0.0
            and (policy.gps_radius_meters or 0) > 0
        )

        # Strict IP CIDR Validation: every entry must parse as a valid IP or subnet
        ip_configured = False
        if policy and policy.clock_method in ("ip", "mixed") and policy.ip_whitelist and policy.ip_whitelist.strip():
            raw_entries = [e.strip() for e in policy.ip_whitelist.replace("\n", ",").split(",") if e.strip()]
            if raw_entries:
                ip_configured = True
                for entry in raw_entries:
                    try:
                        ipaddress.ip_network(entry, strict=False)
                    except ValueError:
                        try:
                            ipaddress.ip_address(entry)
                        except ValueError:
                            ip_configured = False
                            break

        return {
            "payroll_engine_installed": payroll_engine_installed,
            "payroll_contract_available": True,
            "payroll_integration_enabled": payroll_enabled,
            "payroll_adapter_available": False,
            "payroll": payroll_engine_installed,
            "payroll_contract_ready": payroll_enabled,
            "payroll_handoff": {
                "enabled": payroll_enabled,
                "target_engine": target_engine,
                "contract_available": True,
                "adapter_available": False,
                "ready_overtime_count": ready_ot_count,
                "supported_exports": ["overtime"],
            },
            "sales_timesheet": "sale.order.line" in self.env and "so_line" in analytic_fields,
            "project": "project.project" in self.env and "project.task" in self.env,
            "leave": "hr.leave" in self.env,
            "gps_configured": gps_configured,
            "ip_configured": ip_configured,
            "browser_geolocation_supported": True,
            "biometric_configured": bool(policy and policy.clock_method in ("biometric", "mixed")),
            "webauthn_supported_by_app": True,
            "biometric_terminal_connector": has_biometric_connector,
        }

    @api.model
    def save_clock_method_settings(self, clock_method, office_latitude=0.0, office_longitude=0.0, gps_radius_meters=200.0, ip_whitelist=""):
        """Targeted RPC method saving only clock-method configuration parameters with range validation."""
        if not self._tm_can_configure():
            raise AccessError(_("Only HR Administrators can configure clock method settings."))

        policy = self.search([("company_id", "=", self.env.company.id)], limit=1)
        if not policy:
            policy = self.create({"company_id": self.env.company.id})
        clean = self._validated_clock_method_values(policy, {
            "clock_method": clock_method,
            "office_latitude": office_latitude,
            "office_longitude": office_longitude,
            "gps_radius_meters": gps_radius_meters,
            "ip_whitelist": str(ip_whitelist or ""),
        })
        policy.sudo().write(clean)

        return {
            "policy": policy.get_cleon_policy(),
            "capabilities": self._tm_capabilities(),
        }

    @api.model
    def get_payroll_handoff_data(self, date_from=None, date_to=None, state_filter="ready", preview_mode=False):
        """Outbound payroll handoff contract for approved overtime records.

        Preview calls without dates are scoped to the current calendar month. A final
        handoff must always name its exact accounting period. Any overlap with an
        administratively locked period blocks the complete final handoff; records are
        never silently omitted from a requested range.
        """
        if not self._tm_can_configure() and self._tm_role() not in ("hr_manager", "system_admin"):
            raise AccessError(_("Only HR Administrators and Managers can export payroll handoff data."))

        company = self.env.company
        policy = self.search([("company_id", "=", company.id)], limit=1)

        if not preview_mode and not (policy and policy.payroll_integration):
            raise UserError(_("Payroll integration is disabled in Time Management policy settings."))

        if not date_from and not date_to:
            if not preview_mode:
                raise ValidationError(_("A date range is required for a final payroll handoff."))
            date_from = fields.Date.today().replace(day=1)
            next_month = (date_from.replace(day=28) + timedelta(days=4)).replace(day=1)
            date_to = next_month - timedelta(days=1)
        elif not date_from or not date_to:
            raise ValidationError(_("Both start and end dates are required for payroll handoff."))

        date_from = fields.Date.to_date(date_from)
        date_to = fields.Date.to_date(date_to)
        if date_from > date_to:
            raise ValidationError(_("Payroll handoff start date cannot be after its end date."))

        target_state_filter = state_filter if state_filter in ("ready", "transferred", "all") else "ready"
        domain = [("company_id", "=", company.id), ("state", "=", "approved")]
        if target_state_filter == "ready":
            domain.append(("payroll_state", "=", "ready"))
        elif target_state_filter == "transferred":
            domain.append(("payroll_state", "=", "transferred"))
        else:
            domain.append(("payroll_state", "in", ["ready", "transferred"]))

        if date_from:
            domain.append(("date", ">=", date_from))
        if date_to:
            domain.append(("date", "<=", date_to))

        ot_records = self.env["cleon.overtime.request"].search(domain)
        ApprovalInstance = self.env.get("cleon.approval.instance")
        StepModel = self.env.get("cleon.approval.instance.step")

        items = []
        unresolved_codes_count = 0

        for ot in ot_records:
            emp = ot.employee_id.sudo()
            code = emp.employee_number or False
            has_missing_code = not bool(code)
            if has_missing_code:
                unresolved_codes_count += 1

            app_inst = False
            if "approval_instance_id" in ot._fields and ot.approval_instance_id:
                app_inst = ot.approval_instance_id
            elif ApprovalInstance is not None:
                app_inst = ApprovalInstance.sudo().search([
                    ("res_model", "=", "cleon.overtime.request"),
                    ("res_id", "=", ot.id),
                ], limit=1, order="id desc")

            decision_src = app_inst.decision_source if (app_inst and app_inst.decision_source) else "human"

            final_step = False
            if app_inst and StepModel is not None:
                steps = StepModel.sudo().search([("instance_id", "=", app_inst.id)])
                if steps:
                    decided = steps.filtered(lambda s: s.state in ("approved", "rejected") or s.decision_user_id)
                    if decided:
                        final_step = decided.sorted(lambda s: (s.sequence, s.id), reverse=True)[0]

            final_approver_name = "System Automation Engine"
            if final_step and final_step.decision_user_id:
                final_approver_name = final_step.decision_user_id.sudo().name
            elif ot.approver_id:
                final_approver_name = ot.approver_id.sudo().name

            decision_time = False
            if final_step and final_step.decision_at:
                decision_time = fields.Datetime.to_string(final_step.decision_at)
            elif app_inst and app_inst.write_date:
                decision_time = fields.Datetime.to_string(app_inst.write_date)
            elif ot.decision_at:
                decision_time = fields.Datetime.to_string(ot.decision_at)
            else:
                decision_time = fields.Datetime.to_string(ot.create_date)

            approval_ref = app_inst.name if hasattr(app_inst, "name") and app_inst.name else (f"APP-INST-{app_inst.id}" if app_inst else f"OT-APPROVAL-{ot.id}")

            items.append({
                "id": ot.id,
                "employee_id": emp.id,
                "employee_name": emp.name,
                "employee_code": code,
                "missing_code": has_missing_code,
                "readiness_error": _("Missing payroll employee code") if has_missing_code else False,
                "date": fields.Date.to_string(ot.date),
                "overtime_hours": ot.overtime_hours,
                "regular_hours": ot.regular_hours,
                "overtime_type": getattr(ot, "category", "daily"),
                "payroll_state": ot.payroll_state,
                "approval_instance_id": app_inst.id if app_inst else False,
                "approval_reference": approval_ref,
                "final_decision_at": decision_time,
                "decision_source": decision_src,
                "final_approver": final_approver_name,
            })

        period_lock_records = []
        if "cleon.time.period.lock" in self.env:
            lock_domain = [("company_id", "=", company.id), ("state", "=", "locked")]
            if date_from:
                lock_domain.append(("date_to", ">=", date_from))
            if date_to:
                lock_domain.append(("date_from", "<=", date_to))
            period_lock_records = self.env["cleon.time.period.lock"].search(lock_domain)

        is_period_locked = len(period_lock_records) > 0
        locked_lock_name = period_lock_records[0].name if period_lock_records else False

        if is_period_locked and not preview_mode:
            raise UserError(_("Selected handoff date range overlaps with locked period '%s'. Final payroll export is blocked.") % locked_lock_name)

        return {
            "company_id": company.id,
            "company_name": company.name,
            "payroll_integration": bool(policy and policy.payroll_integration),
            "preview_mode": preview_mode,
            "state_filter": target_state_filter,
            "date_from": date_from,
            "date_to": date_to,
            "total_records": len(items),
            "total_overtime_hours": sum(i["overtime_hours"] for i in items),
            "unresolved_employee_codes_count": unresolved_codes_count,
            "period_locked": is_period_locked,
            "period_locked_count": len(period_lock_records),
            "period_lock_name": locked_lock_name,
            "records": items,
        }

    @api.model
    def get_cleon_access(self):
        role = self._tm_role()
        capabilities = self._tm_capabilities()
        can_config = self._tm_can_configure()
        is_manager = role in ("system_admin", "hr_admin", "hr_manager", "line_manager")
        policy = self.sudo().search([("company_id", "=", self.env.company.id)], limit=1)
        portal_enabled = not policy or bool(policy.employee_portal)
        has_employee = bool(self.env.user.employee_id)
        feature_access = self._tm_feature_access(policy)
        return {
            "role": role,
            "can_configure": can_config,
            "is_manager": is_manager,
            "has_employee": has_employee,
            "portal_enabled": portal_enabled,
            "can_switch_interface": bool(
                is_manager and has_employee and portal_enabled
                and (not policy or policy.interface_switching_enabled)
            ),
            "portalModules": {
                "leave": bool(capabilities.get("leave") and (not policy or policy.leave_integration)),
                "time": any(feature_access.values()),
            },
            "capabilities": capabilities,
            "featureAccess": dict(feature_access, settings=can_config),
        }
