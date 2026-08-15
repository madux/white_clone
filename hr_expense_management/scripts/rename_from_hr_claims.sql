BEGIN;

DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM ir_module_module WHERE name = 'hr_expense_management')
       AND EXISTS (SELECT 1 FROM ir_module_module WHERE name = 'hr_claims') THEN
        RAISE EXCEPTION 'Both hr_claims and hr_expense_management exist; resolve the duplicate module records before renaming';
    END IF;

    IF EXISTS (SELECT 1 FROM ir_module_module WHERE name = 'hr_claims') THEN
        -- Preserve records whose XML identifiers changed with the broader product scope.
        UPDATE ir_model_data
           SET name = replace(name, 'hr_claims', 'hr_expense_management')
         WHERE module = 'hr_claims'
           AND name LIKE '%hr_claims%';

        UPDATE ir_model_data
           SET name = replace(name, 'group_hr_claim_', 'group_hr_expense_')
         WHERE module = 'hr_claims'
           AND name LIKE 'group_hr_claim_%';

        UPDATE ir_model_data
           SET module = 'hr_expense_management'
         WHERE module = 'hr_claims';

        UPDATE ir_module_module
           SET name = 'hr_expense_management'
         WHERE name = 'hr_claims';
    END IF;
END
$migration$;

COMMIT;
