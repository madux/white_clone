import calendar
from datetime import datetime, time, timedelta

import pytz

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError


class HrAttendance(models.Model):
    _inherit = "hr.attendance"

    cleon_shift_id = fields.Many2one("cleon.hr.shift", string="Shift")
    cleon_break_minutes = fields.Integer(string="Break Duration", default=0)
    cleon_status_override = fields.Selection([
        ("present", "Present"), ("late", "Late"),
        ("absent", "Absent"), ("on_leave", "On Leave"),
    ], string="Status Override")
    cleon_edit_reason = fields.Text(string="Last Edit Reason", readonly=True)

    @api.model
    def get_cleon_access(self):
        is_manager = self.env.user.has_group("base.group_system")
        return {
            "is_manager": is_manager,
            "has_employee": bool(self.env.user.employee_id),
            # Client contract for introducing dedicated feature groups later.
            "features": {key: True for key in ("attendance", "shift", "tracking", "overtime")},
        }

    @api.model
    def get_cleon_employee_data(self, date_from=False, date_to=False):
        employee = self.env.user.employee_id
        if not employee:
            raise UserError(_("Your user account is not linked to an employee record."))
        today = fields.Date.context_today(self)
        month_start = today.replace(day=1)
        start_date = fields.Date.to_date(date_from) if date_from else month_start
        end_date = fields.Date.to_date(date_to) if date_to else today
        start_dt, _unused = self._day_bounds(start_date)
        _unused, end_dt = self._day_bounds(end_date)
        attendances = self.search([
            ("employee_id", "=", employee.id), ("check_in", ">=", start_dt), ("check_in", "<", end_dt)
        ], order="check_in desc")
        rows = [self._row(employee, record, pytz.UTC.localize(record.check_in).astimezone(self._user_tz()).date()) for record in attendances]
        open_attendance = attendances.filtered(lambda record: not record.check_out)[:1]
        today_start, today_end = self._day_bounds(today)
        today_attendance = self.search([
            ("employee_id", "=", employee.id), ("check_in", ">=", today_start), ("check_in", "<", today_end)
        ], order="check_in desc", limit=1)
        expected, _grace, shift = self._expected_start(employee, today)
        policy = self.env["cleon.time.policy"].search([("company_id", "=", employee.company_id.id)], limit=1)
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=6)
        timesheets = self.env["account.analytic.line"].sudo().search([
            ("employee_id", "=", employee.id),
            ("date", ">=", week_start),
            ("date", "<=", week_end),
        ])
        timesheet_hours = sum(timesheets.mapped("unit_amount"))
        project_hours = {}
        for line in timesheets:
            project_name = line.project_id.name if line.project_id else _("Internal / Other")
            project_hours[project_name] = project_hours.get(project_name, 0.0) + line.unit_amount
        expected_week_hours = (policy.standard_hours if policy else 8.0) * (
            5 if not policy or policy.work_week == "five" else 6
        )
        pending_regularizations = self.env["cleon.attendance.regularization"].sudo().search_count([
            ("employee_id", "=", employee.id), ("state", "=", "submitted"),
        ])
        year_start, _unused = self._day_bounds(today.replace(month=1, day=1))
        ytd_attendances = self.search([
            ("employee_id", "=", employee.id),
            ("check_in", ">=", year_start),
            ("check_in", "<", today_end),
        ])
        upcoming_shifts = []
        for offset in range(7):
            schedule_date = today + timedelta(days=offset)
            schedule_start, _schedule_grace, schedule = self._expected_start(employee, schedule_date)
            upcoming_shifts.append({
                "date": fields.Date.to_string(schedule_date),
                "name": schedule.name if schedule else "Standard Schedule",
                "start": schedule_start,
                "end": schedule.end_hour if schedule else schedule_start + (
                    policy.standard_hours if policy else 8.0
                ),
            })

        row_by_date = {row["date"]: row for row in rows}
        approved_leaves = self.env["hr.leave"].sudo().search([
            ("employee_id", "=", employee.id),
            ("state", "=", "validate"),
            ("request_date_from", "<=", end_date),
            ("request_date_to", ">=", month_start),
        ])
        leave_dates = set()
        for leave in approved_leaves:
            cursor = max(leave.request_date_from, month_start)
            leave_end = min(leave.request_date_to, end_date)
            while cursor <= leave_end:
                leave_dates.add(fields.Date.to_string(cursor))
                cursor += timedelta(days=1)
        holiday_dates = set()
        resource_calendar = employee.resource_calendar_id
        if resource_calendar:
            month_start_dt, _unused = self._day_bounds(month_start)
            _unused, month_end_dt = self._day_bounds(end_date)
            for leave in resource_calendar.global_leave_ids.filtered(
                lambda item: item.date_from < month_end_dt and item.date_to > month_start_dt
            ):
                local_start = pytz.UTC.localize(leave.date_from).astimezone(self._user_tz()).date()
                local_end = pytz.UTC.localize(leave.date_to).astimezone(self._user_tz()).date()
                cursor = max(local_start, month_start)
                while cursor <= min(local_end, end_date):
                    holiday_dates.add(fields.Date.to_string(cursor))
                    cursor += timedelta(days=1)
        calendar_days = []
        days_in_month = calendar.monthrange(month_start.year, month_start.month)[1]
        for day_number in range(1, days_in_month + 1):
            day = month_start.replace(day=day_number)
            key = fields.Date.to_string(day)
            row = row_by_date.get(key)
            status = row["status"] if row else "future"
            if key in leave_dates:
                status = "on_leave"
            elif key in holiday_dates:
                status = "holiday"
            elif day.weekday() >= (5 if not policy or policy.work_week == "five" else 6):
                status = "weekend"
            elif day < today and not row:
                status = "absent"
            calendar_days.append({
                "date": key,
                "day": day_number,
                "weekday": day.strftime("%a"),
                "status": status,
                "is_today": day == today,
            })

        monthly_overtime = round(sum(row["overtime_hours"] for row in rows), 2)
        weekend_overtime = round(sum(
            row["overtime_hours"] for row in rows if row["overtime_category"] == "weekend"
        ), 2)
        holiday_overtime = round(sum(
            row["overtime_hours"] for row in rows if row["overtime_category"] == "holiday"
        ), 2)
        pending_actions = []
        if open_attendance:
            pending_actions.append({"type": "clock", "label": _("Remember to clock out today")})
        if pending_regularizations:
            pending_actions.append({
                "type": "regularization",
                "label": _("%s attendance correction request(s) awaiting review") % pending_regularizations,
            })
        missing_hours = max(0.0, expected_week_hours - timesheet_hours)
        if missing_hours:
            pending_actions.append({
                "type": "timesheet",
                "label": _("Log %.1f remaining timesheet hours this week") % missing_hours,
            })
        return {
            "employee": employee.name,
            "employee_id": employee.id,
            "attendance_state": "checked_in" if open_attendance else "checked_out",
            "today": self._row(employee, today_attendance, today) if today_attendance else False,
            "rows": rows,
            "summary": {
                "days_present": len({pytz.UTC.localize(record.check_in).astimezone(self._user_tz()).date() for record in attendances}),
                "total_hours": round(sum(max(0, row["hours"]) for row in rows), 2),
                "late_arrivals": len([row for row in rows if row["status"] == "late"]),
                "ytd_days_present": len({
                    pytz.UTC.localize(record.check_in).astimezone(self._user_tz()).date()
                    for record in ytd_attendances
                }),
                "weekly_timesheet_hours": round(timesheet_hours, 2),
                "weekly_expected_hours": round(expected_week_hours, 2),
                "weekly_timesheet_percent": round(
                    min(100, timesheet_hours / expected_week_hours * 100) if expected_week_hours else 0
                ),
                "pending_requests": pending_regularizations,
                "weekly_missing_hours": round(missing_hours, 2),
                "weekly_timesheet_status": "complete" if timesheet_hours >= expected_week_hours else "draft",
                "monthly_overtime_hours": monthly_overtime,
                "weekend_overtime_hours": weekend_overtime,
                "holiday_overtime_hours": holiday_overtime,
            },
            "shift": {
                "name": shift.name if shift else "Standard Schedule",
                "start": expected,
                "end": shift.end_hour if shift else expected + (policy.standard_hours if policy else 8.0),
                "break_minutes": shift.break_minutes if shift else (policy.default_break_minutes if policy else 0),
            },
            "upcoming_shifts": upcoming_shifts,
            "tomorrow_shift": upcoming_shifts[1] if len(upcoming_shifts) > 1 else False,
            "timesheet_projects": [
                {"name": name, "hours": round(hours, 2)}
                for name, hours in sorted(project_hours.items(), key=lambda item: item[1], reverse=True)
            ],
            "pending_actions": pending_actions,
            "calendar": {
                "label": month_start.strftime("%B %Y"),
                "leading_blanks": (month_start.weekday()),
                "days": calendar_days,
            },
        }

    @api.model
    def cleon_toggle_attendance(self):
        employee = self.env.user.employee_id
        if not employee:
            raise UserError(_("Your user account is not linked to an employee record."))
        previous_state = employee.attendance_state
        attendance = employee._attendance_action_change()
        if previous_state == "checked_out":
            local_date = pytz.UTC.localize(attendance.check_in).astimezone(self._user_tz()).date()
            _expected, _grace, shift = self._expected_start(employee, local_date)
            policy = self.env["cleon.time.policy"].search([
                ("company_id", "=", employee.company_id.id),
            ], limit=1)
            attendance.write({
                "cleon_shift_id": shift.id if shift else False,
                "cleon_break_minutes": shift.break_minutes if shift else (
                    policy.default_break_minutes if policy else 0
                ),
            })
        action = "created" if previous_state == "checked_out" else "modified"
        self.env["cleon.time.audit.log"].sudo().create({
            "attendance_id": attendance.id, "employee_id": employee.id, "user_id": self.env.user.id,
            "action": action, "reason": "Employee clock in" if action == "created" else "Employee clock out",
            "after_values": {
                "check_in": fields.Datetime.to_string(attendance.check_in),
                "check_out": fields.Datetime.to_string(attendance.check_out) if attendance.check_out else False,
            },
            "company_id": employee.company_id.id,
        })
        return self.get_cleon_employee_data()

    @api.constrains("cleon_break_minutes")
    def _check_break_minutes(self):
        if any(record.cleon_break_minutes < 0 for record in self):
            raise ValidationError(_("Break duration cannot be negative."))

    @api.model
    def _user_tz(self):
        return pytz.timezone(self.env.user.tz or "UTC")

    @api.model
    def _day_bounds(self, target_date):
        tz = self._user_tz()
        start = tz.localize(datetime.combine(target_date, time.min)).astimezone(pytz.UTC).replace(tzinfo=None)
        end = (tz.localize(datetime.combine(target_date, time.min)) + timedelta(days=1)).astimezone(pytz.UTC).replace(tzinfo=None)
        return start, end

    @api.model
    def _display_time(self, value):
        if not value:
            return ""
        localized = pytz.UTC.localize(value).astimezone(self._user_tz())
        return localized.strftime("%I:%M %p").lstrip("0")

    @api.model
    def _expected_start(self, employee, target_date):
        assignment = self.env["cleon.hr.shift.assignment"].search([
            ("company_id", "=", employee.company_id.id),
            ("date_from", "<=", target_date),
            "|", ("date_to", "=", False), ("date_to", ">=", target_date),
            "|", ("employee_id", "=", employee.id), ("department_id", "=", employee.department_id.id),
        ], order="assignment_type desc, employee_id desc, date_from desc", limit=1)
        if assignment:
            shift = assignment.shift_id
            return shift.start_hour, shift.grace_minutes, shift
        shift = self.env["cleon.hr.shift"].search([
            ("employee_ids", "in", employee.id), ("company_id", "=", employee.company_id.id)
        ], limit=1)
        if shift:
            return shift.start_hour, shift.grace_minutes, shift
        calendar = employee.resource_calendar_id
        lines = calendar.attendance_ids.filtered(lambda line: int(line.dayofweek) == target_date.weekday() and line.day_period != "lunch")
        return (min(lines.mapped("hour_from")) if lines else 9.0), 0, self.env["cleon.hr.shift"]

    @api.model
    def _status_for(self, attendance, employee, target_date):
        if attendance and attendance.cleon_status_override:
            return attendance.cleon_status_override, 0
        if not attendance:
            return "absent", 0
        expected, grace, _shift = self._expected_start(employee, target_date)
        local_check = pytz.UTC.localize(attendance.check_in).astimezone(self._user_tz())
        actual_minutes = local_check.hour * 60 + local_check.minute
        expected_minutes = round(expected * 60) + grace
        late_by = max(0, actual_minutes - expected_minutes)
        return ("late" if late_by else "present"), late_by

    @api.model
    def _time_integration_values(self, attendance, employee, target_date, shift=False):
        """Return one normalized view of attendance for downstream features.

        Attendance remains the source of actual hours; shifts/policy provide the
        expectation, analytic lines provide task hours, and the resource calendar
        identifies public holidays.  No values are copied between those models.
        """
        policy = self.env["cleon.time.policy"].search([
            ("company_id", "=", employee.company_id.id),
        ], limit=1)
        expected_hours = policy.standard_hours if policy else 8.0
        if shift:
            expected_hours = (shift.end_hour - shift.start_hour) % 24
            expected_hours = max(0.0, expected_hours - shift.break_minutes / 60.0)

        net_hours = max(0.0, (attendance.worked_hours or 0.0) - (
            (attendance.cleon_break_minutes or 0) / 60.0
        )) if attendance else 0.0
        calendar = employee.resource_calendar_id
        day_start, day_end = self._day_bounds(target_date)
        is_holiday = bool(calendar and calendar.global_leave_ids.filtered(
            lambda leave: leave.date_from < day_end and leave.date_to > day_start
        ))
        is_weekend = target_date.weekday() >= (5 if not policy or policy.work_week == "five" else 6)

        overtime_category = "daily"
        overtime_rate = policy.daily_overtime_rate if policy else 1.5
        threshold = policy.daily_overtime_threshold if policy else expected_hours
        if is_holiday and (not policy or policy.holiday_overtime):
            overtime_category = "holiday"
            overtime_rate = policy.holiday_overtime_rate if policy else 2.5
            threshold = 0.0
        elif is_weekend and (not policy or policy.weekend_overtime):
            overtime_category = "weekend"
            overtime_rate = policy.weekend_overtime_rate if policy else 2.0
            threshold = 0.0
        overtime_hours = max(0.0, net_hours - threshold)

        timesheet_hours = 0.0
        if employee and "account.analytic.line" in self.env:
            groups = self.env["account.analytic.line"].sudo()._read_group(
                [("employee_id", "=", employee.id), ("date", "=", target_date)],
                [], ["unit_amount:sum"],
            )
            timesheet_hours = groups[0][0] if groups else 0.0
        return {
            "expected_hours": round(expected_hours, 2),
            "net_hours": round(net_hours, 2),
            "hours_variance": round(timesheet_hours - net_hours, 2),
            "timesheet_hours": round(timesheet_hours, 2),
            "overtime_hours": round(overtime_hours, 2),
            "overtime_category": overtime_category,
            "overtime_rate": overtime_rate,
            "is_weekend": is_weekend,
            "is_holiday": is_holiday,
        }

    @api.model
    def _row(self, employee, attendance, target_date, on_leave=False):
        expected, _grace, assigned_shift = self._expected_start(employee, target_date)
        status, late_by = self._status_for(attendance, employee, target_date)
        if on_leave and not attendance:
            status = "on_leave"
        shift = attendance.cleon_shift_id if attendance and attendance.cleon_shift_id else assigned_shift
        hours = max(0.0, (attendance.worked_hours if attendance else 0.0) - ((attendance.cleon_break_minutes if attendance else 0) / 60.0))
        row = {
            "id": attendance.id if attendance else 0,
            "employee_id": employee.id,
            "employee": employee.name,
            "employee_code": employee.barcode or "EMP-%03d" % employee.id,
            "department": employee.department_id.name or "—",
            "date": fields.Date.to_string(target_date),
            "check_in": self._display_time(attendance.check_in) if attendance else "",
            "check_out": self._display_time(attendance.check_out) if attendance else "",
            "check_in_raw": fields.Datetime.to_string(attendance.check_in) if attendance else "",
            "check_out_raw": fields.Datetime.to_string(attendance.check_out) if attendance and attendance.check_out else "",
            "shift": shift.name if shift else "Day Shift (%s)" % int(expected),
            "shift_id": shift.id if shift else False,
            "status": status,
            "source": dict(self._fields["in_mode"].selection).get(attendance.in_mode, "Manual") if attendance else "—",
            "late_by": late_by,
            "break_minutes": attendance.cleon_break_minutes if attendance else 0,
            "hours": round(hours, 2),
        }
        row.update(self._time_integration_values(attendance, employee, target_date, shift))
        return row

    @api.model
    def get_cleon_time_data(self, view="dashboard", date_from=False, date_to=False, department_id=False, search=""):
        if not self.env.user.has_group("base.group_system"):
            raise UserError(_("Only Settings administrators can view organization-wide attendance."))
        today = fields.Date.context_today(self)
        start_date = fields.Date.to_date(date_from) if date_from else today
        end_date = fields.Date.to_date(date_to) if date_to else start_date
        employee_domain = [("company_id", "=", self.env.company.id), ("active", "=", True)]
        if department_id:
            employee_domain.append(("department_id", "=", int(department_id)))
        if search:
            employee_domain += ["|", ("name", "ilike", search), ("barcode", "ilike", search)]
        employees = self.env["hr.employee"].search(employee_domain, order="name")
        start_dt, _ = self._day_bounds(start_date)
        _, end_dt = self._day_bounds(end_date)
        attendances = self.search([
            ("employee_id", "in", employees.ids), ("check_in", ">=", start_dt), ("check_in", "<", end_dt)
        ], order="check_in desc")
        leave_records = self.env["hr.leave"].search([
            ("employee_id", "in", employees.ids), ("state", "=", "validate"),
            ("request_date_from", "<=", end_date), ("request_date_to", ">=", start_date),
        ])
        leave_employee_ids = set(leave_records.mapped("employee_id").ids)
        rows = []
        if view == "dashboard":
            by_employee = {}
            for attendance in attendances:
                by_employee.setdefault(attendance.employee_id.id, attendance)
            rows = [self._row(emp, by_employee.get(emp.id), start_date, emp.id in leave_employee_ids) for emp in employees]
        else:
            rows = [self._row(att.employee_id, att, pytz.UTC.localize(att.check_in).astimezone(self._user_tz()).date()) for att in attendances]
        counts = {key: len([row for row in rows if row["status"] == key]) for key in ("present", "late", "absent", "on_leave")}
        present_count = counts["present"] + counts["late"]
        return {
            "rows": rows,
            "counts": counts,
            "attendance_rate": round((present_count / len(employees) * 100) if employees else 0),
            "departments": self.env["hr.department"].search_read([], ["name"], order="name"),
            "shifts": self.env["cleon.hr.shift"].search_read([("company_id", "=", self.env.company.id)], ["name"]),
        }

    def cleon_update_attendance(self, values, reason):
        self.ensure_one()
        if not self.env.user.has_group("base.group_system"):
            raise UserError(_("Only Settings administrators can edit attendance records."))
        if not reason or not reason.strip():
            raise UserError(_("Please provide a reason for changing this attendance record."))
        allowed = {"check_in", "check_out", "cleon_break_minutes", "cleon_status_override", "cleon_shift_id"}
        clean = {key: value for key, value in values.items() if key in allowed}
        if not clean:
            raise UserError(_("No editable attendance values were provided."))
        def audit_value(key):
            value = self[key]
            if key == "cleon_shift_id":
                return value.id if value else False
            if isinstance(value, datetime):
                return fields.Datetime.to_string(value)
            return value

        before = {key: audit_value(key) for key in clean}
        clean["cleon_edit_reason"] = reason.strip()
        self.write(clean)
        after = {key: audit_value(key) for key in clean if key != "cleon_edit_reason"}
        self.env["cleon.time.audit.log"].create({
            "attendance_id": self.id, "employee_id": self.employee_id.id,
            "action": "modified", "reason": reason.strip(),
            "before_values": before, "after_values": after,
        })
        return True
