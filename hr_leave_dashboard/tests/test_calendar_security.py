from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError, ValidationError
from odoo.tests.common import TransactionCase


class TestLeaveCalendarSecurity(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
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
        result = Leave.get_leave_calendar_data(
            "2026-09-01", "2026-09-30", calendar_scope="team",
        )
        self.assertEqual(result["calendar_scope"], "team")
        self.assertEqual(result["employees"], [{
            "id": self.member_employee.id,
            "name": self.member_employee.name,
            "department": "No Department",
        }])
        with self.assertRaises(AccessError):
            Leave.get_leave_calendar_data(
                "2026-09-01", "2026-09-30", calendar_scope="organisation",
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
