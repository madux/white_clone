from datetime import timedelta

from odoo import fields
from odoo.exceptions import ValidationError
from odoo.tests.common import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestConfigurationResources(TransactionCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.employee = cls.env["hr.employee"].create({"name": "Configuration Employee", "company_id": cls.env.company.id})
        cls.leave_type = cls.env["hr.leave.type"].create({
            "name": "Configuration Allocation", "company_id": cls.env.company.id,
            "requires_allocation": "yes", "leave_validation_type": "no_validation",
            "policy_classification": "other",
        })
        cls.policy = cls.env["hr.leave.policy"].create({
            "name": "Configuration Policy", "code": "CONFIG", "company_id": cls.env.company.id,
            "state": "draft", "apply_to": "selected", "employee_ids": [(6, 0, cls.employee.ids)],
        })
        cls.line = cls.env["hr.leave.policy.line"].create({
            "policy_id": cls.policy.id, "leave_type_id": cls.leave_type.id,
            "accrual_amount": 2, "accrual_period": "monthly", "accrual_basis": "calendar",
        })
        cls.policy.change_policy_status(cls.policy.id, "active")
        cls.balance = cls.env["hr.leave.balance.transaction"]
        cls.chain = cls.env["cleon.approval.chain"].create({
            "name": "Configuration Approval Flow", "workflow_type_id": cls.env.ref("hr_leave_dashboard.wft_leave_request").id,
            "is_default": False, "active": False,
        })
        cls.env["cleon.approval.step"].create({
            "chain_id": cls.chain.id, "name": "Manager Review", "sequence": 10,
            "approver_type": "line_manager", "completion_mode": "single",
        })
        cls.chain.write({"active": True})

    def test_inactive_allocation_is_history_but_not_available(self):
        result = self.balance.apply_leave_allocation_matrix([
            {"employee_id": self.employee.id, "leave_type_id": self.leave_type.id, "amount": 4},
        ], "Prepared allocation", fields.Date.today(), status="inactive")
        self.assertEqual(result["allocation_count"], 1)
        allocation = self.env["hr.leave.allocation"].search([("employee_id", "=", self.employee.id)], limit=1)
        self.assertNotEqual(allocation.state, "validate")
        self.assertEqual(self.balance._current_balance(self.employee.id, self.leave_type.id), 0)

    def test_manual_policy_accrual_is_idempotent(self):
        first = self.balance.run_accrual_manually(fields.Date.today())
        second = self.balance.run_accrual_manually(fields.Date.today())
        self.assertGreaterEqual(first["count"], 1)
        self.assertEqual(second["count"], 0)
        self.assertEqual(self.balance._current_balance(self.employee.id, self.leave_type.id), 2)

    def test_expired_allocation_is_not_usable(self):
        yesterday = fields.Date.today() - timedelta(days=1)
        allocation = self.env["hr.leave.allocation"].create({
            "private_name": "Expired", "holiday_type": "employee", "employee_id": self.employee.id,
            "holiday_status_id": self.leave_type.id, "number_of_days": 3,
            "date_from": yesterday - timedelta(days=10), "date_to": yesterday,
        })
        allocation.action_validate()
        self.assertEqual(self.balance._current_balance(self.employee.id, self.leave_type.id), 0)

    def test_official_holiday_range_sync_and_deactivation(self):
        today = fields.Date.today()
        holiday = self.env["hr.leave.official.holiday"].create({
            "name": "Range Holiday", "date_from": today, "date_to": today + timedelta(days=2),
            "holiday_type": "public", "active": True,
        })
        self.assertTrue(holiday.calendar_leave_ids)
        holiday.write({"active": False})
        self.assertFalse(holiday.calendar_leave_ids)

    def test_official_holiday_save_rpc_records_audit(self):
        today = fields.Date.today()
        result = self.env["hr.leave.official.holiday"].save_holiday({
            "name": "Audited Holiday", "type": "public", "date_from": today,
            "date_to": today + timedelta(days=1), "applies_to": "all",
            "repeats": "annually", "active": True,
        })
        holiday = self.env["hr.leave.official.holiday"].browse(result["id"])
        audit = self.env["hr.leave.audit.log"].search([
            ("entity_type", "=", "holiday"), ("entity_name", "=", holiday.name),
        ], limit=1)
        self.assertTrue(audit)
        self.assertEqual(audit.module_area, "calendar")

    def test_official_holiday_save_defaults_end_to_start(self):
        today = fields.Date.today()
        result = self.env["hr.leave.official.holiday"].save_holiday({
            "name": "Single Day Holiday", "type": "public", "date_from": today,
            "applies_to": "all", "country_region": "Nigeria",
        })
        holiday = self.env["hr.leave.official.holiday"].browse(result["id"])
        self.assertEqual(holiday.date_to, today)
        self.assertEqual(holiday.country_region, "Nigeria")

    def test_blackout_state_controls_enforcement_flag(self):
        record = self.env["hr.leave.blackout.period"].create({
            "name": "Scheduled Window", "date_from": fields.Date.today(), "date_to": fields.Date.today(),
            "state": "scheduled",
        })
        self.assertFalse(record.active)
        record.write({"state": "active"})
        self.assertTrue(record.active)

    def test_approval_auto_approve_must_follow_escalation(self):
        workflow_type = self.env.ref("hr_leave_dashboard.wft_leave_request")
        with self.assertRaises(ValidationError):
            self.env["cleon.approval.chain"].create({
                "name": "Invalid Timers", "workflow_type_id": workflow_type.id,
                "is_default": False, "active": False, "escalation_days": 3, "auto_approve_days": 2,
            })

    def test_approval_template_is_distinct_and_reusable(self):
        chain = self.chain
        template = self.env["hr.leave.approval.template"].create({
            "name": "Reusable Policy Blueprint", "chain_id": chain.id, "template_type": "global",
        })
        self.assertEqual(template.level_count, len(chain.step_ids))
        self.policy.write({"approval_workflow": "custom", "approval_template_id": template.id})
        self.assertEqual(self.policy.approval_template_id.chain_id, chain)

    def test_blackout_exception_is_explicit(self):
        chain = self.chain
        day = fields.Date.today() + timedelta(days=30)
        window = self.env["hr.leave.blackout.period"].create({
            "name": "Controlled Exception", "date_from": day, "date_to": day, "state": "active",
            "exception_mode": "approval", "exception_chain_id": chain.id,
        })
        result = self.leave_type.evaluate_leave_request_policy(
            self.employee.id, self.leave_type.id, day, day, 1,
        )
        self.assertTrue(result["blackout_exception_available"])
        self.assertEqual(result["blackout_window_id"], window.id)
