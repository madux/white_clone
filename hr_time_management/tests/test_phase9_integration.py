from odoo.tests.common import TransactionCase
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo import fields


import logging
_logger = logging.getLogger(__name__)

class TestPhase9Integration(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.company = cls.env.company
        cls.Policy = cls.env["cleon.time.policy"]
        cls.Overtime = cls.env["cleon.overtime.request"]
        cls.Employee = cls.env["hr.employee"]

        # Ensure policy exists for current company
        cls.policy = cls.Policy.search([("company_id", "=", cls.company.id)], limit=1)
        if not cls.policy:
            cls.policy = cls.Policy.create({
                "company_id": cls.company.id,
                "payroll_integration": True,
                "clock_method": "manual",
            })

        # Test users
        cls.hr_admin_user = cls.env["res.users"].create({
            "name": "P9 HR Admin User",
            "login": "p9_hr_admin_user",
            "email": "p9_hr_admin@example.com",
            "company_id": cls.company.id,
            "company_ids": [(6, 0, [cls.company.id])],
            "groups_id": [(6, 0, [
                cls.env.ref("base.group_user").id,
                cls.env.ref("hr_time_management.group_time_management_hr_manager").id,
                cls.env.ref("hr_time_management.group_time_management_hr_admin").id,
                cls.env.ref("cleon_approval.group_cleon_approval_manager").id,
            ])],
        })

        cls.emp_user = cls.env["res.users"].create({
            "name": "P9 Regular Employee User",
            "login": "p9_emp_user",
            "email": "p9_emp@example.com",
            "company_id": cls.company.id,
            "company_ids": [(6, 0, [cls.company.id])],
            "groups_id": [(6, 0, [
                cls.env.ref("base.group_user").id,
                cls.env.ref("hr_time_management.group_time_management_user").id,
            ])],
        })

        cls.employee = cls.Employee.create({
            "name": "P9 Test Employee",
            "company_id": cls.company.id,
            "user_id": cls.emp_user.id,
        })

    def _current_month_range(self):
        date_from = fields.Date.today().replace(day=1)
        from datetime import timedelta
        date_to = (date_from.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(days=1)
        return fields.Date.to_string(date_from), fields.Date.to_string(date_to)

    def _final_handoff(self, **kwargs):
        date_from, date_to = self._current_month_range()
        return self.Policy.with_user(self.hr_admin_user).get_payroll_handoff_data(
            date_from=date_from, date_to=date_to, **kwargs
        )

    def test_01_capabilities_registry_distinction(self):
        """Test capabilities registry distinguishes engine installed, contract, adapter, and supported exports."""
        self.policy.sudo().write({"payroll_integration": True})
        caps = self.Policy.sudo()._tm_capabilities()

        self.assertIn("payroll_engine_installed", caps)
        self.assertTrue(caps["payroll_contract_available"])
        self.assertTrue(caps["payroll_integration_enabled"])
        self.assertFalse(caps["payroll_adapter_available"])

        handoff = caps["payroll_handoff"]
        self.assertEqual(handoff["supported_exports"], ["overtime"])
        self.assertFalse(handoff["adapter_available"])

    def test_02_payroll_handoff_ready_only_exclusion(self):
        """Test get_payroll_handoff_data includes ready records and excludes transferred by default."""
        self.policy.sudo().write({"payroll_integration": True})

        ot_ready = self.Overtime.sudo().create({
            "employee_id": self.employee.id,
            "company_id": self.company.id,
            "date": fields.Date.today(),
            "overtime_hours": 2.0,
            "state": "approved",
            "payroll_state": "ready",
        })

        ot_transferred = self.Overtime.sudo().create({
            "employee_id": self.employee.id,
            "company_id": self.company.id,
            "date": fields.Date.today(),
            "overtime_hours": 4.0,
            "state": "approved",
            "payroll_state": "transferred",
        })

        Policy_admin = self.Policy.with_user(self.hr_admin_user)
        handoff_data = self._final_handoff(state_filter="ready")

        rec_ids = [r["id"] for r in handoff_data["records"]]
        self.assertIn(ot_ready.id, rec_ids)
        self.assertNotIn(ot_transferred.id, rec_ids)

    def test_03_payroll_disabled_raises_error(self):
        """Test get_payroll_handoff_data raises UserError when payroll_integration is False and not preview."""
        self.policy.sudo().write({"payroll_integration": False})
        Policy_admin = self.Policy.with_user(self.hr_admin_user)

        with self.assertRaises(UserError):
            Policy_admin.get_payroll_handoff_data(preview_mode=False)

        # Preview mode works even if integration toggle is False
        preview = Policy_admin.get_payroll_handoff_data(preview_mode=True)
        self.assertTrue(preview["preview_mode"])

    def test_04_missing_employee_code_readiness_flag(self):
        """Test that employees missing employee_code are flagged without inventing fake EMP-ids."""
        self.policy.sudo().write({"payroll_integration": True})

        ot = self.Overtime.sudo().create({
            "employee_id": self.employee.id,
            "company_id": self.company.id,
            "date": fields.Date.today(),
            "overtime_hours": 3.5,
            "state": "approved",
            "payroll_state": "ready",
        })

        handoff_data = self._final_handoff()
        target_rec = next(r for r in handoff_data["records"] if r["id"] == ot.id)

        self.assertFalse(target_rec["employee_code"])
        self.assertTrue(target_rec["missing_code"])
        self.assertIn("Missing", target_rec["readiness_error"])
        self.assertGreaterEqual(handoff_data["unresolved_employee_codes_count"], 1)

    def test_05_approval_provenance_audit(self):
        """Test that payroll handoff payload resolves genuine Phase 7 approval instance and step decision user."""
        self.policy.sudo().write({"payroll_integration": True})

        manager_emp = self.Employee.create({
            "name": "P9 Manager Employee",
            "company_id": self.company.id,
            "user_id": self.hr_admin_user.id,
        })
        self.employee.sudo().write({"parent_id": manager_emp.id})

        ot = self.Overtime.sudo().create({
            "employee_id": self.employee.id,
            "company_id": self.company.id,
            "date": fields.Date.today(),
            "overtime_hours": 2.5,
            "state": "approved",
            "payroll_state": "ready",
        })

        if "cleon.approval.instance" in self.env and "cleon.approval.workflow.type" in self.env:
            wft = self.env["cleon.approval.workflow.type"].sudo().search([("code", "=", "time_overtime")], limit=1)
            if not wft:
                ot_model = self.env["ir.model"].sudo().search([("model", "=", "cleon.overtime.request")], limit=1)
                wft = self.env["cleon.approval.workflow.type"].sudo().create({
                    "name": "Overtime Approval Test",
                    "code": "time_overtime",
                    "model_id": ot_model.id,
                    "active": True,
                })

            inst = self.env["cleon.approval.instance"].sudo().create({
                "company_id": self.company.id,
                "workflow_type_id": wft.id,
                "res_model": "cleon.overtime.request",
                "res_id": ot.id,
                "employee_id": self.employee.id,
                "state": "approved",
                "decision_source": "human",
            })

            step = self.env["cleon.approval.instance.step"].sudo().create({
                "instance_id": inst.id,
                "sequence": 10,
                "name": "Line Manager Approval Step",
                "approver_type": "line_manager",
                "state": "approved",
                "resolved_user_ids": [(6, 0, [self.hr_admin_user.id])],
                "decision_user_id": self.hr_admin_user.id,
                "decision_at": fields.Datetime.now(),
            })
            self.env.flush_all()
            self.env.invalidate_all()

        handoff_data = self._final_handoff()
        target_rec = next(r for r in handoff_data["records"] if r["id"] == ot.id)

        self.assertIn("approval_reference", target_rec)
        self.assertIn("final_decision_at", target_rec)
        self.assertEqual(target_rec["decision_source"], "human")
        self.assertEqual(target_rec["final_approver"], self.hr_admin_user.name)

    def test_06_period_lock_payroll_semantics(self):
        """Test overlapping locked period blocks non-preview export, while non-overlapping range succeeds."""
        self.policy.sudo().write({"payroll_integration": True})

        if "cleon.time.period.lock" in self.env:
            self.env["cleon.time.period.lock"].sudo().create({
                "company_id": self.company.id,
                "date_from": "2026-06-01",
                "date_to": "2026-06-30",
                "state": "locked",
                "reason": "June 2026 Audit Lock",
            })

        Policy_admin = self.Policy.with_user(self.hr_admin_user)

        # Overlapping period (June 2026) blocks final export
        with self.assertRaises(UserError):
            Policy_admin.get_payroll_handoff_data(date_from="2026-06-01", date_to="2026-06-30", preview_mode=False)

        # Non-overlapping period (August 2026) succeeds cleanly
        aug_data = Policy_admin.get_payroll_handoff_data(date_from="2026-08-01", date_to="2026-08-31", preview_mode=False)
        self.assertFalse(aug_data["period_locked"])

    def test_07_cross_company_isolation(self):
        """Test that records from a second company are excluded from payroll handoff."""
        second_company = self.env["res.company"].create({"name": "P9 Second Company"})
        second_emp = self.Employee.create({
            "name": "Second Company Employee",
            "company_id": second_company.id,
        })

        ot_comp2 = self.Overtime.sudo().create({
            "employee_id": second_emp.id,
            "company_id": second_company.id,
            "date": fields.Date.today(),
            "overtime_hours": 5.0,
            "state": "approved",
            "payroll_state": "ready",
        })

        self.policy.sudo().write({"payroll_integration": True})
        handoff_data = self._final_handoff()

        rec_ids = [r["id"] for r in handoff_data["records"]]
        self.assertNotIn(ot_comp2.id, rec_ids)

    def test_08_gps_and_cidr_ip_validation(self):
        """Test strict GPS coordinates/radius range validation and strict CIDR IP subnet parsing."""
        Policy_admin = self.Policy.with_user(self.hr_admin_user)

        # Invalid GPS latitude 500.0 raises ValidationError
        with self.assertRaises(ValidationError):
            Policy_admin.save_clock_method_settings("gps", office_latitude=500.0, office_longitude=0.0, gps_radius_meters=200.0)

        # Invalid GPS radius 0.0 raises ValidationError
        with self.assertRaises(ValidationError):
            Policy_admin.save_clock_method_settings("gps", office_latitude=40.7128, office_longitude=-74.0060, gps_radius_meters=0.0)

        # Valid GPS settings succeed
        Policy_admin.save_clock_method_settings("gps", office_latitude=40.7128, office_longitude=-74.0060, gps_radius_meters=250.0)
        caps = self.Policy.sudo()._tm_capabilities()
        self.assertTrue(caps["gps_configured"])

        # Invalid IP is rejected at the shared save boundary.
        with self.assertRaises(ValidationError):
            Policy_admin.save_clock_method_settings("ip", ip_whitelist="hello world")

        # Valid CIDR IP evaluates ip_configured = True
        self.policy.sudo().write({
            "clock_method": "ip",
            "ip_whitelist": "192.168.1.0/24, 10.0.0.1",
        })
        caps = self.Policy.sudo()._tm_capabilities()
        self.assertTrue(caps["ip_configured"])

    def test_09_biometric_device_capability_defensive(self):
        """Test defensive biometric terminal device checking with actual registered device."""
        if "cleon.biometric.device" in self.env:
            self.env["cleon.biometric.device"].sudo().create({
                "name": "Front Office Fingerprint Scanner",
                "device_key": "DEV-TEST-001",
                "company_id": self.company.id,
            })

        caps = self.Policy.sudo()._tm_capabilities()
        self.assertTrue(caps["biometric_terminal_connector"])

    def test_10_unauthorized_user_confidentiality(self):
        """Test regular employee cannot export payroll handoff data."""
        with self.assertRaises(AccessError):
            self.Policy.with_user(self.emp_user).get_payroll_handoff_data()

    def test_11_final_handoff_requires_explicit_period(self):
        self.policy.sudo().write({"payroll_integration": True})
        with self.assertRaises(ValidationError):
            self.Policy.with_user(self.hr_admin_user).get_payroll_handoff_data()

        preview = self.Policy.with_user(self.hr_admin_user).get_payroll_handoff_data(preview_mode=True)
        self.assertTrue(preview["date_from"])
        self.assertTrue(preview["date_to"])

    def test_12_ready_count_excludes_unresolved_employee_codes(self):
        self.policy.sudo().write({"payroll_integration": True})
        before = self.Policy.sudo()._tm_capabilities()["payroll_handoff"]["ready_overtime_count"]
        self.Overtime.sudo().create({
            "employee_id": self.employee.id,
            "company_id": self.company.id,
            "date": fields.Date.today(),
            "overtime_hours": 1.0,
            "state": "approved",
            "payroll_state": "ready",
        })
        after = self.Policy.sudo()._tm_capabilities()["payroll_handoff"]["ready_overtime_count"]
        self.assertEqual(after, before)
