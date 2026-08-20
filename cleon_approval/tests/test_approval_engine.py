# -*- coding: utf-8 -*-
from datetime import datetime, timedelta

from odoo import fields
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tests.common import TransactionCase


class TestApprovalEngine(TransactionCase):

    def setUp(self):
        super().setUp()
        self.company = self.env.company
        self.company.write({"name": "Test Approval Company"})

        # Group
        self.group_approvers = self.env["res.groups"].create({
            "name": "Test Approvers Group",
        })

        # Users & Employees
        self.manager_user = self.env["res.users"].create({
            "name": "Test Manager User",
            "login": "test_mgr_user",
            "email": "mgr@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_approvers.id])],
        })
        self.manager_emp = self.env["hr.employee"].create({
            "name": "Test Manager Emp",
            "user_id": self.manager_user.id,
            "company_id": self.company.id,
        })

        self.emp_user = self.env["res.users"].create({
            "name": "Test Subordinate User",
            "login": "test_sub_user",
            "email": "sub@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id])],
        })
        self.sub_emp = self.env["hr.employee"].create({
            "name": "Test Subordinate Emp",
            "user_id": self.emp_user.id,
            "parent_id": self.manager_emp.id,
            "company_id": self.company.id,
        })

        # Register res.partner as a test workflow type target
        PartnerModel = self.env["ir.model"].search([("model", "=", "res.partner")], limit=1)

        # Attach approval callback hooks dynamically to res.partner for test purposes
        PartnerClass = type(self.env["res.partner"])

        def _approval_workflow_code(s):
            return "test_partner_workflow"
        def _approval_employee(s):
            return self.sub_emp
        def _approval_company(s):
            return self.company
        def _approval_period(s):
            return fields.Date.today(), fields.Date.today()
        def _approval_validate_decision(s, decision, automated=False, comment=False):
            return True
        def _approval_finalize_approve(s):
            s.write({"comment": "APPROVED"})
        def _approval_finalize_reject(s, comment):
            s.write({"comment": "REJECTED: " + (comment or "")})
        def _approval_finalize_request_changes(s, comment):
            s.write({"comment": "CORRECTION: " + (comment or "")})

        PartnerClass._approval_workflow_code = _approval_workflow_code
        PartnerClass._approval_employee = _approval_employee
        PartnerClass._approval_company = _approval_company
        PartnerClass._approval_period = _approval_period
        PartnerClass._approval_validate_decision = _approval_validate_decision
        PartnerClass._approval_finalize_approve = _approval_finalize_approve
        PartnerClass._approval_finalize_reject = _approval_finalize_reject
        PartnerClass._approval_finalize_request_changes = _approval_finalize_request_changes

        self.wft = self.env["cleon.approval.workflow.type"].create({
            "code": "test_partner_workflow",
            "name": "Test Partner Workflow",
            "model_id": PartnerModel.id,
        })

        # Create 2-step approval chain
        self.chain = self.env["cleon.approval.chain"].create({
            "name": "Test 2-Step Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "is_default": True,
            "step_ids": [
                (0, 0, {
                    "sequence": 10,
                    "name": "Step 1: Line Manager",
                    "approver_type": "line_manager",
                    "sla_timeout_hours": 12,
                    "sla_action": "escalate_next",
                }),
                (0, 0, {
                    "sequence": 20,
                    "name": "Step 2: Role Group",
                    "approver_type": "group",
                    "approver_group_id": self.group_approvers.id,
                    "sla_timeout_hours": 12,
                    "sla_action": "auto_approve",
                }),
            ],
        })

    def test_01_chain_configuration_and_uniqueness(self):
        """Test active default approval chain uniqueness constraint."""
        with self.assertRaises(ValidationError):
            self.env["cleon.approval.chain"].create({
                "name": "Duplicate Default Chain",
                "company_id": self.company.id,
                "workflow_type_id": self.wft.id,
                "is_default": True,
            })

    def test_02_workflow_instance_start_and_snapshot(self):
        """Test starting an approval instance snapshots master steps and resolves approvers."""
        partner = self.env["res.partner"].create({"name": "Test Target Record"})
        instance = self.env["cleon.approval.instance"].action_start(partner)
        self.assertTrue(instance)
        self.assertEqual(instance.state, "pending")
        self.assertEqual(len(instance.step_ids), 2)

        # Step 1 pending, Step 2 waiting
        step1 = instance.step_ids.filtered(lambda s: s.sequence == 10)
        step2 = instance.step_ids.filtered(lambda s: s.sequence == 20)
        self.assertEqual(step1.state, "pending")
        self.assertEqual(step2.state, "waiting")
        self.assertIn(self.manager_user, step1.resolved_user_ids)

        # Modifying master chain step sequence does NOT alter snapshot instance step
        self.chain.step_ids[0].write({"name": "Altered Master Name"})
        self.assertEqual(step1.name, "Step 1: Line Manager")

    def test_03_multi_step_progression_and_finalization(self):
        """Test Step 1 approval advances to Step 2, and Step 2 approval finalizes target record."""
        partner = self.env["res.partner"].create({"name": "Progression Target Record"})
        instance = self.env["cleon.approval.instance"].action_start(partner)

        # Step 1 decision by Line Manager
        instance.with_user(self.manager_user).action_decide("approve", comment="Step 1 OK")
        self.assertEqual(instance.state, "pending")
        self.assertEqual(instance.current_step_sequence, 20)

        step2 = instance.step_ids.filtered(lambda s: s.sequence == 20)
        self.assertEqual(step2.state, "pending")

        # Step 2 decision by Group member
        instance.with_user(self.manager_user).action_decide("approve", comment="Step 2 Final OK")
        self.assertEqual(instance.state, "approved")
        self.assertIn("APPROVED", str(partner.comment))

    def test_04_rejection_at_first_step(self):
        """Test rejection at Step 1 terminates instance and triggers target rejection finalization."""
        partner = self.env["res.partner"].create({"name": "Rejection Target Record"})
        instance = self.env["cleon.approval.instance"].action_start(partner)

        instance.with_user(self.manager_user).action_decide("reject", comment="Reason: Incomplete")
        self.assertEqual(instance.state, "rejected")
        self.assertIn("REJECTED: Reason: Incomplete", partner.comment)

    def test_05_sla_cron_escalation(self):
        """Test SLA cron runner auto-approves overdue step."""
        partner = self.env["res.partner"].create({"name": "SLA Cron Target Record"})
        instance = self.env["cleon.approval.instance"].action_start(partner)

        # Force Step 1 deadline into past
        step1 = instance.step_ids.filtered(lambda s: s.sequence == 10)
        step1.write({
            "deadline": fields.Datetime.now() - timedelta(hours=1),
            "sla_action": "auto_approve",
        })

        # Run SLA cron runner
        self.env["cleon.approval.instance"]._cron_process_approval_escalations()
        self.assertEqual(step1.state, "approved")

    def test_06_direct_orm_tampering_restricted(self):
        """Test non-managers cannot directly alter instance or step execution records via write/create."""
        partner = self.env["res.partner"].create({"name": "Tamper Target Record"})
        instance = self.env["cleon.approval.instance"].action_start(partner)
        step1 = instance.step_ids.filtered(lambda s: s.sequence == 10)

        # Normal user write on instance state or decision fields raises AccessError
        with self.assertRaises(AccessError):
            instance.with_user(self.emp_user).write({"state": "approved"})

        # Normal user write on instance step state or deadline raises AccessError
        with self.assertRaises(AccessError):
            step1.with_user(self.emp_user).write({"state": "approved"})

        # Normal user create on approval instance raises AccessError
        with self.assertRaises(AccessError):
            self.env["cleon.approval.instance"].with_user(self.emp_user).create({
                "company_id": self.company.id,
                "workflow_type_id": self.wft.id,
                "res_model": "res.partner",
                "res_id": partner.id,
                "employee_id": self.sub_emp.id,
            })

    def test_07_sla_snapshot_stability(self):
        """Test sla_timeout_hours is snapshotted into instance step and master chain edits do not affect running instance."""
        partner = self.env["res.partner"].create({"name": "Snapshot Target Record"})
        instance = self.env["cleon.approval.instance"].action_start(partner)
        step2 = instance.step_ids.filtered(lambda s: s.sequence == 20)
        self.assertEqual(step2.sla_timeout_hours, 12)

        # HR modifies master step 2 SLA timeout to 48 hours
        self.chain.step_ids.filtered(lambda s: s.sequence == 20).write({"sla_timeout_hours": 48})

        # Advance instance from Step 1 to Step 2
        instance.with_user(self.manager_user).action_decide("approve")
        self.assertEqual(step2.state, "pending")
        # Instance step 2 deadline must reflect original snapshotted 12 hours (approx 12h from now, not 48h)
        expected_max_deadline = fields.Datetime.now() + timedelta(hours=13)
        self.assertTrue(step2.deadline <= expected_max_deadline)

    def test_08_target_lifecycle_cancellation(self):
        """Test action_cancel_for_target cancels pending approval instance and steps."""
        partner = self.env["res.partner"].create({"name": "Cancelled Target Record"})
        instance = self.env["cleon.approval.instance"].action_start(partner)
        self.assertEqual(instance.state, "pending")

        # Target gets cancelled/withdrawn
        self.env["cleon.approval.instance"].action_cancel_for_target(partner, reason="Target withdrawn")
        self.assertEqual(instance.state, "cancelled")
        self.assertFalse(instance.open_key)

    def test_09_app_launcher_menu_metadata(self):
        """Test Workflows & Approvals menu has parent_id, action, and category_name ilike 'CleonHR' for custom app drawer discovery."""
        menu = self.env.ref("cleon_approval.menu_cleon_approval_root")
        self.assertTrue(menu.parent_id, "Menu root must have a parent_id to be discovered by CleonHR app drawer.")
        self.assertTrue(menu.action, "Menu root must have an action assigned.")
        self.assertTrue(menu.category_name and "cleonhr" in menu.category_name.lower(), "Menu root category_name must contain 'CleonHR'.")

    def test_10_cross_user_instance_step_visibility(self):
        """Test ordinary user cannot read unrelated employee's instance step records."""
        unrelated_user = self.env["res.users"].create({
            "name": "Unrelated Test User",
            "login": "unrelated_user",
            "email": "unrelated@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id])],
        })

        partner = self.env["res.partner"].create({"name": "Visibility Target Record"})
        instance = self.env["cleon.approval.instance"].action_start(partner)
        step1 = instance.step_ids.filtered(lambda s: s.sequence == 10)

        # Unrelated user search for step1 yields empty domain-filtered recordset
        visible_steps = self.env["cleon.approval.instance.step"].with_user(unrelated_user).search([("id", "=", step1.id)])
        self.assertFalse(visible_steps)

    def test_11_step_sequence_uniqueness(self):
        """Test duplicate sequence numbers within an approval chain are rejected."""
        with self.assertRaises(Exception):
            with self.env.cr.savepoint():
                self.env["cleon.approval.step"].create({
                    "chain_id": self.chain.id,
                    "sequence": 10,
                    "name": "Duplicate Sequence Step",
                    "approver_type": "line_manager",
                })

    def test_12_sla_timeout_zero_immunity(self):
        """Test step with sla_timeout_hours = 0 has no deadline and is never cron-escalated."""
        self.env["cleon.approval.chain"].search([("company_id", "=", self.company.id)]).write({"active": False})
        chain = self.env["cleon.approval.chain"].create({
            "name": "Zero SLA Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "is_default": True,
            "step_ids": [
                (0, 0, {"sequence": 10, "name": "Zero SLA Step", "approver_type": "line_manager", "sla_timeout_hours": 0, "sla_action": "auto_approve"}),
            ],
        })
        partner = self.env["res.partner"].create({"name": "Zero SLA Target"})
        instance = self.env["cleon.approval.instance"].action_start(partner)
        step1 = instance.step_ids.filtered(lambda s: s.sequence == 10)
        self.assertFalse(step1.deadline, "Step with sla_timeout_hours = 0 must have False deadline.")

        # Execute SLA cron -> step must remain pending and partner instance must remain active
        self.env["cleon.approval.instance"]._cron_process_approval_escalations()
        self.assertEqual(step1.state, "pending")
        self.assertEqual(instance.state, "pending")

    def test_13_fallback_approver_company_and_self_filtering(self):
        """Test fallback approvers are filtered to target company and exclude requesting employee."""
        # Deactivate all chains so fallback path triggers
        self.env["cleon.approval.chain"].search([("company_id", "=", self.company.id)]).write({"active": False})

        # Partner target where employee user is manager
        partner = self.env["res.partner"].create({"name": "Fallback Filter Target"})
        instance = self.env["cleon.approval.instance"].action_start(partner)
        first_step = instance.step_ids[0]
        # Approver must be line manager (manager_user), not self (emp_user)
        self.assertIn(self.manager_user.id, first_step.resolved_user_ids.ids)
        self.assertNotIn(self.emp_user.id, first_step.resolved_user_ids.ids)

    def test_14_genuine_cross_company_fallback_user_exclusion(self):
        """Test user from Company B is excluded when creating an instance in Company A."""
        fallback_group = self.env.ref("cleon_approval.group_cleon_approval_manager")
        user_a = self.env["res.users"].create({
            "name": "Company A Fallback Approver",
            "login": "company_a_fallback_approver",
            "email": "companya.approver@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, fallback_group.id])],
        })
        company_b = self.env["res.company"].create({
            "name": "Company B Test",
        })
        user_b = self.env["res.users"].create({
            "name": "Company B User",
            "login": "company_b_user",
            "email": "companyb@example.com",
            "company_id": company_b.id,
            "company_ids": [(6, 0, [company_b.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, fallback_group.id])],
        })

        # Deactivate chains so fallback manager group path is exercised
        self.env["cleon.approval.chain"].search([("company_id", "=", self.company.id)]).write({"active": False})
        self.sub_emp.sudo().write({"parent_id": False})  # remove manager so group fallback runs

        partner = self.env["res.partner"].create({"name": "Cross-Company Target"})
        instance = self.env["cleon.approval.instance"].action_start(partner)
        first_step = instance.step_ids[0]

        # The explicit Company A fallback is retained while Company B is excluded.
        self.assertIn(user_a.id, first_step.resolved_user_ids.ids)
        self.assertNotIn(user_b.id, first_step.resolved_user_ids.ids)

    def test_15_employee_member_of_group_self_exclusion(self):
        """Test requesting employee is filtered out of group approval step resolved users even if they belong to the group."""
        group = self.env["res.groups"].create({
            "name": "Test Group Approvers",
            "users": [(6, 0, [self.emp_user.id, self.manager_user.id])],
        })
        self.env["cleon.approval.chain"].search([("company_id", "=", self.company.id)]).write({"active": False})
        chain = self.env["cleon.approval.chain"].create({
            "name": "Group Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "is_default": True,
            "step_ids": [
                (0, 0, {"sequence": 10, "name": "Group Step", "approver_type": "group", "approver_group_id": group.id}),
            ],
        })
        partner = self.env["res.partner"].create({"name": "Group Self Exclusion Target"})
        instance = self.env["cleon.approval.instance"].action_start(partner)
        first_step = instance.step_ids[0]

        # Manager must be resolved, requesting employee must be filtered out
        self.assertIn(self.manager_user.id, first_step.resolved_user_ids.ids)
        self.assertNotIn(self.emp_user.id, first_step.resolved_user_ids.ids)

    def test_16_unregistered_workflow_code_raises_user_error(self):
        """Test target returning an unregistered workflow code raises UserError."""
        PartnerClass = type(self.env["res.partner"])
        PartnerClass._approval_workflow_code = lambda s: "unknown_unregistered_code"
        partner = self.env["res.partner"].create({"name": "Unregistered Code Target"})
        with self.assertRaises(UserError):
            self.env["cleon.approval.instance"].action_start(partner)
        PartnerClass._approval_workflow_code = lambda s: "test_partner_workflow"

    def test_17_record_automatic_decision_invokes_validation_hook(self):
        """Test record_automatic_decision invokes target validation hook."""
        partner = self.env["res.partner"].create({"name": "Validation Hook Target"})
        inst = self.env["cleon.approval.instance"].record_automatic_decision(partner, decision="approve", source="policy_bypass")
        self.assertEqual(inst.state, "approved")

    def test_18_request_changes_unsupported_raises_validation_error(self):
        """Test requesting changes on a target record that does not implement _approval_finalize_request_changes raises ValidationError."""
        PartnerClass = type(self.env["res.partner"])
        delattr(PartnerClass, "_approval_finalize_request_changes")
        partner = self.env["res.partner"].create({"name": "No Request Changes Target"})
        instance = self.env["cleon.approval.instance"].action_start(partner)
        with self.assertRaises(ValidationError):
            instance.with_user(self.manager_user).action_decide("request_changes", comment="Fix data")
        PartnerClass._approval_finalize_request_changes = lambda s, comment: s.write({"comment": "CORRECTION: " + (comment or "")})

    def test_19_workflow_code_registered_for_another_model_fails_closed(self):
        """A valid workflow code must not be usable by a different target model."""
        UsersClass = type(self.env["res.users"])
        UsersClass._approval_workflow_code = lambda s: "test_users_workflow"
        UsersClass._approval_employee = lambda s: self.sub_emp
        UsersClass._approval_company = lambda s: self.company
        UsersClass._approval_period = lambda s: (fields.Date.today(), fields.Date.today())
        UsersClass._approval_validate_decision = lambda s, decision, automated=False, comment=False: True
        UsersClass._approval_finalize_approve = lambda s: True
        UsersClass._approval_finalize_reject = lambda s, comment: True

        users_model = self.env["ir.model"].search([("model", "=", "res.users")], limit=1)
        self.env["cleon.approval.workflow.type"].create({
            "code": "test_users_workflow",
            "name": "Test Users Workflow",
            "model_id": users_model.id,
        })

        PartnerClass = type(self.env["res.partner"])
        original_workflow_code = PartnerClass._approval_workflow_code
        try:
            PartnerClass._approval_workflow_code = lambda s: "test_users_workflow"
            partner = self.env["res.partner"].create({"name": "Wrong Model Workflow Target"})
            with self.assertRaises(ValidationError):
                self.env["cleon.approval.instance"]._resolve_workflow_type(partner)
        finally:
            PartnerClass._approval_workflow_code = original_workflow_code

