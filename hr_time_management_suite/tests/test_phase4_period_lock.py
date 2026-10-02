from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tests.common import TransactionCase


class TestPhase4PeriodLock(TransactionCase):

    def setUp(self):
        super().setUp()
        self.company = self.env.company

        # Group refs
        self.group_user = self.env.ref("hr_time_management.group_time_management_user")
        self.group_hr_admin = self.env.ref("hr_time_management.group_time_management_hr_admin")

        # Employee User & Employee
        self.emp_user = self.env["res.users"].create({
            "name": "P4 Lock User",
            "login": "p4_lock_user",
            "email": "p4_lock@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_user.id])],
        })
        self.employee = self.env["hr.employee"].create({
            "name": "P4 Lock Employee",
            "user_id": self.emp_user.id,
            "company_id": self.company.id,
        })

        # HR Admin User
        self.hr_admin_user = self.env["res.users"].create({
            "name": "P4 HR Admin User",
            "login": "p4_hr_admin",
            "email": "p4_admin@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_hr_admin.id])],
        })

        # Create period lock covering 2026-07-01 to 2026-07-31
        self.lock = self.env["cleon.time.period.lock"].sudo().create({
            "company_id": self.company.id,
            "date_from": "2026-07-01",
            "date_to": "2026-07-31",
            "state": "locked",
            "reason": "July 2026 payroll audit lock",
        })

    def test_01_period_lock_blocks_attendance_mutation(self):
        """Test period lock blocks Attendance creation within locked date range."""
        with self.assertRaises(AccessError):
            self.env["hr.attendance"].with_user(self.emp_user).create({
                "employee_id": self.employee.id,
                "check_in": "2026-07-15 08:00:00",
                "check_out": "2026-07-15 17:00:00",
            })

    def test_02_period_lock_blocks_regularization(self):
        """Test period lock blocks Attendance Regularization creation within locked date range."""
        with self.assertRaises(AccessError):
            self.env["cleon.attendance.regularization"].with_user(self.emp_user).create({
                "employee_id": self.employee.id,
                "attendance_date": "2026-07-15",
                "issue_type": "forgot_in",
                "requested_check_in": "2026-07-15 08:00:00",
                "requested_check_out": "2026-07-15 17:00:00",
                "reason": "Forgot to clock in on site visit.",
            })

    def test_03_period_lock_blocks_timesheet(self):
        """Test period lock blocks Timesheet creation for week starting within locked range."""
        with self.assertRaises(AccessError):
            self.env["cleon.time.sheet"].with_user(self.emp_user).create({
                "employee_id": self.employee.id,
                "week_start": "2026-07-06",
                "company_id": self.company.id,
            })

    def test_04_period_lock_blocks_overtime(self):
        """Test period lock blocks Overtime request creation on locked date."""
        with self.assertRaises(AccessError):
            self.env["cleon.overtime.request"].with_user(self.emp_user).create({
                "employee_id": self.employee.id,
                "date": "2026-07-15",
                "overtime_hours": 2.0,
                "justification": "Overtime on locked date test",
                "company_id": self.company.id,
            })

    def test_05_authorized_hr_admin_override_and_audit(self):
        """Test authorized HR Admin override with explicit reason succeeds and logs audit entry."""
        res = self.env["cleon.time.period.lock"].check_period_lock(
            self.company, "2026-07-15", "Attendance Audit Test", override_reason="Special HR payroll adjustment"
        )
        self.assertTrue(res)

        # Verify audit log recorded
        audit = self.env["cleon.time.audit.log"].sudo().search([
            ("company_id", "=", self.company.id),
            ("reason", "ilike", "Special HR payroll adjustment"),
        ], limit=1)
        self.assertTrue(audit.id)

    def test_06_period_lock_blocks_native_analytic_line(self):
        """Test period lock blocks native account.analytic.line creation/mutation on locked date."""
        if "account.analytic.line" in self.env:
            with self.assertRaises(AccessError):
                self.env["account.analytic.line"].with_user(self.emp_user).create({
                    "name": "Locked Date Analytic Line",
                    "date": "2026-07-15",
                    "unit_amount": 4.0,
                    "employee_id": self.employee.id,
                    "company_id": self.company.id,
                })

    def test_07_partially_overlapping_weekly_timesheet_range_lock(self):
        """Test check_period_range blocks weekly timesheet when lock overlaps part of the week."""
        # Lock is July 20 to July 31.
        # Week starts July 20 (Mon) to July 26 (Sun). Overlaps!
        with self.assertRaises(AccessError):
            self.env["cleon.time.period.lock"].check_period_range(
                self.company, "2026-07-20", "2026-07-26", "Weekly Timesheet Range Test"
            )

    def test_08_workflow_actions_blocked_in_locked_period(self):
        """Test workflow submit/approve actions are blocked by period lock even when using sudo().write()."""
        # Create draft regularization outside existing July locked period (date in August)
        reg = self.env["cleon.attendance.regularization"].sudo().create({
            "employee_id": self.employee.id,
            "attendance_date": "2026-08-15",
            "issue_type": "forgot_in",
            "requested_check_in": "2026-08-15 08:00:00",
            "requested_check_out": "2026-08-15 17:00:00",
            "reason": "Test workflow action block",
        })
        # Now create an active period lock covering August 2026
        self.env["cleon.time.period.lock"].sudo().create({
            "company_id": self.company.id,
            "date_from": "2026-08-01",
            "date_to": "2026-08-31",
            "state": "locked",
            "reason": "August 2026 payroll audit lock",
        })
        with self.assertRaises(AccessError):
            reg.with_user(self.emp_user).action_submit()

    def test_09_regularization_withdraw_blocked_in_locked_period(self):
        """Test action_withdraw is blocked when attendance_date is locked."""
        reg = self.env["cleon.attendance.regularization"].sudo().create({
            "employee_id": self.employee.id,
            "attendance_date": "2026-08-05",
            "issue_type": "forgot_in",
            "requested_check_in": "2026-08-05 08:00:00",
            "requested_check_out": "2026-08-05 17:00:00",
            "reason": "Test withdraw period lock block verification reason message",
        })
        reg.with_user(self.emp_user).action_submit()

        # Create period lock covering August 1 to August 10, 2026
        self.env["cleon.time.period.lock"].sudo().create({
            "company_id": self.company.id,
            "date_from": "2026-08-01",
            "date_to": "2026-08-10",
            "state": "locked",
            "reason": "August lock",
        })
        with self.assertRaises(AccessError):
            reg.with_user(self.emp_user).action_withdraw()

    def test_10_overtime_payroll_transfer_blocked_in_locked_period(self):
        """Test mark_payroll_transferred is blocked when overtime date is locked."""
        ot = self.env["cleon.overtime.request"].sudo().create({
            "employee_id": self.employee.id,
            "company_id": self.company.id,
            "date": "2026-08-05",
            "overtime_hours": 3.0,
            "state": "approved",
            "payroll_state": "ready",
        })
        # Lock August 1 to August 10, 2026
        self.env["cleon.time.period.lock"].sudo().create({
            "company_id": self.company.id,
            "date_from": "2026-08-01",
            "date_to": "2026-08-10",
            "state": "locked",
            "reason": "August lock",
        })
        with self.assertRaises(AccessError):
            ot.mark_payroll_transferred()

    def test_11_prospective_analytic_line_write_check(self):
        """Test moving an unlocked analytic line to a locked date/company raises AccessError."""
        if "account.analytic.line" in self.env:
            line = self.env["account.analytic.line"].sudo().create({
                "name": "Unlocked Date Line",
                "date": "2026-11-15",
                "unit_amount": 2.0,
                "employee_id": self.employee.id,
                "company_id": self.company.id,
            })
            # Lock July 2026 (July 1 - July 31 is locked by setUp)
            with self.assertRaises(AccessError):
                line.with_user(self.emp_user).write({"date": "2026-07-15"})
