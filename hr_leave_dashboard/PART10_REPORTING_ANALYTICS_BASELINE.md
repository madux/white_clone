# Part 10 — Reporting & Analytics implementation baseline

This file records the report contract implemented from Section 10.1 and 10.1b. It prevents a chart label or temporary schema detail from silently becoming a different business definition.

## Access and data contract

- Reports remains an existing top-level Leave screen. Menu order in illustrative screenshots is not authoritative.
- A user with team visibility receives only direct-report employees resolved by `leave_manager_id` or reporting manager. Operational/strategic reporting roles receive the active company's organisation scope. A URL or RPC cannot widen that scope.
- Every filter is applied again by the server. Department, Location, Unit, Leave Type and Employee accept multiple values.
- Every export regenerates the selected report under the current user's scope and filters. CSV, XLSX and PDF are real formats.
- Only the selected report is calculated. Report selection is not allowed to trigger all analytics or a workforce-wide Bradford recalculation.

## Metric definitions

| Report | Implemented definition |
| --- | --- |
| Leave Utilisation | Current balance-ledger entitlement versus used days. Because this is a current snapshot, the period selector is hidden and the UI says so. |
| Leave Balance Summary | Current available, used, pending, carried-forward and expiring ledger components as of today. The period selector is hidden. |
| Request Volume | Non-draft requests whose submission `create_date` falls in the selected period, grouped by month and current outcome. Prior-period comparison uses an immediately preceding range of equal length. |
| Approval Turnaround | Overall submission-to-terminal decision for the headline and Leave Type breakdown. Approver breakdown measures the interval from submission/previous workflow decision to that approver's audit event, so multi-level approvers are not collapsed into the final actor. |
| Absence Trends | Approved requests overlapping the period. Requests appear in every touched month and their stored leave days are apportioned across the calendar span, so boundary-spanning leave does not disappear. |
| Leave Frequency | Requests overlapping the selected period, ranked by raw request count. Total approved days are shown. The denominator is current active scoped headcount in the selected Department/Location/Unit; this basis must remain visible and will require effective-dated organisation history before historical headcount is possible. |
| Policy Usage | Uses the current authoritative policy controls stored on `hr.leave.type` (eligibility, notice, consecutive-day and blackout controls). If a separate versioned Leave Policy model is introduced, this report must migrate to it rather than duplicate rules. |
| Absence Risk | Current snapshot for the configured rolling window ending today. The period selector is hidden. |

## Bradford Factor contract

- Formula: `S² × D`, where `S` is the number of continuous absence spells and `D` is calendar days across those spells.
- Adjacent records are merged before minimum spell length is applied. Non-working days between records do not split a spell when the employee had no scheduled return-to-work day between them.
- Existing/new Sick, Illness or Medical Leave Types default to short-notice-only treatment unless explicitly configured. Annual/Vacation and Maternity/Paternity/Parental Leave Types are mandatory exclusions and cannot be enabled by configuration.
- A per-request HR exclusion exists for formally approved long-term arrangements and requires a reason. Changes are immutable Audit Log events.
- HR Administrator/HR Director can view numeric scores, formula inputs and configuration. Managers receive only Low/Watch rows for their own team, without severity distribution, thresholds, spell counts or scoring modes. Other reporting roles receive only their authorised aggregate. Employees have no report access through this capability.
- Band crossings notify relevant HR roles and are audited. Configuration and risk exports are audited with the actual actor role. Scores are advisory only and never change leave approval, eligibility or balances.
- Immediate leave lifecycle hooks and a nightly job maintain the snapshot. Report viewing reads the snapshot and only bootstraps missing rows.

## Explicitly deferred dependencies

- AI Fraud & Anomaly Detection is a separate Part 12 capability. It is not simulated by Bradford scoring.
- Return Compliance, Coverage Risk, Policy Conflict and Leave Extension reports require their authoritative lifecycle records from the relevant chapters. They must not be populated with inferred/sample values.
- Truly historical Department/Location/Unit denominators require effective-dated organisation assignments, which the current employee schema does not provide.

