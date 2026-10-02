# Part 8 — Leave Requests, Approvals and Active-Leave Lifecycle

## Frozen implementation baseline

This document consolidates the supplied Part 8 screenshots, acceptance criteria
and lifecycle flowcharts into one implementation baseline. It is a gap analysis,
not an assertion that the missing features are already available.

The shared `cleon_approval` runtime is signed off. New Leave functionality must
consume `cleon.approval.instance`; it must not create another approval engine or
reactivate the legacy `hr.leave.approval.line` runtime.

Status terminology used below:

- **Implemented** — the server behavior and an active user path exist.
- **Partial** — useful foundations exist, but one or more stated behaviors are
  absent or are not authoritative end to end.
- **Missing** — no working business object or active flow exists.
- **Product decision** — the supplied requirements conflict or do not define a
  value needed for safe implementation.

## Non-negotiable invariants

1. `hr.leave` remains the authoritative original leave record.
2. `cleon.approval.instance` remains the authoritative approval runtime.
3. An extension is a distinct linked business object and gets a distinct
   approval instance. A completed approval instance is never reopened or reused.
4. Original approval and extension approval remain distinct, linked audit
   histories.
5. Rejected or withdrawn extensions cannot mutate the original leave dates,
   balance, Calendar or coverage.
6. Balance, Calendar and coverage change only after an authoritative approval or
   approved/automatic return outcome.
7. No frontend, direct URL, generic ORM write or System Administrator membership
   may bypass business-role and current-approver checks.
8. Absence of a clock-in never automatically creates Unauthorised Absence.
9. Policy decisions that govern a submitted request or extension are snapshotted
   where later configuration changes must not act retroactively.
10. Every consequential action records actor, timestamp, source, before/after
    state and links to the affected business object.

## A. Unified request and approval workspace

| Requirement | Status | Repository evidence / remaining gap |
| --- | --- | --- |
| Role-aware My Requests and Approvals views | Implemented | `MyLeaveRequestsPage` exposes the two views according to the access profile. |
| Pending and resolved request states | Implemented | Pending, Approved, Rejected, Changes Requested and Cancelled are represented. |
| Full request detail | Partial | Request data, balance impact, coverage, attachments, Handover, workflow and history exist. The specified dedicated Leave Profile with employee history/patterns/team calendar is not a complete view. |
| Permission-scoped direct access | Implemented | Detail RPC verifies owner, active approver/workflow participant or Operations/Audit capability. Generic workflow-field writes are blocked. |
| Submission confirmation with reference and approval route | Partial | A reference and success toast exist. The specified persistent confirmation screen and route panel are absent. |
| Notifications dropdown and full notification center | Partial | Chatter/in-app/email helpers exist. The specified persistent dropdown, read state and notification center are not implemented here. |

## B. Request creation, validation and recovery

| Requirement | Status | Repository evidence / remaining gap |
| --- | --- | --- |
| Three-step Leave Details → Handover/Documents → Review flow | Implemented | The employee modal has three guarded steps and a review screen. |
| Working-day calculation and balance preview | Implemented | The server creates a transient leave calculation and evaluates live balance/policy data. |
| Eligibility, notice, booking window, blackout, overlap and balance checks | Implemented | Central Leave Type policy evaluation covers these rules; validation is repeated server-side. |
| Required supporting document blocks submission | Implemented | Required policy and conditional duration rules are checked by the server. |
| Save Draft and recover every entered field | Missing | The employee flow submits directly; no draft action or draft restoration path exists. |
| Changes Requested edit and same-record resubmission | Implemented | The employee edits the existing `hr.leave`; a new Stage-1 approval instance is created while history is retained. |
| Rejected Edit & Request Again | Implemented | Rejected requests use the same same-record resubmission path. |
| Manual and AI-assisted entry provenance | Partial | `submission_channel` is stored. A governed provider-backed parsing/voice flow is outside this baseline. |

## C. Six-action approval decision surface

| Action | Status | Required behavior / gap |
| --- | --- | --- |
| Approve | Implemented | Current assigned approver decisions use `cleon.approval.instance`. Single, Any One and All Approvers are supported. |
| Reject | Implemented | Category and comments are mandatory and the generic approval instance records the decision. |
| Request Changes / Return | Implemented | Distinct status, required comment, employee edit, same-record resubmission and new Stage-1 instance are present. |
| Request More Information | Missing | Must add a clarification thread/message without changing approval status, closing the active step or requiring full resubmission. Employee reply must return to the same pending approval context. |
| Flag / Escalate by approver | Missing | Existing employee escalation and automatic SLA escalation are not the specified approver-initiated sensitive/high-risk escalation action. Destination must come from configured workflow rules. |
| View Leave Profile | Partial | Current detail exposes request-local facts and AI-derived history summaries, but not the complete permission-filtered balance/history/pattern/team-calendar profile. |

