from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError, ValidationError
from odoo.tests.common import TransactionCase


class TestLeaveCalendarSecurity(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Note: leave_ai_enabled is a legacy field no longer used in capability gating
        # (removed per reviewer requirement — each of the 8 capabilities is independently controlled).
        # This write is harmless; individual capability flags are what matter.
        cls.env.company.sudo().write({"leave_ai_enabled": True})
        base_user = cls.env.ref("base.group_user")
        personal = cls.env.ref("hr_leave_dashboard.group_leave_permission_personal")
        team = cls.env.ref("hr_leave_dashboard.group_leave_permission_team")
        operations = cls.env.ref("hr_leave_dashboard.group_leave_permission_operations")
        configuration = cls.env.ref("hr_leave_dashboard.group_leave_permission_configuration")
        approve = cls.env.ref("hr_leave_dashboard.group_leave_permission_approve")

        def make_user(login, groups):
            return cls.env["res.users"].with_context(no_reset_password=True).create({
                "name": login.replace(".", " ").title(),
                "login": login,
                "email": "%s@example.test" % login,
                "company_id": cls.env.company.id,
                "company_ids": [(6, 0, cls.env.company.ids)],
                "groups_id": [(6, 0, [base_user.id] + [group.id for group in groups])],
            })

        cls.config_user = make_user("calendar.config", [configuration])
        cls.operator_user = make_user("calendar.operator", [operations])
        cls.manager_user = make_user("calendar.manager", [personal, team, approve])
        cls.member_user = make_user("calendar.member", [personal])
        cls.manager_employee = cls.env["hr.employee"].create({
            "name": "Calendar Manager", "user_id": cls.manager_user.id,
            "company_id": cls.env.company.id,
        })
        cls.member_employee = cls.env["hr.employee"].create({
            "name": "Calendar Team Member", "user_id": cls.member_user.id,
            "company_id": cls.env.company.id,
            "parent_id": cls.manager_employee.id,
            "leave_manager_id": cls.manager_user.id,
        })
        cls.leave_type = cls.env["hr.leave.type"].create({
            "name": "Workflow Security Leave",
            "leave_code": "WSL",
            "requires_allocation": "no",
            "leave_validation_type": "manager",
            "approval_workflow": "single",
            "visible_to_employees": True,
        })
        start = fields.Date.today() + timedelta(days=30)
        cls.request = cls.env["hr.leave"].sudo().create({
            "employee_id": cls.member_employee.id,
            "holiday_status_id": cls.leave_type.id,
            "request_date_from": start,
            "request_date_to": start + timedelta(days=1),
            "notes": "A valid workflow security test request.",
        })
        if cls.request.state == "draft":
            cls.request.sudo().action_confirm()

    def test_configuration_does_not_authorize_operational_booking(self):
        with self.assertRaises(AccessError):
            self.env["hr.leave"].with_user(self.config_user).get_admin_create_options()

    def test_team_manager_cannot_create_leave_for_another_employee(self):
        with self.assertRaises(AccessError):
            self.env["hr.leave"].with_user(self.manager_user).create({
                "employee_id": self.member_employee.id,
            })

    def test_operations_authorizes_booking_options(self):
        result = self.env["hr.leave"].with_user(self.operator_user).get_admin_create_options()
        self.assertIn(self.member_employee.id, [employee["id"] for employee in result["employees"]])

    def test_team_scope_is_distinct_and_organisation_fails_closed(self):
        Leave = self.env["hr.leave"].with_user(self.manager_user)
        date_from = fields.Date.to_string(self.request.request_date_from)
        date_to = fields.Date.to_string(self.request.request_date_to)
        result = Leave.get_leave_calendar_data(
            date_from, date_to, calendar_scope="team",
        )
        self.assertEqual(result["calendar_scope"], "team")
        self.assertEqual(
            {employee["id"] for employee in result["employees"]},
            {self.manager_employee.id, self.member_employee.id},
        )
        self.assertIn(self.request.id, {leave["id"] for leave in result["leaves"]})
        with self.assertRaises(AccessError):
            Leave.get_leave_calendar_data(
                date_from, date_to, calendar_scope="organisation",
            )

    def test_personal_calendar_cannot_expose_colleagues_or_organisation(self):
        Leave = self.env["hr.leave"].with_user(self.member_user)
        result = Leave.get_leave_calendar_data(
            "2026-01-01", "2027-12-31", calendar_scope="personal",
        )
        self.assertEqual(
            result["employees"],
            [{
                "id": self.member_employee.id,
                "name": self.member_employee.name,
                "department": "No Department",
            }],
        )
        self.assertEqual(
            {leave["employee_id"] for leave in result["leaves"]},
            {self.member_employee.id},
        )
        with self.assertRaises(AccessError):
            Leave.get_leave_calendar_data(
                "2026-01-01", "2027-12-31", calendar_scope="organisation",
            )

    def test_ai_cannot_promote_manager_to_organisation_scope(self):
        result = self.env["hr.leave.ai.service"].with_user(
            self.manager_user,
        ).get_calendar_assistant_state({
            "perspective": "organisation",
            "date_from": "2026-09-01",
            "date_to": "2026-09-30",
            "filters": {},
        })
        self.assertEqual(result["scope"], "team")

    def test_employee_cannot_directly_approve_own_request(self):
        with self.assertRaises(AccessError):
            self.request.with_user(self.member_user).write({"state": "validate"})

    def test_request_changes_requires_current_approver_and_leaves_queue(self):
        with self.assertRaises(AccessError):
            self.env["hr.leave"].with_user(self.config_user).request_leave_changes(
                self.request.id, "Please provide more detail.",
            )
        result = self.env["hr.leave"].with_user(self.manager_user).request_leave_changes(
            self.request.id, "Please provide a clearer operational handover.",
        )
        self.assertEqual(result["status"], "changes_requested")
        queue = self.env["hr.leave"].with_user(self.manager_user).get_pending_my_leave_approvals()
        self.assertNotIn(self.request.id, [row["id"] for row in queue["rows"]])

    def test_structured_rejection_requires_category(self):
        with self.assertRaises(ValidationError):
            self.env["hr.leave"].with_user(self.manager_user).reject_leave_request(
                self.request.id, "The request cannot be approved.",
            )

    def test_handover_requires_a_backup_colleague(self):
        start = fields.Date.today() + timedelta(days=45)
        result = self.env["hr.leave"].with_user(self.member_user).submit_employee_leave_request({
            "leave_type_id": self.leave_type.id,
            "date_from": fields.Date.to_string(start),
            "date_to": fields.Date.to_string(start),
            "reason": "Coverage is required during this absence.",
            "handover_enabled": True,
            "backup_colleague_ids": [],
        })
        self.assertFalse(result["ok"])
        self.assertIn("backup colleague", result["message"].lower())

    def test_changes_requested_resubmits_same_record(self):
        self.env["hr.leave"].with_user(self.manager_user).request_leave_changes(
            self.request.id, "Please clarify the handover arrangements.",
        )
        result = self.env["hr.leave"].with_user(self.member_user).resubmit_employee_leave_request(
            self.request.id,
            {
                "leave_type_id": self.leave_type.id,
                "date_from": fields.Date.to_string(self.request.request_date_from),
                "date_to": fields.Date.to_string(self.request.request_date_to),
                "reason": "Updated reason with clarified handover arrangements.",
                "handover_enabled": False,
                "backup_colleague_ids": [],
            },
        )
        self.assertTrue(result["ok"])
        self.assertEqual(result["id"], self.request.id)
        self.request.invalidate_recordset()
        self.assertFalse(self.request.changes_requested)
        self.assertIn(self.request.state, ("confirm", "validate1"))

    def test_gateway_leave_balances_ai_requires_operations_permission(self):
        """Member user cannot access Leave Balance AI assistance via the gateway."""
        with self.assertRaises(AccessError):
            self.env["cleon.ai.gateway"].with_user(self.member_user).get_assistant_state({
                "screen": "leave.balances",
            })

    def test_gateway_unattached_context_returns_empty_tools(self):
        """Unattached context returns no business tools."""
        tools = self.env["cleon.ai.gateway"].with_user(self.operator_user).get_tool_catalog({})
        self.assertEqual(tools, [])
        state = self.env["cleon.ai.gateway"].with_user(self.operator_user).get_assistant_state({})
        self.assertEqual(state["tools"], [])

    def test_gateway_leave_tools_registered_for_leave_user(self):
        """Leave tools are registered on the gateway for authorised leave users and screen context."""
        tools = self.env["cleon.ai.gateway"].with_user(self.operator_user).get_tool_catalog({"screen": "leave.calendar"})
        tool_names = [t["name"] for t in tools]
        self.assertIn("leave.calendar.summarize", tool_names)
        self.assertIn("leave.calendar.day_roster", tool_names)
        self.assertIn("leave.prepare_admin_booking", tool_names)

    def test_gateway_tool_execution_enforces_screen_and_rbac(self):
        """Executing leave tools revalidates permissions across both catalogue and dispatcher layers."""
        # 1. Operator can execute summarize on calendar
        res = self.env["cleon.ai.gateway"].with_user(self.operator_user).execute_tool(
            "leave.calendar.summarize", screen_context={"screen": "leave.calendar"}
        )
        self.assertTrue(res["ok"])

        # 2. Operator can execute day roster with perspective
        roster_res = self.env["cleon.ai.gateway"].with_user(self.operator_user).execute_tool(
            "leave.calendar.day_roster",
            params={"date": fields.Date.to_string(fields.Date.today())},
            screen_context={"screen": "leave.calendar", "perspective": "organisation"},
        )
        self.assertTrue(roster_res["ok"])
        self.assertIn("roster", roster_res)

        # 3. Layer 1: Catalogue rejection - member user cannot see or execute admin booking on calendar
        with self.assertRaises(ValidationError):
            self.env["cleon.ai.gateway"].with_user(self.member_user).execute_tool(
                "leave.prepare_admin_booking",
                params={"confirmed": True},
                screen_context={"screen": "leave.calendar"},
            )

        # 4. Layer 2: Dispatcher rejection - direct call to business dispatcher as member user raises AccessError
        with self.assertRaises(AccessError):
            self.env["cleon.ai.gateway"].with_user(self.member_user)._dispatch_tool_execution(
                "leave.prepare_admin_booking",
                params={"confirmed": True},
                screen_context={"screen": "leave.calendar"},
            )

    def test_gateway_day_roster_respects_department_filter(self):
        """AI day roster respects active department filters from screen context."""
        dept_a = self.env["hr.department"].create({"name": "Engineering AI Test"})
        dept_b = self.env["hr.department"].create({"name": "Marketing AI Test"})
        self.member_employee.write({"department_id": dept_a.id})
        self.manager_employee.write({"department_id": dept_a.id})

        other_user = self.env["res.users"].with_context(no_reset_password=True).create({
            "name": "Other Dept User",
            "login": "other.dept.user",
            "email": "other@example.test",
            "company_id": self.env.company.id,
            "company_ids": [(6, 0, self.env.company.ids)],
        })
        other_employee = self.env["hr.employee"].create({
            "name": "Other Dept Employee",
            "user_id": other_user.id,
            "department_id": dept_b.id,
            "company_id": self.env.company.id,
        })

        test_date = fields.Date.today() + timedelta(days=60)
        test_date_str = fields.Date.to_string(test_date)

        member_req = self.env["hr.leave"].sudo().create({
            "employee_id": self.member_employee.id,
            "holiday_status_id": self.leave_type.id,
            "request_date_from": test_date,
            "request_date_to": test_date + timedelta(days=1),
            "notes": "Member leave request for roster test.",
        })
        member_req.sudo().action_validate()

        other_req = self.env["hr.leave"].sudo().create({
            "employee_id": other_employee.id,
            "holiday_status_id": self.leave_type.id,
            "request_date_from": test_date,
            "request_date_to": test_date + timedelta(days=1),
            "notes": "Other employee leave request for roster test.",
        })
        other_req.sudo().action_validate()

        # 1. Day roster filtered by Department A returns only member_employee
        res = self.env["cleon.ai.gateway"].with_user(self.operator_user).execute_tool(
            "leave.calendar.day_roster",
            params={"date": test_date_str},
            screen_context={
                "screen": "leave.calendar",
                "perspective": "organisation",
                "filters": {"department_ids": [dept_a.id]},
            },
        )
        roster_names = [item["employee_name"] for item in res["roster"]]
        self.assertIn(self.member_employee.name, roster_names)
        self.assertNotIn(other_employee.name, roster_names)

        # 2. Manager requesting organisation scope is downgraded to team scope and only sees team member
        mgr_res = self.env["cleon.ai.gateway"].with_user(self.manager_user).execute_tool(
            "leave.calendar.day_roster",
            params={"date": test_date_str},
            screen_context={
                "screen": "leave.calendar",
                "perspective": "organisation",
            },
        )
        self.assertEqual(mgr_res["scope"], "team")
        mgr_roster_names = [item["employee_name"] for item in mgr_res["roster"]]
        self.assertIn(self.member_employee.name, mgr_roster_names)
        self.assertNotIn(other_employee.name, mgr_roster_names)

    def test_lm046_ai_capability_gating(self):
        """LM-046: Test centralized is_ai_capability_enabled, global disable precedence, and tool removal."""
        company = self.env.company
        # Verify default enabled state
        self.assertTrue(self.env["hr.leave"].is_ai_capability_enabled("calendar_summary"))
        self.assertTrue(self.env["hr.leave"].is_ai_capability_enabled("approval_support"))

        # Tools include calendar.summarize when enabled
        tools = self.env["cleon.ai.gateway"].with_user(self.operator_user).get_tool_catalog({"screen": "leave.calendar"})
        tool_names = [t["name"] for t in tools]
        self.assertIn("leave.calendar.summarize", tool_names)

        # Globally disable calendar_summary
        company.sudo().write({"leave_ai_calendar_summary_enabled": False})
        self.assertFalse(self.env["hr.leave"].is_ai_capability_enabled("calendar_summary"))

        # Tool catalogue removes disabled tool
        tools_after = self.env["cleon.ai.gateway"].with_user(self.operator_user).get_tool_catalog({"screen": "leave.calendar"})
        tool_names_after = [t["name"] for t in tools_after]
        self.assertNotIn("leave.calendar.summarize", tool_names_after)

        # Direct execution of disabled capability is refused
        with self.assertRaises(ValidationError):
            self.env["cleon.ai.gateway"].with_user(self.operator_user).execute_tool(
                "leave.calendar.summarize",
                params={},
                screen_context={"screen": "leave.calendar"},
            )

        # Globally disable approval_support
        company.sudo().write({"leave_ai_approval_support_enabled": False})
        self.assertFalse(self.env["hr.leave"].is_ai_capability_enabled("approval_support"))
        insight_res = self.env["hr.leave.ai.service"].with_user(self.manager_user).get_approval_insights(self.request.id)
        self.assertFalse(insight_res["enabled"])

        # Re-enable and verify LM-042 Why this recommendation factors
        company.sudo().write({"leave_ai_approval_support_enabled": True})
        insight_enabled = self.env["hr.leave.ai.service"].with_user(self.manager_user).get_approval_insights(self.request.id)
        self.assertTrue(insight_enabled["enabled"])
        self.assertIn("factors", insight_enabled)
        self.assertTrue(len(insight_enabled["factors"]) >= 3)
