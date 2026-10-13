# -*- coding: utf-8 -*-
"""Board demo: ~40 EMS employees + DMS live data (workspace to-do, compliance, org approvals).

Run after clear (or set DMS_DEMO_SKIP_CLEAR=1):
    ./scripts/run_odoo_shell.sh clear_dms_data.py
    ./scripts/run_odoo_shell.sh seed_demo_board.py

Or one shot:
    ./scripts/reset_and_seed_demo.sh

Environment:
    DMS_DEMO_SKIP_CLEAR=1     Do not run clear_dms_data.py first
    DMS_DEMO_PASSWORD=demo2026!  Login password for demo users
    DMS_DEMO_CSV=...          Override staff CSV path
"""
from __future__ import annotations

import base64
import csv
import json
import os
from datetime import timedelta
from pathlib import Path

from odoo import fields

if "env" not in globals():
    raise SystemExit(
        "Run via Odoo shell:\n"
        "  ./scripts/run_odoo_shell.sh seed_demo_board.py"
    )


def _truthy(name, default="0"):
    return os.environ.get(name, default).strip().lower() in ("1", "true", "yes", "on")


def _log(msg):
    print(msg)


def _repo_root():
    script_file = globals().get("__file__")
    if script_file:
        return Path(script_file).resolve().parents[1]
    env_dir = os.environ.get("WHITE_CLONE_SCRIPTS_DIR", "").strip()
    if env_dir:
        return Path(env_dir).resolve().parent
    return Path(os.environ.get("WHITE_CLONE_ROOT", "/Users/bankai/Documents/Projects/white_clone"))


def _scripts_dir():
    return _repo_root() / "scripts"


def _admin_env(env):
    admin = env.ref("base.user_admin")
    return env(user=admin)


DEMO_PASSWORD = os.environ.get("DMS_DEMO_PASSWORD", "demo2026!").strip() or "demo2026!"

# Curated roster (40) — names/departments come from the staff CSV when present.
DEMO_BOARD_BARCODES = (
    "EMP-WL-206",
    "EMP-WL-009",
    "EMP-WL-019",
    "EMP-WL-018",
    "EMP-WL-017",
    "EMP-WL-020",
    "EMP-WL-039",
    "EMP-WL-028",
    "EMP-WL-038",
    "EMP-WL-207",
    "EMP-WL-005",
    "EMP-WL-070",
    "EMP-WL-057",
    "EMP-WL-063",
    "EMP-WL-048",
    "EMP-WL-045",
    "EMP-WL-051",
    "EMP-WL-060",
    "EMP-WL-043",
    "EMP-WL-044",
    "EMP-WL-113",
    "EMP-WL-107",
    "EMP-WL-111",
    "EMP-WL-100",
    "EMP-WL-104",
    "EMP-WL-099",
    "EMP-WL-090",
    "EMP-WL-125",
    "EMP-WL-126",
    "EMP-WL-127",
    "EMP-WL-130",
    "EMP-WL-132",
    "EMP-WL-144",
    "EMP-WL-146",
    "EMP-WL-152",
    "EMP-WL-184",
    "EMP-WL-175",
    "EMP-WL-167",
    "EMP-WL-194",
    "EMP-WL-148",
)

# De-dupe while preserving order (expect exactly 40 curated IDs)
_seen = set()
DEMO_BOARD_BARCODES = tuple(
    b for b in DEMO_BOARD_BARCODES if not (b in _seen or _seen.add(b))
)
if len(DEMO_BOARD_BARCODES) != 40:
    raise SystemExit(
        f"DEMO_BOARD_BARCODES must contain 40 unique barcodes (got {len(DEMO_BOARD_BARCODES)})"
    )

NAME_OVERRIDES = {
    "EMP-WL-028": {
        "name": "Amara Okafor",
        "work_email": "amara.okafor@cleonhr.com",
    },
}

