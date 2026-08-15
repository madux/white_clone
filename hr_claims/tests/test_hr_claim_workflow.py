from datetime import timedelta

from odoo import Command, fields
from odoo.exceptions import AccessError, UserError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestHrClaimWorkflow(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.group_employee = cls.env.ref("hr_claims.group_hr_claim_employee")
        cls.group_manager = cls.env.ref("hr_claims.group_hr_claim_manager")
        cls.group_finance = cls.env.ref("hr_claims.group_hr_claim_finance")

        def make_user(login, group):
            return cls.env["res.users"].with_context(no_reset_password=True).create(
                {
                    "name": login.title(),
                    "login": login,
                    "email": f"{login}@example.com",
                    "groups_id": [Command.set([group.id])],
                }
            )

        cls.employee_user = make_user("claim_employee", cls.group_employee)
        cls.other_user = make_user("claim_other", cls.group_employee)
        cls.manager_user = make_user("claim_manager", cls.group_manager)
        cls.finance_user = make_user("claim_finance", cls.group_finance)
        cls.employee = cls.env["hr.employee"].create(
            {"name": "Claim Employee", "user_id": cls.employee_user.id}
        )
        cls.other_employee = cls.env["hr.employee"].create(
            {"name": "Other Employee", "user_id": cls.other_user.id}
        )
        cls.claim_type = cls.env.ref("hr_claims.claim_type_mileage")

    def _create_claim(self, user=None, employee=None, amount=100.0, state=None):
        user = user or self.employee_user
        employee = employee or self.employee
        values = {
            "title": "Client visit",
            "employee_id": employee.id,
            "claim_type_id": self.claim_type.id,
            "expense_start_date": fields.Date.today(),
            "expense_end_date": fields.Date.today(),
            "line_ids": [
                Command.create(
                    {
                        "description": "Taxi",
                        "category": "transport",
                        "amount": amount,
                        "expense_date": fields.Date.today(),
                    }
                )
            ],
        }
        if state:
            values["state"] = state
        return self.env["hr.claim"].with_user(user).create(values)

    def test_submit_approve_and_partial_payment(self):
        claim = self._create_claim(amount=100.0)
        claim.with_user(self.employee_user).action_submit()
        self.assertEqual(claim.state, "submitted")
        self.assertTrue(claim.submitted_date)

        claim.with_user(self.manager_user).action_approve()
        self.assertEqual(claim.state, "approved")
        self.assertEqual(claim.approved_by_id, self.manager_user)

        first = self.env["hr.claim.payment"].with_user(self.finance_user).create(
            {"claim_id": claim.id, "amount": 40.0, "payment_method": "bank"}
        )
        first.action_confirm()
        self.assertEqual(claim.state, "approved")
        self.assertEqual(claim.payment_state, "partial")

        second = self.env["hr.claim.payment"].with_user(self.finance_user).create(
            {"claim_id": claim.id, "amount": 60.0, "payment_method": "bank"}
        )
        second.action_confirm()
        self.assertEqual(claim.state, "paid")
        self.assertEqual(claim.payment_state, "paid")
        self.assertTrue(claim.paid_date)
        self.assertIn("paid", claim.audit_ids.mapped("action"))
        with self.assertRaises(AccessError):
            second.with_user(self.finance_user).write({"amount": 50.0})

    def test_return_resubmit_and_reject_requires_reason(self):
        claim = self._create_claim()
        claim.with_user(self.employee_user).action_submit()
        with self.assertRaises(UserError):
            claim.with_user(self.manager_user)._apply_negative_decision("reject", "")
        claim.with_user(self.manager_user)._apply_negative_decision(
            "return", "Please attach the route details."
        )
        self.assertEqual(claim.state, "returned")
        claim.with_user(self.employee_user).write({"description": "Route added."})
        claim.with_user(self.employee_user).action_submit()
        self.assertEqual(claim.state, "submitted")
        claim.with_user(self.manager_user)._apply_negative_decision(
            "reject", "Outside policy."
        )
        self.assertEqual(claim.state, "rejected")
        self.assertEqual(claim.rejection_reason, "Outside policy.")

    def test_roles_and_record_visibility(self):
        own_claim = self._create_claim(state="paid")
        self.assertEqual(own_claim.state, "draft")
        other_claim = self._create_claim(user=self.other_user, employee=self.other_employee)
        employee_claims = self.env["hr.claim"].with_user(self.employee_user).search([])
        self.assertIn(own_claim, employee_claims)
        self.assertNotIn(other_claim, employee_claims)
        manager_claims = self.env["hr.claim"].with_user(self.manager_user).search([])
        finance_claims = self.env["hr.claim"].with_user(self.finance_user).search([])
        self.assertIn(own_claim, manager_claims)
        self.assertIn(other_claim, manager_claims)
        self.assertIn(own_claim, finance_claims)
        self.assertIn(other_claim, finance_claims)

        employee_dashboard = (
            self.env["hr.claim"].with_user(self.employee_user).get_dashboard_data()
        )
        manager_dashboard = (
            self.env["hr.claim"].with_user(self.manager_user).get_dashboard_data()
        )
        self.assertEqual(employee_dashboard["kpis"]["total"], 1)
        self.assertEqual(manager_dashboard["kpis"]["total"], len(manager_claims))

        other_company = self.env["res.company"].create({"name": "Claims Other Co"})
        other_category = (
            self.env["hr.claim.category"]
            .sudo()
            .with_company(other_company)
            .create(
                {
                    "name": "Other Company Expenses",
                    "code": "OTHER",
                    "company_id": other_company.id,
                }
            )
        )
        other_type = (
            self.env["hr.claim.type"]
            .sudo()
            .with_company(other_company)
            .create(
                {
                    "name": "Other Company Claim",
                    "code": "OTHER",
                    "category_id": other_category.id,
                    "company_id": other_company.id,
                }
            )
        )
        company_employee = (
            self.env["hr.employee"]
            .sudo()
            .with_company(other_company)
            .create({"name": "Other Company Employee", "company_id": other_company.id})
        )
        cross_company_claim = (
            self.env["hr.claim"]
            .sudo()
            .with_company(other_company)
            .create(
                {
                    "title": "Cross-company claim",
                    "employee_id": company_employee.id,
                    "claim_type_id": other_type.id,
                    "company_id": other_company.id,
                }
            )
        )
        self.assertNotIn(
            cross_company_claim,
            self.env["hr.claim"].with_user(self.manager_user).search([]),
        )
        self.assertNotIn(
            cross_company_claim,
            self.env["hr.claim"].with_user(self.finance_user).search([]),
        )

        own_claim.with_user(self.employee_user).action_submit()
        with self.assertRaises(AccessError):
            own_claim.with_user(self.employee_user).with_context(
                hr_claim_workflow=True
            ).write({"state": "paid"})
        with self.assertRaises(AccessError):
            own_claim.with_user(self.finance_user).action_approve()
        with self.assertRaises(AccessError):
            self.env["hr.claim.payment"].with_user(self.manager_user).create(
                {"claim_id": own_claim.id, "amount": 10.0, "payment_method": "bank"}
            )
        with self.assertRaises(AccessError):
            self.env["hr.claim.audit"].with_user(self.employee_user).create(
                {
                    "claim_id": own_claim.id,
                    "action": "approved",
                    "description": "Forged event",
                }
            )

    def test_submission_validation(self):
        empty_claim = self.env["hr.claim"].with_user(self.employee_user).create(
            {
                "title": "Empty claim",
                "employee_id": self.employee.id,
                "claim_type_id": self.claim_type.id,
            }
        )
        with self.assertRaises(UserError):
            empty_claim.action_submit()

        claim = self._create_claim(amount=100.0)
        self.claim_type.maximum_per_claim = 50.0
        with self.assertRaises(UserError):
            claim.action_submit()

        self.claim_type.write(
            {
                "maximum_per_claim": 0.0,
                "receipt_policy": "conditional",
                "receipt_threshold": 10.0,
            }
        )
        with self.assertRaises(UserError):
            claim.action_submit()

        self.claim_type.write(
            {
                "receipt_policy": "none",
                "window_ids": [Command.clear()],
                "submission_window_days": 1,
            }
        )
        old_date = fields.Date.today() - timedelta(days=5)
        claim.write({"expense_start_date": old_date, "expense_end_date": old_date})
        with self.assertRaises(UserError):
            claim.action_submit()

        self.claim_type.write(
            {
                "submission_window_days": 30,
                "eligibility": "restricted",
                "employee_ids": [Command.set([self.other_employee.id])],
            }
        )
        claim.write(
            {
                "expense_start_date": fields.Date.today(),
                "expense_end_date": fields.Date.today(),
            }
        )
        with self.assertRaises(UserError):
            claim.action_submit()
