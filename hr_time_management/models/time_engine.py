"""Shared time interpretation. Operational apps supply sources, never formulas."""
from datetime import datetime, time, timedelta

import pytz

from odoo import api, fields, models
from odoo.tools.float_utils import float_round


class TimeEngine(models.AbstractModel):
    _name = "cleon.time.engine"
    _description = "Shared Time Calculation Engine"

    @api.model
    def _policy(self, employee, cache=None):
        company_id = employee.company_id.id
        policies = cache.setdefault("policies", {}) if cache is not None else {}
        if company_id not in policies:
            policies[company_id] = self.env["cleon.time.policy"].sudo().search(
                [("company_id", "=", company_id)], limit=1
            )
        return policies[company_id]

    @api.model
    def _prepare_schedule_cache(self, employees, start_date, end_date):
        """Optional schedule providers extend this with batched source records."""
        return {"policies": {}, "expected": {}}

    @api.model
    def _default_schedule(self, employee, target_date, cache=None):
        target_date = fields.Date.to_date(target_date)
        policy = self._policy(employee, cache)
        weekends = {int(day) for day in ((policy.weekend_days or "") if policy else "5,6").split(",") if day.strip().isdigit()}
        rest = target_date.weekday() in weekends
        hours = policy.standard_hours if policy else 8.0
        start = policy.default_start_hour if policy else 9.0
        breaks = policy.default_break_minutes if policy and policy.enable_break_period else 0
        start_dt = datetime.combine(target_date, time.min) + timedelta(hours=start)
        end_dt = start_dt + timedelta(hours=hours, minutes=breaks)
        return {
            "shift_id": False, "shift_name": "Default Working Pattern",
            "shift_code": False, "schedule_source": "working_pattern",
            "expected_hours": 0.0 if rest else hours, "is_rest_day": rest,
            "start_hour": start, "end_hour": (start + hours + breaks / 60.0) % 24,
            "start_datetime": start_dt, "end_datetime": end_dt,
            "break_minutes": breaks,
            "grace_minutes": policy.default_grace_minutes if policy else 0,
            "timezone": employee.resource_calendar_id.tz or employee.sudo().user_id.tz
                        or employee.company_id.partner_id.tz or "UTC",
        }

    @api.model
    def _expected_schedule(self, employee, target_date, cache=None):
        """Shift Management overrides this provider when a schedule is assigned."""
        return self._default_schedule(employee, target_date, cache)

    @api.model
    def _expected_hours_for_period(self, employee, date_from, date_to):
        start, end = fields.Date.to_date(date_from), fields.Date.to_date(date_to)
        cache = self._prepare_schedule_cache(employee, start, end)
        return sum(self._expected_schedule(employee, start + timedelta(days=n), cache)["expected_hours"]
                   for n in range((end - start).days + 1))

    @api.model
    def _timezone(self, employee, target_date, cache=None):
        schedule = self._expected_schedule(employee, fields.Date.to_date(target_date), cache)
        return pytz.timezone(schedule.get("timezone") or employee.resource_calendar_id.tz
                             or employee.sudo().user_id.tz or employee.company_id.partner_id.tz or "UTC")

    @api.model
    def _work_date(self, employee, value, cache=None):
        """Attribute a timestamp using the shared boundary and optional overnight schedule."""
        value = fields.Datetime.to_datetime(value)
        tz = self._timezone(employee, value.date(), cache)
        local = pytz.UTC.localize(value).astimezone(tz) if value.tzinfo is None else value.astimezone(tz)
        policy = self._policy(employee, cache)
        boundary = policy.workday_boundary_hour if policy else 0.0
        day = (local - timedelta(hours=boundary)).date()
        previous = local.date() - timedelta(days=1)
        schedule = self._expected_schedule(employee, previous, cache)
        if not schedule.get("is_rest_day") and schedule.get("start_hour", 0) > schedule.get("end_hour", 0):
            end = tz.localize(datetime.combine(local.date(), time.min) + timedelta(hours=schedule["end_hour"]))
            if local < end:
                return (datetime.combine(previous, time.min)
                        + timedelta(hours=schedule["start_hour"] - boundary)).date()
        return day

    @api.model
    def _day_context(self, employee, target_date, cache=None):
        target_date = fields.Date.to_date(target_date)
        schedule = self._expected_schedule(employee, target_date, cache)
        tz = self._timezone(employee, target_date, cache)
        start = tz.localize(datetime.combine(target_date, time.min)).astimezone(pytz.UTC).replace(tzinfo=None)
        end = tz.localize(datetime.combine(target_date + timedelta(days=1), time.min)).astimezone(pytz.UTC).replace(tzinfo=None)
        holiday = bool(employee.resource_calendar_id.global_leave_ids.filtered(
            lambda record: record.date_from < end and record.date_to > start
        ))
        return dict(schedule, is_holiday=holiday)

    @api.model
    def _overtime_terms(self, employee, target_date, weekly=False, cache=None):
        policy = self._policy(employee, cache)
        day = self._day_context(employee, target_date, cache)
        category = "weekly" if weekly else ("holiday" if day["is_holiday"] else "weekend" if day["is_rest_day"] else "daily")
        enabled = not policy or policy.enable_overtime
        if policy:
            enabled = enabled and policy[category + "_overtime_enabled" if category in ("daily", "weekly") else category + "_overtime"]
        rates = {"daily": 1.5, "weekly": 1.5, "weekend": 2.0, "holiday": 2.5}
        rate = policy[category + "_overtime_rate"] if policy else rates[category]
        return category, rate, bool(enabled)

    @api.model
    def _evaluate_day(self, employee, target_date, gross_hours, break_minutes=None,
                      approved_overtime=0.0, paid_leave=0.0, cache=None):
        """Return the same facts for attendance, tracked work and overtime consumers.

        Capture sources stay distinct. Calling this service never creates an
        attendance, a timesheet, or an approval request.
        """
        policy = self._policy(employee, cache)
        day = self._day_context(employee, target_date, cache)
        if break_minutes is None:
            break_minutes = (policy.default_break_minutes if policy and policy.enable_break_period
                             and gross_hours >= policy.half_day_hours else 0)
        worked = max(0.0, gross_hours - max(0.0, break_minutes) / 60.0)
        if policy and policy.enable_time_round_off and policy.round_off_interval:
            worked = float_round(worked, precision_rounding=policy.round_off_interval / 60.0)
        expected = 0.0 if day["is_holiday"] or day["is_rest_day"] else day["expected_hours"]
        extra = max(0.0, worked - expected)
        regular = min(worked, expected)
        category, rate, enabled = self._overtime_terms(employee, target_date, cache=cache)
        threshold = max(expected, policy.daily_overtime_threshold if policy else expected) if category == "daily" else 0.0
        qualifying = min(extra, max(0.0, worked - threshold)) if enabled else 0.0
        return {
            "expected_hours": round(expected, 4), "net_hours": round(worked, 4),
            "worked_hours": round(worked, 4), "regular_hours": round(regular, 4),
            "extra_hours": round(extra, 4), "undertime_hours": round(max(0.0, expected - worked), 4),
            "qualifying_overtime_hours": round(qualifying, 4), "overtime_hours": round(qualifying, 4),
            "overtime_category": category, "overtime_rate": rate,
            "is_weekend": day["is_rest_day"], "is_holiday": day["is_holiday"],
            "payroll_hours": round(regular + max(0.0, approved_overtime) + max(0.0, paid_leave), 4),
            "schedule_source": day.get("schedule_source", "working_pattern"),
        }

    @api.model
    def _qualifying_weekly_overtime(self, employee, regular_hours, cache=None):
        policy = self._policy(employee, cache)
        if policy and (not policy.enable_overtime or not policy.weekly_overtime_enabled):
            return 0.0
        return max(0.0, regular_hours - (policy.weekly_overtime_threshold if policy else 40.0))
