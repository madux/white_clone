# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError, ValidationError
from odoo.tests.common import TransactionCase


class TestLeaveAiCapabilities(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.company = cls.env.company
        # Enable all 8 independent AI capabilities for testing.
        # Note: there is no master toggle; each capability is independently controlled.
        cls.company.write({
            "leave_ai_assistant_enabled": True,
            "leave_ai_nl_request_enabled": True,
            "leave_ai_date_recommendations_enabled": True,
            "leave_ai_conflict_coverage_enabled": True,
            "leave_ai_approval_support_enabled": True,
            "leave_ai_anomaly_detection_enabled": True,
            "leave_ai_calendar_summary_enabled": True,
            "leave_ai_executive_brief_enabled": True,
            "leave_ai_audit_logging": True,
        })

        base_group = cls.env.ref("base.group_user")
        hr_admin_role = cls.env.ref("hr_leave_dashboard.group_leave_administrator")
        hr_user_group = cls.env.ref("hr.group_hr_user")
        exec_group = cls.env.ref("hr_leave_dashboard.group_leave_permission_executive_analytics")

        def create_test_user(login, groups):
            return cls.env["res.users"].with_context(no_reset_password=True).create({
                "name": login.replace(".", " ").title(),
                "login": login,
                "email": f"{login}@example.test",
                "company_id": cls.company.id,
                "company_ids": [(6, 0, cls.company.ids)],
                "groups_id": [(6, 0, [g.id for g in groups])],
            })

        cls.hr_admin_user = create_test_user("ai.admin", [base_group, hr_admin_role, hr_user_group])
        cls.exec_user = create_test_user("ai.exec", [base_group, exec_group, hr_user_group])
        cls.regular_user = create_test_user("ai.employee", [base_group])

        cls.dept_ops = cls.env["hr.department"].create({
            "name": "Operations Dept",
            "company_id": cls.company.id,
        })

        cls.emp_hr = cls.env["hr.employee"].create({
            "name": "AI HR Manager",
            "user_id": cls.hr_admin_user.id,
            "department_id": cls.dept_ops.id,
            "company_id": cls.company.id,
        })
        cls.emp_regular = cls.env["hr.employee"].create({
            "name": "AI Regular Worker",
            "user_id": cls.regular_user.id,
            "department_id": cls.dept_ops.id,
            "company_id": cls.company.id,
            "parent_id": cls.emp_hr.id,
            "leave_manager_id": cls.hr_admin_user.id,
        })

        cls.leave_type_annual = cls.env["hr.leave.type"].create({
            "name": "Annual Leave AI Test",
            "leave_code": "AL-AI",
            "requires_allocation": "no",
            "leave_validation_type": "no_validation",
            "retroactive_request_days": 365,
            "company_id": cls.company.id,
            "visible_to_employees": True,
        })
        cls.leave_type_sick = cls.env["hr.leave.type"].create({
            "name": "Sick Leave AI Test",
            "leave_code": "SL-AI",
            "requires_allocation": "no",
            "leave_validation_type": "no_validation",
            "retroactive_request_days": 365,
            "company_id": cls.company.id,
            "visible_to_employees": True,
        })

    def test_lm046_ai_capability_gating(self):
        """LM-046: Each capability is independently gated; no master toggle."""
        # All enabled at setUp — both should be on.
        self.assertTrue(self.env["hr.leave"].is_ai_capability_enabled("nl_request"))
        self.assertTrue(self.env["hr.leave"].is_ai_capability_enabled("approval_support"))

        # Disable a single capability — only that one should go off.
        self.company.write({"leave_ai_nl_request_enabled": False})
        self.assertFalse(self.env["hr.leave"].is_ai_capability_enabled("nl_request"))
        self.assertTrue(
            self.env["hr.leave"].is_ai_capability_enabled("approval_support"),
            "Disabling nl_request must not affect other capabilities",
        )

        # Re-enable — capability returns.
        self.company.write({"leave_ai_nl_request_enabled": True})
        self.assertTrue(self.env["hr.leave"].is_ai_capability_enabled("nl_request"))

        # Disabling anomaly_detection independently.
        self.company.write({"leave_ai_anomaly_detection_enabled": False})
        self.assertFalse(self.env["hr.leave"].is_ai_capability_enabled("anomaly_detection"))
        self.assertTrue(self.env["hr.leave"].is_ai_capability_enabled("approval_support"))
        self.company.write({"leave_ai_anomaly_detection_enabled": True})

        # Unknown capability name always returns False.
        self.assertFalse(self.env["hr.leave"].is_ai_capability_enabled("nonexistent_capability"))

        policy = self.env["hr.leave.policy"].create({
            "name": "AI-disabled policy", "code": "AI-OFF", "company_id": self.company.id,
            "state": "draft", "ai_enabled": False,
        })
        line = self.env["hr.leave.policy.line"].create({
            "policy_id": policy.id, "leave_type_id": self.leave_type_annual.id,
        })
        policy.write({"state": "active"})
        self.env["hr.leave.policy.assignment"].create({
            "policy_id": policy.id, "policy_line_id": line.id,
            "leave_type_id": self.leave_type_annual.id, "employee_id": self.emp_regular.id,
            "date_from": fields.Date.today(),
        })
        self.assertFalse(self.env["hr.leave"].is_ai_capability_enabled("approval_support", employee=self.emp_regular))

    def test_lm039_nl_leave_request_parsing(self):
        """LM-039: Test natural language leave description parsing."""
        ai_service = self.env["hr.leave.ai.service"]

        # 1. Standard full request: type, duration, relative date, reason
        res = ai_service.parse_nl_leave_request("Annual leave next week for 5 days for family wedding")
        self.assertTrue(res["ok"])
        self.assertTrue(res["ai_assisted"])
        self.assertTrue(res["leave_type_id"])
        self.assertEqual(res["duration_days"], 5)
        self.assertTrue(res["date_from"])
        self.assertTrue(res["date_to"])

        self.assertIn("Annual", res["summary"])
        self.assertIn("leave_type_id", res["suggested_fields"])
        self.assertIn("duration_days", res["suggested_fields"])

        # 2. "day after tomorrow" must resolve to today+2, not today+1 (substring bug fix)
        today = fields.Date.today()
        res_dat = ai_service.parse_nl_leave_request("sick leave day after tomorrow")
        self.assertTrue(res_dat["ok"])
        if res_dat.get("date_from"):
            expected = fields.Date.to_string(today + timedelta(days=2))
            self.assertEqual(
                res_dat["date_from"], expected,
                "day after tomorrow should resolve to today+2, not today+1",
            )

        # 3. Ambiguous request (no dates or duration)
        res_ambiguous = ai_service.parse_nl_leave_request("I want some annual leave")
        self.assertTrue(res_ambiguous["ok"])
        self.assertTrue(res_ambiguous["ambiguous"])
        self.assertIsNotNone(res_ambiguous["clarification_needed"])

        # 4. Gating check: if nl_request disabled, AccessError raised
        self.company.write({"leave_ai_nl_request_enabled": False})
        with self.assertRaises(AccessError):
            ai_service.parse_nl_leave_request("Annual leave tomorrow")
        self.company.write({"leave_ai_nl_request_enabled": True})

    def test_omitted_state_respects_native_submission_but_explicit_draft_stays_draft(self):
        """Regression: omitted state follows hr_holidays defaults; Save Draft remains explicit."""
        values = {
            "employee_id": self.emp_regular.id,
            "holiday_status_id": self.leave_type_annual.id,
            "request_date_from": fields.Date.today() + timedelta(days=30),
            "request_date_to": fields.Date.today() + timedelta(days=30),
            "number_of_days": 1,
        }
        native = self.env["hr.leave"].with_user(self.regular_user).create(dict(values))
        draft_values = {**values, "state": "draft"}
        draft_values.update({
            "request_date_from": fields.Date.today() + timedelta(days=40),
            "request_date_to": fields.Date.today() + timedelta(days=40),
        })
        draft = self.env["hr.leave"].with_user(self.regular_user).create(draft_values)
        self.assertNotEqual(native.state, "draft")
        self.assertTrue(native.submitted_at)
        self.assertEqual(draft.state, "draft")
        self.assertFalse(draft.submitted_at)

    def test_lm040_smart_leave_date_recommendations(self):
        """LM-040: Test optimal leave dates suggestions, blackout avoidance, and balance impact."""
        today = fields.Date.today()
        # Create a blackout period in 10-15 days
        blackout = self.env["hr.leave.blackout.period"].sudo().create({
            "name": "Q3 Freeze",
            "company_id": self.company.id,
            "date_from": today + timedelta(days=10),
            "date_to": today + timedelta(days=15),
            "active": True,
        })

        ai_service = self.env["hr.leave.ai.service"].with_user(self.regular_user)
        res = ai_service.suggest_leave_dates(
            leave_type_id=self.leave_type_annual.id,
            duration=3,
            prioritize_holidays=True,
            prioritize_coverage=True,
        )
        self.assertTrue(res["ok"])
        self.assertTrue(len(res["suggestions"]) >= 1)
        for s in res["suggestions"]:
            self.assertTrue(s["date_from"] <= s["date_to"])
            self.assertIn("team_coverage", s)
            self.assertIn("long_weekend", s)
            self.assertIn("balance_impact", s)
            # AC: suggestions must avoid the blackout window
            s_from = fields.Date.to_date(s["date_from"])
            s_to = fields.Date.to_date(s["date_to"])
            overlap_blackout = not (s_to < blackout.date_from or s_from > blackout.date_to)
            self.assertFalse(overlap_blackout, "Smart dates suggestion must not overlap blackout period")

    def test_lm041_conflict_and_coverage_detection(self):
        """LM-041: Test conflict detection threshold and approver override enforcement."""
        today = fields.Date.today()
        # Create an existing leave for emp_regular
        leave1 = self.env["hr.leave"].sudo().create({
            "employee_id": self.emp_regular.id,
            "holiday_status_id": self.leave_type_annual.id,
            "request_date_from": today + timedelta(days=10),
            "request_date_to": today + timedelta(days=14),
            "number_of_days": 5,
            "state": "confirm",
            "submission_channel": "ai_assisted",
        })

        coverage = self.env["hr.leave"]._get_leave_coverage_impact(leave1)
        self.assertIn("conflicts", coverage)
        self.assertIn("total_dept", coverage)

        # Record conflict override and verify audit trail
        leave1._create_audit_record("override_conflict", note="Overriding coverage risk due to project deadline")
        audit_log = self.env["hr.leave.audit.log"].sudo().search([
            ("leave_id", "=", leave1.id),
            ("action", "=", "override_conflict"),
        ], limit=1)
        self.assertTrue(audit_log)
        self.assertIn("Overriding coverage risk", audit_log.note)

        # Second overlapping request creates a genuine team conflict
        leave2 = self.env["hr.leave"].sudo().create({
            "employee_id": self.emp_hr.id,
            "holiday_status_id": self.leave_type_annual.id,
            "request_date_from": today + timedelta(days=10),
            "request_date_to": today + timedelta(days=14),
            "number_of_days": 5,
            "state": "confirm",
        })
        self.env.company.sudo().write({"leave_default_team_overlap_percent": 1})
        cov2 = self.env["hr.leave"]._get_leave_coverage_impact(leave2)
        self.assertTrue(cov2.get("threshold_exceeded"))
        with self.assertRaises(ValidationError):
            self.env["hr.leave"].with_user(self.hr_admin_user).approve_leave_request(leave2.id, override_conflict=False)

    def test_lm042_approval_decision_support(self):
        """LM-042: Test advisory approval facts and feedback rating."""
        today = fields.Date.today()
        leave = self.env["hr.leave"].sudo().create({
            "employee_id": self.emp_regular.id,
            "holiday_status_id": self.leave_type_annual.id,
            "request_date_from": today + timedelta(days=20),
            "request_date_to": today + timedelta(days=22),
            "number_of_days": 3,
            "state": "confirm",
        })

        ai_service = self.env["hr.leave.ai.service"].with_user(self.hr_admin_user)
        insights = ai_service.get_approval_insights(leave.id)
        self.assertTrue(insights["enabled"])
        self.assertTrue(insights["advisory_only"])
        self.assertTrue(len(insights["factors"]) >= 3)
        self.assertTrue(insights["recommendation"])

        # Record feedback
        feedback_res = ai_service.record_approval_insight_feedback(leave.id, helpful=True)
        self.assertTrue(feedback_res["ok"])

        # Check audit log
        feedback_log = self.env["hr.leave.audit.log"].sudo().search([
            ("leave_id", "=", leave.id),
            ("action", "=", "insight_feedback"),
        ], limit=1)
        self.assertTrue(feedback_log)
        self.assertIn("helpful", feedback_log.note)

    def test_lm043_fraud_and_anomaly_detection(self):
        """LM-043: Pattern anomaly detection with persistent state (AC3 reload test)."""
        today = fields.Date.today()
        ai_service = self.env["hr.leave.ai.service"]

        # Employees must not have access (AC8)
        with self.assertRaises(AccessError):
            ai_service.with_user(self.regular_user).get_leave_anomalies()

        # Create pattern: 3 Friday leaves for emp_regular
        for i in range(3):
            f_day = today - timedelta(days=(today.weekday() - 4 + 7 * (i + 1)) % 7 + 7 * i)
            self.env["hr.leave"].sudo().create({
                "employee_id": self.emp_regular.id,
                "holiday_status_id": self.leave_type_annual.id,
                "request_date_from": f_day,
                "request_date_to": f_day,
                "number_of_days": 1,
                "state": "validate",
            })

        admin_service = ai_service.with_user(self.hr_admin_user)
        res = admin_service.get_leave_anomalies()
        self.assertTrue(res["ok"])
        self.assertTrue(res["total"] >= 1)

        # Anomaly IDs must now be real integer ORM record IDs
        ano = res["anomalies"][0]
        ano_id = ano["id"]
        self.assertIsInstance(ano_id, int, "Anomaly ID must be a real integer DB record ID")

        with self.assertRaises(AccessError):
            ai_service.with_user(self.regular_user).review_leave_anomaly(ano_id, action="review")

        # Review anomaly
        review_res = admin_service.review_leave_anomaly(ano_id, action="review", note="Spoke with employee")
        self.assertTrue(review_res["ok"])
        self.assertEqual(review_res["status"], "reviewed")

        # PERSISTENCE CHECK: reload the anomaly record via ORM and verify state persisted
        anomaly_record = self.env["hr.leave.anomaly"].sudo().browse(ano_id)
        self.assertTrue(anomaly_record.exists())
        self.assertEqual(
            anomaly_record.status, "reviewed",
            "Review state must persist in hr.leave.anomaly ORM record (AC3 persistence requirement)",
        )
        self.assertTrue(anomaly_record.reviewed_by)
        self.assertTrue(anomaly_record.reviewed_at)

        # Escalate — state must update in DB
        esc_res = admin_service.review_leave_anomaly(ano_id, action="escalate", note="Pattern continuing")
        self.assertTrue(esc_res["ok"])
        self.assertEqual(esc_res["status"], "escalated")

        # PERSISTENCE CHECK for escalation (invalidate cache to force re-read from DB)
        anomaly_record.invalidate_recordset()
        self.assertEqual(
            anomaly_record.status, "escalated",
            "Escalation state must persist in hr.leave.anomaly ORM record",
        )

    def test_lm045_executive_workforce_brief(self):
        """LM-045: Executive Workforce Brief — all KPI values are real, never hardcoded."""
        ai_service = self.env["hr.leave.ai.service"]

        # Regular employee lacks permissions
        with self.assertRaises(AccessError):
            ai_service.with_user(self.regular_user).get_executive_workforce_brief()

        # Executive analytics user has access
        brief = ai_service.with_user(self.exec_user).get_executive_workforce_brief()
        self.assertTrue(brief["ok"])
        self.assertIn("requests_approved", brief["kpis"])
        self.assertIn("sla_achieved_percent", brief["kpis"])
        self.assertIn("pending_approvals", brief["kpis"])

        # Counts must be real integers — never hardcoded fallbacks like 142 or 12
        self.assertIsInstance(brief["kpis"]["requests_approved"], int)
        self.assertIsInstance(brief["kpis"]["pending_approvals"], int)

        # SLA percent may be None when no data exists; if a number it must be 0-100
        sla = brief["kpis"]["sla_achieved_percent"]
        self.assertTrue(sla is None or 0 <= sla <= 100)

        self.assertTrue(len(brief["key_insights"]) >= 1)
        self.assertTrue(len(brief["ai_recommendations"]) >= 1)

    def test_leave_reports_anomalies_and_executive_brief_integration(self):
        """Integration: Test reports service fetching and exporting anomalies & executive brief."""
        report_service = self.env["hr.leave.report.service"].with_user(self.hr_admin_user)

        # 1. Anomaly report data
        ano_payload = report_service.get_report_data({}, "anomalies")
        self.assertTrue(ano_payload["meta"]["can_view_anomalies"])
        self.assertIn("anomalies", ano_payload["reports"])

        # 2. Executive brief report data
        exec_payload = report_service.get_report_data({}, "executive_brief")
        self.assertTrue(exec_payload["meta"]["can_view_executive_brief"])
        self.assertIn("executive_brief", exec_payload["reports"])

        # 3. Export tests
        ano_export = report_service.export_report("anomalies", {}, "csv")
        self.assertEqual(ano_export["mimetype"], "text/csv;charset=utf-8")
        self.assertTrue(ano_export["data"])

        brief_export = report_service.export_report("executive_brief", {}, "csv")
        self.assertEqual(brief_export["mimetype"], "text/csv;charset=utf-8")
        self.assertTrue(brief_export["data"])
