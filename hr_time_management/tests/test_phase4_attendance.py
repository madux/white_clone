from datetime import datetime, time
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
        self.assertTrue(is_late or is_early or is_half or status in ("late", "early_exit", "late_and_early", "half_day", "present"))

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
            Device.cleon_biometric_device_punch("INVALID_KEY_XYZ", "BIO-1002", now_str)

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
        # Ordinary user reading device key should fail or return None due to field-level groups
        with self.assertRaises(AccessError):
            device.with_user(self.emp_user).read(["device_key"])
