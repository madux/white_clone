#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Generate dev_seed.sql from staff-export-2026-08-05.csv + dev_seed_people_block.sql.

Reads the CSV, skips the 7 reference employees already seeded by
dev_seed_people_block.sql (they keep their tuned lifecycle data), and emits a
single idempotent-guarded SQL file that:
  1. runs the reference-people DO block first (departments, locations,
     employees, tuned contracts),
  2. then creates the missing departments/locations/grades and all new
     roster employees, contracts and manager links.
The whole file runs inside one BEGIN/COMMIT transaction guarded by a combined
barcode check (people + roster), so it is all-or-nothing.
"""
import csv
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, 'staff-export-2026-08-05-with-gender.csv')
OUT_PATH = os.path.join(HERE, 'dev_seed.sql')
GENDER_UPDATE_PATH = os.path.join(HERE, 'dev_gender_update.sql')
PEOPLE_BLOCK_PATH = os.path.join(HERE, 'dev_seed_people_block.sql')

SKIP_BARCODES = {
    'EMP-2019-0001', 'EMP-2018-0004', 'EMP-2020-0002',
    'EMP-2021-0003', 'EMP-2025-0005', 'EMP-WL-012', 'EMP-WL-005',
}

TRIAL_DATE_END = '2026-10-01'  # future so derived state = probation

WORK_MODE_MAP = {'Office': 'office', 'Hybrid': 'hybrid', 'Remote': 'remote'}

GENDER_MAP = {'Male': 'male', 'Female': 'female', 'N/A': None}

GRADES = {
    'L1 · Junior Associate', 'L2 · Associate', 'L3 · Senior Associate',
    'L4 · Associate', 'L4 · Manager', 'L5 · Senior Manager',
    'L6 · Director', 'L7 · Executive',
}

EXISTING_DEPTS = {'Design', 'Finance', 'Engineering', 'Human Resources'}
EXISTING_LOCATIONS = {'Lagos, Nigeria', 'HQ New York', 'Lagos HQ',
                      'San Francisco Office', 'Abuja, Nigeria'}
NEW_LOCATION_TYPES = {
    'Remote — Global': 'home',
    'Abuja Regional Office': 'office',
    'Port Harcourt Branch': 'office',
    'Kano Satellite Office': 'office',
}


def parse_date(value):
    value = value.strip()
    for fmt in ('%Y-%m-%d', '%b %d, %Y', '%b %d, %Y', '%d/%m/%Y'):
        try:
            from datetime import datetime
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            continue
    raise ValueError('Unparsable date: %r' % value)


def q(val):
    return "'" + str(val).replace("'", "''") + "'"


def main():
    with open(CSV_PATH, newline='', encoding='utf-8') as fh:
        rows = list(csv.DictReader(fh))

    new_rows = [r for r in rows if r['ID'] not in SKIP_BARCODES]
    if len(new_rows) != 193:
        print('WARNING: expected 193 new employees, got %d' % len(new_rows))

    # Validate data quality
    ids = [r['ID'] for r in new_rows]
    dup_ids = sorted({i for i in ids if ids.count(i) > 1})
    names = [r['Name'] for r in new_rows]
    dup_names = sorted({n for n in names if names.count(n) > 1})
    if dup_ids:
        print('ERROR: duplicate IDs: %s' % dup_ids)
        sys.exit(1)
    if dup_names:
        print('ERROR: duplicate names: %s' % dup_names)
        sys.exit(1)

    new_names = set(names)
    all_names = set(r['Name'] for r in rows)
    missing_managers = sorted({
        r['Name'] for r in new_rows
        if r['Manager'] and r['Manager'] not in all_names
        and r['Manager'] not in ('Chief Executive Officer', 'CEO')
    })
    if missing_managers:
        print('ERROR: managers not in CSV: %s' % missing_managers)
        sys.exit(1)

    unknown_grades = sorted({r['Grade'] for r in new_rows} - GRADES)
    if unknown_grades:
        print('ERROR: unknown grades: %s' % unknown_grades)
        sys.exit(1)

    unknown_modes = sorted(set(r['Work Mode'] for r in new_rows) - set(WORK_MODE_MAP))
    if unknown_modes:
        print('ERROR: unknown work modes: %s' % unknown_modes)
        sys.exit(1)

    unknown_genders = sorted(set(r['Gender'] for r in new_rows) - set(GENDER_MAP))
    if unknown_genders:
        print('ERROR: unknown genders: %s' % unknown_genders)
        sys.exit(1)

    # Departments and locations to create
    depts = sorted({r['Department'] for r in new_rows} - EXISTING_DEPTS)
    locs = sorted({r['Location'] for r in new_rows} - EXISTING_LOCATIONS)
    print('New departments: %s' % depts)
    print('New locations:   %s' % locs)

    # ── Assemble SQL ─────────────────────────────────────────────────────────
    guard_barcodes = ', '.join(q(b) for b in sorted(SKIP_BARCODES | set(ids)))
    rows_txt = []
    for r in new_rows:
        start = parse_date(r['Start Date'])
        active = 'true' if r['Status'] != 'Inactive' else 'false'
        mode = WORK_MODE_MAP[r['Work Mode']]
        trial = ("'%s'" % TRIAL_DATE_END) if r['Status'] == 'Probation' else 'NULL'
        gender = GENDER_MAP[r['Gender']]
        gender_lit = 'NULL' if gender is None else q(gender)
        perf = r.get('performance_score', '0')
        rows_txt.append(
            "(%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)" % (
                q(r['ID']),
                q(r['ID']),
                q(r['Name']),
                q(r['Role']),
                q(r['Department']),
                q(r['Grade']),
                q(mode),
                q(r['Location']),
                q(r['Manager']),
                q(start),
                q(r['Email']),
                q(r['Phone']),
                active,
                trial,
                gender_lit,
                q(r.get('sdir_employment_type', 'Permanent Full-Time')),
                perf if perf.isdigit() else '0',
                q(r.get('flight_risk', 'Low')),
                q(r.get('retention_priority', 'Low')),
                q(r.get('skills', '')),
                q(r.get('languages', 'English')),
                q(r.get('availability', 'Available')),
                q(r.get('last_active', '2026-08-28 10:00:00')),
            )
        )

    roster_body = """-- ── Base lookups ───────────────────────────────────────────────────────────
