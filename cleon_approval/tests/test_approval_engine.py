# -*- coding: utf-8 -*-
from datetime import datetime, timedelta
from unittest.mock import patch

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

    def test_duplicate_workflow_preserves_levels_without_activating(self):
        duplicate = self.env["cleon.approval.chain"].browse(self.chain.action_duplicate_workflow())
        self.assertFalse(duplicate.active)
        self.assertFalse(duplicate.is_default)
        self.assertFalse(duplicate.code)
        self.assertEqual(duplicate.workflow_type_id, self.chain.workflow_type_id)
        self.assertEqual(len(duplicate.step_ids), len(self.chain.step_ids))
        self.assertFalse(duplicate.step_ids & self.chain.step_ids)
        for original, copied in zip(self.chain.step_ids, duplicate.step_ids):
            self.assertEqual(copied.chain_id, duplicate)
            for field in ("sequence", "name", "completion_mode", "approver_type",
                          "approver_group_id", "specific_user_id", "approver_user_ids",
                          "sla_timeout_hours", "sla_action"):
                self.assertEqual(copied[field], original[field])

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
        """The core menu works without Cleon-specific menu extensions."""
        menu = self.env.ref("cleon_approval.menu_cleon_approval_root")
        self.assertEqual(menu.action, self.env.ref("cleon_approval.action_cleon_workflows_app"))
        bridge = self.env["ir.module.module"].search([
            ("name", "=", "cleon_approval_hr_administration"), ("state", "=", "installed")
        ], limit=1)
        if bridge:
            self.assertEqual(menu.parent_id, self.env.ref("hr_administration.hr_administration_dashboard"))
            self.assertIn("CleonHR", menu.category_name)
        elif not self.env.ref("hr_administration.hr_administration_dashboard", raise_if_not_found=False):
            self.assertFalse(menu.parent_id)

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
        def _test_copy_company(company_rec, default=None):
            default = dict(default or {})
            c_name = default.get("name", "Company B Test Engine Isolated %s" % self.id)
            c_partner = self.env["res.partner"].create({
                "name": c_name,
                "is_company": True,
            })
            cr = self.env.cr
            cr.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'res_company'
                ORDER BY ordinal_position
            """)
            cols = [r[0] for r in cr.fetchall() if r[0] != 'id']
            select_exprs = []
            for c in cols:
                if c == 'name':
                    select_exprs.append("%s")
                elif c == 'partner_id':
                    select_exprs.append(str(c_partner.id))
                else:
                    select_exprs.append(f'"{c}"')
            query = f'''
                INSERT INTO res_company ({', '.join(f'"{c}"' for c in cols)})
                SELECT {', '.join(select_exprs)} FROM res_company WHERE id = %s
                RETURNING id
            '''
            cr.execute(query, [c_name, company_rec.id])
            new_id = cr.fetchone()[0]
            return self.env["res.company"].browse(new_id)

        from unittest.mock import patch
        with patch.object(type(self.env["res.company"]), "copy", _test_copy_company):
            company_b = self.company.copy({
                "name": "Company B Test Engine Isolated %s" % self.id,
            })
        user_b = self.env["res.users"].create({
            "name": "Company B User",
            "login": "company_b_user_iso_%s" % self.id,
            "email": "companyb_iso_%s@example.com" % self.id,
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

    def test_20_lowest_priority_matching_rule_selects_route(self):
        """Conditional rules select the lowest-numbered match and snapshot it on the instance."""
        alternate = self.env["cleon.approval.chain"].create({
            "name": "Long Request Route", "company_id": self.company.id,
            "workflow_type_id": self.wft.id, "is_default": False,
            "step_ids": [(0, 0, {
                "sequence": 10, "name": "Long Request Approver",
                "approver_type": "specific_user", "specific_user_id": self.manager_user.id,
            })],
        })
        self.wft.write({"rules_enabled": True})
        type(self.env["res.partner"])._approval_rule_context = lambda record: {"duration": 20}
        lower_precedence = self.env["cleon.approval.rule"].create({
            "name": "Lower precedence match", "company_id": self.company.id,
            "workflow_type_id": self.wft.id, "chain_id": self.chain.id, "priority": 20,
            "condition_ids": [(0, 0, {"field_name": "duration", "operator": "gt", "value": "10"})],
        })
        winning_rule = self.env["cleon.approval.rule"].create({
            "name": "Highest precedence match", "company_id": self.company.id,
            "workflow_type_id": self.wft.id, "chain_id": alternate.id, "priority": 1,
            "condition_ids": [(0, 0, {"field_name": "duration", "operator": "gt", "value": "10"})],
        })

        instance = self.env["cleon.approval.instance"].action_start(
            self.env["res.partner"].create({"name": "Rule-routed target"})
        )
        self.assertEqual(instance.source_rule_id, winning_rule)
        self.assertEqual(instance.source_chain_id, alternate)
        self.assertNotEqual(instance.source_rule_id, lower_precedence)

    def test_21_automatic_workflow_type_bypasses_routes(self):
        """Approval Required = No records an automatic decision and creates no approval steps."""
        self.wft.write({"approval_requirement": "no"})
        partner = self.env["res.partner"].create({"name": "Automatic target"})
        instance = self.env["cleon.approval.instance"].action_start(partner)
        self.assertEqual(instance.state, "approved")
        self.assertEqual(instance.decision_source, "policy_bypass")
        self.assertFalse(instance.step_ids)

    def test_22_active_delegation_replaces_resolved_approver(self):
        """An active dated delegation resolves the delegate into new runtime instances."""
        delegate = self.env["res.users"].with_context(no_reset_password=True).create({
            "name": "Temporary Delegate", "login": "temporary_delegate",
            "email": "delegate@example.com", "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id])],
        })
        self.env["cleon.approval.delegation"].create({
            "company_id": self.company.id, "user_id": self.manager_user.id,
            "delegate_user_id": delegate.id, "date_from": fields.Date.today(),
            "date_to": fields.Date.today(),
        })
        instance = self.env["cleon.approval.instance"].action_start(
            self.env["res.partner"].create({"name": "Delegated target"})
        )
        first_step = instance.step_ids.filtered(lambda step: step.sequence == 10)
        self.assertIn(delegate, first_step.resolved_user_ids)
        self.assertNotIn(self.manager_user, first_step.resolved_user_ids)

    def test_23_notify_only_escalation_keeps_ownership(self):
        """Notify-only escalation fires once without changing the pending approvers."""
        source_step = self.chain.step_ids.filtered(lambda step: step.sequence == 10)
        rule = self.env["cleon.approval.escalation.rule"].create({
            "name": "Level 1 reminder", "company_id": self.company.id,
            "workflow_type_id": self.wft.id, "chain_id": self.chain.id,
            "step_id": source_step.id, "response_value": 1,
            "response_unit": "minutes", "escalation_action": "notify",
        })
        instance = self.env["cleon.approval.instance"].action_start(
            self.env["res.partner"].create({"name": "Escalation target"})
        )
        first_step = instance.step_ids.filtered(lambda step: step.sequence == 10)
        original_approvers = first_step.resolved_user_ids
        self.assertEqual(first_step.escalation_rule_id, rule)
        first_step.sudo().write({"deadline": fields.Datetime.now() - timedelta(minutes=1)})
        self.env["cleon.approval.instance"]._cron_process_approval_escalations()
        self.assertEqual(first_step.state, "pending")
        self.assertTrue(first_step.escalated_once)
        self.assertEqual(first_step.resolved_user_ids, original_approvers)

    def test_24_client_cannot_request_automated_decision(self):
        instance = self.env["cleon.approval.instance"].action_start(
            self.env["res.partner"].create({"name": "Automation boundary"}))
        with self.assertRaises(AccessError):
            instance.with_user(self.emp_user).action_decide("approve", automated=True)
        with self.assertRaises(AccessError):
            instance.step_ids[0].with_user(self.emp_user).action_activate()
        self.assertEqual(instance.state, "pending")

    def test_25_disabled_escalation_has_no_deadline(self):
        self.wft.escalation_enabled = False
        instance = self.env["cleon.approval.instance"].action_start(
            self.env["res.partner"].create({"name": "No escalation"}))
        self.assertFalse(instance.step_ids.filtered(lambda step: step.state == "pending").deadline)

    def test_26_final_escalation_does_not_reject(self):
        instance = self.env["cleon.approval.instance"].action_start(
            self.env["res.partner"].create({"name": "Final escalation"}))
        instance.step_ids.filtered(lambda step: step.state == "waiting").sudo().write({"state": "skipped"})
        step = instance.step_ids.filtered(lambda step: step.state == "pending")
        step.sudo().write({"deadline": fields.Datetime.now() - timedelta(hours=1), "sla_action": "escalate_next"})
        self.env["cleon.approval.instance"]._cron_process_approval_escalations()
        self.assertEqual(instance.state, "pending")
        self.assertEqual(step.state, "pending")
        self.assertTrue(step.escalated_once)

    def test_27_missing_condition_does_not_match_zero_or_inequality(self):
        rule = self.env["cleon.approval.rule"].create({
            "name": "Condition validation", "company_id": self.company.id,
            "workflow_type_id": self.wft.id, "chain_id": self.chain.id,
            "condition_ids": [(0, 0, {"field_name": "duration", "operator": "eq", "value": "0"})],
        })
        condition = rule.condition_ids
        self.assertTrue(condition._matches({"duration": 0}))
        self.assertFalse(condition._matches({}))
        condition.operator = "ne"
        self.assertFalse(condition._matches({}))

    def test_28_overlapping_delegations_rejected(self):
        values = {"company_id": self.company.id, "user_id": self.manager_user.id,
                  "delegate_user_id": self.emp_user.id, "date_from": fields.Date.today(),
                  "date_to": fields.Date.today() + timedelta(days=2)}
        self.env["cleon.approval.delegation"].create(values)
        with self.assertRaises(ValidationError), self.env.cr.savepoint():
            self.env["cleon.approval.delegation"].create(values)

    def test_29_explicit_fallback_bypasses_configured_default(self):
        self.wft.default_chain_id = self.chain
        target = self.env["res.partner"].create({"name": "Explicit fallback"})
        with patch.object(type(target), "_approval_resolve_chain", return_value="fallback", create=True):
            instance = self.env["cleon.approval.instance"].action_start(target)
        self.assertFalse(instance.source_chain_id)
        self.assertEqual(len(instance.step_ids), 1)

    def test_30_default_route_rejects_wrong_company(self):
        other = self.env["res.company"].create({"name": "Other route company"})
        self.chain.company_id = other
        self.wft.default_chain_id = self.chain
        with self.assertRaises(ValidationError):
            self.env["cleon.approval.instance"].action_start(
                self.env["res.partner"].create({"name": "Wrong company route"}))

    def test_31_complete_behavior_supported_for_single_level_only(self):
        self.chain.on_approval = "complete"
        with self.assertRaises(ValidationError):
            self.env["cleon.approval.instance"].action_start(
                self.env["res.partner"].create({"name": "Unsupported early completion"}))
        self.chain.step_ids.filtered(lambda step: step.sequence == 20).unlink()
        instance = self.env["cleon.approval.instance"].action_start(
            self.env["res.partner"].create({"name": "Single level completion"}))
        instance.with_user(self.manager_user).action_decide("approve")
        self.assertEqual(instance.state, "approved")
