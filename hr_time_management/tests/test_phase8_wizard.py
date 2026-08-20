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

    def test_01_wizard_step_persistence_and_resume(self):
        """Test persisting wizard step progress and resuming state."""
        # Initial state
        state = self.Policy.with_user(self.admin_user).get_wizard_state()
        self.assertEqual(state["wizard_step"], 1)
        self.assertEqual(state["wizard_completed_steps"], [1])
        self.assertFalse(state["launched"])

        # Save Step 3 with updated data
        new_state = self.Policy.with_user(self.admin_user).save_wizard_step(3, {
            "clock_method": "gps",
            "gps_radius_meters": 300.0,
        })
        self.assertEqual(new_state["wizard_step"], 3)
        self.assertIn(3, new_state["wizard_completed_steps"])
        self.assertEqual(new_state["policy"]["clock_method"], "gps")
        self.assertEqual(new_state["policy"]["gps_radius_meters"], 300.0)

        # Resume state
        resumed = self.Policy.with_user(self.admin_user).get_wizard_state()
        self.assertEqual(resumed["wizard_step"], 3)
        self.assertIn(3, resumed["wizard_completed_steps"])

    def test_02_step_validation_rules(self):
        """Test invalid wizard step numbers raise ValidationError."""
        with self.assertRaises(ValidationError):
            self.Policy.with_user(self.admin_user).save_wizard_step(0)

        with self.assertRaises(ValidationError):
            self.Policy.with_user(self.admin_user).save_wizard_step(9)

    def test_03_go_live_launch_execution(self):
        """Test system launch sets launched=True, go_live_date, and wizard_status='completed'."""
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
