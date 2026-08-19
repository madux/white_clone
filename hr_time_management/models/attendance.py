import calendar
from datetime import datetime, time, timedelta
import ipaddress
import math
import pytz

from odoo import api, fields, models, tools, _
from odoo.exceptions import AccessError, UserError, ValidationError


class HrAttendance(models.Model):
    _inherit = "hr.attendance"

    cleon_shift_id = fields.Many2one("cleon.hr.shift", string="Shift")
    cleon_break_minutes = fields.Integer(string="Break Duration", default=0)
    cleon_status_override = fields.Selection([
        ("present", "Present"), ("late", "Late"),
        ("half_day", "Half-day"), ("absent", "Absent"), ("on_leave", "On Leave"),
    ], string="Status Override")
    cleon_edit_reason = fields.Text(string="Last Edit Reason", readonly=True)
    in_latitude = fields.Float(string="In Latitude", digits=(10, 7))
    in_longitude = fields.Float(string="In Longitude", digits=(10, 7))
    out_latitude = fields.Float(string="Out Latitude", digits=(10, 7))
    out_longitude = fields.Float(string="Out Longitude", digits=(10, 7))
    in_accuracy = fields.Float(string="In Accuracy (m)")
    out_accuracy = fields.Float(string="Out Accuracy (m)")
    in_distance_meters = fields.Float(string="In Distance (m)")
    out_distance_meters = fields.Float(string="Out Distance (m)")
    in_mode = fields.Selection(selection_add=[
        ("biometric", "Biometric Terminal"),
        ("browser_gps", "Browser GPS"),
    ], ondelete={"biometric": "set null", "browser_gps": "set null"})
    out_mode = fields.Selection(selection_add=[
        ("biometric", "Biometric Terminal"),
        ("browser_gps", "Browser GPS"),
    ], ondelete={"biometric": "set null", "browser_gps": "set null"})

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

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if "check_in" in vals and vals["check_in"]:
                emp = self.env["hr.employee"].browse(vals.get("employee_id")).exists()
                c_id = emp.company_id if emp else self.env.company
                tz = self._tz_for_employee(emp, vals["check_in"])
                local_date = pytz.UTC.localize(fields.Datetime.to_datetime(vals["check_in"])).astimezone(tz).date()
                self.env["cleon.time.period.lock"].check_period_lock(c_id, local_date, _("Attendance"))
        return super().create(vals_list)

    def write(self, vals):
        if not self.env.su and not self.env.user.has_group("base.group_system"):
            for rec in self:
                c_id = rec.company_id or rec.employee_id.company_id
                target_dt = vals.get("check_in") or rec.check_in
                if target_dt:
                    tz = self._tz_for_employee(rec.employee_id, target_dt)
                    local_date = pytz.UTC.localize(fields.Datetime.to_datetime(target_dt)).astimezone(tz).date()
                    self.env["cleon.time.period.lock"].check_period_lock(c_id, local_date, _("Attendance"), vals.get("cleon_edit_reason"))
        return super().write(vals)

    def unlink(self):
        if not self.env.su and not self.env.user.has_group("base.group_system"):
            for rec in self:
                c_id = rec.company_id or rec.employee_id.company_id
                if rec.check_in:
                    tz = self._tz_for_employee(rec.employee_id, rec.check_in)
                    local_date = pytz.UTC.localize(rec.check_in).astimezone(tz).date()
                    self.env["cleon.time.period.lock"].check_period_lock(c_id, local_date, _("Attendance"))
        return super().unlink()

    @api.model
    def _tz_for_employee(self, employee, target_date=None):
        """Central schedule-aware timezone resolver with precedence:
        1. Applicable shift / resource calendar timezone on target_date
        2. Employee user_id.tz
        3. Company partner / resource calendar timezone
        4. UTC
        """
        if not employee:
            return pytz.UTC
        t_date = fields.Date.to_date(target_date) if target_date else fields.Date.context_today(self)
        Shift = self.env["cleon.hr.shift"]
        exp = Shift._get_expected_working_hours_internal(employee.id, t_date)
        if exp and exp.get("shift_id"):
            shift = Shift.browse(exp["shift_id"])
            if shift.resource_calendar_id and shift.resource_calendar_id.tz:
                return pytz.timezone(shift.resource_calendar_id.tz)
        if employee.resource_calendar_id and employee.resource_calendar_id.tz:
            return pytz.timezone(employee.resource_calendar_id.tz)
        if employee.sudo().user_id and employee.sudo().user_id.tz:
            return pytz.timezone(employee.sudo().user_id.tz)
        company = employee.company_id or self.env.company
        if company.partner_id and company.partner_id.tz:
            return pytz.timezone(company.partner_id.tz)
        return pytz.UTC

    @api.model
    def _calculate_haversine_distance(self, lat1, lon1, lat2, lon2):
        """Haversine formula calculating distance in meters between two lat/lon points."""
        R = 6371000.0  # Earth radius in meters
        phi1 = math.radians(lat1)
        phi2 = math.radians(lat2)
        delta_phi = math.radians(lat2 - lat1)
        delta_lambda = math.radians(lon2 - lon1)
        a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
        c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
        return R * c

    @api.model
    def _work_date_for_punch(self, employee, punch_datetime):
        """Derive the authoritative work date for a punch timestamp using actual schedule boundaries and open attendance state."""
        if not employee or not punch_datetime:
            return fields.Date.context_today(self)
        p_dt = fields.Datetime.to_datetime(punch_datetime)
        tz = self._tz_for_employee(employee, p_dt)
        local_dt = pytz.UTC.localize(p_dt).astimezone(tz)
        local_date = local_dt.date()

        # 1. If employee has an open attendance (currently checked in), anchor work date to open attendance's check-in
        open_att = self.sudo().search([
            ("employee_id", "=", employee.id),
            ("check_out", "=", False),
        ], order="check_in desc", limit=1)
        if open_att and open_att.check_in:
            open_dt = fields.Datetime.to_datetime(open_att.check_in)
            open_tz = self._tz_for_employee(employee, open_dt)
            if open_dt.tzinfo is None:
                open_dt = pytz.UTC.localize(open_dt)
            return open_dt.astimezone(open_tz).date()

        # 2. If employee is checked out (initiating a new clock-in), check previous calendar day's overnight shift
        prev_date = local_date - timedelta(days=1)
        Shift = self.env["cleon.hr.shift"]
        exp_prev = Shift._get_expected_working_hours_internal(employee.id, prev_date)
        if exp_prev and not exp_prev.get("is_rest_day"):
            start_h = exp_prev.get("start_hour", 0.0)
            end_h = exp_prev.get("end_hour", 0.0)
            # Overnight shift (start > end or overnight flag)
            if start_h > end_h or exp_prev.get("is_night"):
                start_hours = int(start_h)
                start_mins = int(round((start_h - start_hours) * 60))
                prev_start_dt = tz.localize(datetime.combine(prev_date, time(start_hours, start_mins)))

                end_hours = int(end_h) % 24
                end_mins = int(round((end_h - int(end_h)) * 60))
                prev_end_dt = tz.localize(datetime.combine(local_date, time(end_hours, end_mins)))

                # For a new clock-in, only associate with previous date if local_dt is strictly before scheduled shift end
                if prev_start_dt <= local_dt < prev_end_dt:
                    return prev_date

        return local_date

    @api.model
    def _verify_clock_policy(self, policy, punch_type="browser", latitude=None, longitude=None, accuracy=None, client_ip=None, device=None):
        """Central fail-closed clock policy engine evaluating ingress type, GPS, CIDR IP Whitelist, and Device Source IP rules."""
        if not policy:
            return True, 0.0, 0.0

        method = policy.clock_method

        # 1. Ingress method restriction
        if method == "biometric" and punch_type != "biometric":
            raise AccessError(_("Company policy requires attendance clocking via an authenticated biometric terminal."))

        # 2. Biometric terminal source IP check (rejects both missing source IP and mismatched source IP)
        if punch_type == "biometric" and device and device.ip_address and device.ip_address.strip():
            if not client_ip or client_ip.strip() != device.ip_address.strip():
                raise AccessError(_("Biometric punch denied: Request source IP %s does not match registered terminal IP %s.") % (client_ip or "N/A", device.ip_address))

        if method == "manual":
            return True, 0.0, 0.0

        gps_valid = False
        dist_meters = 0.0
        acc_val = float(accuracy) if accuracy is not None and accuracy != "" else False

        # 3. Evaluate GPS requirement
        if latitude is not None and longitude is not None and latitude != "" and longitude != "":
            if acc_val is False:
                if method == "gps" or (method == "mixed" and latitude is not None):
                    raise UserError(_("Location fix accuracy is required for GPS attendance verification."))
            acc_val = float(acc_val or 0.0)

            try:
                lat = float(latitude)
                lon = float(longitude)
            except (ValueError, TypeError):
                if method == "gps":
                    raise UserError(_("Invalid GPS coordinates received."))
                lat, lon = None, None

            if lat is not None and lon is not None:
                if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lon <= 180.0):
                    if method == "gps":
                        raise ValidationError(_("GPS coordinates out of valid geographic range."))
                else:
                    office_lat = policy.office_latitude
                    office_lon = policy.office_longitude
                    radius = policy.gps_radius_meters or 0.0

                    if not office_lat and not office_lon and radius <= 0:
                        if method == "gps":
                            raise AccessError(_("Company GPS attendance policy is misconfigured (office location/radius not set). Contact HR administrator."))
                    else:
                        dist_meters = self._calculate_haversine_distance(lat, lon, office_lat, office_lon)
                        allowed_radius = radius or 200.0
                        if acc_val > 500.0:
                            if method == "gps":
                                raise AccessError(_("GPS fix accuracy (%.0fm) is too inaccurate (maximum allowed: 500m).") % acc_val)
                        elif dist_meters <= allowed_radius:
                            gps_valid = True
                        elif method == "gps":
                            raise AccessError(_("GPS verification failed: You are %.1fm away from office location (maximum allowed: %.0fm).") % (
                                dist_meters, allowed_radius
                            ))
        elif method == "gps":
            raise UserError(_("Location permission and GPS coordinates are required to clock in under your company attendance policy."))

        # 4. Evaluate IP Whitelist requirement with CIDR support
        ip_valid = False
        if client_ip and policy.ip_whitelist and policy.ip_whitelist.strip():
            try:
                c_ip = ipaddress.ip_address(client_ip)
                raw_entries = [ip.strip() for ip in policy.ip_whitelist.replace("\n", ",").split(",") if ip.strip()]
                for entry in raw_entries:
                    try:
                        net = ipaddress.ip_network(entry, strict=False)
                        if c_ip in net:
                            ip_valid = True
                            break
                    except ValueError:
                        continue
            except ValueError:
                pass

        if method == "ip" and not ip_valid:
            raise AccessError(_("Clock operation denied: Client IP %s is not in the authorized company IP whitelist.") % (client_ip or "unknown"))

        # 5. Evaluate Mixed mode (GPS OR IP OR Biometric required)
        if method == "mixed":
            if not gps_valid and not ip_valid and punch_type != "biometric":
                raise AccessError(_("Clock operation denied: Neither valid GPS location nor authorized company IP whitelist match was satisfied."))

        return True, dist_meters, float(acc_val or 0.0)

    @api.model
    def _verify_gps_location(self, policy, latitude, longitude, accuracy=None):
        """Helper method delegating to _verify_clock_policy."""
        _valid, dist_meters, _acc = self._verify_clock_policy(policy, punch_type="browser", latitude=latitude, longitude=longitude, accuracy=accuracy or 10.0, client_ip=None)
        return _valid, dist_meters

    @api.model
    def _verify_ip_address(self, policy):
        """Helper method delegating to _verify_clock_policy."""
        client_ip = False
        if hasattr(self.env, "request") and self.env.request:
            req = self.env.request.httprequest
            if tools.config.get("proxy_mode") and "X-Forwarded-For" in req.headers:
                client_ip = req.headers["X-Forwarded-For"].split(",")[0].strip()
            else:
                client_ip = req.remote_addr
        _valid, _dist, _acc = self._verify_clock_policy(policy, punch_type="browser", latitude=None, longitude=None, accuracy=None, client_ip=client_ip or "127.0.0.1")
        return _valid

    @api.model
    def _cleon_attendance_punch_service(self, employee, punch_type="browser", latitude=None, longitude=None, accuracy=None, device=None, event_id=None, timestamp=None):
        """Unified Attendance Punch Service for browser and biometric hardware ingress."""
        if not employee:
            raise UserError(_("Employee record is required for attendance clocking."))

        company = employee.company_id or self.env.company
        server_now = fields.Datetime.now()
        punch_dt = fields.Datetime.to_datetime(timestamp) if timestamp else server_now

        # Skew validation for biometric terminal punches
        if punch_type == "biometric":
            skew_seconds = abs((server_now - punch_dt).total_seconds())
            if skew_seconds > 900:  # 15 minutes
                raise ValidationError(_("Biometric punch timestamp skew (%.1f mins) exceeds maximum tolerance (15 mins).") % (skew_seconds / 60.0))

        # Timezone & Work date resolution & Period lock verification
        local_date = self._work_date_for_punch(employee, punch_dt)
        self.env["cleon.time.period.lock"].check_period_lock(company, local_date, _("Attendance Clocking"))

        # Policy validation
        policy = self.env["cleon.time.policy"].search([("company_id", "=", company.id)], limit=1)
        client_ip = False
        if hasattr(self.env, "request") and self.env.request:
            req = self.env.request.httprequest
            if tools.config.get("proxy_mode") and "X-Forwarded-For" in req.headers:
                client_ip = req.headers["X-Forwarded-For"].split(",")[0].strip()
            else:
                client_ip = req.remote_addr

        _valid, dist_meters, acc_val = self._verify_clock_policy(policy, punch_type, latitude, longitude, accuracy, client_ip, device)

        # Clock action change
        previous_state = employee.attendance_state
        attendance = employee.sudo()._attendance_action_change()

        lat_val = float(latitude) if latitude is not None and latitude != "" else False
        lon_val = float(longitude) if longitude is not None and longitude != "" else False
        mode_str = "biometric" if punch_type == "biometric" else ("browser_gps" if policy and policy.clock_method in ("gps", "mixed") else "manual")

        if previous_state == "checked_out":
            _expected, _grace, shift = self._expected_start(employee, local_date)
            vals = {
                "cleon_shift_id": shift.id if shift else False,
                "cleon_break_minutes": shift.break_minutes if shift else (policy.default_break_minutes if policy else 0),
                "in_mode": mode_str,
            }
            if lat_val and lon_val:
                vals.update({"in_latitude": lat_val, "in_longitude": lon_val, "in_accuracy": acc_val, "in_distance_meters": dist_meters})
            attendance.sudo().write(vals)
        else:
            vals = {"out_mode": mode_str}
            if lat_val and lon_val:
                vals.update({"out_latitude": lat_val, "out_longitude": lon_val, "out_accuracy": acc_val, "out_distance_meters": dist_meters})
            attendance.sudo().write(vals)

        action = "created" if previous_state == "checked_out" else "modified"
        reason_msg = _("Employee clock in") if action == "created" else _("Employee clock out")
        if punch_type == "biometric":
            # SANITIZED: Log device ID and name, NEVER device_key secret!
            dev_name = device.name if device else "N/A"
            dev_id = device.id if device else "N/A"
            reason_msg = _("Biometric hardware punch (device_id:%s, device_name:%s, event_id:%s)") % (dev_id, dev_name, event_id or "N/A")
        elif lat_val and lon_val:
            reason_msg += _(" (GPS: %.4f, %.4f, dist: %.1fm)") % (lat_val, lon_val, dist_meters)

        self.env["cleon.time.audit.log"].sudo().create({
            "attendance_id": attendance.id, "employee_id": employee.id, "user_id": self.env.user.id,
            "action": action, "reason": reason_msg, "details": reason_msg,
            "after_values": {
                "check_in": fields.Datetime.to_string(attendance.check_in),
                "check_out": fields.Datetime.to_string(attendance.check_out) if attendance.check_out else False,
                "latitude": lat_val, "longitude": lon_val, "accuracy": acc_val, "distance_meters": dist_meters,
            },
            "company_id": company.id,
        })

        if punch_type == "biometric":
            return {
                "status": "success",
                "attendance_id": attendance.id,
                "employee": employee.name,
                "action": "clock_in" if previous_state == "checked_out" else "clock_out",
                "timestamp": fields.Datetime.to_string(punch_dt),
            }

        return self.get_cleon_employee_data()

    @api.model
    def cleon_toggle_attendance(self, latitude=None, longitude=None, accuracy=None):
        employee = self.env.user.employee_id
        if not employee:
            raise UserError(_("Your user account is not linked to an employee record."))
        return self._cleon_attendance_punch_service(employee=employee, punch_type="browser", latitude=latitude, longitude=longitude, accuracy=accuracy)

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
        Shift = self.env["cleon.hr.shift"]
        exp = Shift._get_expected_working_hours_internal(employee.id, target_date)
        if exp:
            if exp.get("is_rest_day"):
                return False, 0, Shift
            if exp.get("shift_id"):
                shift = Shift.browse(exp["shift_id"])
                start_hour = exp.get("start_hour", shift.start_hour)
                return start_hour, shift.grace_minutes, shift
        calendar = employee.resource_calendar_id
        lines = calendar.attendance_ids.filtered(lambda line: int(line.dayofweek) == target_date.weekday() and line.day_period != "lunch")
        policy = self.env["cleon.time.policy"].search([
            ("company_id", "=", employee.company_id.id),
        ], limit=1)
        return (
            min(lines.mapped("hour_from")) if lines else 9.0,
            policy.default_grace_minutes if policy else 0,
            Shift,
        )

    @api.model
    def _status_for(self, attendance, employee, target_date):
        """Return independent attendance facts using timezone-aware DATETIME night shift math and rest-day absence exclusion:
        (is_late, late_by, is_early_exit, early_exit_by, is_half_day, summary_status).
        """
        expected_start, grace, assigned_shift = self._expected_start(employee, target_date)
        shift = attendance.cleon_shift_id if attendance and attendance.cleon_shift_id else assigned_shift
        if shift and hasattr(shift, "start_hour") and shift.start_hour is not False and shift.id:
            expected_start = shift.start_hour
            grace = shift.grace_minutes if hasattr(shift, "grace_minutes") else grace

        tz = self._tz_for_employee(employee, target_date)

        if attendance and attendance.cleon_status_override:
            override = attendance.cleon_status_override
            return override == "late", 0, False, 0, override == "half_day", override

        # Rest day semantics
        if expected_start is False:
            if not attendance:
                return False, 0, False, 0, False, "rest_day"
            else:
                return False, 0, False, 0, False, "rest_day_worked"

        if not attendance:
            return False, 0, False, 0, False, "absent"

        # Timezone-aware DATETIME night shift comparison
        local_check_in = pytz.UTC.localize(attendance.check_in).astimezone(tz)
        start_hour_int = int(expected_start)
        start_min_int = int(round((expected_start - start_hour_int) * 60))
        expected_in_dt = tz.localize(datetime.combine(target_date, time(hour=start_hour_int, minute=start_min_int))) + timedelta(minutes=grace)

        is_late = False
        late_by = 0
        if expected_start is not False:
            if local_check_in > expected_in_dt:
                late_by = int(round((local_check_in - expected_in_dt).total_seconds() / 60.0))
                is_late = bool(late_by > 0)

        is_early_exit = False
        early_exit_by = 0
        if attendance.check_out:
            local_check_out = pytz.UTC.localize(attendance.check_out).astimezone(tz)
            Shift = self.env["cleon.hr.shift"]
            exp = Shift._get_expected_working_hours_internal(employee.id, target_date)
            end_hour = exp.get("end_hour") if exp and exp.get("end_hour") is not None else (shift.end_hour if shift and hasattr(shift, "end_hour") and shift.end_hour else (expected_start + 8.0 if expected_start is not False else 17.0))
            end_hour_int = int(end_hour) % 24
            end_min_int = int(round((end_hour - int(end_hour)) * 60))
            end_date = target_date + timedelta(days=1) if end_hour < expected_start else target_date
            expected_out_dt = tz.localize(datetime.combine(end_date, time(hour=end_hour_int, minute=end_min_int))) - timedelta(minutes=grace)
            if local_check_out < expected_out_dt:
                early_exit_by = int(round((expected_out_dt - local_check_out).total_seconds() / 60.0))
                is_early_exit = bool(early_exit_by > 0)

        integration = self._time_integration_values(attendance, employee, target_date, shift)
        is_half_day = False
        if attendance.check_out and integration["expected_hours"] > 0:
            if integration["net_hours"] < integration["expected_hours"] / 2.0:
                is_half_day = True

        if is_half_day:
            summary = "half_day"
        elif is_late and is_early_exit:
            summary = "late_and_early"
        elif is_late:
            summary = "late"
        elif is_early_exit:
            summary = "early_exit"
        else:
            summary = "present"

        return is_late, late_by, is_early_exit, early_exit_by, is_half_day, summary

    @api.model
    def _time_integration_values(self, attendance, employee, target_date, shift=False):
        """Return normalized integration view consuming Shift expected working hours service for split/night shifts."""
        policy = self.env["cleon.time.policy"].search([("company_id", "=", employee.company_id.id)], limit=1)
        Shift = self.env["cleon.hr.shift"]
        exp = Shift._get_expected_working_hours_internal(employee.id, target_date)
        expected_hours = exp.get("expected_hours", policy.standard_hours if policy else 8.0) if exp else (policy.standard_hours if policy else 8.0)

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
        is_late, late_by, is_early_exit, early_exit_by, is_half_day, status = self._status_for(attendance, employee, target_date)
        if on_leave and not attendance:
            status = "on_leave"
        shift = attendance.cleon_shift_id if attendance and attendance.cleon_shift_id else assigned_shift
        hours = max(0.0, (attendance.worked_hours if attendance else 0.0) - ((attendance.cleon_break_minutes if attendance else 0) / 60.0))
        row = {
            "id": attendance.id if attendance else 0,
            "employee_id": employee.id,
            "employee": employee.name,
            "employee_code": employee.sudo().barcode or "EMP-%03d" % employee.id,
            "department": employee.department_id.name or "—",
            "date": fields.Date.to_string(target_date),
            "check_in": self._display_time(attendance.check_in) if attendance else "",
            "check_out": self._display_time(attendance.check_out) if attendance else "",
            "check_in_raw": fields.Datetime.to_string(attendance.check_in) if attendance else "",
            "check_out_raw": fields.Datetime.to_string(attendance.check_out) if attendance and attendance.check_out else "",
            "shift": shift.name if shift else "Day Shift (%s)" % (int(expected) if expected is not False else "Off"),
            "shift_id": shift.id if shift else False,
            "status": status,
            "is_late": is_late,
            "late_by": late_by,
            "is_early_exit": is_early_exit,
            "early_exit_by": early_exit_by,
            "is_half_day": is_half_day,
            "is_on_leave": on_leave,
            "is_rest_day": expected is False,
            "source": dict(self._fields["in_mode"].selection).get(attendance.in_mode, "Manual") if attendance else "—",
            "break_minutes": attendance.cleon_break_minutes if attendance else 0,
            "hours": round(hours, 2),
            "in_latitude": attendance.in_latitude if attendance else False,
            "in_longitude": attendance.in_longitude if attendance else False,
            "in_accuracy": attendance.in_accuracy if attendance else 0.0,
            "in_distance_meters": attendance.in_distance_meters if attendance else 0.0,
        }
        row.update(self._time_integration_values(attendance, employee, target_date, shift))
        return row

    @api.model
    def get_cleon_time_data(self, view="dashboard", date_from=False, date_to=False, department_id=False, search=""):
        Policy = self.env["cleon.time.policy"]
        role = Policy._tm_role()
        if role not in ("line_manager", "hr_manager", "hr_admin", "system_admin"):
            raise AccessError(_("Only a Time Management manager or administrator can view organization attendance."))
        today = fields.Date.context_today(self)
        start_date = fields.Date.to_date(date_from) if date_from else today
        end_date = fields.Date.to_date(date_to) if date_to else start_date
        allowed_emp_ids = Policy._tm_scope_employee_ids()
        employee_domain = [("company_id", "=", self.env.company.id), ("active", "=", True), ("id", "in", allowed_emp_ids)]
        if department_id:
            employee_domain.append(("department_id", "=", int(department_id)))
        if search:
            employee_domain.append(("name", "ilike", search))
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
        
        # Build date-aware leave set: (employee_id, date)
        leave_days = set()
        for leave in leave_records:
            l_start = max(leave.request_date_from, start_date)
            l_end = min(leave.request_date_to, end_date)
            curr = l_start
            while curr <= l_end:
                leave_days.add((leave.employee_id.id, curr))
                curr += timedelta(days=1)

        rows = []
        if view == "dashboard" or start_date == end_date:
            by_employee = {}
            for attendance in attendances:
                by_employee.setdefault(attendance.employee_id.id, attendance)
            rows = [self._row(emp, by_employee.get(emp.id), start_date, (emp.id, start_date) in leave_days) for emp in employees]
        else:
            # Multi-day view: build matrix for every employee x date in date range
            num_days = (end_date - start_date).days + 1
            date_list = [start_date + timedelta(days=i) for i in range(num_days)]
            att_map = {}
            for att in attendances:
                w_date = self._work_date_for_punch(att.employee_id, att.check_in)
                att_map.setdefault((att.employee_id.id, w_date), att)
            for d in date_list:
                for emp in employees:
                    att = att_map.get((emp.id, d))
                    on_leave = (emp.id, d) in leave_days
                    rows.append(self._row(emp, att, d, on_leave=on_leave))

        counts = {key: len([row for row in rows if row["status"] == key]) for key in ("present", "late", "early_exit", "late_and_early", "half_day", "absent", "rest_day", "rest_day_worked", "on_leave")}
        
        # Scheduled attendance opportunities (excludes rest_day, rest_day_worked, on_leave)
        scheduled_rows = [r for r in rows if r["status"] in ("present", "late", "early_exit", "late_and_early", "half_day", "absent")]
        present_scheduled = len([r for r in scheduled_rows if r["status"] in ("present", "late", "early_exit", "late_and_early", "half_day")])
        attendance_rate = round((present_scheduled / len(scheduled_rows) * 100) if scheduled_rows else 0)

        return {
            "rows": rows,
            "counts": counts,
            "attendance_rate": attendance_rate,
            "departments": self.env["hr.department"].search_read([], ["name"], order="name"),
            "shifts": self.env["cleon.hr.shift"].search_read([("company_id", "=", self.env.company.id)], ["name"]),
        }

    def cleon_update_attendance(self, values, reason):
        self.ensure_one()
        Policy = self.env["cleon.time.policy"]
        if Policy._tm_role() not in ("hr_manager", "hr_admin", "system_admin"):
            raise AccessError(_("Only HR managers or System Admins can edit attendance records."))
        if not reason or not reason.strip():
            raise UserError(_("Please provide a reason for changing this attendance record."))

        c_id = self.company_id or self.employee_id.company_id
        if self.check_in:
            tz = self._tz_for_employee(self.employee_id, self.check_in)
            local_date = pytz.UTC.localize(self.check_in).astimezone(tz).date()
            self.env["cleon.time.period.lock"].check_period_lock(c_id, local_date, _("Attendance Record Edit"), reason)

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
        self.sudo().write(clean)
        after = {key: audit_value(key) for key in clean if key != "cleon_edit_reason"}
        self.env["cleon.time.audit.log"].sudo().create({
            "attendance_id": self.id, "employee_id": self.employee_id.id,
            "action": "modified", "reason": reason.strip(),
            "before_values": before, "after_values": after,
        })
        return True
