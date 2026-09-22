# -*- coding: utf-8 -*-
"""Re-sync system-managed Employee Files groups from EMS (after setup/repair)."""
from __future__ import annotations

if "env" not in globals():
    raise SystemExit(
        "Run via Odoo shell:\n"
        "  ./scripts/run_odoo_shell.sh repair_employee_files_groups.py"
    )

config = env["doc.employee.files.config"].get_for_company()
if not config.setup_complete:
    print("Employee Files setup is not complete — nothing to repair.")
else:
    company = config.company_id
    Employee = env["hr.employee"].sudo().with_context(active_test=False)
    Type = env["hr.core_employment_type"].sudo()
    et_field = (
        "employee_type_id"
        if "employee_type_id" in Employee._fields
        else "employment_type_id"
        if "employment_type_id" in Employee._fields
        else None
    )
    if et_field:
        types = Type.search([], limit=8)
        if not types:
            for name in ("Full-time", "Part-time", "Contract", "Intern"):
                types |= Type.create({"name": name})
        qa = Employee.search([("barcode", "=like", "EF-QA-%")])
        for index, emp in enumerate(qa, start=1):
            if not emp[et_field]:
                emp.write({et_field: types[(index - 1) % len(types)].id})
        if qa:
            print(f"Ensured employment type on {len(qa)} EF-QA employee(s).")
    print(f"Reconciling Employee Files for company: {company.name} (id={company.id})…")
    env["doc.employee.files.service"].reconcile_all_employees_from_ems(company)
    env["doc.employee.files.service"].reconcile_all_documents_for_company(company)
    env.cr.commit()
    Group = env["doc.employee.group"].sudo()
    system = Group.search_count(
        [
            ("company_id", "=", company.id),
            ("group_kind", "=", "system_managed"),
            ("active", "=", True),
        ]
    )
    print(f"Done. {system} active system-managed group(s) for this company.")
