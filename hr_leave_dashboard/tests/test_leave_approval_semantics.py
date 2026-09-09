# -*- coding: utf-8 -*-
from datetime import timedelta
from odoo import fields
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tests.common import TransactionCase


class TestLeaveApprovalSemantics(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.company = cls.env.company
        base_user = cls.env.ref("base.group_user")
        approve_grp = cls.env.ref("hr_leave_dashboard.group_leave_permission_approve")
        personal_grp = cls.env.ref("hr_leave_dashboard.group_leave_permission_personal")

        def make_user(login, name, extra_groups=None):
            groups = [base_user.id]
            if extra_groups:
                groups.extend(extra_groups)
            return cls.env["res.users"].with_context(no_reset_password=True).create({
                "name": name,
                "login": login,
                "email": "%s@example.test" % login,
                "company_id": cls.company.id,
                "company_ids": [(6, 0, cls.company.ids)],
                "groups_id": [(6, 0, groups)],
            })

        cls.user_applicant = make_user("leave.applicant", "Leave Applicant", [personal_grp.id])
        cls.user_mgr_1 = make_user("leave.mgr1", "Leave Manager One", [personal_grp.id, approve_grp.id])
        cls.user_mgr_2 = make_user("leave.mgr2", "Leave Manager Two", [personal_grp.id, approve_grp.id])
        cls.user_mgr_3 = make_user("leave.mgr3", "Leave Manager Three", [personal_grp.id, approve_grp.id])

        cls.emp_applicant = cls.env["hr.employee"].create({
            "name": "Leave Applicant Employee",
            "user_id": cls.user_applicant.id,
            "company_id": cls.company.id,
        })
        cls.emp_mgr_1 = cls.env["hr.employee"].create({
            "name": "Leave Manager One Employee",
            "user_id": cls.user_mgr_1.id,
            "company_id": cls.company.id,
        })

        cls.leave_type = cls.env["hr.leave.type"].create({
            "name": "Multi-Approver Paid Leave",
            "leave_code": "MAPL",
            "requires_allocation": "no",
            "leave_validation_type": "manager",
            "approval_workflow": "multi",
            "approval_stage_ids": [
                (0, 0, {"sequence": 10, "approver_type": "direct_manager", "escalation_value": 24, "escalation_unit": "hours"}),
            ],
            "visible_to_employees": True,
        })

        # Ensure workflow type exists
        cls.wft = cls.env["cleon.approval.workflow.type"].sudo().search([("code", "=", "leave_request")], limit=1)
        if not cls.wft:
            holiday_model = cls.env["ir.model"].search([("model", "=", "hr.leave")], limit=1)
            cls.wft = cls.env["cleon.approval.workflow.type"].sudo().create({
                "name": "Leave Request",
                "code": "leave_request",
                "model_id": holiday_model.id,
                "active": True,
            })

    def setUp(self):
        super().setUp()
        # Deactivate existing chains for clean tests
        self.env["cleon.approval.chain"].search([
            ("company_id", "=", self.company.id),
            ("workflow_type_id", "=", self.wft.id),
        ]).write({"active": False})

    def _next_working_monday(self, offset_weeks=2):
        today = fields.Date.today()
        days_until_monday = (7 - today.weekday()) % 7
        if days_until_monday == 0:
            days_until_monday = 7
        return today + timedelta(days=days_until_monday + (offset_weeks * 7))

    def _create_leave_request(self):
        start = self._next_working_monday(3)
        chain = self.env["cleon.approval.chain"].search([
            ("company_id", "=", self.company.id),
            ("workflow_type_id", "=", self.wft.id),
            ("active", "=", True),
        ], limit=1)
        if not chain:
            chain = self.env["cleon.approval.chain"].create({
                "name": "Auto Test Chain",
                "company_id": self.company.id,
                "workflow_type_id": self.wft.id,
                "active": True,
                "step_ids": [(0, 0, {
                    "sequence": 10,
                    "name": "Auto Step",
                    "approver_type": "specific_users",
                    "approver_user_ids": [(6, 0, [self.user_mgr_1.id])],
                })],
            })
        self.leave_type.sudo().write({"approval_chain_id": chain.id})
        leave = self.env["hr.leave"].with_user(self.user_applicant).create({
            "employee_id": self.emp_applicant.id,
            "holiday_status_id": self.leave_type.id,
            "request_date_from": start,
            "request_date_to": start + timedelta(days=2),
            "notes": "Testing approval level semantics.",
        })
        if leave.state == "draft":
            leave.action_confirm()
        return leave

    def test_01_leave_rpc_approve_any_one(self):
        """Leave RPC approve_leave_request handles Any One approver via CleonApproval."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "Leave Any One Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Any One Team Lead",
                "completion_mode": "any",
                "approver_type": "specific_users",
                "approver_user_ids": [(6, 0, [self.user_mgr_1.id, self.user_mgr_2.id])],
            })],
        })

        leave = self._create_leave_request()
        inst = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave.id),
            ("state", "=", "pending"),
        ], limit=1)
        self.assertTrue(inst, "Approval instance should be started")
        self.assertEqual(inst.step_ids[0].completion_mode, "any")

        # Verify both managers see the request in get_pending_my_leave_approvals
        q1 = self.env["hr.leave"].with_user(self.user_mgr_1).get_pending_my_leave_approvals()
        q2 = self.env["hr.leave"].with_user(self.user_mgr_2).get_pending_my_leave_approvals()
        self.assertIn(leave.id, [r["id"] for r in q1.get("rows", [])])
        self.assertIn(leave.id, [r["id"] for r in q2.get("rows", [])])

        # Manager 1 approves via the user-facing RPC endpoint
        detail = self.env["hr.leave"].with_user(self.user_mgr_1).approve_leave_request(leave.id)
        self.assertEqual(leave.state, "validate")
        self.assertEqual(inst.state, "approved")

        # After approval, queue is cleared for both
        q1_after = self.env["hr.leave"].with_user(self.user_mgr_1).get_pending_my_leave_approvals()
        q2_after = self.env["hr.leave"].with_user(self.user_mgr_2).get_pending_my_leave_approvals()
        self.assertNotIn(leave.id, [r["id"] for r in q1_after.get("rows", [])])
        self.assertNotIn(leave.id, [r["id"] for r in q2_after.get("rows", [])])

        # Check detail includes progress label
        workflow = detail.get("workflow", [])
        cleon_step = next((s for s in workflow if "Any One Team Lead" in s.get("label", "")), None)
        self.assertTrue(cleon_step)
        self.assertEqual(cleon_step["state"], "done")
        self.assertIn("Any 1 of 2 Approvers", cleon_step.get("progress_label", ""))

    def test_02_leave_rpc_all_approvers_flow(self):
        """Leave RPC approve_leave_request requires all approvers under 'all' mode."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "Leave All Approvers Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Joint Approval Level",
                "completion_mode": "all",
                "approver_type": "specific_users",
                "approver_user_ids": [(6, 0, [self.user_mgr_1.id, self.user_mgr_2.id])],
            })],
        })

        leave = self._create_leave_request()
        inst = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave.id),
            ("state", "=", "pending"),
        ], limit=1)

        # 1. Manager 1 approves via RPC
        detail_1 = self.env["hr.leave"].with_user(self.user_mgr_1).approve_leave_request(leave.id)
        self.assertEqual(leave.state, "confirm")
        self.assertEqual(inst.state, "pending")

        # Manager 1 no longer has pending decision, Manager 2 still does
        q1 = self.env["hr.leave"].with_user(self.user_mgr_1).get_pending_my_leave_approvals()
        q2 = self.env["hr.leave"].with_user(self.user_mgr_2).get_pending_my_leave_approvals()
        self.assertNotIn(leave.id, [r["id"] for r in q1.get("rows", [])])
        self.assertIn(leave.id, [r["id"] for r in q2.get("rows", [])])

        cleon_step = next((s for s in detail_1.get("workflow", []) if "Joint Approval Level" in s.get("label", "")), None)
        self.assertEqual(cleon_step["progress_label"], "1 of 2 Approved")

        # 2. Manager 2 approves via RPC -> leave fully approved
        detail_2 = self.env["hr.leave"].with_user(self.user_mgr_2).approve_leave_request(leave.id)
        self.assertEqual(leave.state, "validate")
        self.assertEqual(inst.state, "approved")

    def test_03_leave_rpc_reject_request(self):
        """Leave RPC reject_leave_request immediately refuses request and terminates instance."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "Leave Reject Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Joint Approval Level",
                "completion_mode": "all",
                "approver_type": "specific_users",
                "approver_user_ids": [(6, 0, [self.user_mgr_1.id, self.user_mgr_2.id])],
            })],
        })

        leave = self._create_leave_request()
        inst = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave.id),
            ("state", "=", "pending"),
        ], limit=1)

        detail = self.env["hr.leave"].with_user(self.user_mgr_1).reject_leave_request(
            leave.id, reason="Capacity constraint", category="coverage"
        )
        self.assertEqual(leave.state, "refuse")
        self.assertEqual(inst.state, "rejected")
        self.assertEqual(leave.rejection_reason, "Capacity constraint")

    def test_04_leave_rpc_request_changes(self):
        """Leave RPC request_leave_changes sets distinct changes_requested state."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "Leave Changes Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Joint Approval Level",
                "completion_mode": "all",
                "approver_type": "specific_users",
                "approver_user_ids": [(6, 0, [self.user_mgr_1.id, self.user_mgr_2.id])],
            })],
        })

        leave = self._create_leave_request()
        inst = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave.id),
            ("state", "=", "pending"),
        ], limit=1)

        detail = self.env["hr.leave"].with_user(self.user_mgr_1).request_leave_changes(
            leave.id, comment="Please adjust dates by one day."
        )
        self.assertTrue(leave.changes_requested)
        self.assertEqual(leave.changes_requested_comment, "Please adjust dates by one day.")
        self.assertEqual(inst.state, "changes_requested")

    def test_05_leave_cancellation_closes_approval_instance(self):
        """Cancelling pending leave closes and cancels active approval instance."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "Leave Cancellation Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Single Manager",
                "completion_mode": "single",
                "approver_type": "specific_user",
                "specific_user_id": self.user_mgr_1.id,
            })],
        })

        leave = self._create_leave_request()
        inst = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave.id),
            ("state", "=", "pending"),
        ], limit=1)
        self.assertEqual(inst.state, "pending")

        res = self.env["hr.leave"].with_user(self.user_applicant).cancel_my_pending_leave(
            leave.id, reason="No longer need time off"
        )
        self.assertTrue(res.get("ok"))
        self.assertTrue(leave.is_cancelled)
        self.assertEqual(inst.state, "cancelled")

    def test_06_leave_type_multi_stage_chain_sync(self):
        """Leave Type configured with multi approval stages automatically synchronizes a cleon.approval.chain."""
        leave_type_multi = self.env["hr.leave.type"].create({
            "name": "Multi-Stage Annual Leave",
            "company_id": self.company.id,
            "leave_code": "MSAL",
            "requires_allocation": "no",
            "approval_workflow": "multi",
            "approval_stage_ids": [
                (0, 0, {
                    "sequence": 10,
                    "approver_type": "direct_manager",
                    "escalation_value": 1,
                    "escalation_unit": "days",
                }),
                (0, 0, {
                    "sequence": 20,
                    "approver_type": "hr_manager",
                    "escalation_value": 2,
                    "escalation_unit": "days",
                }),
            ],
        })

        self.assertTrue(leave_type_multi.approval_chain_id, "Approval chain should be automatically created")
        chain = leave_type_multi.approval_chain_id
        self.assertEqual(len(chain.step_ids), 2)
        self.assertEqual(chain.step_ids[0].sequence, 10)
        self.assertEqual(chain.step_ids[0].approver_type, "line_manager")
        self.assertEqual(chain.step_ids[1].sequence, 20)
        self.assertEqual(chain.step_ids[1].approver_type, "target_resolver")

        # Now create a leave request with this leave type
        self.emp_applicant.parent_id = self.emp_mgr_1
        today = fields.Date.today()
        start = today + timedelta(days=60)
        leave = self.env["hr.leave"].with_user(self.user_applicant).create({
            "name": "Multi Stage Request",
            "employee_id": self.emp_applicant.id,
            "holiday_status_id": leave_type_multi.id,
            "request_date_from": start,
            "request_date_to": start + timedelta(days=2),
            "number_of_days": 2.0,
        })
        inst = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave.id),
            ("state", "=", "pending"),
        ], limit=1)
        self.assertTrue(inst)
        self.assertEqual(len(inst.step_ids), 2)
        self.assertEqual(inst.current_step_sequence, 10)

    def test_07_two_level_native_validation_finalizes_to_validate(self):
        """Two-level native Leave validation (leave_validation_type='both') finalizes fully to 'validate'."""
        two_level_type = self.env["hr.leave.type"].create({
            "name": "Two-Level Native Leave",
            "company_id": self.company.id,
            "leave_code": "TLNL",
            "requires_allocation": "no",
            "leave_validation_type": "both",
            "approval_workflow": "single",
        })
        chain = self.env["cleon.approval.chain"].create({
            "name": "Two-Level Native Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Manager Step",
                "completion_mode": "single",
                "approver_type": "specific_user",
                "specific_user_id": self.user_mgr_1.id,
            })],
        })

        self.emp_applicant.parent_id = self.emp_mgr_1
        self.emp_applicant.leave_manager_id = self.user_mgr_1

        today = fields.Date.today()
        start = today + timedelta(days=70)
        leave = self.env["hr.leave"].with_user(self.user_applicant).create({
            "name": "Two-Level Test Request",
            "employee_id": self.emp_applicant.id,
            "holiday_status_id": two_level_type.id,
            "request_date_from": start,
            "request_date_to": start + timedelta(days=1),
            "number_of_days": 1.0,
        })

        detail = self.env["hr.leave"].with_user(self.user_mgr_1).approve_leave_request(leave.id)
        self.assertEqual(leave.state, "validate", "Leave request must reach final validate state, not remain in validate1")

    def test_08_mutation_fallback_blocked_without_instance(self):
        """Direct RPC mutations without an active approval instance fail closed with Configuration Integrity Error."""
        leave = self._create_leave_request()
        # Deliberately remove/unlink the instance to simulate missing instance
        inst = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave.id),
        ])
        inst.unlink()

        with self.assertRaises(UserError) as cm_app:
            self.env["hr.leave"].with_user(self.user_mgr_1).approve_leave_request(leave.id)
        self.assertIn("Configuration Integrity Error", str(cm_app.exception))

        with self.assertRaises(UserError) as cm_rej:
            self.env["hr.leave"].with_user(self.user_mgr_1).reject_leave_request(leave.id, reason="Denied", category="coverage")
        self.assertIn("Configuration Integrity Error", str(cm_rej.exception))

        with self.assertRaises(UserError) as cm_chg:
            self.env["hr.leave"].with_user(self.user_mgr_1).request_leave_changes(leave.id, comment="Adjust dates")
        self.assertIn("Configuration Integrity Error", str(cm_chg.exception))

    def test_09_request_changes_preserves_actor_identity(self):
        """Request changes preserves the actual human approver user in changes_requested_by_id and serializer."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "Actor Identity Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Manager Step",
                "completion_mode": "single",
                "approver_type": "specific_user",
                "specific_user_id": self.user_mgr_1.id,
            })],
        })

        leave = self._create_leave_request()
        detail = self.env["hr.leave"].with_user(self.user_mgr_1).request_leave_changes(
            leave.id, comment="Please submit medical certificate."
        )
        self.assertEqual(leave.changes_requested_by_id, self.user_mgr_1)
        self.assertEqual(detail.get("changes_requested_by"), self.user_mgr_1.name)
        self.assertEqual(detail.get("changes_requested_comment"), "Please submit medical certificate.")

    def test_10_target_routing_fail_closed(self):
        """Target routing fails closed on corrupt/missing chains, and 'none' bypasses default chain."""
        # Create a generic default chain for Leave
        default_chain = self.env["cleon.approval.chain"].create({
            "name": "Global Default Leave Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Default Step",
                "completion_mode": "single",
                "approver_type": "specific_user",
                "specific_user_id": self.user_mgr_1.id,
            })],
        })

        # 1. approval_workflow == 'none' must produce NO approval instance even if default chain exists
        none_type = self.env["hr.leave.type"].create({
            "name": "No Approval Type",
            "company_id": self.company.id,
            "leave_code": "NAT1",
            "requires_allocation": "no",
            "leave_validation_type": "no_validation",
            "approval_workflow": "none",
        })
        start_none = self._next_working_monday(20)
        end_none = start_none + timedelta(days=1)
        leave_none = self.env["hr.leave"].with_user(self.user_applicant).create({
            "name": "No Approval Request",
            "employee_id": self.emp_applicant.id,
            "department_id": self.emp_applicant.department_id.id,
            "holiday_status_id": none_type.id,
            "request_date_from": start_none,
            "request_date_to": end_none,
            "number_of_days": 1.0,
        })
        inst_none = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave_none.id),
        ])
        self.assertFalse(inst_none, "Explicit 'none' workflow must not inherit global default chain")

        # 1b. approval_workflow == 'single' must produce single fallback route and NOT inherit default multi-step chain
        single_type = self.env["hr.leave.type"].create({
            "name": "Single Approval Type",
            "company_id": self.company.id,
            "leave_code": "SAT1",
            "requires_allocation": "no",
            "leave_validation_type": "manager",
            "approval_workflow": "single",
        })
        start_single = self._next_working_monday(21)
        end_single = start_single + timedelta(days=1)
        leave_single = self.env["hr.leave"].with_user(self.user_applicant).create({
            "name": "Single Approval Request",
            "employee_id": self.emp_applicant.id,
            "department_id": self.emp_applicant.department_id.id,
            "holiday_status_id": single_type.id,
            "request_date_from": start_single,
            "request_date_to": end_single,
            "number_of_days": 1.0,
        })
        inst_single = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave_single.id),
        ])
        self.assertTrue(inst_single, "Explicit 'single' workflow must produce an approval instance")
        self.assertNotEqual(inst_single.step_ids[0].name, "Default Step",
                            "Explicit 'single' workflow must use fallback single-approver, not generic default chain")
        self.assertEqual(len(inst_single.step_ids), 1)
        self.assertEqual(inst_single.step_ids[0].name, "Fallback Approval Step")

        # 2. Multi-stage Leave Type with missing linked chain fails closed
        corrupt_multi_type = self.env["hr.leave.type"].create({
            "name": "Corrupt Multi Type",
            "company_id": self.company.id,
            "leave_code": "CMT1",
            "requires_allocation": "no",
            "approval_workflow": "multi",
            "approval_stage_ids": [
                (0, 0, {"sequence": 10, "approver_type": "direct_manager", "escalation_value": 24, "escalation_unit": "hours"}),
            ],
        })
        corrupt_multi_type.approval_chain_id = False
        start_cmt = self._next_working_monday(22)
        end_cmt = start_cmt + timedelta(days=1)
        with self.assertRaises(UserError) as cm_missing:
            self.env["hr.leave"].with_user(self.user_applicant).create({
                "name": "Missing Chain Request",
                "employee_id": self.emp_applicant.id,
                "department_id": self.emp_applicant.department_id.id,
                "holiday_status_id": corrupt_multi_type.id,
                "request_date_from": start_cmt,
                "request_date_to": end_cmt,
                "number_of_days": 1.0,
            })
        self.assertIn("Configuration Integrity Error", str(cm_missing.exception))

        # 3. Multi-stage Leave Type with inactive chain fails closed
        valid_chain = self.env["cleon.approval.chain"].create({
            "name": "Inactive Linked Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": False,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Step 1",
                "completion_mode": "single",
                "approver_type": "specific_user",
                "specific_user_id": self.user_mgr_1.id,
            })],
        })
        corrupt_multi_type.approval_chain_id = valid_chain
        start_inact = self._next_working_monday(24)
        end_inact = start_inact + timedelta(days=1)
        with self.assertRaises(UserError) as cm_inactive:
            self.env["hr.leave"].with_user(self.user_applicant).create({
                "name": "Inactive Chain Request",
                "employee_id": self.emp_applicant.id,
                "department_id": self.emp_applicant.department_id.id,
                "holiday_status_id": corrupt_multi_type.id,
                "request_date_from": start_inact,
                "request_date_to": end_inact,
                "number_of_days": 1.0,
            })
        self.assertIn("Configuration Integrity Error", str(cm_inactive.exception))

    def test_11_leave_type_lifecycle_deactivates_chain(self):
        """Transitioning from multi to single, none, or removing stages deactivates the linked chain."""
        leave_type = self.env["hr.leave.type"].create({
            "name": "Lifecycle Multi Type",
            "company_id": self.company.id,
            "leave_code": "LMT1",
            "requires_allocation": "no",
            "approval_workflow": "multi",
            "approval_stage_ids": [
                (0, 0, {"sequence": 10, "approver_type": "direct_manager", "escalation_value": 24, "escalation_unit": "hours"}),
                (0, 0, {"sequence": 20, "approver_type": "hr_manager", "escalation_value": 48, "escalation_unit": "hours"}),
            ],
        })
        chain = leave_type.approval_chain_id
        self.assertTrue(chain and chain.active)

        # 1. Transition multi -> single deactivates chain
        leave_type.write({"approval_workflow": "single"})
        self.assertFalse(chain.active)
        self.assertFalse(leave_type.approval_chain_id)

        # Re-activate multi
        leave_type.write({"approval_workflow": "multi"})
        new_chain = leave_type.approval_chain_id
        self.assertTrue(new_chain and new_chain.active)

        # 2. Transition multi -> none deactivates chain
        leave_type.write({"approval_workflow": "none"})
        self.assertFalse(new_chain.active)
        self.assertFalse(leave_type.approval_chain_id)

        # 3. Removing all stages from multi deactivates chain
        leave_type.write({"approval_workflow": "multi"})
        third_chain = leave_type.approval_chain_id
        self.assertTrue(third_chain and third_chain.active)
        leave_type.approval_stage_ids.unlink()
        leave_type.write({})  # trigger write
        self.assertFalse(third_chain.active)
        self.assertFalse(leave_type.approval_chain_id)

    def test_12_request_changes_resubmission_lifecycle(self):
        """End-to-end Request Changes -> employee edit -> resubmit creates new instance at Stage 1 while retaining history."""
        leave_type = self.env["hr.leave.type"].create({
            "name": "Resubmit Multi Type",
            "company_id": self.company.id,
            "leave_code": "RMT1",
            "requires_allocation": "no",
            "approval_workflow": "multi",
            "approval_stage_ids": [
                (0, 0, {"sequence": 10, "approver_type": "direct_manager", "escalation_value": 24, "escalation_unit": "hours"}),
                (0, 0, {"sequence": 20, "approver_type": "hr_manager", "escalation_value": 48, "escalation_unit": "hours"}),
            ],
        })
        self.emp_applicant.parent_id = self.emp_mgr_1
        self.emp_applicant.leave_manager_id = self.user_mgr_1

        start = self._next_working_monday(10)
        end = start + timedelta(days=1)
        leave = self.env["hr.leave"].with_user(self.user_applicant).create({
            "name": "Initial Resubmit Request",
            "employee_id": self.emp_applicant.id,
            "holiday_status_id": leave_type.id,
            "request_date_from": start,
            "request_date_to": end,
            "number_of_days": 2.0,
        })
        inst1 = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave.id),
        ], limit=1)
        self.assertTrue(inst1)
        self.assertEqual(inst1.current_step_sequence, 10)

        # Approver 1 requests changes
        self.env["hr.leave"].with_user(self.user_mgr_1).request_leave_changes(
            leave.id, comment="Please adjust coverage reason."
        )
        self.assertEqual(inst1.state, "changes_requested")
        self.assertFalse(inst1.open_key, "Terminal changes_requested instance must have open_key cleared")

        # Employee edits allowed fields and resubmits
        res = self.env["hr.leave"].with_user(self.user_applicant).resubmit_employee_leave_request(leave.id, {
            "leave_type_id": str(leave_type.id),
            "date_from": str(start),
            "date_to": str(end),
            "reason": "Updated reason with coverage confirmed",
        })
        self.assertTrue(res.get("ok"))

        # Old instance 1 must remain immutable in changes_requested
        self.assertEqual(inst1.state, "changes_requested")

        # Brand new instance 2 must be created and active at Stage 1
        inst2 = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave.id),
            ("state", "=", "pending"),
        ], limit=1)
        self.assertTrue(inst2)
        self.assertNotEqual(inst1.id, inst2.id, "Resubmission must create a fresh approval instance")
        self.assertEqual(inst2.current_step_sequence, 10, "New instance must restart at Stage 1")

        # Approver 1 approves Stage 1
        self.env["hr.leave"].with_user(self.user_mgr_1).approve_leave_request(leave.id)
        self.assertEqual(inst2.current_step_sequence, 20, "Instance must advance to Stage 2")

        # Approver 2 (HR Manager) approves Stage 2
        self.env["hr.leave"].with_user(self.user_mgr_2).approve_leave_request(leave.id)
        self.assertEqual(inst2.state, "approved")
        self.assertEqual(leave.state, "validate")

    def test_13_authoritative_business_roles_and_admin_blocked(self):
        """Technical System Admin cannot approve CEO stage; authoritative business roles are enforced."""
        admin_user = self.env.ref("base.user_admin")
        self.assertTrue(admin_user.has_group("base.group_system"))

        ceo_user = self.env["res.users"].with_context(no_reset_password=True).create({
            "name": "Authoritative CEO",
            "login": "auth_ceo_user",
            "email": "ceo@example.test",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id])],
        })

        dept = self.env["hr.department"].create({
            "name": "Engineering Dept",
            "company_id": self.company.id,
            "manager_id": self.emp_mgr_1.id,
        })
        self.emp_applicant.department_id = dept

        # 1. Test Department Head resolution
        leave_type_dh = self.env["hr.leave.type"].create({
            "name": "Dept Head Type",
            "company_id": self.company.id,
            "leave_code": "DHT1",
            "requires_allocation": "no",
            "approval_workflow": "multi",
            "approval_stage_ids": [
                (0, 0, {"sequence": 10, "approver_type": "department_head", "escalation_value": 24, "escalation_unit": "hours"}),
            ],
        })
        start_dh = self._next_working_monday(12)
        end_dh = start_dh + timedelta(days=1)
        leave_dh = self.env["hr.leave"].with_user(self.user_applicant).create({
            "name": "Dept Head Request",
            "employee_id": self.emp_applicant.id,
            "holiday_status_id": leave_type_dh.id,
            "request_date_from": start_dh,
            "request_date_to": end_dh,
            "number_of_days": 1.0,
        })
        inst_dh = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave_dh.id),
        ], limit=1)
        self.assertEqual(inst_dh.step_ids[0].resolved_user_ids, self.user_mgr_1, "Only the actual Department Head user must be resolved")

        # 2. Test CEO stage without authoritative config fails closed
        self.env["ir.config_parameter"].sudo().set_param("cleon_approval.ceo_user_id", "")
        leave_type_ceo = self.env["hr.leave.type"].create({
            "name": "CEO Stage Type",
            "company_id": self.company.id,
            "leave_code": "CEOT1",
            "requires_allocation": "no",
            "approval_workflow": "multi",
            "approval_stage_ids": [
                (0, 0, {"sequence": 10, "approver_type": "ceo", "escalation_value": 24, "escalation_unit": "hours"}),
            ],
        })
        start_unconf = self._next_working_monday(14)
        end_unconf = start_unconf + timedelta(days=1)
        with self.assertRaises(UserError) as cm_no_ceo:
            self.env["hr.leave"].with_user(self.user_applicant).create({
                "name": "Unconfigured CEO Request",
                "employee_id": self.emp_applicant.id,
                "holiday_status_id": leave_type_ceo.id,
                "request_date_from": start_unconf,
                "request_date_to": end_unconf,
                "number_of_days": 1.0,
            })
        self.assertIn("No authoritative CEO", str(cm_no_ceo.exception))

        # 3. Configure authoritative CEO -> System Admin cannot approve, only configured CEO can approve
        self.env["ir.config_parameter"].sudo().set_param("cleon_approval.ceo_user_id", str(ceo_user.id))
        start_ceo = self._next_working_monday(16)
        end_ceo = start_ceo + timedelta(days=1)
        leave_ceo = self.env["hr.leave"].with_user(self.user_applicant).create({
            "name": "Configured CEO Request",
            "employee_id": self.emp_applicant.id,
            "holiday_status_id": leave_type_ceo.id,
            "request_date_from": start_ceo,
            "request_date_to": end_ceo,
            "number_of_days": 1.0,
        })
        inst_ceo = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave_ceo.id),
        ], limit=1)
        self.assertEqual(inst_ceo.step_ids[0].resolved_user_ids, ceo_user)

        # Verify System Admin cannot approve
        with self.assertRaises(AccessError):
            self.env["hr.leave"].with_user(admin_user).approve_leave_request(leave_ceo.id)

        # Configured CEO approves successfully
        self.env["hr.leave"].with_user(ceo_user).approve_leave_request(leave_ceo.id)
        self.assertEqual(inst_ceo.state, "approved")
        self.assertEqual(leave_ceo.state, "validate")

    def test_14_policy_required_approval_repairs_native_validation(self):
        """An active approval policy must prevent Odoo's no-validation shortcut."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "Policy Synchronisation Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": False,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Policy Manager",
                "completion_mode": "single",
                "approver_type": "specific_user",
                "specific_user_id": self.user_mgr_1.id,
            })],
        })
        leave_type = self.env["hr.leave.type"].create({
            "name": "Policy Synchronisation Leave",
            "company_id": self.company.id,
            "leave_code": "PSL1",
            "requires_allocation": "no",
            "approval_workflow": "single",
        })
        # Reproduce the inconsistent configuration found in the live DB.
        leave_type.with_context(skip_leave_validation_sync=True).write({
            "leave_validation_type": "no_validation",
        })
        policy = self.env["hr.leave.policy"].create({
            "name": "Policy Synchronisation",
            "code": "POLSYNC",
            "company_id": self.company.id,
            "state": "draft",
            "apply_to": "all",
            "approval_required": True,
            "approval_workflow": "custom",
            "approval_chain_id": chain.id,
        })
        self.env["hr.leave.policy.line"].create({
            "policy_id": policy.id,
            "leave_type_id": leave_type.id,
            "active": True,
        })
        policy.write({"state": "active"})

        leave_type._sync_native_validation_from_policies()
        self.assertEqual(leave_type.leave_validation_type, "hr")

        start = self._next_working_monday(24)
        leave = self.env["hr.leave"].with_user(self.user_applicant).create({
            "employee_id": self.emp_applicant.id,
            "holiday_status_id": leave_type.id,
            "request_date_from": start,
            "request_date_to": start + timedelta(days=1),
            "notes": "Verify policy approval synchronisation.",
        })
        instance = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave.id),
            ("state", "=", "pending"),
        ], limit=1)
        self.assertIn(leave.state, ("confirm", "validate1"))
        self.assertTrue(instance, "A policy-required request must remain pending with an approval instance")
