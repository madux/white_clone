# Expense Management ERP — Corrected Requirements and Implementation Plan

Last corrected: 2026-08-15

## 1. Scope correction

`hr_expense_management` must implement the complete expense-management ERP shown at
<https://stamp-menus-90926699.figma.site/>, not only the claim header and
approval subset. The product scope is the whole prototype.

The technical name is changed from `hr_claims` to
`hr_expense_management`. Odoo Community already ships an official addon named
`hr_expense`, so using that exact name would create an add-ons-path collision.
Application-wide roles use `group_hr_expense_*`; claim-specific business models
retain accurate `hr.claim.*` names. The product and addon namespace now cover
the complete expense-management scope.

The previous statement that Requests, Advances, Petty Cash, Vendors, Budgets,
Accounts, and related screens were merely future integrations was incorrect and
is revoked. Those areas are first-class requirements because the prototype gives
each one its own navigation, records, workflows, KPIs, and role-dependent
actions.

The primary user experience must be a responsive OWL application that follows
the prototype's application shell, cards, tables, kanban/card switches, status
badges, drawers/modals, multi-step creation flows, filters, charts, and role-aware
navigation. Native Odoo views remain useful fallbacks for administration and
power users; they are not the primary experience.

## 2. Audited prototype inventory

The corrected audit covered the following top-level areas and subpages.

1. **Dashboard:** overview, quick actions, recent activity, tasks, announcements,
   KPI drill-downs, global search, messages, and documents.
2. **Setup:** progress, company configuration, policy foundations, onboarding.
3. **Claims:** claim data (table/compact/kanban), claim types/categories, windows,
   assignments, employee claim creation, review drawer, receipts, approval,
   rejection, return, appeal, and payment hand-off.
4. **Requests:** data (table/card), request types, history, analytics, and new
   pre-approval/cash-advance request flow.
5. **Advances:** outstanding balances, issue advance, retirement, age analysis,
   and write-offs.
6. **Workflow:** combined pending queue, approved/rejected history, automation
   rules, claim approval routing, request approval routing, and analytics.
7. **Payments:** payables queue, receivables/aging, individual and batch
   processing, payment history, methods, and reports.
8. **Petty Cash:** funds/accounts, transactions, expense recording,
   reconciliation, replenishment, and custodians.
9. **Teams:** members, departments, roles and permissions, team analytics, and
   team settings.
10. **Accounts:** chart of accounts, account tree, GL mapping, journal entries,
    and accounting settings.
11. **Vendors:** directory, categories, vendor-claim links, payment terms, and
    analytics.
12. **Budget:** overview, department budgets, budget-versus-actual, and fiscal
    periods/cut-offs.
13. **Reports:** financial, claims, employees, custom reports, and scheduled
    reports.
14. **Audit:** activity log, user actions, system/configuration changes, advanced
    search, and filters.
15. **Settings and Theme:** organization/security/workflow/email/integration
    configuration and branding/theme preferences with live preview.

## 3. OWL application architecture

### 3.1 Client action shell

The main menu opens one OWL client action, `hr_expense_management.expense_app`, containing:

- Collapsible/reorderable module sidebar with favorites and search.
- Header with company, current role, global search, notifications, shortcuts,
  messages, and document access.
- Breadcrumb/history strip and page-specific subnavigation.
- Responsive content region with reusable KPI cards, filters, data tables,
  record cards, status badges, pagination, empty/loading/error states, drawers,
  modals, and multi-step wizards.
- Role-aware module and action visibility driven by server capabilities, never
  by hard-coded client assumptions.
- Odoo services (`orm`, `action`, `notification`, `dialog`, `user`) for all data
  and actions. The client must not duplicate server authorization.

### 3.2 OWL composition

- `ExpenseApp` owns the application shell, route state and server interactions;
  `ExpenseKpiCard` is the repeated typed KPI component.
- Sidebar, header, subnavigation, status badges, data tables, card grids, view
  switchers, filters, pagination, empty/loading/error states, record drawer,
  dialogs, step wizard and attachments are OWL-rendered template regions driven
  by the same reactive state rather than independent legacy widgets.
