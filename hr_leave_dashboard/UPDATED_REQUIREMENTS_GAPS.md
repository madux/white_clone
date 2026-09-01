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
- the AI Leave Assistant.

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
