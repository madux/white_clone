# Expense Management ERP — Progress

Last updated: 2026-08-15

## Scope correction

The previous implementation incorrectly reduced the Figma prototype to claims
only and marked the work complete. That completion status is revoked. The full
prototype is the required scope, and the primary UX must be OWL-led.

## Technical namespace correction

The addon is now `hr_expense_management`, not `hr_claims`. The exact technical
name `hr_expense` cannot be used because it is already an official Odoo 17
Community addon. All module external IDs, application-wide security group
references, OWL template/action registrations, asset paths, test tags,
documentation, and install commands have been moved to the new namespace.
Claim-domain records retain their accurate `hr.claim.*` business-model names.
[UPGRADE.md](UPGRADE.md) and the transactional SQL helper preserve existing
installed databases, role assignments, and record references without
duplicating records.

## Done

- [x] Preserved the working claim model, workflow, security hardening, payments,
  native fallback views, initial OWL dashboard, and regression tests.
- [x] Re-read the previous progress, requirements, final review, and latest
  commits before resuming.
- [x] Re-audited all top-level Figma modules and their visible subpages:
  Dashboard, Setup, Claims, Requests, Advances, Workflow, Payments, Petty Cash,
  Teams/Roles, Accounts, Vendors, Budget, Reports, Audit, Settings, and Theme.
- [x] Confirmed the Figma Roles & Permissions matrix remains the security source
  of truth.
- [x] Replaced `REQUIREMENTS.md` with the corrected complete product inventory,
  model plan, workflows, OWL architecture, security map, assumptions, phases,
  and expanded test checklist.
- [x] Phase 2: replaced the dashboard-only entry point with the role-aware OWL
  Expense Management shell, full prototype module/subpage navigation, reusable
  OWL KPI component, responsive Figma-derived styling, loading/error states,
  live claims/workflow/payment surfaces, and secured server capability gateway.
- [x] Phase 2 verification: Odoo upgrade passed; Python/XML/whitespace checks
  passed; the generated 7.9 MB backend asset bundle contains the compiled
  `ExpenseApp` JavaScript and QWeb template.
- [x] Phase 2 verification: the server gateway returned all 16 modules for the
  Admin user; the existing 7 workflow methods / 9 Odoo test units passed with
  0 failures and 0 errors after compatibility hardening for private employee
  fields in the installed custom HR module.
- [x] Phase 3 checkpoint A: implemented expense request types and requests,
  employee draft/submit/cancel flows, Manager approve/reject/return decisions,
  Finance advance issuance, partial/full advance retirement, aging and balances,
  configurable multi-level claim/request approval rules, runtime approval
  steps, and company/ownership security rules.
- [x] Phase 3 checkpoint A OWL UX: activated Requests, Advances, and Workflow
  pages inside the OWL application with KPI cards, search and status filters,
  table/card switching, request creation modal, combined claim/request approval
  decisions, advance issuance, retirement modal, and route configuration views.
- [x] Phase 3 checkpoint A verification: module upgrade passed; the minified
  `web.assets_backend` bundle compiled with the OWL app and templates; 11 test
  methods / 15 assertions groups passed with 0 failures and 0 errors, including
  request-to-advance settlement and two-level approval routing.
- [x] Phase 4 checkpoint A: implemented configurable payment methods, validated
  payment batches with per-claim savepoints/result logs, batch-to-payment links,
  and secured batch processing that settles approved claim balances.
- [x] Phase 4 checkpoint A: implemented petty-cash funds, custodian ownership,
  computed live balances, expenses and adjustments, Finance approval/posting,
  physical-count reconciliation, replenishment request/approve/issue, and
  generated replenishment ledger transactions.
- [x] Phase 4 checkpoint A OWL UX: activated all Payments and Petty Cash
  navigation pages with live KPIs, searchable tables, payment queue/history/
  methods/batches, fund and transaction data, reconciliation and replenishment
  views, plus direct operational actions and native advanced-edit fallbacks.
