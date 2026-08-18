# Developer guide

## Architecture

The addon has three layers:

1. Standard Odoo business models hold workflow and financial rules.
2. The non-persistent `hr.expense.app` service exposes role-filtered OWL data
   and actions.
3. The OWL client renders the application shell, domain pages, modals, charts,
   and native-view hand-offs.

Key locations:

| Area | Location |
|---|---|
| Claims and payments | `models/hr_claim.py`, `models/hr_claim_payment.py` |
| Requests and advances | `models/hr_expense_request.py`, `models/hr_cash_advance.py` |
| Approval routing | `models/hr_expense_approval.py` |
| Accounting integration | `models/hr_expense_accounting.py` |
| Financial domains | `models/hr_petty_cash.py`, `models/hr_expense_budget.py`, `models/hr_expense_vendor.py` |
| OWL service | `models/hr_expense_app*.py` |
| Client logic | `static/src/js/expense_app*.js` |
| Client templates | `static/src/xml/expense_*.xml` |

## Service contract

The browser calls only `hr.expense.app`. Bootstrap publishes the available
modules and versioned action schemas. Every page response is normalized by
`page_payload()`.

See [APP_CONTRACT.md](../APP_CONTRACT.md) before changing RPC fields.

## Security conventions

- Use ACLs and record rules for model access.
- Recheck roles and record ownership in workflow methods.
- Use `hr.expense.security.mixin` for shared role checks.
- Respect `company_id`, `check_company`, and the active company.
- Do not rely on OWL visibility for authorization.
- Do not use `sudo()` to bypass business authorization. Restrict it to trusted
  configuration reads or controlled system writes.

## Accounting conventions

All financial entries use Odoo `account.move`. Do not introduce a separate
ledger. Use `hr.expense.gl.map` to resolve journals and accounts, and retain the
expense source fields on generated moves.

## Add a page

1. Add the module/page metadata to the bootstrap registry.
2. Add or update the server page loader.
3. Register presentation metadata in `expense_app_registry.js`.
4. Add the named OWL template to the appropriate domain template file.
5. Cover the payload and browser route in tests.

## Add an OWL action

1. Define its allowed, required, and default fields in
   `APP_ACTION_CONTRACTS`.
2. Validate values at the service boundary.
3. Call a business-model method that enforces authorization and state.
4. Update the matching modal template and tests.

## Tests

Run the full suite:

```bash
odoo-bin -d <test_database> -u hr_expense_management \
  --test-enable --test-tags /hr_expense_management --stop-after-init
```

The suite covers workflow, security, accounting, budgets, petty cash, service
payloads, asset compilation, and authenticated OWL navigation.

Use a free HTTP port for `HttpCase` when another Odoo server is running.

## Versions and migrations

Increment the manifest version for releases. Add a migration when stored data,
model names, external identifiers, or accounting structures change. Asset-only
and documentation-only changes do not require data migration.
