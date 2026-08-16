from datetime import timedelta

from odoo import Command, fields
from odoo.exceptions import AccessError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestExpenseGovernanceAndOwlGateway(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        def make_user(login, group_xmlid):
            group = cls.env.ref(group_xmlid)
            return cls.env["res.users"].with_context(no_reset_password=True).create({
                "name": login.replace("_", " ").title(), "login": login,
                "email": "%s@example.com" % login, "groups_id": [Command.set([group.id])],
            })

        cls.employee_user = make_user("governance_employee", "hr_expense_management.group_hr_expense_employee")
        cls.manager_user = make_user("governance_manager", "hr_expense_management.group_hr_expense_manager")
        cls.finance_user = make_user("governance_finance", "hr_expense_management.group_hr_expense_finance")
        cls.admin_user = make_user("governance_admin", "hr_expense_management.group_hr_expense_admin")
        cls.department = cls.env["hr.department"].create({"name": "Governance"})
        cls.employee = cls.env["hr.employee"].create({
            "name": "Governance Employee", "user_id": cls.employee_user.id,
            "department_id": cls.department.id,
        })
        cls.manager_employee = cls.env["hr.employee"].create({
            "name": "Governance Manager", "user_id": cls.manager_user.id,
            "department_id": cls.department.id,
        })
        cls.employee.parent_id = cls.manager_employee
        cls.department.manager_id = cls.manager_employee

    def test_all_remaining_owl_pages_return_live_payloads(self):
        self.assertFalse(hasattr(self.env["hr.claim"], "get_app_page"))
        admin_claim = self.env["hr.expense.app"].with_user(self.admin_user)
        for module, pages in {
            "setup": ("progress", "company", "policies", "onboarding"),
            "audit": ("activity", "users", "system", "search", "filters"),
            "settings": ("policies", "workflows", "email", "integrations"),
            "theme": ("customize",),
        }.items():
            for page in pages:
                payload = admin_claim.get_app_page(module, page)
                self.assertTrue(payload["available"], "%s/%s must be live" % (module, page))

        manager_claim = self.env["hr.expense.app"].with_user(self.manager_user)
        for page in ("members", "departments", "roles", "analytics", "settings"):
            self.assertTrue(manager_claim.get_app_page("teams", page)["available"])
        for page in ("financial", "claims", "employees", "custom", "scheduled"):
            self.assertTrue(manager_claim.get_app_page("reports", page)["available"])

        employee_claim = self.env["hr.expense.app"].with_user(self.employee_user)
        with self.assertRaises(AccessError):
            employee_claim.get_app_page("audit", "activity")
        with self.assertRaises(AccessError):
            employee_claim.get_app_page("reports", "financial")

    def test_theme_settings_reports_and_audit_persist(self):
        gateway = self.env["hr.expense.app"].with_user(self.admin_user)
        gateway.app_save_company_settings({
            "require_receipts": True, "receipt_threshold": 250,
            "approval_days": 2, "payment_days": 4,
            "allow_over_budget": False, "enable_email": True, "enable_appeals": True,
        })
        company = gateway.app_save_company_profile({
            "name": self.env.company.name, "email": "expenses@example.com", "phone": "+2341000000",
        })
        self.assertEqual(company["email"], "expenses@example.com")
        theme = gateway.app_save_theme({
            "name": "Governance Theme", "primary_color": "#d946ef",
            "secondary_color": "#7c3aed", "sidebar_color": "#17102a",
            "surface_color": "#f8fafc", "font_family": "inter",
            "density": "compact", "corner_style": "soft",
        })
        self.assertEqual(theme["primary_color"], "#d946ef")
        policy = gateway.app_create_policy({
            "name": "Receipts", "code": "RECEIPTS", "policy_type": "claim",
            "description": "Receipts are required.",
        })
        self.assertTrue(policy["id"])
        custom = gateway.app_create_custom_report({
            "name": "Monthly Finance", "report_type": "financial", "date_basis": "current_month",
        })
        schedule = gateway.app_create_scheduled_report({
            "name": "Monthly Finance Delivery", "report_id": custom["id"],
            "recipient_id": self.manager_user.id, "frequency": "monthly", "format": "pdf",
        })
        self.assertTrue(schedule["id"])
        scheduled = self.env["hr.expense.scheduled.report"].browse(schedule["id"])
        scheduled.action_queue_delivery()
        self.assertEqual(scheduled.last_status, "success")
        self.assertTrue(self.env["mail.mail"].sudo().search_count([
            ("subject", "=", "Expense report: Monthly Finance")
        ]))
        actions = self.env["hr.expense.audit"].sudo().search([]).mapped("action")
        self.assertIn("settings_updated", actions)
        self.assertIn("theme_updated", actions)
        self.assertIn("policy_created", actions)
        self.assertIn("report_created", actions)
        self.assertIn("schedule_created", actions)
        event = self.env["hr.expense.audit"].sudo().search([], limit=1)
        with self.assertRaises(AccessError):
            event.with_user(self.admin_user).write({"description": "Changed"})

    def test_owl_claim_creation_and_advance_writeoff(self):
        gateway = self.env["hr.expense.app"].with_user(self.employee_user)
        claim = gateway.app_create_claim({
            "claim_type_id": self.env.ref("hr_expense_management.claim_type_mileage").id,
            "title": "OWL claim", "description": "Created in the step wizard",
            "money_type": "personal", "expense_date": fields.Date.today(),
            "lines": [
                {"category": "transport", "description": "Taxi", "amount": 120, "receipt_reference": "R-120"},
                {"category": "meals", "description": "Lunch", "amount": 80, "receipt_reference": "R-080"},
            ],
            "submit": False,
        })
        claim_record = self.env["hr.claim"].browse(claim["id"])
        self.assertEqual(claim_record.title, "OWL claim")
        self.assertEqual(len(claim_record.line_ids), 2)
        self.assertEqual(claim_record.amount_total, 200)

        advance = self.env["hr.cash.advance"].with_user(self.finance_user).create({
            "employee_id": self.employee.id, "issued_amount": 1000,
            "retirement_due_date": fields.Date.today() + timedelta(days=14),
        })
        advance.action_issue()
        writeoff = self.env["hr.expense.app"].with_user(self.finance_user).app_create_writeoff(
            advance.id, 1000, "Unrecoverable balance"
        )
        record = self.env["hr.cash.advance.writeoff"].browse(writeoff["id"])
        self.assertEqual(record.state, "submitted")
        with self.assertRaises(AccessError):
            record.with_user(self.finance_user).action_approve("Not independent")
        record.with_user(self.admin_user).action_approve("Approved after review")
        self.assertEqual(record.state, "posted")
        self.assertEqual(advance.state, "written_off")
        self.assertEqual(advance.outstanding_amount, 0)
