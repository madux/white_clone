# HR Claims — Final Review

Date: 2026-08-15  
Status: **Complete**  
Target: Odoo 17 Community Edition

## 1. Outcome

`hr_claims` is a complete, installable Community module for employee claims, manager decisions, Finance payments, audit history, configuration, native reports, and an OWL/Chart.js dashboard. The implementation follows the Figma Roles page as the security source of truth and uses server-side checks and record rules in addition to view visibility.

The final clean install and module tests passed with **0 failures and 0 errors**. Browser verification also passed for the main claim lifecycle, a two-line Draft, the dashboard and all three charts, graph/pivot reports, configuration lists, and the audit trail.

## 2. Delivered by phase

### Phase 1 — Requirements and planning

- Inspected the Figma prototype in Admin and Employee modes, including the claims screens, configuration flows, workflow queues, payments, analytics, reports, audit log, and Roles & Permissions page.
- Produced `REQUIREMENTS.md` with the model design, state machine, views, dashboard metrics, role matrix, assumptions, implementation phases, and verification checklist.
- Established `PROGRESS.md` and checkpoint commits.

### Phase 2 — Models, workflow, and security

- Added categories, claim types, processing windows, claim headers, line items, payments, immutable audit events, and Return/Reject and Payment wizards.
- Implemented Draft → Submitted → Approved/Rejected/Returned → Paid/Cancelled with validation for limits, receipts, eligibility, dated/duration windows, ownership, and payment coverage.
- Added four groups matching the Figma matrix: Employee, Manager, Finance, and Administrator.
- Added global allowed-company boundaries, employee-own rules, privileged read rules, model ACLs, and server-side role checks.
- Hardened state transitions against client-context bypasses, forced user-created claims and payments into Draft, and made completed payments immutable.

### Phase 3 — Core views and workflow surfaces

- Added list, form, kanban, search, graph, and pivot claim views.
- Added My Claims, All Claims, Pending Approvals, Approved, Rejected, Payment Queue, Payment History, Reports, Configuration, and Audit menus/actions.
- Added claim-type configuration areas for amount, eligibility, documentation, approval, payment/accounting metadata, limits, and window assignment.
- Added chatter, attachments, inline expense lines, state-aware actions, payment history, and audit history.

### Phase 4 — Dashboard and charts

- Added an OWL client action using Bootstrap/Odoo styling and Odoo's bundled Chart.js asset.
- Added role-aware KPIs, recent-claim drill-downs, approval/payment summaries, a status doughnut, six-month trend line, and department-spend bar chart.
- Dashboard values use record-rule-filtered data and convert visible multi-company values to the current company's currency.

### Phase 5 — Verification and polish

- Added Odoo transaction tests for workflow, role separation, record visibility, multi-company isolation, negative validation, partial/full payments, audit integrity, and state-mutation protection.
- Validated Python compilation, every XML file, whitespace, module upgrade, clean install, views, assets, and browser behavior.
- Preserved unrelated working-tree changes in `hr_cbt_portal_recruitment` and `hr_employee`.

### Post-review hardening

- Replaced inherited Employee permissions for Manager/Finance with explicit, role-accurate ACLs. Employees retain own-record self-service; Managers can decide but not create/delete claims; Finance can read claims and process payments but cannot alter claim content.
- Extended Manager read-only visibility to payment history on every visible claim.
- Added an Approve wizard so an optional approval comment is captured in the same server action as approval; employees cannot forge decision metadata.
- Aligned monthly chart attribution to `submitted_date`, `approved_date`, and `paid_date` for the respective series.
- Added claim-row locking around draft allocation and confirmation, plus a draft-exposure limit, preventing concurrent or preallocated payments from exceeding the residual.
- Added regression coverage for each review finding and repeated both upgrade and clean-install verification.

## 3. Assumptions and ambiguities resolved

| # | Ambiguity or gap | Resolution |
|---|---|---|
| 1 | Prototype covers a wider expense ERP. | Scoped the module to claims; requests, advances, petty cash, vendors, budgets, and general accounting remain adjacent integrations. |
| 2 | Admin Claims Data wires **Create Claim** to claim-type setup. | Exposed separate New Claim and New Claim Type actions. |
| 3 | `Pending`, `Pending Approval`, and `Submitted` are used interchangeably. | Normalized them to the `submitted` state. |
| 4 | Return/Pending Employee Response behavior is not fully specified. | Added `returned`; the owner can correct and resubmit. |
| 5 | Multi-level approval options have no approver-routing definition. | Stored single/sequential/parallel/conditional configuration; executable v1 approval is Manager/Admin as required by the Roles page. |
| 6 | Mileage receipt examples conflict with the wizard's ₦10,000 rule. | Made each claim type's receipt policy authoritative; conditional policy defaults to ₦10,000. |
| 7 | Claim windows appear as both date ranges and durations. | Supported both; active date bounds and assigned duration rules are enforced. |
| 8 | Prototype hard-codes Naira. | Used Odoo company currencies and conversion; NGN works without a hard-coded currency. |
| 9 | Bank details are visible but no reliable Community employee bank field/integration is defined. | Stored method/reference/notes on payments; deferred bank-master execution. |
| 10 | Corporate Card is non-reimbursable but still enters approval. | It can be approved for control/audit and is excluded from the payment queue. |
| 11 | Prototype advertises 10 MB and HEIC upload behavior. | Reused Odoo attachments and server upload limits; the text remains advisory rather than duplicating storage validation. |
| 12 | Employee behavior without a linked `hr.employee` is unspecified. | Such users cannot submit; Admin may explicitly assign an employee. |
| 13 | Prototype uses four- and seven-step bespoke flows. | Used native notebook-based forms with the same captured sections for idiomatic Odoo navigation and validation. |
| 14 | Batch payment UI does not define a bank provider or file format. | Implemented a multi-record queue plus auditable individual/partial payments; bank execution/export remains an integration. |

