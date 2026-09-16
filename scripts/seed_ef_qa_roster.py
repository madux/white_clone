# -*- coding: utf-8 -*-
"""Reset EF-QA EMS roster: realistic names and mixed active/inactive for QA.

Removes existing employees whose barcode matches EF-QA-* (and linked DMS
employee-file rows for those EMS ids), then creates a fresh roster.

Run from Odoo shell:
    cd ~/Documents/Projects/odoo-17.0
    .venv/bin/python odoo-bin shell -c odoo.conf -d white_cleon_17 \\
        < /path/to/white_clone/scripts/seed_ef_qa_roster.py

Environment:
    SEED_EF_QA_COUNT=1000          How many EF-QA employees to create (default 1000)
    SEED_EF_QA_PREFIX=EF-QA-       Barcode prefix (default)
    SEED_EF_QA_INACTIVE_EVERY=7    Every Nth employee is inactive (default 7 → ~14%)
    SEED_EF_QA_SKIP_DELETE=0       Set 1 to only update names/active on existing EF-QA rows
"""
from __future__ import annotations

import os
import re
import unicodedata

if "env" not in globals():
    raise SystemExit(
        "Run via Odoo shell:\n"
        "  ./odoo-bin shell -c odoo.conf -d DB < scripts/seed_ef_qa_roster.py"
    )


def _int_env(name, default):
    try:
        return max(0, int(os.environ.get(name, str(default))))
    except ValueError:
        return default


def _truthy(name, default="0"):
    return os.environ.get(name, default).strip().lower() in ("1", "true", "yes", "on")


COUNT = _int_env("SEED_EF_QA_COUNT", 1000)
PREFIX = os.environ.get("SEED_EF_QA_PREFIX", "EF-QA-").strip() or "EF-QA-"
INACTIVE_EVERY = max(2, _int_env("SEED_EF_QA_INACTIVE_EVERY", 7))
SKIP_DELETE = _truthy("SEED_EF_QA_SKIP_DELETE")

FIRST_NAMES = [
    "Amina", "Chidi", "Fatima", "James", "Priya", "Carlos", "Mei", "Oliver",
    "Sofia", "Kwame", "Hannah", "Raj", "Elena", "Noah", "Zara", "Daniel",
    "Aisha", "Liam", "Yuki", "Grace", "Marcus", "Leila", "Ethan", "Nadia",
    "Benjamin", "Chioma", "Lucas", "Anika", "Samuel", "Isabella", "David",
    "Maya", "Thomas", "Aaliyah", "Michael", "Claire", "Andre", "Rosa", "Henry",
    "Ngozi", "William", "Sana", "Joseph", "Emily", "Tariq", "Victoria", "Ryan",
    "Keiko", "Nathan", "Adaeze", "Sophia", "Patrick", "Lin", "Gabriel", "Amara",
    "Jack", "Helena", "Isaac", "Jasmine", "Matthew", "Olivia", "Peter", "Ruth",
    "Simon", "Teresa", "Uche", "Valerie", "Walter", "Ximena", "Yusuf", "Zoe",
]

LAST_NAMES = [
    "Adebayo", "Okafor", "Mensah", "Chen", "Patel", "Garcia", "Nguyen", "Smith",
    "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis", "Rodriguez",
    "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas",
    "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson", "White",
    "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
    "Young", "Allen", "King", "Wright", "Scott", "Torres", "Hill", "Flores",
    "Green", "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
    "Carter", "Roberts", "Okonkwo", "Bello", "Ibrahim", "Khan", "Singh", "Kim",
    "Park", "Sato", "Tanaka", "Schmidt", "Müller", "Dupont", "Rossi", "Silva",
    "Costa", "Fernandes", "Osei", "Diallo", "Mbeki", "Njoroge", "Eze", "Boateng",
    "Chukwu", "Afolabi", "Balogun", "Yamamoto", "Li", "Wang", "Zhang", "Liu",
    "Cohen", "Levy", "Murphy", "Kelly", "Sullivan", "Walsh", "O'Brien", "Doyle",
    "Fitzgerald", "Byrne", "McCarthy", "O'Connor", "Reed", "Cook", "Morgan",
    "Bell", "Ward", "Brooks", "Sanders", "Price", "Bennett", "Wood", "Barnes",
    "Ross", "Henderson", "Coleman", "Jenkins", "Perry", "Powell", "Long", "Patterson",
]


def _log(msg):
    print(msg)


def _slug(text):
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z0-9]+", ".", text.lower()).strip(".")
    return text or "employee"


