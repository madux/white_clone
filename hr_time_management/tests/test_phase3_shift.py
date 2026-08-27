# -*- coding: utf-8 -*-
from datetime import timedelta
from odoo import fields
from odoo.tests import TransactionCase, tagged
from odoo.exceptions import AccessError, ValidationError


@tagged("post_install", "-at_install", "phase3")
class TestPhase3Shift(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.company = cls.env.company

        # Company B for cross-company isolation tests
        cls.company_b = cls.env["res.company"].create({
            "name": "Phase3 Secondary Company B",
        })

        # System Admin User
        cls.admin_user = cls.env.ref("base.user_admin")

        # HR Manager User
        cls.hr_manager_user = cls.env["res.users"].create({
            "name": "Phase3 HR Manager User",
            "login": "p3_hr_mgr_user",
            "email": "p3_hrmgr@example.com",
            "company_id": cls.company.id,
            "company_ids": [(6, 0, [cls.company.id])],
            "groups_id": [(6, 0, [
                cls.env.ref("base.group_user").id,
                cls.env.ref("hr_time_management.group_time_management_hr_manager").id,
            ])],
        })

        # Line Manager User
        cls.manager_user = cls.env["res.users"].create({
            "name": "Phase3 Manager User",
            "login": "p3_mgr_user",
            "email": "p3_mgr@example.com",
            "company_id": cls.company.id,
            "company_ids": [(6, 0, [cls.company.id])],
            "groups_id": [(6, 0, [
                cls.env.ref("base.group_user").id,
                cls.env.ref("hr_time_management.group_time_management_line_manager").id,
            ])],
        })

        # Employee 1 User
        cls.emp_user = cls.env["res.users"].create({
            "name": "Phase3 Employee User 1",
            "login": "p3_emp_user_1",
            "email": "p3_emp1@example.com",
            "company_id": cls.company.id,
            "company_ids": [(6, 0, [cls.company.id])],
            "groups_id": [(6, 0, [
                cls.env.ref("base.group_user").id,
                cls.env.ref("hr_time_management.group_time_management_user").id,
            ])],
        })

        # Employee 2 User (Peer)
        cls.peer_user = cls.env["res.users"].create({
            "name": "Phase3 Peer User 2",
            "login": "p3_peer_user_2",
            "email": "p3_peer2@example.com",
            "company_id": cls.company.id,
            "company_ids": [(6, 0, [cls.company.id])],
            "groups_id": [(6, 0, [
                cls.env.ref("base.group_user").id,
                cls.env.ref("hr_time_management.group_time_management_user").id,
            ])],
        })

        # Employee User Company B
        cls.comp_b_user = cls.env["res.users"].create({
            "name": "Phase3 Comp B User",
            "login": "p3_comp_b_user",
            "email": "p3_compb@example.com",
            "company_id": cls.company_b.id,
            "company_ids": [(6, 0, [cls.company_b.id])],
            "groups_id": [(6, 0, [
                cls.env.ref("base.group_user").id,
                cls.env.ref("hr_time_management.group_time_management_user").id,
            ])],
        })

        # Create HR Employee Records
        cls.manager_emp = cls.env["hr.employee"].create({
            "name": "Phase3 Manager Employee",
            "user_id": cls.manager_user.id,
            "company_id": cls.company.id,
        })
        cls.emp = cls.env["hr.employee"].create({
            "name": "Phase3 Employee Record 1",
            "user_id": cls.emp_user.id,
            "parent_id": cls.manager_emp.id,
            "company_id": cls.company.id,
        })
        cls.peer_emp = cls.env["hr.employee"].create({
            "name": "Phase3 Peer Employee Record 2",
            "user_id": cls.peer_user.id,
            "parent_id": cls.manager_emp.id,
            "company_id": cls.company.id,
        })
        cls.comp_b_emp = cls.env["hr.employee"].create({
            "name": "Phase3 Comp B Employee",
            "user_id": cls.comp_b_user.id,
            "company_id": cls.company_b.id,
        })

        cls.env["res.users"].invalidate_model()
        cls.env["hr.employee"].invalidate_model()

    def test_01_shift_template_permissions_and_system_admin(self):
        """Test global shift template configuration permission (HR Manager/Admin/System Admin) and line manager denial."""
        shift_admin = self.env["cleon.hr.shift"].with_user(self.admin_user).create({
            "name": "P3 Test01 Admin Shift",
            "code": "P3T1-ADM",
            "start_hour": 8.0,
            "end_hour": 16.0,
            "company_id": self.company.id,
        })
        self.assertTrue(shift_admin.id)

        shift_hr = self.env["cleon.hr.shift"].with_user(self.hr_manager_user).create({
            "name": "P3 Test01 HR Shift",
            "code": "P3T1-HR",
            "start_hour": 9.0,
            "end_hour": 17.0,
            "company_id": self.company.id,
        })
        self.assertTrue(shift_hr.id)

        with self.assertRaises(AccessError):
            self.env["cleon.hr.shift"].with_user(self.manager_user).create({
                "name": "P3 Test01 Line Mgr Shift",
                "code": "P3T1-LM",
                "start_hour": 10.0,
                "end_hour": 18.0,
                "company_id": self.company.id,
            })

    def test_02_owl_rpc_service_wrappers(self):
        """Test OWL RPC endpoints get_shift_management_data, save_shift, and create_shift_assignment."""
        # 1. save_shift via HR Manager
        res1 = self.env["cleon.hr.shift"].with_user(self.hr_manager_user).save_shift({
            "name": "RPC Morning Shift",
            "code": "RPC-MORN",
            "start_hour": 8.0,
            "end_hour": 16.0,
            "break_minutes": 60,
            "grace_minutes": 15,
            "shift_type": "fixed",
            "active_days": [0, 1, 2, 3, 4],
        })
        self.assertTrue(res1.get("id"))

        # 2. create_shift_assignment via Line Manager for subordinate
        res2 = self.env["cleon.hr.shift.assignment"].with_user(self.manager_user).create_shift_assignment({
            "shift_id": res1["id"],
            "employee_id": self.emp.id,
            "date_from": fields.Date.to_string(fields.Date.today()),
            "assignment_type": "standard",
            "note": "Assigned via RPC",
        })
        self.assertTrue(res2.get("id"))

        # 3. get_shift_management_data via Line Manager
        data = self.env["cleon.hr.shift"].with_user(self.manager_user).get_shift_management_data()
        self.assertTrue(isinstance(data.get("shifts"), list))
        self.assertTrue(isinstance(data.get("assignments"), list))
        self.assertTrue(isinstance(data.get("kpis"), dict))
        self.assertIn("total_shifts", data["kpis"])
        self.assertIn("active_employees", data["kpis"])
        self.assertIn("coverage_rate", data["kpis"])
        self.assertIn("pending_swaps", data["kpis"])
        self.assertTrue(any(s["id"] == res1["id"] for s in data["shifts"]))

    def test_03_segment_edit_resynchronizes_calendar(self):
        """Test editing a shift segment resynchronizes the parent resource.calendar."""
        split_shift = self.env["cleon.hr.shift"].with_user(self.hr_manager_user).create({
            "name": "P3 Test03 Split Resync",
            "code": "P3T3-RESYNC",
            "shift_type": "split",
            "company_id": self.company.id,
            "segment_ids": [
                (0, 0, {"name": "Morning", "sequence": 1, "start_hour": 8.0, "end_hour": 12.0}),
                (0, 0, {"name": "Evening", "sequence": 2, "start_hour": 16.0, "end_hour": 20.0}),
            ],
        })
        cal = split_shift.resource_calendar_id
        orig_count = len(cal.attendance_ids)

        # Edit segment evening hours (from 16-20 to 15-19)
        seg2 = split_shift.segment_ids.filtered(lambda s: s.name == "Evening")
        seg2.with_user(self.hr_manager_user).write({"start_hour": 15.0, "end_hour": 19.0})

        # Calendar attendances must reflect updated 15.0 start hour
        self.assertEqual(len(cal.attendance_ids), orig_count)
        self.assertTrue(any(a.hour_from == 15.0 for a in cal.attendance_ids))

    def test_04_line_manager_self_assignment_denied(self):
        """Test Line Manager is denied assigning a shift to themselves."""
        shift = self.env["cleon.hr.shift"].with_user(self.hr_manager_user).create({
            "name": "P3 Test04 Shift",
            "code": "P3T4-S",
            "start_hour": 9.0,
            "end_hour": 17.0,
            "company_id": self.company.id,
        })

        # Line Manager assigning shift to self must raise AccessError
        with self.assertRaises(AccessError):
            self.env["cleon.hr.shift.assignment"].with_user(self.manager_user).create({
                "shift_id": shift.id,
                "employee_id": self.manager_emp.id,
                "date_from": fields.Date.today(),
            })

    def test_05_prospective_assignment_target_write_validation(self):
        """Test write() validating prospective target employee prevents Line Manager re-assigning assignment to unrelated employee."""
        shift = self.env["cleon.hr.shift"].with_user(self.hr_manager_user).create({
            "name": "P3 Test05 Shift",
            "code": "P3T5-S",
            "start_hour": 9.0,
            "end_hour": 17.0,
            "company_id": self.company.id,
        })
        assignment = self.env["cleon.hr.shift.assignment"].with_user(self.manager_user).create({
            "shift_id": shift.id,
            "employee_id": self.emp.id,
            "date_from": fields.Date.today(),
        })

        # Line Manager attempting to edit employee_id to Company B Employee must raise AccessError
        with self.assertRaises(AccessError):
            assignment.with_user(self.manager_user).write({"employee_id": self.comp_b_emp.id})

    def test_06_shift_swap_lifecycle_and_peer_acceptance(self):
        """Test shift swap complete lifecycle requiring peer acceptance before manager approval."""
        shift_emp = self.env["cleon.hr.shift"].with_user(self.hr_manager_user).create({
            "name": "P3 Test06 Day Shift",
            "code": "P3T6-DAY",
            "start_hour": 8.0,
            "end_hour": 16.0,
            "company_id": self.company.id,
        })
        shift_peer = self.env["cleon.hr.shift"].with_user(self.hr_manager_user).create({
            "name": "P3 Test06 Night Shift",
            "code": "P3T6-NIGHT",
            "start_hour": 22.0,
            "end_hour": 6.0,
            "shift_type": "night",
            "company_id": self.company.id,
        })

        swap_date = fields.Date.today() + timedelta(days=5)

        swap = self.env["cleon.shift.swap.request"].with_user(self.emp_user).create({
            "requester_id": self.emp.id,
            "target_employee_id": self.peer_emp.id,
            "requester_shift_id": shift_emp.id,
            "target_shift_id": shift_peer.id,
            "swap_date": swap_date,
            "reason": "Family event",
        })
        swap.with_user(self.emp_user).action_submit()
        self.assertEqual(swap.state, "requested")

        with self.assertRaises(ValidationError):
            swap.with_user(self.manager_user).action_approve()

        swap.with_user(self.peer_user).action_peer_accept()
        self.assertEqual(swap.state, "peer_accepted")

        swap.with_user(self.manager_user).action_approve()
        self.assertEqual(swap.state, "approved")

    def test_07_save_shift_split_rpc(self):
        """Test atomic split shift creation through save_shift RPC wrapper."""
        res = self.env["cleon.hr.shift"].with_user(self.hr_manager_user).save_shift({
            "name": "Atomic Split Shift RPC",
            "code": "SPLIT-RPC",
            "shift_type": "split",
            "active_days": [0, 1, 2, 3, 4],
            "split_segments": [
                {"start_hour": 8.0, "end_hour": 12.0},
                {"start_hour": 14.0, "end_hour": 18.0},
            ],
        })
        self.assertTrue(res.get("id"))
        shift = self.env["cleon.hr.shift"].browse(res["id"])
        self.assertEqual(len(shift.segment_ids), 2)
        self.assertEqual(shift.shift_type, "split")

    def test_08_inactive_shift_and_department_coverage(self):
        """Test get_shift_management_data returns inactive shifts and includes department assignment coverage."""
        inactive_shift = self.env["cleon.hr.shift"].with_user(self.hr_manager_user).create({
            "name": "Archived Night Shift",
            "code": "ARCH-NIGHT",
            "active": False,
            "shift_type": "night",
            "start_hour": 22.0,
            "end_hour": 6.0,
            "company_id": self.company.id,
        })
        data = self.env["cleon.hr.shift"].with_user(self.manager_user).get_shift_management_data()
        shift_ids = [s["id"] for s in data["shifts"]]
        self.assertIn(inactive_shift.id, shift_ids)

    def test_09_shift_management_exposes_authoritative_scheduled_hours(self):
        """Night and split templates expose backend-calculated net duration to settings."""
        night = self.env["cleon.hr.shift"].with_user(self.hr_manager_user).create({
            "name": "P3 Duration Night Shift",
            "code": "P3-DUR-NIGHT",
            "shift_type": "night",
            "start_hour": 20.0,
            "end_hour": 6.0,
            "break_minutes": 60,
            "company_id": self.company.id,
        })
        split = self.env["cleon.hr.shift"].with_user(self.hr_manager_user).create({
            "name": "P3 Duration Split Shift",
            "code": "P3-DUR-SPLIT",
            "shift_type": "split",
            "break_minutes": 30,
            "company_id": self.company.id,
            "segment_ids": [
                (0, 0, {"name": "Morning", "sequence": 1, "start_hour": 8.0, "end_hour": 12.0}),
                (0, 0, {"name": "Evening", "sequence": 2, "start_hour": 16.0, "end_hour": 20.0}),
            ],
        })

        data = self.env["cleon.hr.shift"].with_user(self.hr_manager_user).get_shift_management_data()
        rows = {row["id"]: row for row in data["shifts"]}

        self.assertEqual(rows[night.id]["scheduled_hours"], 9.0)
        self.assertEqual(rows[split.id]["scheduled_hours"], 7.5)
