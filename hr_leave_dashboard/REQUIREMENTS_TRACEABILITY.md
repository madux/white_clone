# Leave Management requirements traceability

Reviewed against the expanded Product Requirements & User Stories document supplied on 24 August 2026.

## Implemented and aligned

### Module A — Get Started

- Persistent Get Started page, welcome flow, five-step guide, previous/next/skip/finish controls and completion screen.
- Deep links target the actual Leave Types, Balance Management, Settings and Requests screens.
- Checklist progress is derived from real configuration and transaction data; opening or advancing the guide does not mark work complete.

### Module B — Dashboard

- Admin KPIs, trends, leave-type distribution, balances, approval overview, department coverage, recent requests and quick actions use current Odoo records.
- Employee data is scoped to the logged-in employee.
- Employee remaining balance reserves pending requests; used, pending and carried-forward values are separate.
- Upcoming approved leave, holidays and five recent requests are data-driven and have empty states.

### Module C — Calendar

- Admin month/week/day/year switching, navigation, filters, coverage mode, request detail modal, leave colours and pending styling.
- Public holidays are included in month/week/day responses and rendered in the grids.
- Employee visibility is enforced server-side: own pending/approved requests plus approved team absences. Colleagues' pending requests and notes are not exposed.
- Employee event filters support My Leave, Team Leave and Public Holidays; clicking an empty month cell opens a date-prefilled request form.
- Loading failures display a Retry action. Employee coverage controls are hidden.

### Module D — Requests

- Admin counts, search, type/department filters, 5/10/25/50/100 pagination, bulk decisions, admin-created requests and conflict override.
- Employee list is self-only, with submit, cancel pending/approved request, re-submit and one-time escalation.
- Request previews exclude weekends/public holidays through Odoo duration calculation and enforce eligibility, gender, service period, notice, balance, half-day, min/max duration, advance/retroactive window, blackout and team-overlap rules.
- Missing policy documentation produces a warning rather than blocking submission, following the document's acceptance criterion.
- Rejection, cancellation and escalation reasons are persisted and displayed in the shared detail modal.
- Pending balances reserve days; rejection/cancellation restores them through state transitions.
- Active disciplinary suspension blocks employee/admin submission and individual/bulk approval, with a failed audit entry.
- Configured multi-stage workflows have persisted per-request timeline rows, deadlines and automatic overdue escalation. Native Odoo approval actions also respect the configured stage order.

### Module E — Leave Types & Policies

- List/search/category/status/location filters, active toggle, data-backed counts, distinct empty/error states, starter packs and detail drawer tabs.
- Required name, four-character uppercase code, entitlement, employment type and location validation is enforced in the UI and server.
- Gender, eligibility scope, service period, five earning methods, monthly rate preview, carry-forward cap/expiry, balance cap, encashment, tenure tiers, suspension settings, document policy, approval stages, half-day, negative balance and overlap rules persist.
- Accrual cron implements year-start, monthly, hire-anniversary and first-year prorated runs with idempotency, tenure scaling, suspension reasons, allocation, ledger and audit entries.
- Carry-forward uses its dedicated cap and expiry rule rather than the overall balance cap.
- Historical/system leave types cannot be deleted; they must be archived.
- Only active, employee-visible, eligible leave types are offered to an employee. Calendar and request filter choices exclude inactive types.

## Confirmed limitations / follow-up work

These are not represented as complete because the necessary source data or full integration is not currently present:

1. **Country holiday catalogue:** changing country in Year view currently changes context but `resource.calendar.leaves` has no country/type catalogue to supply National/Religious/Regional/Observance overlays. This needs a holiday-provider model or external dataset before the selector can truthfully alter dates.
2. **Native XLSX/PDF exports:** calendar and leave-type downloads still use browser print or CSV-compatible export in some paths. Dedicated report/XLSX generators are needed for exact-file-format compliance.
3. **Employee calendar extras:** Google/Outlook add-to-calendar actions, the desktop balance/upcoming-leave sidebar, mobile slide-in drawer and the admin Insights panel are not complete.
4. **Policy references tab:** there is no independent leave-policy model referencing leave types, so the drawer cannot list meaningful external policies until that domain model exists.
5. **Custom CSV template import:** Standard and Nigeria starter packs work; mapped custom CSV import and row-level validation reporting remain outstanding.
6. **Unauthorized-absence accrual suspension:** Time Management computes an absent status but does not persist a distinct authorised/unauthorised absence record that the accrual engine can safely consume. Other configured suspension conditions are implemented.
7. **Notification delivery:** chatter/in-app updates are emitted, but the complete event-specific email template matrix described by the PRD needs a separate notification-delivery pass.

## Specification decisions

- D.11 contains conflicting wording about supporting documents. The acceptance criterion explicitly says a missing required document warns but does not block; that testable criterion was followed.
- E.11 caps codes at four characters, while acceptance criterion E.11 asks duplicate codes to receive a `_COPY` suffix. Both cannot be true simultaneously. Four-character uniqueness remains authoritative; duplicate codes should receive a unique four-character derivative.
- D.11 says employees cannot select past dates, while later integration wording mentions a configurable retroactive window. The employee picker currently follows the explicit no-past-date rule; the backend still enforces a configured retroactive window for API/admin paths.

## Verification

- Python compilation and XML parsing pass.
- `git diff --check` passes.
- `hr_leave_dashboard` upgrades successfully on `white_clone_db`.
- Rollback-only Odoo smoke test: two configured stages advance `pending/waiting` → `approved/pending` → `approved/approved`, with final request state `validate`.
- Rollback-only Odoo smoke test: a 1.5-day monthly accrual produces one allocation/run/ledger entry; rerunning the same period produces zero duplicates.
- Rollback-only Odoo privacy test: employee calendar returns own pending leave and approved team leave, while excluding a teammate's pending leave and another department's approved leave; team notes/details remain private.
