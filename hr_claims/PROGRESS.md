# HR Claims / Expense ERP — Progress

Last updated: 2026-08-15

## Scope correction

The previous implementation incorrectly reduced the Figma prototype to claims
only and marked the work complete. That completion status is revoked. The full
prototype is the required scope, and the primary UX must be OWL-led.

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

## In progress

- [ ] Phase 2: shared OWL application shell, reusable components, capability
  gateway, role-aware navigation, and Figma-derived theme tokens.

## Pending

- [ ] Phase 3: Requests, cash advances, and multi-level approval engine.
- [ ] Phase 4: Payments/batches and Petty Cash.
- [ ] Phase 5: Community subledger, Vendors, Budgets, and Periods.
- [ ] Phase 6: Teams, Reports, Audit, Settings, Email/Integration metadata, and
  Theme management.
- [ ] Phase 7: clean install/upgrade, automated security/workflow regression,
  page-by-page browser QA, and corrected final review.

## Blockers

- None.

## Assumptions/prototype defects recorded

- Some visible prototype tabs do not change content; their named pages remain
  requirements and are implemented from the surrounding domain.
- External payment/accounting/storage providers are adapter surfaces until a
  provider is separately configured; internal workflows remain functional.
- The module keeps the technical name `hr_claims` but displays **Expense
  Management**.

## Existing checkpoint history

- `1230bc9` — `[ADD] hr_claims requirements and implementation plan`
- `45f1a51` — `[ADD] complete Odoo 17 HR claims management`
- `fed7190` — `[FIX] harden claims workflow and payment integrity`
- `5f864b6` — `[DOC] finalize HR claims verification and review`
- `4bb2d40` — `[FIX] address HR claims review findings`
- `dcff1a8` — `[DOC] record HR claims review remediation`

These checkpoints describe the earlier claims-only increment; they do not mark
the corrected full-product scope complete.
