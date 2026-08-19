# Administrator guide

## Prerequisites

Before configuration, confirm that:

- the company currency and chart of accounts are correct;
- each user is linked to an employee in the active company; and
- managers are assigned on employee records where manager approval is used.

## Assign roles

Assign the narrowest suitable Expense Management group:

- **Employee** for personal submissions;
- **Manager** for approvals, teams, and management reports;
- **Finance** for payments and financial workspaces; or
- **Administrator** for full configuration and audit access.

Odoo ACLs, record rules, company checks, and server-side workflow checks enforce
access. Hidden buttons are not the security boundary.

## Configure submissions

1. Create claim categories and claim types.
2. Set amount limits, receipt requirements, eligibility, and reimbursement
   behavior on each claim type.
3. Create request types and identify those that create cash advances.
4. Add submission, approval, payment, or cut-off windows where required.

## Configure approval routing

Approval rules match by company, target, department, and amount range. The
first matching rule is used.

Each rule contains approval levels:

- increasing sequence values create sequential levels;
- equal sequence values create a parallel level; and
- approvers may be the employee's manager, a named user, or a group.

Keep rules non-overlapping and ensure every active rule has at least one level.

## Configure accounting

Expense Management uses Odoo Community Accounting directly.

1. Create or confirm a miscellaneous journal.
2. Confirm the required debit and credit accounts.
3. Create GL mappings for claims, payments, advances, petty cash, or vendor
   expenses.
4. Add category-specific mappings before general mappings when both are used.

Generated entries retain the source model, record, and reference. Posted Odoo
journal entries remain governed by standard accounting controls.

## Configure finance operations

- Create payment methods and mark those that support batches.
- Open expense periods and set submission, approval, payment, and GL cut-offs.
- Create department budgets and budget lines.
- Create petty-cash funds with a custodian, limit, and replenishment threshold.
- Maintain vendor categories and payment terms.

Closing a period blocks the corresponding dated action. Reopening requires an
administrator reason and is audited.

## Audit and retention

Claim audit events and cross-module audit events are immutable. Review them in
**Audit**. Chatter records operational messages on tracked business records.

Attachments are private and follow Odoo access rules. Apply the organization's
normal database, filestore, backup, and retention policies.

## Email and integrations

Scheduled reports use Odoo mail and require recipients with email addresses.
Integration records must not contain provider secrets. Install a dedicated
adapter before enabling any external transfer.

## Upgrades

Back up the database and filestore before upgrading. Follow [UPGRADE.md](../UPGRADE.md)
for version-specific instructions.
