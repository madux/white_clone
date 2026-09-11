# -*- coding: utf-8 -*-
from odoo.tests import tagged
from odoo.tests.common import TransactionCase
from odoo.exceptions import AccessError, ValidationError


@tagged("post_install", "-at_install")
class TestCompliancePolicy(TransactionCase):
    def setUp(self):
        super().setUp()
        self.policy_type = self.env.ref(
            "cleon_document_management.policy_type_document_requirement"
        )
        self.renewable_type = self.env.ref(
            "cleon_document_management.policy_type_renewable_document"
        )
        self.compliance_request_type = self.env.ref(
            "cleon_document_management.policy_type_compliance_request"
        )
        self.retention_type = self.env.ref(
            "cleon_document_management.policy_type_retention"
        )
        self.doc_type = self.env["doc.document.type"].create(
            {"name": "Compliance Test Type", "category": "other"}
        )
        self.admin = self.env.ref("base.user_admin")
        self.manager_user = self.env["res.users"].create(
            {
                "name": "Document Manager Test",
                "login": "doc_manager_compliance_test",
                "groups_id": [
                    (
                        6,
                        0,
                        [
                            self.env.ref(
                                "cleon_document_management.group_document_manager"
                            ).id
                        ],
                    )
                ],
            }
        )
        self.employee = self.env["hr.employee"].search(
            [("user_id", "=", self.admin.id)], limit=1
        )
        if not self.employee:
            self.employee = self.env["hr.employee"].create(
                {
                    "name": "Compliance Test Employee",
                    "user_id": self.admin.id,
                    "company_id": self.admin.company_id.id,
                }
            )

    def _create_policy(self, user=None, **extra):
        values = {
            "name": extra.pop("name", "Test Policy"),
            "policy_type_id": extra.pop("policy_type_id", self.policy_type.id),
            "document_type_ids": [(6, 0, extra.pop("document_type_ids", [self.doc_type.id]))],
            "applies_to": "all",
        }
        values.update(extra)
        env = self.env["doc.compliance.policy"]
        if user:
            env = env.with_user(user)
        return env.create(values)

    def test_policy_create_seeds_auto_requirement(self):
        policy = self._create_policy(user=self.admin, name="Test Policy")
        self.assertTrue(policy.auto_requirement_id)
        self.assertEqual(policy.auto_requirement_id.policy_id, policy)
        evaluation = self.env["doc.compliance.evaluation"].search(
            [("policy_id", "=", policy.id), ("employee_id", "=", self.employee.id)],
            limit=1,
        )
        self.assertTrue(evaluation)

    def test_policy_create_creates_evaluation_lines(self):
        policy = self._create_policy(user=self.admin, name="Evaluation Line Policy")
        evaluation = self.env["doc.compliance.evaluation"].search(
            [("policy_id", "=", policy.id), ("employee_id", "=", self.employee.id)],
            limit=1,
        )
        self.assertTrue(evaluation)
        self.assertTrue(evaluation.line_ids)
        self.assertEqual(
            evaluation.line_ids[0].document_type_id.id,
            self.doc_type.id,
        )

    def test_policy_create_rejected_for_manager_without_admin(self):
        with self.assertRaises(AccessError):
            self._create_policy(user=self.manager_user, name="Manager Policy")

    def test_renewable_document_policy_persists_type_fields(self):
        policy = self._create_policy(
            user=self.admin,
            name="Renewable Policy",
            policy_type_id=self.renewable_type.id,
            alert_schedule_days="30,7,0",
            escalate_hr_days=5,
            auto_request_renewal=False,
        )
        self.assertEqual(policy.alert_schedule_days, "30,7,0")
        self.assertEqual(policy.escalate_hr_days, 5)
        self.assertFalse(policy.auto_request_renewal)

    def test_compliance_request_policy_persists_type_fields(self):
        policy = self._create_policy(
            user=self.admin,
            name="Lifecycle Policy",
            policy_type_id=self.compliance_request_type.id,
            event_trigger="transfer",
            due_days=21,
            reminder_frequency_days=5,
        )
        self.assertEqual(policy.event_trigger, "transfer")
        self.assertEqual(policy.due_days, 21)
        self.assertEqual(policy.reminder_frequency_days, 5)

    def test_retention_policy_persists_type_fields(self):
        policy = self._create_policy(
            user=self.admin,
            name="Retention Policy",
            policy_type_id=self.retention_type.id,
            audit_frequency="monthly",
            sample_pct=50,
        )
        self.assertEqual(policy.audit_frequency, "monthly")
        self.assertEqual(policy.sample_pct, 50)

    def test_document_requirement_policy_persists_allow_waiver(self):
        policy = self._create_policy(
            user=self.admin,
            name="No Waiver Policy",
            allow_waiver=False,
        )
        self.assertFalse(policy.allow_waiver)

    def test_exception_blocked_when_waiver_disabled(self):
        policy = self._create_policy(
            user=self.admin,
            name="No Waiver Policy",
            allow_waiver=False,
        )
        with self.assertRaises(ValidationError):
            self.env["doc.compliance.exception"].with_user(self.admin).create(
                {
                    "employee_id": self.employee.id,
                    "policy_id": policy.id,
                    "reason": "Should fail",
                    "valid_until": "2099-12-31",
                }
            )
