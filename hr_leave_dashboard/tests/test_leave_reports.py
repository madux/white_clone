import base64
from datetime import timedelta

from odoo import fields
from odoo.exceptions import AccessError, ValidationError
from odoo.tests.common import TransactionCase


class TestLeaveReports(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        base = cls.env.ref("base.group_user")
        manager_role = cls.env.ref("hr_leave_dashboard.group_leave_line_manager")
        admin_role = cls.env.ref("hr_leave_dashboard.group_leave_administrator")
        executive_role = cls.env.ref("hr_leave_dashboard.group_leave_executive")

        def user(login, role):
            return cls.env["res.users"].with_context(no_reset_password=True).create({
                "name": login.replace(".", " ").title(), "login": login,
                "email": "%s@example.test" % login,
                "company_id": cls.env.company.id,
                "company_ids": [(6, 0, cls.env.company.ids)],
                "groups_id": [(6, 0, [base.id, role.id])],
            })

        cls.manager_user = user("reports.manager", manager_role)
        cls.admin_user = user("reports.admin", admin_role)
        cls.executive_user = user("reports.executive", executive_role)
        cls.unauthorised_user = user("reports.unauthorised", base)
        cls.manager_employee = cls.env["hr.employee"].create({
            "name": "Reports Manager", "user_id": cls.manager_user.id,
            "company_id": cls.env.company.id,
        })
        cls.team_employee = cls.env["hr.employee"].create({
            "name": "Reports Team Member", "company_id": cls.env.company.id,
            "parent_id": cls.manager_employee.id, "leave_manager_id": cls.manager_user.id,
        })
        cls.outside_employee = cls.env["hr.employee"].create({
            "name": "Reports Outside Team", "company_id": cls.env.company.id,
        })
        cls.leave_type = cls.env["hr.leave.type"].create({
            "name": "Unplanned Absence Report Test", "leave_code": "UART",
            "requires_allocation": "no", "leave_validation_type": "no_validation",
            "visible_to_employees": True, "bradford_count_mode": "all",
            "retroactive_request_days": 365,
        })
        today = fields.Date.today()
        cls.team_leaves = cls.env["hr.leave"]
        for offset in (98, 77, 56, 35):
            day = today - timedelta(days=offset)
            cls.team_leaves |= cls.env["hr.leave"].sudo().create({
                "employee_id": cls.team_employee.id,
                "holiday_status_id": cls.leave_type.id,
                "request_date_from": day, "request_date_to": day,
                "state": "validate", "notes": "Unplanned absence report test.",
            })
        outside_day = today - timedelta(days=28)
        cls.outside_leave = cls.env["hr.leave"].sudo().create({
            "employee_id": cls.outside_employee.id,
            "holiday_status_id": cls.leave_type.id,
            "request_date_from": outside_day, "request_date_to": outside_day,
            "state": "validate", "notes": "Outside manager reporting scope.",
        })

    def test_bradford_formula_four_single_day_spells(self):
        result = self.env["hr.leave.report.service"]._employee_risk(
            self.team_employee, self.env.company,
        )
        self.assertEqual(result["spells"], 4)
        self.assertEqual(result["days"], 4)
        self.assertEqual(result["score"], 64)
        self.assertEqual(result["band"], "caution")

    def test_manager_gets_team_flags_without_numeric_details(self):
        payload = self.env["hr.leave.report.service"].with_user(
            self.manager_user,
        ).get_report_data({"date_range": "this_year"}, "absence_risk")
        risk = payload["reports"]["absence_risk"]
        self.assertEqual(payload["meta"]["scope"], "team")
        self.assertEqual(risk["mode"], "team_flags")
        row = next(item for item in risk["rows"] if item["employee_id"] == self.team_employee.id)
        self.assertEqual(row["flag"], "watch")
        self.assertNotIn("score", row)
        self.assertNotIn("spells", row)
        with self.assertRaises(AccessError):
            self.env["hr.leave.absence.risk"].with_user(self.manager_user).search([])

    def test_frequency_drilldown_is_ranked_and_permission_scoped(self):
        service = self.env["hr.leave.report.service"].with_user(self.manager_user)
        payload = service.get_report_data({"date_range": "this_year"}, "frequency")
        no_department = next(row for row in payload["reports"]["frequency"]["department"] if row["id"] == 0)
        self.assertEqual(no_department["rank"], 1)
        self.assertEqual(no_department["requests"], 4)
        self.assertEqual(no_department["headcount"], 1)
        self.assertEqual(no_department["requests_per_employee"], 4)
        rows = service.get_report_drilldown("department", 0, {"date_range": "this_year"})["rows"]
        self.assertEqual({row["id"] for row in rows}, set(self.team_leaves.ids))
        self.assertNotIn(self.outside_leave.id, {row["id"] for row in rows})

    def test_admin_can_export_live_authorised_csv(self):
        result = self.env["hr.leave.report.service"].with_user(self.admin_user).export_report(
            "frequency", {"date_range": "this_year", "frequency_dimension": "department"}, "csv",
        )
        self.assertTrue(result["filename"].endswith(".csv"))
        self.assertEqual(result["mimetype"], "text/csv;charset=utf-8")
        self.assertTrue(result["data"])

    def test_real_xlsx_and_pdf_exports(self):
        service = self.env["hr.leave.report.service"].with_user(self.admin_user)
        xlsx = service.export_report("request_volume", {"date_range": "this_year"}, "xlsx")
        pdf = service.export_report("request_volume", {"date_range": "this_year"}, "pdf")
        self.assertTrue(base64.b64decode(xlsx["data"]).startswith(b"PK"))
        self.assertTrue(base64.b64decode(pdf["data"]).startswith(b"%PDF"))

    def test_manager_exports_only_authorised_risk_flags(self):
        result = self.env["hr.leave.report.service"].with_user(self.manager_user).export_report(
            "absence_risk", {"date_range": "this_year"}, "csv",
        )
        self.assertTrue(result["data"])

    def test_user_without_reporting_permission_is_denied(self):
        with self.assertRaises(AccessError):
            self.env["hr.leave.report.service"].with_user(self.unauthorised_user).get_report_data(
                {"date_range": "this_year"}, "request_volume",
            )

    def test_multi_select_cannot_expand_manager_scope(self):
        payload = self.env["hr.leave.report.service"].with_user(self.manager_user).get_report_data({
            "date_range": "this_year",
            "employee_ids": [self.team_employee.id, self.outside_employee.id],
            "leave_type_ids": [self.leave_type.id],
        }, "frequency")
        self.assertEqual(payload["meta"]["employee_count"], 1)
        self.assertEqual(payload["reports"]["frequency"]["department"][0]["requests"], 4)

    def test_strategic_view_is_aggregate_and_hides_configuration(self):
        risk = self.env["hr.leave.report.service"].with_user(self.executive_user).get_report_data(
            {"date_range": "this_year"}, "absence_risk",
        )["reports"]["absence_risk"]
        self.assertEqual(risk["mode"], "aggregate")
        self.assertEqual(risk["rows"], [])
        self.assertEqual(risk["settings"], {})

    def test_mandatory_parental_exclusion_cannot_be_overridden(self):
        parental = self.env["hr.leave.type"].create({
            "name": "Maternity Leave", "leave_code": "MAT",
            "requires_allocation": "no", "leave_validation_type": "no_validation",
        })
        with self.assertRaises(ValidationError):
            parental.write({"bradford_count_mode": "all"})

    def test_non_working_weekend_does_not_split_a_spell(self):
        friday = fields.Date.today() - timedelta(days=7)
        monday = friday + timedelta(days=3)
        service = self.env["hr.leave.report.service"]
        self.assertTrue(service._same_continuous_spell(self.team_employee, friday, monday))
        self.assertFalse(service._same_continuous_spell(self.team_employee, friday, monday + timedelta(days=1)))

    def test_risk_exclusion_is_audited(self):
        leave = self.team_leaves[0]
        self.env["hr.leave.report.service"].with_user(self.admin_user).set_bradford_exclusion(
            leave.id, True, "Approved long-term medical arrangement.",
        )
        audit = self.env["hr.leave.audit.log"].sudo().search([
            ("action", "=", "risk_exclusion_change"), ("leave_id", "=", leave.id),
        ], limit=1)
        self.assertTrue(audit)
        self.assertEqual(audit.actor_role, "HR Administrator")
        self.assertTrue(audit.after_values["excluded"])