- Chart.js has deterministic lifecycle cleanup on navigation and unmount.
- Feature pages cover Dashboard, Claims, Requests, Advances, Workflow,
  Payments, Petty Cash, Teams, Accounts, Vendors, Budget, Reports, Audit,
  Settings, and Theme.

### 3.3 Server gateway

A Community-safe abstract/service model exposes role-filtered payloads and
small action methods to the OWL client. It uses normal ORM models and record
rules; no raw SQL or client-trusted domains are security boundaries.

## 4. Data model

All business models include `company_id`, currency where monetary, chatter or
structured audit where operationally important, and multi-company rules.

### 4.1 Claims (existing, expanded)

- `hr.claim.category`: category identity, icon/color, sequence, active.
- `hr.claim.type`: category, fixed/open amount, limits, reimbursable flag,
  receipt policy/threshold, eligibility, default payment method, GL mapping,
  approval routing, windows.
- `hr.claim.window`: submission/approval/payment/cut-off template and dated
  boundaries.
- `hr.claim.type.assignment`: explicit claim-type-to-window/employee/department
  assignment with effective dates.
- `hr.claim`: employee, type, money type, purpose, period, line items,
  attachments, amount, approval state/history, advance retirement, payable,
  payment and journal references.
- `hr.claim.line`: date, category, description, quantity/rate/amount, vendor,
  receipt, tax and GL references.
- `hr.claim.payment`: reimbursement payment register.
- `hr.claim.audit`: immutable cross-workflow claim audit.

### 4.2 Requests

- `hr.expense.request.type`: request name/code, purpose class, amount limits,
  whether approval creates an advance, active, routing defaults.
- `hr.expense.request`: sequence, employee, type, purpose, amount, needed date,
  attachments, state, approval metadata, linked advance and audit events.

Relationships: a request may create one cash advance; it may also be referenced
by later claims. Request types link to approval rules.

### 4.3 Cash advances

- `hr.cash.advance`: approved request/employee, issued amount/date/method,
  retirement deadline, outstanding amount, aging bracket, state, payment and
  accounting references.
- `hr.cash.advance.retirement`: advance, claim or manual settlement, amount,
  date, reference, state.
- `hr.cash.advance.writeoff`: advance, reason, approval, amount, date, journal.

Outstanding equals issued minus posted retirements/write-offs. Claim approval
may automatically retire selected advances up to eligible claim value.

### 4.4 Approval engine

- `hr.expense.approval.rule`: claim/request target, amount bounds, department,
  ordered/parallel levels, sequence and active state. Advance write-offs and
  petty replenishments use their dedicated independently authorized workflows.
- `hr.expense.approval.rule.line`: ordered level, approver group/user/manager,
  sequential or parallel behavior.
- `hr.expense.approval.step`: runtime approval instance, source reference,
  level, approver, decision, comment, timestamps.

### 4.5 Payments

- `hr.expense.payment.method`: bank/payroll/cash/cheque configuration, active,
  batch support.
- `hr.expense.payment.batch`: selected payables, total, method, reference,
  processing state and result log.
- Existing `hr.claim.payment` links to an optional batch.
- Employee bank details use Community `res.partner.bank` linked through the
  employee work contact/user partner, with an explicit preferred account.

### 4.6 Petty cash

- `hr.petty.cash.fund`: code, name, location/branch, custodian employee,
  currency, maximum fund, minimum/replenishment threshold, current balance,
  account, active, last reconciliation.
- `hr.petty.cash.transaction`: sequence, fund, type (opening, expense,
  replenishment, adjustment, closure), date, payee/vendor, category, amount,
  receipt, state, balance-after, GL/journal reference.
- `hr.petty.cash.reconciliation`: period, fund, system balance, physical count,
  variance, status, reconciler, adjustment transaction and notes.
- `hr.petty.cash.replenishment`: fund, requested/approved/issued amounts,
  requester, approver, justification, urgency, dates, reference, state.

### 4.7 Odoo Community Accounting

The module must use the Community `account` addon and must not maintain a
parallel ledger:

- `account.account` is the only chart of accounts.
- `account.journal` supplies the miscellaneous journal used by each mapping.
- `hr.expense.gl.map` maps an expense source/category to a standard journal,
  debit account and credit account.