SELECT id AS company_id FROM res_company ORDER BY id LIMIT 1 \\gset
SELECT COALESCE(
    (SELECT id FROM res_users WHERE active AND login = 'admin' ORDER BY id LIMIT 1),
    1
) AS admin_uid \\gset
SELECT COALESCE(
    (SELECT id FROM resource_calendar WHERE company_id = :company_id ORDER BY id LIMIT 1),
    (SELECT id FROM resource_calendar ORDER BY id LIMIT 1)
) AS calendar_id \\gset
SELECT partner_id AS address_id FROM res_company WHERE id = :company_id \\gset

-- ── Stage the roster ───────────────────────────────────────────────────────
CREATE TEMP TABLE _seed_emp (
    barcode     text,
    emp_no      text,
    name        text,
    job_title   text,
    dept        text,
    grade       text,
    work_mode   text,
    loc         text,
    manager     text,
    start_date  date,
    email       text,
    phone       text,
    is_active   boolean,
    trial_end   date,
    gender      text,
    sdir_employment_type text,
    performance_score int,
    flight_risk text,
    retention_priority text,
    skills      text,
    languages   text,
    availability text,
    last_active timestamp
) ON COMMIT DROP;

INSERT INTO _seed_emp (barcode, emp_no, name, job_title, dept, grade, work_mode,
                       loc, manager, start_date, email, phone, is_active, trial_end, gender,
                       sdir_employment_type, performance_score, flight_risk, retention_priority,
                       skills, languages, availability, last_active)
VALUES
%s;

-- ── Departments (create missing) ───────────────────────────────────────────
INSERT INTO hr_department(name, company_id, active,
                          create_uid, write_uid, create_date, write_date)
SELECT jsonb_build_object('en_US', s.dept), :company_id, true,
       :admin_uid, :admin_uid, NOW(), NOW()
FROM (SELECT DISTINCT dept FROM _seed_emp) s
WHERE NOT EXISTS (
    SELECT 1 FROM hr_department d
    WHERE d.name->>'en_US' = s.dept AND d.company_id = :company_id
);

UPDATE hr_department SET parent_path = id::text || '/' WHERE parent_path IS NULL;

-- Raw-SQL inserts bypass Odoo's stored computes (hr.department._rec_name is
-- complete_name), so recompute them for the flat departments we just created.
UPDATE hr_department
   SET complete_name = name->>'en_US',
       master_department_id = id
 WHERE complete_name IS NULL AND parent_id IS NULL;

