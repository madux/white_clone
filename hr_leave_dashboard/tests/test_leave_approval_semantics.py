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

        cls.leave_type = cls.env["hr.leave.type"].create({
            "name": "Multi-Approver Paid Leave",
            "leave_code": "MAPL",
            "requires_allocation": "no",
            "leave_validation_type": "manager",
            "approval_workflow": "single",
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

    def _create_leave_request(self):
        start = fields.Date.today() + timedelta(days=20)
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

    def test_01_leave_any_one_approver_flow(self):
        """Leave request with 'any' completion mode completes upon first approval."""
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
        self.assertEqual(len(inst.step_ids[0].decision_ids), 2)

        # Manager 1 approves
        inst.with_user(self.user_mgr_1).action_decide("approve", comment="Approved by Mgr 1")
        self.assertEqual(inst.state, "approved")
        self.assertEqual(leave.state, "validate")

        # Check detail serialization includes step with decision history
        detail = self.env["hr.leave"].with_user(self.user_applicant).get_leave_request_detail(leave.id)
        cleon_step = next((s for s in detail.get("workflow", []) if "Any One Team Lead" in s.get("label", "")), None)
        self.assertTrue(cleon_step, "Cleon approval step should appear in detail workflow")
        self.assertEqual(cleon_step["state"], "done")

    def test_02_leave_all_approvers_flow(self):
        """Leave request with 'all' completion mode requires both approvers to approve."""
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

        # 1. Manager 1 approves -> leave remains confirm / pending
        inst.with_user(self.user_mgr_1).action_decide("approve", comment="Mgr 1 OK")
        self.assertEqual(inst.state, "pending")
        self.assertEqual(leave.state, "confirm")

        # 2. Manager 2 approves -> leave becomes validated
        inst.with_user(self.user_mgr_2).action_decide("approve", comment="Mgr 2 OK")
        self.assertEqual(inst.state, "approved")
        self.assertEqual(leave.state, "validate")

    def test_03_leave_all_approvers_rejection(self):
        """Leave request with 'all' completion mode is rejected immediately if one approver rejects."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "Leave Joint Rejection Chain",
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

        inst.with_user(self.user_mgr_1).action_decide("reject", comment="Staff shortage on dates")
        self.assertEqual(inst.state, "rejected")
        self.assertEqual(leave.state, "refuse")
