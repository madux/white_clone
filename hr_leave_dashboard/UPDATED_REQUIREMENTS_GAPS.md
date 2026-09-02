# Updated Leave Requirements — Deferred Details

This file records only requirements whose behaviour is named in the updated
specification but whose configuration or workflow contract is not yet complete.
It prevents the implementation from inventing product rules while later
snippets are reviewed.

## Scope assignment

The role matrix says HR Officers and Leave Administrators operate within an
"assigned scope", including department and location scope. The supplied
organisation-structure extract does not yet define:

- who assigns that scope;
- whether departments and locations are inclusive or exclusive;
- how multiple companies/branches interact with it;
- the fallback when no scope is assigned; or
- whether temporary/delegated scope has effective dates.

Until that contract arrives, company boundaries and existing Odoo record rules
remain the safety boundary. No hidden department/location fallback has been
invented.

## Workflow actions still needing their detailed contract

- Request Changes (including resulting state, employee response and SLA)
- Withdraw versus Cancel semantics
- Leave extension requests and extension approval
- the three Return Overdue actions
- approver escalation destination and authority

Approve, Reject and employee escalation continue to use the currently defined
workflow. The missing actions should be added when their complete requirements
and acceptance criteria are supplied.

## Preferences and strategic reporting

- Employee notification preferences require the definition of mandatory
  notification limits before users can safely disable channels.
- Executive / HR Director access is represented as a role and capability, but
  the existing operational report must not be exposed as a substitute for the
  specified aggregated Executive Workforce Brief. Its dedicated screen and data
  contract are still required.
- AI Governance and risk intelligence are named here but belong to the later AI
  configuration and governance specification.

## Policy model and configuration hierarchy

The consolidated specification now separates Leave Types (identity, colour and
unit) from Leave Policies (eligibility, entitlement, accrual, carry-forward,
approval and enforcement). The current build predates that clarification and
stores several policy rules on `hr.leave.type`.

That data must be moved deliberately into a versioned Leave Policy model after
the remaining Part 11 policy, assignment and general-settings screens are
available. In particular, the following contracts are still required before a
safe migration can be designed:

- the complete list of global defaults, global-locked settings and overridable
  settings;
- the exact policy-to-leave-type cardinality and assignment workflow;
- the authorised employee-exception fields and approval authority; and
- prospective policy version activation and treatment of open requests.

Encashment is also deferred until the request, approval, payroll hand-off and
payment-result contract is supplied. No balance will be deducted merely from
the existing `allow_encashment` flag.

## Unified dashboard additions

The current personal and organisation dashboards are retained as live-data
sections in the unified role-aware dashboard. The new global Quick Actions row
is permission-filtered. These newly confirmed widgets require models or fuller
contracts and have not been represented by sample data:

- targeted, expiring and pinnable announcements with read receipts;
- the non-audit operational Activity Feed;
- policy-anniversary events, which depend on the future Leave Policy model;
- policy-review-due triggers;
- configurable trigger reminder intervals and notification delivery; and
- provider-generated dashboard narrative and follow-up answers. A global,
  permission-aware assistant shell now exists, but dashboard-specific context
  and tools have not yet been published to it.

Existing live KPI, trend, distribution, balance, approval, coverage and recent
request widgets remain in place. Their eventual compact/expanded presentation
can be adjusted once Product identifies which unified sections should be
summaries versus full inline widgets.

## Configuration navigation

The existing Leave Types, Leave Balances and company settings screens are now
preserved as permission-aware tabs inside one Leave Configuration workspace.
The company settings tab is labelled General Settings. Public holidays remain
managed from that tab through Odoo's real calendar-leave action.

Separate Leave Policy, Blackout Window and reusable Approval Workflow tabs are
not represented by invented screens. They should be added to the same workspace
when the remaining Part 11 data models, lifecycle rules and acceptance criteria
are supplied. Existing blackout and leave-type approval enforcement continues
to operate in the meantime.

## Leave Balance allocation delivered in this increment

The approved employee-first workflow is now implemented as a two-step operation:

