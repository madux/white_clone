# -*- coding: utf-8 -*-
from odoo.tests import TransactionCase, tagged
from odoo.exceptions import AccessError


@tagged("post_install", "-at_install", "phase1")
class TestTimeManagementSecurity(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.company = cls.env.company

        # Create HR Admin User
        cls.hr_admin_user = cls.env["res.users"].create({
            "name": "TM HR Admin User",
            "login": "tm_hr_admin_user",
            "email": "tm_hr_admin@example.com",
            "company_id": cls.company.id,
            "company_ids": [(6, 0, [cls.company.id])],
            "groups_id": [(6, 0, [
                cls.env.ref("base.group_user").id,
                cls.env.ref("hr_time_management.group_time_management_hr_admin").id,
            ])],
        })

        # Create HR Manager User
        cls.hr_manager_user = cls.env["res.users"].create({
            "name": "TM HR Manager User",
            "login": "tm_hr_manager_user",
            "email": "tm_hr_manager@example.com",
            "company_id": cls.company.id,
            "company_ids": [(6, 0, [cls.company.id])],
            "groups_id": [(6, 0, [
                cls.env.ref("base.group_user").id,
                cls.env.ref("hr_time_management.group_time_management_hr_manager").id,
            ])],
        })

        # Create Line Manager User
        cls.line_manager_user = cls.env["res.users"].create({
            "name": "TM Line Manager User",
            "login": "tm_line_manager_user",
            "email": "tm_line_manager@example.com",
            "company_id": cls.company.id,
            "company_ids": [(6, 0, [cls.company.id])],
            "groups_id": [(6, 0, [
                cls.env.ref("base.group_user").id,
                cls.env.ref("hr_time_management.group_time_management_line_manager").id,
            ])],
        })

        # Create Employee User
        cls.employee_user = cls.env["res.users"].create({
            "name": "TM Employee User",
            "login": "tm_employee_user",
            "email": "tm_employee@example.com",
            "company_id": cls.company.id,
            "company_ids": [(6, 0, [cls.company.id])],
            "groups_id": [(6, 0, [
                cls.env.ref("base.group_user").id,
                cls.env.ref("hr_time_management.group_time_management_user").id,
            ])],
        })

        # Create HR Employee Records
        cls.manager_emp = cls.env["hr.employee"].create({
            "name": "Manager Employee",
            "user_id": cls.line_manager_user.id,
            "company_id": cls.company.id,
        })
        cls.report_emp = cls.env["hr.employee"].create({
            "name": "Direct Report Employee",
            "user_id": cls.employee_user.id,
            "parent_id": cls.manager_emp.id,
            "company_id": cls.company.id,
        })

        # Create Unrelated Employee (reports to nobody)
        cls.unrelated_user = cls.env["res.users"].create({
            "name": "TM Unrelated User",
            "login": "tm_unrelated_user",
            "email": "tm_unrelated@example.com",
            "company_id": cls.company.id,
            "company_ids": [(6, 0, [cls.company.id])],
            "groups_id": [(6, 0, [
                cls.env.ref("base.group_user").id,
                cls.env.ref("hr_time_management.group_time_management_user").id,
            ])],
        })
        cls.unrelated_emp = cls.env["hr.employee"].create({
            "name": "Unrelated Employee",
            "user_id": cls.unrelated_user.id,
            "company_id": cls.company.id,
        })

        # Create Company B Fixtures for Cross-Company Isolation
        cls.company_b = cls.env["res.company"].create({"name": "Company B Test"})
        cls.company_b_user = cls.env["res.users"].create({
            "name": "Company B Employee User",
            "login": "comp_b_user",
            "email": "comp_b@example.com",
            "company_id": cls.company_b.id,
            "company_ids": [(6, 0, [cls.company_b.id])],
            "groups_id": [(6, 0, [
                cls.env.ref("base.group_user").id,
                cls.env.ref("hr_time_management.group_time_management_user").id,
            ])],
        })
        cls.company_b_emp = cls.env["hr.employee"].create({
            "name": "Company B Employee",
            "user_id": cls.company_b_user.id,
            "company_id": cls.company_b.id,
        })

    def test_01_tm_role_resolution(self):
        """Test central role helper returns correct role tier for each group."""
        Policy = self.env["cleon.time.policy"]

        self.assertEqual(Policy._tm_role(self.env.ref("base.user_admin")), "system_admin")
        self.assertEqual(Policy._tm_role(self.hr_admin_user), "hr_admin")
        self.assertEqual(Policy._tm_role(self.hr_manager_user), "hr_manager")
        self.assertEqual(Policy._tm_role(self.line_manager_user), "line_manager")
        self.assertEqual(Policy._tm_role(self.employee_user), "employee")

    def test_02_tm_scope_employee_ids(self):
        """Test employee scope resolution for line manager vs employee vs HR manager."""
        Policy = self.env["cleon.time.policy"]

        # Ordinary employee should only see own employee record
        emp_scope = Policy._tm_scope_employee_ids(self.employee_user)
        self.assertIn(self.report_emp.id, emp_scope)
        self.assertNotIn(self.manager_emp.id, emp_scope)

        # Line Manager should see self + direct reports (but not unrelated employee)
        mgr_scope = Policy._tm_scope_employee_ids(self.line_manager_user)
        self.assertIn(self.manager_emp.id, mgr_scope)
        self.assertIn(self.report_emp.id, mgr_scope)
        self.assertNotIn(self.unrelated_emp.id, mgr_scope)

        # HR Manager sees all active company employees
        hr_scope = Policy._tm_scope_employee_ids(self.hr_manager_user)
        self.assertIn(self.report_emp.id, hr_scope)
        self.assertIn(self.manager_emp.id, hr_scope)
        self.assertIn(self.unrelated_emp.id, hr_scope)

    def test_03_tm_capabilities_registry(self):
        """Test capability registry returns structured capabilities dictionary."""
        Policy = self.env["cleon.time.policy"]
        capabilities = Policy._tm_capabilities()

        self.assertIsInstance(capabilities, dict)
        self.assertIn("payroll", capabilities)
        self.assertIn("sales_timesheet", capabilities)
        self.assertIn("project", capabilities)
        self.assertIn("leave", capabilities)
        self.assertIn("gps_configured", capabilities)
        self.assertIn("browser_geolocation_supported", capabilities)
        self.assertIn("biometric_configured", capabilities)
        self.assertIn("webauthn_supported_by_app", capabilities)
        self.assertIn("biometric_terminal_connector", capabilities)
        self.assertFalse(capabilities["biometric_terminal_connector"])

    def test_04_configuration_authorization(self):
        """Test that HR Admin and System Admin can configure, but Line Manager and Employee cannot."""
        Policy = self.env["cleon.time.policy"]

        self.assertTrue(Policy._tm_can_configure(self.hr_admin_user))
        self.assertTrue(Policy._tm_can_configure(self.env.ref("base.user_admin")))
        self.assertFalse(Policy._tm_can_configure(self.line_manager_user))
        self.assertFalse(Policy._tm_can_configure(self.employee_user))
        self.assertFalse(Policy._tm_can_configure(self.hr_manager_user))

    def test_05_line_manager_self_approval_denied(self):
        """Test that Line Manager cannot approve their own regularization request."""
        Policy = self.env["cleon.time.policy"]

        # Create regularization request for Line Manager
        mgr_reg = self.env["cleon.attendance.regularization"].create({
            "employee_id": self.manager_emp.id,
            "attendance_date": "2026-08-10",
            "issue_type": "forgot_in",
            "requested_check_in": "2026-08-10 08:00:00",
            "requested_check_out": "2026-08-10 17:00:00",
            "reason": "I forgot to clock in this morning due to early meeting.",
        })
        mgr_reg.action_submit()

        # Line Manager attempting to approve own request must raise AccessError
        with self.assertRaises(AccessError):
            mgr_reg.with_user(self.line_manager_user).action_approve()

        # HR Manager should be allowed to approve Line Manager's request
        self.assertTrue(Policy._tm_can_approve(mgr_reg, self.hr_manager_user))

    def test_06_line_manager_subordinate_approval_allowed(self):
        """Test that Line Manager can approve a direct subordinate's regularization request."""
        Policy = self.env["cleon.time.policy"]

        # Create regularization request for Direct Report Employee
        sub_reg = self.env["cleon.attendance.regularization"].create({
            "employee_id": self.report_emp.id,
            "attendance_date": "2026-08-11",
            "issue_type": "forgot_in",
            "requested_check_in": "2026-08-11 08:30:00",
            "requested_check_out": "2026-08-11 17:30:00",
            "reason": "Forgot to clock in after site inspection.",
        })
        sub_reg.action_submit()

        # Line Manager should be allowed to approve subordinate's request
        self.assertTrue(Policy._tm_can_approve(sub_reg, self.line_manager_user))
        sub_reg.with_user(self.line_manager_user).action_approve()
        self.assertEqual(sub_reg.state, "approved")

    def test_07_unrelated_employee_approval_denied_to_line_manager(self):
        """Test that Line Manager cannot approve an unrelated employee's request."""
        Policy = self.env["cleon.time.policy"]

        unrelated_reg = self.env["cleon.attendance.regularization"].create({
            "employee_id": self.unrelated_emp.id,
            "attendance_date": "2026-08-12",
            "issue_type": "forgot_in",
            "requested_check_in": "2026-08-12 08:00:00",
            "requested_check_out": "2026-08-12 17:00:00",
            "reason": "I forgot to clock in this morning due to offsite client meeting.",
        })
        unrelated_reg.action_submit()

        # Line Manager should NOT be able to approve unrelated employee
        self.assertFalse(Policy._tm_can_approve(unrelated_reg, self.line_manager_user))
        with self.assertRaises(AccessError):
            unrelated_reg.with_user(self.line_manager_user).action_approve()

    def test_08_cross_company_isolation(self):
        """Test global company rules prevent access to records across company boundaries."""
        comp_b_reg = self.env["cleon.attendance.regularization"].create({
            "employee_id": self.company_b_emp.id,
            "company_id": self.company_b.id,
            "attendance_date": "2026-08-12",
            "issue_type": "forgot_in",
            "requested_check_in": "2026-08-12 08:00:00",
            "requested_check_out": "2026-08-12 17:00:00",
            "reason": "Company B employee forgot clock in.",
        })
        # User from Company A (employee_user) cannot read Company B record
        visible_regs = self.env["cleon.attendance.regularization"].with_user(self.employee_user).search([("id", "=", comp_b_reg.id)])
        self.assertNotIn(comp_b_reg, visible_regs)

    def test_09_line_manager_audit_log_denied(self):
        """Test that Line Manager cannot read audit log records."""
        audit_log = self.env["cleon.time.audit.log"].create({
            "action": "approved",
            "company_id": self.company.id,
        })
        with self.assertRaises(AccessError):
            self.env["cleon.time.audit.log"].with_user(self.line_manager_user).search([("id", "=", audit_log.id)])

    def test_10_timesheet_self_approval_denied(self):
        """Test that Line Manager cannot approve their own timesheet."""
        Policy = self.env["cleon.time.policy"]
        mgr_sheet = self.env["cleon.time.sheet"].create({
            "employee_id": self.manager_emp.id,
            "week_start": "2026-08-17",
            "company_id": self.company.id,
        })
        self.env["cleon.time.sheet.line"].create({
            "sheet_id": mgr_sheet.id,
            "date": "2026-08-17",
            "hours": 8.0,
            "description": "Standard work day",
        })
        mgr_sheet.action_submit()
        self.assertFalse(Policy._tm_can_approve(mgr_sheet, self.line_manager_user))
        with self.assertRaises(AccessError):
            mgr_sheet.with_user(self.line_manager_user).action_decide("approve")

    def test_11_overtime_self_approval_denied(self):
        """Test that Line Manager cannot approve their own overtime request."""
        Policy = self.env["cleon.time.policy"]
        mgr_ot = self.env["cleon.overtime.request"].create({
            "employee_id": self.manager_emp.id,
            "date": "2026-08-15",
            "overtime_hours": 3.0,
            "justification": "Weekend project deadline",
            "company_id": self.company.id,
            "state": "submitted",
        })
        self.assertFalse(Policy._tm_can_approve(mgr_ot, self.line_manager_user))
        with self.assertRaises(AccessError):
            mgr_ot.with_user(self.line_manager_user).action_decide("approve")


