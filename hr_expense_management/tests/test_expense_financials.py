from datetime import timedelta

from odoo import Command, fields
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestExpenseFinancialDomains(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.employee_group = cls.env.ref("hr_expense_management.group_hr_expense_employee")
        cls.manager_group = cls.env.ref("hr_expense_management.group_hr_expense_manager")
        cls.finance_group = cls.env.ref("hr_expense_management.group_hr_expense_finance")

        def make_user(login, group):
            return cls.env["res.users"].with_context(no_reset_password=True).create({
                "name": login.replace("_", " ").title(),
                "login": login,
                "email": "%s@example.com" % login,
                "groups_id": [Command.set([group.id])],
            })

        cls.employee_user = make_user("financial_employee", cls.employee_group)
        cls.manager_user = make_user("financial_manager", cls.manager_group)
        cls.finance_user = make_user("financial_finance", cls.finance_group)
        cls.department = cls.env["hr.department"].create({"name": "Financial Test Department"})
        cls.employee = cls.env["hr.employee"].create({
            "name": "Financial Test Employee",
            "user_id": cls.employee_user.id,
            "department_id": cls.department.id,
        })
        cls.claim_type = cls.env.ref("hr_expense_management.claim_type_mileage")
        cls.claim_category = cls.claim_type.category_id
        cls.request_type = cls.env["hr.expense.request.type"].create({
            "name": "Budgeted Purchase",
            "code": "BUDGETED_PURCHASE_TEST",
            "creates_advance": False,
        })
        today = fields.Date.today()
        cls.period = cls.env["hr.expense.period"].with_user(cls.finance_user).create({
            "name": "Financial Test Period",
            "code": "FIN-TEST-PERIOD",
            "date_start": today - timedelta(days=15),
            "date_end": today + timedelta(days=15),
            "submission_cutoff": today + timedelta(days=10),
            "approval_cutoff": today + timedelta(days=10),
            "payment_cutoff": today + timedelta(days=12),
            "gl_cutoff": today + timedelta(days=12),
        })
        cls.period.with_user(cls.finance_user).action_open()
        cls.expense_account = cls.env["hr.expense.account"].with_user(cls.finance_user).create({
            "name": "Travel Expense Test", "code": "TST-5010", "account_type": "expense",
        })
        cls.payable_account = cls.env["hr.expense.account"].with_user(cls.finance_user).create({
            "name": "Employee Payable Test", "code": "TST-2010", "account_type": "liability",
        })
        cls.env["hr.expense.gl.map"].sudo().create({
            "name": "Test Claim Mapping",
            "source_type": "claim",
            "claim_category_id": cls.claim_category.id,
            "debit_account_id": cls.expense_account.id,
            "credit_account_id": cls.payable_account.id,
        })
        cls.budget = cls.env["hr.expense.budget"].with_user(cls.finance_user).create({
            "name": "Department Test Budget",
            "code": "BUD-FIN-TEST",
            "period_id": cls.period.id,
            "department_id": cls.department.id,
            "cost_center": "CC-FIN-TEST",
            "line_ids": [Command.create({
                "category_id": cls.claim_category.id,
                "account_id": cls.expense_account.id,
                "approved_amount": 1000,
                "forecast_amount": 900,
            })],
        })
        cls.budget.with_user(cls.finance_user).action_approve()
        cls.budget.with_user(cls.finance_user).action_activate()
        cls.budget_line = cls.budget.line_ids

    def _make_claim(self, amount=300, vendor=None):
        return self.env["hr.claim"].with_user(self.employee_user).create({
            "title": "Budgeted expense",
            "employee_id": self.employee.id,
            "claim_type_id": self.claim_type.id,
            "budget_line_id": self.budget_line.id,
            "expense_start_date": fields.Date.today(),
            "expense_end_date": fields.Date.today(),
            "line_ids": [Command.create({
                "description": "Budgeted travel",
                "category": "transport",
                "vendor_id": vendor.id if vendor else False,
                "amount": amount,
                "expense_date": fields.Date.today(),
            })],
        })

    def test_balanced_journal_posting_and_immutability(self):
        journal = self.env["hr.expense.journal"].with_user(self.finance_user).create({
            "description": "Manual balance test",
            "line_ids": [
                Command.create({"account_id": self.expense_account.id, "debit": 100}),
                Command.create({"account_id": self.payable_account.id, "credit": 90}),
            ],
        })
        with self.assertRaises(ValidationError):
            journal.with_user(self.finance_user).action_post()
        journal.line_ids.filtered("credit").with_user(self.finance_user).write({"credit": 100})
        journal.with_user(self.finance_user).action_post()
        self.assertEqual(journal.state, "posted")
        self.assertTrue(journal.balanced)
        with self.assertRaises(UserError):
            journal.line_ids.with_user(self.finance_user).write({"label": "Changed"})
        with self.assertRaises(AccessError):
            self.env["hr.expense.journal"].with_user(self.employee_user).create({
                "description": "Unauthorized journal"
            })

    def test_budget_commitment_actual_and_claim_journal(self):
        request = self.env["hr.expense.request"].with_user(self.employee_user).create({
            "employee_id": self.employee.id,
            "request_type_id": self.request_type.id,
            "purpose": "Budget commitment",
            "amount": 200,
            "needed_date": fields.Date.today() + timedelta(days=2),
            "budget_line_id": self.budget_line.id,
        })
        request.with_user(self.employee_user).action_submit()
        request.with_user(self.manager_user).action_approve("Within allocation")
        self.budget_line.invalidate_recordset()
        self.assertEqual(self.budget_line.committed_amount, 200)

        claim = self._make_claim(amount=300)
        claim.with_user(self.employee_user).action_submit()
        claim.with_user(self.manager_user).action_approve("Receipt checked")
        self.budget_line.invalidate_recordset()
        self.assertEqual(self.budget_line.actual_amount, 300)
        self.assertEqual(self.budget_line.available_amount, 500)
        self.assertTrue(claim.expense_journal_id)
        self.assertEqual(claim.expense_journal_id.state, "draft")
        self.assertTrue(claim.expense_journal_id.balanced)
        budget_payload = self.env["hr.claim"].with_user(self.finance_user).get_app_page(
            "budget", "overview"
        )
        self.assertEqual(budget_payload["kpis"]["committed"], 200)
        self.assertEqual(budget_payload["kpis"]["actual"], 300)
        accounts_payload = self.env["hr.claim"].with_user(self.finance_user).get_app_page(
            "accounts", "accounts"
        )
        self.assertGreaterEqual(accounts_payload["kpis"]["posting"], 2)

    def test_vendor_directory_and_owl_payload(self):
        category = self.env["hr.expense.vendor.category"].with_user(self.finance_user).create({
            "name": "Travel Supplier", "code": "TRAVEL-TEST",
            "default_expense_account_id": self.expense_account.id,
        })
        term = self.env["hr.expense.payment.term"].with_user(self.finance_user).create({
            "name": "Net 14", "code": "NET14-TEST", "due_days": 14,
        })
        result = self.env["hr.claim"].with_user(self.finance_user).app_create_vendor({
            "name": "Test Travel Vendor", "code": "V-TEST-001",
            "category_id": category.id, "term_id": term.id,
            "account_id": self.expense_account.id, "rating": 5,
        })
        vendor = self.env["res.partner"].browse(result["id"])
        claim = self._make_claim(amount=125, vendor=vendor)
        claim.with_user(self.employee_user).action_submit()
        claim.with_user(self.manager_user).action_approve()
        payload = self.env["hr.claim"].with_user(self.finance_user).get_app_page("vendors", "directory")
        vendor_row = next(row for row in payload["records"] if row["id"] == vendor.id)
        self.assertEqual(vendor_row["code"], "V-TEST-001")
        self.assertEqual(vendor_row["spend"], 125)
        self.assertTrue(payload["vendor_options"]["categories"])
        with self.assertRaises(AccessError):
            self.env["hr.claim"].with_user(self.employee_user).get_app_page("accounts", "accounts")

    def test_closed_period_blocks_submission(self):
        self.period.with_user(self.finance_user).action_close()
        claim = self._make_claim(amount=50)
        with self.assertRaises(UserError):
            claim.with_user(self.employee_user).action_submit()
