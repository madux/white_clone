# -*- coding: utf-8 -*-
from odoo import fields
from odoo.exceptions import AccessError, ValidationError
from odoo.tests.common import TransactionCase


class TestPhase8Wizard(TransactionCase):

    def setUp(self):
        super().setUp()
        self.company = self.env.company
        self.group_user = self.env.ref("hr_time_management.group_time_management_user")
        self.group_admin = self.env.ref("hr_time_management.group_time_management_hr_admin")

        # Admin user
        self.admin_user = self.env["res.users"].create({
            "name": "P8 Admin User",
            "login": "p8_admin_user",
            "email": "p8_admin@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_admin.id])],
        })

        # Ordinary employee user
        self.emp_user = self.env["res.users"].create({
            "name": "P8 Ordinary User",
            "login": "p8_emp_user",
            "email": "p8_emp@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_user.id])],
        })

        self.Policy = self.env["cleon.time.policy"]
        policy = self.Policy.sudo().search([("company_id", "=", self.company.id)], limit=1)
        if policy:
            policy.sudo().write({
                "wizard_step": 1, "wizard_completed_steps": "", "launched": False,
                "wizard_status": "in_progress", "clock_method": "manual",
            })

    def test_01_wizard_step_persistence_and_resume(self):
        """Test persisting wizard step progress and resuming state."""
        # Initial state on fresh policy
        state = self.Policy.with_user(self.admin_user).get_wizard_state()
        self.assertEqual(state["wizard_step"], 1)
        self.assertEqual(state["wizard_completed_steps"], [])
        self.assertFalse(state["launched"])

        # Save Step 1 and resume at the next incomplete step.
        new_state = self.Policy.with_user(self.admin_user).save_wizard_step(1, {
            "standard_hours": 9.0,
        })
        self.assertEqual(new_state["wizard_step"], 2)
        self.assertIn(1, new_state["wizard_completed_steps"])
        self.assertEqual(new_state["policy"]["standard_hours"], 9.0)

        # Resume state
        resumed = self.Policy.with_user(self.admin_user).get_wizard_state()
        self.assertEqual(resumed["wizard_step"], 2)
        self.assertIn(1, resumed["wizard_completed_steps"])

    def test_02_step_validation_rules(self):
        """Test invalid wizard step numbers raise ValidationError."""
        with self.assertRaises(ValidationError):
            self.Policy.with_user(self.admin_user).save_wizard_step(0)

        with self.assertRaises(ValidationError):
            self.Policy.with_user(self.admin_user).save_wizard_step(8)

        with self.assertRaises(ValidationError):
            self.Policy.with_user(self.admin_user).save_wizard_step(9)

    def test_03_go_live_launch_execution(self):
        """Test system launch sets launched=True, go_live_date, and wizard_status='completed' after step completion."""
        # Save prerequisite steps 1 through 7
        for step in (1, 2, 3, 4, 5, 6, 7):
            self.Policy.with_user(self.admin_user).save_wizard_step(step)

        today_str = fields.Date.to_string(fields.Date.today())
        state = self.Policy.with_user(self.admin_user).launch_policy({"go_live_date": today_str})

        self.assertTrue(state["launched"])
        self.assertEqual(state["wizard_status"], "completed")
        self.assertEqual(state["wizard_step"], 8)
        self.assertEqual(len(state["wizard_completed_steps"]), 8)
        self.assertEqual(state["go_live_date"], today_str)

        # Audit log creation
        AuditLog = self.env["cleon.time.audit.log"]
        log = AuditLog.sudo().search([
            ("company_id", "=", self.company.id),
            ("module_area", "=", "settings"),
            ("entity_type", "=", "cleon.time.policy"),
        ], limit=1)
        self.assertTrue(log)
        self.assertIn("Go-Live launched", log.details)

    def test_04_wizard_access_control(self):
        """Test non-admin employee calling wizard RPCs raises AccessError."""
        with self.assertRaises(AccessError):
            self.Policy.with_user(self.emp_user).get_wizard_state()

        with self.assertRaises(AccessError):
            self.Policy.with_user(self.emp_user).save_wizard_step(2)

        with self.assertRaises(AccessError):
            self.Policy.with_user(self.emp_user).launch_policy()

    def test_05_partial_step_launch_rejection(self):
        """Test that launch_policy rejects launch if steps 1-7 are not all completed."""
        self.Policy.with_user(self.admin_user).save_wizard_step(1)
        self.Policy.with_user(self.admin_user).save_wizard_step(2)

        with self.assertRaises(ValidationError):
            self.Policy.with_user(self.admin_user).launch_policy()

    def test_06_generic_save_lifecycle_isolation(self):
        """Test that generic save_cleon_policy cannot mutate wizard lifecycle state."""
        self.Policy.with_user(self.admin_user).save_cleon_policy({"launched": True, "wizard_status": "completed"})
        state = self.Policy.with_user(self.admin_user).get_wizard_state()
        self.assertFalse(state["launched"])
        self.assertNotEqual(state["wizard_status"], "completed")

    def test_07_step_payload_isolation(self):
        """Fields belonging to another step are ignored instead of being persisted."""
        before = self.Policy.with_user(self.admin_user).get_cleon_policy()["daily_overtime_rate"]
        state = self.Policy.with_user(self.admin_user).save_wizard_step(1, {
            "standard_hours": 8.5,
            "daily_overtime_rate": 99.0,
        })
        self.assertEqual(state["policy"]["standard_hours"], 8.5)
        self.assertEqual(state["policy"]["daily_overtime_rate"], before)

    def test_08_invalid_clock_step_is_not_completed(self):
        with self.assertRaises(ValidationError):
            self.Policy.with_user(self.admin_user).save_wizard_step(3, {
                "clock_method": "gps", "office_latitude": 0, "office_longitude": 0,
            })
        state = self.Policy.with_user(self.admin_user).get_wizard_state()
        self.assertNotIn(3, state["wizard_completed_steps"])

    def test_09_generic_clock_save_uses_shared_validation(self):
        with self.assertRaises(ValidationError):
            self.Policy.with_user(self.admin_user).save_cleon_policy({
                "clock_method": "ip", "ip_whitelist": "not-an-address",
            })
