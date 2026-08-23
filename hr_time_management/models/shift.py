from datetime import datetime, time, timedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class CleonHrShiftSegment(models.Model):
    _name = "cleon.hr.shift.segment"
    _description = "CleonHR Shift Segment"
    _order = "sequence, id"

    shift_id = fields.Many2one("cleon.hr.shift", required=True, ondelete="cascade", index=True)
    name = fields.Char(required=True, default="Shift Segment")
    sequence = fields.Integer(default=1)
    start_hour = fields.Float(required=True, default=8.0)
    end_hour = fields.Float(required=True, default=12.0)

    @api.constrains("start_hour", "end_hour")
    def _check_segment_hours(self):
        for reg in self:
            if not 0 <= reg.start_hour < 24 or not 0 <= reg.end_hour < 24:
                raise ValidationError(_("Segment start and end hour must be between 0 and 24."))
            if reg.start_hour == reg.end_hour:
                raise ValidationError(_("Segment start and end hour cannot be identical."))

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        records.mapped("shift_id")._sync_resource_calendar()
        return records

    def write(self, vals):
        res = super().write(vals)
        self.mapped("shift_id")._sync_resource_calendar()
        return res

    def unlink(self):
        shifts = self.mapped("shift_id")
        res = super().unlink()
        shifts._sync_resource_calendar()
        return res


