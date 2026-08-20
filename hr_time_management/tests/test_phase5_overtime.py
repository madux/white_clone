# -*- coding: utf-8 -*-
from datetime import datetime, timedelta

from odoo import fields
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tests.common import TransactionCase


class TestPhase5Overtime(TransactionCase):

    def setUp(self):
        super().setUp()
        self.company = self.env.company
        self.company.write({"name": "Test Phase5 Company"})

        # Group refs
        self.group_user = self.env.ref("hr_time_management.group_time_management_user")
        self.group_line_mgr = self.env.ref("hr_time_management.group_time_management_line_manager")
        self.group_hr_mgr = self.env.ref("hr_time_management.group_time_management_hr_manager")
        self.group_hr_admin = self.env.ref("hr_time_management.group_time_management_hr_admin")

        # Line Manager User & Employee
        self.manager_user = self.env["res.users"].create({
            "name": "P5 Line Manager",
            "login": "p5_line_mgr",
            "email": "p5_mgr@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_line_mgr.id])],
        })
        self.manager_emp = self.env["hr.employee"].create({
            "name": "P5 Line Manager Emp",
            "user_id": self.manager_user.id,
            "company_id": self.company.id,
        })

        # Subordinate User & Employee
        self.emp_user = self.env["res.users"].create({
            "name": "P5 Subordinate User",
            "login": "p5_sub_user",
            "email": "p5_sub@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_user.id])],
        })
        self.sub_emp = self.env["hr.employee"].create({
            "name": "P5 Subordinate Emp",
            "user_id": self.emp_user.id,
            "parent_id": self.manager_emp.id,
            "company_id": self.company.id,
            "hourly_cost": 50.0,
        })

        # Unrelated Manager & Employee (Team B)
        self.mgr_b_user = self.env["res.users"].create({
            "name": "P5 Team B Manager",
            "login": "p5_mgr_b",
            "email": "p5_mgr_b@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_line_mgr.id])],
        })
        self.mgr_b_emp = self.env["hr.employee"].create({
            "name": "P5 Team B Manager Emp",
            "user_id": self.mgr_b_user.id,
            "company_id": self.company.id,
        })
        self.emp_b_user = self.env["res.users"].create({
            "name": "P5 Team B Subordinate User",
            "login": "p5_sub_b_user",
            "email": "p5_sub_b@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_user.id])],
        })
        self.sub_b_emp = self.env["hr.employee"].create({
            "name": "P5 Team B Subordinate Emp",
            "user_id": self.emp_b_user.id,
            "parent_id": self.mgr_b_emp.id,
            "company_id": self.company.id,
            "hourly_cost": 50.0,
        })

        # Standard Day Shift Assignment for sub_emp (09:00 - 17:00, Mon-Fri)
        self.shift = self.env["cleon.hr.shift"].create({
            "name": "P5 Standard Shift 09-17",
            "code": "P5STD0917",
            "shift_type": "fixed",
            "start_hour": 9.0,
            "end_hour": 17.0,
            "company_id": self.company.id,
        })
        self.sub_assignment = self.env["cleon.hr.shift.assignment"].create({
            "shift_id": self.shift.id,
            "employee_id": self.sub_emp.id,
            "date_from": "2026-08-01",
            "company_id": self.company.id,
        })
        self.env["cleon.hr.shift.assignment"].create({
            "shift_id": self.shift.id,
            "employee_id": self.sub_b_emp.id,
            "date_from": "2026-08-01",
            "company_id": self.company.id,
        })

        # Resource calendar for public holiday tests
        self.calendar = self.env["resource.calendar"].create({
            "name": "P5 Standard Calendar",
            "company_id": self.company.id,
            "tz": "UTC",
        })
        self.sub_emp.write({"resource_calendar_id": self.calendar.id})

        # Policy definition (search or create/update for company)
        self.policy = self.env["cleon.time.policy"].search([("company_id", "=", self.company.id)], limit=1)
        policy_vals = {
            "company_id": self.company.id,
            "standard_hours": 8.0,
            "daily_overtime_threshold": 8.0,
            "daily_overtime_rate": 1.5,
            "weekly_overtime_enabled": True,
            "weekly_overtime_threshold": 40.0,
            "weekly_overtime_rate": 2.0,
            "weekend_overtime": True,
            "weekend_overtime_rate": 2.0,
            "holiday_overtime": True,
            "holiday_overtime_rate": 2.5,
            "weekend_days": "5,6",
            "overtime_request_mode": "both",
        }
        if not self.policy:
            self.policy = self.env["cleon.time.policy"].create(policy_vals)
        else:
            self.policy.write(policy_vals)

    def test_01_overtime_calculation_daily_weekend_holiday_rates(self):
        """Test overtime estimation, public holiday calendar detection, and custom multipliers derived server-side."""
        self.policy.write({
            "daily_overtime_rate": 1.4,
            "weekend_overtime_rate": 1.75,
            "holiday_overtime_rate": 2.25,
        })
        today = fields.Date.today()
        holiday_date = today - timedelta(days=3)
        daily_date = today - timedelta(days=2)
        weekend_date = today - timedelta(days=1)

        # Add public holiday
        self.env["resource.calendar.leaves"].create({
            "name": "Summer National Holiday",
            "calendar_id": self.calendar.id,
            "date_from": datetime.combine(holiday_date, datetime.min.time()),
            "date_to": datetime.combine(holiday_date, datetime.max.time()),
        })

        Overtime = self.env["cleon.overtime.request"]

        # 1. Public Holiday -> Server derives category 'holiday' and 2.25x multiplier
        ot_holiday = Overtime.with_user(self.emp_user).submit_manual_request({
            "date": fields.Date.to_string(holiday_date),
            "start_time": "%s 09:00:00" % holiday_date,
            "end_time": "%s 13:00:00" % holiday_date,
            "justification": "Emergency holiday shift coverage for system release",
        })
        rec_holiday = Overtime.sudo().browse(ot_holiday["id"])
        self.assertEqual(rec_holiday.category, "holiday")
        self.assertEqual(rec_holiday.multiplier, 2.25)
        self.assertEqual(rec_holiday.estimated_cost, 4.0 * 2.25 * 50.0)

        # 2. Regular weekday -> Server derives 'daily' and 1.4x multiplier
        ot_daily = Overtime.with_user(self.emp_user).submit_manual_request({
            "date": fields.Date.to_string(daily_date),
            "start_time": "%s 17:00:00" % daily_date,
            "end_time": "%s 19:00:00" % daily_date,
            "justification": "Extensive project deadline completion required",
        })
        rec_daily = Overtime.sudo().browse(ot_daily["id"])
        self.assertEqual(rec_daily.category, "daily")
        self.assertEqual(rec_daily.multiplier, 1.4)

        # 3. Weekend day (Aug 9, 2026 is Sunday) -> Server derives 'weekend' and 1.75x multiplier
        ot_weekend = Overtime.with_user(self.emp_user).submit_manual_request({
            "date": "2026-08-09",
            "start_time": "2026-08-09 09:00:00",
            "end_time": "2026-08-09 13:00:00",
            "justification": "Emergency server maintenance on Sunday morning",
        })
        rec_weekend = Overtime.sudo().browse(ot_weekend["id"])
        self.assertEqual(rec_weekend.category, "weekend")
        self.assertEqual(rec_weekend.multiplier, 1.75)

    def test_02_weekend_and_holiday_work_hours_order(self):
        """Test 4h worked on Sunday or Public Holiday generates 3h net weekend/holiday OT (after 1h break) without subtracting 8h daily threshold."""
        # Add public holiday on Aug 5, 2026
        self.env["resource.calendar.leaves"].create({
            "name": "Mid-week Public Holiday",
            "calendar_id": self.calendar.id,
            "date_from": "2026-08-05 00:00:00",
            "date_to": "2026-08-05 23:59:59",
        })
        Attendance = self.env["hr.attendance"].sudo()

        # 4h worked on Public Holiday (Aug 5) -> 3h net worked
        att_hol = Attendance.create({
            "employee_id": self.sub_emp.id,
            "check_in": "2026-08-05 09:00:00",
            "check_out": "2026-08-05 13:00:00",
        })

        # 4h worked on Sunday (Aug 9) -> 3h net worked
        att_sun = Attendance.create({
            "employee_id": self.sub_emp.id,
            "check_in": "2026-08-09 09:00:00",
            "check_out": "2026-08-09 13:00:00",
        })

        self.env["cleon.overtime.request"].with_user(self.manager_user)._sync_attendance_overtime()

        ot_hol = self.env["cleon.overtime.request"].sudo().search([("employee_id", "=", self.sub_emp.id), ("date", "=", "2026-08-05")], limit=1)
        self.assertTrue(ot_hol.exists())
        self.assertEqual(ot_hol.category, "holiday")
        self.assertEqual(ot_hol.overtime_hours, 3.0)

        ot_sun = self.env["cleon.overtime.request"].sudo().search([("employee_id", "=", self.sub_emp.id), ("date", "=", "2026-08-09")], limit=1)
        self.assertTrue(ot_sun.exists())
        self.assertEqual(ot_sun.category, "weekend")
        self.assertEqual(ot_sun.overtime_hours, 3.0)

    def test_03_direct_create_and_context_spoofing_blocked(self):
        """Test RPC client spoofing of allow_overtime_service and direct creation of submitted records raise AccessError."""
        Overtime = self.env["cleon.overtime.request"]

        # 1. Attempt context spoofing to supply server-controlled fields -> AccessError
        with self.assertRaises(AccessError):
            Overtime.with_user(self.emp_user).with_context(allow_overtime_service=True).create({
                "employee_id": self.sub_emp.id,
                "date": "2026-08-06",
                "overtime_hours": 4.0,
                "category": "holiday",
                "multiplier": 5.0,
                "state": "submitted",
            })

        # 2. Attempt direct creation of non-draft state by regular user -> AccessError
        with self.assertRaises(AccessError):
            Overtime.with_user(self.emp_user).create({
                "employee_id": self.sub_emp.id,
                "date": "2026-08-06",
                "state": "submitted",
            })

        # 3. Direct write to state by regular user -> AccessError
        ot_submitted = Overtime.sudo().create({
            "employee_id": self.sub_emp.id,
            "date": "2026-08-06",
            "overtime_hours": 2.0,
            "state": "submitted",
        })
        with self.assertRaises(AccessError):
            ot_submitted.with_user(self.emp_user).write({"state": "approved"})

    def test_04_split_shift_template_aggregation(self):
        """Test auto-calculation aggregates multi-segment split shifts on a real split shift template."""
        self.sub_assignment.write({"date_to": "2026-08-05"})

        # Create a Split Shift Template (Segment 1: 08-12, Segment 2: 16-20 -> Total 8h expected)
        split_shift = self.env["cleon.hr.shift"].create({
            "name": "P5 Split Shift Template",
            "code": "P5SPLIT",
            "shift_type": "split",
            "start_hour": 8.0,
            "end_hour": 20.0,
            "company_id": self.company.id,
            "segment_ids": [
                (0, 0, {"name": "Morning Segment", "start_hour": 8.0, "end_hour": 12.0}),
                (0, 0, {"name": "Evening Segment", "start_hour": 16.0, "end_hour": 20.0}),
            ]
        })

        # Assign split shift to sub_emp for Aug 6, 2026
        self.env["cleon.hr.shift.assignment"].create({
            "shift_id": split_shift.id,
            "employee_id": self.sub_emp.id,
            "date_from": "2026-08-06",
            "date_to": "2026-08-06",
            "company_id": self.company.id,
        })

        Attendance = self.env["hr.attendance"].sudo()
        # Segment 1 punch: 08:00 - 12:00 (4h)
        Attendance.create({
            "employee_id": self.sub_emp.id,
            "check_in": "2026-08-06 08:00:00",
            "check_out": "2026-08-06 12:00:00",
        })
        # Segment 2 punch extended: 15:00 - 22:00 (7h) -> Total worked = 11h gross, 10h net (with 8h daily expected -> 2h daily OT)
        Attendance.create({
            "employee_id": self.sub_emp.id,
            "check_in": "2026-08-06 15:00:00",
            "check_out": "2026-08-06 22:00:00",
        })

        self.env["cleon.overtime.request"].with_user(self.manager_user)._sync_attendance_overtime()

        ot = self.env["cleon.overtime.request"].sudo().search([("employee_id", "=", self.sub_emp.id), ("date", "=", "2026-08-06")], limit=1)
        self.assertTrue(ot.exists())
        self.assertEqual(ot.overtime_hours, 2.0)
        self.assertEqual(ot.regular_hours, 8.0)

    def test_05_weekly_overtime_rate_and_cost(self):
        """Test weekly overtime engine uses policy.weekly_overtime_rate and calculates correct estimated cost."""
        self.policy.write({
            "daily_overtime_enabled": True,
            "daily_overtime_threshold": 9.0,
            "weekly_overtime_enabled": True,
            "weekly_overtime_threshold": 40.0,
            "weekly_overtime_rate": 2.0,
        })
        Attendance = self.env["hr.attendance"].sudo()

        dates = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"]
        for d in dates:
            Attendance.create({
                "employee_id": self.sub_emp.id,
                "check_in": f"{d} 08:00:00",
                "check_out": f"{d} 17:30:00",
            })

        self.env["cleon.overtime.request"].with_user(self.manager_user)._sync_attendance_overtime()

        ot_fri = self.env["cleon.overtime.request"].sudo().search([
            ("employee_id", "=", self.sub_emp.id),
            ("date", "=", "2026-08-07"),
            ("category", "=", "weekly"),
        ], limit=1)
        self.assertTrue(ot_fri.exists())
        self.assertEqual(ot_fri.category, "weekly")
        self.assertEqual(ot_fri.overtime_hours, 2.5)
        self.assertEqual(ot_fri.multiplier, 2.0)
        self.assertEqual(ot_fri.estimated_cost, 2.5 * 2.0 * 50.0)

    def test_06_weekly_overtime_with_daily_overtime_disabled(self):
        """Test weekly overtime calculation when daily_overtime_enabled=False and weekly_overtime_enabled=True."""
        self.policy.write({
            "daily_overtime_enabled": False,
            "weekly_overtime_enabled": True,
            "weekly_overtime_threshold": 40.0,
            "weekly_overtime_rate": 2.0,
        })
        Attendance = self.env["hr.attendance"].sudo()

        dates = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"]
        for d in dates:
            Attendance.create({
                "employee_id": self.sub_emp.id,
                "check_in": f"{d} 08:00:00",
                "check_out": f"{d} 17:30:00",
            })

        self.env["cleon.overtime.request"].with_user(self.manager_user)._sync_attendance_overtime()

        ot_weekly = self.env["cleon.overtime.request"].sudo().search([
            ("employee_id", "=", self.sub_emp.id),
            ("category", "=", "weekly"),
        ], limit=1)
        self.assertTrue(ot_weekly.exists())
        self.assertEqual(ot_weekly.overtime_hours, 2.5)
        self.assertEqual(ot_weekly.multiplier, 2.0)

    def test_07_coexistence_of_daily_and_weekly_overtime(self):
        """Test Daily OT (1.5x) and Weekly OT (2.0x) coexist in the same week as distinct records without combining rates."""
        self.policy.write({
            "daily_overtime_enabled": True,
            "daily_overtime_threshold": 7.0,
            "daily_overtime_rate": 1.5,
            "weekly_overtime_enabled": True,
            "weekly_overtime_threshold": 30.0,
            "weekly_overtime_rate": 2.0,
        })
        Attendance = self.env["hr.attendance"].sudo()

        dates = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"]
        for d in dates:
            Attendance.create({
                "employee_id": self.sub_emp.id,
                "check_in": f"{d} 08:00:00",
                "check_out": f"{d} 18:00:00",
            })

        self.env["cleon.overtime.request"].with_user(self.manager_user)._sync_attendance_overtime()

        ot_daily_fri = self.env["cleon.overtime.request"].sudo().search([
            ("employee_id", "=", self.sub_emp.id),
            ("date", "=", "2026-08-07"),
            ("category", "=", "daily"),
        ], limit=1)
        ot_weekly_fri = self.env["cleon.overtime.request"].sudo().search([
            ("employee_id", "=", self.sub_emp.id),
            ("date", "=", "2026-08-07"),
            ("category", "=", "weekly"),
        ], limit=1)

        self.assertTrue(ot_daily_fri.exists())
        self.assertEqual(ot_daily_fri.overtime_hours, 2.0)
        self.assertEqual(ot_daily_fri.multiplier, 1.5)

        self.assertTrue(ot_weekly_fri.exists())
        self.assertEqual(ot_weekly_fri.overtime_hours, 5.0)
        self.assertEqual(ot_weekly_fri.multiplier, 2.0)

    def test_08_stale_weekly_auto_removed_when_threshold_raised(self):
        """Test stale weekly auto record is unlinked when weekly threshold is raised above worked hours."""
        self.policy.write({
            "daily_overtime_enabled": True,
            "daily_overtime_threshold": 9.0,
            "weekly_overtime_enabled": True,
            "weekly_overtime_threshold": 40.0,
        })
        Attendance = self.env["hr.attendance"].sudo()

        dates = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"]
        for d in dates:
            Attendance.create({
                "employee_id": self.sub_emp.id,
                "check_in": f"{d} 08:00:00",
                "check_out": f"{d} 17:30:00",
            })

        self.env["cleon.overtime.request"].with_user(self.manager_user)._sync_attendance_overtime()

        ot_weekly = self.env["cleon.overtime.request"].sudo().search([
            ("employee_id", "=", self.sub_emp.id),
            ("category", "=", "weekly"),
            ("state", "=", "auto"),
        ], limit=1)
        self.assertTrue(ot_weekly.exists())

        # Raise threshold to 45.0h -> weekly OT should now be 0
        self.policy.write({"weekly_overtime_threshold": 45.0})
        self.env["cleon.overtime.request"].with_user(self.manager_user)._sync_attendance_overtime()

        self.assertFalse(ot_weekly.exists())

    def test_09_stale_weekly_auto_removed_when_weekly_ot_disabled(self):
        """Test stale weekly auto record is unlinked when weekly_overtime_enabled=False while global OT stays enabled."""
        self.policy.write({
            "daily_overtime_enabled": True,
            "daily_overtime_threshold": 9.0,
            "weekly_overtime_enabled": True,
            "weekly_overtime_threshold": 40.0,
        })
        Attendance = self.env["hr.attendance"].sudo()

        dates = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"]
        for d in dates:
            Attendance.create({
                "employee_id": self.sub_emp.id,
                "check_in": f"{d} 08:00:00",
                "check_out": f"{d} 17:30:00",
            })

        self.env["cleon.overtime.request"].with_user(self.manager_user)._sync_attendance_overtime()

        ot_weekly = self.env["cleon.overtime.request"].sudo().search([
            ("employee_id", "=", self.sub_emp.id),
            ("category", "=", "weekly"),
            ("state", "=", "auto"),
        ], limit=1)
        self.assertTrue(ot_weekly.exists())

        # Disable weekly OT on policy while keeping enable_overtime=True
        self.policy.write({"weekly_overtime_enabled": False})
        self.env["cleon.overtime.request"].with_user(self.manager_user)._sync_attendance_overtime()

        self.assertFalse(ot_weekly.exists())

    def test_10_frozen_submitted_approved_weekly_record_no_duplicate(self):
        """Test approved/submitted weekly record prevents creating duplicate weekly auto records in the same week."""
        self.policy.write({
            "daily_overtime_enabled": True,
            "daily_overtime_threshold": 9.0,
            "weekly_overtime_enabled": True,
            "weekly_overtime_threshold": 40.0,
            "weekly_overtime_rate": 2.0,
        })
        Attendance = self.env["hr.attendance"].sudo()

        dates = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"]
        for d in dates:
            Attendance.create({
                "employee_id": self.sub_emp.id,
                "check_in": f"{d} 08:00:00",
                "check_out": f"{d} 17:30:00",
            })

        self.env["cleon.overtime.request"].with_user(self.manager_user)._sync_attendance_overtime()

        ot_weekly = self.env["cleon.overtime.request"].sudo().search([
            ("employee_id", "=", self.sub_emp.id),
            ("category", "=", "weekly"),
            ("date", "=", "2026-08-07"),
        ], limit=1)
        self.assertTrue(ot_weekly.exists())
        self.assertEqual(ot_weekly.overtime_hours, 2.5)

        # Transition Friday weekly record to approved
        ot_weekly.write({"state": "approved"})

        # Re-run sync with identical attendance
        self.env["cleon.overtime.request"].with_user(self.manager_user)._sync_attendance_overtime()

        # Check total weekly records for employee in that week
        all_weekly_recs = self.env["cleon.overtime.request"].sudo().search([
            ("employee_id", "=", self.sub_emp.id),
            ("category", "=", "weekly"),
            ("date", ">=", "2026-08-03"),
            ("date", "<=", "2026-08-07"),
        ])
        self.assertEqual(len(all_weekly_recs), 1)
        self.assertEqual(all_weekly_recs[0].id, ot_weekly.id)
        self.assertEqual(all_weekly_recs[0].overtime_hours, 2.5)
        self.assertEqual(all_weekly_recs[0].state, "approved")

    def test_11_frozen_weekly_record_delta_materialization(self):
        """Test frozen weekly record is preserved and only the new auto delta is materialized when attendance increases."""
        self.policy.write({
            "daily_overtime_enabled": True,
            "daily_overtime_threshold": 9.0,
            "weekly_overtime_enabled": True,
            "weekly_overtime_threshold": 40.0,
            "weekly_overtime_rate": 2.0,
        })
        Attendance = self.env["hr.attendance"].sudo()

        dates = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"]
        for d in dates:
            Attendance.create({
                "employee_id": self.sub_emp.id,
                "check_in": f"{d} 08:00:00",
                "check_out": f"{d} 17:30:00",
            })

        self.env["cleon.overtime.request"].with_user(self.manager_user)._sync_attendance_overtime()

        ot_weekly_fri = self.env["cleon.overtime.request"].sudo().search([
            ("employee_id", "=", self.sub_emp.id),
            ("category", "=", "weekly"),
            ("date", "=", "2026-08-07"),
        ], limit=1)
        self.assertEqual(ot_weekly_fri.overtime_hours, 2.5)

        # Transition Friday weekly record to approved
        ot_weekly_fri.write({"state": "approved"})

        # Add extra attendance on Thursday (augment punch hours on Thursday) -> total week regular becomes 45.5h (entitlement 5.5h)
        # 5.5h total entitlement - 2.5h frozen = 3.0h remaining weekly OT needed
        Attendance.create({
            "employee_id": self.sub_emp.id,
            "check_in": "2026-08-06 17:30:00",
            "check_out": "2026-08-06 20:30:00",
        })

        self.env["cleon.overtime.request"].with_user(self.manager_user)._sync_attendance_overtime()

        # Friday approved record remains untouched (2.5h)
        self.assertEqual(ot_weekly_fri.overtime_hours, 2.5)
        self.assertEqual(ot_weekly_fri.state, "approved")

        # Thursday should receive a new auto weekly delta record of 0.5h (since 2.5h was daily OT above 9h threshold)
        ot_weekly_thu = self.env["cleon.overtime.request"].sudo().search([
            ("employee_id", "=", self.sub_emp.id),
            ("category", "=", "weekly"),
            ("date", "=", "2026-08-06"),
            ("state", "=", "auto"),
        ], limit=1)
        self.assertTrue(ot_weekly_thu.exists())
        self.assertEqual(ot_weekly_thu.overtime_hours, 0.5)

    def test_12_removed_attendance_preserves_iso_week_frozen_record(self):
        """Test approved weekly record on Friday remains counted across full ISO week even if Friday attendance is removed."""
        self.policy.write({
            "daily_overtime_enabled": True,
            "daily_overtime_threshold": 9.0,
            "weekly_overtime_enabled": True,
            "weekly_overtime_threshold": 30.0,
            "weekly_overtime_rate": 2.0,
        })
        Attendance = self.env["hr.attendance"].sudo()

        # Mon-Fri attendance: 5 days x 9.5h gross (8.5h net = 42.5h total regular) -> 12.5h weekly OT on Friday
        att_recs = {}
        dates = ["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"]
        for d in dates:
            att_recs[d] = Attendance.create({
                "employee_id": self.sub_emp.id,
                "check_in": f"{d} 08:00:00",
                "check_out": f"{d} 17:30:00",
            })

        self.env["cleon.overtime.request"].with_user(self.manager_user)._sync_attendance_overtime()

        ot_weekly_fri = self.env["cleon.overtime.request"].sudo().search([
            ("employee_id", "=", self.sub_emp.id),
            ("category", "=", "weekly"),
            ("date", "=", "2026-08-07"),
        ], limit=1)
        self.assertTrue(ot_weekly_fri.exists())
        self.assertEqual(ot_weekly_fri.overtime_hours, 8.5)

        # Transition Friday weekly record to approved
        ot_weekly_fri.write({"state": "approved"})

        # Remove Friday attendance punch (Mon-Thu remains: 4 x 8.5h = 34h regular > 30h threshold)
        att_recs["2026-08-07"].unlink()

        # Re-run sync
        self.env["cleon.overtime.request"].with_user(self.manager_user)._sync_attendance_overtime()

        # Friday approved record MUST still be found across full ISO week [Monday, Sunday]
        # Since frozen_weekly_hours = 8.5h >= total_weekly_entitlement (34 - 30 = 4h), remaining weekly_ot_needed is 0.
        # No duplicate Weekly auto record is created anywhere in that ISO week!
        all_weekly_recs = self.env["cleon.overtime.request"].sudo().search([
            ("employee_id", "=", self.sub_emp.id),
            ("category", "=", "weekly"),
            ("date", ">=", "2026-08-03"),
            ("date", "<=", "2026-08-09"),
        ])
        self.assertEqual(len(all_weekly_recs), 1)
        self.assertEqual(all_weekly_recs[0].id, ot_weekly_fri.id)
        self.assertEqual(all_weekly_recs[0].overtime_hours, 8.5)
        self.assertEqual(all_weekly_recs[0].state, "approved")

    def test_13_cross_team_stale_cleanup_isolation(self):
        """Test Line Manager A syncing team does not delete auto overtime records belonging to Team B."""
        Overtime = self.env["cleon.overtime.request"].sudo()
        ot_team_b = Overtime.create({
            "employee_id": self.sub_b_emp.id,
            "date": "2026-08-06",
            "overtime_hours": 2.0,
            "source": "attendance",
            "state": "auto",
        })

        # Manager A syncs team
        Overtime.with_user(self.manager_user)._sync_attendance_overtime()

        # Team B record MUST NOT be unlinked
        self.assertTrue(ot_team_b.exists())

    def test_14_policy_change_reconciliation_pending_auto_cleanup(self):
        """Test disabling overtime policy reconciles and unlinks pending state='auto' requests while leaving approved intact."""
        Overtime = self.env["cleon.overtime.request"].sudo()
        ot_auto = Overtime.create({
            "employee_id": self.sub_emp.id,
            "date": "2026-08-06",
            "overtime_hours": 2.0,
            "source": "attendance",
            "state": "auto",
        })
        ot_app = Overtime.create({
            "employee_id": self.sub_emp.id,
            "date": "2026-08-07",
            "overtime_hours": 3.0,
            "source": "attendance",
            "state": "approved",
        })

        # Disable overtime on policy
        self.policy.write({"enable_overtime": False})
        Overtime.with_user(self.manager_user)._sync_attendance_overtime()

        self.assertFalse(ot_auto.exists())
        self.assertTrue(ot_app.exists())

    def test_15_period_lock_during_auto_sync_recompute(self):
        """Test auto sync skips mutating auto overtime records when the period is administratively locked."""
        Overtime = self.env["cleon.overtime.request"].sudo()
        ot_auto = Overtime.create({
            "employee_id": self.sub_emp.id,
            "date": "2026-08-06",
            "overtime_hours": 2.0,
            "source": "attendance",
            "state": "auto",
        })
        # Lock August period
        self.env["cleon.time.period.lock"].sudo().create({
            "company_id": self.company.id,
            "date_from": "2026-08-01",
            "date_to": "2026-08-10",
            "state": "locked",
            "reason": "Locked for payroll",
        })

        # Disable overtime on policy and sync
        self.policy.write({"enable_overtime": False})
        Overtime.with_user(self.manager_user)._sync_attendance_overtime()

        # Record should NOT be unlinked because period is locked
        self.assertTrue(ot_auto.exists())