def _person_for_index(index):
    first = FIRST_NAMES[(index - 1) % len(FIRST_NAMES)]
    last = LAST_NAMES[((index - 1) * 11 + (index // len(FIRST_NAMES))) % len(LAST_NAMES)]
    if index > len(FIRST_NAMES) * len(LAST_NAMES) // 2:
        last = f"{last}-{index % 100:02d}"
    full_name = f"{first} {last}"
    active = (index % INACTIVE_EVERY) != 0
    return full_name, active


def _clear_dms_links(employee_ids):
    if not employee_ids:
        return
    env_ = env["doc.employee.file"].sudo()
    files = env_.search([("employee_id", "in", employee_ids)])
    if files:
        _log(f"  Removing {len(files)} doc.employee.file row(s) for EF-QA EMS ids…")
        files.unlink()
    Exclusion = env["doc.employee.exclusion"].sudo()
    ex = Exclusion.search([("employee_id", "in", employee_ids)])
    if ex:
        ex.unlink()
    Issue = env["doc.employee.issue"].sudo()
    issues = Issue.search([("employee_id", "in", employee_ids)])
    if issues:
        issues.unlink()


def _delete_ef_qa_roster():
    Employee = env["hr.employee"].sudo()
    qa = Employee.search([("barcode", "=like", f"{PREFIX}%")])
    if not qa:
        _log(f"No employees with barcode {PREFIX}* — nothing to delete.")
        return 0
    _log(f"Removing {len(qa)} existing {PREFIX}* employee(s)…")
    _clear_dms_links(qa.ids)
    qa.unlink()
    env.cr.commit()
    return len(qa)


def _update_existing_ef_qa():
    Employee = env["hr.employee"].sudo()
    qa = Employee.search([("barcode", "=like", f"{PREFIX}%")], order="barcode")
    if not qa:
        return 0, 0
    updated = 0
    active_n = 0
    inactive_n = 0
    width = max(5, len(str(max(COUNT, len(qa)))))
    for index, emp in enumerate(qa, start=1):
        name, active = _person_for_index(index)
        slug = _slug(name)
        emp.write(
            {
                "name": name,
                "active": active,
                "work_email": f"{slug}.{index:0{width}d}@example.test",
            }
        )
        updated += 1
        if active:
            active_n += 1
        else:
            inactive_n += 1
    env.cr.commit()
    return updated, active_n, inactive_n


def _create_roster():
    company = env.company
    Employee = env["hr.employee"].sudo()
    Department = env["hr.department"].sudo()
    departments = Department.search([("company_id", "=", company.id)])
    if not departments:
        departments = Department.search([], limit=8)

    created = 0
    active_n = 0
    inactive_n = 0
    width = max(5, len(str(COUNT)))

    for index in range(1, COUNT + 1):
        barcode = f"{PREFIX}{index:0{width}d}"
        if Employee.search_count([("barcode", "=", barcode)]):
            continue
        name, active = _person_for_index(index)
        slug = _slug(name)
        dep = departments[(index - 1) % len(departments)] if departments else False
        Employee.create(
            {
                "name": name,
                "company_id": company.id,
                "barcode": barcode,
                "department_id": dep.id if dep else False,
                "work_email": f"{slug}.{index:0{width}d}@example.test",
                "active": active,
            }
        )
        created += 1
        if active:
            active_n += 1
        else:
            inactive_n += 1
        if created % 100 == 0:
            env.cr.commit()
            _log(f"  … {created} created")

    env.cr.commit()
    return created, active_n, inactive_n


def main():
    company = env.company
    _log(f"Company: {company.name} (id={company.id})")
    _log(f"Target roster: {COUNT} × {PREFIX}* (inactive every {INACTIVE_EVERY}th)")

    if SKIP_DELETE:
        _log("SEED_EF_QA_SKIP_DELETE=1 — updating existing EF-QA rows only.")
        updated, active_n, inactive_n = _update_existing_ef_qa()
        _log(f"Updated {updated} employees ({active_n} active, {inactive_n} inactive).")
    else:
        removed = _delete_ef_qa_roster()
        created, active_n, inactive_n = _create_roster()
        _log(
            f"Removed {removed}, created {created} "
            f"({active_n} active, {inactive_n} inactive)."
        )

    Employee = env["hr.employee"].sudo()
    total = Employee.search_count([("company_id", "=", company.id)])
    qa_active = Employee.search_count(
        [("company_id", "=", company.id), ("barcode", "=like", f"{PREFIX}%"), ("active", "=", True)]
    )
    qa_inactive = Employee.search_count(
        [
            ("company_id", "=", company.id),
            ("barcode", "=like", f"{PREFIX}%"),
            ("active", "=", False),
        ]
    )
    _log(f"EF-QA roster: {qa_active} active, {qa_inactive} inactive.")
    _log(f"Total hr.employee for company: {total}")

    if _truthy("SEED_EF_QA_APPLY_ATTENTION_CASES", "1"):
        _log("Applying EF-QA attention cases (missing departments)…")
        attention_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "seed_ef_qa_attention_cases.py"
        )
        with open(attention_path, encoding="utf-8") as fh:
            exec(compile(fh.read(), attention_path, "exec"), globals())


main()