class CleonHrShift(models.Model):
    _name = "cleon.hr.shift"
    _description = "CleonHR Work Shift"
    _order = "name"

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    active = fields.Boolean(default=True)
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company)
    start_hour = fields.Float(required=True, default=9.0)
    end_hour = fields.Float(required=True, default=17.0)
    break_minutes = fields.Integer(default=60)
    grace_minutes = fields.Integer(default=0)
    active_days = fields.Char(default="0,1,2,3,4", help="Comma-separated weekday numbers, Monday=0.")
    recurrence = fields.Selection([
        ("weekly", "Weekly"),
        ("biweekly", "Bi-weekly"),
        ("rotating", "Rotating (Alternate Weeks)"),
    ], default="weekly", required=True)
    shift_type = fields.Selection([
        ("fixed", "Fixed"),
        ("rotating", "Rotating"),
        ("night", "Night"),
        ("split", "Split"),
    ], default="fixed", required=True)
    segment_ids = fields.One2many("cleon.hr.shift.segment", "shift_id", string="Shift Segments (For Split Shifts)")
    employee_ids = fields.Many2many("hr.employee", string="Assigned Employees")
    resource_calendar_id = fields.Many2one("resource.calendar", string="Resource Calendar (Synchronized Template)", ondelete="set null")

    _sql_constraints = [
        ("shift_code_company_unique", "unique(code, company_id)", "Shift code must be unique per company."),
    ]

    @api.constrains("name", "company_id")
    def _check_unique_name(self):
        for record in self.filtered("name"):
            duplicate = self.search_count([
                ("id", "!=", record.id),
                ("company_id", "=", record.company_id.id),
                ("name", "=ilike", record.name.strip()),
            ])
            if duplicate:
                raise ValidationError(_("Shift name must be unique per company."))

    @api.constrains("break_minutes", "grace_minutes")
    def _check_non_negative_minutes(self):
        if any(not 0 <= record.break_minutes <= 120 or not 0 <= record.grace_minutes <= 60 for record in self):
            raise ValidationError(_("Break must be between 0 and 120 minutes and grace period between 0 and 60 minutes."))

    @api.constrains("start_hour", "end_hour", "shift_type", "segment_ids")
    def _check_hours(self):
        for record in self:
            if record.shift_type == "split":
                if not record.segment_ids or len(record.segment_ids) < 2:
                    raise ValidationError(_("A Split shift must have at least 2 shift segments configured."))
            else:
                if not 0 <= record.start_hour < 24 or not 0 <= record.end_hour < 24:
                    raise ValidationError(_("Shift start and end time must fall within a 24-hour day."))
                if record.start_hour == record.end_hour:
                    raise ValidationError(_("Shift start and end time cannot be the same."))
                if record.end_hour < record.start_hour and record.shift_type != "night":
                    raise ValidationError(_("Only a Night shift may end on the following day."))

    @api.model_create_multi
    def create(self, vals_list):
        self._assert_shift_manager()
        records = super().create(vals_list)
        for record in records:
            record._sync_resource_calendar()
        return records

    def write(self, vals):
        self._assert_shift_manager()
        res = super().write(vals)
        if any(f in vals for f in ("name", "start_hour", "end_hour", "active_days", "company_id", "shift_type", "recurrence")):
            for record in self:
                record._sync_resource_calendar()
        return res

    def _sync_resource_calendar(self):
        """Synchronize native Odoo resource.calendar for this shift template, properly representing split and overnight shifts."""
        self.ensure_one()
        Calendar = self.env["resource.calendar"].sudo()
        Attendance = self.env["resource.calendar.attendance"].sudo()

        cal_name = f"[{self.code}] {self.name}"
        if not self.resource_calendar_id:
            calendar = Calendar.create({
                "name": cal_name,
                "company_id": self.company_id.id,
            })
            self.sudo().resource_calendar_id = calendar.id
        else:
            calendar = self.resource_calendar_id.sudo()
            calendar.write({"name": cal_name, "company_id": self.company_id.id})

        calendar.attendance_ids.unlink()
        days = [int(d) for d in (self.active_days or "").split(",") if d.strip().isdigit()]

        attendance_vals = []
        for day in days:
            day_str = str(day)
            if self.shift_type == "split" and self.segment_ids:
                for seg in self.segment_ids:
                    attendance_vals.append({
                        "name": f"{self.name} {seg.name} Day {day}",
                        "dayofweek": day_str,
                        "hour_from": seg.start_hour,
                        "hour_to": seg.end_hour,
                        "day_period": "morning" if seg.start_hour < 12.0 else "afternoon",
                        "calendar_id": calendar.id,
                    })
            elif self.end_hour < self.start_hour or self.shift_type == "night":
                attendance_vals.append({
                    "name": f"{self.name} Evening Day {day}",
                    "dayofweek": day_str,
                    "hour_from": self.start_hour,
                    "hour_to": 24.0,
                    "day_period": "afternoon",
                    "calendar_id": calendar.id,
                })
                next_day_str = str((day + 1) % 7)
                attendance_vals.append({
                    "name": f"{self.name} Morning Day {next_day_str}",
                    "dayofweek": next_day_str,
                    "hour_from": 0.0,
                    "hour_to": self.end_hour,
                    "day_period": "morning",
                    "calendar_id": calendar.id,
                })
            else:
                attendance_vals.append({
                    "name": f"{self.name} Day {day}",
                    "dayofweek": day_str,
                    "hour_from": self.start_hour,
                    "hour_to": self.end_hour,
                    "day_period": "morning" if self.start_hour < 12.0 else "afternoon",
                    "calendar_id": calendar.id,
                })

        if attendance_vals:
            Attendance.create(attendance_vals)

    @api.model
    def _assert_shift_manager(self):
        Policy = self.env["cleon.time.policy"]
        if not Policy._tm_can_configure_shift_templates():
            raise AccessError(_("Only HR Managers, HR Administrators, and System Administrators can configure global shift templates."))

    @api.model
    def _hour_label(self, value):
        minutes = round((value or 0) * 60)
        return f"{minutes // 60:02d}:{minutes % 60:02d}"

    @api.model
    def get_shift_management_data(self):
        """Service RPC wrapper returning formatted shifts, assignments, employees, and departments for the OWL UI."""
        Policy = self.env["cleon.time.policy"]
        role = Policy._tm_role()
        if role not in ("line_manager", "hr_manager", "hr_admin", "system_admin"):
            raise AccessError(_("Only a Time Management manager can view shift management data."))

        company = self.env.company
        allowed_emp_ids = Policy._tm_scope_employee_ids()
        shifts = self.with_context(active_test=False).search([("company_id", "=", company.id)])

        if role in ("hr_manager", "hr_admin", "system_admin"):
            assignments = self.env["cleon.hr.shift.assignment"].search([
                ("company_id", "=", company.id)
            ], order="date_from desc, id desc")
        else:
            scoped_dept_ids = self.env["hr.employee"].sudo().browse(allowed_emp_ids).mapped("department_id").ids
            assignments = self.env["cleon.hr.shift.assignment"].search([
                ("company_id", "=", company.id),
                "|", ("employee_id", "in", allowed_emp_ids), ("department_id", "in", scoped_dept_ids)
            ], order="date_from desc, id desc")

        assigned_counts = {}
        for a in assignments:
            if a.shift_id.id not in assigned_counts:
                assigned_counts[a.shift_id.id] = 0
            assigned_counts[a.shift_id.id] += 1

        shift_rows = []
        for s in shifts:
            days_list = [int(d) for d in (s.active_days or "").split(",") if d.strip().isdigit()]
            days_map = {0: "Mon", 1: "Tue", 2: "Wed", 3: "Thu", 4: "Fri", 5: "Sat", 6: "Sun"}
            days_label = ", ".join([days_map.get(d, "") for d in days_list])
            start_lbl = self._hour_label(s.start_hour)
            end_lbl = self._hour_label(s.end_hour)
            shift_rows.append({
                "id": s.id,
                "name": s.name,
                "code": s.code,
                "active": s.active,
                "start_hour": s.start_hour,
                "end_hour": s.end_hour,
                "start_time": start_lbl,
                "end_time": end_lbl,
                "start": start_lbl,
                "end": end_lbl,
                "break_minutes": s.break_minutes,
                "grace_minutes": s.grace_minutes,
                "shift_type": s.shift_type,
                "recurrence": s.recurrence,
                "active_days": days_list,
                "active_days_label": days_label,
                "assigned": assigned_counts.get(s.id, 0),
                "calendar_name": s.resource_calendar_id.name if s.resource_calendar_id else "—",
            })

        assignment_rows = [{
            "id": a.id,
            "shift_id": a.shift_id.id,
            "shift_name": a.shift_id.name,
            "shift": a.shift_id.name,
            "time": "%s – %s" % (self._hour_label(a.shift_id.start_hour), self._hour_label(a.shift_id.end_hour)),
            "target_name": a.employee_id.sudo().name if a.employee_id else (a.department_id.sudo().name if a.department_id else "—"),
            "employee": a.employee_id.sudo().name if a.employee_id else (a.department_id.sudo().name if a.department_id else "—"),
            "employee_code": a.employee_id.sudo().identification_id or "",
            "department": a.department_id.sudo().name if a.department_id else "—",
            "employee_id": a.employee_id.id if a.employee_id else False,
            "department_id": a.department_id.id if a.department_id else False,
            "date_from": fields.Date.to_string(a.date_from),
            "date_to": fields.Date.to_string(a.date_to) if a.date_to else False,
            "assignment_type": a.assignment_type,
            "note": a.note or "",
        } for a in assignments]

        employees = self.env["hr.employee"].search([("id", "in", allowed_emp_ids)])
        employee_rows = [{"id": e.id, "name": e.sudo().name, "identification_id": e.sudo().identification_id or ""} for e in employees]

        departments = self.env["hr.department"].search([("company_id", "=", company.id)])
        department_rows = [{"id": d.id, "name": d.sudo().name} for d in departments]

        swaps = self.env["cleon.shift.swap.request"].search([
            ("company_id", "=", company.id),
            "|", ("requester_id", "in", allowed_emp_ids), ("target_employee_id", "in", allowed_emp_ids)
        ], order="swap_date desc, id desc")

        swap_rows = [{
            "id": sw.id,
            "name": sw.name,
            "requester": sw.requester_id.sudo().name,
            "requester_id": sw.requester_id.id,
            "target": sw.target_employee_id.sudo().name,
            "target_employee_id": sw.target_employee_id.id,
            "date": fields.Date.to_string(sw.swap_date),
            "requester_shift": sw.requester_shift_id.name if sw.requester_shift_id else "—",
            "target_shift": sw.target_shift_id.name if sw.target_shift_id else "—",
            "state": sw.state,
            "reason": sw.reason or "",
        } for sw in swaps]

        today = fields.Date.context_today(self)
        assigned_emp_ids = set()
        for a in assignments:
            if a.date_from <= today and (not a.date_to or a.date_to >= today):
                if a.employee_id and a.employee_id.id in allowed_emp_ids:
                    assigned_emp_ids.add(a.employee_id.id)
                elif a.department_id:
                    dept_emps = self.env["hr.employee"].search([("department_id", "=", a.department_id.id), ("id", "in", allowed_emp_ids)])
                    assigned_emp_ids.update(dept_emps.ids)

        active_emp_count = len(employee_rows)
        coverage_rate = round((len(assigned_emp_ids) / max(1, active_emp_count)) * 100, 1)
        pending_swaps = len([sw for sw in swaps if sw.state in ("requested", "peer_accepted")])

        kpis = {
            "total_shifts": len(shift_rows),
            "active_employees": active_emp_count,
            "coverage_rate": coverage_rate,
            "pending_swaps": pending_swaps,
        }

        return {
            "shifts": shift_rows,
            "assignments": assignment_rows,
            "employees": employee_rows,
            "departments": department_rows,
            "swaps": swap_rows,
            "kpis": kpis,
        }

    @api.model
    def save_shift(self, vals):
        """Service RPC wrapper creating or updating a shift template from the OWL UI."""
        self._assert_shift_manager()
        shift_id = vals.get("id")
        code = (vals.get("code") or "").strip() or ("SH-%s" % (vals.get("name", "")[:3].upper()))

        active_days = vals.get("active_days")
        if isinstance(active_days, list):
            active_days_str = ",".join(str(d) for d in active_days)
        else:
            active_days_str = str(active_days or "0,1,2,3,4")

        data = {
            "name": (vals.get("name") or "").strip(),
            "code": code,
            "active": vals.get("active", True),
            "start_hour": float(vals.get("start_hour", 9.0)),
            "end_hour": float(vals.get("end_hour", 17.0)),
            "break_minutes": int(vals.get("break_minutes", 60)),
            "grace_minutes": int(vals.get("grace_minutes", 0)),
            "shift_type": vals.get("shift_type", "fixed"),
            "recurrence": vals.get("recurrence", "weekly"),
            "active_days": active_days_str,
            "company_id": self.env.company.id,
        }

        segments_data = vals.get("segment_ids") or vals.get("split_segments")
        if vals.get("shift_type") == "split" and segments_data:
            seg_tuples = [(0, 0, {
                "sequence": idx,
                "start_hour": float(seg.get("start_hour", 8.0)),
                "end_hour": float(seg.get("end_hour", 12.0)),
            }) for idx, seg in enumerate(segments_data, 1)]
            if shift_id:
                data["segment_ids"] = [(5, 0, 0)] + seg_tuples
            else:
                data["segment_ids"] = seg_tuples

        if shift_id:
            shift = self.browse(shift_id)
            shift.write(data)
        else:
            shift = self.create(data)

        shift._sync_resource_calendar()
        return {"id": shift.id, "name": shift.name}

    @api.model
    def get_expected_working_hours(self, employee_id, target_date):
        """Public RPC endpoint verifying authorization scope before returning employee expected schedule."""
        Policy = self.env["cleon.time.policy"]
        allowed = Policy._tm_scope_employee_ids()
        if employee_id not in allowed and not self.env.user.has_group("base.group_system"):
            raise AccessError(_("You are not authorized to query expected schedule for this employee."))
        return self._get_expected_working_hours_internal(employee_id, target_date)

    @api.model
    def _get_expected_hours_for_period(self, employee_id, date_from, date_to):
        """Calculate total expected working hours for an employee over a date range [date_from, date_to]."""
        if not employee_id or not date_from or not date_to:
            return 0.0
        d_from = fields.Date.to_date(date_from)
        d_to = fields.Date.to_date(date_to)
        if d_to < d_from:
            return 0.0
        total_hours = 0.0
        curr = d_from
        while curr <= d_to:
            info = self._get_expected_working_hours_internal(employee_id, curr)
            if info and not info.get("is_rest_day"):
                total_hours += info.get("expected_hours", 0.0)
            curr += timedelta(days=1)
        return total_hours

    @api.model
    def _get_expected_working_hours_internal(self, employee_id, target_date):
        """Internal server-side helper calculating expected shift working hours and datetimes for an employee."""
        self.env.flush_all()
        Employee = self.env["hr.employee"].sudo()
        emp = Employee.browse(employee_id)
        if not emp.exists():
            return False

        target_date_obj = fields.Date.to_date(target_date)

        # Attendance is sold independently from Shift Management.  In that
        # configuration there must still be a stable schedule against which
        # hours and punctuality can be evaluated, but customers must not gain
        # access to the shift assignment product.  Use the employee calendar
        # (when configured) and fall back to the protected company policy.
        Policy = self.env["cleon.time.policy"].sudo()
        policy = Policy.search([("company_id", "=", emp.company_id.id)], limit=1)
        if not Policy._tm_feature_access(policy).get("shift"):
            weekday = target_date_obj.weekday()
            weekend_days = [
                int(day.strip())
                for day in ((policy.weekend_days if policy else "5,6") or "5,6").split(",")
                if day.strip().isdigit()
            ]
            standard_hours = float(policy.standard_hours if policy else 8.0)
            break_minutes = int(
                policy.default_break_minutes
                if policy and policy.enable_break_period
                else 0
            )
            grace_minutes = int(policy.default_grace_minutes if policy else 0)
            start_hour = 9.0
            calendar = emp.resource_calendar_id
            if calendar:
                calendar_lines = calendar.attendance_ids.filtered(
                    lambda line: int(line.dayofweek) == weekday
                )
                if calendar_lines:
                    start_hour = min(calendar_lines.mapped("hour_from"))
            end_hour = (start_hour + standard_hours + (break_minutes / 60.0)) % 24.0
            is_rest_day = weekday in weekend_days
            start_dt = datetime.combine(target_date_obj, time()) + timedelta(hours=start_hour)
            end_dt = start_dt + timedelta(hours=standard_hours, minutes=break_minutes)
            return {
                "shift_id": False,
                "shift_name": _("Standard Attendance Schedule"),
                "shift_code": "ATTENDANCE-DEFAULT",
                "expected_hours": 0.0 if is_rest_day else standard_hours,
                "is_rest_day": is_rest_day,
                "start_hour": start_hour,
                "end_hour": end_hour,
                "start_datetime": start_dt,
                "end_datetime": end_dt,
                "break_minutes": break_minutes,
                "grace_minutes": grace_minutes,
                "schedule_source": "attendance_policy",
            }

        # 1. Approved shift swap override for target_date
        Swap = self.env["cleon.shift.swap.request"].sudo()
        swap = Swap.search([
            ("swap_date", "=", target_date_obj),
            ("state", "=", "approved"),
            "|", ("requester_id", "=", emp.id), ("target_employee_id", "=", emp.id),
        ], limit=1)

        shift = False
        assignment = False
        if swap:
            shift = swap.target_shift_id if swap.requester_id == emp else swap.requester_shift_id

        # 2. Strict business precedence lookup for active shift assignment
        if not shift:
            Assignment = self.env["cleon.hr.shift.assignment"].sudo()
            # 2a. Temporary employee assignment
            assignment = Assignment.search([
                ("company_id", "=", emp.company_id.id),
                ("employee_id", "=", emp.id),
                ("assignment_type", "=", "temporary"),
                ("date_from", "<=", target_date_obj),
                "|", ("date_to", "=", False), ("date_to", ">=", target_date_obj),
            ], limit=1)
            # 2b. Standard employee assignment
            if not assignment:
                assignment = Assignment.search([
                    ("company_id", "=", emp.company_id.id),
                    ("employee_id", "=", emp.id),
                    ("assignment_type", "=", "standard"),
                    ("date_from", "<=", target_date_obj),
                    "|", ("date_to", "=", False), ("date_to", ">=", target_date_obj),
                ], limit=1)
            # 2c. Temporary department assignment
            if not assignment and emp.department_id:
                assignment = Assignment.search([
                    ("company_id", "=", emp.company_id.id),
                    ("department_id", "=", emp.department_id.id),
                    ("assignment_type", "=", "temporary"),
                    ("date_from", "<=", target_date_obj),
                    "|", ("date_to", "=", False), ("date_to", ">=", target_date_obj),
                ], limit=1)
            # 2d. Standard department assignment
            if not assignment and emp.department_id:
                assignment = Assignment.search([
                    ("company_id", "=", emp.company_id.id),
                    ("department_id", "=", emp.department_id.id),
                    ("assignment_type", "=", "standard"),
                    ("date_from", "<=", target_date_obj),
                    "|", ("date_to", "=", False), ("date_to", ">=", target_date_obj),
                ], limit=1)

            if assignment:
                shift = assignment.shift_id

        # 3. Explicit policy default shift (No arbitrary limit=1 fallback)
        if not shift:
            if policy and policy.default_shift_id:
                shift = policy.default_shift_id

        if not shift:
            return {
                "shift_id": False,
                "shift_name": _("No Shift Assigned"),
                "shift_code": False,
                "expected_hours": 0.0,
                "is_rest_day": True,
                "start_hour": 0.0,
                "end_hour": 0.0,
                "break_minutes": 0,
                "grace_minutes": 0,
            }

        # Handle rotating / bi-weekly schedule engine
        if shift.recurrence in ("biweekly", "rotating") and assignment and assignment.date_from:
            week_index = (target_date_obj - assignment.date_from).days // 7
            if week_index % 2 == 1:
                return {
                    "shift_id": shift.id,
                    "shift_name": shift.name,
                    "shift_code": shift.code,
                    "expected_hours": 0.0,
                    "is_rest_day": True,
                    "start_hour": shift.start_hour,
                    "end_hour": shift.end_hour,
                    "break_minutes": shift.break_minutes,
                    "grace_minutes": shift.grace_minutes,
                }

        active_days = [int(d) for d in (shift.active_days or "").split(",") if d.strip().isdigit()]
        weekday = target_date_obj.weekday()

        if weekday not in active_days:
            return {
                "shift_id": shift.id,
                "shift_name": shift.name,
                "shift_code": shift.code,
                "expected_hours": 0.0,
                "is_rest_day": True,
                "start_hour": shift.start_hour,
                "end_hour": shift.end_hour,
                "break_minutes": shift.break_minutes,
                "grace_minutes": shift.grace_minutes,
            }

        # Calculate Split shift expected hours
        if shift.shift_type == "split" and shift.segment_ids:
            segments = []
            total_gross = 0.0
            for seg in shift.segment_ids:
                seg_gross = seg.end_hour - seg.start_hour if seg.end_hour > seg.start_hour else 24.0 - seg.start_hour + seg.end_hour
                total_gross += seg_gross
                segments.append({
                    "name": seg.name,
                    "start_hour": seg.start_hour,
                    "end_hour": seg.end_hour,
                    "hours": seg_gross,
                })
            net_hours = max(0.0, total_gross - (shift.break_minutes / 60.0))
            first_start = min(s["start_hour"] for s in segments) if segments else shift.start_hour
            last_end = max(s["end_hour"] for s in segments) if segments else shift.end_hour
            return {
                "shift_id": shift.id,
                "shift_name": shift.name,
                "shift_code": shift.code,
                "start_hour": first_start,
                "end_hour": last_end,
                "expected_hours": net_hours,
                "is_rest_day": False,
                "is_split": True,
                "segments": segments,
                "break_minutes": shift.break_minutes,
                "grace_minutes": shift.grace_minutes,
            }

        # Regular or Night continuous shift
        start_hours = int(shift.start_hour)
        start_mins = int(round((shift.start_hour - start_hours) * 60))
        start_dt = datetime.combine(target_date_obj, time(start_hours, start_mins))

        end_hours = int(shift.end_hour)
        end_mins = int(round((shift.end_hour - end_hours) * 60))

        if shift.shift_type == "night" and shift.end_hour < shift.start_hour:
            end_date = target_date_obj + timedelta(days=1)
        else:
            end_date = target_date_obj
        end_dt = datetime.combine(end_date, time(end_hours, end_mins))

        if shift.end_hour > shift.start_hour:
            gross_hours = shift.end_hour - shift.start_hour
        else:
            gross_hours = 24.0 - shift.start_hour + shift.end_hour

        net_hours = max(0.0, gross_hours - (shift.break_minutes / 60.0))

        return {
            "shift_id": shift.id,
            "shift_name": shift.name,
            "shift_code": shift.code,
            "start_hour": shift.start_hour,
            "end_hour": shift.end_hour,
            "start_datetime": start_dt,
            "end_datetime": end_dt,
            "expected_hours": net_hours,
            "break_minutes": shift.break_minutes,
            "grace_minutes": shift.grace_minutes,
            "is_rest_day": False,
        }