- `account.move` and `account.move.line` hold every generated journal entry;
  source model, record ID and reference fields provide traceability back to the
  expense workflow.

Claim approval creates a balanced draft move. Completed payments, issued cash
advances and posted petty-cash expenses create balanced posted moves according
to configuration. Vendors and budget lines reference the same
`account.account` records.

### 4.8 Vendors

- Extend `res.partner` with expense-vendor flag, vendor code/category, rating,
  payment term, default expense account, tax data, active status and payment
  details.
- `hr.expense.vendor.category`: name, tax rate, default GL account.
- `hr.expense.payment.term`: due days and early-payment discount.
- Claims and petty-cash transactions link to vendors.

### 4.9 Budgets and periods

- `hr.expense.budget`: fiscal period/company, department/cost center, state.
- `hr.expense.budget.line`: category/GL, approved, forecast, committed and
  actual values, thresholds and computed availability/status.
- `hr.expense.period`: start/end, submission/approval/payment/GL cut-offs,
  open/closed/future state and controlled reopen audit.

Requests create commitments; approved/posted expenses create actuals and
release commitments.

### 4.10 Configuration, reports, and audit

- `hr.expense.settings` values are stored on `res.company` and/or
  `ir.config_parameter` with Admin-only writes.
- `hr.expense.email.template` stores prototype notification templates and
  activation state; sending uses Community `mail.template` where configured.
- `hr.expense.integration` stores non-secret connection status/configuration
  metadata; real providers remain pluggable adapters.
- `hr.expense.theme` stores company branding/color/typography/layout choices.
- `hr.expense.custom.report` and `hr.expense.scheduled.report` store report
  definitions and delivery schedules. Scheduled delivery uses `ir.cron` and
  Community mail.
- `hr.expense.audit` is the immutable cross-module audit trail for user actions
  and system configuration changes.

## 5. Workflow/state machines

### Claims

```text
Draft -> Submitted -> Approved -> Paid
             |           |
             |           -> payment_state: Not Paid / Partial / Paid
             -> Returned -> Draft/Resubmitted
             -> Rejected -> Appealed -> Approved/Returned/Rejected
Draft/Returned -> Cancelled; Submitted/Appealed -> Withdrawn (cancelled + audit)
```

“In Approval” is represented by `submitted` or `appealed` on the claim header
plus the ordered runtime `hr.expense.approval.step` records.

### Requests

```text
Draft -> Submitted -> In Approval -> Approved -> Fulfilled/Advance Issued -> Closed
                    -> Returned -> Draft
                    -> Rejected
Draft/Submitted -> Cancelled/Withdrawn
```

### Advances

```text
Approved Request -> Issued -> Partially Retired -> Retired
                         |                     -> Written Off (approval required)
                         -> Overdue (derived from deadline)
```

### Payment batches

```text
Draft -> Validated -> Processing -> Completed
                  -> Failed/Partially Failed -> Retried or Cancelled
```

### Petty cash transactions

```text
Draft -> Pending Approval -> Approved -> Posted
                         -> Rejected
Reconciliation: Draft -> Counted -> Passed or Variance -> Adjusted/Closed
Replenishment: Draft -> Submitted -> Approved -> Issued or Rejected/Cancelled
```

### Budgets/periods

Budgets move Draft -> Approved -> Active -> Closed. Periods move Future -> Open
-> Closed; reopening requires Admin/Finance authority, a reason, and audit.

Every transition validates role, company, current state, amounts, periods,
receipts, budget, and accounting balance on the server.

## 6. Roles and security (Figma Roles page is authoritative)

| Role | Prototype permissions | Module enforcement |
|---|---|---|
| Employee | Submit Claims; View Own Claims; Create Requests | Own claims/requests/advances/payments; create and correct submissions; view own financial history; petty-cash access only when assigned custodian. |
| Manager | Approve Claims; Reject Claims; View Reports; Manage Team; View All Claims | Company-wide claim/request visibility; approval decisions; reports; team/department operational views; no payment execution or system configuration unless separately granted. |
| Finance | Process Payments; View All Claims; Generate Reports; View Reports | Company-wide expense visibility; payments/batches; advances; petty cash; Odoo journal entries; vendors; budgets/periods; reports; no claim/request approval unless a configured rule explicitly assigns the user. |
| Admin | Full System Access; User Management; Settings; Audit Trail Access | Full CRUD and workflow access across all module areas, role/configuration/theme/integration management, and complete audit visibility. |

