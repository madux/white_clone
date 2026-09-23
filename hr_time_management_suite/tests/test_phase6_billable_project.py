# -*- coding: utf-8 -*-
from datetime import datetime, timedelta

from odoo import fields
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tests.common import TransactionCase


class TestPhase6BillableProject(TransactionCase):

    def setUp(self):
        super().setUp()
        self.company = self.env.company
        self.company.write({"name": "Test Phase6 Company"})

        # Group refs
        self.group_user = self.env.ref("hr_time_management.group_time_management_user")
        self.group_line_mgr = self.env.ref("hr_time_management.group_time_management_line_manager")
        self.group_hr_mgr = self.env.ref("hr_time_management.group_time_management_hr_manager")
        self.group_hr_admin = self.env.ref("hr_time_management.group_time_management_hr_admin")

        # Line Manager User & Employee
        self.manager_user = self.env["res.users"].create({
            "name": "P6 Line Manager",
            "login": "p6_line_mgr",
            "email": "p6_mgr@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_line_mgr.id])],
        })
        self.manager_emp = self.env["hr.employee"].create({
            "name": "P6 Line Manager Emp",
            "user_id": self.manager_user.id,
            "company_id": self.company.id,
        })

        # Subordinate User & Employee with Hourly Cost $50
        self.emp_user = self.env["res.users"].create({
            "name": "P6 Subordinate User",
            "login": "p6_sub_user",
            "email": "p6_sub@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_user.id])],
        })
        self.sub_emp = self.env["hr.employee"].create({
            "name": "P6 Subordinate Emp",
            "user_id": self.emp_user.id,
            "parent_id": self.manager_emp.id,
            "company_id": self.company.id,
            "hourly_cost": 50.0,
        })

        # Policy definition with default billing rate $150
        self.policy = self.env["cleon.time.policy"].search([("company_id", "=", self.company.id)], limit=1)
        policy_vals = {
            "company_id": self.company.id,
            "default_billing_rate": 150.0,
            "overtime_request_mode": "both",
        }
        if not self.policy:
            self.policy = self.env["cleon.time.policy"].create(policy_vals)
        else:
            self.policy.write(policy_vals)

        # Projects and Tasks
        self.project_a = self.env["project.project"].create({
            "name": "P6 Project Alpha",
            "company_id": self.company.id,
            "allow_timesheets": True,
        })
        self.task_a1 = self.env["project.task"].create({
            "name": "P6 Task A1",
            "project_id": self.project_a.id,
            "company_id": self.company.id,
        })
        self.project_b = self.env["project.project"].create({
            "name": "P6 Project Beta",
            "company_id": self.company.id,
            "allow_timesheets": True,
        })
        self.task_b1 = self.env["project.task"].create({
            "name": "P6 Task B1",
            "project_id": self.project_b.id,
            "company_id": self.company.id,
        })

    def test_01_native_project_task_inference(self):
        """Test creating an analytic line with task_id automatically infers project_id."""
        AAL = self.env["account.analytic.line"].sudo()
        line = AAL.create({
            "name": "Development Task A1",
            "employee_id": self.sub_emp.id,
            "date": "2026-08-10",
            "unit_amount": 4.0,
            "task_id": self.task_a1.id,
        })
        self.assertEqual(line.project_id.id, self.project_a.id)

    def test_02_native_project_change_reconciliation(self):
        """Test changing project to an incompatible project follows native Odoo task reconciliation."""
        AAL = self.env["account.analytic.line"].sudo()
        line = AAL.create({
            "name": "Task Line for Project Swap",
            "employee_id": self.sub_emp.id,
            "date": "2026-08-10",
            "unit_amount": 4.0,
            "task_id": self.task_a1.id,
        })
        self.assertEqual(line.project_id.id, self.project_a.id)
        self.assertEqual(line.task_id.id, self.task_a1.id)

        # Change project_id to Project B (which is incompatible with Task A1)
        line.write({"project_id": self.project_b.id})
        self.assertEqual(line.project_id.id, self.project_b.id)
        # Native Odoo clears or reconciles task_id when project changes to an incompatible one
        self.assertFalse(line.task_id and line.task_id.project_id != self.project_b)

    def test_03_server_authoritative_snapshot_creation(self):
        """Test client-supplied forged snapshot rate is stripped and replaced with authoritative server value."""
        AAL = self.env["account.analytic.line"].with_user(self.emp_user)

        # Employee attempts to pass forged $5000 rate on create
        line = AAL.create({
            "name": "Forged Rate Attempt Line",
            "employee_id": self.sub_emp.id,
            "project_id": self.project_a.id,
            "date": "2026-08-10",
            "unit_amount": 5.0,
            "cleon_billable": True,
            "cleon_billable_rate": 5000.0,
            "cleon_labor_cost_rate": 999.0,
        })

        # Server MUST replace forged rates with authoritative values ($150 policy rate, $50 employee cost)
        line_admin = line.sudo()
        self.assertEqual(line_admin.cleon_billable_rate, 150.0)
        self.assertEqual(line_admin.cleon_labor_cost_rate, 50.0)
        self.assertEqual(line_admin.estimated_billable_amount, 750.0)
        self.assertEqual(line_admin.estimated_labor_cost, 250.0)

    def test_04_snapshot_write_tampering_blocked(self):
        """Test employee ORM write attempting to tamper with snapshot rate fields is rejected."""
        AAL = self.env["account.analytic.line"].sudo()
        line = AAL.create({
            "name": "Line for Snapshot Write Tampering Test",
            "employee_id": self.sub_emp.id,
            "project_id": self.project_a.id,
            "date": "2026-08-10",
            "unit_amount": 5.0,
        })

        # Attempt to modify snapshot billable rate via ORM write -> AccessError
        with self.assertRaises(AccessError):
            line.with_user(self.emp_user).write({"cleon_billable_rate": 999.0})

        with self.assertRaises(AccessError):
            line.with_user(self.emp_user).write({"cleon_labor_cost_rate": 999.0})

    def test_05_rate_snapshot_stability(self):
        """Test modifying policy default billing rate or employee hourly cost does NOT alter snapshot rates on existing AAL lines."""
        AAL = self.env["account.analytic.line"].sudo()
        line = AAL.create({
            "name": "Snapshot Stability Test Line",
            "employee_id": self.sub_emp.id,
            "project_id": self.project_a.id,
            "date": "2026-08-10",
            "unit_amount": 5.0,
            "cleon_billable": True,
        })

        # Pre-change valuations
        line_admin = line.sudo()
        self.assertEqual(line_admin.cleon_billable_rate, 150.0)
        self.assertEqual(line_admin.cleon_labor_cost_rate, 50.0)
        self.assertEqual(line_admin.estimated_billable_amount, 750.0)
        self.assertEqual(line_admin.estimated_labor_cost, 250.0)

        # Modify policy default billing rate and employee hourly cost
        self.policy.write({"default_billing_rate": 250.0})
        self.sub_emp.write({"hourly_cost": 80.0})

        # Re-evaluating existing line MUST NOT alter stored snapshot rates
        line_admin.invalidate_recordset()
        self.assertEqual(line_admin.cleon_billable_rate, 150.0)
        self.assertEqual(line_admin.cleon_labor_cost_rate, 50.0)
        self.assertEqual(line_admin.estimated_billable_amount, 750.0)
        self.assertEqual(line_admin.estimated_labor_cost, 250.0)

    def test_06_weekly_envelope_financial_aggregation(self):
        """Test cleon.time.sheet weekly envelope aggregates billable hours, total billable amount, and total labor cost."""
        AAL = self.env["account.analytic.line"].sudo()

        line1 = AAL.create({
            "name": "Task Line 1",
            "employee_id": self.sub_emp.id,
            "project_id": self.project_a.id,
            "date": "2026-08-10",  # Monday
            "unit_amount": 8.0,
            "cleon_billable": True,
        })
        line2 = AAL.create({
            "name": "Task Line 2",
            "employee_id": self.sub_emp.id,
            "project_id": self.project_a.id,
            "date": "2026-08-11",  # Tuesday
            "unit_amount": 4.0,
            "cleon_billable": False,
        })

        # Create weekly timesheet envelope
        sheet = self.env["cleon.time.sheet"].sudo().create({
            "employee_id": self.sub_emp.id,
            "week_start": "2026-08-10",
        })
        sheet.action_submit()

        self.assertEqual(sheet.total_hours, 12.0)
        self.assertEqual(sheet.billable_hours, 8.0)
        self.assertEqual(sheet.total_billable_amount, 8.0 * 150.0)  # 1200.0
        self.assertEqual(sheet.total_labor_cost, 12.0 * 50.0)       # 600.0

    def test_07_complete_security_field_access_protection(self):
        """Test Employee and Line Manager CANNOT read any financial fields, while HR Manager, HR Admin, and System Admin CAN."""
        AAL = self.env["account.analytic.line"].sudo()
        line = AAL.create({
            "name": "Confidential Financial Data Line",
            "employee_id": self.sub_emp.id,
            "project_id": self.project_a.id,
            "date": "2026-08-10",
            "unit_amount": 5.0,
            "cleon_billable": True,
        })

        # 1. Employee ORM read of ANY financial rate or amount -> AccessError
        financial_fields = ["cleon_billable_rate", "cleon_labor_cost_rate", "estimated_billable_amount", "estimated_labor_cost"]
        for f in financial_fields:
            with self.assertRaises(AccessError):
                line.with_user(self.emp_user).read([f])

        # 2. Line Manager ORM read of ANY financial rate or amount -> AccessError
        for f in financial_fields:
            with self.assertRaises(AccessError):
                line.with_user(self.manager_user).read([f])

        # 3. Line Manager get_tracking_data omits financial totals from BOTH rows AND kpis
        sheet = self.env["cleon.time.sheet"].sudo().create({
            "employee_id": self.sub_emp.id,
            "week_start": "2026-08-10",
        })
        tracking_lm = self.env["cleon.time.sheet"].with_user(self.manager_user).get_tracking_data()
        for r in tracking_lm.get("rows", []):
            self.assertNotIn("total_billable_amount", r)
            self.assertNotIn("total_labor_cost", r)
        self.assertNotIn("total_billable_amount", tracking_lm.get("kpis", {}))
        self.assertNotIn("total_labor_cost", tracking_lm.get("kpis", {}))

        # 4. HR Manager user CAN read financial fields
        ts_mgr_group = self.env.ref("hr_timesheet.group_hr_timesheet_approver", raise_if_not_found=False) or self.env.ref("base.group_system")
        groups_hr_mgr = [self.env.ref("base.group_user").id, self.group_hr_mgr.id, ts_mgr_group.id]

        hr_mgr_user = self.env["res.users"].create({
            "name": "P6 HR Manager User",
            "login": "p6_hr_mgr_usr",
            "email": "p6_hrmgr@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, groups_hr_mgr)],
        })
        self.env["hr.employee"].create({
            "name": "P6 HR Manager Emp",
            "user_id": hr_mgr_user.id,
            "company_id": self.company.id,
        })
        line_hr_read = line.with_user(hr_mgr_user).read(["cleon_billable_rate", "cleon_labor_cost_rate", "estimated_billable_amount", "estimated_labor_cost"])
        self.assertEqual(line_hr_read[0]["cleon_billable_rate"], 150.0)
        self.assertEqual(line_hr_read[0]["cleon_labor_cost_rate"], 50.0)
        self.assertEqual(line_hr_read[0]["estimated_billable_amount"], 750.0)
        self.assertEqual(line_hr_read[0]["estimated_labor_cost"], 250.0)

        # 5. HR Admin user CAN read financial fields
        groups_hr_admin = [self.env.ref("base.group_user").id, self.group_hr_admin.id, ts_mgr_group.id]
        hr_admin_user = self.env["res.users"].create({
            "name": "P6 HR Admin User",
            "login": "p6_hr_admin_usr",
            "email": "p6_hradmin@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, groups_hr_admin)],
        })
        self.env["hr.employee"].create({
            "name": "P6 HR Admin Emp",
            "user_id": hr_admin_user.id,
            "company_id": self.company.id,
        })
        line_admin_read = line.with_user(hr_admin_user).read(["cleon_billable_rate", "cleon_labor_cost_rate"])
        self.assertEqual(line_admin_read[0]["cleon_billable_rate"], 150.0)
        self.assertEqual(line_admin_read[0]["cleon_labor_cost_rate"], 50.0)

        # 6. System Admin user CAN read financial fields
        sys_admin_user = self.env.ref("base.user_admin")
        line_sys_read = line.with_user(sys_admin_user).read(["cleon_billable_rate", "cleon_labor_cost_rate"])
        self.assertEqual(line_sys_read[0]["cleon_billable_rate"], 150.0)
        self.assertEqual(line_sys_read[0]["cleon_labor_cost_rate"], 50.0)

    def test_08_implicit_company_resolution_post_create_period_lock(self):
        """Test creating AAL without explicit company_id resolves company_id post-create and enforces period lock."""
        # Create a period lock for August 2026
        self.env["cleon.time.period.lock"].sudo().create({
            "company_id": self.company.id,
            "date_from": "2026-08-01",
            "date_to": "2026-08-31",
            "state": "locked",
            "reason": "August Period Lock",
        })

        AAL = self.env["account.analytic.line"].with_user(self.emp_user)
        # Pass locked date and employee_id without passing company_id explicitly
        with self.assertRaises(UserError):
            AAL.create({
                "name": "Locked Period Attempt Line",
                "employee_id": self.sub_emp.id,
                "date": "2026-08-15",
                "unit_amount": 4.0,
            })

    def test_09_identity_reassignment_resnapshots(self):
        """Test re-assigning employee or company on draft AAL refreshes snapshot rates from new identity."""
        AAL = self.env["account.analytic.line"].sudo()

        # Create Employee B with hourly_cost $80
        emp_b = self.env["hr.employee"].create({
            "name": "P6 Employee B",
            "company_id": self.company.id,
            "hourly_cost": 80.0,
        })

        # Create line initially assigned to sub_emp ($50/h, $150/h billable)
        line = AAL.create({
            "name": "Reassignment Test Line",
            "employee_id": self.sub_emp.id,
            "project_id": self.project_a.id,
            "date": "2026-08-10",
            "unit_amount": 5.0,
            "cleon_billable": True,
        })
        self.assertEqual(line.cleon_labor_cost_rate, 50.0)
        self.assertEqual(line.cleon_billable_rate, 150.0)

        # 1. Re-assign employee_id to Employee B ($80/h)
        line.write({"employee_id": emp_b.id})
        self.assertEqual(line.cleon_labor_cost_rate, 80.0)
        self.assertEqual(line.estimated_labor_cost, 400.0)

        # 2. Company B policy with default billing rate $250
        company_b = self.env["res.company"].create({"name": "P6 Company B"})
        self.env["cleon.time.policy"].create({
            "company_id": company_b.id,
            "default_billing_rate": 250.0,
        })
        project_c_b = self.env["project.project"].create({
            "name": "P6 Project Company B",
            "company_id": company_b.id,
            "allow_timesheets": True,
        })

        # Move line to Company B
        line.write({"company_id": company_b.id, "project_id": project_c_b.id})
        self.assertEqual(line.cleon_billable_rate, 250.0)
        self.assertEqual(line.estimated_billable_amount, 1250.0)

        # 3. Create line without employee, then assign employee_id post-create
        plan_line = AAL.create({
            "name": "Generic Non-Employee Analytic Line",
            "date": "2026-08-10",
            "unit_amount": 2.0,
        })
        self.assertEqual(plan_line.cleon_labor_cost_rate, 0.0)

        # Assign sub_emp post-create -> captures snapshots
        plan_line.write({"employee_id": self.sub_emp.id})
        self.assertEqual(plan_line.cleon_labor_cost_rate, 50.0)
        self.assertEqual(plan_line.estimated_labor_cost, 100.0)