Request More Information and Request Changes must remain separate state machines:

```text
Request More Information → approval remains Pending → clarification/reply
Request Changes          → Changes Requested → editable request → resubmission
```

## D. Handover policy

Current state: **Partial**.

Implemented foundations:

- opt-in Handover toggle;
- one or more same-company active backup colleagues;
- reachout information and 500-character notes;
- server validation and request-detail display; and
- persistence during Changes Requested / rejected resubmission.

Missing contract implementation:

- policy modes `not_required`, `optional` and `required`;
- explicit `Add Handover` / `Skip` semantics;
- a snapshotted effective Handover requirement on submission;
- employee `Always Skip` preference;
- organisation-level permission to offer `Always Skip`;
- duration-, role- and policy-based overrides that force Handover;
- post-submit add/edit Handover independent of full request resubmission; and
- the later Handover task/status/history lifecycle.

The existing fields on `hr.leave` are adequate for the current basic payload.
Before tasks, independent status and later editing are added, introduce a linked
Handover record rather than continuing to grow workflow columns on `hr.leave`.

## E. Supporting-document policy

Current state: **Partial**.

The current `always`, `conditional` and `never` configuration can determine
whether a new request is blocked, and uploads are permitted even when not
required. It does not yet model the specification explicitly as `not_required`,
`optional` and `required`, nor does it snapshot the effective requirement.

Required implementation rules:

1. Resolve the effective rule through the policy hierarchy when a request or
   extension is submitted.
2. Store a snapshot containing at least mode, threshold/rule, policy source and
   policy/version identifier.
3. Validate the attachment against that snapshot, not the Leave Type's current
   value, throughout the submitted object's lifecycle.
4. A later policy change applies only to new submissions.
5. An extension gets its own document requirement snapshot and attachments; its
   documents must not be confused with the original request's documents.

## F. Leave Extension

Current state: **Missing**. Calendar labels such as `extension_pending` are only
presentation vocabulary; they are not an extension workflow.

### Business object

Introduce a distinct `hr.leave.extension` linked to one approved/active
`hr.leave`. Minimum state model:

```text
draft → pending → approved
                → rejected
                → withdrawn
```

Minimum authoritative data:

- original leave and employee/company;
- original effective leave end and expected return;
- requested new return date;
- calculated additional working days;
- required reason;
- document-rule snapshot and extension-specific attachments;
- approval-route source/snapshot and approval instance linkage;
- submitter, submission time, decision data and withdrawal data; and
- immutable before/after balance/date values used at finalisation.

### Entry and validation

- Available only for the employee's own approved/active, non-cancelled leave, or
  through an explicitly authorised HR `Process Extension` action.
- New return date must be later than the current effective return boundary.
- Reason is required.
- Calculate only additional scheduled working days, excluding non-working days
  and public holidays under the employee's applicable calendar.
- Reuse central eligibility, balance, blackout, coverage, conflict and policy
  rules with an extension-aware date window and overlap exclusion.
- A required extension document blocks submission.
- Only one unresolved extension may exist for the leave at a time; enforce this
  with a database-safe open-key/constraint pattern.

### Approval routing

“Same approval route” means the same route definition that governed the original
leave, but a new `cleon.approval.instance` targeting the extension object. It
does not mean reopening the original instance.

The generic engine currently snapshots resolved steps/users into an instance but
does not retain a direct chain/version identifier. Extension implementation must
therefore define an explicit route-snapshot contract rather than silently using
whatever Leave Type configuration happens to be current.

### Outcomes

Approved:

- atomically update the original leave's effective end/return boundary;
- deduct only the additional approved working days;
- extend Calendar and coverage;
- preserve the original approval instance/history; and
- add linked extension approval and before/after audit events.

Rejected or withdrawn:

- retain original dates, balance, Calendar and coverage exactly;
- retain the extension and its decision/history for audit; and
- continue return evaluation against the original boundary.

## G. Attendance-driven Return From Leave

Current state: **Missing**.

`hr_time_management` already owns the `hr.attendance` extension and depends on
`hr_leave_dashboard`. Attendance-to-leave event detection belongs in that module
or a later bridge depending on both modules. `hr_leave_dashboard` must not gain a
reverse dependency on `hr_time_management`.

### Normal automatic return

On attendance creation, after time-zone and work-date normalization:

1. find an active approved leave whose effective return boundary is on or before
   that clock-in;
2. record Returned, actual return datetime, attendance record and method;
3. update Calendar and coverage; and
4. create an idempotent system audit event.

No approval or manual confirmation is used for the normal integrated path.

### Early return

A clock-in before the effective expected return creates a distinct Early Return
event. It must not shorten the leave or restore balance automatically.

- Manager/HR approval shortens the effective leave to the accepted actual return
  boundary, restores only unused working days, updates Calendar/coverage and
  audits before/after values.
- Rejection preserves the original effective leave and balance.
- Repeated or corrected attendance events must not create duplicate open Early
  Return events.

