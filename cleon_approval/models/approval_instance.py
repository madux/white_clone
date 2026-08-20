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

        # Execute required decision validation hook
        res_record._approval_validate_decision(decision, automated=True, comment=reason)

        wft = self._resolve_workflow_type(res_record)

        self.action_cancel_for_target(res_record, reason=_("Replaced by automated decision (%s).") % source)

        inst = self.sudo().create({
            "company_id": company.id if company else False,
            "workflow_type_id": wft.id,
            "res_model": model_name,
            "res_id": res_record.id,
            "employee_id": employee.id if employee else False,
            "open_key": False,
            "current_step_sequence": 10,
            "state": "approved" if decision == "approve" else "rejected",
            "decision_source": source,
            "decision_comment": reason or (_("Auto-approved by policy (%s).") % source if decision == "approve" else _("Auto-rejected by policy (%s).") % source),
        })
        if decision == "approve":
            res_record._approval_finalize_approve()
        elif decision == "reject":
            res_record._approval_finalize_reject(reason)
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

        chain = self.env["cleon.approval.chain"].sudo().search([
            ("company_id", "=", company.id),
            ("workflow_type_id", "=", wft.id if wft else False),
            ("active", "=", True),
            ("is_default", "=", True),
        ], limit=1) if wft else False

        open_key_str = "%s,%s" % (model_name, res_record.id)

        # 2. Advanced default chain configured -> use chain
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

            try:
                with self.env.cr.savepoint():
                    instance = self.sudo().create(instance_vals)
            except IntegrityError:
                return self.sudo().search([("open_key", "=", open_key_str)], limit=1)

            instance_steps = []
            emp_user = employee.sudo().user_id
            for step in chain.step_ids.sorted("sequence"):
                resolved_users = self.env["res.users"]
                if step.approver_type == "line_manager":
                    parent_user = employee.sudo().parent_id.sudo().user_id
                    if not parent_user or not parent_user.active:
                        raise UserError(_("Submission blocked: Employee '%s' does not have an active line manager user.") % employee.sudo().name)
                    resolved_users = parent_user
                elif step.approver_type == "group":
                    if not step.approver_group_id:
                        raise ValidationError(_("Step '%s' is missing an approver group.") % step.name)
                    resolved_users = step.approver_group_id.users
                elif step.approver_type == "specific_user":
                    if not step.specific_user_id or not step.specific_user_id.active:
                        raise UserError(_("Submission blocked: Specific approver user for step '%s' is inactive or unassigned.") % step.name)
                    resolved_users = step.specific_user_id

                # Central company-validation and employee self-filtering for EVERY step
                filtered_step_users = resolved_users.sudo().filtered(lambda u: u.active and company.id in u.company_ids.ids)
                if emp_user:
                    filtered_step_users = filtered_step_users.filtered(lambda u: u.id != emp_user.id)
                if not filtered_step_users:
                    raise UserError(_("Submission blocked: No active approver user found in company '%s' for step '%s'. Self-approval is prohibited.") % (company.name, step.name))
                resolved_users = filtered_step_users

                inst_step_vals = {
                    "instance_id": instance.id,
                    "sequence": step.sequence,
                    "name": step.name,
                    "approver_type": step.approver_type,
                    "resolved_user_ids": [(6, 0, resolved_users.ids)],
                    "state": "waiting",
                    "sla_timeout_hours": step.sla_timeout_hours,
                    "sla_action": step.sla_action,
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
                step.sudo().write({"state": "skipped"})
            inst.sudo().write({
                "state": "cancelled",
                "open_key": False,
                "decision_comment": reason or _("Cancelled by target record lifecycle."),
            })
        return True

    def action_decide(self, decision, comment=False, automated=False):
        self.ensure_one()
        if self.state != "pending":
            raise UserError(_("This approval workflow instance is not pending."))

        target_record = self.env[self.res_model].sudo().browse(self.res_id).exists()
        if not target_record:
            raise UserError(_("Target record for approval instance not found."))

        current_step = self.sudo().step_ids.filtered(lambda s: s.state == "pending")
        if not current_step:
            raise UserError(_("No pending step found for approval instance %s.") % self.id)
        current_step = current_step[0]

        # Authorization check
        if not automated and not (self.env.su or self.env.user.has_group("base.group_system")):
            if self.env.user not in current_step.resolved_user_ids:
                raise AccessError(_("You are not authorized to decide on approval step '%s'.") % current_step.name)
            submitting_user = self.sudo().employee_id.sudo().user_id
            if submitting_user and self.env.user == submitting_user:
                raise AccessError(_("Self-approval is prohibited for '%s'.") % current_step.name)

        # Target record validation hook
        target_record._approval_validate_decision(decision, automated=automated, comment=comment)

        now = fields.Datetime.now()
        deciding_user = self.env.user if not automated else self.env.ref("base.user_root")

        if decision == "reject":
            current_step.sudo().write({
                "state": "rejected",
                "decision_user_id": deciding_user.id,
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
            current_step.sudo().write({
                "state": "rejected",
                "decision_user_id": deciding_user.id,
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
            target_record._approval_finalize_request_changes(comment)
            return True

        if decision == "approve":
            current_step.sudo().write({
                "state": "approved",
                "decision_user_id": deciding_user.id,
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
                        instance.action_decide("approve", comment=_("Auto-approved by SLA escalation runner."), automated=True)
                    elif step.sla_action == "auto_reject":
                        instance.action_decide("reject", comment=_("Auto-rejected by SLA escalation runner."), automated=True)
                    elif step.sla_action == "escalate_next":
                        next_steps = instance.step_ids.filtered(lambda s: s.sequence > step.sequence and s.state == "waiting").sorted("sequence")
                        if next_steps:
                            step.sudo().write({"state": "escalated"})
                            step._close_activity()
                            next_step = next_steps[0]
                            next_step.action_activate()
                            instance.sudo().write({"current_step_sequence": next_step.sequence})
                        else:
                            instance.action_decide("reject", comment=_("Auto-rejected: SLA expired on final step with no further escalation target."), automated=True)
            except (AccessError, UserError, ValidationError) as exc:
                # SLA decision blocked by business/period-lock rules; step remains pending
                _logger.warning("SLA cron escalation for step %s (instance %s) blocked by business policy: %s", step.id, instance.id, exc)
            except Exception as exc:
                # Unexpected programming or system error; log traceback
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
    approver_type = fields.Selection([
        ("line_manager", "Direct Manager"),
        ("group", "User Group / Role"),
        ("specific_user", "Specific User"),
    ], required=True)
    resolved_user_ids = fields.Many2many("res.users", string="Resolved Approver Users")
    state = fields.Selection([
        ("waiting", "Waiting"),
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("escalated", "Escalated"),
        ("skipped", "Skipped"),
    ], default="waiting", required=True)
    sla_timeout_hours = fields.Integer(default=24, string="Snapshotted SLA Timeout (Hours)")
    deadline = fields.Datetime()
    decision_user_id = fields.Many2one("res.users")
    decision_at = fields.Datetime()
    decision_comment = fields.Text()
    sla_action = fields.Selection([
        ("escalate_next", "Escalate to Next Step"),
        ("auto_approve", "Auto-Approve"),
        ("auto_reject", "Auto-Reject"),
    ], default="escalate_next")
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
            protected = {"state", "deadline", "decision_user_id", "decision_at", "decision_comment", "resolved_user_ids", "sla_timeout_hours", "sla_action"}
            if protected.intersection(vals.keys()):
                raise AccessError(_("Direct mutation of approval step execution records is restricted."))
        return super().write(vals)

    @api.model_create_multi
    def create(self, vals_list):
        if not (self.env.su or self.env.user.has_group("cleon_approval.group_cleon_approval_manager")):
            raise AccessError(_("Direct creation of approval step execution records is restricted."))
        return super().create(vals_list)
