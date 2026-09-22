# -*- coding: utf-8 -*-
from collections import defaultdict
from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.exceptions import UserError
from datetime import datetime, timedelta
 
class resourceCalendarAttendance(models.Model):
    _inherit = "resource.calendar.attendance"

    today_week_per_day = fields.Float('Total hours (Per day)',
                                       store=True, 
                                       compute="compute_total_hours_per_day")
    overtime_hours = fields.Float(
        compute='_compute_overtime_hours',
        store=True
    )
    @api.depends('today_week_per_day')
    def _compute_overtime_hours(self):
        setup = self.env['hr.payroll.setup'].search([], limit=1)

        for rec in self:
            overtime_start = setup.overtime_after_hours or 8.0

            if rec.today_week_per_day > overtime_start:
                rec.overtime_hours = rec.today_week_per_day - overtime_start
            else:
                rec.overtime_hours = 0.0

    def get_hours_between_times(self, start_time, end_time):
        """starttime => 08:00 """
        fmt = "%H:%M"
        start_time, end_time = str(start_time), str(end_time)
        start_time = start_time.replace('.', ':')
        end_time = end_time.replace('.', ':')

        start = datetime.strptime(start_time, fmt)
        end = datetime.strptime(end_time, fmt)
        return (end - start).total_seconds() / 3600
    
    @api.depends('hour_from', 'hour_to')
    def compute_total_hours_per_day(self):
        for rec in self:
            try:
                rec.today_week_per_day = 0.0
                if rec.hour_from and rec.hour_to:
                    diff = self.get_hours_between_times(rec.hour_from, rec.hour_to)
                    rec.today_week_per_day = diff
            except Exception as e:
                raise UserError(f"Use error: {e}")