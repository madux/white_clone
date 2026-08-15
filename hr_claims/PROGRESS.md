# HR Claims — Progress

Last updated: 2026-08-15

## Done

- Reviewed the Figma prototype in Admin and Employee modes.
- Inspected all claims-specific screens, creation/configuration flows, workflow states, payments, audit, dashboards, reports, and the Roles & Permissions page.
- Recorded the authoritative four-role permission matrix.
- Wrote the data model, workflow, views, chart definitions, assumptions, phased plan, and manual checklist in `REQUIREMENTS.md`.
- Implemented categories, types, windows, claims, line items, payments, audit events, and transient decision/payment wizards.
- Implemented Draft → Submitted → Approved/Rejected/Returned → Paid/Cancelled transitions with server-side role checks and validations.
- Implemented Employee, Manager, Finance, and Administrator groups, ACLs, own-record rules, privileged visibility, and global multi-company boundaries.
- Added seed categories, the three prototype claim types, processing windows, and claim/payment sequences.
- Added four automated Odoo workflow/security tests; latest run: **4 passed, 0 failed, 0 errors**.
- Clean installation completed successfully on the disposable `codex_hr_claims_test` Odoo 17 Community database.

## In progress

- Phases 3–4: native views/menu polish and OWL dashboard browser verification.

## Pending

- Final view/asset QA and manual role/workflow walkthrough completion.
- Final documentation and `FINAL_REVIEW.md`.

## Blockers

- None.

## Assumptions made

- Requests, advances, petty cash, vendors, budgets, and general accounting in the prototype are adjacent modules and are not duplicated by `hr_claims`.
- Pending/Pending Approval are normalized to Submitted.
- Multi-level workflow configuration is stored for extensibility; the executable v1 decision is Manager/Admin per the Roles page.
- Odoo company currency and Community models are used; no Enterprise Accounting/Payroll dependency is introduced.
