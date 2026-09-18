# -*- coding: utf-8 -*-
from odoo.exceptions import AccessError, ValidationError
from odoo.tests import tagged
from odoo.tests.common import TransactionCase


@tagged("post_install", "-at_install")
class TestEmployeeFilesRoles(TransactionCase):
    def setUp(self):
        super().setUp()
        self.permission = self.env["doc.employee.files.permission"]
        self.Role = self.env["doc.employee.files.role"]
        self.admin = self.env.ref("base.user_admin")
        self.company = self.admin.company_id

    def _create_role(self, scope="all", **action_flags):
        line_actions = {
            "action_view": True,
            "action_upload": False,
            "action_approve": False,
            "action_download": True,
            "action_delete": False,
            "action_export": False,
            "action_manage_settings": False,
        }
        line_actions.update(action_flags)
        return self.Role.create(
            {
                "name": "Test EF role",
                "company_id": self.company.id,
                "employee_scope": scope,
                "line_ids": [
                    (
                        0,
                        0,
                        {
                            "applies_all_categories": True,
                            **line_actions,
                        },
                    )
                ],
            }
        )

    def test_view_parent_constraint_on_line(self):
        with self.assertRaises(ValidationError):
            self.Role.create(
                {
                    "name": "Invalid",
                    "company_id": self.company.id,
                    "employee_scope": "all",
                    "line_ids": [
                        (
                            0,
                            0,
                            {
                                "applies_all_categories": True,
                                "action_view": False,
                                "action_upload": True,
                            },
                        )
                    ],
                }
            )

    def test_platform_admin_has_full_access(self):
        employee = self.env["hr.employee"].create(
            {"name": "Target", "company_id": self.company.id}
        )
        self.assertTrue(
            self.permission.with_user(self.admin).user_can_on_employee(
                self.admin, employee, "action_delete"
            )
        )

    def test_assigned_role_grants_approve_in_scope(self):
        manager_user = self.env["res.users"].create(
            {
                "name": "Line Manager",
                "login": "ef_line_manager_test",
                "company_id": self.company.id,
                "groups_id": [(4, self.env.ref("base.group_user").id)],
            }
        )
        manager_employee = self.env["hr.employee"].create(
            {
                "name": "Line Manager",
                "user_id": manager_user.id,
                "company_id": self.company.id,
            }
        )
        report = self.env["hr.employee"].create(
            {
                "name": "Report",
                "parent_id": manager_employee.id,
                "company_id": self.company.id,
            }
        )
        role = self._create_role(scope="own_team", action_approve=True)
        manager_user.write({"employee_files_role_ids": [(6, 0, [role.id])]})

        self.assertTrue(
            self.permission.with_user(manager_user).user_can_on_employee(
                manager_user, report, "action_approve"
            )
        )
        outsider = self.env["hr.employee"].create(
            {"name": "Outsider", "company_id": self.company.id}
        )
        self.assertFalse(
            self.permission.with_user(manager_user).user_can_on_employee(
                manager_user, outsider, "action_approve"
            )
        )

    def test_migration_seed_created(self):
        service = self.env["doc.employee.files.role.service"]
        role_id = service.migrate_legacy_document_managers()
        role = self.Role.browse(role_id)
        self.assertTrue(role.exists())
        self.assertTrue(role.is_migration_seed)
        self.assertEqual(role.employee_scope, "all")

    def test_role_authoring_requires_platform_admin(self):
        user = self.env["res.users"].create(
            {
                "name": "Regular",
                "login": "ef_regular_test",
                "company_id": self.company.id,
                "groups_id": [(4, self.env.ref("base.group_user").id)],
            }
        )
        service = self.env["doc.employee.files.role.service"]
        with self.assertRaises(AccessError):
            service.with_user(user).list_roles()
