# -*- coding: utf-8 -*-
from datetime import datetime, timedelta

from odoo import fields
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tests.common import TransactionCase


class TestPhase7ApprovalWorkflow(TransactionCase):

    def setUp(self):
        super().setUp()
        self.company = self.env.company
        self.company.write({"name": "Test Phase7 Company"})

        # Group refs
        self.group_user = self.env.ref("hr_time_management.group_time_management_user")
        self.group_line_mgr = self.env.ref("hr_time_management.group_time_management_line_manager")
        self.group_hr_mgr = self.env.ref("hr_time_management.group_time_management_hr_manager")
        self.group_hr_admin = self.env.ref("hr_time_management.group_time_management_hr_admin")

        # Line Manager User & Employee
        self.manager_user = self.env["res.users"].create({
            "name": "P7 Line Manager User",
            "login": "p7_line_mgr",
            "email": "p7_mgr@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_line_mgr.id])],
        })
        self.manager_emp = self.env["hr.employee"].create({
            "name": "P7 Line Manager Emp",
            "user_id": self.manager_user.id,
            "company_id": self.company.id,
        })

        # Subordinate User & Employee
        self.emp_user = self.env["res.users"].create({
            "name": "P7 Subordinate User",
            "login": "p7_sub_user",
            "email": "p7_sub@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_user.id])],
        })
        self.sub_emp = self.env["hr.employee"].create({
            "name": "P7 Subordinate Emp",
            "user_id": self.emp_user.id,
            "parent_id": self.manager_emp.id,
            "company_id": self.company.id,
            "hourly_cost": 50.0,
        })

        # HR Manager User & Employee
        self.hr_user = self.env["res.users"].create({
            "name": "P7 HR Manager User",
            "login": "p7_hr_user",
            "email": "p7_hr@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, self.group_hr_mgr.id])],
        })
        self.hr_emp = self.env["hr.employee"].create({
            "name": "P7 HR Manager Emp",
            "user_id": self.hr_user.id,
            "company_id": self.company.id,
        })

        # Policy definition
        self.policy = self.env["cleon.time.policy"].search([("company_id", "=", self.company.id)], limit=1)
        policy_vals = {
            "company_id": self.company.id,
            "enable_overtime": True,
            "overtime_request_mode": "both",
            "overtime_auto_approve_max_hours": 2.0,
        }
        if not self.policy:
            self.policy = self.env["cleon.time.policy"].create(policy_vals)
        else:
            self.policy.write(policy_vals)

        # Workflow Types
        self.wft_reg = self.env.ref("hr_time_management.wft_time_regularization")
        self.wft_ts = self.env.ref("hr_time_management.wft_time_timesheet")
        self.wft_ot = self.env.ref("hr_time_management.wft_time_overtime")

        # Deactivate pre-existing default chains for this company to allow isolated test chain creation
        self.env["cleon.approval.chain"].search([("company_id", "=", self.company.id)]).write({"active": False})

    def test_01_workflow_types_registered(self):
        """Test workflow types for Time Management are cleanly registered in cleon_approval core."""
        self.assertTrue(self.wft_reg)
        self.assertTrue(self.wft_ts)
        self.assertTrue(self.wft_ot)
        self.assertEqual(self.wft_reg.model_name, "cleon.attendance.regularization")
        self.assertEqual(self.wft_ts.model_name, "cleon.time.sheet")
        self.assertEqual(self.wft_ot.model_name, "cleon.overtime.request")

    def test_02_regularization_multistep_approval(self):
        """Test Attendance Regularization progresses through 2-step approval workflow."""
        # Deactivate any pre-existing default chains for regularization first
        self.env["cleon.approval.chain"].sudo().search([
            ("company_id", "=", self.company.id),
            ("workflow_type_id", "=", self.wft_reg.id),
        ]).write({"is_default": False})

        # Create 2-step regularization chain (Step 1: Direct Manager, Step 2: HR Manager Group)
        chain = self.env["cleon.approval.chain"].create({
            "name": "P7 Regularization Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft_reg.id,
            "is_default": True,
            "step_ids": [
                (0, 0, {"sequence": 10, "name": "Direct Manager Step", "approver_type": "line_manager"}),
                (0, 0, {"sequence": 20, "name": "HR Manager Step", "approver_type": "group", "approver_group_id": self.group_hr_mgr.id}),
            ],
        })

        reg = self.env["cleon.attendance.regularization"].with_user(self.emp_user).create({
            "employee_id": self.sub_emp.id,
            "attendance_date": "2026-08-10",
            "issue_type": "forgot_check_in",
            "requested_check_in": "2026-08-10 09:00:00",
            "requested_check_out": "2026-08-10 17:00:00",
            "reason": "Forgot check-in due to urgent client meeting",
        })
        reg.action_submit()
        self.assertEqual(reg.state, "submitted")

        instance = self.env["cleon.approval.instance"].sudo().search([("res_model", "=", reg._name), ("res_id", "=", reg.id)], limit=1)
        self.assertTrue(instance)
        self.assertEqual(instance.state, "pending")

        # Step 1: Line Manager approves
        reg.with_user(self.manager_user).action_approve()
        self.assertEqual(reg.state, "submitted")
        self.assertEqual(instance.state, "pending")

        # Step 2: HR Manager approves -> Finalizes regularization
        reg.with_user(self.hr_user).action_approve(comment="Verified against the employee's work schedule.")
        self.assertEqual(reg.state, "approved")
        self.assertEqual(instance.state, "approved")
        self.assertTrue(reg.attendance_id)
        self.assertEqual(reg.manager_comment, "Verified against the employee's work schedule.")

    def test_03_timesheet_rejection_preserves_analytic_lines(self):
        """Test rejecting a weekly timesheet envelope detaches analytic lines without unlinking them."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "P7 Timesheet Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft_ts.id,
            "is_default": True,
            "step_ids": [
                (0, 0, {"sequence": 10, "name": "Direct Manager Step", "approver_type": "line_manager"}),
            ],
        })

        AAL = self.env["account.analytic.line"].sudo()
        line = AAL.create({
            "name": "Development Task",
            "employee_id": self.sub_emp.id,
            "date": "2026-08-10",
            "unit_amount": 8.0,
        })

        sheet = self.env["cleon.time.sheet"].sudo().create({
            "employee_id": self.sub_emp.id,
            "week_start": "2026-08-10",
        })
        sheet.with_user(self.emp_user).action_submit()
        self.assertEqual(sheet.state, "submitted")

        # Line Manager rejects timesheet
        sheet.with_user(self.manager_user).action_decide("reject", comment="Please review task entries")
        self.assertEqual(sheet.state, "rejected")
        self.assertTrue(line.exists())
        self.assertFalse(line.cleon_sheet_id)

    def test_04_overtime_max_auto_approve_vs_sla_cron(self):
        """Test Overtime request <= 2h auto-approves via business rule, while > 2h triggers approval chain and SLA escalation."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "P7 Overtime Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft_ot.id,
            "is_default": True,
            "step_ids": [
                (0, 0, {"sequence": 10, "name": "Line Manager Step", "approver_type": "line_manager", "sla_timeout_hours": 2, "sla_action": "auto_approve"}),
            ],
        })

        today = fields.Date.today()
        d_small = today - timedelta(days=3)
        d_large = today - timedelta(days=2)

        # 1. OT Request <= 2h (1.5h) -> Business rule auto-approve
        res_small = self.env["cleon.overtime.request"].with_user(self.emp_user).submit_manual_request({
            "date": fields.Date.to_string(d_small),
            "start_time": "%s 17:00:00" % d_small,
            "end_time": "%s 18:30:00" % d_small,
            "justification": "Short overtime work for server upgrade deployment",
        })
        ot_small = self.env["cleon.overtime.request"].browse(res_small["id"])
        self.assertEqual(ot_small.state, "approved")

        # 2. OT Request > 2h (4h) -> Starts approval chain
        res_large = self.env["cleon.overtime.request"].with_user(self.emp_user).submit_manual_request({
            "date": fields.Date.to_string(d_large),
            "start_time": "%s 17:00:00" % d_large,
            "end_time": "%s 21:00:00" % d_large,
            "justification": "Extended emergency bugfix deployment for client release",
        })
        ot_large = self.env["cleon.overtime.request"].browse(res_large["id"])
        self.assertEqual(ot_large.state, "submitted")

        instance = self.env["cleon.approval.instance"].sudo().search([("res_model", "=", ot_large._name), ("res_id", "=", ot_large.id)], limit=1)
        self.assertTrue(instance)

        # Force SLA timeout
        step1 = instance.step_ids.filtered(lambda s: s.sequence == 10)
        step1.write({"deadline": fields.Datetime.now() - timedelta(hours=1)})

        # Run SLA Cron Escalation Runner
        self.env["cleon.approval.instance"]._cron_process_approval_escalations()
        self.assertEqual(ot_large.state, "approved")
        self.assertEqual(instance.state, "approved")
        self.assertEqual(instance.decision_source, "sla_cron")

    def test_05_period_lock_enforcement_during_approval(self):
        """Test period lock blocks decision if date period is locked."""
        target_date = fields.Date.context_today(
            self.env["cleon.overtime.request"]
        ) - timedelta(days=1)
        next_month = (target_date.replace(day=28) + timedelta(days=4)).replace(day=1)
        month_end = next_month - timedelta(days=1)
        chain = self.env["cleon.approval.chain"].create({
            "name": "P7 Lock Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft_ot.id,
            "is_default": True,
            "step_ids": [
                (0, 0, {"sequence": 10, "name": "Line Manager Step", "approver_type": "line_manager"}),
            ],
        })

        res = self.env["cleon.overtime.request"].with_user(self.emp_user).submit_manual_request({
            "date": fields.Date.to_string(target_date),
            "start_time": "%s 17:00:00" % fields.Date.to_string(target_date),
            "end_time": "%s 21:00:00" % fields.Date.to_string(target_date),
            "justification": "Extended emergency bugfix deployment for client release",
        })
        ot = self.env["cleon.overtime.request"].browse(res["id"])

        # Lock the target date's period.
        self.env["cleon.time.period.lock"].sudo().create({
            "company_id": self.company.id,
            "date_from": fields.Date.to_string(target_date.replace(day=1)),
            "date_to": fields.Date.to_string(month_end),
            "state": "locked",
            "reason": "Period Lock",
        })

        # Attempting to approve in locked period raises UserError
        instance = self.env["cleon.approval.instance"].sudo().search([("res_model", "=", ot._name), ("res_id", "=", ot.id), ("state", "=", "pending")], limit=1)
        with self.assertRaises(UserError):
            instance.with_user(self.manager_user).action_decide("approve")

    def test_06_fail_closed_unresolvable_approver(self):
        """Test submitting request for employee without assigned manager fails closed."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "P7 Manager Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft_reg.id,
            "is_default": True,
            "step_ids": [
                (0, 0, {"sequence": 10, "name": "Direct Manager Step", "approver_type": "line_manager"}),
            ],
        })

        # Create employee without parent_id (no manager)
        no_mgr_user = self.env["res.users"].create({
            "name": "No Manager User",
            "login": "no_mgr_user",
            "email": "nomgr@example.com",
            "company_id": self.company.id,
            "company_ids": [(6, 0, [self.company.id])],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id])],
        })
        no_mgr_emp = self.env["hr.employee"].create({
            "name": "No Manager Emp",
            "user_id": no_mgr_user.id,
            "company_id": self.company.id,
        })

        reg = self.env["cleon.attendance.regularization"].with_user(no_mgr_user).create({
            "employee_id": no_mgr_emp.id,
            "attendance_date": "2026-08-10",
            "issue_type": "forgot_check_in",
            "requested_check_in": "2026-08-10 09:00:00",
            "reason": "Forgot check-in due to client meeting",
        })

        # Submission fails closed because no manager is assigned
        with self.assertRaises(UserError):
            reg.action_submit()

    def test_07_timesheet_request_changes_correction_state(self):
        """Test request_changes decision transitions timesheet to correction state instead of rejected."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "P7 TS Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft_ts.id,
            "is_default": True,
            "step_ids": [
                (0, 0, {"sequence": 10, "name": "Direct Manager Step", "approver_type": "line_manager"}),
            ],
        })

        self.env["account.analytic.line"].sudo().create({
            "name": "Development Task",
            "employee_id": self.sub_emp.id,
            "date": "2026-08-10",
            "unit_amount": 8.0,
        })

        sheet = self.env["cleon.time.sheet"].sudo().create({
            "employee_id": self.sub_emp.id,
            "week_start": "2026-08-10",
        })
        sheet.with_user(self.emp_user).action_submit()

        # Manager requests changes
        sheet.with_user(self.manager_user).action_decide("request_changes", comment="Fix Tuesday project code")
        self.assertEqual(sheet.state, "correction")

    def test_08_overtime_payroll_state_and_notification(self):
        """Test approving overtime sets payroll_state to ready while rejection sets not_ready and notifies employee."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "P7 OT Payroll Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft_ot.id,
            "is_default": True,
            "step_ids": [
                (0, 0, {"sequence": 10, "name": "Line Manager Step", "approver_type": "line_manager"}),
            ],
        })

        today = fields.Date.today()
        d_ot = today - timedelta(days=2)
        res = self.env["cleon.overtime.request"].with_user(self.emp_user).submit_manual_request({
            "date": fields.Date.to_string(d_ot),
            "start_time": "%s 17:00:00" % d_ot,
            "end_time": "%s 21:00:00" % d_ot,
            "justification": "Extended emergency bugfix deployment for client release",
        })
        ot = self.env["cleon.overtime.request"].browse(res["id"])
        self.assertEqual(ot.payroll_state, "not_ready")

        instance = self.env["cleon.approval.instance"].sudo().search([("res_model", "=", ot._name), ("res_id", "=", ot.id)], limit=1)
        instance.with_user(self.manager_user).action_decide("approve")

        self.assertEqual(ot.state, "approved")
        self.assertEqual(ot.payroll_state, "ready")

    def test_09_regularization_window_cutoff_validation(self):
        """Test regularization request date past cutoff window raises ValidationError."""
        reg = self.env["cleon.attendance.regularization"].with_user(self.emp_user).create({
            "employee_id": self.sub_emp.id,
            "attendance_date": fields.Date.today() - timedelta(days=60),
            "issue_type": "forgot_check_in",
            "requested_check_in": "2026-06-01 09:00:00",
            "reason": "Very old attendance date request",
        })
        with self.assertRaises(ValidationError):
            reg.action_submit()

    def test_10_withdrawal_cancels_pending_approval_instance(self):
        """Test withdrawing a submitted request cancels its pending approval instance."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "P7 Withdraw Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft_reg.id,
            "is_default": True,
            "step_ids": [
                (0, 0, {"sequence": 10, "name": "Direct Manager Step", "approver_type": "line_manager"}),
            ],
        })

        reg = self.env["cleon.attendance.regularization"].with_user(self.emp_user).create({
            "employee_id": self.sub_emp.id,
            "attendance_date": fields.Date.today(),
            "issue_type": "forgot_check_in",
            "requested_check_in": fields.Datetime.now(),
            "reason": "Submitted for approval then withdrawn",
        })
        reg.action_submit()

        instance = self.env["cleon.approval.instance"].sudo().search([("res_model", "=", reg._name), ("res_id", "=", reg.id)], limit=1)
        self.assertEqual(instance.state, "pending")

        # Employee withdraws request
        reg.with_user(self.emp_user).action_withdraw()
        self.assertEqual(reg.state, "draft")
        self.assertEqual(instance.state, "cancelled")

    def test_11_require_approval_off_server_enforcement(self):
        """Test Require Approval = OFF in policy auto-approves regularization and overtime server-side."""
        self.policy.write({
            "regularization_require_approval": False,
            "overtime_require_approval": False,
        })

        # Regularization submitted with Require Approval OFF -> auto-approves immediately
        reg = self.env["cleon.attendance.regularization"].with_user(self.emp_user).create({
            "employee_id": self.sub_emp.id,
            "attendance_date": fields.Date.today(),
            "issue_type": "forgot_check_in",
            "requested_check_in": fields.Datetime.now(),
            "reason": "Require approval OFF test request",
        })
        reg.action_submit()
        self.assertEqual(reg.state, "approved")

        # Overtime submitted with Require Approval OFF -> auto-approves immediately
        today = fields.Date.today()
        ot_res = self.env["cleon.overtime.request"].with_user(self.emp_user).submit_manual_request({
            "date": fields.Date.to_string(today - timedelta(days=1)),
            "start_time": "%s 17:00:00" % (today - timedelta(days=1)),
            "end_time": "%s 21:00:00" % (today - timedelta(days=1)),
            "justification": "Extended overtime work with require approval off",
        })
        ot = self.env["cleon.overtime.request"].browse(ot_res["id"])
        self.assertEqual(ot.state, "approved")
        self.assertEqual(ot.payroll_state, "ready")

    def test_12_fallback_approver_resolution(self):
        """Test fallback approver resolution when no default chain exists."""
        self.policy.write({
            "regularization_require_approval": True,
            "regularization_fallback_approver": "department_head",
        })
        # Set manager as department head for sub_emp's department
        dept = self.env["hr.department"].create({
            "name": "Engineering Department",
            "manager_id": self.manager_emp.id,
        })
        self.sub_emp.write({"department_id": dept.id})

        reg = self.env["cleon.attendance.regularization"].with_user(self.emp_user).create({
            "employee_id": self.sub_emp.id,
            "attendance_date": fields.Date.today(),
            "issue_type": "forgot_check_in",
            "requested_check_in": fields.Datetime.now(),
            "reason": "Department head fallback approver test",
        })
        reg.action_submit()

        instance = self.env["cleon.approval.instance"].sudo().search([("res_model", "=", reg._name), ("res_id", "=", reg.id)], limit=1)
        self.assertTrue(instance)
        step = instance.step_ids[0]
        self.assertIn(self.manager_user, step.resolved_user_ids)

    def test_13_overtime_notify_employee_off(self):
        """Test overtime decision notification is suppressed when overtime_notify_employee is False."""
        self.policy.write({"overtime_notify_employee": False})
        chain = self.env["cleon.approval.chain"].create({
            "name": "P7 Notify OFF Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft_ot.id,
            "is_default": True,
            "step_ids": [
                (0, 0, {"sequence": 10, "name": "Line Manager Step", "approver_type": "line_manager"}),
            ],
        })

        today = fields.Date.today()
        ot_res = self.env["cleon.overtime.request"].with_user(self.emp_user).submit_manual_request({
            "date": fields.Date.to_string(today - timedelta(days=1)),
            "start_time": "%s 17:00:00" % (today - timedelta(days=1)),
            "end_time": "%s 21:00:00" % (today - timedelta(days=1)),
            "justification": "Extended overtime work with notify employee off",
        })
        ot = self.env["cleon.overtime.request"].browse(ot_res["id"])
        msg_count_before = len(ot.message_ids)

        instance = self.env["cleon.approval.instance"].sudo().search([("res_model", "=", ot._name), ("res_id", "=", ot.id)], limit=1)
        instance.with_user(self.manager_user).action_decide("approve")

        self.assertEqual(ot.state, "approved")
        msg_count_after = len(ot.message_ids)
        self.assertEqual(msg_count_before, msg_count_after)

    def test_14_business_rule_auto_approve_without_chain(self):
        """Test overtime <= max_auto_approve_hours auto-approves even when NO approval chain is defined."""
        # Ensure no active default chain exists for overtime
        self.env["cleon.approval.chain"].sudo().search([
            ("company_id", "=", self.company.id),
            ("workflow_type_id", "=", self.wft_ot.id),
        ]).write({"is_default": False, "active": False})

        self.policy.write({"overtime_auto_approve_max_hours": 2.0})

        today = fields.Date.today()
        ot_res = self.env["cleon.overtime.request"].with_user(self.emp_user).submit_manual_request({
            "date": fields.Date.to_string(today - timedelta(days=1)),
            "start_time": "%s 17:00:00" % (today - timedelta(days=1)),
            "end_time": "%s 18:30:00" % (today - timedelta(days=1)),
            "justification": "Short 1.5h overtime work without chain defined",
        })
        ot = self.env["cleon.overtime.request"].browse(ot_res["id"])
        self.assertEqual(ot.state, "approved")

    def test_15_period_lock_sla_cron_override_immunity(self):
        """Test overdue SLA auto-approve/reject steps inside a locked period remain pending and target is NOT finalized."""
        target_date = fields.Date.today() - timedelta(days=2)

        chain = self.env["cleon.approval.chain"].create({
            "name": "P7 Locked SLA Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft_reg.id,
            "is_default": True,
            "step_ids": [
                (0, 0, {"sequence": 10, "name": "Manager Step", "approver_type": "line_manager", "sla_timeout_hours": 1, "sla_action": "auto_approve"}),
            ],
        })

        reg = self.env["cleon.attendance.regularization"].sudo().create({
            "employee_id": self.sub_emp.id,
            "attendance_date": target_date,
            "requested_check_in": fields.Datetime.now() - timedelta(days=2, hours=9),
            "requested_check_out": fields.Datetime.now() - timedelta(days=2, hours=1),
            "reason": "Forgotten clock in during deployment window",
        })
        reg.sudo().write({"state": "submitted"})
        instance = self.env["cleon.approval.instance"].action_start(reg)
        step1 = instance.step_ids[0]

        # Lock the period covering target_date AFTER submission
        self.env["cleon.time.period.lock"].sudo().create({
            "company_id": self.company.id,
            "date_from": target_date - timedelta(days=1),
            "date_to": target_date + timedelta(days=1),
            "state": "locked",
            "reason": "Payroll Processing Lock",
        })

        # Force deadline into past (auto_approve)
        step1.sudo().write({"deadline": fields.Datetime.now() - timedelta(hours=2)})
        self.env["cleon.approval.instance"]._cron_process_approval_escalations()
        self.assertEqual(step1.state, "pending")
        self.assertEqual(reg.state, "submitted")

        # Test auto_reject SLA action inside locked period
        step1.sudo().write({"sla_action": "auto_reject"})
        self.env["cleon.approval.instance"]._cron_process_approval_escalations()
        self.assertEqual(step1.state, "pending")
        self.assertEqual(reg.state, "submitted")

    def test_16_unauthorized_line_manager_regularization_withdraw_denied(self):
        """Test Line Manager attempting to withdraw subordinate's regularization request raises AccessError."""
        reg = self.env["cleon.attendance.regularization"].with_user(self.emp_user).create({
            "employee_id": self.sub_emp.id,
            "attendance_date": "2026-08-12",
            "issue_type": "forgot_in",
            "requested_check_in": "2026-08-12 09:00:00",
            "reason": "Forgotten check in due to morning offsite client meeting",
        })

        # Manager user (Line Manager) attempting to withdraw subordinate's regularization raises AccessError
        with self.assertRaises(AccessError):
            reg.with_user(self.manager_user).action_withdraw()

    def test_17_policy_confidentiality_access_restrictions(self):
        """Test ordinary employee calling get_cleon_policy raises AccessError while get_runtime_policy returns safe data."""
        Policy = self.env["cleon.time.policy"]
        with self.assertRaises(AccessError):
            Policy.with_user(self.emp_user).get_cleon_policy()

        runtime_data = Policy.with_user(self.emp_user).get_runtime_policy()
        self.assertIn("standard_hours", runtime_data)
        self.assertNotIn("default_billing_rate", runtime_data)
        self.assertNotIn("ip_whitelist", runtime_data)

    def test_18_rejected_regularization_resubmission_starts_new_approval_history(self):
        """Resubmission preserves the rejected instance and creates a new pending instance."""
        self.env["cleon.approval.chain"].create({
            "name": "P7 Resubmission Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft_reg.id,
            "active": True,
            "is_default": True,
            "step_ids": [
                (0, 0, {
                    "sequence": 10,
                    "name": "Direct Manager Step",
                    "approver_type": "line_manager",
                }),
            ],
        })
        target_date = fields.Date.today() - timedelta(days=1)
        date_value = fields.Date.to_string(target_date)
        Regularization = self.env["cleon.attendance.regularization"]
        request = Regularization.with_user(self.emp_user).create({
            "employee_id": self.sub_emp.id,
            "attendance_date": target_date,
            "issue_type": "forgot_out",
            "requested_check_in": "%s 09:00:00" % date_value,
            "reason": "The initial request needs manager review and correction.",
        })
        request.action_submit()
        first_submitted_at = request.submitted_at
        first_instance = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", request._name),
            ("res_id", "=", request.id),
        ], limit=1)
        request.with_user(self.manager_user).action_reject(
            comment="The requested clock details do not match the work schedule."
        )
        self.assertEqual(first_instance.state, "rejected")
        request.sudo().write({"submitted_at": first_submitted_at - timedelta(hours=1)})

        result = Regularization.with_user(self.emp_user).submit_request({
            "attendance_date": date_value,
            "issue_type": "system_glitch",
            "requested_check_in": "%sT09:15" % date_value,
            "requested_check_out": "%sT17:15" % date_value,
            "reason": "The corrected terminal times now match the employee schedule.",
        })
        instances = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", request._name),
            ("res_id", "=", request.id),
        ], order="id")

        self.assertEqual(result["id"], request.id)
        self.assertEqual(len(instances), 2)
        self.assertEqual(instances[0].state, "rejected")
        self.assertEqual(instances[1].state, "pending")
        self.assertEqual(request.state, "submitted")
        self.assertGreater(request.submitted_at, first_submitted_at - timedelta(hours=1))
