DO $$
DECLARE
    -- Base
    v_company_id   INT;
    v_calendar_id  INT;
    v_currency_id  INT;
    v_admin_uid    INT;
    v_address_id   INT;

    -- Departments
    v_dept_design  INT;
    v_dept_finance INT;
    v_dept_eng     INT;
    v_dept_hr      INT;

    -- Work Locations
    v_loc_lagos    INT;   -- Lagos, Nigeria      → other  → Hybrid
    v_loc_nyc      INT;   -- HQ New York         → office → Office
    v_loc_lagoshq  INT;   -- Lagos HQ            → other  → Hybrid
    v_loc_sf       INT;   -- San Francisco Office → other  → Hybrid
    v_loc_abuja    INT;   -- Abuja, Nigeria       → other  → Hybrid

    -- resource_resource IDs (one per employee)
    v_res_sarah INT; v_res_david INT; v_res_michael INT;
    v_res_emma  INT; v_res_liam  INT; v_res_raj     INT;
    v_res_amira INT;

    -- hr_employee IDs
    v_emp_sarah INT; v_emp_david INT; v_emp_michael INT;
    v_emp_emma  INT; v_emp_liam  INT; v_emp_raj     INT;
    v_emp_amira INT;

BEGIN

    -- ── Base lookups ──────────────────────────────────────────────────
    SELECT id INTO v_company_id FROM res_company ORDER BY id LIMIT 1;

    SELECT id INTO v_admin_uid
    FROM res_users WHERE active AND login = 'admin' ORDER BY id LIMIT 1;
    IF v_admin_uid IS NULL THEN v_admin_uid := 1; END IF;

    SELECT partner_id INTO v_address_id FROM res_company WHERE id = v_company_id;

    -- Prefer company-scoped calendar, fall back to global
    SELECT id INTO v_calendar_id
    FROM resource_calendar WHERE company_id = v_company_id ORDER BY id LIMIT 1;
    IF v_calendar_id IS NULL THEN
        SELECT id INTO v_calendar_id FROM resource_calendar ORDER BY id LIMIT 1;
    END IF;

    -- Prefer USD, fall back to first active currency
    SELECT id INTO v_currency_id
    FROM res_currency WHERE name = 'USD' AND active LIMIT 1;
    IF v_currency_id IS NULL THEN
        SELECT id INTO v_currency_id FROM res_currency WHERE active ORDER BY id LIMIT 1;
    END IF;

    RAISE NOTICE 'Base: company=%, admin_uid=%, calendar=%, currency=%',
        v_company_id, v_admin_uid, v_calendar_id, v_currency_id;

    -- ── Departments ───────────────────────────────────────────────────
    -- Design
    SELECT id INTO v_dept_design FROM hr_department
    WHERE name->>'en_US' = 'Design' AND company_id = v_company_id LIMIT 1;
    IF v_dept_design IS NULL THEN
        INSERT INTO hr_department(name, company_id, active, create_uid, write_uid, create_date, write_date)
        VALUES (jsonb_build_object('en_US', 'Design'), v_company_id, true, v_admin_uid, v_admin_uid, NOW(), NOW())
        RETURNING id INTO v_dept_design;
        RAISE NOTICE 'Created dept: Design=%', v_dept_design;
    ELSE
        RAISE NOTICE 'Reused dept:  Design=%', v_dept_design;
    END IF;

    -- Finance
    SELECT id INTO v_dept_finance FROM hr_department
    WHERE name->>'en_US' = 'Finance' AND company_id = v_company_id LIMIT 1;
    IF v_dept_finance IS NULL THEN
        INSERT INTO hr_department(name, company_id, active, create_uid, write_uid, create_date, write_date)
        VALUES (jsonb_build_object('en_US', 'Finance'), v_company_id, true, v_admin_uid, v_admin_uid, NOW(), NOW())
        RETURNING id INTO v_dept_finance;
        RAISE NOTICE 'Created dept: Finance=%', v_dept_finance;
    ELSE
        RAISE NOTICE 'Reused dept:  Finance=%', v_dept_finance;
    END IF;

    -- Engineering
    SELECT id INTO v_dept_eng FROM hr_department
    WHERE name->>'en_US' = 'Engineering' AND company_id = v_company_id LIMIT 1;
    IF v_dept_eng IS NULL THEN
        INSERT INTO hr_department(name, company_id, active, create_uid, write_uid, create_date, write_date)
        VALUES (jsonb_build_object('en_US', 'Engineering'), v_company_id, true, v_admin_uid, v_admin_uid, NOW(), NOW())
        RETURNING id INTO v_dept_eng;
        RAISE NOTICE 'Created dept: Engineering=%', v_dept_eng;
    ELSE
        RAISE NOTICE 'Reused dept:  Engineering=%', v_dept_eng;
    END IF;

    -- Human Resources
    SELECT id INTO v_dept_hr FROM hr_department
    WHERE name->>'en_US' = 'Human Resources' AND company_id = v_company_id LIMIT 1;
    IF v_dept_hr IS NULL THEN
        INSERT INTO hr_department(name, company_id, active, create_uid, write_uid, create_date, write_date)
        VALUES (jsonb_build_object('en_US', 'Human Resources'), v_company_id, true, v_admin_uid, v_admin_uid, NOW(), NOW())
        RETURNING id INTO v_dept_hr;
        RAISE NOTICE 'Created dept: Human Resources=%', v_dept_hr;
    ELSE
        RAISE NOTICE 'Reused dept:  Human Resources=%', v_dept_hr;
    END IF;

    -- Raw-SQL inserts bypass Odoo's parent_store, so backfill parent_path.
    -- All seeded departments are top-level, hence '<id>/' is the correct path.
    UPDATE hr_department SET parent_path = id::text || '/' WHERE parent_path IS NULL;

    -- ── Work Locations ────────────────────────────────────────────────
    -- Lagos, Nigeria → type=other (renders as Hybrid)
    SELECT id INTO v_loc_lagos FROM hr_work_location
    WHERE name = 'Lagos, Nigeria' AND company_id = v_company_id LIMIT 1;
    IF v_loc_lagos IS NULL THEN
        INSERT INTO hr_work_location(name, location_type, address_id, company_id, active, create_uid, write_uid, create_date, write_date)
        VALUES ('Lagos, Nigeria', 'other', v_address_id, v_company_id, true, v_admin_uid, v_admin_uid, NOW(), NOW())
        RETURNING id INTO v_loc_lagos;
    END IF;

    -- HQ New York → type=office (renders as Office)
    SELECT id INTO v_loc_nyc FROM hr_work_location
    WHERE name = 'HQ New York' AND company_id = v_company_id LIMIT 1;
    IF v_loc_nyc IS NULL THEN
        INSERT INTO hr_work_location(name, location_type, address_id, company_id, active, create_uid, write_uid, create_date, write_date)
        VALUES ('HQ New York', 'office', v_address_id, v_company_id, true, v_admin_uid, v_admin_uid, NOW(), NOW())
        RETURNING id INTO v_loc_nyc;
    END IF;

    -- Lagos HQ → type=other (renders as Hybrid)
    SELECT id INTO v_loc_lagoshq FROM hr_work_location
    WHERE name = 'Lagos HQ' AND company_id = v_company_id LIMIT 1;
    IF v_loc_lagoshq IS NULL THEN
        INSERT INTO hr_work_location(name, location_type, address_id, company_id, active, create_uid, write_uid, create_date, write_date)
        VALUES ('Lagos HQ', 'other', v_address_id, v_company_id, true, v_admin_uid, v_admin_uid, NOW(), NOW())
        RETURNING id INTO v_loc_lagoshq;
    END IF;

    -- San Francisco Office → type=other (spec shows Hybrid for Michael Chen)
    SELECT id INTO v_loc_sf FROM hr_work_location
    WHERE name = 'San Francisco Office' AND company_id = v_company_id LIMIT 1;
    IF v_loc_sf IS NULL THEN
        INSERT INTO hr_work_location(name, location_type, address_id, company_id, active, create_uid, write_uid, create_date, write_date)
        VALUES ('San Francisco Office', 'other', v_address_id, v_company_id, true, v_admin_uid, v_admin_uid, NOW(), NOW())
        RETURNING id INTO v_loc_sf;
    END IF;

    -- Abuja, Nigeria → type=other (renders as Hybrid)
    SELECT id INTO v_loc_abuja FROM hr_work_location
    WHERE name = 'Abuja, Nigeria' AND company_id = v_company_id LIMIT 1;
    IF v_loc_abuja IS NULL THEN
        INSERT INTO hr_work_location(name, location_type, address_id, company_id, active, create_uid, write_uid, create_date, write_date)
        VALUES ('Abuja, Nigeria', 'other', v_address_id, v_company_id, true, v_admin_uid, v_admin_uid, NOW(), NOW())
        RETURNING id INTO v_loc_abuja;
    END IF;

    RAISE NOTICE 'Work locations: lagos=% nyc=% lagoshq=% sf=% abuja=%',
        v_loc_lagos, v_loc_nyc, v_loc_lagoshq, v_loc_sf, v_loc_abuja;

    -- ── Employees ─────────────────────────────────────────────────────
    -- Insertion order: Sarah first (no manager), then direct reports,
    -- then their reports — so parent_id FKs are always valid.
    --
    -- Each employee needs:
    --   1. A row in resource_resource (holds the name + calendar)
    --   2. A row in hr_employee      (references the resource)

    -- ─────────────────────────────────────────────────────────────────
    -- 1. Sarah Johnson — VP of Human Resources — HQ New York
    --    Lifecycle: Active   Tenure: 7y 5m   Manager: CEO (no parent)
    -- ─────────────────────────────────────────────────────────────────
    INSERT INTO resource_resource(name, resource_type, company_id, calendar_id, active, tz,
                                  time_efficiency,
                                  create_uid, write_uid, create_date, write_date)
    VALUES ('Sarah Johnson', 'user', v_company_id, v_calendar_id, true, 'UTC', 100,
            v_admin_uid, v_admin_uid, NOW(), NOW())
    RETURNING id INTO v_res_sarah;

    INSERT INTO hr_employee(name, resource_id, company_id, active,
                            job_title, department_id, work_location_id,
                            barcode, employee_type, gender, work_phone, mobile_phone,
                            create_uid, write_uid, create_date, write_date)
    VALUES ('Sarah Johnson', v_res_sarah, v_company_id, true,
            'VP of Human Resources', v_dept_hr, v_loc_nyc,
            'EMP-2019-0001', 'employee', 'female', '+1 (212) 555-0147', '+1 (212) 555-0147',
            v_admin_uid, v_admin_uid, NOW(), NOW())
    RETURNING id INTO v_emp_sarah;

    -- ─────────────────────────────────────────────────────────────────
    -- 2. David Park — Chief Financial Officer — HQ New York
    --    Lifecycle: Active   Tenure: 7y 12m   Manager: Sarah Johnson
    -- ─────────────────────────────────────────────────────────────────
    INSERT INTO resource_resource(name, resource_type, company_id, calendar_id, active, tz,
                                  time_efficiency,
                                  create_uid, write_uid, create_date, write_date)
    VALUES ('David Park', 'user', v_company_id, v_calendar_id, true, 'UTC', 100,
            v_admin_uid, v_admin_uid, NOW(), NOW())
    RETURNING id INTO v_res_david;

    INSERT INTO hr_employee(name, resource_id, company_id, active,
                            job_title, department_id, work_location_id, parent_id,
                            barcode, employee_type, gender, work_phone, mobile_phone,
                            create_uid, write_uid, create_date, write_date)
    VALUES ('David Park', v_res_david, v_company_id, true,
            'Chief Financial Officer', v_dept_finance, v_loc_nyc, v_emp_sarah,
            'EMP-2018-0004', 'employee', 'male', '+1 (212) 555-0163', '+1 (212) 555-0163',
            v_admin_uid, v_admin_uid, NOW(), NOW())
    RETURNING id INTO v_emp_david;

    -- ─────────────────────────────────────────────────────────────────
    -- 3. Michael Chen — Engineering Director — San Francisco Office
    --    Lifecycle: Active   Tenure: 6y 2m   Manager: Sarah Johnson
    -- ─────────────────────────────────────────────────────────────────
    INSERT INTO resource_resource(name, resource_type, company_id, calendar_id, active, tz,
                                  time_efficiency,
                                  create_uid, write_uid, create_date, write_date)
    VALUES ('Michael Chen', 'user', v_company_id, v_calendar_id, true, 'UTC', 100,
            v_admin_uid, v_admin_uid, NOW(), NOW())
    RETURNING id INTO v_res_michael;

    INSERT INTO hr_employee(name, resource_id, company_id, active,
                            job_title, department_id, work_location_id, parent_id,
                            barcode, employee_type, gender, work_phone, mobile_phone,
                            create_uid, write_uid, create_date, write_date)
    VALUES ('Michael Chen', v_res_michael, v_company_id, true,
            'Engineering Director', v_dept_eng, v_loc_sf, v_emp_sarah,
            'EMP-2020-0002', 'employee', 'male', '+1 (415) 555-0192', '+1 (415) 555-0192',
            v_admin_uid, v_admin_uid, NOW(), NOW())
    RETURNING id INTO v_emp_michael;

    -- ─────────────────────────────────────────────────────────────────
    -- 4. Liam Torres — HR Business Partner — HQ New York
    --    Lifecycle: PROBATION   Tenure: 1y 6m   Manager: Sarah Johnson
    --    (probation triggered by trial_date_end in future on contract)
    -- ─────────────────────────────────────────────────────────────────
    INSERT INTO resource_resource(name, resource_type, company_id, calendar_id, active, tz,
                                  time_efficiency,
                                  create_uid, write_uid, create_date, write_date)
    VALUES ('Liam Torres', 'user', v_company_id, v_calendar_id, true, 'UTC', 100,
            v_admin_uid, v_admin_uid, NOW(), NOW())
    RETURNING id INTO v_res_liam;

    INSERT INTO hr_employee(name, resource_id, company_id, active,
                            job_title, department_id, work_location_id, parent_id,
                            barcode, employee_type, gender, work_phone, mobile_phone,
                            create_uid, write_uid, create_date, write_date)
    VALUES ('Liam Torres', v_res_liam, v_company_id, true,
            'HR Business Partner', v_dept_hr, v_loc_nyc, v_emp_sarah,
            'EMP-2025-0005', 'employee', 'male', '+1 (646) 555-0172', '+1 (646) 555-0172',
            v_admin_uid, v_admin_uid, NOW(), NOW())
    RETURNING id INTO v_emp_liam;

    -- ─────────────────────────────────────────────────────────────────
    -- 5. Emma Williams — Senior Data Analyst — Lagos HQ
    --    Lifecycle: Active   Tenure: 5y 5m   Manager: Michael Chen
    -- ─────────────────────────────────────────────────────────────────
    INSERT INTO resource_resource(name, resource_type, company_id, calendar_id, active, tz,
                                  time_efficiency,
                                  create_uid, write_uid, create_date, write_date)
    VALUES ('Emma Williams', 'user', v_company_id, v_calendar_id, true, 'UTC', 100,
            v_admin_uid, v_admin_uid, NOW(), NOW())
    RETURNING id INTO v_res_emma;

    INSERT INTO hr_employee(name, resource_id, company_id, active,
                            job_title, department_id, work_location_id, parent_id,
                            barcode, employee_type, gender, work_phone, mobile_phone,
                            create_uid, write_uid, create_date, write_date)
    VALUES ('Emma Williams', v_res_emma, v_company_id, true,
            'Senior Data Analyst', v_dept_eng, v_loc_lagoshq, v_emp_michael,
            'EMP-2021-0003', 'employee', 'female', '+234 803 456 7890', '+234 803 456 7890',
            v_admin_uid, v_admin_uid, NOW(), NOW())
    RETURNING id INTO v_emp_emma;

    -- ─────────────────────────────────────────────────────────────────
    -- 6. Raj Mehta — Backend Engineer — Abuja, Nigeria
    --    Lifecycle: EXITING   Tenure: 2y 11m   Manager: Michael Chen
    --    (exiting triggered by contract date_end within 60 days)
    -- ─────────────────────────────────────────────────────────────────
    INSERT INTO resource_resource(name, resource_type, company_id, calendar_id, active, tz,
                                  time_efficiency,
                                  create_uid, write_uid, create_date, write_date)
    VALUES ('Raj Mehta', 'user', v_company_id, v_calendar_id, true, 'UTC', 100,
            v_admin_uid, v_admin_uid, NOW(), NOW())
    RETURNING id INTO v_res_raj;

    INSERT INTO hr_employee(name, resource_id, company_id, active,
                            job_title, department_id, work_location_id, parent_id,
                            barcode, employee_type, gender, work_phone, mobile_phone,
                            create_uid, write_uid, create_date, write_date)
    VALUES ('Raj Mehta', v_res_raj, v_company_id, true,
            'Backend Engineer', v_dept_eng, v_loc_abuja, v_emp_michael,
            'EMP-WL-012', 'employee', 'male', '+234 802 345 6789', '+234 802 345 6789',
            v_admin_uid, v_admin_uid, NOW(), NOW())
    RETURNING id INTO v_emp_raj;

    -- ─────────────────────────────────────────────────────────────────
    -- 7. Amira Suleiman — Product Designer — Lagos, Nigeria
    --    Lifecycle: Active   Tenure: 4y 2m   Manager: Liam Torres
    -- ─────────────────────────────────────────────────────────────────
    INSERT INTO resource_resource(name, resource_type, company_id, calendar_id, active, tz,
                                  time_efficiency,
                                  create_uid, write_uid, create_date, write_date)
    VALUES ('Amira Suleiman', 'user', v_company_id, v_calendar_id, true, 'UTC', 100,
            v_admin_uid, v_admin_uid, NOW(), NOW())
    RETURNING id INTO v_res_amira;

    INSERT INTO hr_employee(name, resource_id, company_id, active,
                            job_title, department_id, work_location_id, parent_id,
                            barcode, employee_type, gender, work_phone, mobile_phone,
                            create_uid, write_uid, create_date, write_date)
    VALUES ('Amira Suleiman', v_res_amira, v_company_id, true,
            'Product Designer', v_dept_design, v_loc_lagos, v_emp_liam,
            'EMP-WL-005', 'employee', 'female', '+234 803 456 7890', '+234 803 456 7890',
            v_admin_uid, v_admin_uid, NOW(), NOW())
    RETURNING id INTO v_emp_amira;

    RAISE NOTICE 'Employees: Sarah=% David=% Michael=% Liam=% Emma=% Raj=% Amira=%',
        v_emp_sarah, v_emp_david, v_emp_michael, v_emp_liam,
        v_emp_emma, v_emp_raj, v_emp_amira;

    -- ── Contracts ─────────────────────────────────────────────────────
    -- Contract date_start values are computed to produce the exact
    -- tenure labels in the UI when viewed on 2026-08-04.
    --
    -- Our tenure formula:  years = delta_days // 365
    --                      months = (delta_days % 365) // 30
    --
    -- NOTE: If hr_payroll is installed and requires structure_type_id,
    --       add it to each INSERT:
    --         SELECT id FROM hr_payroll_structure_type LIMIT 1
    --       and include  structure_type_id = <that id>  in the columns.

    -- Sarah Johnson  7y 5m  → start 2019-03-01   (Active, no end date)
    INSERT INTO hr_contract(name, employee_id, company_id,
                            date_start, state, wage, active, work_entry_source,
                            date_generated_from, date_generated_to,
                            create_uid, write_uid, create_date, write_date)
    VALUES ('SJ-2019-CONTRACT', v_emp_sarah, v_company_id,
            '2019-03-01',             'open', 5000, true, 'calendar',
            NOW(), NOW(),
            v_admin_uid, v_admin_uid, NOW(), NOW());

    -- David Park     7y 12m → start 2018-08-10   (Active, no end date)
    INSERT INTO hr_contract(name, employee_id, company_id,
                            date_start, state, wage, active, work_entry_source,
                            date_generated_from, date_generated_to,
                            create_uid, write_uid, create_date, write_date)
    VALUES ('DP-2018-CONTRACT', v_emp_david, v_company_id,
            '2018-08-10',             'open', 5000, true, 'calendar',
            NOW(), NOW(),
            v_admin_uid, v_admin_uid, NOW(), NOW());

    -- Michael Chen   6y 2m  → start 2020-06-01   (Active, no end date)
    INSERT INTO hr_contract(name, employee_id, company_id,
                            date_start, state, wage, active, work_entry_source,
                            date_generated_from, date_generated_to,
                            create_uid, write_uid, create_date, write_date)
    VALUES ('MC-2020-CONTRACT', v_emp_michael, v_company_id,
            '2020-06-01',             'open', 5000, true, 'calendar',
            NOW(), NOW(),
            v_admin_uid, v_admin_uid, NOW(), NOW());

    -- Liam Torres    1y 6m  → start 2025-02-01   (PROBATION: trial ends 2026-11-01)
    INSERT INTO hr_contract(name, employee_id, company_id,
                            date_start, trial_date_end, state, wage, active, work_entry_source,
                            date_generated_from, date_generated_to,
                            create_uid, write_uid, create_date, write_date)
    VALUES ('LT-2025-CONTRACT', v_emp_liam, v_company_id,
            '2025-02-01', '2026-11-01',             'open', 5000, true, 'calendar',
            NOW(), NOW(),
            v_admin_uid, v_admin_uid, NOW(), NOW());

    -- Emma Williams  5y 5m  → start 2021-03-01   (Active, no end date)
    INSERT INTO hr_contract(name, employee_id, company_id,
                            date_start, state, wage, active, work_entry_source,
                            date_generated_from, date_generated_to,
                            create_uid, write_uid, create_date, write_date)
    VALUES ('EW-2021-CONTRACT', v_emp_emma, v_company_id,
            '2021-03-01',             'open', 5000, true, 'calendar',
            NOW(), NOW(),
            v_admin_uid, v_admin_uid, NOW(), NOW());

    -- Raj Mehta      2y 11m → start 2023-09-01   (EXITING: contract ends 2026-09-20)
    INSERT INTO hr_contract(name, employee_id, company_id,
                            date_start, date_end, state, wage, active, work_entry_source,
                            date_generated_from, date_generated_to,
                            create_uid, write_uid, create_date, write_date)
    VALUES ('RM-2023-CONTRACT', v_emp_raj, v_company_id,
            '2023-09-01', '2026-09-20',             'open', 5000, true, 'calendar',
            NOW(), NOW(),
            v_admin_uid, v_admin_uid, NOW(), NOW());

    -- Amira Suleiman 4y 2m  → start 2022-06-01   (Active, no end date)
    INSERT INTO hr_contract(name, employee_id, company_id,
                            date_start, state, wage, active, work_entry_source,
                            date_generated_from, date_generated_to,
                            create_uid, write_uid, create_date, write_date)
    VALUES ('AS-2022-CONTRACT', v_emp_amira, v_company_id,
            '2022-06-01',             'open', 5000, true, 'calendar',
            NOW(), NOW(),
            v_admin_uid, v_admin_uid, NOW(), NOW());

    RAISE NOTICE '';
    RAISE NOTICE '✓ Seed complete! 7 employees + 7 contracts inserted.';
    RAISE NOTICE '  Refresh the browser and open Staff Directory to verify.';

EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Seed failed: % (SQLSTATE: %)', SQLERRM, SQLSTATE;

END $$;