### Manual fallback

Manual confirmation is available only for locations/workers using a configured
non-attendance or hybrid return method. It is not an organisation-wide fallback
button shown to every employee.

## H. Return Overdue

Current state: **Missing**, with a **Product decision** required for the final
action surface.

Before raising Return Overdue, the evaluator must check in this order:

1. whether return was already recorded by any configured method;
2. whether an approved extension moves the governing return boundary;
3. whether a pending extension suppresses overdue until its decision;
4. whether a rejected/withdrawn extension leaves the original boundary; and
5. whether the governing boundary has actually passed.

The overdue evaluator must be idempotent and company/time-zone aware. It creates
an operational exception, notifications and audit—not an automatic misconduct
finding.

## I. Product reconciliation items

### P8-01 — Return Overdue actions

The chapter provides two non-equivalent descriptions:

- five actions: Send Return Reminder, Process Extension, Record Return,
  Escalate, Review Leave Record;
- three outcomes: Confirm Return, Approve Late Extension, Flag Unauthorised
  Absence.

Recommended coherent mapping:

1. Keep the five-action workspace as the primary UI.
2. `Record Return` covers authorised Confirm Return.
3. `Process Extension` creates a normal, approval-routed late extension; it does
   not directly approve one.
4. `Escalate` uses the configured Return Overdue escalation workflow.
5. `Flag Unauthorised Absence` is a governed downstream outcome available only
   after the organisation's review process, never a first-line automatic action.

Product must confirm this mapping before Return Overdue implementation.

### P8-02 — Date terminology

The source alternates between “leave end date” and “new return date”. Odoo leave
dates are inclusive, while a return date commonly means the first day back.
Product must confirm whether the entered New Return Date is:

- the final day of leave; or
- the first expected working day back.

The UI, working-day calculation and attendance trigger must use one definition.
Recommended choice: store both an effective inclusive leave end and a derived
expected-return boundary; label the employee input unambiguously.

### P8-03 — Meaning of same approval route

Product must confirm how later route changes affect an extension:

- snapshot route that governed the original leave (**recommended**); or
- current route configured for that Leave Type when extension is submitted.

The wording “same route as original” supports the snapshot interpretation.

### P8-04 — Pending extension timeout

The requirement suppresses Return Overdue while an extension is pending but does
not define a maximum suppression period or escalation behavior. Use configured
approval SLA/escalation and do not invent automatic approval or rejection.

### P8-05 — Return method configuration

The location/global ownership and precedence among Attendance Clock-In,
Employee Self-Confirmation, Manager Confirmation, HR-Recorded and Hybrid need a
final configuration contract. Recommended precedence: employee/location policy,
then company default, with attendance clock-in as the default.

## J. Recommended implementation sequence

1. **Request More Information, approver Flag/Escalate and Leave Profile** —
   complete the signed-off approval workspace without changing engine ownership.
2. **Policy snapshots** — explicit document modes, Handover modes, `Always Skip`
   governance and immutable submission snapshots.
3. **Leave Extension domain model** — security, state machine, working-day
   preview, attachments, audit and distinct generic approval instance.
4. **Extension UI and finalisation** — employee/HR entry, queue/detail actions,
   atomic date/balance/calendar outcomes and rejection/withdrawal invariants.
5. **Attendance-driven Return** — normal automatic return and idempotent audit in
   `hr_time_management`.
6. **Early Return** — separate review object, approval outcome and balance
   restoration.
7. **Return Overdue and manual fallback** — only after P8-01 and P8-05 are
   confirmed.
8. **Lifecycle regression suite** — cross-company/RBAC, concurrency,
   policy-snapshot history, extension outcomes, repeated attendance events,
   time zones and full audit linkage.

## K. Minimum verification matrix for later implementation

- An employee cannot extend another employee's leave or a draft/rejected leave.
- An Operations user cannot approve merely because they can administer records.
- System Administrator membership alone never grants a business decision.
- An extension cannot end on/before the governing current return boundary.
- Two concurrent submissions cannot create two open extensions for one leave.
- Pending extension creates no balance, date or Calendar mutation.
- Rejection/withdrawal preserves original dates and balance byte-for-byte.
- Approval deducts exactly the additional working days once.
- Approval uses a distinct instance and preserves the original instance.
- Later policy edits do not change submitted document/Handover requirements.
- A pending extension suppresses overdue at the original boundary.
- An approved extension moves the overdue boundary.
- A rejected extension restores the original overdue boundary.
- Normal on/after-boundary clock-in returns the leave exactly once.
- Early clock-in creates review and never restores balance automatically.
- Attendance correction/deletion has an explicit reconciliation behavior.
- Manual return controls are absent where attendance-only mode applies.
- Return Overdue never creates Unauthorised Absence automatically.
- Every outcome is permission-scoped, company-isolated and auditable.

