from datetime import timedelta

from odoo import Command, fields
from odoo.exceptions import AccessError, UserError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestExpenseRequestAdvanceWorkflow(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.employee_group = cls.env.ref("hr_expense_management.group_hr_expense_employee")
        cls.manager_group = cls.env.ref("hr_expense_management.group_hr_expense_manager")
        cls.finance_group = cls.env.ref("hr_expense_management.group_hr_expense_finance")

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
        cls.claim_type = cls.env.ref("hr_expense_management.claim_type_mileage")

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
        self.assertIn(b"hr_expense_management.ExpenseApp", attachment.raw)

    def test_finance_batch_pays_approved_claims(self):
        claim = self.env["hr.claim"].with_user(self.employee_user).create({
            "title": "Batch payable", "employee_id": self.employee.id,
            "claim_type_id": self.claim_type.id,
            "expense_start_date": fields.Date.today(), "expense_end_date": fields.Date.today(),
            "line_ids": [Command.create({
                "description": "Travel", "category": "transport", "amount": 750,
                "expense_date": fields.Date.today(),
            })],
        })
        claim.with_user(self.employee_user).action_submit()
        claim.with_user(self.manager_user).action_approve()
        method = self.env.ref("hr_expense_management.payment_method_bank")
        batch = self.env["hr.expense.payment.batch"].with_user(self.finance_user).create({
            "method_id": method.id, "claim_ids": [Command.set([claim.id])],
            "reference": "BANK-RUN-001",
        })
        batch.action_validate()
        batch.action_process()
        self.assertEqual(batch.state, "completed")
        self.assertEqual(claim.state, "paid")
        self.assertEqual(batch.payment_ids.amount, 750)

    def test_petty_cash_expense_replenishment_and_reconciliation(self):
        fund = self.env["hr.petty.cash.fund"].with_user(self.finance_user).create({
            "name": "Test Office Fund", "code": "PC-TEST",
            "location": "Head Office", "custodian_id": self.employee.id,
            "maximum_amount": 5000, "minimum_threshold": 1000,
        })
        opening = self.env["hr.petty.cash.transaction"].with_user(self.finance_user).create({
            "fund_id": fund.id, "transaction_type": "opening", "payee": "Opening",
            "amount": 5000,
        })
        opening.action_submit()
        opening.action_approve()
        self.assertEqual(fund.current_balance, 5000)

        expense = self.env["hr.petty.cash.transaction"].with_user(self.employee_user).create({
            "fund_id": fund.id, "transaction_type": "expense", "payee": "Courier",
            "category": "Delivery", "amount": 1200,
        })
        expense.action_submit()
        with self.assertRaises(AccessError):
            expense.with_user(self.employee_user).write({"state": "posted"})
        expense.with_user(self.finance_user).action_approve()
        self.assertEqual(fund.current_balance, 3800)

        replenishment = self.env["hr.petty.cash.replenishment"].with_user(self.employee_user).create({
            "fund_id": fund.id, "requested_amount": 1200,
            "justification": "Restore the fund to its approved maximum.",
        })
        replenishment.action_submit()
        replenishment.with_user(self.finance_user).action_approve()
        replenishment.with_user(self.finance_user).action_issue()
        self.assertEqual(replenishment.state, "issued")
        self.assertEqual(fund.current_balance, 5000)

        reconciliation = self.env["hr.petty.cash.reconciliation"].with_user(self.employee_user).create({
            "fund_id": fund.id, "period_start": fields.Date.today() - timedelta(days=7),
            "physical_count": 5000,
        })
        reconciliation.action_confirm()
        self.assertEqual(reconciliation.state, "passed")
