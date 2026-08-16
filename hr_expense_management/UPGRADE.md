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

## Upgrade to 17.0.8.0.0 (Community Accounting integration)

Back up the database and run the normal module upgrade command above. The
versioned migration automatically:

- installs the Community `account` dependency;
- converts legacy expense accounts to `account.account` records;
- remaps expense mappings, vendor defaults and budget lines;
- converts legacy expense journals and lines to traceable `account.move`
  entries while preserving draft/posted state; and
- removes the retired custom account/journal tables after successful copying.

The OWL application continues to open through the same client action, but its
RPC gateway is now `hr.expense.app`; no client bookmarks or menus change.

## Upgrade to 17.0.9.0.0 (application contract refactor)

Run the normal module upgrade command. This release has no data migration. It
adds a versioned OWL page/action contract, a registry-driven presentation
configuration, shared expense-role authorization helpers, and domain-focused
service extensions without changing business records, menus, RPC model names,
or the visible workflow.
