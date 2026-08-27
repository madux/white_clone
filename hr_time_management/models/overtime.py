from datetime import date, datetime, time, timedelta
import logging

import pytz

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


_logger = logging.getLogger(__name__)


class CleonOvertimeRequest(models.Model):
    _name = "cleon.overtime.request"
    _description = "CleonHR Overtime Request"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "date desc, id desc"

    name = fields.Char(default=lambda self: _("New"), readonly=True, copy=False)
    employee_id = fields.Many2one("hr.employee", required=True, index=True, tracking=True)
    company_id = fields.Many2one(related="employee_id.company_id", store=True, index=True)
    date = fields.Date(required=True, index=True, tracking=True)
    start_time = fields.Datetime(tracking=True)
    end_time = fields.Datetime(tracking=True)
    regular_hours = fields.Float(readonly=True)
    overtime_hours = fields.Float(required=True, tracking=True)
    category = fields.Selection([
        ("daily", "Daily Overtime"), ("weekly", "Weekly Overtime"),
        ("weekend", "Weekend Overtime"), ("holiday", "Holiday Overtime"),
        ("special", "Special Assignment"), ("on_call", "On-call Work"),
    ], required=True, default="daily", index=True, tracking=True)
    source = fields.Selection([
        ("attendance", "Auto Attendance"), ("employee", "Employee Request"),
        ("manager", "Manager Entry"),
    ], required=True, default="employee", index=True)
    state = fields.Selection([
        ("auto", "Auto-calculated"), ("submitted", "Pending Approval"),
        ("approved", "Approved"), ("rejected", "Rejected"),
        ("withdrawn", "Withdrawn"),
    ], required=True, default="submitted", index=True, tracking=True)
    justification = fields.Text()
    attachment = fields.Binary(attachment=True)
    attachment_name = fields.Char()
    attendance_id = fields.Many2one("hr.attendance", ondelete="set null", index=True)
    multiplier = fields.Float(default=1.5, readonly=True)
    estimated_cost = fields.Monetary(compute="_compute_estimated_cost", store=True)
    currency_id = fields.Many2one(related="company_id.currency_id", store=True)
    approver_id = fields.Many2one("res.users", readonly=True)
    decision_at = fields.Datetime(readonly=True)
    manager_comment = fields.Text(readonly=True)
    payroll_state = fields.Selection([
        ("not_ready", "Not Ready"),
        ("ready", "Ready for Payroll"),
        ("transferred", "Transferred to Payroll"),
    ], default="not_ready", required=True, readonly=True, index=True)

    _sql_constraints = [
        ("attendance_unique", "unique(attendance_id)", "Overtime was already generated for this attendance record."),
        ("positive_hours", "check(overtime_hours > 0 AND overtime_hours <= 24)", "Overtime must be greater than zero and no more than 24 hours."),
    ]

    def _approval_fallback_config(self):
        self.ensure_one()
        c_id = self._approval_company().id
        policy = self.env["cleon.time.policy"].sudo().search([("company_id", "=", c_id)], limit=1)
        require_approval = policy.overtime_require_approval if policy else True
        fallback_type = policy.overtime_fallback_approver if policy else "manager"

        fallback_users = self.env["res.users"]
        employee = self._approval_employee()
        if fallback_type in ("direct_manager", "manager"):
            parent_user = employee.sudo().parent_id.sudo().user_id
            if parent_user and parent_user.active:
                fallback_users = parent_user
        elif fallback_type in ("department_head", "dept"):
            dept_user = employee.sudo().department_id.sudo().manager_id.sudo().user_id
            if dept_user and dept_user.active:
                fallback_users = dept_user

        if not fallback_users:
            group = self.env.ref("hr_time_management.group_time_management_hr_manager", raise_if_not_found=False)
            if group:
                fallback_users = group.users.filtered(lambda u: u.active and c_id in u.sudo().company_ids.ids)

        return {
            "require_approval": require_approval,
            "fallback_users": fallback_users,
        }

    @api.depends("overtime_hours", "multiplier", "employee_id")
    def _compute_estimated_cost(self):
        for request in self:
            hourly_cost = getattr(request.employee_id, "hourly_cost", 0.0) or 0.0
            request.estimated_cost = request.overtime_hours * request.multiplier * hourly_cost

    @api.model_create_multi
    def create(self, vals_list):
        for values in vals_list:
            if not values.get("name") or values["name"] == _("New"):
                values["name"] = "OT/%s" % fields.Datetime.now().strftime("%Y%m%d%H%M%S%f")
        return super().create(vals_list)

    def _audit(self, action, details, source="web"):
        for request in self:
            self.env["cleon.time.audit.log"].sudo().create({
                "employee_id": request.employee_id.id, "action": action,
                "module_area": "overtime", "entity_type": "overtime_request",
                "entity_name": request.name, "entity_id": request.id,
                "details": details, "status": "success", "source": source,
                "company_id": request.company_id.id,
            })

    @api.model
    def _manager_allowed(self):
        Policy = self.env["cleon.time.policy"]
        role = Policy._tm_role()
        return role in ("line_manager", "hr_manager", "hr_admin", "system_admin")

    SERVER_CONTROLLED_FIELDS = {
        "category", "multiplier", "source", "attendance_id",
        "regular_hours", "overtime_hours", "approver_id", "decision_at", "manager_comment", "payroll_state"
    }

    @api.model
    def _sudo_create_service(self, vals_list):
        """Private server helper executing authoritative backend creation via sudo()."""
        return super(CleonOvertimeRequest, self.sudo()).create(vals_list)

    def _sudo_write_service(self, vals):
        """Private server helper executing authoritative backend write via sudo()."""
        return super(CleonOvertimeRequest, self.sudo()).write(vals)

    def _sudo_unlink_service(self):
        """Private server helper executing authoritative backend unlink via sudo()."""
        return super(CleonOvertimeRequest, self.sudo()).unlink()

    @api.model
    def _derive_overtime_category_and_multiplier(self, employee, target_date, is_weekly=False):
        """Server-side authority deriving overtime category and multiplier from company policy and calendar boundaries."""
        policy = self.env["cleon.time.policy"].sudo().search([("company_id", "=", employee.company_id.id)], limit=1)
        if not policy or not policy.enable_overtime:
            raise ValidationError(_("Overtime is disabled for your company under current policy."))

        if is_weekly:
            if not policy.weekly_overtime_enabled:
                raise ValidationError(_("Weekly overtime is disabled by company policy."))
            return "weekly", policy.weekly_overtime_rate or 1.5

        calendar = employee.resource_calendar_id
        target_date_obj = fields.Date.to_date(target_date)
        day_start = datetime.combine(target_date_obj, time.min)
        day_end = datetime.combine(target_date_obj, time.max)

        # 1. Public Holiday Check
        is_holiday = bool(calendar and calendar.global_leave_ids.filtered(
            lambda leave: leave.date_from < day_end and leave.date_to > day_start
        ))
        if is_holiday:
            if not policy.holiday_overtime:
                raise ValidationError(_("Holiday overtime is disabled by company policy."))
            return "holiday", policy.holiday_overtime_rate or 2.5

        # 2. Weekend / Scheduled Rest Day Check
        Shift = self.env["cleon.hr.shift"]
        exp = Shift._get_expected_working_hours_internal(employee.id, target_date_obj)
        weekend_days = [int(d.strip()) for d in (policy.weekend_days or "5,6").split(",") if d.strip().isdigit()]
        is_rest_day = (exp.get("is_rest_day") if exp else False) or (target_date_obj.weekday() in weekend_days)

        if is_rest_day:
            if not policy.weekend_overtime:
                raise ValidationError(_("Weekend and rest-day overtime is disabled by company policy."))
            return "weekend", policy.weekend_overtime_rate or 2.0

        # 3. Daily Overtime Check
        if not policy.daily_overtime_enabled:
            raise ValidationError(_("Daily overtime is disabled by company policy."))
        return "daily", policy.daily_overtime_rate or 1.5

    @api.model
    def _sync_attendance_overtime(self):
        """Materialize calculated daily and weekly overtime by aggregating attendance intervals per (employee_id, work_date)."""
        if not self._manager_allowed():
            return
        Policy = self.env["cleon.time.policy"]
        if not Policy._tm_feature_access().get("overtime"):
            return
        allowed_emp_ids = Policy._tm_scope_employee_ids()
        cutoff_dt = fields.Datetime.now() - timedelta(days=366)
        cutoff_date = fields.Date.today() - timedelta(days=366)

        # 1. Fetch completed attendances within sync window
        attendances = self.env["hr.attendance"].sudo().search([
            ("employee_id.company_id", "=", self.env.company.id),
            ("employee_id", "in", allowed_emp_ids),
            ("check_out", "!=", False), ("check_in", ">=", cutoff_dt),
        ])

        # 2. Group attendances by (employee_id, work_date)
        Attendance = self.env["hr.attendance"]
        emp_work_dates = {}
        for att in attendances:
            w_date = Attendance._work_date_for_punch(att.employee_id, att.check_in)
            key = (att.employee_id, w_date)
            emp_work_dates.setdefault(key, []).append(att)

        processed_auto_keys = set()
        emp_weekly_regular_hours = {}  # (employee, (iso_year, iso_week)) -> list of (work_date, regular_hours, total_net_hours, att_list)

        for (employee, w_date), att_list in emp_work_dates.items():
            company_id = employee.company_id.id
            policy = self.env["cleon.time.policy"].sudo().search([("company_id", "=", company_id)], limit=1)

            is_eligible = bool(
                policy and policy.enable_overtime and policy.overtime_request_mode != "manual"
            )

            # Check period lock before any auto mutation on this date
            is_locked = False
            try:
                self.env["cleon.time.period.lock"].check_period_lock(company_id, w_date, _("Overtime Auto Sync"))
            except AccessError:
                is_locked = True

            existing_auto_daily = self.sudo().search([
                ("employee_id", "=", employee.id),
                ("date", "=", w_date),
                ("category", "!=", "weekly"),
                ("source", "=", "attendance"),
            ], limit=1)

            if not is_eligible or is_locked:
                if not is_eligible and not is_locked and existing_auto_daily and existing_auto_daily.state == "auto":
                    existing_auto_daily._sudo_unlink_service()
                continue

            # Merge overlapping punches before calculating hours. Summing raw rows can
            # exceed 24 hours when a stale/open punch overlaps a corrected record.
            intervals = []
            for attendance in att_list:
                if not attendance.check_in or not attendance.check_out or attendance.check_out <= attendance.check_in:
                    _logger.warning("Skipping invalid attendance interval %s during overtime sync", attendance.id)
                    continue
                duration = (attendance.check_out - attendance.check_in).total_seconds() / 3600.0
                if duration > 24.0:
                    _logger.warning("Skipping attendance %s with %.2f-hour interval during overtime sync", attendance.id, duration)
                    continue
                intervals.append((attendance.check_in, attendance.check_out, attendance))

            intervals.sort(key=lambda interval: interval[0])
            merged = []
            for start, end, attendance in intervals:
                if merged and start <= merged[-1][1]:
                    merged[-1] = (merged[-1][0], max(merged[-1][1], end), merged[-1][2])
                else:
                    merged.append((start, end, attendance))
            gross_hours = sum((end - start).total_seconds() / 3600.0 for start, end, _attendance in merged)
            if not merged or gross_hours <= 0.0 or gross_hours > 24.0:
                _logger.warning(
                    "Skipping overtime derivation for employee %s on %s: invalid merged duration %.2f",
                    employee.id, w_date, gross_hours,
                )
                if existing_auto_daily and existing_auto_daily.state == "auto":
                    existing_auto_daily._sudo_unlink_service()
                continue

            if policy and policy.enable_break_period and gross_hours >= (policy.half_day_hours or 4.0):
                break_hours = (policy.default_break_minutes or 60) / 60.0
                total_net_hours = max(0.0, gross_hours - break_hours)
            else:
                total_net_hours = gross_hours

            earliest_in = merged[0][0]
            latest_out = merged[-1][1]
            valid_att_list = [interval[2] for interval in intervals]

            # Check calendar & shift boundaries
            calendar = employee.resource_calendar_id
            day_start = datetime.combine(w_date, time.min)
            day_end = datetime.combine(w_date, time.max)
            is_holiday = bool(calendar and calendar.global_leave_ids.filtered(
                lambda leave: leave.date_from < day_end and leave.date_to > day_start
            ))
            Shift = self.env["cleon.hr.shift"]
            exp = Shift._get_expected_working_hours_internal(employee.id, w_date)
            weekend_days = [int(d.strip()) for d in (policy.weekend_days or "5,6").split(",") if d.strip().isdigit()]
            is_rest_day = (exp.get("is_rest_day") if exp else False) or (w_date.weekday() in weekend_days)

            if is_holiday:
                category = "holiday"
                multiplier = policy.holiday_overtime_rate or 2.5
                daily_ot_hours = total_net_hours if policy.holiday_overtime else 0.0
                regular_hours = 0.0
            elif is_rest_day:
                category = "weekend"
                multiplier = policy.weekend_overtime_rate or 2.0
                daily_ot_hours = total_net_hours if policy.weekend_overtime else 0.0
                regular_hours = 0.0
            else:
                category = "daily"
                multiplier = policy.daily_overtime_rate or 1.5
                if policy.daily_overtime_enabled:
                    daily_threshold = policy.daily_overtime_threshold or 8.0
                    daily_ot_hours = max(0.0, total_net_hours - daily_threshold)
                    regular_hours = max(0.0, total_net_hours - daily_ot_hours)
                else:
                    daily_ot_hours = 0.0
                    regular_hours = total_net_hours

            daily_ot_hours = round(min(24.0, max(0.0, daily_ot_hours)), 4)
            regular_hours = round(min(24.0, max(0.0, regular_hours)), 4)

            if existing_auto_daily:
                if existing_auto_daily.state == "auto":
                    if daily_ot_hours > 0:
                        existing_auto_daily._sudo_write_service({
                            "overtime_hours": daily_ot_hours,
                            "regular_hours": regular_hours,
                            "category": category,
                            "multiplier": multiplier,
                            "start_time": earliest_in,
                            "end_time": latest_out,
                        })
                        processed_auto_keys.add((employee, w_date, category))
                    else:
                        existing_auto_daily._sudo_unlink_service()
            elif daily_ot_hours > 0:
                request = self._sudo_create_service([{
                    "employee_id": employee.id, "date": w_date,
                    "start_time": earliest_in, "end_time": latest_out,
                    "regular_hours": regular_hours,
                    "overtime_hours": daily_ot_hours, "category": category,
                    "source": "attendance", "state": "auto", "attendance_id": valid_att_list[0].id,
                    "multiplier": multiplier,
                    "justification": _("Automatically calculated from attendance."),
                }])
                request._audit("created", _("Overtime automatically calculated from attendance."), "system")
                processed_auto_keys.add((employee, w_date, category))

            # Store for weekly overtime threshold calculation
            iso_year, iso_week, day_idx = w_date.isocalendar()
            emp_weekly_regular_hours.setdefault((employee, (iso_year, iso_week)), []).append(
                (w_date, regular_hours, total_net_hours, valid_att_list)
            )

        # 3. Weekly Overtime Engine (component-aware, frozen weekly record accounting, no double counting)
        for (employee, (iso_year, iso_week)), day_records in emp_weekly_regular_hours.items():
            company_id = employee.company_id.id
            policy = self.env["cleon.time.policy"].sudo().search([("company_id", "=", company_id)], limit=1)
            if not policy or not policy.enable_overtime or not policy.weekly_overtime_enabled or policy.overtime_request_mode == "manual":
                continue

            # Authoritative ISO week boundary: Monday (1) through Sunday (7)
            week_start_date = date.fromisocalendar(iso_year, iso_week, 1)
            week_end_date = date.fromisocalendar(iso_year, iso_week, 7)
            existing_weekly_recs = self.sudo().search([
                ("employee_id", "=", employee.id),
                ("category", "=", "weekly"),
                ("date", ">=", week_start_date),
                ("date", "<=", week_end_date),
            ])

            # Intentional Business Logic: Non-auto weekly records (submitted, approved, rejected, withdrawn)
            # are treated as frozen to suppress duplicate regeneration of decided/withdrawn weekly entitlements.
            frozen_weekly_hours = sum(r.overtime_hours for r in existing_weekly_recs if r.state != "auto")

            weekly_threshold = policy.weekly_overtime_threshold or 40.0
            total_week_regular = sum(rec[1] for rec in day_records)
            total_weekly_entitlement = max(0.0, total_week_regular - weekly_threshold)

            weekly_ot_needed = max(0.0, total_weekly_entitlement - frozen_weekly_hours)

            if weekly_ot_needed > 0:
                weekly_rate = policy.weekly_overtime_rate or 1.5
                sorted_days = sorted(day_records, key=lambda x: x[0], reverse=True)

                for w_date, reg_h, net_h, att_list in sorted_days:
                    if weekly_ot_needed <= 0:
                        break
                    if reg_h <= 0:
                        continue

                    # Skip day if it has a frozen non-auto weekly record
                    if any(r.date == w_date and r.state != "auto" for r in existing_weekly_recs):
                        continue

                    # Check period lock before mutating for weekly OT
                    try:
                        self.env["cleon.time.period.lock"].check_period_lock(company_id, w_date, _("Weekly Overtime Sync"))
                    except AccessError:
                        continue

                    # PostgreSQL enforces a strict (0, 24] range.  Keep the
                    # derived weekly component inside that range as well as
                    # protecting against floating-point dust around zero.
                    ot_to_materialize = round(
                        min(24.0, max(0.0, weekly_ot_needed), max(0.0, reg_h)),
                        4,
                    )
                    if ot_to_materialize <= 0:
                        continue
                    existing_auto_weekly = existing_weekly_recs.filtered(lambda r: r.date == w_date and r.state == "auto")

                    earliest_in = min(a.check_in for a in att_list)
                    latest_out = max(a.check_out for a in att_list)

                    if existing_auto_weekly:
                        existing_auto_weekly[0]._sudo_write_service({
                            "overtime_hours": ot_to_materialize,
                            "multiplier": weekly_rate,
                        })
                        weekly_ot_needed -= ot_to_materialize
                        processed_auto_keys.add((employee, w_date, "weekly"))
                    else:
                        req = self._sudo_create_service([{
                            "employee_id": employee.id, "date": w_date,
                            "start_time": earliest_in, "end_time": latest_out,
                            "regular_hours": max(0.0, reg_h - ot_to_materialize),
                            "overtime_hours": ot_to_materialize, "category": "weekly",
                            "source": "attendance", "state": "auto", "attendance_id": False,
                            "multiplier": weekly_rate,
                            "justification": _("Automatically calculated weekly overtime."),
                        }])
                        req._audit("created", _("Weekly overtime automatically calculated from attendance."), "system")
                        weekly_ot_needed -= ot_to_materialize
                        processed_auto_keys.add((employee, w_date, "weekly"))

        # 4. Reconcile stale auto records SCOPED STRICTLY to allowed_emp_ids, sync horizon, and component keys
        stale_auto_records = self.sudo().search([
            ("source", "=", "attendance"),
            ("state", "=", "auto"),
            ("company_id", "=", self.env.company.id),
            ("employee_id", "in", allowed_emp_ids),
            ("date", ">=", cutoff_date),
        ])
        for record in stale_auto_records:
            comp_key = (record.employee_id, record.date, record.category)
            if comp_key not in processed_auto_keys:
                try:
                    self.env["cleon.time.period.lock"].check_period_lock(record.company_id.id, record.date, _("Overtime Reconcile"))
                    record._sudo_unlink_service()
                except AccessError:
                    pass

    def _approval_workflow_code(self):
        return "time_overtime"

    def _approval_employee(self):
        self.ensure_one()
        return self.employee_id

    def _approval_company(self):
        self.ensure_one()
        return self.company_id or self.employee_id.company_id or self.env.company

    def _approval_period(self):
        self.ensure_one()
        return self.date, self.date

    def _approval_validate_decision(self, decision, automated=False, comment=False):
        self.ensure_one()
        c_id = self._approval_company()
        self.env["cleon.time.period.lock"].check_period_lock(c_id, self.date, _("Overtime Request Decision"), override_reason=comment, allow_override=not automated)
        if decision == "reject" and not (comment or "").strip():
            raise ValidationError(_("A manager comment is required when rejecting overtime."))
        return True

    def _approval_finalize_approve(self):
        policy = self.env["cleon.time.policy"].sudo().get_runtime_policy()
        notify = policy.get("overtime_notify_employee", True)
        for req in self:
            user = self.env.user
            req._sudo_write_service({
                "state": "approved",
                "payroll_state": "ready",
                "approver_id": user.id,
                "decision_at": fields.Datetime.now(),
            })
            req._audit("approved", _("Overtime request approved."))
            if notify and req.employee_id.sudo().user_id:
                req.message_post(
                    body=_("Your overtime request for %s (%.2f hrs) has been approved.") % (req.date, req.overtime_hours),
                    partner_ids=req.employee_id.sudo().user_id.partner_id.ids,
                )

    def _approval_finalize_reject(self, comment):
        policy = self.env["cleon.time.policy"].sudo().get_cleon_policy()
        notify = policy.get("overtime_notify_employee", True)
        for req in self:
            user = self.env.user
            req._sudo_write_service({
                "state": "rejected",
                "payroll_state": "not_ready",
                "approver_id": user.id,
                "decision_at": fields.Datetime.now(),
                "manager_comment": comment,
            })
            req._audit("rejected", comment or _("Overtime request rejected."))
            if notify and req.employee_id.sudo().user_id:
                req.message_post(
                    body=_("Your overtime request for %s has been rejected. Reason: %s") % (req.date, comment or _("No comment provided.")),
                    partner_ids=req.employee_id.sudo().user_id.partner_id.ids,
                )

    @api.model
    def submit_manual_request(self, values):
        employee = self.env.user.employee_id
        if not employee:
            raise ValidationError(_("Your user is not linked to an employee record."))
        policy = self.env["cleon.time.policy"].sudo().search([("company_id", "=", employee.company_id.id)], limit=1)
        if not policy or not policy.enable_overtime:
            raise ValidationError(_("Overtime is disabled for your company under current policy."))
        if policy.overtime_request_mode == "automatic":
            raise ValidationError(_("Manual overtime requests are disabled by company policy."))

        target_date = fields.Date.to_date(values.get("date"))
        if not target_date:
            raise ValidationError(_("Select an overtime date."))
        today = fields.Date.context_today(self)
        if target_date > today or target_date < today - timedelta(days=14):
            raise ValidationError(_("Overtime requests must be for one of the past 14 days."))
        justification = (values.get("justification") or "").strip()
        if len(justification) < 30 or len(justification) > 500:
            raise ValidationError(_("Justification must contain between 30 and 500 characters."))
        start_val = values.get("start_time")
        if isinstance(start_val, str):
            start_val = start_val.replace("T", " ").strip()
            if len(start_val) == 16:
                start_val += ":00"
        start = fields.Datetime.to_datetime(start_val)

        end_val = values.get("end_time")
        if isinstance(end_val, str):
            end_val = end_val.replace("T", " ").strip()
            if len(end_val) == 16:
                end_val += ":00"
        end = fields.Datetime.to_datetime(end_val)
        if not start or not end or end <= start:
            raise ValidationError(_("End time must be after start time."))
        hours = (end - start).total_seconds() / 3600

        duplicate = self.search_count([
            ("employee_id", "=", employee.id), ("date", "=", target_date),
            ("start_time", "<", end), ("end_time", ">", start),
            ("state", "not in", ("rejected", "withdrawn")),
        ])
        if duplicate:
            raise ValidationError(_("An overtime request already covers this date and time period."))

        # Server-derive category and multiplier
        category, multiplier = self._derive_overtime_category_and_multiplier(employee, target_date)

        request = self._sudo_create_service([{
            "employee_id": employee.id, "date": target_date, "start_time": start, "end_time": end,
            "overtime_hours": hours, "category": category, "source": "employee",
            "state": "submitted", "justification": justification, "multiplier": multiplier,
        }])
        request._audit("submitted", _("Manual overtime request submitted."))

        # Business Rule Auto-Approve check (Overtime Max Auto-Approve Hours)
        if policy and policy.overtime_auto_approve_max_hours and hours <= policy.overtime_auto_approve_max_hours:
            reason_msg = _("Auto-approved by policy business rule: overtime hours %.2f <= max %.2f.") % (hours, policy.overtime_auto_approve_max_hours)
            self.env["cleon.approval.instance"].action_start(request, decision_source="business_rule", auto_approve_reason=reason_msg)
            return {"id": request.id, "name": request.name}

        instance = self.env["cleon.approval.instance"].action_start(request)
        return {"id": request.id, "name": request.name}

    def action_withdraw(self):
        """Allow an employee to withdraw their pending or auto-calculated overtime request."""
        for request in self:
            if not self.env.su and request.employee_id.user_id != self.env.user:
                raise AccessError(_("You can only withdraw your own overtime request."))
            if request.state not in ("submitted", "auto"):
                raise ValidationError(_("Only pending or auto-calculated overtime requests can be withdrawn."))
            self.env["cleon.time.period.lock"].check_period_lock(request.company_id.id, request.date, _("Overtime Withdrawal"))
            self.env["cleon.approval.instance"].action_cancel_for_target(request, reason=_("Withdrawn by employee."))
            request._sudo_write_service({"state": "withdrawn"})
            request._audit("withdrawn", _("Overtime request withdrawn by employee."))
        return True

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            self._check_workflow_protection(vals, is_create=True)
            if vals.get("date"):
                emp = self.env["hr.employee"].browse(vals.get("employee_id")).exists()
                c_id = vals.get("company_id") or (emp.company_id.id if emp else self.env.company.id)
                self.env["cleon.time.period.lock"].check_period_lock(c_id, vals["date"], _("Overtime Request"))
        return super().create(vals_list)

    def write(self, vals):
        self._check_workflow_protection(vals, is_create=False)
        if not self.env.su and not self.env.user.has_group("base.group_system"):
            for req in self:
                c_id = req.company_id.id
                target_date = vals.get("date") or req.date
                if target_date:
                    self.env["cleon.time.period.lock"].check_period_lock(c_id, target_date, _("Overtime Request"), vals.get("manager_comment"))
        return super().write(vals)

    def unlink(self):
        if not self.env.su and not self.env.user.has_group("base.group_system"):
            for req in self:
                if req.date:
                    self.env["cleon.time.period.lock"].check_period_lock(req.company_id.id, req.date, _("Overtime Request"))
        return super().unlink()

    def _check_workflow_protection(self, vals, is_create=False):
        if self.env.su or self.env.user.has_group("base.group_system"):
            return
        if is_create:
            supplied_server_fields = self.SERVER_CONTROLLED_FIELDS.intersection(vals.keys())
            if supplied_server_fields:
                raise AccessError(_("Server-controlled overtime fields (%s) cannot be supplied directly. Use submit_manual_request().") % ", ".join(supplied_server_fields))
            if "state" in vals and vals.get("state") != "draft":
                raise AccessError(_("Direct creation of non-draft overtime requests is prohibited. Use submit_manual_request()."))
        else:
            if "state" in vals:
                raise AccessError(_("Direct overtime state mutation is prohibited. Use approval/action methods instead."))
            if self.SERVER_CONTROLLED_FIELDS.intersection(vals.keys()):
                raise AccessError(_("Direct mutation of decision or server-controlled fields is prohibited."))

    def action_decide(self, decision, comment=False):
        for request in self:
            instance = self.env["cleon.approval.instance"].sudo().search([
                ("res_model", "=", request._name),
                ("res_id", "=", request.id),
                ("state", "=", "pending"),
            ], limit=1)
            if instance:
                instance.with_user(self.env.user).action_decide(decision, comment=comment)
            else:
                Policy = self.env["cleon.time.policy"]
                if not Policy._tm_can_approve(request, self.env.user):
                    raise AccessError(_("You are not authorized to review this overtime request (self-approval is not permitted for Line Managers)."))
                if request.state not in ("auto", "submitted"):
                    raise ValidationError(_("Only pending or auto-calculated overtime can be reviewed."))
                request._approval_validate_decision(decision, comment=comment)
                if decision == "approve":
                    request._approval_finalize_approve()
                elif decision == "reject":
                    request._approval_finalize_reject(comment)
        return True

    def _notify_employee_decision(self, decision, comment=False):
        """Notify through Odoo mail without assuming an external mail gateway."""
        for request in self:
            partner = request.employee_id.user_id.partner_id
            if not partner:
                continue
            outcome = _("approved") if decision == "approve" else _("rejected")
            body = _("Your overtime request %(reference)s for %(hours)s hour(s) was %(outcome)s.") % {
                "reference": request.name,
                "hours": round(request.overtime_hours, 2),
                "outcome": outcome,
            }
            if comment:
                body += "<br/>" + _("Manager comment: %s") % comment
            request.message_post(body=body, partner_ids=partner.ids, subtype_xmlid="mail.mt_note")

    def get_payroll_ready_values(self):
        """Stable handoff contract for a future CleonHR payroll connector."""
        self.ensure_one()
        if self.state != "approved" or self.payroll_state not in ("ready", "transferred"):
            raise ValidationError(_("Only approved overtime is eligible for payroll transfer."))
        return {
            "reference": self.name,
            "employee_id": self.employee_id.id,
            "company_id": self.company_id.id,
            "date": fields.Date.to_string(self.date),
            "hours": self.overtime_hours,
            "category": self.category,
            "multiplier": self.multiplier,
            "estimated_cost": self.estimated_cost,
            "currency_id": self.currency_id.id,
        }

    def mark_payroll_transferred(self):
        if not self._manager_allowed():
            raise AccessError(_("Only a Time Management manager can confirm payroll transfer."))
        for request in self:
            request.get_payroll_ready_values()
            self.env["cleon.time.period.lock"].check_period_lock(request.company_id.id, request.date, _("Overtime Payroll Transfer"))
            request.sudo().write({"payroll_state": "transferred"})
            request._audit("modified", _("Approved overtime marked as transferred to payroll."), "system")
        return True

    @api.model
    def manager_decide(self, request_id, decision, comment=False):
        self.browse(int(request_id)).exists().action_decide(decision, comment)
        return True

    @api.model
    def get_my_overtime(self):
        employee = self.env.user.employee_id
        if not employee:
            return {"rows": [], "kpis": {"total": 0, "approved": 0, "pending": 0}}
        requests = self.search([("employee_id", "=", employee.id)])
        today = fields.Date.context_today(self)
        month_start = today.replace(day=1)
        month = requests.filtered(lambda request: request.date and request.date >= month_start)
        rows = [{
            "id": request.id, "name": request.name,
            "date": fields.Date.to_string(request.date),
            "start_time": fields.Datetime.to_string(request.start_time) if request.start_time else False,
            "end_time": fields.Datetime.to_string(request.end_time) if request.end_time else False,
            "hours": round(request.overtime_hours, 2), "category": request.category,
            "state": request.state, "reason": request.justification or "",
            "cost": round(request.estimated_cost, 2),
            "approver": request.approver_id.name or "",
            "decision_at": fields.Datetime.to_string(request.decision_at) if request.decision_at else False,
            "manager_comment": request.manager_comment or "",
            "payroll_state": request.payroll_state,
        } for request in requests]
        return {"rows": rows, "kpis": {
            "total": round(sum(month.mapped("overtime_hours")), 2),
            "approved": round(sum(month.filtered(lambda request: request.state == "approved").mapped("overtime_hours")), 2),
            "pending": len(month.filtered(lambda request: request.state in ("auto", "submitted"))),
        }}

    @api.model
    def withdraw_request(self, request_id):
        request = self.browse(int(request_id)).exists()
        return request.action_withdraw()

    @api.model
    def get_overtime_data(self, page="dashboard", state="all", search=""):
        if not self._manager_allowed():
            raise AccessError(_("Only a Time Management manager can view team overtime."))
        self._sync_attendance_overtime()
        Policy = self.env["cleon.time.policy"]
        allowed_emp_ids = Policy._tm_scope_employee_ids()
        today = fields.Date.context_today(self)
        month_start = today.replace(day=1)
        domain = [("company_id", "=", self.env.company.id), ("employee_id", "in", allowed_emp_ids)]
        if state and state != "all":
            domain.append(("state", "=", state))
        if search:
            domain += ["|", ("employee_id.name", "ilike", search), ("justification", "ilike", search)]
        requests = self.search(domain)
        month = requests.filtered(lambda row: row.date and row.date >= month_start)
        approved = month.filtered(lambda row: row.state == "approved")
        pending = month.filtered(lambda row: row.state in ("auto", "submitted"))
        employees = month.mapped("employee_id")
        rows = [{
            "id": row.id, "name": row.name, "employee": row.employee_id.sudo().name,
            "employee_code": row.employee_id.sudo().employee_number or "",
            "department": row.employee_id.sudo().department_id.name or _("Unassigned"),
            "date": fields.Date.to_string(row.date), "regular_hours": round(row.regular_hours, 2),
            "hours": round(row.overtime_hours, 2), "category": row.category,
            "source": row.source, "state": row.state, "reason": row.justification or "",
            "multiplier": row.multiplier, "cost": round(row.estimated_cost, 2),
            "payroll_state": row.payroll_state,
            "approver": row.approver_id.name or "", "decision_at": fields.Datetime.to_string(row.decision_at) if row.decision_at else False,
        } for row in requests.sorted(lambda row: (row.date, row.id), reverse=True)]
        daily = sum(month.filtered(lambda row: row.category == "daily").mapped("overtime_hours"))
        weekend = sum(month.filtered(lambda row: row.category == "weekend").mapped("overtime_hours"))
        holiday = sum(month.filtered(lambda row: row.category == "holiday").mapped("overtime_hours"))
        return {
            "rows": rows,
            "kpis": {
                "total": round(sum(month.mapped("overtime_hours")), 2),
                "daily": round(daily, 2), "weekend": round(weekend, 2), "holiday": round(holiday, 2),
                "pending": len(pending), "employees": len(employees),
                "cost": round(sum(approved.mapped("estimated_cost")), 2),
                "approved": round(sum(approved.mapped("overtime_hours")), 2),
                "average": round(sum(month.mapped("overtime_hours")) / len(employees), 2) if employees else 0,
            },
        }