class CleonHrShiftAssignment(models.Model):
    _name = "cleon.hr.shift.assignment"
    _description = "CleonHR Shift Assignment"
    _order = "date_from desc, id desc"

    shift_id = fields.Many2one("cleon.hr.shift", required=True, ondelete="cascade")
    company_id = fields.Many2one(related="shift_id.company_id", store=True, index=True)
    employee_id = fields.Many2one("hr.employee", index=True)
    department_id = fields.Many2one("hr.department", index=True)
    date_from = fields.Date(required=True, default=fields.Date.context_today)
    date_to = fields.Date()
    assignment_type = fields.Selection([
        ("standard", "Standard Schedule"),
        ("temporary", "Temporary Override"),
    ], default="standard", required=True)
    note = fields.Char()

    @api.constrains("employee_id", "department_id")
    def _check_target(self):
        for record in self:
            if not record.employee_id and not record.department_id:
                raise ValidationError(_("A shift assignment must target either an employee or a department."))
            if record.employee_id and record.department_id:
                raise ValidationError(_("A shift assignment cannot target both an employee and a department simultaneously."))

    @api.constrains("date_from", "date_to")
    def _check_dates(self):
        if any(record.date_to and record.date_to < record.date_from for record in self):
            raise ValidationError(_("Shift assignment end date cannot be before its start date."))

    @api.constrains("employee_id", "department_id", "date_from", "date_to", "assignment_type")
    def _check_overlap(self):
        for record in self:
            domain = [
                ("id", "!=", record.id),
                ("company_id", "=", record.company_id.id),
                ("assignment_type", "=", record.assignment_type),
                ("date_from", "<=", record.date_to or fields.Date.to_date("9999-12-31")),
                "|", ("date_to", "=", False), ("date_to", ">=", record.date_from),
            ]
            if record.employee_id:
                domain.append(("employee_id", "=", record.employee_id.id))
            else:
                domain.append(("department_id", "=", record.department_id.id))
            if self.search_count(domain):
                raise ValidationError(_("This employee or department already has an overlapping shift assignment of the same type."))

    @api.model_create_multi
    def create(self, vals_list):
        Policy = self.env["cleon.time.policy"]
        for vals in vals_list:
            emp_id = vals.get("employee_id")
            dept_id = vals.get("department_id")
            if dept_id or (not emp_id and not dept_id):
                if Policy._tm_role() not in ("hr_manager", "hr_admin", "system_admin"):
                    raise AccessError(_("Only HR Managers or System Admins can create department-level shift assignments."))
            elif emp_id:
                emp = self.env["hr.employee"].browse(emp_id)
                if not Policy._tm_can_manage_shift_assignment(emp):
                    raise AccessError(_("You are not authorized to manage shift assignments for employee '%s'.") % emp.name)
        return super().create(vals_list)

    def write(self, vals):
        Policy = self.env["cleon.time.policy"]
        for record in self:
            emp = self.env["hr.employee"].browse(vals["employee_id"]) if "employee_id" in vals else record.employee_id
            dept = self.env["hr.department"].browse(vals["department_id"]) if "department_id" in vals else record.department_id
            if dept:
                if Policy._tm_role() not in ("hr_manager", "hr_admin", "system_admin"):
                    raise AccessError(_("Only HR managers or System Admins can edit department-level shift assignments."))
            elif emp:
                if not Policy._tm_can_manage_shift_assignment(emp):
                    raise AccessError(_("You are not authorized to edit shift assignments for employee '%s'.") % emp.name)
        return super().write(vals)

    @api.model
    def create_shift_assignment(self, vals):
        """Service RPC wrapper for creating shift assignments from the OWL UI."""
        emp_id = vals.get("employee_id") or False
        dept_id = vals.get("department_id") or False
        assignment = self.create({
            "shift_id": vals.get("shift_id"),
            "employee_id": emp_id,
            "department_id": dept_id,
            "date_from": vals.get("date_from") or fields.Date.context_today(self),
            "date_to": vals.get("date_to") or False,
            "assignment_type": vals.get("assignment_type", "standard"),
            "note": vals.get("note", ""),
        })
        return {"id": assignment.id}


