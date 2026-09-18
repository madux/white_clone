# -*- coding: utf-8 -*-
from odoo.tests import tagged
from odoo.tests.common import TransactionCase


@tagged("post_install", "-at_install")
class TestDocRoleService(TransactionCase):
    def test_registry_seeds_document_management_roles(self):
        self.env["doc.role.definition"].sync_registry()
        rows = self.env["doc.role.definition"]._document_management_definitions()
        self.assertEqual(len(rows), 2)
        assignable = rows.filtered("assignable")
        self.assertEqual(set(assignable.mapped("role_key")), {"admin"})
        self.assertTrue(
            all(xml_id.startswith("cleon_document_management.")
                for xml_id in rows.mapped("group_xml_id"))
        )

    def test_registry_rewrites_foreign_group_assignments(self):
        self.env["doc.role.definition"].sync_registry()
        admin_row = self.env["doc.role.definition"].search(
            [("role_key", "=", "admin")],
            limit=1,
        )
        admin_row.write(
            {
                "group_xml_id": "cleon_social_gallery.group_social_gallery_manager",
                "label": "Gallery Manager",
            }
        )

        rows = self.env["doc.role.definition"]._document_management_definitions()
        admin_row = self.env["doc.role.definition"].search(
            [("role_key", "=", "admin")],
            limit=1,
        )

        self.assertEqual(len(rows), 2)
        self.assertEqual(
            admin_row.group_xml_id,
            "cleon_document_management.group_document_admin",
        )
        self.assertEqual(admin_row.label, "Document Platform Administrator")

    def test_grant_admin_group_only(self):
        self.env["doc.role.definition"].sync_registry()
        admin = self.env.ref("base.user_admin")
        employee = self.env["hr.employee"].search(
            [("user_id", "=", admin.id)], limit=1
        )
        if not employee:
            employee = self.env["hr.employee"].create(
                {
                    "name": "Role Test Employee",
                    "user_id": admin.id,
                    "company_id": admin.company_id.id,
                }
            )

        admin_group = self.env.ref(
            "cleon_document_management.group_document_admin"
        )
        admin.write({"groups_id": [(3, admin_group.id)]})

        service = self.env["doc.role.service"]
        service.with_user(admin).assign_roles(
            employee.id,
            [{"role_key": "admin", "enabled": True}],
        )

        self.assertIn(admin_group, admin.groups_id)
