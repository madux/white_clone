# Approval integration contract (Odoo 17)

## Ownership

Depend on cleon_approval. Business addons own their request records, permissions,
submission validation and final state transitions. The engine owns route selection,
step snapshots, decisions, activities and SLA processing. Do not implement a second
approval loop in a consumer. This is an Odoo addon, not a framework-independent library.
The core depends on standard base, mail and hr addons. Some configuration selection
values are still Leave-oriented; consumers can extend them using selection_add.

## Required target-model hooks

Register a cleon.approval.workflow.type with a unique code and the target ir.model.
The target model must implement:

- _approval_workflow_code(): registered code.
- _approval_employee(): one hr.employee record.
- _approval_company(): one res.company record.
- _approval_period(): start and end dates.
- _approval_validate_decision(decision, automated=False, comment=False): enforce
  business invariants for human AND automated decisions. Raise on invalid decisions.
- _approval_finalize_approve(): finalize the original request.
- _approval_finalize_reject(comment): reject the original request.

Optional hooks include _approval_rule_context() (condition values),
_approval_resolve_chain(workflow_type) (explicit route or fallback), and
_approval_finalize_request_changes for consumers supporting corrections.
Inspect approval_instance.py for the full signature of any optional hook before use.
Never trust client-supplied employee, company, route, automation or permission flags.

After consumer-side submission validation, call
self.env['cleon.approval.instance'].action_start(request_record).
Approvers call instance.action_decide('approve' | 'reject' | 'request_changes', comment=...).
Automation is trusted server code only and requires a sudo environment; never expose
an RPC wrapper that lets a caller opt into sudo or automated=True.
Cancel superseded requests through action_cancel_for_target(request_record, reason=...).
Do not directly edit execution states from a frontend.

## Supported behavior and limits

- Explicit routes take precedence, then matching rules (lowest priority first), then
  the configured default route. An explicit fallback bypasses default routes.
- Step completion supports single, any and all approvers; self-approval is prohibited.
- Approval proceeds to the next level; rejection stops the request. Custom actions,
  return-to-level and early-complete options are not implemented and are not offered.
- SLA supports minutes, hours and calendar days. Working days are not implemented;
  old working_days rules must be reconfigured, not interpreted as calendar days.
- Escalation supports next level, selected role/user, and notify-only. The final
  level remains pending if there is no next level. Auto-rejection is a separate,
  explicitly configured step SLA action.
- The scheduler currently runs hourly. Minute-based deadlines therefore do NOT
  imply minute-level delivery; configure the cron cadence to match your SLA needs.
- Notifications use Odoo notification delivery. A configured mail transport is needed
  for email delivery. Inbox success does not prove email delivery.
- Delegation is one-hop and applied when approvers are resolved. Existing pending
  steps are not dynamically reassigned when a delegation is added or expires.
  Do not promise out-of-office coverage for an already-open queue yet.
- Route steps/users are snapshotted; escalation notification scope is still read from
  the referenced rule. Full immutable policy-version semantics remain outstanding.

## Release gate

Use a disposable test database, not a demonstration/production database. The existing
concurrency test commits independent fixtures. Run the Odoo test runner with test tags
for cleon_approval after installing the module and its dependencies.

Before publishing: test a clean install without Leave, simultaneous decisions and SLA
workers, actual mail delivery, delegation lifecycle for open requests, and migration
of legacy unsupported routing/deadline settings. Run consumer-module tests as well.
No compatibility or production-readiness guarantee is implied by unit tests alone.

## Optional HR Administration integration

Install cleon_approval_hr_administration alongside both modules to attach the core menu
to HR Administration and apply its custom menu metadata. It auto-installs when both
dependencies are installed. Upgrade the bridge together with the core so menu parenting
is reapplied. The core itself does not depend on Cleon menu customizations.

Legacy routing enum values are retained for data preservation, labelled unsupported,
and shown read-only. Submission fails with a configuration error until an administrator
reviews the intended policy and explicitly changes it to supported next/stop behavior.
The audit found three complete-on-approval routes. Complete is supported for a single
level (normal final-step completion), but rejected for multiple levels. No stored policy
settings were rewritten.

Complete Workflow is supported for a single approval level only; early completion of
a multi-level route remains unsupported.
