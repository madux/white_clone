# -*- coding: utf-8 -*-
from odoo.tests import tagged
from odoo.tests.common import TransactionCase


@tagged("post_install", "-at_install")
class TestEmploymentTypeDimensionTab(TransactionCase):
    def test_employment_type_has_top_level_groups_when_used_as_subgroup(self):
        company = self.env.company
        config = self.env["doc.employee.files.config"].get_for_company(company)
        config.set_organizing_dimensions(["department", "employment_type"])
        config.write(
            {
                "setup_complete": True,
                "sub_organizing_dimension": "employment_type",
            }
        )
        department = self.env["hr.department"].create({"name": "Sales types tab"})
        Type = self.env["hr.core_employment_type"]
        employment_type = Type.create({"name": "Full-time tab"})
        employee_vals = {
            "name": "Types Tab Employee",
            "company_id": company.id,
            "department_id": department.id,
        }
        if "employee_type_id" in self.env["hr.employee"]._fields:
            employee_vals["employee_type_id"] = employment_type.id
        else:
            employee_vals["employment_type_id"] = employment_type.id
        employee = self.env["hr.employee"].create(employee_vals)
        employee_file = self.env["doc.employee.file"].create(
            {
                "employee_id": employee.id,
                "company_id": company.id,
            }
        )
        self.env["doc.employee.files.service"].with_context(
            employee_files_allow_group_sync=True
        ).sync_employee_system_groups(employee, employee_file)

        type_groups = self.env["doc.employee.files.service"].list_groups(
            dimension="employment_type",
            for_home=True,
        )
        top_level = type_groups.filtered(lambda group: not group.parent_group_id)
        self.assertTrue(top_level)
        self.assertTrue(
            any(group.name == "Full-time tab" for group in top_level),
            type_groups.mapped("name"),
        )
        nested = self.env["doc.employee.group"].search(
            [
                ("company_id", "=", company.id),
                ("organizing_dimension", "=", "employment_type"),
                ("parent_group_id", "!=", False),
            ]
        )
        self.assertTrue(nested)
