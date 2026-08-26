from datetime import datetime, timedelta, time
import pytz

from odoo import fields
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tests.common import TransactionCase


class TestPhase4Attendance(TransactionCase):

    def setUp(self):
        super().setUp()
        self.company = self.env.company
        self.company.write({"name": "Test Phase4 Company"})

        # Group refs
        self.group_user = self.env.ref("hr_time_management.group_time_management_user")
        self.group_line_mgr = self.env.ref("hr_time_management.group_time_management_line_manager")
        self.group_hr_mgr = self.env.ref("hr_time_management.group_time_management_hr_manager")
        self.group_hr_admin = self.env.ref("hr_time_management.group_time_management_hr_admin")

        # Line Manager User & Employee
        self.manager_user = self.env["res.users"].create({
            "name": "P4 Line Manager",
            "login": "p4_line_mgr",
            "email": "p4_mgr@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_line_mgr.id])],
        })
        self.manager_emp = self.env["hr.employee"].create({
            "name": "P4 Line Manager Emp",
            "user_id": self.manager_user.id,
            "company_id": self.company.id,
        })

        # Subordinate User & Employee
        self.emp_user = self.env["res.users"].create({
            "name": "P4 Subordinate User",
            "login": "p4_sub_user",
            "email": "p4_sub@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_user.id])],
        })
        self.sub_emp = self.env["hr.employee"].create({
            "name": "P4 Subordinate Emp",
            "user_id": self.emp_user.id,
            "parent_id": self.manager_emp.id,
            "company_id": self.company.id,
        })

        # Unrelated User & Employee
        self.unrelated_user = self.env["res.users"].create({
            "name": "P4 Unrelated User",
            "login": "p4_unrelated",
            "email": "p4_unrelated@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_user.id])],
        })
        self.unrelated_emp = self.env["hr.employee"].create({
            "name": "P4 Unrelated Emp",
            "user_id": self.unrelated_user.id,
            "company_id": self.company.id,
        })

        # Policy configuration
        self.policy = self.env["cleon.time.policy"].search([("company_id", "=", self.company.id)], limit=1)
        if not self.policy:
            self.policy = self.env["cleon.time.policy"].create({"company_id": self.company.id})
        self.policy.write({
            "clock_method": "manual",
            "office_latitude": 6.5244,
            "office_longitude": 3.3792,
            "gps_radius_meters": 200.0,
            "ip_whitelist": "192.168.1.100, 10.0.0.1",
        })

    def test_01_tz_resolver_precedence(self):
        """Test schedule-aware timezone resolver precedence."""
        Attendance = self.env["hr.attendance"]
        tz = Attendance._tz_for_employee(self.sub_emp)
        self.assertTrue(tz)

    def test_02_get_cleon_time_data_line_manager_scoping(self):
        """Test get_cleon_time_data executes for Line Manager and returns team employee rows."""
        Attendance = self.env["hr.attendance"].with_user(self.manager_user)
        data = Attendance.get_cleon_time_data()
        self.assertTrue(isinstance(data.get("rows"), list))
        emp_ids = [r["employee_id"] for r in data["rows"]]
        self.assertIn(self.sub_emp.id, emp_ids)
        self.assertNotIn(self.unrelated_emp.id, emp_ids)

    def test_03_gps_inside_radius_accepted_and_outside_rejected(self):
        """Test server-side GPS distance calculation and radius enforcement."""
        Attendance = self.env["hr.attendance"]
        self.policy.write({"clock_method": "gps"})

        # Inside radius (~10m away)
        valid, dist = Attendance._verify_gps_location(self.policy, 6.52445, 3.37925)
        self.assertTrue(valid)
        self.assertLess(dist, 200.0)

        # Outside radius (~5km away)
        with self.assertRaises(AccessError):
            Attendance._verify_gps_location(self.policy, 6.5700, 3.3200)

        # Missing GPS coordinates under GPS-required policy
        with self.assertRaises(UserError):
            Attendance._verify_gps_location(self.policy, None, None)

        # Invalid GPS coordinate range
        with self.assertRaises(ValidationError):
            Attendance._verify_gps_location(self.policy, 195.0, 400.0)

    def test_04_ip_whitelist_validation(self):
        """Test server-side IP whitelist enforcement."""
        Attendance = self.env["hr.attendance"]
        self.policy.write({"clock_method": "ip", "ip_whitelist": "192.168.1.100, 10.0.0.1"})

        # Valid client IP
        valid, dist, acc = Attendance._verify_clock_policy(self.policy, client_ip="192.168.1.100")
        self.assertTrue(valid)

        # Unauthorized client IP
        with self.assertRaises(AccessError):
            Attendance._verify_clock_policy(self.policy, client_ip="172.16.0.1")

    def test_05_independent_attendance_facts_late_and_early_exit(self):
        """Test simultaneous late arrival and early exit independent facts calculation."""
        Attendance = self.env["hr.attendance"]
        att = Attendance.sudo().create({
            "employee_id": self.sub_emp.id,
            "check_in": "2026-08-10 09:30:00",
            "check_out": "2026-08-10 15:00:00",
        })
        is_late, late_by, is_early, early_by, is_half, status = Attendance._status_for(att, self.sub_emp, att.check_in.date())
        self.assertTrue(is_late or is_early or is_half or status in ("late", "early_exit", "late_and_early", "half_day", "present", "rest_day_worked"))

        row = Attendance._row(self.sub_emp, att, att.check_in.date())
        self.assertIn("is_late", row)
        self.assertIn("is_early_exit", row)

    def test_06_authenticated_biometric_device_punch(self):
        """Test biometric hardware terminal punch contract with device key and replay protection."""
        Device = self.env["cleon.biometric.device"]

        # Create device registration
        device = Device.sudo().create({
            "name": "Front Gate Scanner",
            "device_key": "DEV_KEY_TEST_999",
            "company_id": self.company.id,
            "active": True,
        })

        # Set barcode on employee
        self.sub_emp.sudo().write({"barcode": "BIO-1002"})

        # Execute punch via device contract
        now_str = fields.Datetime.to_string(fields.Datetime.now())
        res = Device.cleon_biometric_device_punch("DEV_KEY_TEST_999", "BIO-1002", now_str, event_id="EVT-001")
        self.assertEqual(res["status"], "success")
        self.assertEqual(res["action"], "clock_in")

        # Test duplicate event_id replay protection
        dup_res = Device.cleon_biometric_device_punch("DEV_KEY_TEST_999", "BIO-1002", now_str, event_id="EVT-001")
        self.assertEqual(dup_res["status"], "duplicate")

        # Test unauthorized device key
        with self.assertRaises(AccessError):
            Device.cleon_biometric_device_punch("INVALID_KEY_XYZ", "BIO-1002", now_str, event_id="EVT-002")

    def test_07_mixed_policy_fail_closed_and_cidr_subnet(self):
        """Test fail-closed behavior for mixed policy and CIDR subnet parsing."""
        Attendance = self.env["hr.attendance"]
        self.policy.write({
            "clock_method": "mixed",
            "office_latitude": 6.5244,
            "office_longitude": 3.3792,
            "gps_radius_meters": 200.0,
            "ip_whitelist": "192.168.1.0/24, 10.0.0.1",
        })

        # Test CIDR subnet match (192.168.1.55 inside 192.168.1.0/24)
        _valid, dist, acc = Attendance._verify_clock_policy(
            self.policy, latitude=None, longitude=None, accuracy=None, client_ip="192.168.1.55"
        )
        self.assertTrue(_valid)

        # Test mixed policy fail-closed when NEITHER GPS nor IP is valid
        with self.assertRaises(AccessError):
            Attendance._verify_clock_policy(
                self.policy, latitude=6.8000, longitude=3.5000, accuracy=10.0, client_ip="172.16.0.99"
            )

    def test_08_gps_misconfigured_office_and_inaccuracy_rejection(self):
        """Test policy misconfiguration detection and excessive inaccuracy rejection."""
        Attendance = self.env["hr.attendance"]
        self.policy.write({
            "clock_method": "gps",
            "office_latitude": 0.0,
            "office_longitude": 0.0,
            "gps_radius_meters": 0.0,
        })

        # Unconfigured office location fail-closed
        with self.assertRaises(AccessError):
            Attendance._verify_clock_policy(self.policy, latitude=6.5244, longitude=3.3792, accuracy=10.0)

        # Re-configure office and test accuracy > 500m rejection
        self.policy.write({
            "office_latitude": 6.5244,
            "office_longitude": 3.3792,
            "gps_radius_meters": 200.0,
        })
        with self.assertRaises(AccessError):
            Attendance._verify_clock_policy(self.policy, latitude=6.5244, longitude=3.3792, accuracy=600.0)

    def test_09_night_shift_datetime_lateness_calculation(self):
        """Test night-shift late arrival comparing timezone-aware datetimes."""
        Attendance = self.env["hr.attendance"]
        Shift = self.env["cleon.hr.shift"]
        shift = Shift.create({
            "name": "Night Shift 22-06",
            "code": "NS2206",
            "shift_type": "night",
            "start_hour": 22.0,
            "end_hour": 6.0,
            "grace_minutes": 15,
            "company_id": self.company.id,
        })
        # Employee checks in at 00:30 after midnight (start was 22:00 yesterday)
        att = Attendance.sudo().create({
            "employee_id": self.sub_emp.id,
            "cleon_shift_id": shift.id,
            "check_in": "2026-08-11 00:30:00",
            "check_out": "2026-08-11 06:00:00",
        })
        is_late, late_by, _is_early, _early_by, _is_half, status = Attendance._status_for(att, self.sub_emp, fields.Date.to_date("2026-08-10"))
        self.assertTrue(is_late)
        self.assertGreater(late_by, 120)  # ~150 mins late

    def test_10_rest_day_missing_attendance_not_absent(self):
        """Test missing attendance on a scheduled rest day returns status 'rest_day' and no absence."""
        Attendance = self.env["hr.attendance"]
        # On a Sunday (rest day) with no attendance
        is_late, late_by, is_early, early_by, is_half, status = Attendance._status_for(None, self.sub_emp, fields.Date.to_date("2026-08-09"))
        self.assertEqual(status, "rest_day")
        self.assertFalse(is_late)
        self.assertFalse(is_early)

    def test_11_biometric_device_key_security_groups(self):
        """Test ordinary employees cannot read plaintext device keys on cleon.biometric.device."""
        Device = self.env["cleon.biometric.device"]
        device = Device.sudo().create({
            "name": "Secured Terminal",
            "device_key": "SUPER_SECRET_KEY_123",
            "company_id": self.company.id,
        })
        with self.assertRaises(AccessError):
            device.with_user(self.emp_user).read(["device_key"])

    def test_12_sanitized_audit_log_no_device_key_secret(self):
        """Test biometric audit log output does NOT contain authentication device key secret."""
        Device = self.env["cleon.biometric.device"]
        device = Device.sudo().create({
            "name": "Gate 1 Scanner",
            "device_key": "SECRET_KEY_AUDIT_CHECK",
            "company_id": self.company.id,
            "active": True,
        })
        self.sub_emp.sudo().write({"barcode": "BIO-AUDIT-101"})
        now_str = fields.Datetime.to_string(fields.Datetime.now())
        res = Device.cleon_biometric_device_punch("SECRET_KEY_AUDIT_CHECK", "BIO-AUDIT-101", now_str, event_id="EVT-AUDIT-001")
        self.assertEqual(res["status"], "success")

        # Verify audit log reason and details DO NOT contain the secret key
        audit = self.env["cleon.time.audit.log"].sudo().search([
            ("attendance_id", "=", res["attendance_id"]),
        ], limit=1)
        self.assertTrue(audit)
        self.assertNotIn("SECRET_KEY_AUDIT_CHECK", audit.reason)
        self.assertNotIn("SECRET_KEY_AUDIT_CHECK", audit.details)
        self.assertIn("Gate 1 Scanner", audit.reason)

    def test_13_biometric_device_ip_address_restriction(self):
        """Test biometric terminal punch rejected when source IP does not match registered device IP."""
        Device = self.env["cleon.biometric.device"]
        device = Device.sudo().create({
            "name": "Ip Restricted Terminal",
            "device_key": "DEV_KEY_IP_RESTRICTED",
            "company_id": self.company.id,
            "ip_address": "192.168.1.200",
            "active": True,
        })
        self.sub_emp.sudo().write({"barcode": "BIO-IP-102"})

        # Pass mismatched client_ip directly to policy engine
        with self.assertRaises(AccessError):
            self.env["hr.attendance"]._verify_clock_policy(
                self.policy, punch_type="biometric", client_ip="10.0.0.99", device=device
            )

    def test_14_ingress_policy_validation_browser_rejected_under_biometric_policy(self):
        """Test browser punch is denied when company policy requires biometric terminal clocking."""
        self.policy.write({"clock_method": "biometric"})
        with self.assertRaises(AccessError):
            self.env["hr.attendance"]._verify_clock_policy(self.policy, punch_type="browser")

    def test_15_overnight_work_date_derivation(self):
        """Test overnight work date resolver derives previous date for early morning punch after night shift."""
        Shift = self.env["cleon.hr.shift"]
        shift = Shift.create({
            "name": "Night Shift 22-06",
            "code": "NS2206B",
            "shift_type": "night",
            "start_hour": 22.0,
            "end_hour": 6.0,
            "grace_minutes": 15,
            "company_id": self.company.id,
        })
        # Assign employee to night shift
        self.env["cleon.hr.shift.assignment"].create({
            "shift_id": shift.id,
            "employee_id": self.sub_emp.id,
            "date_from": "2026-08-01",
            "company_id": self.company.id,
        })

        # Punch at 02:00 AM on Aug 11th -> belongs to Aug 10th work date
        w_date = self.env["hr.attendance"]._work_date_for_punch(self.sub_emp, "2026-08-11 02:00:00")
        self.assertEqual(fields.Date.to_string(w_date), "2026-08-10")

    def test_16_rest_day_worked_semantics(self):
        """Test attendance on a scheduled rest day returns status 'rest_day_worked' with no absence penalty."""
        Attendance = self.env["hr.attendance"]
        att = Attendance.sudo().create({
            "employee_id": self.sub_emp.id,
            "check_in": "2026-08-09 09:00:00",  # Sunday (rest day)
            "check_out": "2026-08-09 17:00:00",
        })
        is_late, late_by, is_early, early_by, is_half, status = Attendance._status_for(att, self.sub_emp, fields.Date.to_date("2026-08-09"))
        self.assertEqual(status, "rest_day_worked")
        self.assertFalse(is_late)
        self.assertFalse(is_early)

    def test_17_multi_day_date_range_grid_matrix(self):
        """Test multi-day get_cleon_time_data generates expected workday rows for every employee x date in date range."""
        Attendance = self.env["hr.attendance"].with_user(self.manager_user)
        # Date range covering 5 days (Aug 10 to Aug 14)
        data = Attendance.get_cleon_time_data(view="timesheet", date_from="2026-08-10", date_to="2026-08-14")
        self.assertTrue(isinstance(data.get("rows"), list))
        dates = set(r["date"] for r in data["rows"] if r["employee_id"] == self.sub_emp.id)
        self.assertIn("2026-08-10", dates)
        self.assertIn("2026-08-11", dates)
        self.assertIn("2026-08-14", dates)

    def test_18_date_aware_leave_in_multi_day_report(self):
        """Test leave on single day (Wed Aug 12) only sets on_leave status for that specific date in multi-day report."""
        leave_type = self.env["hr.leave.type"].create({
            "name": "Paid Annual Leave",
            "requires_allocation": "no",
            "retroactive_request_days": 365,
        })
        leave = self.env["hr.leave"].sudo().create({
            "name": "Mid-week Doctor Appointment",
            "employee_id": self.sub_emp.id,
            "holiday_status_id": leave_type.id,
            "request_date_from": "2026-08-12",
            "request_date_to": "2026-08-12",
        })
        leave.action_validate()

        Attendance = self.env["hr.attendance"].with_user(self.manager_user)
        data = Attendance.get_cleon_time_data(view="timesheet", date_from="2026-08-10", date_to="2026-08-14")
        sub_rows = {r["date"]: r["status"] for r in data["rows"] if r["employee_id"] == self.sub_emp.id}

        self.assertEqual(sub_rows.get("2026-08-12"), "on_leave")
        self.assertNotEqual(sub_rows.get("2026-08-10"), "on_leave")
        self.assertNotEqual(sub_rows.get("2026-08-11"), "on_leave")

    def test_19_attendance_rate_scheduled_opportunities_denominator(self):
        """Test attendance_rate denominator only counts scheduled work opportunities (excludes rest_day, rest_day_worked, on_leave)."""
        Shift = self.env["cleon.hr.shift"]
        shift = Shift.create({
            "name": "Standard Day Shift 09-17",
            "code": "STD0917",
            "shift_type": "fixed",
            "start_hour": 9.0,
            "end_hour": 17.0,
            "company_id": self.company.id,
        })
        self.env["cleon.hr.shift.assignment"].create({
            "shift_id": shift.id,
            "employee_id": self.sub_emp.id,
            "date_from": "2026-08-01",
            "company_id": self.company.id,
        })

        Attendance = self.env["hr.attendance"].sudo()
        # Monday present, Tuesday absent for sub_emp
        Attendance.create({
            "employee_id": self.sub_emp.id,
            "check_in": "2026-08-10 09:00:00",
            "check_out": "2026-08-10 17:00:00",
        })
        # Search specifically for sub_emp: 1 present out of 2 scheduled workdays (Mon, Tue) = 50% rate
        data = Attendance.sudo().get_cleon_time_data(
            view="timesheet", date_from="2026-08-10", date_to="2026-08-11", search=self.sub_emp.name
        )
        sub_rows = [r for r in data["rows"] if r["employee_id"] == self.sub_emp.id]
        self.assertEqual(len(sub_rows), 2)
        self.assertEqual(data["attendance_rate"], 50)

    def test_20_overnight_shift_ending_after_07am(self):
        """Test overnight work date resolver for a late morning end shift (23:00 to 09:00 AM)."""
        Shift = self.env["cleon.hr.shift"]
        shift = Shift.create({
            "name": "Late Night Shift 23-09",
            "code": "NS2309",
            "shift_type": "night",
            "start_hour": 23.0,
            "end_hour": 9.0,
            "grace_minutes": 15,
            "company_id": self.company.id,
        })
        self.env["cleon.hr.shift.assignment"].create({
            "shift_id": shift.id,
            "employee_id": self.sub_emp.id,
            "date_from": "2026-08-01",
            "company_id": self.company.id,
        })

        # Open attendance for night shift checked in at 23:00 local time (21:00 UTC) on Aug 10th
        self.env["hr.attendance"].sudo().create({
            "employee_id": self.sub_emp.id,
            "check_in": "2026-08-10 21:00:00",
        })

        # Checkout punch at 08:30 AM local time (06:30 UTC) on Aug 11th -> belongs to Aug 10th work date
        w_date = self.env["hr.attendance"]._work_date_for_punch(self.sub_emp, "2026-08-11 06:30:00")
        self.assertEqual(fields.Date.to_string(w_date), "2026-08-10")

    def test_21_biometric_missing_client_ip_rejection(self):
        """Test biometric punch is rejected when client_ip is missing for a terminal with configured ip_address."""
        Device = self.env["cleon.biometric.device"]
        device = Device.sudo().create({
            "name": "Strict IP Terminal",
            "device_key": "DEV_KEY_STRICT_IP",
            "company_id": self.company.id,
            "ip_address": "192.168.1.200",
            "active": True,
        })
        # Missing client_ip (None or empty)
        with self.assertRaises(AccessError):
            self.env["hr.attendance"]._verify_clock_policy(
                self.policy, punch_type="biometric", client_ip=None, device=device
            )

    def test_22_employee_data_exposes_stale_open_attendance_for_correction(self):
        """The employee correction form can target an unresolved prior workday."""
        check_in = fields.Datetime.now() - timedelta(days=2)
        attendance = self.env["hr.attendance"].sudo().create({
            "employee_id": self.sub_emp.id,
            "check_in": check_in,
        })

        data = self.env["hr.attendance"].with_user(self.emp_user).get_cleon_employee_data()

        self.assertEqual(data["unresolved_attendance"]["id"], attendance.id)
        self.assertIn("T", data["unresolved_attendance"]["check_in"])

    def test_23_rejected_regularization_resubmits_datetime_local_values(self):
        """Rejected requests are reused and browser datetime-local values are accepted."""
        Regularization = self.env["cleon.attendance.regularization"]
        today = fields.Date.today()
        date_value = fields.Date.to_string(today)
        rejected = Regularization.sudo().create({
            "employee_id": self.sub_emp.id,
            "attendance_date": today,
            "issue_type": "other",
            "requested_check_in": "%s 08:00:00" % date_value,
            "requested_check_out": "%s 16:00:00" % date_value,
            "reason": "The original correction details were not accurate.",
            "state": "rejected",
        })
        self.env["cleon.approval.chain"].sudo().search([
            ("company_id", "=", self.company.id),
            ("workflow_type_id.code", "=", "time_regularization"),
            ("is_default", "=", True),
        ]).write({"is_default": False})
        self.policy.write({
            "regularization_require_approval": False,
            "regularization_window_days": 7,
        })

        result = Regularization.with_user(self.emp_user).submit_request({
            "attendance_date": date_value,
            "issue_type": "system_error",  # compatibility input from the brief-lived client value
            "requested_check_in": "%sT09:00" % date_value,
            "requested_check_out": "%sT17:00" % date_value,
            "reason": "The attendance terminal failed during the workday.",
        })

        self.assertEqual(result["id"], rejected.id)
        self.assertEqual(result["issue_type"], "system_glitch")
        self.assertEqual(rejected.state, "approved")

    def test_24_regularization_uses_employee_work_timezone_and_honest_code(self):
        """A reviewer timezone must not change the employee workday or displayed correction times."""
        calendar = self.env["resource.calendar"].create({
            "name": "P4 Lagos Calendar",
            "tz": "Africa/Lagos",
            "company_id": self.company.id,
        })
        self.sub_emp.write({
            "resource_calendar_id": calendar.id,
            "identification_id": False,
            "barcode": False,
        })
        self.manager_user.tz = "America/New_York"
        target_date = fields.Date.today()
        utc_check_in = datetime.combine(target_date, time(hour=8))
        attendance = self.env["hr.attendance"].sudo().create({
            "employee_id": self.sub_emp.id,
            "check_in": utc_check_in,
        })
        request = self.env["cleon.attendance.regularization"].sudo().create({
            "employee_id": self.sub_emp.id,
            "attendance_date": target_date,
            "issue_type": "forgot_out",
            "requested_check_in": utc_check_in,
            "reason": "The employee forgot to clock out after completing work.",
        })

        result = request.with_user(self.manager_user)._serialize()

        self.assertEqual(result["current_check_in_time"], "09:00 AM")
        self.assertEqual(result["requested_check_in_input"], "%sT09:00" % target_date)
        self.assertEqual(result["employee_code"], False)
        self.assertEqual(request.attendance_id, self.env["hr.attendance"])
        self.assertTrue(attendance.exists())

    def test_25_cross_company_default_shift_is_rejected(self):
        """Settings cannot persist another company's shift as the active default."""
        company_b = self.env["res.company"].create({"name": "P4 Other Company"})
        foreign_shift = self.env["cleon.hr.shift"].sudo().create({
            "name": "P4 Foreign Shift",
            "code": "P4-FOREIGN",
            "company_id": company_b.id,
            "start_hour": 8.0,
            "end_hour": 16.0,
        })

        with self.assertRaises(ValidationError):
            self.env["cleon.time.policy"].save_cleon_policy({
                "selected_shift_id": foreign_shift.id,
            })
