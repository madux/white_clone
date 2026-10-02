from datetime import date, datetime, time, timedelta
import logging
from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError

_logger = logging.getLogger(__name__)


class AttendanceOvertime(models.Model):
    _inherit = "cleon.overtime.request"

    attendance_id = fields.Many2one("hr.attendance", ondelete="set null", index=True)
    _sql_constraints = [
        ("attendance_unique", "unique(attendance_id)", "Overtime was already generated for this attendance record."),
    ]

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

            result = self.env["cleon.time.engine"]._evaluate_day(employee, w_date, gross_hours)
            total_net_hours = result["worked_hours"]
            earliest_in, latest_out = merged[0][0], merged[-1][1]
            valid_att_list = [interval[2] for interval in intervals]
            category, multiplier = result["overtime_category"], result["overtime_rate"]
            daily_ot_hours = result["qualifying_overtime_hours"]
            regular_hours = result["regular_hours"]

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

            total_week_regular = sum(rec[1] for rec in day_records)
            total_weekly_entitlement = self.env["cleon.time.engine"]._qualifying_weekly_overtime(employee, total_week_regular)

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