- [x] Phase 4 checkpoint A verification: upgrade and backend asset compilation
  passed; 13 test methods / 17 assertion groups passed with 0 failures and 0
  errors, including full payment-batch settlement and petty-cash expense,
  replenishment, and reconciliation flows.
- [x] Renamed the addon from `hr_claims` to the collision-safe
  `hr_expense_management` namespace; renamed application-wide security roles,
  added a transactional installed-database migration, and preserved the
  claim-specific business-model vocabulary.
- [x] Namespace verification: the migrated local database contains the installed
  `hr_expense_management` 17.0.5.0.0 record and 1,021 namespaced external IDs,
  contains no former custom module record, and leaves Odoo's standard
  `hr_expense` addon untouched. Upgrade, OWL asset compilation, and all 13 test
  methods / 17 assertion groups pass with 0 failures and 0 errors.
- [x] Phase 5 checkpoint A: implemented the Community expense subledger with a
  hierarchical chart of accounts, configurable GL mappings, balanced immutable
  posted journals, source links, and configured claim/payment/advance/petty-cash
  journal generation without adding an Enterprise accounting dependency.
- [x] Phase 5 checkpoint A: implemented expense vendor categories, payment
  terms, validated vendor master data on `res.partner`, vendor links on claims
  and petty cash, ratings, default GL accounts, and approved-spend metrics.
- [x] Phase 5 checkpoint A: implemented fiscal periods and operation cut-offs,
  controlled close/reopen workflows, department budgets and lines, request
  commitments, claim/petty-cash actuals, availability, utilization, warning
  thresholds, and budget states.
- [x] Phase 5 checkpoint A OWL UX: activated Accounts, Vendors, and Budget with
  all audited subpages, live KPI cards, searchable responsive tables, account
  hierarchy indentation, mapping/journal status, vendor table/card modes and a
  constrained create modal, budget utilization/status views, periods, and
  native advanced-edit fallbacks. The broad Odoo Contact Manager permission was
  deliberately not granted to Finance.
- [x] Phase 5 checkpoint A verification: Odoo upgrade, native-view validation,
  OWL backend asset compilation, and 17 test methods / 23 assertion groups pass
  with 0 failures and 0 errors. Coverage includes balanced-journal immutability,
  claim journal generation, commitment/actual exposure, closed-period blocking,
  constrained vendor creation, live OWL payloads, and role enforcement.

## In progress

- [ ] Phase 3 checkpoint B: advance write-off approval, richer request/advance
  analytics, and final page-specific UX polish.

## Pending

- [ ] Phase 4 checkpoint B: richer payment/petty-cash report charts, inline
  custodian reassignment, receipts, and page-specific card views.
- [ ] Phase 5 checkpoint B: OWL-native budget-line and GL/journal creation
  wizards, commitment release/transfer edge cases, richer accounting adapters,
  and vendor/budget analytics charts.
- [ ] Phase 6: Teams, Reports, Audit, Settings, Email/Integration metadata, and
  Theme management.
- [ ] Phase 7: clean install/upgrade, automated security/workflow regression,
  page-by-page browser QA, and corrected final review.

## Blockers

- None. Authenticated visual browser QA remains pending for the final verification
  phase; server, registry, assets, and automated regressions are passing.

## Assumptions/prototype defects recorded

- Some visible prototype tabs do not change content; their named pages remain
  requirements and are implemented from the surrounding domain.
- External payment/accounting/storage providers are adapter surfaces until a
  provider is separately configured; internal workflows remain functional.
- The collision-safe technical name is `hr_expense_management`; the exact
  `hr_expense` name belongs to Odoo's standard Expenses addon.

## Existing checkpoint history

- `1230bc9` — `[ADD] hr_claims requirements and implementation plan`
- `45f1a51` — `[ADD] complete Odoo 17 HR claims management`
- `fed7190` — `[FIX] harden claims workflow and payment integrity`
- `5f864b6` — `[DOC] finalize HR claims verification and review`
- `4bb2d40` — `[FIX] address HR claims review findings`
- `dcff1a8` — `[DOC] record HR claims review remediation`

These checkpoints describe the earlier claims-only increment; they do not mark
the corrected full-product scope complete.
