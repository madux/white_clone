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
            },
            "shift": {
                "name": shift.name if shift else "Standard Schedule",
                "start": expected,
                "end": shift.end_hour if shift else expected + (policy.standard_hours if policy else 8.0),
                "break_minutes": shift.break_minutes if shift else (policy.default_break_minutes if policy else 0),
            },
        }

    @api.model
    def cleon_toggle_attendance(self):
        employee = self.env.user.employee_id
        if not employee:
            raise UserError(_("Your user account is not linked to an employee record."))
        previous_state = employee.attendance_state
        attendance = employee._attendance_action_change()
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
    def _row(self, employee, attendance, target_date, on_leave=False):
        expected, _grace, assigned_shift = self._expected_start(employee, target_date)
        status, late_by = self._status_for(attendance, employee, target_date)
        if on_leave and not attendance:
            status = "on_leave"
        shift = attendance.cleon_shift_id if attendance and attendance.cleon_shift_id else assigned_shift
        hours = max(0.0, (attendance.worked_hours if attendance else 0.0) - ((attendance.cleon_break_minutes if attendance else 0) / 60.0))
        return {
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