DEMO_USER_SPECS = [
    # login, display name, email local part source, role_template_key, barcode
    ("david.okafor", "David Okafor", "EMP-WL-018", "employee"),
    ("ngozi.bello", "Ngozi Bello", "EMP-WL-039", "employee"),
    ("aaron.johnson", "Aaron Johnson", "EMP-WL-019", "hr_admin"),
    ("chinwe.adebayo", "Chinwe Adebayo", "EMP-WL-045", "folder_policy_manager"),
]


def _run_clear():
    clear_path = _scripts_dir() / "clear_dms_data.py"
    with open(clear_path, encoding="utf-8") as fh:
        exec(compile(fh.read(), str(clear_path), "exec"), globals())


def _load_csv_rows():
    csv_path = Path(
        os.environ.get(
            "DMS_DEMO_CSV",
            _repo_root() / "hr_staff_directory" / "staff-export-2026-08-05-with-gender.csv",
        )
    )
    if not csv_path.is_file():
        raise SystemExit(f"Staff CSV not found: {csv_path}")
    by_barcode = {}
    with open(csv_path, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            barcode = (row.get("ID") or "").strip()
            if barcode:
                by_barcode[barcode] = row
    return by_barcode


def _parse_active(status):
    status = (status or "").strip().lower()
    if status in ("inactive", "terminated"):
        return False
    return True


def _employee_model(env):
    return env["hr.employee"].sudo().with_context(active_test=False)


def _clear_dms_links(env, employee_ids):
    if not employee_ids:
        return
    File = env["doc.employee.file"].sudo()
    files = File.search([("employee_id", "in", employee_ids)])
    if files:
        files.unlink()
    for model in ("doc.employee.exclusion", "doc.employee.issue"):
        if model in env:
            env[model].sudo().search([("employee_id", "in", employee_ids)]).unlink()


def _delete_ef_qa(env):
    prefix = os.environ.get("SEED_EF_QA_PREFIX", "EF-QA-").strip() or "EF-QA-"
    Employee = _employee_model(env)
    qa = Employee.search([("barcode", "=like", f"{prefix}%")])
    if qa:
        _log(f"Removing {len(qa)} {prefix}* employees…")
        _clear_dms_links(env, qa.ids)
        qa.unlink()


def _trim_company_roster(env, keep_barcodes):
    company = env.company
    Employee = _employee_model(env)
    protected_ids = set(
        env["res.users"]
        .sudo()
        .search([("share", "=", False)])
        .mapped("employee_id")
        .ids
    )
    keep_set = set(keep_barcodes)
    domain = [("company_id", "=", company.id)]
    extras = Employee.search(domain)
    to_remove = extras.filtered(
        lambda e: e.id not in protected_ids
        and (not e.barcode or e.barcode not in keep_set)
    )
    if to_remove:
        _log(f"Removing {len(to_remove)} employees outside the demo roster…")
        _clear_dms_links(env, to_remove.ids)
        Contract = env.get("hr.contract")
        if Contract:
            open_contracts = Contract.sudo().search(
                [
                    ("employee_id", "in", to_remove.ids),
                    ("state", "=", "open"),
                ]
            )
            if open_contracts:
                today = fields.Date.context_today(env)
                open_contracts.write({"state": "close", "date_end": today})
        try:
            to_remove.unlink()
        except Exception as exc:
            _log(f"  could not unlink ({exc}); archiving instead")
            to_remove.write({"active": False})
    return len(to_remove)


def _get_or_create_department(env, name, company):
    Department = env["hr.department"].sudo()
    dep = Department.search(
        [("company_id", "=", company.id), ("name", "=", name)],
        limit=1,
    )
    if dep:
        return dep
    return Department.create({"name": name, "company_id": company.id})


def _upsert_employees(env, csv_by_barcode):
    company = env.company
    Employee = _employee_model(env)
    created = updated = 0
    employees = {}
    for barcode in DEMO_BOARD_BARCODES:
        row = csv_by_barcode.get(barcode)
        if not row:
            _log(f"  warn: missing CSV row for {barcode}")
            continue
        name = (row.get("Name") or "").strip()
        email = (row.get("Email") or "").strip()
        department_name = (row.get("Department") or "").strip()
        active = _parse_active(row.get("Status"))
        dep = (
            _get_or_create_department(env, department_name, company)
            if department_name
            else False
        )
        vals = {
            "name": name,
            "company_id": company.id,
            "barcode": barcode,
            "work_email": email or False,
            "active": active,
            "department_id": dep.id if dep else False,
        }
        override = NAME_OVERRIDES.get(barcode) or {}
        vals.update({k: v for k, v in override.items() if v})
        existing = Employee.search([("barcode", "=", barcode)], limit=1)
        if existing:
            existing.write(vals)
            emp = existing
            updated += 1
        else:
            emp = Employee.create(vals)
            created += 1
        employees[barcode] = emp

    # Manager links (second pass)
    for barcode, emp in employees.items():
        row = csv_by_barcode.get(barcode) or {}
        manager_name = (row.get("Manager") or "").strip()
        if not manager_name:
            continue
        manager = Employee.search(
            [("company_id", "=", company.id), ("name", "=", manager_name)],
            limit=1,
        )
        if manager and emp.parent_id != manager:
            emp.write({"parent_id": manager.id})

    _log(f"Employees: {created} created, {updated} updated ({len(employees)} in roster).")
    return employees


def _role_by_template(env, template_key):
    company = env.company
    Role = env["doc.employee.files.role"].sudo()
    role = Role.search(
        [
            ("company_id", "=", company.id),
            ("role_template_key", "=", template_key),
            ("is_system_template", "=", True),
        ],
        limit=1,
    )
    return role


def _ensure_canonical_roles(env):
    svc = env["doc.org.role.template.service"].sudo()
    svc.ensure_canonical_org_roles(env.company)
    env["doc.employee.files.role.service"].sudo().ensure_odoo_admin_super_admin_bindings()


def _ensure_demo_users(env, employees_by_barcode):
    DocGroup = env.ref("cleon_document_management.group_document_user")
    Base = env.ref("base.group_user")
    company = env.company
    User = env["res.users"].sudo()

    for login, display_name, barcode, template_key in DEMO_USER_SPECS:
        employee = employees_by_barcode.get(barcode)
        role = _role_by_template(env, template_key)
        roles = role if role else env["doc.employee.files.role"].browse()
        user = User.search([("login", "=", login)], limit=1)
        vals = {
            "name": display_name,
            "login": login,
            "password": DEMO_PASSWORD,
            "company_id": company.id,
            "company_ids": [(6, 0, [company.id])],
            "groups_id": [(6, 0, [Base.id, DocGroup.id])],
            "employee_files_role_ids": [(6, 0, roles.ids)],
        }
        if employee:
            vals["employee_id"] = employee.id
        if user:
            user.write(vals)
        else:
            user = User.create(vals)
        if employee and not employee.user_id:
            employee.write({"user_id": user.id})
        _log(f"  user {login} → {template_key} (employee {barcode})")

    demo = User.search([("login", "=", "demo")], limit=1)
    if demo:
        demo.write({"password": "demo"})
    admin = env.ref("base.user_admin")
    admin.write({"login": "admin", "password": "admin"})


def _setup_employee_files(env):
    company = env.company
    Config = env["doc.employee.files.config"].sudo()
    config = Config.get_for_company(company)
    config.write(
        {
            "setup_complete": True,
            "primary_organizing_dimension": "department",
            "organizing_dimension_ids": json.dumps(["department"]),
            "include_all_existing": True,
            "collect_existing_documents": False,
        }
    )
    env["doc.employee.files.service"].sudo().reconcile_all_employees_from_ems(company)
    _log("Employee Files: setup_complete + reconcile_all_employees_from_ems.")


def _minimal_pdf_b64(title="Demo document"):
    # Smallest valid-enough PDF for previews
    body = (
        b"%PDF-1.4\n1 0 obj<<>>endobj\n2 0 obj<< /Length 44 >>stream\n"
        + title.encode("utf-8")[:40]
        + b"\nendstream\nendobj\ntrailer<<>>\n%%EOF\n"
    )
    return base64.b64encode(body)


def _get_or_create_doc_type(env, name="National ID"):
    DocType = env["doc.document.type"].sudo()
    doc_type = DocType.search([("name", "=", name)], limit=1)
    if doc_type:
        return doc_type
    return DocType.create({"name": name, "category": "identity"})


def _employee_folder(env, employee):
    File = env["doc.employee.file"].sudo()
    ef = File.search([("employee_id", "=", employee.id)], limit=1)
    if ef and ef.storage_folder_id:
        return ef.storage_folder_id
    Folder = env["doc.folder"].sudo()
    folder = Folder.search(
        [
            ("folder_type", "=", "employee"),
            ("employee_ids", "in", employee.id),
        ],
        limit=1,
    )
    if folder:
        return folder
    return Folder.create(
        {
            "folder_name": employee.name,
            "folder_type": "employee",
            "access_scope": "individual",
            "owner_id": env.user.id,
            "company_id": env.company.id,
            "employee_ids": [(6, 0, [employee.id])],
        }
    )


def _force_document_rejected(env, document, reason):
    """Post-create: upload workflow resets approval_state; set demo rejection via SQL."""
    env.cr.execute(
        """
        UPDATE doc_document
        SET state = %s,
            approval_state = %s,
            rejection_reason = %s,
            review_decision_unread = TRUE
        WHERE id = %s
        """,
        ("rejected", "rejected", reason, document.id),
    )
    document.invalidate_recordset(
        ["state", "approval_state", "rejection_reason", "review_decision_unread"]
    )


def _create_employee_document(env, employee, name, doc_type, **extra):
    folder = _employee_folder(env, employee)
    attachment = env["ir.attachment"].sudo().create(
        {
            "name": f"{name}.pdf",
            "datas": _minimal_pdf_b64(name),
            "mimetype": "application/pdf",
            "type": "binary",
        }
    )
    owner_user = employee.user_id.id if employee.user_id else env.user.id
    vals = {
        "name": name,
        "folder_id": folder.id,
        "document_type_id": doc_type.id,
        "attachment_id": attachment.id,
        "employee_id": employee.id,
        "uploaded_by": owner_user,
        "owner_id": owner_user,
        "state": "approved",
        "approval_state": "not_required",
    }
    vals.update(extra)
    Doc = env["doc.document"].sudo()
    if "skip_registry_sync" in Doc.env.context:
        return Doc.create(vals)
    return Doc.with_context(skip_registry_sync=True).create(vals)


def _seed_compliance(env, employees_by_barcode):
    Policy = env["doc.compliance.policy"].sudo()
    if Policy.search_count([]):
        policy = Policy.search([], limit=1)
    else:
        policy_type = env.ref("cleon_document_management.policy_type_document_requirement")
        doc_type = _get_or_create_doc_type(env, "National ID")
        policy = Policy.create(
            {
                "name": "Demo — Required onboarding documents",
                "policy_type_id": policy_type.id,
                "document_type_ids": [(6, 0, [doc_type.id])],
                "applies_to": "all",
                "schedule": "one_time",
                "minimum_documents": 1,
                "grace_period_days": 14,
                "description": "Board demo: missing National ID drives workspace to-do.",
                "active": True,
            }
        )
        _log("  compliance policy created")

    Employee = env["hr.employee"].sudo()
    roster = Employee.with_context(active_test=False).search(
        [("barcode", "in", list(DEMO_BOARD_BARCODES)), ("company_id", "=", env.company.id)]
    )
    for emp in roster:
        policy.evaluate_employee(emp)
    _log(f"  compliance evaluated for {len(roster)} employees")


def _seed_workspace_scenarios(env, employees_by_barcode):
    david = employees_by_barcode.get("EMP-WL-018")
    amara = employees_by_barcode.get("EMP-WL-028")
    chinwe_user = env["res.users"].sudo().search([("login", "=", "chinwe.adebayo")], limit=1)
    if not david:
        _log("  skip workspace scenarios (David Okafor missing)")
        return

    doc_type = _get_or_create_doc_type(env, "National ID")

    reject_reason = "Image unclear — please upload a full-page scan."
    rejected = env["doc.document"].sudo().search(
        [
            ("employee_id", "=", david.id),
            ("name", "=", "National ID (rejected upload)"),
        ],
        limit=1,
    )
    if not rejected:
        rejected = _create_employee_document(
            env,
            david,
            "National ID (rejected upload)",
            doc_type,
        )
        _log("  David: rejected upload")
    _force_document_rejected(env, rejected, reject_reason)
    if david.user_id:
        rejected.sudo().write(
            {
                "owner_id": david.user_id.id,
                "uploaded_by": david.user_id.id,
            }
        )
    Policy = env["doc.compliance.policy"].sudo()
    for policy in Policy.search([("active", "=", True)]):
        if policy._applies_to_employee(david):
            policy.evaluate_employee(david)
    dupes = env["doc.document"].sudo().search(
        [
            ("employee_id", "=", david.id),
            ("name", "=", "National ID (rejected upload)"),
            ("id", "!=", rejected.id),
        ]
    )
    if dupes:
        dupes.unlink()

    Folder = env["doc.folder"].sudo()
    org_folder = Folder.search(
        [
            ("folder_type", "=", "organizational"),
            ("folder_name", "=", "HR Policies"),
        ],
        limit=1,
    )
    if not org_folder:
        org_folder = Folder.create(
            {
                "folder_name": "HR Policies",
                "folder_type": "organizational",
                "access_scope": "all_staff",
                "owner_id": env.user.id,
                "company_id": env.company.id,
            }
        )

    Approval = env["doc.organizational.approval.request"].sudo()
    if chinwe_user and not Approval.search_count(
        [
            ("state", "=", "pending"),
            ("assigned_approver_ids", "in", chinwe_user.id),
        ]
    ):
        requester = env["res.users"].sudo().search([("login", "=", "aaron.johnson")], limit=1)
        Approval.create(
            {
                "name": "Publish updated Code of Conduct",
                "company_id": env.company.id,
                "requested_by_id": requester.id if requester else env.user.id,
                "action_key": "org.upload",
                "folder_id": org_folder.id,
                "state": "pending",
                "assigned_approver_ids": [(6, 0, [chinwe_user.id])],
                "due_at": fields.Datetime.now() + timedelta(days=3),
                "payload_json": json.dumps(
                    {"name": "Code of Conduct 2026", "folder_id": org_folder.id}
                ),
            }
        )
        _log("  Chinwe: pending org approval")

    if amara:
        _log(f"  Amara Okafor ready for cross-persona demos ({amara.name})")


def main(env):
    env = _admin_env(env)
    company = env.company
    _log(f"Demo board seed — company {company.name} (id={company.id})")
    _log(f"Target roster: {len(DEMO_BOARD_BARCODES)} employees")

    if not _truthy("DMS_DEMO_SKIP_CLEAR"):
        _log("Running clear_dms_data.py…")
        _run_clear()

    csv_by_barcode = _load_csv_rows()
    _delete_ef_qa(env)
    removed = _trim_company_roster(env, DEMO_BOARD_BARCODES)
    employees = _upsert_employees(env, csv_by_barcode)
    env.cr.commit()
    _ensure_canonical_roles(env)
    _ensure_demo_users(env, employees)
    env.cr.commit()
    _setup_employee_files(env)
    env.cr.commit()
    _seed_compliance(env, employees)
    env.cr.commit()
    try:
        _seed_workspace_scenarios(env, employees)
        env.cr.commit()
    except Exception as exc:
        env.cr.rollback()
        _log(f"  workspace scenarios partial/failed: {exc}")
    _log("")
    _log("Demo board ready.")
    _log(f"  Password (demo users): {DEMO_PASSWORD}")
    _log("  Logins: david.okafor, ngozi.bello, aaron.johnson, chinwe.adebayo")
    roster_n = env["hr.employee"].sudo().with_context(active_test=False).search_count(
        [("company_id", "=", company.id), ("barcode", "in", list(DEMO_BOARD_BARCODES))]
    )
    _log(f"  Demo roster employees: {roster_n}")
    _log("  Open My Workspace as david.okafor to see to-do items.")


main(env)