class CleonShiftSwapRequest(models.Model):
    _name = "cleon.shift.swap.request"
    _description = "CleonHR Shift Swap Request"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "swap_date desc, id desc"

    name = fields.Char(default="New", readonly=True, copy=False)
    requester_id = fields.Many2one("hr.employee", required=True, index=True, tracking=True)
    target_employee_id = fields.Many2one("hr.employee", required=True, index=True, tracking=True)
    swap_date = fields.Date(required=True, index=True, tracking=True)
    requester_shift_id = fields.Many2one("cleon.hr.shift", string="Requester Current Shift")
    target_shift_id = fields.Many2one("cleon.hr.shift", string="Target Current Shift")
    reason = fields.Text(required=True)
    state = fields.Selection([
        ("draft", "Draft"),
        ("requested", "Pending Peer Acceptance"),
        ("peer_accepted", "Pending Line Manager Approval"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ], default="draft", required=True, index=True, tracking=True)
    line_manager_id = fields.Many2one("hr.employee", related="requester_id.parent_id", store=True, index=True)
    company_id = fields.Many2one("res.company", default=lambda self: self.env.company, required=True, index=True)
    manager_comment = fields.Text()
    approver_id = fields.Many2one("res.users", readonly=True)
    decision_at = fields.Datetime(readonly=True)

    _sql_constraints = [
        ("distinct_employees", "CHECK(requester_id != target_employee_id)", "Requester and target employee cannot be the same person."),
    ]

    @api.model
    def get_my_swap_requests(self):
        """Return only swaps involving the employee linked to the current user."""
        employee = self.env.user.employee_id
        if not employee:
            return []
        requests = self.search([
            "|", ("requester_id", "=", employee.id), ("target_employee_id", "=", employee.id),
        ], order="swap_date desc, id desc")
        return [{
            "id": request.id,
            "name": request.name,
            "date": fields.Date.to_string(request.swap_date),
            "requester": request.requester_id.sudo().name,
            "target": request.target_employee_id.sudo().name,
            "requester_shift": request.requester_shift_id.name or "—",
            "target_shift": request.target_shift_id.name or "—",
            "reason": request.reason or "",
            "state": request.state,
            "is_requester": request.requester_id == employee,
            "can_accept": request.target_employee_id == employee and request.state == "requested",
            "can_cancel": request.requester_id == employee and request.state in ("draft", "requested"),
        } for request in requests]

    @api.constrains("requester_id", "target_employee_id", "requester_shift_id", "target_shift_id")
    def _check_company_integrity(self):
        for record in self:
            req_emp = record.requester_id.sudo()
            target_emp = record.target_employee_id.sudo()
            if req_emp and target_emp:
                if req_emp.company_id != target_emp.company_id:
                    raise ValidationError(_("Requester and target employee must belong to the same company."))
            if record.requester_shift_id and req_emp:
                if record.requester_shift_id.company_id != req_emp.company_id:
                    raise ValidationError(_("Requester shift must belong to the requester's company."))
            if record.target_shift_id and req_emp:
                if record.target_shift_id.company_id != req_emp.company_id:
                    raise ValidationError(_("Target shift must belong to the requester's company."))

    @api.constrains("swap_date", "state")
    def _check_swap_date(self):
        today = fields.Date.context_today(self)
        if any(record.swap_date < today and record.state == "draft" for record in self):
            raise ValidationError(_("Shift swap date cannot be in the past."))

    @api.constrains("requester_id", "target_employee_id", "swap_date", "state")
    def _check_no_duplicate_active_swaps(self):
        for record in self.filtered(lambda r: r.state in ("requested", "peer_accepted", "approved")):
            domain = [
                ("id", "!=", record.id),
                ("swap_date", "=", record.swap_date),
                ("state", "in", ("requested", "peer_accepted", "approved")),
                "|", "|",
                ("requester_id", "=", record.requester_id.id),
                ("target_employee_id", "=", record.requester_id.id),
                "|",
                ("requester_id", "=", record.target_employee_id.id),
                ("target_employee_id", "=", record.target_employee_id.id),
            ]
            if self.search_count(domain):
                raise ValidationError(_("An active shift swap request already exists for employee(s) on %s.") % record.swap_date)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            self._check_workflow_protection(vals)
            if vals.get("name", "New") == "New":
                vals["name"] = self.env["ir.sequence"].next_by_code("cleon.shift.swap.request") or _("SWAP/%s") % fields.Date.today().year
        return super().create(vals_list)

    def write(self, vals):
        self._check_workflow_protection(vals)
        return super().write(vals)

    def _check_workflow_protection(self, vals):
        if self.env.su or self.env.user.has_group("base.group_system"):
            return
        if "state" in vals:
            raise AccessError(_("Direct shift swap state mutation is prohibited. Use workflow action methods instead."))
        protected_fields = {"manager_comment", "approver_id", "decision_at"}
        if protected_fields.intersection(vals.keys()):
            raise AccessError(_("Direct decision field mutation is prohibited. Use workflow action methods instead."))

    def _validate_date_not_past(self):
        today = fields.Date.context_today(self)
        for record in self:
            if record.swap_date < today:
                raise ValidationError(_("Cannot process a shift swap for a date in the past (%s).") % record.swap_date)

    def _audit(self, action, reason):
        for record in self:
            self.env["cleon.time.audit.log"].sudo().create({
                "employee_id": record.requester_id.id,
                "user_id": self.env.user.id,
                "action": action,
                "reason": reason,
                "company_id": record.company_id.id,
            })

    def action_submit(self):
        """Submit shift swap request to peer."""
        user = self.env.user
        Shift = self.env["cleon.hr.shift"]
        self._validate_date_not_past()
        for record in self:
            if record.state != "draft":
                raise ValidationError(_("Only draft shift swap requests can be submitted."))
            if record.requester_id.sudo().user_id != user and not self.env["cleon.time.policy"]._tm_can_configure():
                raise AccessError(_("You can only submit shift swap requests for yourself."))

            # Auto-detect current shifts if not set
            if not record.requester_shift_id:
                exp1 = Shift._get_expected_working_hours_internal(record.requester_id.id, record.swap_date)
                if exp1 and exp1.get("shift_id"):
                    record.requester_shift_id = exp1["shift_id"]
            if not record.target_shift_id:
                exp2 = Shift._get_expected_working_hours_internal(record.target_employee_id.id, record.swap_date)
                if exp2 and exp2.get("shift_id"):
                    record.target_shift_id = exp2["shift_id"]

            if not record.requester_shift_id or not record.target_shift_id:
                raise ValidationError(_("Both requester shift and target shift must be defined for a shift swap."))

            record.sudo().write({"state": "requested"})
            record._audit("submitted", _("Shift swap requested with %s for date %s") % (record.target_employee_id.name, record.swap_date))
        return True

    def action_peer_accept(self):
        """Target employee accepts the shift swap request."""
        user = self.env.user
        self._validate_date_not_past()
        for record in self:
            if record.state != "requested":
                raise ValidationError(_("Only requested shift swaps can be peer accepted."))
            if record.target_employee_id.sudo().user_id != user and not self.env["cleon.time.policy"]._tm_can_configure():
                raise AccessError(_("Only the target employee (%s) can accept this shift swap.") % record.target_employee_id.name)
            if not record.requester_shift_id or not record.target_shift_id:
                raise ValidationError(_("Both requester shift and target shift must be defined for a shift swap."))

            record.sudo().write({"state": "peer_accepted"})
            record._audit("accepted", _("Shift swap accepted by peer %s") % record.target_employee_id.name)
        return True

    def action_approve(self):
        """Line Manager approves the shift swap request after peer acceptance."""
        user = self.env.user
        Policy = self.env["cleon.time.policy"]
        Assignment = self.env["cleon.hr.shift.assignment"].sudo()
        self._validate_date_not_past()
        for record in self:
            if record.state != "peer_accepted":
                raise ValidationError(_("Shift swap request must be accepted by the target peer (%s) before manager approval.") % record.target_employee_id.name)
            if not Policy._tm_can_approve(record, user):
                raise AccessError(_("You are not authorized to approve this shift swap request (self-approval or participating line manager approval is denied)."))
            if not record.requester_shift_id or not record.target_shift_id:
                raise ValidationError(_("Both requester shift and target shift must be defined for a shift swap."))

            record.sudo().write({"state": "approved", "approver_id": user.id, "decision_at": fields.Datetime.now()})

            # Create 1-day temporary shift overrides for both employees on swap_date
            Assignment.create({
                "shift_id": record.target_shift_id.id,
                "employee_id": record.requester_id.id,
                "date_from": record.swap_date,
                "date_to": record.swap_date,
                "assignment_type": "temporary",
                "note": _("Shift swap with %s (%s)") % (record.target_employee_id.name, record.name),
            })
            Assignment.create({
                "shift_id": record.requester_shift_id.id,
                "employee_id": record.target_employee_id.id,
                "date_from": record.swap_date,
                "date_to": record.swap_date,
                "assignment_type": "temporary",
                "note": _("Shift swap with %s (%s)") % (record.requester_id.name, record.name),
            })

            record._audit("approved", _("Shift swap approved by manager for %s") % record.swap_date)
        return True

    def action_cancel(self):
        """Requester cancels draft or requested swap request."""
        user = self.env.user
        for record in self:
            if record.state not in ("draft", "requested"):
                raise ValidationError(_("Only draft or requested shift swaps can be cancelled."))
            if record.requester_id.sudo().user_id != user and not self.env["cleon.time.policy"]._tm_can_configure():
                raise AccessError(_("Only the requester can cancel this swap request."))
            record.sudo().write({"state": "rejected"})
            record._audit("rejected", _("Shift swap cancelled by requester."))
        return True

    def action_peer_decline(self, reason=False):
        """Target employee declines requested swap request."""
        user = self.env.user
        for record in self:
            if record.state != "requested":
                raise ValidationError(_("Only requested shift swaps can be declined."))
            if record.target_employee_id.sudo().user_id != user and not self.env["cleon.time.policy"]._tm_can_configure():
                raise AccessError(_("Only the target employee can decline this swap request."))
            record.sudo().write({"state": "rejected"})
            record._audit("rejected", reason or _("Shift swap declined by target peer."))
        return True

    def action_reject(self, reason=False):
        """Manager or HR rejects shift swap request."""
        user = self.env.user
        Policy = self.env["cleon.time.policy"]
        for record in self:
            if not Policy._tm_can_approve(record, user):
                raise AccessError(_("You are not authorized to reject this shift swap request."))
            record.sudo().write({
                "state": "rejected",
                "manager_comment": reason or False,
                "approver_id": user.id,
                "decision_at": fields.Datetime.now(),
            })
            record._audit("rejected", reason or _("Shift swap rejected by manager."))
        return True