Security implementation requirements:

- Four non-misleading Odoo groups with explicit ACLs; role implication must not
  accidentally widen permissions.
- Global allowed-company rules on all persistent models.
- Employee ownership/custodian rules; Manager and Finance company-wide rules
  only for the areas granted above.
- Server methods recheck capabilities for every workflow and batch action.
- Audit records are append-only to normal users and readable only as permitted.
- Secret integration credentials, if later added, must use system parameters and
  never be returned in OWL payloads.

## 7. Required OWL pages and visual behavior

Each audited subpage in section 2 is a real OWL screen. Required interaction
patterns include:

- KPI cards with drill-down domains.
- Search, status/date/type/department filters, sorting, pagination, and export.
- Table/compact/card/kanban switches where shown.
- Side drawer for claim/request/advance/payment/fund detail and timeline.
- A multi-step new-claim wizard plus focused OWL creation/configuration modals
  for requests, claim types, funds, petty expenses, reconciliation,
  replenishment, approval rules, vendors, budget lines and reports.
- Approve/reject/return/appeal/write-off/reconcile/issue/pay actions with reason
  capture and immediate refresh.
- Receipt/document upload through Odoo attachments.
- Responsive Bootstrap/Odoo styling matching the prototype's dense cards,
  rounded panels, pink/violet accents, colored status chips, and mobile stacking.
- Loading skeletons, permission-denied, empty, validation-error, and retry states.
- Native Odoo actions may be opened for advanced editing without abandoning the
  OWL shell's navigation context.

## 8. Dashboard and charts

Chart.js is required for:

- Overall and per-module status distributions.
- Monthly submitted/approved/paid claims trend using their respective event
  dates.
- Expense category and department spend.
- Request trend/type/status.
- Advance aging buckets and outstanding exposure.
- Approval throughput, SLA, escalation and decision rates.
- Payment aging, method mix, days-to-pay and batch outcomes.
- Petty-cash fund utilization, expense categories, reconciliation success and
  replenishment status.
- Team role/department distribution and employee financial exposure.
- Vendor spend, monthly trend and performance.
- Budget approved/committed/actual/available and variance.

All metrics use the same record-rule-filtered server data as their drill-down.

## 9. Community-only integration decisions

- No Enterprise-only model, field, view, widget, spreadsheet, dashboard, or
  accounting dependency is allowed; the Community `account` addon is required.
- Bank/NIBSS, Paystack, payroll, QuickBooks/Sage and cloud storage screens are
  implemented as configuration/status surfaces and adapter interfaces. They do
  not claim to transfer money or post externally without a provider module.
- Standard Odoo Community Accounting satisfies the Figma GL/journal behavior;
  external accounting synchronization is additive.
- Standard `mail`, `hr`, `web`, `account`, `base_setup`, and Community
  `res.partner.bank` capabilities are reused.

## 10. Assumptions and prototype gaps

1. The former `hr_claims` namespace is migrated to
   `hr_expense_management`; the displayed product name is **Expense
   Management**. The exact name `hr_expense` is reserved by Odoo's standard
   Expenses addon.
2. Some prototype subnavigation items visibly fail to change content
   (`Workflow > Analytics`, `Payments > Reports`, `Petty Cash > Custodians`) and
   the Admin/Employee demo toggle did not respond during the corrected audit.
   These are treated as prototype wiring defects; the named screens are still
   implemented from their surrounding labels and data domain.
3. Claims mix Pending, Pending Approval, and Under Review. The claim header uses
   Draft, Submitted, Returned, Approved, Rejected, Appealed, Paid and Cancelled.
   Runtime approval steps represent In Approval, `payment_state` represents
   partial payment, and withdrawal is retained as an audit event on cancellation.