## 4. Deferred or external items

- **Multi-level approver routing:** configuration is retained, but sequential/parallel/conditional routing is deferred until approvers, thresholds, escalation, and quorum rules are defined.
- **Bank/payroll/accounting posting:** payment references and GL codes are captured, but posting or bank-file generation is deferred to the chosen Community accounting/payroll/bank integration.
- **Requests, cash advances, petty cash, vendors, budgets, and Team administration:** these belong to the wider prototype and existing Odoo security/adjacent modules, not `hr_claims`.
- **Bespoke stepper presentation:** native Odoo notebook forms replace the prototype steppers; no business field or validation was dropped.
- **Custom upload-size/MIME enforcement:** Odoo's central attachment/server limits are used to avoid inconsistent per-module storage rules.

No requirement recorded in `REQUIREMENTS.md` is otherwise deferred.

## 5. Test checklist results

| Workflow | Result | Verification |
|---|---|---|
| Clean Odoo 17 CE install | PASS | Fresh `codex_hr_claims_final_test`, no module traceback; disposable DB removed afterward. |
| Save a Draft with multiple lines | PASS | Browser: `CLM/2026/00038`, two lines, total 9,500. |
| Submit and record date/audit/chatter | PASS | Browser lifecycle and automated workflow test. |
| Empty/over-limit/ineligible/outside-window/missing receipt blocked | PASS | Automated negative tests. |
| Employee sees own claims/payments only | PASS | Automated per-user record-rule and dashboard test. |
| Manager sees company claims, payment history, and approves with optional comment | PASS | Browser lifecycle plus automated role, wizard, and read-only payment tests. |
| Rejection requires a reason | PASS | Automated mandatory-reason test. |
| Return, edit, resubmit | PASS | Automated end-to-end workflow test. |
| Finance sees payable claims and cannot decide them | PASS | Automated authorization test. |
| Partial then full payment; Paid only when covered | PASS | Automated payment test and browser full-payment lifecycle. |
| Draft/concurrent payment overexposure protection | PASS | Automated draft-exposure test; confirmation uses a database claim-row lock and refreshed residual. |
| Employee withdraw/cancel actions | PASS | Server action/state validation and installed view modifiers. |
| Dashboard KPI and three live charts | PASS | Browser: four KPIs and three canvases rendered with live paid data; automated test verifies event-date monthly attribution. |
| Native graph and pivot reports | PASS | Browser: graph loaded; pivot rendered paid amount by department and XLSX action. |
| Admin configuration and audit | PASS | Browser: Claim Types, Claim Windows/assignments, and five lifecycle audit events rendered. |
| Multi-company isolation | PASS | Automated second-company visibility test for Manager and Finance. |

Final post-review command result: **7 workflow test methods, 0 failed, 0 errors** (Odoo statistics report 9 test units). Upgrade and clean-install runs both passed. Python compile, XML parse, and `git diff --check` also passed.

## 6. Conventions and deviations

- Models, ACLs, rules, actions, views, menus, mail mixins, assets, and tests follow standard Odoo 17 Community patterns.
- Role groups use explicit ACLs instead of inheriting Employee CRUD; record rules provide company/record scope and server methods enforce state/field transitions.
- Payment confirmation uses a short PostgreSQL `FOR UPDATE` lock on the affected claim rows, acquired in sorted order to serialize financial balance checks safely.
- The dashboard is a small OWL client action; Chart.js is loaded through Odoo's `web.chartjs_lib`, not vendored.
- Bootstrap/Odoo utility classes provide layout and styling; SCSS only adds dashboard-specific sizing and interaction polish.
- No Enterprise module, field, or service is required.
- The native notebook adaptation and intentionally plain GL/payment references are product-scope choices, not framework deviations.

## 7. Environment notes

- The existing workspace configuration has a pre-existing transient-vacuum `TypeError` caused by a string-valued/deprecated age-limit option. It affects base transient-model cleanup generally and is unrelated to `hr_claims`; clean install, tests, wizards, views, and browser operations still passed. Replace the deprecated `osv_memory_age_limit` setting with a valid numeric `transient_age_limit` value in the local Odoo configuration.
- The populated `codex_hr_claims_test` database is intentionally retained for review. Both fresh-install-only databases, including the post-review `codex_hr_claims_review_test`, were removed and are not recoverable, but contained no user data.

## 8. Recommended review steps

1. Assign representative users to the four Claims groups and confirm the organization-specific membership choices.
2. Set the company currency (for example NGN), review the seeded Mileage/Per Diem/Corporate Card policies, and adjust windows/limits.
3. Review the native form/tab adaptation against the desired degree of visual fidelity to the Figma prototype.
4. Define approver routing and the target bank/payroll/accounting integration before extending the intentionally deferred items.
5. Correct the local transient-age configuration noted above so the general Odoo auto-vacuum cron runs cleanly.