- Individual, Department, Unit, Grade Level, Job Role, Location and Employment
  Type selections accumulate into one removable employee audience;
- Leave Types are added as allocation lines, with a default day amount per line;
- the preview expands those lines into an employee-by-Leave-Type matrix and
  supports both per-cell overrides and whole-column bulk edits;
- incompatible employee/policy combinations block submission instead of being
  silently allocated;
- the whole matrix is validated and written atomically as native Odoo leave
  allocations, immutable balance-ledger entries and audit entries; and
- effective date is required while expiry date is optional. A missing expiry is
  not replaced by an invented year-end date.

The canonical displayed Available Balance is now calculated from the same
components used by request policy checks: Opening Entitlement + Carried Forward
- Used - Pending. No sample entitlement fallback is used when an employee has no
validated allocation.

## Leave Balance work intentionally not exposed yet

The following features are specified, but are not presented as working controls
until their complete operational behaviour is implemented:

- CSV allocation import (template, validation preview, partial-row error report
  and confirmation);
- idempotent cycle close, carry-forward and expiry processing; and
- approval-gated balance allocation/adjustment through the shared
  `cleon_approval` engine. The allocation batch needs its own pending record and
  finalisation hooks so no balance changes before approval. Direct allocation is
  currently restricted to the Leave Balance Operations capability; it must not
  be described as approval-routed yet.

The four enforcement modes (Strict, Allow Negative Balance with a configured
limit, Allow Request with Exception Approval, and Not Enforced) also depend on
the final versioned Leave Policy hierarchy. The existing Leave Type enforcement
must not be presented as full coverage of that contract.

## Leave Calendar delivered in this increment

The existing calendar is now one role-aware workspace rather than separate
screens that can drift apart. It includes:

- organisation and personal/team perspectives, shown only when the signed-in
  user is authorised for each perspective;
- Month, Week and Day views for employees, with Year and coverage views kept
  behind organisation-calendar capability;
- a date roster that lists every visible employee away on the selected day,
  including the records hidden behind a `+N more` calendar indicator;
- click-to-open details without exposing a colleague's private request detail;
- drag selection across Month cells to prefill a personal leave request or an
  administrator Book Time Off form for the selected range; and
- administrator booking that validates the employee, leave type, dates,
  policy and overlap before submission. `No Approval Required` Leave Types are
  approved immediately; all other Leave Types enter their configured approval
  workflow.

The detailed standalone coverage-analysis modal, inline Insights panel,
Google/Outlook calendar publishing, true XLSX/PDF generation, and the full
mobile-specific calendar composition remain requirements gaps. The current
download control exports current-view data as CSV or opens the print-to-PDF
flow and must not be described as a native XLSX/PDF generator.

The later review also references configurable Full, Limited and Anonymous
calendar privacy levels plus forced anonymisation for sensitive Leave Types.
Those definitions are not present in the supplied Section 6.2–6.4 extract:
there is no configuration owner, default, field matrix, or list/flag defining
sensitive types. The current server serializer continues to protect colleague
notes and full details in personal/team scope, but it must not be described as
implementing that newer three-level privacy contract until those rules are
supplied.

## AI foundation delivered; provider execution deferred

A provider-neutral CleonAI shell now floats across backend modules. Leave
Calendar publishes its current view, date range, perspective and filters; the
server rebuilds the visible dataset under the signed-in user's permissions and
returns a deterministic calendar summary. The backend also publishes an
allowlisted tool catalogue, distinguishing read, navigation and
confirmation-required preparation tools.

No external model is called and no API key is stored by this increment. The
gateway has explicit provider/model/live-call configuration boundaries so a
future adapter can target a local model or a hosted provider without moving
permission checks into the browser. Provider adapters, secrets management,
model governance, audit/usage controls, prompt-injection defences, and an MCP
server/client boundary remain deferred. AI Balance Lookup, smart leave-date
recommendations, generated follow-up answers, and automated actions are not
implemented; any future write-capable tool must preserve explicit user review
and confirmation.
