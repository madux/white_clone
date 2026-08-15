from datetime import timedelta

from odoo import Command, fields
from odoo.exceptions import AccessError, UserError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestExpenseRequestAdvanceWorkflow(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.employee_group = cls.env.ref("hr_claims.group_hr_claim_employee")
        cls.manager_group = cls.env.ref("hr_claims.group_hr_claim_manager")
        cls.finance_group = cls.env.ref("hr_claims.group_hr_claim_finance")

        def make_user(login, group):
            return cls.env["res.users"].with_context(no_reset_password=True).create({
                "name": login.replace("_", " ").title(), "login": login,
                "email": f"{login}@example.com", "groups_id": [Command.set([group.id])],
            })

        cls.employee_user = make_user("request_employee", cls.employee_group)
        cls.other_user = make_user("request_other", cls.employee_group)
        cls.manager_user = make_user("request_manager", cls.manager_group)
        cls.finance_user = make_user("request_finance", cls.finance_group)
        cls.employee = cls.env["hr.employee"].create({
            "name": "Request Employee", "user_id": cls.employee_user.id,
        })
        cls.other_employee = cls.env["hr.employee"].create({
            "name": "Other Request Employee", "user_id": cls.other_user.id,
        })
        cls.request_type = cls.env["hr.expense.request.type"].create({
            "name": "Project Cash Advance", "code": "TEST_ADVANCE",
            "creates_advance": True, "retirement_days": 14,
        })

    def _make_request(self, employee=None, user=None, amount=1000):
        employee = employee or self.employee
        user = user or self.employee_user
        return self.env["hr.expense.request"].with_user(user).create({
            "employee_id": employee.id, "request_type_id": self.request_type.id,
            "purpose": "Client implementation visit", "amount": amount,
            "needed_date": fields.Date.today() + timedelta(days=7),
        })

    def test_request_to_advance_and_full_retirement(self):
        request = self._make_request(amount=1500)
        request.with_user(self.employee_user).action_submit()
        self.assertEqual(request.state, "submitted")

        request.with_user(self.manager_user).action_approve("Budget confirmed")
        self.assertEqual(request.state, "approved")

        advance = request.with_user(self.finance_user).action_issue_advance()
        self.assertEqual(request.state, "fulfilled")
        self.assertEqual(advance.state, "outstanding")
        self.assertEqual(advance.outstanding_amount, 1500)

        advance.with_user(self.finance_user).action_retire(600, "Claim part one")
        self.assertEqual(advance.state, "partial")
        self.assertEqual(advance.outstanding_amount, 900)
        advance.with_user(self.finance_user).action_retire(900, "Final settlement")
        self.assertEqual(advance.state, "retired")
        self.assertEqual(advance.outstanding_amount, 0)
        with self.assertRaises(UserError):
            advance.with_user(self.finance_user).action_retire(1, "Over-retirement")

    def test_two_level_request_route(self):
        self.env["hr.expense.approval.rule"].create({
            "name": "Two level request route", "target": "request",
            "minimum_amount": 2000,
            "line_ids": [
                Command.create({
                    "name": "Line Manager", "sequence": 10,
                    "approver_type": "group", "group_id": self.manager_group.id,
                }),
                Command.create({
                    "name": "Second Review", "sequence": 20,
                    "approver_type": "group", "group_id": self.manager_group.id,
                }),
            ],
        })
        request = self._make_request(amount=2500)
        request.with_user(self.employee_user).action_submit()
        self.assertEqual(request.approval_step_ids.mapped("state"), ["pending", "waiting"])

        request.with_user(self.manager_user).action_approve("First level")
        self.assertEqual(request.state, "submitted")
        self.assertEqual(request.approval_step_ids.mapped("state"), ["approved", "pending"])
        request.with_user(self.manager_user).action_approve("Second level")
        self.assertEqual(request.state, "approved")
        self.assertEqual(request.approval_step_ids.mapped("state"), ["approved", "approved"])

    def test_request_and_advance_security(self):
        own = self._make_request()
        other = self._make_request(employee=self.other_employee, user=self.other_user)
        employee_records = self.env["hr.expense.request"].with_user(self.employee_user).search([])
        self.assertIn(own, employee_records)
        self.assertNotIn(other, employee_records)
        with self.assertRaises(AccessError):
            self.env["hr.expense.request"].with_user(self.employee_user).create({
                "employee_id": self.other_employee.id,
                "request_type_id": self.request_type.id,
                "purpose": "Not mine", "amount": 10,
                "needed_date": fields.Date.today(),
            })

    def test_backend_asset_bundle_compiles_expense_app(self):
        bundle = self.env["ir.qweb"]._get_asset_bundle(
            "web.assets_backend", css=False, js=True, debug_assets=False
        )
        attachment = bundle.js()
        self.assertTrue(attachment)
        self.assertIn(b"hr_claims.ExpenseApp", attachment.raw)
