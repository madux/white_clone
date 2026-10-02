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
        manual_audits = self.env["hr.leave.audit.log"].search([
            ("action", "=", "accrual_processed"), ("module_area", "=", "accrual"),
            ("entity_type", "=", "balance"), ("actor_id", "=", self.env.user.id),
        ], order="create_date")
        self.assertGreaterEqual(len(manual_audits), 2)
        self.assertIn("0 new accrual", manual_audits[-1].note)

    def test_manual_policy_accrual_catches_up_missed_month(self):
        today = fields.Date.today()
        employee = self.env["hr.employee"].create({"name": "Catch-up Employee", "company_id": self.env.company.id})
        missed_month = today.replace(day=1) - timedelta(days=1)
        self.env["hr.leave.policy.assignment"].create({
            "policy_id": self.policy.id, "policy_line_id": self.line.id,
            "leave_type_id": self.leave_type.id, "employee_id": employee.id,
            "date_from": missed_month.replace(day=1),
        })
        result = self.balance.run_accrual_manually(today)
        runs = self.env["hr.leave.accrual.run"].search([
            ("employee_id", "=", employee.id), ("leave_type_id", "=", self.leave_type.id),
        ], order="effective_date")
        self.assertEqual(len(runs), 2)
        self.assertEqual([run.effective_date for run in runs], [
            missed_month.replace(day=1), today.replace(day=1),
        ])
        self.assertEqual(self.balance._current_balance(employee.id, self.leave_type.id), 4)
        duplicate = self.balance.run_accrual_manually(today)
        self.assertEqual(duplicate["count"], 0)
        self.assertEqual(self.env["hr.leave.accrual.run"].search_count([
            ("employee_id", "=", employee.id), ("leave_type_id", "=", self.leave_type.id),
        ]), 2)
        self.assertEqual(self.balance._current_balance(employee.id, self.leave_type.id), 4)

    def test_manual_policy_accrual_repairs_a_hole_after_a_later_run(self):
        employee = self.env["hr.employee"].create({"name": "Gap Employee", "company_id": self.env.company.id})
        assignment = self.env["hr.leave.policy.assignment"].create({
            "policy_id": self.policy.id, "policy_line_id": self.line.id,
            "leave_type_id": self.leave_type.id, "employee_id": employee.id,
            "date_from": "2026-01-01",
        })
        Run = self.env["hr.leave.accrual.run"]
        for month in ("2026-01", "2026-03"):
            Run.create({
                "employee_id": employee.id, "leave_type_id": self.leave_type.id,
                "period_key": "policy:%s:month:%s" % (assignment.id, month),
                "effective_date": "%s-01" % month, "amount": 2,
                "reason": "fixture",
            })
        self.balance.run_accrual_manually("2026-04-01")
        runs = Run.search([
            ("employee_id", "=", employee.id), ("leave_type_id", "=", self.leave_type.id),
        ], order="effective_date")
        self.assertEqual([run.effective_date for run in runs], [
            fields.Date.to_date("2026-01-01"), fields.Date.to_date("2026-02-01"),
            fields.Date.to_date("2026-03-01"), fields.Date.to_date("2026-04-01"),
        ])

    def test_monthly_join_date_waits_until_anniversary_day(self):
        leave_type = self.env["hr.leave.type"].create({
            "name": "Joined Date Leave", "leave_code": "JOIN", "company_id": self.env.company.id,
            "requires_allocation": "yes", "leave_validation_type": "no_validation",
            "policy_classification": "other",
        })
        employee = self.env["hr.employee"].create({"name": "Joined Date Employee", "company_id": self.env.company.id})
        self.env["hr.contract"].create({
            "name": "Joined Date Contract", "employee_id": employee.id,
            "state": "open", "kanban_state": "normal", "wage": 1, "date_start": "2024-01-20",
        })
        line = self.env["hr.leave.policy.line"].create({
            "policy_id": self.policy.id, "leave_type_id": leave_type.id,
            "accrual_amount": 1, "accrual_period": "monthly", "accrual_basis": "join_date",
        })
        self.env["hr.leave.policy.assignment"].create({
            "policy_id": self.policy.id, "policy_line_id": line.id,
            "leave_type_id": leave_type.id, "employee_id": employee.id, "date_from": "2026-09-01",
        })
        self.balance.run_accrual_manually("2026-09-11")
        self.assertFalse(self.env["hr.leave.accrual.run"].search([
            ("employee_id", "=", employee.id), ("leave_type_id", "=", leave_type.id),
        ]))
        self.balance.run_accrual_manually("2026-09-20")
        run = self.env["hr.leave.accrual.run"].search([
            ("employee_id", "=", employee.id), ("leave_type_id", "=", leave_type.id),
        ], limit=1)
        self.assertEqual(run.effective_date, fields.Date.to_date("2026-09-20"))

    def test_calendar_accrual_does_not_predate_assignment(self):
        employee = self.env["hr.employee"].create({"name": "Partial Period Employee", "company_id": self.env.company.id})
        self.env["hr.leave.policy.assignment"].create({
            "policy_id": self.policy.id, "policy_line_id": self.line.id,
            "leave_type_id": self.leave_type.id, "employee_id": employee.id,
            "date_from": "2026-09-15",
        })
        self.balance.run_accrual_manually("2026-09-20")
        run = self.env["hr.leave.accrual.run"].search([
            ("employee_id", "=", employee.id), ("leave_type_id", "=", self.leave_type.id),
        ], limit=1)
        self.assertEqual(run.effective_date, fields.Date.to_date("2026-09-15"))

    def test_weekly_and_calendar_year_accruals_catch_up(self):
        Run = self.env["hr.leave.accrual.run"]
        weekly_type = self.env["hr.leave.type"].create({
            "name": "Weekly Leave", "leave_code": "WEEK", "company_id": self.env.company.id,
            "requires_allocation": "yes", "leave_validation_type": "no_validation",
            "policy_classification": "other",
        })
        weekly_line = self.env["hr.leave.policy.line"].create({
            "policy_id": self.policy.id, "leave_type_id": weekly_type.id,
            "accrual_amount": 1, "accrual_period": "weekly", "accrual_basis": "calendar",
        })
        weekly_employee = self.env["hr.employee"].create({"name": "Weekly Employee", "company_id": self.env.company.id})
        self.env["hr.leave.policy.assignment"].create({
            "policy_id": self.policy.id, "policy_line_id": weekly_line.id,
            "leave_type_id": weekly_type.id, "employee_id": weekly_employee.id, "date_from": "2026-01-01",
        })
        self.balance.run_accrual_manually("2026-01-05")
        self.balance.run_accrual_manually("2026-01-19")
        self.assertEqual(Run.search_count([
            ("employee_id", "=", weekly_employee.id), ("leave_type_id", "=", weekly_type.id),
        ]), 4)

        yearly_type = self.env["hr.leave.type"].create({
            "name": "Yearly Leave", "leave_code": "YEAR", "company_id": self.env.company.id,
            "requires_allocation": "yes", "leave_validation_type": "no_validation",
            "policy_classification": "other",
        })
        yearly_line = self.env["hr.leave.policy.line"].create({
            "policy_id": self.policy.id, "leave_type_id": yearly_type.id,
            "accrual_amount": 1, "accrual_period": "annually", "accrual_basis": "calendar",
        })
        yearly_employee = self.env["hr.employee"].create({"name": "Yearly Employee", "company_id": self.env.company.id})
        self.env["hr.leave.policy.assignment"].create({
            "policy_id": self.policy.id, "policy_line_id": yearly_line.id,
            "leave_type_id": yearly_type.id, "employee_id": yearly_employee.id, "date_from": "2025-01-01",
        })
        self.balance.run_accrual_manually("2025-01-01")
        self.balance.run_accrual_manually("2026-02-01")
        self.assertEqual(Run.search_count([
            ("employee_id", "=", yearly_employee.id), ("leave_type_id", "=", yearly_type.id),
        ]), 2)

    def test_anniversary_accrual_handles_february_29(self):
        leave_type = self.env["hr.leave.type"].create({
            "name": "Leap Day Leave", "company_id": self.env.company.id,
            "leave_code": "LEAP",
            "requires_allocation": "yes", "leave_validation_type": "no_validation",
            "policy_classification": "other",
        })
        employee = self.env["hr.employee"].create({
            "name": "Leap Day Employee", "company_id": self.env.company.id,
        })
        self.env["hr.contract"].create({
            "name": "Leap Day Contract", "employee_id": employee.id,
            "state": "open", "kanban_state": "normal", "wage": 1,
            "date_start": "2024-02-29",
        })
        line = self.env["hr.leave.policy.line"].create({
            "policy_id": self.policy.id, "leave_type_id": leave_type.id,
            "accrual_amount": 1, "accrual_period": "annually", "accrual_basis": "anniversary",
        })
        self.env["hr.leave.policy.assignment"].create({
            "policy_id": self.policy.id, "policy_line_id": line.id,
            "leave_type_id": leave_type.id, "employee_id": employee.id,
            "date_from": "2025-01-01",
        })
        result = self.balance.run_accrual_manually("2025-03-01")
        self.assertGreaterEqual(result["count"], 1)
        run = self.env["hr.leave.accrual.run"].search([
            ("employee_id", "=", employee.id), ("leave_type_id", "=", leave_type.id),
        ], limit=1)
        self.assertEqual(run.effective_date, fields.Date.to_date("2025-02-28"))

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
        # ``active`` controls archive visibility; it is independent from the
        # business lifecycle state (draft/scheduled/active).
        self.assertTrue(record.active)
        record.write({"state": "active"})
        self.assertTrue(record.active)
        archived = self.env["hr.leave.blackout.period"].create({
            "name": "Archived Window", "date_from": fields.Date.today(), "date_to": fields.Date.today(),
            "state": "scheduled", "active": False,
        })
        archived.write({"state": "active"})
        self.assertFalse(archived.active)

    def test_blackout_duplicate_starts_as_visible_draft(self):
        record = self.env["hr.leave.blackout.period"].create({
            "name": "Visible Source", "date_from": fields.Date.today(), "date_to": fields.Date.today(),
            "state": "active",
        })
        duplicate = self.env["hr.leave.blackout.period"].duplicate_blackout(record.id)
        copy = self.env["hr.leave.blackout.period"].browse(duplicate["id"])
        self.assertEqual(copy.state, "draft")
        self.assertTrue(copy.active)

    def test_scheduled_blackout_is_activated_when_due(self):
        blackout = self.env["hr.leave.blackout.period"].create({
            "name": "Due Scheduled Window", "date_from": fields.Date.today() - timedelta(days=1),
            "date_to": fields.Date.today() + timedelta(days=1), "state": "scheduled",
        })
        future = self.env["hr.leave.blackout.period"].create({
            "name": "Future Scheduled Window", "date_from": fields.Date.today() + timedelta(days=2),
            "date_to": fields.Date.today() + timedelta(days=3), "state": "scheduled",
        })
        draft = self.env["hr.leave.blackout.period"].create({
            "name": "Draft Window", "date_from": fields.Date.today() - timedelta(days=3),
            "date_to": fields.Date.today() + timedelta(days=3), "state": "draft",
        })
        self.env["hr.leave.blackout.period"]._cron_activate_scheduled()
        self.assertEqual(blackout.state, "active")
        self.assertEqual(future.state, "scheduled")
        self.assertEqual(draft.state, "draft")
        # A second run is idempotent: the already-promoted window is not
        # selected again and future/draft windows remain untouched.
        self.assertEqual(self.env["hr.leave.blackout.period"]._cron_activate_scheduled(), 0)

    def test_blackout_lifecycle_states_control_enforcement(self):
        base = fields.Date.today() + timedelta(days=40)
        for state, expected_block in (("draft", False), ("scheduled", False), ("active", True)):
            day = base + timedelta(days=(0 if state == "draft" else 1 if state == "scheduled" else 2))
            self.env["hr.leave.blackout.period"].create({
                "name": "%s enforcement window" % state, "date_from": day, "date_to": day, "state": state,
            })
            result = self.leave_type.evaluate_leave_request_policy(self.employee.id, self.leave_type.id, day, day, 1)
            self.assertEqual(bool(result["blackout_window_id"]), expected_block, state)

    def test_archived_blackout_is_hidden_from_policy_selector(self):
        archived = self.env["hr.leave.blackout.period"].create({
            "name": "Hidden Archived Window", "date_from": fields.Date.today(), "date_to": fields.Date.today(),
            "state": "draft", "active": False,
        })
        visible = self.env["hr.leave.blackout.period"].create({
            "name": "Visible Draft Window", "date_from": fields.Date.today(), "date_to": fields.Date.today(),
            "state": "draft",
        })
        options = self.policy._options()["blackout_periods"]
        option_ids = {item["id"] for item in options}
        self.assertNotIn(archived.id, option_ids)
        self.assertIn(visible.id, option_ids)

    def test_blackout_csv_import_reports_invalid_rows(self):
        result = self.env["hr.leave.blackout.period"].import_blackouts([
            {"name": "Imported Maintenance", "date_from": "2026-11-01", "date_to": "2026-11-03", "state": "scheduled", "reason": "Imported"},
            {"name": "", "date_from": "not-a-date", "date_to": "2026-11-04"},
        ])
        self.assertEqual(result["imported"], 1)
        self.assertEqual(len(result["errors"]), 1)
        record = self.env["hr.leave.blackout.period"].browse(result["ids"])
        self.assertEqual(record.state, "scheduled")
        self.assertEqual(record.reason, "Imported")

    def test_approval_auto_approve_must_follow_escalation(self):
        workflow_type = self.env.ref("hr_leave_dashboard.wft_leave_request")
        with self.assertRaises(ValidationError):
            self.env["cleon.approval.chain"].create({
                "name": "Invalid Timers", "workflow_type_id": workflow_type.id,
                "is_default": False, "active": False, "escalation_days": 3, "auto_approve_days": 2,
            })

    def test_configuration_user_can_save_non_ai_settings_without_ai_permission(self):
        configuration = self.env.ref("hr_leave_dashboard.group_leave_permission_configuration")
        user = self.env["res.users"].with_context(no_reset_password=True).create({
            "name": "Settings Configuration User", "login": "settings.configuration.user",
            "company_id": self.env.company.id, "company_ids": [(6, 0, self.env.company.ids)],
            "groups_id": [(6, 0, [self.env.ref("base.group_user").id, configuration.id])],
        })
        settings = self.env["hr.leave"].with_user(user)
        values = settings.get_leave_settings()["form"]
        values["calendar_privacy"] = "full"
        values.update({
            "bradford_enabled": True,
            "bradford_window_weeks": 26,
            "bradford_min_spell_days": 2,
            "bradford_caution": 40,
            "bradford_concern": 80,
            "bradford_serious": 160,
            "bradford_critical": 320,
        })
        settings.save_leave_settings(values)
        self.assertEqual(self.env.company.leave_calendar_privacy, "full")
        self.assertEqual(self.env.company.leave_bradford_window_weeks, 26)
        self.assertEqual(self.env.company.leave_bradford_min_spell_days, 2)
        self.assertEqual(
            [
                self.env.company.leave_bradford_caution,
                self.env.company.leave_bradford_concern,
                self.env.company.leave_bradford_serious,
                self.env.company.leave_bradford_critical,
            ],
            [40, 80, 160, 320],
        )

    def test_approval_template_is_distinct_and_reusable(self):
        chain = self.chain
        template = self.env["hr.leave.approval.template"].create({
            "name": "Reusable Policy Blueprint", "chain_id": chain.id, "template_type": "global",
        })
        self.assertEqual(template.level_count, len(chain.step_ids))
        self.policy.write({"approval_workflow": "custom", "approval_template_id": template.id})
        self.assertEqual(self.policy.approval_template_id.chain_id, chain)

    def test_seeded_approval_templates_have_complete_active_routes(self):
        """The confirmed baseline stays reusable and does not seed fake policy scope."""
        external_ids = [
            "approval_template_standard_leave", "approval_template_department_head",
            "approval_template_executive", "approval_template_hr_review",
            "approval_template_short_leave", "approval_template_project_team",
            "approval_template_individual_employee",
        ]
        templates = self.env["hr.leave.approval.template"].browse([
            self.env.ref("hr_leave_dashboard.%s" % external_id).id
            for external_id in external_ids
        ])
        self.assertEqual(len(templates), 7)
        self.assertTrue(all(template.template_type == "global" for template in templates))
        self.assertTrue(all(template.active and template.chain_id.active and template.chain_id.step_ids for template in templates))
        self.assertEqual(self.env.ref("hr_leave_dashboard.approval_template_hr_review").chain_id.escalation_days, 1)
        self.assertEqual(self.env.ref("hr_leave_dashboard.approval_template_hr_review").chain_id.auto_approve_days, 3)

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
