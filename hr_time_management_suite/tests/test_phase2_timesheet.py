# -*- coding: utf-8 -*-
from odoo.tests import TransactionCase, tagged
from odoo.exceptions import AccessError, ValidationError


@tagged("post_install", "-at_install", "phase2")
class TestPhase2Timesheet(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.company = cls.env.company

        # Create Employee User 1
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

        # Create Employee User 2
        cls.emp2_user = cls.env["res.users"].create({
            "name": "Phase2 Employee User 2",
            "login": "p2_emp2_user",
            "email": "p2_emp2@example.com",
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
            "name": "Phase2 Employee Record 1",
            "user_id": cls.employee_user.id,
            "parent_id": cls.manager_emp.id,
            "company_id": cls.company.id,
        })
        cls.emp2 = cls.env["hr.employee"].create({
            "name": "Phase2 Employee Record 2",
            "user_id": cls.emp2_user.id,
            "parent_id": cls.manager_emp.id,
            "company_id": cls.company.id,
        })
        cls.employee_user.invalidate_recordset()
        cls.emp2_user.invalidate_recordset()
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

        sheet = self.env["cleon.time.sheet"].create({
            "employee_id": self.emp.id,
            "week_start": "2026-08-17",
            "company_id": self.company.id,
        })

        sheet.with_user(self.employee_user).action_submit()

        self.assertEqual(line1.cleon_sheet_id, sheet)
        self.assertEqual(line2.cleon_sheet_id, sheet)
        self.assertTrue(line1.cleon_locked)
        self.assertTrue(line2.cleon_locked)

        self.assertEqual(sheet.total_hours, 8.0)
        self.assertEqual(sheet.billable_hours, 5.0)

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

        sheet.with_user(self.employee_user).action_withdraw()
        self.assertFalse(line.cleon_locked)
        self.assertFalse(line.cleon_sheet_id)

        line.with_user(self.employee_user).write({"unit_amount": 6.0})
        self.assertEqual(line.unit_amount, 6.0)

    def test_03_prospective_employee_write_lock_validation(self):
        """Test write() validating prospective employee_id prevents transferring lines into another employee's submitted week."""
        # Employee 2 submits week of 2026-08-17
        sheet2 = self.env["cleon.time.sheet"].create({
            "employee_id": self.emp2.id,
            "week_start": "2026-08-17",
            "company_id": self.company.id,
        })
        line2 = self.env["account.analytic.line"].create({
            "name": "Emp2 initial work",
            "project_id": self.project.id,
            "account_id": self.analytic_account.id,
            "date": "2026-08-17",
            "unit_amount": 4.0,
            "employee_id": self.emp2.id,
            "user_id": self.emp2_user.id,
            "company_id": self.company.id,
        })
        sheet2.with_user(self.emp2_user).action_submit()

        # Employee 1 has an unsubmitted line on 2026-08-17
        line1 = self.env["account.analytic.line"].create({
            "name": "Emp1 draft work",
            "project_id": self.project.id,
            "account_id": self.analytic_account.id,
            "date": "2026-08-17",
            "unit_amount": 3.0,
            "employee_id": self.emp.id,
            "user_id": self.employee_user.id,
            "company_id": self.company.id,
        })

        # Attempting to change line1's employee_id to Employee 2 must be denied by prospective check
        with self.assertRaises(AccessError):
            line1.with_user(self.employee_user).write({"employee_id": self.emp2.id})

    def test_04_client_context_bypass_flag_cannot_bypass_lock(self):
        """Test non-admin user passing _cleon_internal_lock_bypass context flag is rejected."""
        line = self.env["account.analytic.line"].create({
            "name": "Task work",
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

        # Passing _cleon_internal_lock_bypass as non-admin user must still raise AccessError
        with self.assertRaises(AccessError):
            line.with_user(self.employee_user).with_context(_cleon_internal_lock_bypass=True).write({"unit_amount": 10.0})

    def test_05_legacy_lines_migration_helper(self):
        """Test action_migrate_legacy_lines idempotently converts legacy lines to analytic lines without losing hours."""
        sheet = self.env["cleon.time.sheet"].create({
            "employee_id": self.emp.id,
            "week_start": "2026-08-17",
            "company_id": self.company.id,
            "entry_source": "legacy",
            "line_ids": [
                (0, 0, {"date": "2026-08-17", "description": "Legacy Task 1", "hours": 4.0, "billable": True, "project_id": self.project.id}),
                (0, 0, {"date": "2026-08-18", "description": "Legacy Task 2", "hours": 3.5, "billable": False, "project_id": self.project.id}),
            ],
        })
        self.assertEqual(sheet.total_hours, 7.5)
        self.assertEqual(sheet.billable_hours, 4.0)

        # Migrate legacy lines
        sheet.action_migrate_legacy_lines()
        self.assertEqual(sheet.entry_source, "analytic")
        self.assertEqual(len(sheet.analytic_line_ids), 2)
        self.assertEqual(sheet.total_hours, 7.5)
        self.assertEqual(sheet.billable_hours, 4.0)
        self.assertTrue(all(l.cleon_sheet_id == sheet for l in sheet.analytic_line_ids))
