# -*- coding: utf-8 -*-
"""Seed DMS QA personas on white_cleon_17. Run via: odoo-bin shell < seed_qa_test_users.py"""
DocUser = env["res.users"]
DocGroup = env.ref("cleon_document_management.group_document_user")
Base = env.ref("base.group_user")
company = env.company
Role = env["doc.employee.files.role"]

env.ref("base.user_admin").write({"login": "admin", "password": "admin"})
demo = DocUser.search([("login", "=", "demo")], limit=1)
if demo:
    demo.write({"password": "demo"})
else:
    DocUser.create(
        {
            "name": "Demo User",
            "login": "demo",
            "password": "demo",
            "company_id": company.id,
            "groups_id": [(6, 0, [Base.id, DocGroup.id])],
        }
    )


def ensure_role(name, **fields):
    role = Role.search([("name", "=", name)], limit=1)
    if not role:
        role = Role.create({"name": name, "company_id": company.id, "employee_scope": "all", **fields})
    else:
        role.write(fields)
    return role


org_only = ensure_role("QA Matrix Org Only", org_access_library=True)
ef_only = ensure_role(
    "QA Matrix EF No Org",
    line_ids=[(0, 0, {"applies_all_categories": True, "action_view": True})],
)
org_viewer = ensure_role("QA Org Viewer", org_access_library=True)
ef_hr = ensure_role(
    "QA EF HR All",
    line_ids=[
        (
            0,
            0,
            {
                "applies_all_categories": True,
                "action_view": True,
                "action_upload": True,
                "action_approve": True,
            },
        )
    ],
)


def upsert(login, name, password, roles):
    user = DocUser.search([("login", "=", login)], limit=1)
    vals = {
        "name": name,
        "login": login,
        "password": password,
        "company_id": company.id,
        "company_ids": [(6, 0, [company.id])],
        "groups_id": [(6, 0, [Base.id, DocGroup.id])],
        "employee_files_role_ids": [(6, 0, roles.ids)],
    }
    if user:
        user.write(vals)
    else:
        user = DocUser.create(vals)
    return user


for login, name, pw, role in [
    ("qa_org_viewer", "QA Org Viewer", "qa_test_1", org_viewer),
    ("qa_ef_hr", "QA EF HR", "qa_test_1", ef_hr),
    ("qa_matrix_ef_only", "QA EF Only", "qa_test_1", ef_only),
    ("qa_matrix_org_only", "QA Org Only", "qa_test_1", org_only),
]:
    upsert(login, name, pw, role)
    print("OK", login, pw)

env.cr.commit()
print("QA users seeded.")
