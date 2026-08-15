# HR Claims — Progress

Last updated: 2026-08-15

## Done

- Reviewed the Figma prototype in Admin and Employee modes.
- Inspected all claims-specific screens, creation/configuration flows, workflow states, payments, audit, dashboards, reports, and the Roles & Permissions page.
- Recorded the authoritative four-role permission matrix.
- Wrote the data model, workflow, views, chart definitions, assumptions, phased plan, and manual checklist in `REQUIREMENTS.md`.

## In progress

- Phase 2: data model, security, workflow, and base data.

## Pending

- Core Odoo views and menus.
- OWL dashboard and Chart.js charts.
- Automated/install verification and manual role/workflow walkthrough.
- Final documentation and `FINAL_REVIEW.md`.

## Blockers

- None.

## Assumptions made

- Requests, advances, petty cash, vendors, budgets, and general accounting in the prototype are adjacent modules and are not duplicated by `hr_claims`.
- Pending/Pending Approval are normalized to Submitted.
- Multi-level workflow configuration is stored for extensibility; the executable v1 decision is Manager/Admin per the Roles page.
- Odoo company currency and Community models are used; no Enterprise Accounting/Payroll dependency is introduced.

