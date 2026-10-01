# -*- coding: utf-8 -*-
import logging
from datetime import datetime, timedelta
from psycopg2 import IntegrityError

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError

_logger = logging.getLogger(__name__)


class CleonApprovalInstance(models.Model):
    _name = "cleon.approval.instance"
    _description = "CleonHR Active Approval Workflow Instance"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "id desc"

    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)
    workflow_type_id = fields.Many2one("cleon.approval.workflow.type", required=True, index=True, string="Workflow Type")
    res_model = fields.Char(required=True, index=True, string="Resource Model")
    res_id = fields.Integer(required=True, index=True, string="Resource ID")
    employee_id = fields.Many2one("hr.employee", required=True, index=True)
    open_key = fields.Char(index=True, help="Database uniqueness key enforced while instance is pending")
    current_step_sequence = fields.Integer(default=10, required=True)
    state = fields.Selection([
        ("pending", "Pending Approval"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("changes_requested", "Changes Requested"),
        ("cancelled", "Cancelled"),
    ], default="pending", required=True, tracking=True, index=True)
    decision_source = fields.Selection([
        ("human", "Human Decision"),
        ("sla_cron", "SLA Cron Escalation"),
        ("business_rule", "Business Rule Auto-Approve"),
        ("policy_bypass", "Policy Bypass / Require Approval Off"),
    ], default="human")
    decision_comment = fields.Text()
    step_ids = fields.One2many("cleon.approval.instance.step", "instance_id", string="Instance Steps")
    source_chain_id = fields.Many2one("cleon.approval.chain", readonly=True, ondelete="restrict", index=True)
    source_rule_id = fields.Many2one("cleon.approval.rule", readonly=True, ondelete="restrict", index=True)

    _sql_constraints = [
        ("open_key_unique", "unique(open_key)", "Another active approval instance is already pending for this record."),
    ]

    @api.model
    def _resolve_workflow_type(self, res_record):
        wf_code = res_record._approval_workflow_code()
        wft = self.env["cleon.approval.workflow.type"].sudo().search([
            ("code", "=", wf_code),
            ("active", "=", True),
        ], limit=1)
        if not wft:
            raise UserError(_("No active approval workflow type registered for workflow code '%s'.") % wf_code)
        if wft.model_name != res_record._name:
            raise ValidationError(
                _("Approval workflow code '%s' is registered for model '%s', not '%s'.")
                % (wf_code, wft.model_name, res_record._name)
            )
        return wft

    @api.model
    def record_automatic_decision(self, res_record, decision="approve", source="business_rule", reason=False):
        """Records an automated workflow approval/rejection decision and finalizes target record without requiring a configured chain."""
        model_name = res_record._name
        employee = res_record._approval_employee()
        company = res_record._approval_company()

        # Execute decision-aware validation hook
        res_record._approval_validate_decision(decision, automated=True, comment=reason)

        wft = self._resolve_workflow_type(res_record)

        self.action_cancel_for_target(res_record, reason=_("Replaced by automated decision (%s).") % source)

        state_val = "approved" if decision == "approve" else ("changes_requested" if decision == "request_changes" else "rejected")
        inst = self.sudo().create({
            "company_id": company.id if company else False,
            "workflow_type_id": wft.id,
            "res_model": model_name,
            "res_id": res_record.id,
            "employee_id": employee.id if employee else False,
            "open_key": False,
            "current_step_sequence": 10,
            "state": state_val,
            "decision_source": source,
            "decision_comment": reason or (_("Auto-approved by policy (%s).") % source if decision == "approve" else _("Auto-rejected by policy (%s).") % source),
        })
        if decision == "approve":
            res_record._approval_finalize_approve()
        elif decision == "reject":
            res_record._approval_finalize_reject(reason)
        elif decision == "request_changes":
            res_record._approval_finalize_request_changes(reason)
        return inst

    @api.model
    def action_start(self, res_record, decision_source="human", auto_approve_reason=False):
        """Start a new approval workflow instance for res_record.

        1. If decision_source == 'business_rule', automatically approve and record history even if no chain exists.
        2. If an active default chain exists, create a multi-step instance from the chain steps.
        3. If no chain exists, evaluate company policy:
           - If require_approval is False: auto-approve via record_automatic_decision.
           - If require_approval is True: resolve fallback approver and create a 1-step fallback instance.
        """
        if decision_source == "business_rule":
            return self.record_automatic_decision(res_record, decision="approve", source="business_rule", reason=auto_approve_reason)

        company = res_record._approval_company()
        employee = res_record._approval_employee()
        model_name = res_record._name

        wft = self._resolve_workflow_type(res_record)

        if wft.approval_requirement == "no":
            return self.record_automatic_decision(
                res_record, decision="approve", source="policy_bypass",
                reason=_("Workflow Type '%s' is configured for automatic processing.") % wft.name,
            )

        target_chain = False
        skip_default_chain = False
        if hasattr(res_record, "_approval_resolve_chain"):
            target_route = res_record._approval_resolve_chain(wft)
            route_code = target_route if isinstance(target_route, str) else False
            if route_code in ("none", "no_approval") or (isinstance(target_route, dict) and not target_route.get("require_approval", True)):
                # A native no-validation target may already be final.  When a
                # shared leave type is pending-capable because another policy
                # requires approval, explicitly finalise this employee's
                # policy bypass instead of leaving the request stuck pending.
                if getattr(res_record, "state", False) in ("validate", "done", "approved"):
                    return False
                return self.record_automatic_decision(
                    res_record,
                    decision="approve",
                    source="policy_bypass",
                    reason=_("Approval is disabled by the governing policy."),
                )
            elif route_code in ("fallback", "single_fallback"):
                # Target explicitly specifies fallback single-approver; do not use default chain
                skip_default_chain = True
            elif target_route:
                # Explicit chain returned: MUST be valid or fail closed immediately
                if not target_route.active:
                    raise UserError(_("Configuration Integrity Error: Target approval chain '%s' is inactive.") % target_route.name)
                if target_route.company_id and target_route.company_id != company:
                    raise UserError(_("Configuration Integrity Error: Target approval chain '%(chain)s' belongs to company '%(chain_comp)s', not '%(target_comp)s'.") % {
                        "chain": target_route.name,
                        "chain_comp": target_route.company_id.name,
                        "target_comp": company.name,
                    })
                if target_route.workflow_type_id and target_route.workflow_type_id != wft:
                    raise UserError(_("Configuration Integrity Error: Target approval chain '%(chain)s' is for workflow '%(wft_chain)s', expected '%(wft_req)s'.") % {
                        "chain": target_route.name,
                        "wft_chain": target_route.workflow_type_id.name,
                        "wft_req": wft.name if wft else "",
                    })
                if not target_route.step_ids:
                    raise ValidationError(_("Configuration Integrity Error: Target approval chain '%s' has no configured steps.") % target_route.name)
                target_chain = target_route

        matching_rule = self.env["cleon.approval.rule"]
        if not target_chain and not skip_default_chain and wft.rules_enabled:
            matching_rule = self.env["cleon.approval.rule"].matching_rule(wft, res_record)
            target_chain = matching_rule.chain_id if matching_rule else False

        chain = target_chain or wft.default_chain_id
        if chain and not chain.active:
            raise UserError(_("Configuration Integrity Error: Default Approval Route '%s' is inactive.") % chain.name)
        if not chain and not skip_default_chain:
            chain = (self.env["cleon.approval.chain"].sudo().search([
                ("company_id", "=", company.id),
                ("workflow_type_id", "=", wft.id if wft else False),
                ("active", "=", True),
                ("is_default", "=", True),
            ], limit=1) if wft else False)

        if not chain and not skip_default_chain and wft.approval_requirement == "conditional":
            return self.record_automatic_decision(
                res_record, decision="approve", source="business_rule",
                reason=_("No conditional approval rule matched Workflow Type '%s'.") % wft.name,
            )

        open_key_str = "%s,%s" % (model_name, res_record.id)

        # 2. Advanced default or target-specific chain configured -> use chain
        if chain:
            if not chain.step_ids:
                raise ValidationError(_("Approval chain '%s' has no configured steps.") % chain.name)

            existing = self.sudo().search([("open_key", "=", open_key_str)], limit=1)
            if existing:
                return existing

            instance_vals = {
                "company_id": company.id,
                "workflow_type_id": wft.id,
                "res_model": model_name,
                "res_id": res_record.id,
                "employee_id": employee.id,
                "open_key": open_key_str,
                "current_step_sequence": chain.step_ids[0].sequence,
                "state": "pending",
                "decision_source": decision_source,
            }
            if "source_chain_id" in self._fields:
                instance_vals["source_chain_id"] = chain.id
            if matching_rule:
                instance_vals["source_rule_id"] = matching_rule.id

            try:
                with self.env.cr.savepoint():
                    instance = self.sudo().create(instance_vals)
            except IntegrityError:
                return self.sudo().search([("open_key", "=", open_key_str)], limit=1)

            instance_steps = []
            emp_user = employee.sudo().user_id
            for step in chain.step_ids.sorted("sequence"):
                resolved_users = self.env["res.users"]
                # 1. Target-specific runtime resolver hook
                if hasattr(res_record, "_approval_resolve_step_users"):
                    resolved_users = res_record._approval_resolve_step_users(step, employee)

                if not resolved_users:
                    if step.approver_type == "line_manager":
                        manager_user = (
                            getattr(employee.sudo(), "leave_manager_id", False)
                            or employee.sudo().parent_id.sudo().user_id
                        )
                        if not manager_user or not manager_user.active:
                            raise UserError(_("Submission blocked: Employee '%s' does not have an active line manager user.") % employee.sudo().name)
                        resolved_users = manager_user
                    elif step.approver_type == "managers_manager":
                        resolved_users = employee.sudo().parent_id.sudo().parent_id.sudo().user_id
                    elif step.approver_type == "department_head":
                        resolved_users = employee.sudo().department_id.sudo().manager_id.sudo().user_id
                    elif step.approver_type == "job":
                        resolved_users = self.env["hr.employee"].sudo().search([
                            ("company_id", "=", company.id), ("job_id", "=", step.approver_job_id.id),
                            ("active", "=", True), ("user_id", "!=", False),
                        ]).mapped("user_id")
                    elif step.approver_type == "group":
                        if not step.approver_group_id:
                            raise ValidationError(_("Step '%s' is missing an approver group.") % step.name)
                        resolved_users = step.approver_group_id.users
                    elif step.approver_type == "specific_user":
                        if not step.specific_user_id or not step.specific_user_id.active:
                            raise UserError(_("Submission blocked: Specific approver user for step '%s' is inactive or unassigned.") % step.name)
                        resolved_users = step.specific_user_id
                    elif step.approver_type == "specific_users":
                        if not step.approver_user_ids:
                            raise ValidationError(_("Step '%s' has no designated approver users.") % step.name)
                        resolved_users = step.approver_user_ids.filtered(lambda u: u.active)
                    elif step.approver_type == "target_resolver":
                        raise UserError(_("Submission blocked: No approver could be dynamically resolved for step '%s'.") % step.name)

                # Central company-validation and employee self-filtering for EVERY step.
                filtered_step_users = resolved_users.sudo().filtered(lambda u: u.active and company.id in u.company_ids.ids)
                if emp_user:
                    filtered_step_users = filtered_step_users.filtered(lambda u: u.id != emp_user.id)
                if not filtered_step_users and getattr(chain, "backup_approver_ids", False):
                    filtered_step_users = chain.backup_approver_ids.filtered(
                        lambda u: u.active and company.id in u.company_ids.ids and u != emp_user
                    )
                filtered_step_users = self.env["cleon.approval.delegation"].apply_to_users(
                    filtered_step_users, company, excluded_user=emp_user,
                )

                # Strict cardinality validation based on step.completion_mode
                if step.completion_mode == "single":
                    if len(filtered_step_users) != 1:
                        raise UserError(_(
                            "Step '%(step)s' configured for 'Single Approver' must resolve to exactly one eligible approver, but %(count)d were found. Please configure a unique user or use 'Any One' / 'All' mode for multi-member groups."
                        ) % {"step": step.name, "count": len(filtered_step_users)})
                elif step.completion_mode in ("any", "all"):
                    if not filtered_step_users:
                        raise UserError(_("Submission blocked: No active approver user found in company '%s' for step '%s'. Self-approval is prohibited.") % (company.name, step.name))

                resolved_users = filtered_step_users

                escalation = self.env["cleon.approval.escalation.rule"].sudo().search([
                    ("workflow_type_id", "=", wft.id), ("chain_id", "=", chain.id),
                    ("step_id", "=", step.id), ("active", "=", True),
                ], limit=1) if wft.escalation_enabled else self.env["cleon.approval.escalation.rule"]
                escalation_action = {
                    "next": "escalate_next", "role": "reassign_role",
                    "employee": "reassign_user", "notify": "notify_only",
                }.get(escalation.escalation_action) if escalation else step.sla_action
                inst_step_vals = {
                    "instance_id": instance.id,
                    "sequence": step.sequence,
                    "name": step.name,
                    "completion_mode": step.completion_mode,
                    "approver_type": step.approver_type,
                    "step_code": step.step_code or False,
                    "resolved_user_ids": [(6, 0, resolved_users.ids)],
                    "state": "waiting",
                    "sla_timeout_hours": (escalation.timeout_hours() if escalation else (wft.global_sla_hours if wft.use_global_sla else step.sla_timeout_hours)) if wft.escalation_enabled else 0,
                    "sla_action": escalation_action,
                    "escalation_rule_id": escalation.id,
                    "escalation_target_group_id": escalation.target_group_id.id,
                    "escalation_target_user_id": escalation.target_user_id.id,
                }
                instance_steps.append(inst_step_vals)

            self.env["cleon.approval.instance.step"].sudo().create(instance_steps)
            instance.invalidate_recordset(["step_ids"])
            first_step = instance.step_ids.filtered(lambda s: s.sequence == instance.current_step_sequence)
            if first_step:
                first_step.action_activate()
            return instance

        # 3. No advanced chain -> check generic target record fallback config
        require_approval = True
        resolved_users = self.env["res.users"]
        if hasattr(res_record, "_approval_fallback_config"):
            fallback_config = res_record._approval_fallback_config()
            require_approval = fallback_config.get("require_approval", True)
            resolved_users = fallback_config.get("fallback_users", self.env["res.users"])
        else:
            # Default generic fallback: direct manager or cleon_approval manager group
            parent_user = employee.sudo().parent_id.sudo().user_id
            if parent_user and parent_user.active:
                resolved_users = parent_user
            else:
                mgr_group = self.env.ref("cleon_approval.group_cleon_approval_manager", raise_if_not_found=False)
                if mgr_group:
                    resolved_users = mgr_group.users

        if not require_approval:
            return self.record_automatic_decision(res_record, decision="approve", source="policy_bypass", reason=_("Require Approval is disabled in policy."))

        # Central company-validation and employee self-filtering
        emp_user = employee.sudo().user_id
        target_company_id = company.id
        filtered_users = resolved_users.sudo().filtered(lambda u: u.active and target_company_id in u.company_ids.ids)
        if emp_user:
            filtered_users = filtered_users.filtered(lambda u: u.id != emp_user.id)

        if not filtered_users:
            raise UserError(_("Submission blocked: No active approver user found in company '%s' for employee '%s'.") % (company.name, employee.sudo().name))

        resolved_users = filtered_users

        existing = self.sudo().search([("open_key", "=", open_key_str)], limit=1)
        if existing:
            return existing

        instance_vals = {
            "company_id": company.id,
            "workflow_type_id": wft.id if wft else False,
            "res_model": model_name,
            "res_id": res_record.id,
            "employee_id": employee.id,
            "open_key": open_key_str,
            "current_step_sequence": 10,
            "state": "pending",
            "decision_source": decision_source,
        }

        try:
            with self.env.cr.savepoint():
                instance = self.sudo().create(instance_vals)
        except IntegrityError:
            return self.sudo().search([("open_key", "=", open_key_str)], limit=1)

        step_vals = {
            "instance_id": instance.id,
            "sequence": 10,
            "name": _("Fallback Approval Step"),
            "completion_mode": "single" if len(resolved_users) == 1 else "any",
            "approver_type": "specific_user" if len(resolved_users) == 1 else "group",
            "resolved_user_ids": [(6, 0, resolved_users.ids)],
            "state": "waiting",
            "sla_timeout_hours": 0,
            "sla_action": "escalate_next",
        }
        self.env["cleon.approval.instance.step"].sudo().create([step_vals])
        instance.invalidate_recordset(["step_ids"])
        first_step = instance.step_ids.filtered(lambda s: s.sequence == 10)
        if first_step:
            first_step.action_activate()
        return instance

    @api.model
    def action_cancel_for_target(self, res_record, reason=False):
        """Cancel any active pending approval instance for res_record."""
        model_name = res_record._name
        instances = self.sudo().search([
            ("res_model", "=", model_name),
            ("res_id", "=", res_record.id),
            ("state", "=", "pending"),
        ])
        for inst in instances:
            pending_steps = inst.step_ids.filtered(lambda s: s.state in ("pending", "waiting"))
            for step in pending_steps:
                step._close_activity()
                step.decision_ids.filtered(lambda d: d.state == "pending").sudo().write({"state": "skipped"})
                step.sudo().write({"state": "skipped"})
            inst.sudo().write({
                "state": "cancelled",
                "open_key": False,
                "decision_comment": reason or _("Cancelled by target record lifecycle."),
            })
        return True

    def action_decide(self, decision, comment=False, automated=False):
        """Decides an approval instance step with database concurrency locking and strict role checks."""
        if automated and not self.env.su:
            raise AccessError(_("Automated decisions are reserved for trusted server-side execution."))
        if decision not in ("approve", "reject", "request_changes"):
            raise ValidationError(_("Unsupported approval decision."))
        self.ensure_one()
        self.env.flush_all()

        # 1. PostgreSQL Row Lock on Instance to serialize concurrent transactions
        self.env.cr.execute(
            "SELECT id, state, current_step_sequence FROM cleon_approval_instance WHERE id = %s FOR UPDATE",
            [self.id],
        )
        row = self.env.cr.fetchone()
        if not row or row[1] != "pending":
            raise UserError(_("This approval workflow instance has already been decided or is not pending."))

        # Invalidate cache to read freshly locked state
        self.invalidate_recordset(["state", "current_step_sequence", "step_ids"])

        target_record = self.env[self.sudo().res_model].sudo().browse(self.sudo().res_id).exists()
        if not target_record:
            raise UserError(_("Target record for approval instance not found."))

        self.env.flush_all()

        # 2. Lock active pending step
        self.env.cr.execute(
            "SELECT id, state FROM cleon_approval_instance_step WHERE instance_id = %s AND state = 'pending' FOR UPDATE",
            [self.id],
        )
        step_rows = self.env.cr.fetchall()
        if not step_rows:
            raise UserError(_("This approval step has already been decided or is not pending."))

        current_step = self.sudo().step_ids.filtered(lambda s: s.state == "pending")
        if not current_step:
            raise UserError(_("No pending step found for approval instance %s.") % self.id)
        current_step = current_step[0]

        now = fields.Datetime.now()
        deciding_user = self.env.user if not automated else False

        # 3. Authorization check - strictly enforced for all human users (no system admin bypass)
        if not automated:
            if self.env.user not in current_step.resolved_user_ids:
                raise AccessError(_("You are not authorized to decide on approval step '%s'.") % current_step.name)
            submitting_user = self.sudo().employee_id.sudo().user_id
            if submitting_user and self.env.user == submitting_user:
                raise AccessError(_("Self-approval is prohibited for '%s'.") % current_step.name)

            user_decision = current_step.decision_ids.filtered(
                lambda d: d.user_id == self.env.user and d.state == "pending"
            )
            if not user_decision:
                raise UserError(_("You have already recorded a decision on this approval step, or the step is no longer awaiting your action."))

        # 4. Decision-aware validation hook
        target_record._approval_validate_decision(decision, automated=automated, comment=comment)

        model_id = self.env.ref("cleon_approval.model_cleon_approval_instance").id

        if decision == "reject":
            # Rejection immediately terminates step and workflow
            if not automated:
                current_step.decision_ids.filtered(lambda d: d.user_id == deciding_user).sudo().write({
                    "state": "rejected",
                    "decision_at": now,
                    "decision_comment": comment,
                })
            # Skip any remaining pending decisions
            current_step.decision_ids.filtered(lambda d: d.state == "pending").sudo().write({"state": "skipped"})
            current_step.sudo().write({
                "state": "rejected",
                "decision_user_id": deciding_user.id if deciding_user else False,
                "decision_at": now,
                "decision_comment": comment,
            })
            current_step._close_activity()
            self.sudo().write({
                "state": "rejected",
                "open_key": False,
                "decision_source": "sla_cron" if automated else "human",
                "decision_comment": comment,
            })
            target_record._approval_finalize_reject(comment)
            return True

        if decision == "request_changes":
            if not hasattr(target_record, "_approval_finalize_request_changes"):
                raise ValidationError(_("Workflow target record '%s' does not support requesting changes.") % target_record.display_name)
            if not automated:
                current_step.decision_ids.filtered(lambda d: d.user_id == deciding_user).sudo().write({
                    "state": "changes_requested",
                    "decision_at": now,
                    "decision_comment": comment,
                })
            current_step.decision_ids.filtered(lambda d: d.state == "pending").sudo().write({"state": "skipped"})
            current_step.sudo().write({
                "state": "changes_requested",
                "decision_user_id": deciding_user.id if deciding_user else False,
                "decision_at": now,
                "decision_comment": comment,
            })
            current_step._close_activity()
            self.sudo().write({
                "state": "changes_requested",
                "open_key": False,
                "decision_source": "sla_cron" if automated else "human",
                "decision_comment": comment,
            })
            import inspect
            sig = inspect.signature(target_record._approval_finalize_request_changes)
            if "deciding_user" in sig.parameters:
                target_record._approval_finalize_request_changes(comment, deciding_user=deciding_user)
            else:
                target_record._approval_finalize_request_changes(comment)
            return True

        if decision == "approve":
            if not automated:
                current_step.decision_ids.filtered(lambda d: d.user_id == deciding_user).sudo().write({
                    "state": "approved",
                    "decision_at": now,
                    "decision_comment": comment,
                })
                # In 'all' mode, close the deciding user's activity immediately
                if current_step.completion_mode == "all" and deciding_user:
                    user_acts = self.env["mail.activity"].sudo().search([
                        ("res_model_id", "=", model_id),
                        ("res_id", "=", self.id),
                        ("user_id", "=", deciding_user.id),
                    ])
                    if user_acts:
                        user_acts.sudo().action_feedback(feedback=_("Approval recorded."))

            mode = current_step.completion_mode
            step_completed = False

            if mode in ("single", "any") or automated:
                step_completed = True
                # Mark any remaining decisions on this step as skipped
                current_step.decision_ids.filtered(lambda d: d.state == "pending").sudo().write({"state": "skipped"})
            elif mode == "all":
                pending_decisions = current_step.decision_ids.filtered(lambda d: d.state == "pending")
                if not pending_decisions:
                    step_completed = True

            if not step_completed:
                # In 'all' mode with remaining pending decisions, step remains pending.
                return True

            # Step is fully completed
            current_step.sudo().write({
                "state": "approved",
                "decision_user_id": deciding_user.id if deciding_user else False,
                "decision_at": now,
                "decision_comment": comment,
            })
            current_step._close_activity()

            # Look for next waiting step using sudo() so record rules don't hide future steps from active approver
            next_steps = self.sudo().step_ids.filtered(lambda s: s.sequence > current_step.sequence and s.state == "waiting").sorted("sequence")
            if next_steps:
                next_step = next_steps[0]
                next_step.action_activate()
                self.sudo().write({"current_step_sequence": next_step.sequence})
            else:
                self.sudo().write({
                    "state": "approved",
                    "open_key": False,
                    "decision_source": "sla_cron" if automated else "human",
                    "decision_comment": comment,
                })
                target_record._approval_finalize_approve()
            return True

    @api.model
    def _cron_process_approval_escalations(self):
        """Concurrency-safe SLA cron escalation runner using FOR UPDATE SKIP LOCKED."""
        self.env.flush_all()
        self.env.cr.execute("""
            SELECT s.id
            FROM cleon_approval_instance_step s
            JOIN cleon_approval_instance i ON s.instance_id = i.id
            WHERE s.state = 'pending'
              AND COALESCE(s.escalated_once, FALSE) = FALSE
              AND s.deadline IS NOT NULL
              AND s.deadline <= (NOW() AT TIME ZONE 'UTC')
              AND i.state = 'pending'
            FOR UPDATE OF s SKIP LOCKED
        """)
        step_ids = [r[0] for r in self.env.cr.fetchall()]
        if not step_ids:
            return

        overdue_steps = self.env["cleon.approval.instance.step"].browse(step_ids)

        for step in overdue_steps:
            instance = step.instance_id
            try:
                with self.env.cr.savepoint():
                    if step.sla_action == "auto_approve":
                        instance.sudo().action_decide("approve", comment=_("Auto-approved by SLA escalation runner."), automated=True)
                    elif step.sla_action == "auto_reject":
                        instance.sudo().action_decide("reject", comment=_("Auto-rejected by SLA escalation runner."), automated=True)
                    elif step.sla_action == "escalate_next":
                        next_steps = instance.step_ids.filtered(lambda s: s.sequence > step.sequence and s.state == "waiting").sorted("sequence")
                        if next_steps:
                            step.decision_ids.filtered(lambda d: d.state == "pending").sudo().write({"state": "skipped"})
                            step.sudo().write({"state": "escalated"})
                            step._close_activity()
                            next_step = next_steps[0]
                            next_step.action_activate()
                            instance.sudo().write({"current_step_sequence": next_step.sequence})
                        else:
                            step.sudo().write({"escalated_once": True, "deadline": False})
                            instance.message_post(body=_("SLA expired at the final level. No next level exists; the request remains pending for an authorized decision."))
                    elif step.sla_action in ("reassign_role", "reassign_user"):
                        users = (step.escalation_target_group_id.users if step.sla_action == "reassign_role"
                                 else step.escalation_target_user_id)
                        submitter = instance.employee_id.sudo().user_id
                        users = users.sudo().filtered(
                            lambda user: user.active and instance.company_id.id in user.company_ids.ids and user != submitter
                        )
                        users = self.env["cleon.approval.delegation"].apply_to_users(
                            users, instance.company_id, excluded_user=submitter,
                        )
                        if not users:
                            raise UserError(_("Escalation target has no eligible active approver."))
                        step.decision_ids.filtered(lambda d: d.state == "pending").sudo().write({"state": "skipped"})
                        step._close_activity()
                        step.sudo().write({
                            "resolved_user_ids": [(6, 0, users.ids)], "escalated_once": True,
                            "sla_timeout_hours": 0, "deadline": False,
                        })
                        step.action_activate()
                        instance.message_post(body=_("Approval level '%s' was escalated to: %s") % (step.name, ", ".join(users.mapped("name"))))
                    elif step.sla_action == "notify_only":
                        step.sudo().write({"escalated_once": True, "deadline": False})
                        instance.message_post(body=_("Approval SLA reminder: level '%s' is still awaiting action; ownership is unchanged.") % step.name)
            except (AccessError, UserError, ValidationError) as exc:
                _logger.warning("SLA cron escalation for step %s (instance %s) blocked by business policy: %s", step.id, instance.id, exc)
            except Exception as exc:
                _logger.exception("Unexpected exception during SLA cron escalation for step %s (instance %s): %s", step.id, instance.id, exc)

    def write(self, vals):
        if not (self.env.su or self.env.user.has_group("cleon_approval.group_cleon_approval_manager")):
            protected = {"state", "open_key", "res_model", "res_id", "employee_id", "workflow_type_id", "decision_source"}
            if protected.intersection(vals.keys()):
                raise AccessError(_("Direct mutation of approval workflow execution records is restricted."))
        return super().write(vals)

    @api.model_create_multi
    def create(self, vals_list):
        if not (self.env.su or self.env.user.has_group("cleon_approval.group_cleon_approval_manager")):
            raise AccessError(_("Direct creation of approval workflow execution records is restricted."))
        return super().create(vals_list)


class CleonApprovalInstanceStep(models.Model):
    _name = "cleon.approval.instance.step"
    _description = "CleonHR Approval Instance Step History"
    _order = "sequence, id"

    instance_id = fields.Many2one("cleon.approval.instance", required=True, ondelete="cascade", index=True)
    sequence = fields.Integer(required=True)
    name = fields.Char(required=True)
    completion_mode = fields.Selection([
        ("single", "Single Approver"),
        ("any", "Any One Approver"),
        ("all", "All Approvers"),
    ], default="single", required=True, string="Completion Mode")
    approver_type = fields.Selection([
        ("line_manager", "Direct Manager"),
        ("managers_manager", "Manager's Manager"),
        ("department_head", "Department Head"),
        ("job", "Position / Job"),
        ("group", "User Group / Role"),
        ("specific_user", "Specific User"),
        ("specific_users", "Multiple Specific Users"),
        ("target_resolver", "Target Record Dynamic Resolver"),
    ], required=True)
    step_code = fields.Char(string="Step Code / Target Resolver Key", index=True)
    resolved_user_ids = fields.Many2many("res.users", string="Resolved Approver Users")
    decision_ids = fields.One2many("cleon.approval.instance.step.decision", "step_id", string="Approver Decisions")
    state = fields.Selection([
        ("waiting", "Waiting"),
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("changes_requested", "Changes Requested"),
        ("escalated", "Escalated"),
        ("skipped", "Skipped"),
    ], default="waiting", required=True)
    sla_timeout_hours = fields.Float(default=24, string="Snapshotted SLA Timeout (Hours)")
    deadline = fields.Datetime()
    decision_user_id = fields.Many2one("res.users")
    decision_at = fields.Datetime()
    decision_comment = fields.Text()
    sla_action = fields.Selection([
        ("escalate_next", "Escalate to Next Step"),
        ("auto_approve", "Auto-Approve"),
        ("auto_reject", "Auto-Reject"),
        ("reassign_role", "Escalate to Specific Role"),
        ("reassign_user", "Escalate to Specific Employee"),
        ("notify_only", "Notify Only"),
    ], default="escalate_next")
    escalation_rule_id = fields.Many2one("cleon.approval.escalation.rule", readonly=True, ondelete="restrict")
    escalation_target_group_id = fields.Many2one("res.groups", readonly=True)
    escalation_target_user_id = fields.Many2one("res.users", readonly=True)
    escalated_once = fields.Boolean(default=False, readonly=True)
    activity_id = fields.Many2one("mail.activity", ondelete="set null")

    def action_activate(self):
        self.ensure_one()
        now = fields.Datetime.now()
        timeout_h = self.sla_timeout_hours
        deadline = now + timedelta(hours=timeout_h) if (timeout_h and timeout_h > 0) else False
        self.sudo().write({
            "state": "pending",
            "deadline": deadline,
        })
        # Create pending decision records for all resolved users if not already present
        self.decision_ids.filtered(
            lambda decision: decision.user_id in self.resolved_user_ids and decision.state == "skipped"
        ).sudo().write({"state": "pending"})
        existing_users = self.decision_ids.mapped("user_id")
        new_decisions = []
        for u in self.resolved_user_ids:
            if u not in existing_users:
                new_decisions.append({
                    "step_id": self.id,
                    "user_id": u.id,
                    "state": "pending",
                })
        if new_decisions:
            self.env["cleon.approval.instance.step.decision"].sudo().create(new_decisions)
        self._create_activity()

    def _create_activity(self):
        self.ensure_one()
        if not self.resolved_user_ids:
            return
        act_type = self.env.ref("mail.mail_activity_data_todo", raise_if_not_found=False)
        if not act_type:
            return
        model_id = self.env.ref("cleon_approval.model_cleon_approval_instance").id
        summary = _("Approval Required: %s (Step %s)") % (self.instance_id.workflow_type_id.name if self.instance_id.workflow_type_id else _("Workflow"), self.sequence)
        note = _("Please review and decide on step '%s' for employee '%s'.") % (self.name, self.instance_id.employee_id.sudo().name)
        activities = self.env["mail.activity"]
        for user_to_assign in self.resolved_user_ids:
            existing = self.env["mail.activity"].sudo().search([
                ("res_model_id", "=", model_id),
                ("res_id", "=", self.instance_id.id),
                ("user_id", "=", user_to_assign.id),
            ], limit=1)
            if not existing:
                act = self.env["mail.activity"].sudo().create({
                    "activity_type_id": act_type.id,
                    "summary": summary,
                    "note": note,
                    "res_model_id": model_id,
                    "res_id": self.instance_id.id,
                    "user_id": user_to_assign.id,
                    "date_deadline": fields.Date.today(),
                })
                activities |= act
            else:
                activities |= existing
        if activities:
            self.sudo().write({"activity_id": activities[0].id})

    def _close_activity(self):
        model_id = self.env.ref("cleon_approval.model_cleon_approval_instance").id
        for step in self:
            acts = self.env["mail.activity"].sudo().search([
                ("res_model_id", "=", model_id),
                ("res_id", "=", step.instance_id.id),
                ("user_id", "in", step.resolved_user_ids.ids),
            ])
            if acts:
                acts.sudo().action_feedback(feedback=_("Step completed."))

    def write(self, vals):
        if not (self.env.su or self.env.user.has_group("cleon_approval.group_cleon_approval_manager")):
            protected = {"state", "deadline", "decision_user_id", "decision_at", "decision_comment", "resolved_user_ids", "sla_timeout_hours", "sla_action", "completion_mode"}
            if protected.intersection(vals.keys()):
                raise AccessError(_("Direct mutation of approval step execution records is restricted."))
        return super().write(vals)

    @api.model_create_multi
    def create(self, vals_list):
        if not (self.env.su or self.env.user.has_group("cleon_approval.group_cleon_approval_manager")):
            raise AccessError(_("Direct creation of approval step execution records is restricted."))
        return super().create(vals_list)


class CleonApprovalInstanceStepDecision(models.Model):
    _name = "cleon.approval.instance.step.decision"
    _description = "CleonHR Approval Step Decision Record"
    _order = "id asc"

    step_id = fields.Many2one("cleon.approval.instance.step", required=True, ondelete="cascade", index=True)
    instance_id = fields.Many2one(related="step_id.instance_id", store=True, readonly=True, index=True)
    user_id = fields.Many2one("res.users", required=True, index=True)
    state = fields.Selection([
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("changes_requested", "Changes Requested"),
        ("skipped", "Skipped / Not Required"),
    ], default="pending", required=True, index=True)
    decision_at = fields.Datetime()
    decision_comment = fields.Text()

    _sql_constraints = [
        ("step_user_unique", "unique(step_id, user_id)", "Each user can only have one decision record per approval step."),
    ]

    def write(self, vals):
        if not (self.env.su or self.env.user.has_group("cleon_approval.group_cleon_approval_manager")):
            protected = {"state", "decision_at", "decision_comment", "user_id", "step_id"}
            if protected.intersection(vals.keys()):
                raise AccessError(_("Direct mutation of approval decision records is restricted."))
        return super().write(vals)

    @api.model_create_multi
    def create(self, vals_list):
        if not (self.env.su or self.env.user.has_group("cleon_approval.group_cleon_approval_manager")):
            raise AccessError(_("Direct creation of approval decision records is restricted."))
        return super().create(vals_list)
