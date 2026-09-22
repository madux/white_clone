# -*- coding: utf-8 -*-
"""EF-QA employees with missing departments for setup / issues QA (EF-A4, EF-A5, EF-B).

Clears department_id on a predictable subset of **active** EF-QA employees so
Employee Files setup reports "need attention" (no_org_attribute) without blocking
the overall run.

Run after seed_ef_qa_roster.py (or anytime on an existing EF-QA roster):

    cd ~/Documents/Projects/odoo-17.0
    .venv/bin/python odoo-bin shell -c odoo.conf -d white_cleon_17 \\
        < /path/to/white_clone/scripts/seed_ef_qa_attention_cases.py

Environment:
    SEED_BARCODE_PREFIX=EF-QA-
    SEED_EF_QA_NO_DEPT_EVERY=37     Clear dept every Nth active EF-QA row (default 37)
    SEED_EF_QA_RESTORE_DEPARTMENTS=0  Set 1 to re-assign departments to everyone else
"""
from __future__ import annotations

import os

if "env" not in globals():
    raise SystemExit(
        "Run via Odoo shell:\n"
        "  ./odoo-bin shell -c odoo.conf -d DB < scripts/seed_ef_qa_attention_cases.py"
    )


def _int_env(name, default):
    try:
        return max(0, int(os.environ.get(name, str(default))))
    except ValueError:
        return default


def _truthy(name, default="0"):
    return os.environ.get(name, default).strip().lower() in ("1", "true", "yes", "on")


PREFIX = os.environ.get("SEED_BARCODE_PREFIX", "EF-QA-").strip() or "EF-QA-"
NO_DEPT_EVERY = _int_env("SEED_EF_QA_NO_DEPT_EVERY", 37)
RESTORE_OTHERS = _truthy("SEED_EF_QA_RESTORE_DEPARTMENTS")

# Always include these 1-based positions in the sorted roster (easy to find in Issues).
PINNED_NO_DEPT_INDEXES = {5, 12, 48, 200, 501}


def _log(msg):
    print(msg)


def _should_clear_department(index: int) -> bool:
    if index in PINNED_NO_DEPT_INDEXES:
        return True
    if NO_DEPT_EVERY and index % NO_DEPT_EVERY == 0:
        return True
    return False


def main():
    company = env.company
    Employee = env["hr.employee"].sudo()
    Department = env["hr.department"].sudo()
    departments = Department.search([("company_id", "=", company.id)])
    if not departments:
        departments = Department.search([], limit=8)

    employees = Employee.search(
        [("company_id", "=", company.id), ("barcode", "=like", f"{PREFIX}%")],
        order="barcode asc",
    )
    if not employees:
        _log(f"No employees with barcode {PREFIX}* — run seed_ef_qa_roster.py first.")
        return

    cleared = 0
    restored = 0
    cleared_barcodes = []

    for index, emp in enumerate(employees, start=1):
        if not emp.active:
            continue

        if _should_clear_department(index):
            if emp.department_id:
                emp.write({"department_id": False})
                cleared += 1
                cleared_barcodes.append(emp.barcode or str(emp.id))
            continue

        if RESTORE_OTHERS and not emp.department_id and departments:
            dep = departments[(index - 1) % len(departments)]
            emp.write({"department_id": dep.id})
            restored += 1

    env.cr.commit()

    active_no_dept = Employee.search_count(
        [
            ("company_id", "=", company.id),
            ("barcode", "=like", f"{PREFIX}%"),
            ("active", "=", True),
            ("department_id", "=", False),
        ]
    )
    _log(f"Company: {company.name}")
    _log(f"EF-QA roster size: {len(employees)}")
    _log(f"Cleared department on {cleared} active employee(s).")
    if RESTORE_OTHERS:
        _log(f"Restored department on {restored} employee(s).")
    _log(f"Active EF-QA without department (setup need-attention): {active_no_dept}")
    if cleared_barcodes[:12]:
        _log("Sample barcodes (no department): " + ", ".join(cleared_barcodes[:12]))
    if len(cleared_barcodes) > 12:
        _log(f"  … and {len(cleared_barcodes) - 12} more")
    _log(
        "Re-run Employee Files setup (or clear DMS + setup) to refresh issues; "
        "existing issues are not auto-cleared by this script."
    )


main()