-- ── Grades (create the 8 roster grades) ────────────────────────────────────
INSERT INTO hr_grade(name, create_uid, write_uid, create_date, write_date)
SELECT DISTINCT g.name, :admin_uid, :admin_uid, NOW(), NOW()
FROM (VALUES
    ('L1 · Junior Associate'),
    ('L2 · Associate'),
    ('L3 · Senior Associate'),
    ('L4 · Associate'),
    ('L4 · Manager'),
    ('L5 · Senior Manager'),
    ('L6 · Director'),
    ('L7 · Executive')
) AS g(name)
WHERE NOT EXISTS (
    SELECT 1 FROM hr_grade hg WHERE hg.name = g.name
);

-- ── Work locations (create missing) ────────────────────────────────────────
INSERT INTO hr_work_location(name, location_type, address_id, company_id, active,
                             create_uid, write_uid, create_date, write_date)
SELECT s.loc, CASE s.loc %s END, :address_id, :company_id, true,
       :admin_uid, :admin_uid, NOW(), NOW()
FROM (SELECT DISTINCT loc FROM _seed_emp) s
WHERE NOT EXISTS (
    SELECT 1 FROM hr_work_location wl
    WHERE wl.name = s.loc AND wl.company_id = :company_id
);

-- ── resource_resource (one per employee) ──────────────────────────────────
INSERT INTO resource_resource(name, resource_type, company_id, calendar_id,
                              active, tz, time_efficiency,
                              create_uid, write_uid, create_date, write_date)
SELECT s.name, 'user', :company_id, :calendar_id, true, 'UTC', 100,
       :admin_uid, :admin_uid, NOW(), NOW()
FROM _seed_emp s;

-- ── hr_employee ────────────────────────────────────────────────────────────
INSERT INTO hr_employee(name, resource_id, company_id, active,
                        job_title, department_id, work_location_id,
                        barcode, employee_number, employee_type, work_email,
                        mobile_phone, grade_id, work_mode, gender,
                        sdir_employment_type, performance_score, flight_risk,
                        retention_priority, skills, languages, availability, last_active,
                        create_uid, write_uid, create_date, write_date)
SELECT s.name, r.id, :company_id, s.is_active,
       s.job_title, d.id, l.id,
       s.barcode, s.emp_no, 'employee', s.email, s.phone,
       g.id, s.work_mode, s.gender,
       s.sdir_employment_type, s.performance_score, s.flight_risk,
       s.retention_priority, s.skills, s.languages, s.availability, s.last_active,
       :admin_uid, :admin_uid, CAST(s.start_date AS timestamp), NOW()
FROM _seed_emp s
JOIN LATERAL (
    SELECT rr.id FROM resource_resource rr
    WHERE rr.name = s.name AND rr.resource_type = 'user'
      AND rr.company_id = :company_id
    ORDER BY rr.id DESC
    LIMIT 1
) r ON true
JOIN hr_department d ON d.name->>'en_US' = s.dept AND d.company_id = :company_id
JOIN hr_work_location l ON l.name = s.loc AND l.company_id = :company_id
JOIN hr_grade g ON g.name = s.grade;

-- ── Manager links (two-phase: parents resolved after all employees exist) ──
UPDATE hr_employee e
SET parent_id = m.id
FROM _seed_emp s
JOIN hr_employee m ON m.name = s.manager
WHERE e.barcode = s.barcode
  AND s.manager <> ''
  AND m.id <> e.id;

-- ── Contracts ──────────────────────────────────────────────────────────────
INSERT INTO hr_contract(name, employee_id, company_id,
                        date_start, trial_date_end, state, wage, active,
                        work_entry_source, date_generated_from, date_generated_to,
                        create_uid, write_uid, create_date, write_date)
SELECT s.barcode || '-CONTRACT', e.id, :company_id,
       s.start_date, s.trial_end, 'open', 5000, true,
       'calendar', NOW(), NOW(),
       :admin_uid, :admin_uid, NOW(), NOW()
FROM _seed_emp s
JOIN hr_employee e ON e.barcode = s.barcode
WHERE s.is_active;

-- ── Link current contract (mirrors hr_contract._assign_open_contract) ────
UPDATE hr_employee e
SET contract_id = c.id
FROM hr_contract c
WHERE c.employee_id = e.id
  AND c.state = 'open'
  AND e.contract_id IS NULL;

-- ── Validate ───────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_total INT;
    v_archived INT;
    v_probation INT;
    v_no_parent INT;
BEGIN
    SELECT count(*) INTO v_total FROM _seed_emp;
    SELECT count(*) INTO v_archived FROM _seed_emp WHERE NOT is_active;
    SELECT count(*) INTO v_probation FROM _seed_emp WHERE trial_end IS NOT NULL;
    SELECT count(*) INTO v_no_parent
    FROM _seed_emp s
    JOIN hr_employee e ON e.barcode = s.barcode
    WHERE s.manager <> '' AND e.parent_id IS NULL;

    RAISE NOTICE 'Roster complete: %% employees inserted (%% archived, %% probation), %% missing parents',
        v_total, v_archived, v_probation, v_no_parent;
