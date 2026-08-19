# Expense Management

Expense Management is an Odoo 17 Community addon for employee claims,
requests, cash advances, payments, petty cash, vendors, budgets, reporting, and
audit.

The primary interface is an OWL application. Native Odoo views remain
available for detailed administration.

## Requirements

- Odoo 17 Community Edition
- Odoo addons: `hr`, `mail`, `web`, and `account`
- Every operational user must be linked to an employee in the active company

## Roles

| Role | Main responsibilities |
|---|---|
| Employee | Submit claims and requests; review personal payments and advances |
| Manager | Review claims and requests; view team and management reports |
| Finance | Process payments; manage advances, petty cash, accounting, vendors, and budgets |
| Administrator | Configure the module, roles, policies, audit, and appearance |

The Administrator role includes Manager and Finance access and is treated as
privileged across the application.

## Installation

1. Add this repository to the Odoo addons path.
2. Update the Apps list.
3. Install **Expense Management** (`hr_expense_management`).
4. Open **Expense Management → Setup → Onboarding**.

For command-line installations:

```bash
odoo-bin -d <database> -i hr_expense_management --stop-after-init
```

## Initial setup

Configure the module in this order:

1. Company, currency, employees, and user roles.
2. Claim categories, claim types, request types, and processing windows.
3. Approval rules and approval levels.
4. Odoo journals, accounts, and expense accounting mappings.
5. Payment methods, expense periods, budgets, and petty-cash funds.

## Documentation

- [User guide](docs/USER_GUIDE.md)
- [Administrator guide](docs/ADMIN_GUIDE.md)
- [Developer guide](docs/DEVELOPMENT.md)
- [Upgrade guide](UPGRADE.md)
- [OWL RPC contract](APP_CONTRACT.md)

## External integrations

Integration pages store non-secret configuration and connection status only.
Bank, payroll, payment-provider, accounting, and storage transfers require a
separately installed and authorized adapter.

## Verification

Run the module tests with:

```bash
odoo-bin -d <test_database> -u hr_expense_management \
  --test-enable --test-tags /hr_expense_management --stop-after-init
```
