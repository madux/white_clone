# Upgrade from `hr_claims`

Odoo 17 already provides the official `hr_expense` addon. This custom Expense
Management ERP therefore uses the collision-safe technical name
`hr_expense_management`.

For a database where the former `hr_claims` addon is installed:

1. Stop all Odoo workers that use the database.
2. Back up the database.
3. Deploy this renamed addon directory and remove the former `hr_claims`
   directory from every add-ons path.
4. Rename the installed module and its external-ID namespace:

   ```bash
   psql -d DATABASE_NAME \
     -f custom_addons/white_clone/hr_expense_management/scripts/rename_from_hr_claims.sql
   ```

5. Refresh the apps list and upgrade the renamed module:

   ```bash
   ./venv/bin/python odoo-bin -c odoo.conf -d DATABASE_NAME \
     -u hr_expense_management --stop-after-init
   ```

The SQL migration is transactional and idempotent. It refuses to run if both
technical module records already exist, preventing accidental namespace merges.
It preserves model tables, business records, user-role assignments, and record
references. Only the module registry name and renamed external identifiers
change.
