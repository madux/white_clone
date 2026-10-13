# -*- coding: utf-8 -*-
from datetime import datetime, timedelta

from odoo import api, fields, models


class DocDmsWorkingCalendarService(models.AbstractModel):
    _name = "doc.dms.working.calendar.service"
    _description = "Organisation working calendar (DMS General)"

    @api.model
    def default_working_weekdays(self):
        return [0, 1, 2, 3, 4]

    @api.model
    def parse_working_weekdays(self, raw):
        if not raw:
            return self.default_working_weekdays()
        values = []
        for part in str(raw).split(","):
            part = part.strip()
            if not part:
                continue
            try:
                day = int(part)
            except (TypeError, ValueError):
                continue
            if 0 <= day <= 6 and day not in values:
                values.append(day)
        return sorted(values) or self.default_working_weekdays()

    @api.model
    def get_working_weekdays(self, company):
        company = company or self.env.company
        return self.parse_working_weekdays(company.dms_working_weekdays)

    @api.model
    def is_public_holiday(self, check_date, company):
        if not check_date:
            return False
        Holiday = self.env["doc.dms.public.holiday"].sudo()
        return bool(
            Holiday.search_count(
                [
                    ("company_id", "=", company.id),
                    ("holiday_date", "=", check_date),
                ],
                limit=1,
            )
        )

    @api.model
    def is_working_day(self, check_date, company=None):
        company = company or self.env.company
        if not check_date:
            return False
        if isinstance(check_date, datetime):
            check_date = check_date.date()
        weekday = check_date.weekday()
        if weekday not in self.get_working_weekdays(company):
            return False
        if self.is_public_holiday(check_date, company):
            return False
        return True

    @api.model
    def add_working_days(self, start_dt, days, company=None):
        """Count working days after start (exclusive) using org calendar."""
        company = company or self.env.company
        if not start_dt:
            start_dt = fields.Datetime.now()
        days = max(1, min(int(days or 1), 366))
        cursor = fields.Datetime.to_datetime(start_dt)
        added = 0
        while added < days:
            cursor += timedelta(days=1)
            if self.is_working_day(cursor, company):
                added += 1
        return cursor

    @api.model
    def digest_time_parts(self, company):
        company = company or self.env.company
        raw = (company.dms_reminder_digest_time or "09:00").strip()
        try:
            hour_str, minute_str = raw.split(":", 1)
            hour = max(0, min(int(hour_str), 23))
            minute = max(0, min(int(minute_str), 59))
        except (TypeError, ValueError):
            hour, minute = 9, 0
        return hour, minute
