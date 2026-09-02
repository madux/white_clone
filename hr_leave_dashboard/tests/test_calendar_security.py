from odoo.exceptions import AccessError
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
        cls.manager_user = make_user("calendar.manager", [personal, team])
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