4. The Admin **Create Claim** control appears inconsistent with the separate
   employee claim wizard and claim-type creation. The product exposes both
   **New Claim** and **New Claim Type** unambiguously.
5. Multi-level rules are implemented sequentially first. Parallel approval is
   represented in the model and UI but completes only when every required step
   at the level decides.
6. Accounting codes and example monetary values are seed/demo data, never
   hard-coded business logic. Company currency drives formatting.
7. Budget commitment is created from an approved request and actual spend from
   an approved claim or posted petty-cash expense. Manual budget adjustments
   require Finance/Admin and audit.
8. A petty-cash custodian can transact/reconcile only assigned funds; Finance
   and Admin retain company-wide oversight.
9. The Figma integrations are configuration concepts, not permission to send
   financial or personal data to third parties. Provider execution is inactive
   until separately configured and authorized.
10. Existing native claim views and tests remain supported while the OWL app is
    expanded; they are fallback/admin surfaces, not evidence that a Figma page
    is complete.

## 11. Corrected implementation phases

1. **Corrected audit and requirements**
   - Reopen progress, revoke the scope reduction, inventory all pages/flows,
     define full models/security/OWL architecture, checkpoint documentation.
2. **Shared OWL shell and server gateway**
   - Application shell, routing/state, reusable components, capability payload,
     loading/error states, role-aware navigation, theme tokens, and the
     dedicated `hr.expense.app` service model.
3. **Requests, advances, and approval engine**
   - Models, rules/steps, workflows, security, OWL pages/wizards, tests.
4. **Payments and petty cash**
   - Methods/batches, funds/transactions/reconciliation/replenishment,
     accounting effects, OWL pages/wizards, tests.
5. **Accounts, vendors, budgets, and periods**
   - Odoo Community Accounting integration, mappings/journals, vendor master,
     commitments/actuals, period cut-offs, OWL pages, tests.
6. **Teams, reports, audit, settings, and theme**
   - Operational team views, all charts/reports, audit search, settings,
     email/integration metadata, branding, scheduled reports.
7. **Polish and final verification**
   - Full upgrade and clean install, role/security regression, browser QA against
     every audited screen and workflow, corrected final review.

Each meaningful unit updates `PROGRESS.md`, passes an Odoo upgrade or clean
install appropriate to the phase, and receives a descriptive git checkpoint.

## 12. Corrected manual test checklist

### Installation and shell

- [x] Clean-install and upgrade `hr_expense_management` on Odoo 17 Community.
- [x] OWL app loads without client errors and restores navigation state.
- [x] Every sidebar module and audited subpage renders loading, populated and
  empty states responsively.

### Roles/security

- [x] Employee sees and mutates only own/custodian-authorized records.
- [x] Manager approves/rejects and manages team views but cannot pay or configure.
- [x] Finance processes payments/advances/petty cash/accounting/budgets but does
  not receive unrelated Admin rights.
- [x] Admin has full configuration and audit access.
- [x] Cross-company reads/writes and direct RPC bypass attempts are blocked.

### End-to-end workflows

- [x] Claim create -> receipt -> submit -> multi-level approve/return/reject/
  appeal -> partial/full payment -> journal and audit.
- [x] Request create -> approve -> fulfill or issue advance.
- [x] Advance issue -> partial retirement by claim -> retirement/write-off.
- [x] Payment queue -> individual and batch processing -> history/aging.
- [x] Petty fund -> expense -> approval/posting -> reconciliation variance ->
  replenishment approval/issue.
- [x] Vendor and GL mapping feed claims/petty cash and balanced journals.
- [x] Requests commit budget; approved/posted expenses update actuals; closed
  periods block transactions and controlled reopen is audited.
- [x] Custom/scheduled reports, email template state, settings and themes persist.

### Analytics and fidelity

- [x] KPI drill-down counts and chart totals use the same role-filtered payloads.
- [x] Chart.js instances resize and destroy cleanly on navigation.
- [x] Table/card/kanban, filters, pagination, drawers and wizards follow the
  prototype interaction patterns.
- [x] Browser QA results are recorded in `FINAL_REVIEW.md` (74/74 routes).
