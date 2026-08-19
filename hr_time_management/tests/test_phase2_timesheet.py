# -*- coding: utf-8 -*-
from odoo.tests import TransactionCase, tagged
from odoo.exceptions import AccessError, ValidationError


@tagged("post_install", "-at_install", "phase2")
class TestPhase2Timesheet(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.company = cls.env.company

        # Create Employee User
        cls.employee_user = cls.env["res.users"].create({
            "name": "Phase2 Employee User",
            "login": "p2_employee_user",
            "email": "p2_emp@example.com",
            "company_id": cls.company.id,
            "company_ids": [(6, 0, [cls.company.id])],
            "groups_id": [(6, 0, [
                cls.env.ref("base.group_user").id,
                cls.env.ref("hr_time_management.group_time_management_user").id,
            ])],
        })

        # Create Line Manager User
        cls.manager_user = cls.env["res.users"].create({
            "name": "Phase2 Manager User",
            "login": "p2_manager_user",
            "email": "p2_mgr@example.com",
            "company_id": cls.company.id,
            "company_ids": [(6, 0, [cls.company.id])],
            "groups_id": [(6, 0, [
                cls.env.ref("base.group_user").id,
                cls.env.ref("hr_time_management.group_time_management_line_manager").id,
            ])],
        })

        # Create HR Employee Records
        cls.manager_emp = cls.env["hr.employee"].create({
            "name": "Phase2 Manager Employee",
            "user_id": cls.manager_user.id,
            "company_id": cls.company.id,
        })
        cls.emp = cls.env["hr.employee"].create({
            "name": "Phase2 Employee Record",
            "user_id": cls.employee_user.id,
            "parent_id": cls.manager_emp.id,
            "company_id": cls.company.id,
        })
        cls.employee_user.invalidate_recordset()
        cls.manager_user.invalidate_recordset()
        cls.plan = cls.env["account.analytic.plan"].create({
            "name": "Phase2 Test Plan",
        })
        cls.analytic_account = cls.env["account.analytic.account"].create({
            "name": "Phase2 Test Analytic Account",
            "plan_id": cls.plan.id,
            "company_id": cls.company.id,
        })
        cls.project = cls.env["project.project"].create({
            "name": "Phase2 Test Project",
            "company_id": cls.company.id,
            "analytic_account_id": cls.analytic_account.id,
        })

    def test_01_analytic_line_envelope_linking_and_locking(self):
        """Test candidate analytic lines link to envelope on submit and lock against modification."""
        # Create candidate analytic lines for Monday 2026-08-17
        line1 = self.env["account.analytic.line"].create({
            "name": "Backend feature implementation",
            "project_id": self.project.id,
            "account_id": self.analytic_account.id,
            "date": "2026-08-17",
            "unit_amount": 5.0,
            "employee_id": self.emp.id,
            "user_id": self.employee_user.id,
            "company_id": self.company.id,
            "cleon_billable": True,
        })
        line2 = self.env["account.analytic.line"].create({
            "name": "Internal documentation review",
            "project_id": self.project.id,
            "account_id": self.analytic_account.id,
            "date": "2026-08-18",
            "unit_amount": 3.0,
            "employee_id": self.emp.id,
            "user_id": self.employee_user.id,
            "company_id": self.company.id,
            "cleon_billable": False,
        })

        # Create weekly sheet starting Monday 2026-08-17
        sheet = self.env["cleon.time.sheet"].create({
            "employee_id": self.emp.id,
            "week_start": "2026-08-17",
            "company_id": self.company.id,
        })

        # Submit weekly sheet
        sheet.with_user(self.employee_user).action_submit()

        # Lines should now be linked to sheet
        self.assertEqual(line1.cleon_sheet_id, sheet)
        self.assertEqual(line2.cleon_sheet_id, sheet)
        self.assertTrue(line1.cleon_locked)
        self.assertTrue(line2.cleon_locked)

        # Computed envelope totals
        self.assertEqual(sheet.total_hours, 8.0)
        self.assertEqual(sheet.billable_hours, 5.0)

        # Attempting to edit or delete locked line as employee must raise AccessError
        with self.assertRaises(AccessError):
            line1.with_user(self.employee_user).write({"unit_amount": 10.0})

        with self.assertRaises(AccessError):
            line2.with_user(self.employee_user).unlink()

    def test_02_withdraw_and_reopen_unlocks_lines(self):
        """Test withdrawing a submitted timesheet unlocks analytic entries."""
        line = self.env["account.analytic.line"].create({
            "name": "Client code review",
            "project_id": self.project.id,
            "account_id": self.analytic_account.id,
            "date": "2026-08-17",
            "unit_amount": 4.0,
            "employee_id": self.emp.id,
            "user_id": self.employee_user.id,
            "company_id": self.company.id,
        })

        sheet = self.env["cleon.time.sheet"].create({
            "employee_id": self.emp.id,
            "week_start": "2026-08-17",
            "company_id": self.company.id,
        })

        sheet.with_user(self.employee_user).action_submit()
        self.assertTrue(line.cleon_locked)

        # Withdraw timesheet
        sheet.with_user(self.employee_user).action_withdraw()
        self.assertFalse(line.cleon_locked)
        self.assertFalse(line.cleon_sheet_id)

        # Employee can now modify the unlocked line
        line.with_user(self.employee_user).write({"unit_amount": 6.0})
        self.assertEqual(line.unit_amount, 6.0)