END $$;"""

    with open(PEOPLE_BLOCK_PATH, encoding='utf-8') as fh:
        people_block = fh.read().rstrip()

    loc_when = '\n       '.join(
        "WHEN %s THEN %s" % (q(loc), q(loc_type))
        for loc, loc_type in sorted(NEW_LOCATION_TYPES.items())
    )

    # Build roster values, then assemble the single combined seed file.
    roster_body_filled = roster_body % (',\n'.join(rows_txt), loc_when)
    sql = "".join([
        "-- ========================================================================\n",
        "-- Staff Directory — Full Staff Seed (generated by dev_generate_seed_all.py)\n",
        "-- Single file combining:\n",
        "--   1. The 7 reference people (dev_seed_people_block.sql) with their tuned\n",
        "--      lifecycle/tenure/manager data.\n",
        "--   2. The 193-employee roster from staff-export-2026-08-05.csv that are NOT\n",
        "--      the reference people, so their tuned lifecycle data stays intact.\n",
        "--\n",
        "-- Employee number + work_mode columns must exist (module upgraded):\n",
        "--   ./venv/bin/python ./odoo-bin -c ./white_clone.conf -d white_clone_db_v2 \\\n",
        "--       -u hr_staff_directory --stop-after-init\n",
        "--\n",
        "-- Run (all-or-nothing; single transaction):\n",
        "--   psql -U odoo_dev -h localhost -d white_clone_db_v2 -f dev_seed.sql\n",
        "-- ========================================================================\n",
        "\n",
        "\\set ON_ERROR_STOP on\n",
        "\n",
        "BEGIN;\n",
        "\n",
        "-- ── Guard: abort if any seed barcode already exists ───────────────────────\n",
        "DO $$\n",
        "BEGIN\n",
        "    IF EXISTS (SELECT 1 FROM hr_employee WHERE barcode IN (%s)) THEN\n",
        "        RAISE EXCEPTION\n",
        "            'Seed already applied (one or more target barcodes exist). '\n",
        "            'Re-create the DB or clean it first.';\n",
        "    END IF;\n",
        "END $$;\n",
        "\n",
        "-- ════════════════════════════════════════════════════════════════════════\n",
        "-- PART 1 — Reference People (tuned lifecycle data)\n",
        "-- ════════════════════════════════════════════════════════════════════════\n",
        "%s;\n",
        "\n",
        "-- ════════════════════════════════════════════════════════════════════════\n",
        "-- PART 2 — Full Roster (remaining 193 employees)\n",
        "-- ════════════════════════════════════════════════════════════════════════\n",
        "%s\n",
        "\n",
        "COMMIT;\n",
    ]) % (guard_barcodes, people_block, roster_body_filled)

    with open(OUT_PATH, 'w', encoding='utf-8') as fh:
        fh.write(sql)
    print('Wrote %s' % OUT_PATH)

    # ── dev_gender_update.sql: apply gender to an already-seeded DB ──────────
    all_gender_rows = []
    for r in rows:
        g = GENDER_MAP[r['Gender']]
        if g is None:
            continue
        all_gender_rows.append("(%s, %s)" % (q(r['ID']), q(g)))
    gender_update = "\n".join([
        "-- ========================================================================\n",
        "-- Staff Directory — Gender Update (generated by dev_generate_seed_all.py)\n",
        "-- Applies the Gender column from the CSV to an already-seeded DB.\n",
        "-- Idempotent: rows without a mapped gender (N/A) are left untouched.\n",
        "-- ========================================================================\n",
        "\n",
        "\\set ON_ERROR_STOP on\n",
        "\n",
        "BEGIN;\n",
        "\n",
        "UPDATE hr_employee e\n",
        "SET gender = v.g\n",
        "FROM (VALUES\n%s) AS v(barcode, g)\n",
        "WHERE e.barcode = v.barcode\n",
        "  AND v.g IS NOT NULL\n",
        "  AND e.gender IS DISTINCT FROM v.g;\n",
        "\n",
        "COMMIT;\n",
    ]) % (",\n".join(all_gender_rows))
    with open(GENDER_UPDATE_PATH, 'w', encoding='utf-8') as fh:
        fh.write(gender_update)
    print('Wrote %s' % GENDER_UPDATE_PATH)


if __name__ == '__main__':
    main()
