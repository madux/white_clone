# -*- coding: utf-8 -*-
from odoo import fields
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tests.common import TransactionCase


class TestMultiApproverSemantics(TransactionCase):

    def setUp(self):
        super().setUp()
        self.company = self.env.company
        self.company.write({"name": "Test Multi Approver Company"})

        base_user_grp = self.env.ref("base.group_user")

        def make_test_user(login, name):
            return self.env["res.users"].with_context(no_reset_password=True).create({
                "name": name,
                "login": login,
                "email": "%s@example.test" % login,
                "company_id": self.company.id,
                "company_ids": [(6, 0, [self.company.id])],
                "groups_id": [(6, 0, [base_user_grp.id])],
            })

        self.user_emp = make_test_user("test.subordinate", "Test Subordinate")
        self.user_a = make_test_user("approver.a", "Approver Alpha")
        self.user_b = make_test_user("approver.b", "Approver Beta")
        self.user_c = make_test_user("approver.c", "Approver Gamma")

        self.sub_emp = self.env["hr.employee"].create({
            "name": "Subordinate Employee",
            "user_id": self.user_emp.id,
            "company_id": self.company.id,
        })

        # Register res.partner dynamic hooks for testing
        PartnerClass = type(self.env["res.partner"])
        PartnerClass._approval_workflow_code = lambda s: "test_multi_approver_wf"
        PartnerClass._approval_employee = lambda s: self.sub_emp
        PartnerClass._approval_company = lambda s: self.company
        PartnerClass._approval_validate_decision = lambda s, dec, automated=False, comment=False: True
        PartnerClass._approval_finalize_approve = lambda s: s.write({"comment": "APPROVED"})
        PartnerClass._approval_finalize_reject = lambda s, c: s.write({"comment": "REJECTED: " + (c or "")})
        PartnerClass._approval_finalize_request_changes = lambda s, c: s.write({"comment": "CHANGES_REQUESTED: " + (c or "")})

        partner_model = self.env["ir.model"].search([("model", "=", "res.partner")], limit=1)
        self.wft = self.env["cleon.approval.workflow.type"].sudo().search([("code", "=", "test_multi_approver_wf")], limit=1)
        if not self.wft:
            self.wft = self.env["cleon.approval.workflow.type"].sudo().create({
                "name": "Test Multi Approver Workflow",
                "code": "test_multi_approver_wf",
                "model_id": partner_model.id,
                "active": True,
            })

        # Disable any existing chains for clean tests
        self.env["cleon.approval.chain"].search([
            ("company_id", "=", self.company.id),
            ("workflow_type_id", "=", self.wft.id),
        ]).write({"active": False})

    def _create_test_record(self):
        return self.env["res.partner"].create({
            "name": "Test Workflow Partner",
            "company_id": self.company.id,
        })

    def test_01_single_approver_completion(self):
        """Single Approver completes step on decision."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "Single Approver Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Level 1 Single Approver",
                "completion_mode": "single",
                "approver_type": "specific_user",
                "specific_user_id": self.user_a.id,
            })],
        })

        target = self._create_test_record()
        inst = self.env["cleon.approval.instance"].action_start(target)
        self.assertEqual(inst.state, "pending")
        self.assertEqual(inst.step_ids[0].completion_mode, "single")
        self.assertEqual(len(inst.step_ids[0].decision_ids), 1)

        # User A approves
        inst.with_user(self.user_a).action_decide("approve", comment="Approved by single manager")
        self.assertEqual(inst.state, "approved")
        self.assertEqual(inst.step_ids[0].state, "approved")
        self.assertIn("APPROVED", str(target.comment or ""))

    def test_02_any_one_approver_completion(self):
        """Any One Approver: first approval completes step and skips remaining approvers."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "Any One Approver Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Level 1 Any One Pool",
                "completion_mode": "any",
                "approver_type": "specific_users",
                "approver_user_ids": [(6, 0, [self.user_a.id, self.user_b.id, self.user_c.id])],
            })],
        })

        target = self._create_test_record()
        inst = self.env["cleon.approval.instance"].action_start(target)
        step = inst.step_ids[0]
        self.assertEqual(step.completion_mode, "any")
        self.assertEqual(len(step.decision_ids), 3)
        self.assertTrue(all(d.state == "pending" for d in step.decision_ids))

        # User B approves first
        inst.with_user(self.user_b).action_decide("approve", comment="Looks great to me")
        self.assertEqual(inst.state, "approved")
        self.assertEqual(step.state, "approved")

        # Verify User B decision is approved, User A and C decisions are skipped
        dec_b = step.decision_ids.filtered(lambda d: d.user_id == self.user_b)
        dec_a = step.decision_ids.filtered(lambda d: d.user_id == self.user_a)
        dec_c = step.decision_ids.filtered(lambda d: d.user_id == self.user_c)

        self.assertEqual(dec_b.state, "approved")
        self.assertEqual(dec_b.decision_comment, "Looks great to me")
        self.assertEqual(dec_a.state, "skipped")
        self.assertEqual(dec_c.state, "skipped")

        # User A subsequent attempt to decide is blocked
        with self.assertRaises(UserError):
            inst.with_user(self.user_a).action_decide("approve", comment="Late approval")

    def test_03_all_approvers_completion(self):
        """All Approvers: requires every assigned approver to approve before stage completes."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "All Approvers Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Level 1 Joint Approvals",
                "completion_mode": "all",
                "approver_type": "specific_users",
                "approver_user_ids": [(6, 0, [self.user_a.id, self.user_b.id, self.user_c.id])],
            })],
        })

        target = self._create_test_record()
        inst = self.env["cleon.approval.instance"].action_start(target)
        step = inst.step_ids[0]
        self.assertEqual(step.completion_mode, "all")

        # 1. User A approves -> step & instance remain pending
        inst.with_user(self.user_a).action_decide("approve", comment="Alpha OK")
        self.assertEqual(inst.state, "pending")
        self.assertEqual(step.state, "pending")
        self.assertFalse(target.comment)

        dec_a = step.decision_ids.filtered(lambda d: d.user_id == self.user_a)
        self.assertEqual(dec_a.state, "approved")

        # User A cannot decide twice
        with self.assertRaises(UserError):
            inst.with_user(self.user_a).action_decide("approve", comment="Duplicate Alpha")

        # 2. User B approves -> step & instance still remain pending
        inst.with_user(self.user_b).action_decide("approve", comment="Beta OK")
        self.assertEqual(inst.state, "pending")
        self.assertEqual(step.state, "pending")
        self.assertFalse(target.comment)

        # 3. User C approves -> all required approvers done, step & instance complete
        inst.with_user(self.user_c).action_decide("approve", comment="Gamma OK")
        self.assertEqual(inst.state, "approved")
        self.assertEqual(step.state, "approved")
        self.assertIn("APPROVED", str(target.comment or ""))

        self.assertTrue(all(d.state == "approved" for d in step.decision_ids))

    def test_04_all_approvers_early_rejection(self):
        """All Approvers: one rejection immediately terminates the stage and workflow."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "All Approvers Rejection Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Level 1 Joint Approvals",
                "completion_mode": "all",
                "approver_type": "specific_users",
                "approver_user_ids": [(6, 0, [self.user_a.id, self.user_b.id, self.user_c.id])],
            })],
        })

        target = self._create_test_record()
        inst = self.env["cleon.approval.instance"].action_start(target)
        step = inst.step_ids[0]

        # User A approves
        inst.with_user(self.user_a).action_decide("approve", comment="Alpha OK")
        self.assertEqual(inst.state, "pending")

        # User B rejects
        inst.with_user(self.user_b).action_decide("reject", comment="Beta Rejected: Budget exceeded")
        self.assertEqual(inst.state, "rejected")
        self.assertEqual(step.state, "rejected")
        self.assertIn("Beta Rejected", str(target.comment or ""))

        dec_a = step.decision_ids.filtered(lambda d: d.user_id == self.user_a)
        dec_b = step.decision_ids.filtered(lambda d: d.user_id == self.user_b)
        dec_c = step.decision_ids.filtered(lambda d: d.user_id == self.user_c)

        self.assertEqual(dec_a.state, "approved")
        self.assertEqual(dec_b.state, "rejected")
        self.assertEqual(dec_c.state, "skipped")

        # User C cannot act after rejection
        with self.assertRaises(UserError):
            inst.with_user(self.user_c).action_decide("approve", comment="Late vote")

    def test_05_request_changes_terminates_and_resets(self):
        """Request changes immediately sets changes_requested and skips remaining approvers."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "Changes Requested Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Level 1 Joint Approvals",
                "completion_mode": "all",
                "approver_type": "specific_users",
                "approver_user_ids": [(6, 0, [self.user_a.id, self.user_b.id])],
            })],
        })

        target = self._create_test_record()
        inst = self.env["cleon.approval.instance"].action_start(target)
        step = inst.step_ids[0]

        inst.with_user(self.user_a).action_decide("request_changes", comment="Please clarify purpose")
        self.assertEqual(inst.state, "rejected")
        self.assertIn("CHANGES_REQUESTED", str(target.comment or ""))

        dec_a = step.decision_ids.filtered(lambda d: d.user_id == self.user_a)
        dec_b = step.decision_ids.filtered(lambda d: d.user_id == self.user_b)

        self.assertEqual(dec_a.state, "changes_requested")
        self.assertEqual(dec_b.state, "skipped")
