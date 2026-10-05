# -*- coding: utf-8 -*-
from odoo import fields
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tests.common import TransactionCase


class TestMultiApproverSemantics(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.company = cls.env.company

        base_user_grp = cls.env.ref("base.group_user")

        import time
        unique_suffix = str(int(time.time() * 1000))[-6:]

        def make_test_user(login_prefix, name):
            login = "%s.%s" % (login_prefix, unique_suffix)
            return cls.env["res.users"].with_context(no_reset_password=True).create({
                "name": "%s %s" % (name, unique_suffix),
                "login": login,
                "email": "%s@example.test" % login,
                "company_id": cls.company.id,
                "company_ids": [(6, 0, [cls.company.id])],
                "groups_id": [(6, 0, [base_user_grp.id])],
            })

        cls.user_emp = make_test_user("test.subordinate.iso", "Test Subordinate Multi")
        cls.user_a = make_test_user("approver.alpha.iso", "Approver Alpha Multi")
        cls.user_b = make_test_user("approver.beta.iso", "Approver Beta Multi")
        cls.user_c = make_test_user("approver.gamma.iso", "Approver Gamma Multi")

        cls.sub_emp = cls.env["hr.employee"].create({
            "name": "Subordinate Employee Multi %s" % unique_suffix,
            "user_id": cls.user_emp.id,
            "company_id": cls.company.id,
        })

        # Register res.partner dynamic hooks for testing
        PartnerClass = type(cls.env["res.partner"])
        PartnerClass._approval_workflow_code = lambda s: "test_multi_approver_wf"
        PartnerClass._approval_employee = lambda s: cls.sub_emp
        PartnerClass._approval_company = lambda s: cls.company
        PartnerClass._approval_period = lambda s: (fields.Date.today(), fields.Date.today())
        PartnerClass._approval_validate_decision = lambda s, dec, automated=False, comment=False: True
        PartnerClass._approval_finalize_approve = lambda s: s.write({"comment": "APPROVED"})
        PartnerClass._approval_finalize_reject = lambda s, c: s.write({"comment": "REJECTED: " + (c or "")})
        PartnerClass._approval_finalize_request_changes = lambda s, c, deciding_user=False: s.write({"comment": "CHANGES_REQUESTED: " + (c or "")})

        partner_model = cls.env["ir.model"].search([("model", "=", "res.partner")], limit=1)
        cls.wft = cls.env["cleon.approval.workflow.type"].sudo().search([("code", "=", "test_multi_approver_wf")], limit=1)
        if not cls.wft:
            cls.wft = cls.env["cleon.approval.workflow.type"].sudo().create({
                "name": "Test Multi Approver Workflow",
                "code": "test_multi_approver_wf",
                "model_id": partner_model.id,
                "active": True,
            })

    def setUp(self):
        super().setUp()
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

    def test_05_request_changes_distinct_state(self):
        """Request changes sets distinct changes_requested state on step & instance."""
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
        self.assertEqual(inst.state, "changes_requested")
        self.assertEqual(step.state, "changes_requested")
        self.assertIn("CHANGES_REQUESTED", str(target.comment or ""))

        dec_a = step.decision_ids.filtered(lambda d: d.user_id == self.user_a)
        dec_b = step.decision_ids.filtered(lambda d: d.user_id == self.user_b)

        self.assertEqual(dec_a.state, "changes_requested")
        self.assertEqual(dec_b.state, "skipped")

    def test_06_single_mode_cardinality_enforcement(self):
        """Single mode must resolve to exactly one user; multi-member group is blocked."""
        group = self.env["res.groups"].create({
            "name": "Multi User Approval Group",
            "users": [(6, 0, [self.user_a.id, self.user_b.id])],
        })
        self.env["cleon.approval.chain"].create({
            "name": "Invalid Single Mode Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Single Step With Group",
                "completion_mode": "single",
                "approver_type": "group",
                "approver_group_id": group.id,
            })],
        })

        target = self._create_test_record()
        with self.assertRaises(UserError) as cm:
            self.env["cleon.approval.instance"].action_start(target)
        self.assertIn("must resolve to exactly one eligible approver", str(cm.exception))

    def test_07_system_admin_without_assignment_cannot_decide(self):
        """System administrator cannot decide unless explicitly assigned as an approver."""
        admin_user = self.env.ref("base.user_admin")
        chain = self.env["cleon.approval.chain"].create({
            "name": "Specific User Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "Level 1 Specific Approver",
                "completion_mode": "single",
                "approver_type": "specific_user",
                "specific_user_id": self.user_a.id,
            })],
        })

        target = self._create_test_record()
        inst = self.env["cleon.approval.instance"].action_start(target)

        # Admin attempts to decide directly
        with self.assertRaises(AccessError):
            inst.with_user(admin_user).action_decide("approve", comment="Admin bypass attempt")

    def test_08_concurrent_any_one_approvals_serialize(self):
        """Two approvers attempting to approve an 'any' step simultaneously serialize; only one succeeds."""
        import threading
        import time
        from odoo import api

        registry = self.env.registry
        unique_id = str(int(time.time() * 1000))[-6:]
        wft_code = "concurrency_test_%s" % unique_id

        emp_id = None
        user1_id = None
        user2_id = None
        local_wft_id = None
        chain_id = None
        target_id = None
        inst_id = None

        PartnerClasses = [type(self.env["res.partner"]), registry["res.partner"]]
        StepClasses = [type(self.env["cleon.approval.instance.step"]), registry["cleon.approval.instance.step"]]
        orig_finalize = getattr(PartnerClasses[0], "_approval_finalize_approve", None)
        orig_validate = getattr(PartnerClasses[0], "_approval_validate_decision", None)
        orig_employee = getattr(PartnerClasses[0], "_approval_employee", None)
        orig_company = getattr(PartnerClasses[0], "_approval_company", None)
        orig_period = getattr(PartnerClasses[0], "_approval_period", None)
        orig_reject = getattr(PartnerClasses[0], "_approval_finalize_reject", None)
        orig_changes = getattr(PartnerClasses[0], "_approval_finalize_request_changes", None)
        orig_wft_code = getattr(PartnerClasses[0], "_approval_workflow_code", None)
        orig_create_act = StepClasses[0]._create_activity
        orig_close_act = StepClasses[0]._close_activity

        from odoo.addons.digest.models.res_users import ResUsers as DigestResUsers
        orig_digest_create = DigestResUsers.create

        from odoo.modules.registry import Registry
        orig_registry_new = Registry.__new__

        finalize_counter = [0]
        t1_has_lock = threading.Event()
        t1_can_proceed = threading.Event()
        t2_attempted = threading.Event()
        t2_finished = threading.Event()
        t1_error = [None]
        t2_error = [None]

        def tracking_finalize(s):
            finalize_counter[0] += 1
            s.write({"comment": "APPROVED_COUNT_%d" % finalize_counter[0]})

        def tracking_validate(s, dec, automated=False, comment=False):
            th_name = threading.current_thread().name
            if th_name == "T1_LockHolder":
                t1_has_lock.set()
                t1_can_proceed.wait(timeout=2.0)
            return True

        def safe_registry_new(cls, db_name):
            reg = cls.registries.get(db_name)
            if reg is not None:
                return reg
            return orig_registry_new(cls, db_name)

        try:
            # 1. Apply all monkeypatches
            for pc in PartnerClasses:
                pc._approval_workflow_code = lambda s: wft_code
                pc._approval_company = lambda s: s.company_id
                pc._approval_employee = lambda s: s.env["hr.employee"].browse(emp_id)
                pc._approval_period = lambda s: (fields.Date.today(), fields.Date.today())
                pc._approval_validate_decision = tracking_validate
                pc._approval_finalize_approve = tracking_finalize
                pc._approval_finalize_reject = lambda s, c: s.write({"comment": "REJECTED"})
                pc._approval_finalize_request_changes = lambda s, c, deciding_user=False: s.write({"comment": "CHANGES"})

            for sc in StepClasses:
                sc._create_activity = lambda self: True
                sc._close_activity = lambda self: True

            DigestResUsers.create = lambda self, vals_list: super(DigestResUsers, self).create(vals_list)
            Registry.__new__ = safe_registry_new

            # 2. Setup fixtures in independent committed transaction
            cr_setup = registry._db.cursor()
            cr_setup.execute("SET statement_timeout = '15s'; SET lock_timeout = '3s';")
            env_setup = api.Environment(cr_setup, 1, {})

            emp = env_setup["hr.employee"].create({
                "name": "Concurrent Employee %s" % unique_id,
            })
            emp_id = emp.id

            holiday_model = env_setup["ir.model"].search([("model", "=", "res.partner")], limit=1)
            local_wft = env_setup["cleon.approval.workflow.type"].create({
                "name": "Concurrent WFT %s" % unique_id,
                "code": wft_code,
                "model_id": holiday_model.id,
                "active": True,
            })
            local_wft_id = local_wft.id

            company = env_setup["res.company"].search([], limit=1)
            company_id = company.id
            base_group = env_setup.ref("base.group_user")

            user1 = env_setup["res.users"].with_context(no_reset_password=True).create({
                "name": "Concurrent User 1 %s" % unique_id,
                "login": "concurrent.user1.%s" % unique_id,
                "email": "concurrent1.%s@example.test" % unique_id,
                "company_id": company_id,
                "company_ids": [(6, 0, [company_id])],
                "groups_id": [(6, 0, [base_group.id])],
            })
            user1_id = user1.id

            user2 = env_setup["res.users"].with_context(no_reset_password=True).create({
                "name": "Concurrent User 2 %s" % unique_id,
                "login": "concurrent.user2.%s" % unique_id,
                "email": "concurrent2.%s@example.test" % unique_id,
                "company_id": company_id,
                "company_ids": [(6, 0, [company_id])],
                "groups_id": [(6, 0, [base_group.id])],
            })
            user2_id = user2.id

            chain = env_setup["cleon.approval.chain"].sudo().create({
                "name": "Concurrent Any One Chain %s" % unique_id,
                "company_id": company_id,
                "workflow_type_id": local_wft_id,
                "active": True,
                "is_default": True,
                "step_ids": [(0, 0, {
                    "sequence": 10,
                    "name": "Any One Approver Level",
                    "completion_mode": "any",
                    "approver_type": "specific_users",
                    "approver_user_ids": [(6, 0, [user1_id, user2_id])],
                })],
            })
            chain_id = chain.id

            target = env_setup["res.partner"].sudo().create({
                "name": "Concurrent Partner Real %s" % unique_id,
                "company_id": company_id,
            })
            target_id = target.id

            inst = env_setup["cleon.approval.instance"].sudo().action_start(target)
            inst_id = inst.id

            cr_setup.commit()
            cr_setup.close()

            # 3. Create independent cursors for concurrent transactions T1 and T2
            cr1 = registry._db.cursor()
            cr1.execute("SET statement_timeout = '15s'; SET lock_timeout = '3s';")
            env1 = api.Environment(cr1, 1, {})
            inst1 = env1["cleon.approval.instance"].browse(inst_id)

            cr2 = registry._db.cursor()
            cr2.execute("SET statement_timeout = '15s'; SET lock_timeout = '3s';")
            env2 = api.Environment(cr2, 1, {})
            inst2 = env2["cleon.approval.instance"].browse(inst_id)

            # Pre-warm env1 and env2 caches so no foreign-table lookups block during concurrent execution
            for inst_to_warm, u_id in [(inst1, user1_id), (inst2, user2_id)]:
                u = inst_to_warm.env["res.users"].browse(u_id)
                u.read(["name", "login"])
                inst_to_warm.sudo().read(["res_model", "res_id", "state", "current_step_sequence", "employee_id"])
                inst_to_warm.env["res.partner"].sudo().browse(target_id).read(["name", "company_id"])
                for s in inst_to_warm.sudo().step_ids:
                    s.read(["state", "sequence", "name", "completion_mode", "resolved_user_ids", "decision_ids"])
                    for d in s.decision_ids:
                        d.read(["user_id", "state"])

            def worker_t1():
                try:
                    inst1.with_user(user1_id).action_decide("approve", comment="T1 In-Flight Approval")
                    cr1.commit()
                except Exception as e:
                    cr1.rollback()
                    t1_error[0] = e
                finally:
                    cr1.close()

            def worker_t2():
                try:
                    t2_attempted.set()
                    # This will BLOCK in PostgreSQL at SELECT ... FOR UPDATE because T1 holds the lock!
                    inst2.with_user(user2_id).action_decide("approve", comment="T2 Concurrent Approval")
                    cr2.commit()
                except Exception as e:
                    cr2.rollback()
                    t2_error[0] = e
                finally:
                    t2_finished.set()
                    cr2.close()

            th1 = threading.Thread(target=worker_t1, name="T1_LockHolder")
            th2 = threading.Thread(target=worker_t2, name="T2_Contender")

            # Start T1; it acquires FOR UPDATE lock and pauses in tracking_validate
            th1.start()
            self.assertTrue(t1_has_lock.wait(timeout=5.0), f"T1 failed to acquire row lock within timeout. Error: {t1_error[0]}")

            # Start T2 while T1 STILL holds the row lock!
            th2.start()
            self.assertTrue(t2_attempted.wait(timeout=2.0))

            # Prove T2 is genuinely BLOCKED and cannot finish while T1 holds the lock
            self.assertFalse(t2_finished.wait(timeout=0.2), "T2 should be blocked by row lock held by T1")

            # Now allow T1 to proceed, finalize, and commit
            t1_can_proceed.set()
            th1.join(timeout=5.0)

            # T1 has committed, releasing the lock. T2 unblocks, re-reads state, and fails closed
            self.assertTrue(t2_finished.wait(timeout=5.0), "T2 did not complete after T1 committed")
            th2.join(timeout=5.0)

            # Assert T1 had no error
            self.assertIsNone(t1_error[0], f"T1 encountered error: {t1_error[0]}")

            # Verify T2 raised UserError('already been decided') or Serialization Failure
            self.assertIsNotNone(t2_error[0], "T2 should have encountered an error upon acquiring row lock")
            err_str = str(t2_error[0]).lower()
            self.assertTrue(
                "already been decided" in err_str or "could not serialize" in err_str or "concurrent update" in err_str,
                f"Expected already-decided or serialization error, got: {t2_error[0]}"
            )

            # Assert finalization occurred exactly once!
            self.assertEqual(finalize_counter[0], 1, "Approval finalization must happen exactly once!")

        finally:
            # Always restore all monkeypatches first!
            for pc in PartnerClasses:
                pc._approval_finalize_approve = orig_finalize
                pc._approval_validate_decision = orig_validate
                pc._approval_employee = orig_employee
                pc._approval_company = orig_company
                pc._approval_period = orig_period
                pc._approval_finalize_reject = orig_reject
                pc._approval_finalize_request_changes = orig_changes
                pc._approval_workflow_code = orig_wft_code
            for sc in StepClasses:
                sc._create_activity = orig_create_act
                sc._close_activity = orig_close_act
            DigestResUsers.create = orig_digest_create
            Registry.__new__ = orig_registry_new

            cleanup_errors = []
            try:
                cr_clean = registry._db.cursor()
                cr_clean.execute("SET statement_timeout = '15s'; SET lock_timeout = '10s';")
                env_clean = api.Environment(cr_clean, 1, {})
                if inst_id:
                    env_clean["cleon.approval.instance"].browse(inst_id).sudo().unlink()
                if target_id:
                    env_clean["res.partner"].browse(target_id).sudo().unlink()
                if chain_id:
                    env_clean["cleon.approval.chain"].browse(chain_id).sudo().unlink()
                if local_wft_id:
                    env_clean["cleon.approval.workflow.type"].browse(local_wft_id).sudo().unlink()
                if emp_id:
                    env_clean["hr.employee"].browse(emp_id).sudo().unlink()
                u_ids = [uid for uid in [user1_id, user2_id] if uid]
                if u_ids:
                    env_clean["res.users"].browse(u_ids).sudo().unlink()
                cr_clean.commit()
                cr_clean.close()
            except Exception as exc:
                cleanup_errors.append(exc)

            if cleanup_errors:
                raise AssertionError(f"Cleanup of committed concurrency test fixtures failed: {cleanup_errors}")

    def test_09_automated_sla_decision_provenance(self):
        """Automated SLA decisions mark human rows as skipped and set decision_source=sla_cron."""
        chain = self.env["cleon.approval.chain"].create({
            "name": "SLA Provenance Chain",
            "company_id": self.company.id,
            "workflow_type_id": self.wft.id,
            "active": True,
            "is_default": True,
            "step_ids": [(0, 0, {
                "sequence": 10,
                "name": "SLA Auto-Approve Step",
                "completion_mode": "all",
                "approver_type": "specific_users",
                "approver_user_ids": [(6, 0, [self.user_a.id, self.user_b.id])],
                "sla_timeout_hours": 1,
                "sla_action": "auto_approve",
            })],
        })

        target = self._create_test_record()
        inst = self.env["cleon.approval.instance"].action_start(target)
        step = inst.step_ids[0]

        # Simulate SLA auto-approval
        inst.action_decide("approve", comment="Auto-approved by SLA Escalation", automated=True)
        self.assertEqual(inst.state, "approved")
        self.assertEqual(inst.decision_source, "sla_cron")
        self.assertFalse(step.decision_user_id)

        # Human decision rows must NOT be marked approved; they must be skipped
        for dec in step.decision_ids:
            self.assertEqual(dec.state, "skipped", "Human decisions should be marked skipped on automated action")
