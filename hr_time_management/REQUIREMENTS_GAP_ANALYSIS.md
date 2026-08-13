# Time Management preliminary requirements map

This document records the preliminary functional specification received on
2026-08-12. It is a development contract and gap register, not a substitute for
the forthcoming screen-by-screen UI specification.

## Architecture decisions

| Area | System of record | CleonHR extension |
|---|---|---|
| Attendance | `hr.attendance` | status, shift, break, controlled edits and audit |
| Working schedule | `resource.calendar` | named shift templates and dated assignments |
| Leave/absence | `hr.leave` | attendance status coordination |
| Task timesheets | `account.analytic.line` through `hr_timesheet` | approval/variance layer to be specified |
| Overtime | `hr.attendance` worked/overtime hours | policy, request, categorisation and payroll handoff |
| Multi-tenancy | database isolation plus `company_id` | every configuration/transaction remains company scoped |

## Covered in the foundation

- Live daily attendance dashboard and historical attendance sheets.
- Automatic Present/Late/Absent/On Leave status foundation.
- Attendance detail and controlled manual correction with mandatory reason.
- Regularisation request model and submit/approve/reject workflow.
- Audit records with performer, timestamps and before/after values.
- Shift templates with type, times, break, grace and recurrence metadata.
- Dated employee or department shift assignment and temporary overrides.
- Company policy fields for work week, hours, breaks, grace, clock method,
  overtime thresholds/rates, integration switches and launch state.
- Permission-aware Admin/Employee view switching: managers may preview both;
  ordinary employees are forced into their own self-service view.
- Employee clock-in/out backed by Odoo attendance, with immediate button-state
  change, success feedback and audit recording.
- Employee monthly attendance history and summary KPIs.
- Community dependencies: `hr_attendance`, `hr_holidays`, and `hr_timesheet`.
- Attendance rows expose a normalized integration view containing assigned
  shift, expected/net hours, matching analytic-timesheet hours, variance,
  weekend/public-holiday flags, and categorized overtime hours/rate.
- CleonHR clock-in snapshots the effective shift and break policy onto the
  native attendance record so later policy changes do not rewrite history.
- The policy API persists overtime multipliers/request mode, synchronization
  frequency, module integration switches, and launch scheduling fields.

## Required but awaiting detailed UI/business rules

### Setup wizard (8 steps)

1. Welcome/overview and optional introduction media.
2. Company policies.
3. Shift templates.
4. Overtime rules.
5. Approval hierarchy, default approvers and escalations.
6. Integration selection and synchronization frequency.
7. Role/access review.
8. Review, test clock-in/out, schedule launch or go live.

The policy and shift persistence layer exists. Wizard screens and resumable
progress should be implemented when their final UI is supplied.

### Attendance

- GPS perimeter/accuracy rules and trustworthy location verification.
- Biometric device adapters and device identity mapping.
- IP allowlists and verification.
- Monthly colour-coded attendance calendar and half-day classification.
- Payroll-period lock and privileged unlock workflow.
- Manual attendance creation screen and bulk operations.
- Employee monthly calendar, day detail tooltips and PDF export.
- Optional manager clock event notification and end-of-day summary.
- Configurable automatic check-out at shift end and half-day classification.

Do not treat browser-provided GPS/IP text as verified until the security and
device integration rules are agreed.

### Shifts

- Split-shift intervals (one start/end pair is insufficient).
- Rotating pattern cycle lines and recurrence engine.
- Team/unit/branch assignment scopes.
- Conflict detection, coverage validation and future schedule calendar.
- Override approval rules.

### Timesheets

- Draft/submitted/approved/rejected lifecycle layered over analytic lines.
- Required task descriptions, multi-project support and hours validation.
- Attendance-cap and overtime-excess variance rules.
- Manager review and payroll-billable output mapping.

Attendance-to-timesheet comparison is operational and read-only. Automatic
creation of analytic lines remains deferred because a valid project/task and
description cannot be inferred safely from an attendance check-in.

### Overtime

- Daily/weekend/holiday categorisation using company calendars.
- Automatic calculation versus manual request reconciliation.
- Threshold and multiplier application, approval hierarchy and caps.
- Payroll-ready output contract and locked-period behaviour.
- Employee request/history UI and cancellation rules.

Daily/weekend/public-holiday classification and multiplier selection are now
available on normalized attendance rows. Approval requests, caps and payroll
posting remain deferred until their state transitions and target payroll model
are confirmed.

### Cross-cutting

- Role model: Employee, Line Manager, HR Manager, HR Administrator, System
  Administrator, including own/team/company boundaries.
- Notification templates, reminders, escalation jobs and bulk actions.
- Reports, trends and exports across all four areas.
- Performance KPI and Employee Service Portal contracts.
- Anomaly detection and predictive overtime only after enough clean historical
  data exists; no placeholder “AI” decisions should affect payroll.

## Implementation rule

Backend methods must not be left as executable empty stubs. Pending functions
remain documented here until their inputs, permissions, state transitions and
failure behaviour are known. This avoids exposing buttons that appear to work
but silently lose or miscalculate payroll-relevant data.
