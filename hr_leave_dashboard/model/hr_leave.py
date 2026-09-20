# -*- coding: utf-8 -*-
from collections import OrderedDict
from types import SimpleNamespace
from dateutil.relativedelta import relativedelta
from odoo import models, fields, api, _
from odoo.exceptions import AccessError, ValidationError, UserError
from odoo.osv import expression
import logging
import math
import base64

_logger = logging.getLogger(__name__)

class HrLeave(models.Model):
    _inherit = "hr.leave"

    @api.model
    def _employee_identification(self, employee):
        """Expose the private identifier only to users allowed to read it."""
        if not self.env.user.has_group("hr.group_hr_user"):
            return ""
        return employee.sudo().identification_id or ""

    # Admin Creation & Attribution Fields (FR-108 to FR-109)
    admin_created = fields.Boolean(
        string="Created by Administrator",
        readonly=True,
        copy=False,
        index=True,
    )
    admin_creation_note = fields.Text(
        string="Admin Note / Reason",
        readonly=True,
        copy=False,
    )
    admin_overlap_override = fields.Boolean(
        string="Overlap Overridden",
        readonly=True,
        copy=False,
    )

    # Screen 10: Leave Request Detail Fields (FR-115, FR-136)
    request_ref = fields.Char(
        string="Request ID",
        readonly=True,
        copy=False,
        index=True,
    )
    is_cancelled = fields.Boolean(
        string="Is Cancelled",
        readonly=True,
        copy=False,
        index=True,
    )
    cancelled_by_id = fields.Many2one(
        "res.users",
        string="Cancelled By",
        readonly=True,
        copy=False,
    )
    cancelled_at = fields.Datetime(
        string="Cancelled At",
        readonly=True,
        copy=False,
    )
    cancellation_reason = fields.Text(
        string="Cancellation Reason",
        readonly=True,
        copy=False,
    )
    approval_line_ids = fields.One2many(
        "hr.leave.approval.line", "leave_id", string="Approval Timeline", copy=False,
    )
    escalated = fields.Boolean(readonly=True, copy=False, index=True)
    escalation_note = fields.Text(readonly=True, copy=False)
    escalated_by_id = fields.Many2one("res.users", readonly=True, copy=False)
    escalated_at = fields.Datetime(readonly=True, copy=False)
    rejection_reason = fields.Text(readonly=True, copy=False)
    rejection_category = fields.Selection([
        ("coverage", "Insufficient Team Coverage"),
        ("balance", "Insufficient Leave Balance"),
        ("policy", "Policy Requirement Not Met"),
        ("dates", "Dates Not Approved"),
        ("documentation", "Documentation Incomplete"),
        ("other", "Other"),
    ], readonly=True, copy=False)
    handover_enabled = fields.Boolean(string="Handover Arranged", copy=False)
    backup_colleague_ids = fields.Many2many(
        "hr.employee", "hr_leave_backup_colleague_rel", "leave_id", "employee_id",
        string="Backup Colleagues", copy=False,
    )
    emergency_contact = fields.Char(string="Emergency / Reachout Information", copy=False)
    handover_notes = fields.Text(copy=False)
    changes_requested = fields.Boolean(readonly=True, copy=False, index=True)
    changes_requested_comment = fields.Text(readonly=True, copy=False)
    changes_requested_by_id = fields.Many2one("res.users", readonly=True, copy=False)
    changes_requested_at = fields.Datetime(readonly=True, copy=False)
    submission_channel = fields.Selection([
        ("form", "Manual Form"), ("ai_assisted", "AI Assisted"),
        ("admin", "Administrator"),
    ], default="form", required=True, readonly=True, copy=False)
    submitted_at = fields.Datetime(
        string="Submitted At", readonly=True, copy=False, index=True,
        help="Business submission timestamp; unlike create_date this changes on a genuine resubmission.",
    )

    governing_policy_id = fields.Many2one("hr.leave.policy", readonly=True, copy=False, ondelete="restrict", index=True)
    governing_policy_line_id = fields.Many2one("hr.leave.policy.line", readonly=True, copy=False, ondelete="restrict")
    governing_assignment_id = fields.Many2one("hr.leave.policy.assignment", readonly=True, copy=False, ondelete="restrict")
    governing_rule_snapshot = fields.Json(readonly=True, copy=False)
    blackout_exception_requested = fields.Boolean(readonly=True, copy=False)
    blackout_exception_window_id = fields.Many2one("hr.leave.blackout.period", readonly=True, copy=False, ondelete="restrict")

    def _capture_policy_provenance(self):
        for leave in self:
            if leave.governing_rule_snapshot:
                continue
            line = leave.holiday_status_id._active_policy_line(leave.employee_id, leave.request_date_from)
            assignment = self.env["hr.leave.policy.assignment"].sudo().search([
                ("policy_line_id", "=", line.id if line else False),
                ("employee_id", "=", leave.employee_id.id), ("superseded", "=", False),
                ("date_from", "<=", leave.request_date_from), "|",
                ("date_to", "=", False), ("date_to", ">=", leave.request_date_from),
            ], limit=1) if line else self.env["hr.leave.policy.assignment"]
            values = {
                "governing_policy_id": line.policy_id.id if line else False,
                "governing_policy_line_id": line.id if line else False,
                "governing_assignment_id": assignment.id,
                "governing_rule_snapshot": (assignment.rule_snapshot or line.policy_id._rule_snapshot(line)) if line else {"legacy": True},
            }
            # Bypass this class's public write guard only inside this private method.
            super(HrLeave, leave.sudo()).write(values)

    def _policy_rule_line(self):
        self.ensure_one()
        snapshot = self.governing_rule_snapshot
        if not snapshot:
            return self.holiday_status_id._active_policy_line(self.employee_id, self.request_date_from)
        if snapshot.get("legacy"):
            return False
        policy = dict(snapshot["policy"])
        policy["approval_chain_id"] = self.env["cleon.approval.chain"].sudo().browse(policy["approval_chain_id"])
        template_id = policy.get("approval_template_id")
        policy["approval_template_id"] = self.env["hr.leave.approval.template"].sudo().browse(template_id) if template_id else self.env["hr.leave.approval.template"]
        workflow_type_id = policy.get("approval_workflow_type_id")
        policy["approval_workflow_type_id"] = self.env["cleon.approval.workflow.type"].sudo().browse(workflow_type_id) if workflow_type_id else self.env["cleon.approval.workflow.type"]
        line = dict(snapshot["line"])
        # Older policy snapshots may predate newer line fields. Normalize
        # them before exposing the immutable snapshot as an attribute object
        # so request submission remains backward-compatible.
        line.setdefault("minimum_notice_days", 0)
        line.setdefault("minimum_duration", 0.0)
        line.setdefault("maximum_duration", 0.0)
        line.setdefault("allow_backdated", False)
        line.setdefault("allow_half_day", True)
        line.setdefault("document_policy", "not_required")
        line.setdefault("document_required_after_days", 0.0)
        line.setdefault("accepted_document_types", "")
        line["blackout_period_ids"] = self.env["hr.leave.blackout.period"].sudo().browse(line["blackout_period_ids"])
        line["policy_id"] = SimpleNamespace(**policy)
        return SimpleNamespace(**line)

    @api.model_create_multi
    def create(self, vals_list):
        if any(not self._leave_can_mutate_requests(values=vals) for vals in vals_list):
            raise AccessError(_("You do not have permission to create leave requests."))
        # Keep draft only if the caller *explicitly* requested state="draft".
        # If state is absent, Odoo's hr_holidays will inject "confirm" for
        # manager/both-validation types inside super().create() — we must
        # respect that auto-confirm rather than undoing it.
        # Using vals.get("state") (no default) so "absent" ≠ "draft".
        requested_draft = [vals.get("state") == "draft" for vals in vals_list]
        for vals in vals_list:
            if any(key.startswith("governing_") for key in vals):
                raise AccessError(_("Policy provenance is assigned by the submission workflow."))
            if not vals.get("request_ref"):
                vals["request_ref"] = (
                    self.env["ir.sequence"].next_by_code("hr.leave.request.ref") or _("New")
                )
            vals.pop("submitted_at", None)

        # ── Defensive sync: ensure Odoo's native leave_validation_type is
        #    aligned with CleonHR approval policies BEFORE super().create().
        #    Without this, no_validation types are auto-approved by Odoo
        #    during create(), bypassing the approval workflow entirely.
        type_ids = set()
        for vals in vals_list:
            if vals.get("holiday_status_id"):
                type_ids.add(vals["holiday_status_id"])
        if type_ids:
            leave_types = self.env["hr.leave.type"].sudo().browse(list(type_ids)).exists()
            if leave_types:
                leave_types._sync_native_validation_from_policies()

        leaves = super().create(vals_list)
        # ``hr_holidays`` may immediately promote a newly-created record for
        # some validation configurations.  Save Draft is an explicit product
        # action, so preserve the caller's requested lifecycle state.
        for leave, keep_draft in zip(leaves, requested_draft):
            if keep_draft and leave.state != "draft":
                super(HrLeave, leave.sudo()).write({
                    "state": "draft",
                    "submitted_at": False,
                    "governing_policy_id": False,
                    "governing_policy_line_id": False,
                    "governing_assignment_id": False,
                    "governing_rule_snapshot": False,
                })
        for leave in leaves.filtered(lambda item: item.state != "draft"):
            super(HrLeave, leave.sudo()).write({"submitted_at": fields.Datetime.now()})
            leave._capture_policy_provenance()
        leaves._validate_leave_policy(enforce_submission_timing=True)
        for leave in leaves:
            if not leave.admin_created and leave.state != "draft":
                leave._create_audit_record("submitted", note=leave.notes or "")

            # ── Guard against auto-validation race ──
            # If Odoo auto-validated (state=validate) but CleonHR policy
            # requires approval, revert to 'confirm' so the approval
            # workflow can proceed correctly.
            if leave.state == "validate" and not requested_draft[leaves.ids.index(leave.id)] if leave.id in leaves.ids else False:
                policy_line = leave._policy_rule_line()
                if policy_line and policy_line.policy_id.approval_required:
                    super(HrLeave, leave.sudo()).with_context(
                        _leave_authorised_state_change=True
                    ).write({"state": "confirm"})

            # Odoo may create an HR-approved leave type directly in the
            # "To Approve" state, without calling action_confirm().
            if leave.state in ("confirm", "validate1"):
                if "cleon.approval.instance" in self.env:
                    self.env["cleon.approval.instance"].sudo().action_start(leave)
        return leaves

    def write(self, values):
        """Validate policy only for genuine request lifecycle changes.

        Odoo also writes operational fields such as ``manager_id``,
        ``department_id`` and ``resource_calendar_id`` to leave records while
        synchronising employee data.  Those maintenance writes must not turn
        historical submission windows into database invariants.
        """
        if any(key.startswith("governing_") for key in values):
            raise AccessError(_("Submitted policy provenance is immutable."))
        if "submitted_at" in values and not self.env.su:
            raise AccessError(_("Submission time is assigned by the workflow."))
        policy_input_fields = {
            "holiday_status_id",
            "employee_id",
            "request_date_from",
            "request_date_to",
            "date_from",
            "date_to",
            "number_of_days",
            "request_unit_half",
        }
        workflow_fields = {
            "state", "is_cancelled", "cancellation_reason", "cancelled_by_id",
            "cancelled_at", "admin_created", "admin_creation_note",
            "admin_overlap_override", "changes_requested",
            "changes_requested_comment", "changes_requested_by_id",
            "changes_requested_at", "rejection_reason", "rejection_category",
            "escalated", "escalation_note", "escalated_by_id", "escalated_at",
            "submission_channel", "bradford_excluded", "bradford_exclusion_reason",
        }
        self_service_fields = policy_input_fields | {
            "notes", "name", "handover_enabled", "backup_colleague_ids",
            "emergency_contact", "handover_notes",
        }
        is_operator = self.env.su or self._leave_is_officer()
        # _leave_authorised_state_change is set by action_confirm() and other
        # sanctioned lifecycle methods to permit workflow-field changes without
        # requiring the caller to hold officer privileges.
        is_authorised_lifecycle = bool(self.env.context.get("_leave_authorised_state_change"))
        if workflow_fields.intersection(values) and not is_operator and not is_authorised_lifecycle:
            raise AccessError(_("Workflow-controlled leave fields can only be changed through an authorised action."))
        if self_service_fields.intersection(values) and not is_operator:
            if not self._leave_can_mutate_requests(records=self, values=values):
                raise AccessError(_("You can only edit your own leave request."))
            if any(leave.state != "draft" and not leave.changes_requested for leave in self):
                raise AccessError(_("This request is not currently open for employee editing."))
        previous_states = {leave.id: leave.state for leave in self}
        result = super().write(values)

        inputs_changed = bool(policy_input_fields.intersection(values))
        state_changed = "state" in values
        if inputs_changed or state_changed:
            for leave in self:
                if leave.state not in ("confirm", "validate1", "validate"):
                    continue
                old_state = previous_states.get(leave.id)
                entering_submission = leave.state == "confirm" and old_state != "confirm"
                if entering_submission:
                    super(HrLeave, leave.sudo()).write({"submitted_at": fields.Datetime.now()})
                    leave._capture_policy_provenance()
                editing_pending = inputs_changed and leave.state in ("confirm", "validate1")
                approving = state_changed and leave.state in ("validate1", "validate")
                if entering_submission or editing_pending or approving:
                    leave._validate_leave_policy(
                        enforce_submission_timing=entering_submission or editing_pending,
                    )
        return result

    def unlink(self):
        if not self._leave_can_mutate_requests(records=self) or (
            not (self.env.su or self._leave_is_officer())
            and any(leave.state != "draft" for leave in self)
        ):
            raise AccessError(_("You do not have permission to delete leave requests."))
        return super().unlink()

    def _approval_workflow_code(self):
        self.ensure_one()
        line = self._policy_rule_line() if self.holiday_status_id and self.employee_id else False
        workflow_type = line.policy_id.approval_workflow_type_id if line and getattr(line.policy_id, "approval_workflow_type_id", False) else False
        return workflow_type.code if workflow_type else "leave_request"

    def _approval_rule_context(self):
        self.ensure_one()
        balance = self.env["hr.leave.balance.transaction"].sudo()._current_balance(
            self.employee_id.id, self.holiday_status_id.id,
        ) if self.employee_id and self.holiday_status_id else 0
        return {
            "duration": self.number_of_days or 0,
            "leave_type": self.holiday_status_id.id or False,
            "department": self.employee_id.department_id.id or False,
            "available_balance": balance,
            "blackout_exception": bool(self.blackout_exception_requested),
        }

    def _approval_employee(self):
        return self.employee_id

    def _approval_company(self):
        return self.employee_id.company_id or self.company_id or self.env.company

    def _approval_period(self):
        self.ensure_one()
        return self.request_date_from or self.date_from, self.request_date_to or self.date_to

    def _approval_validate_decision(self, decision, automated=False, comment=False):
        self.ensure_one()
        if decision == "approve":
            if self._has_active_disciplinary_suspension():
                raise ValidationError(_("Cannot approve leave request for an employee with an active disciplinary suspension."))
            self._validate_leave_policy(enforce_submission_timing=False)
        return True

    def _check_double_validation_rules(self, employees, state):
        if self.env.context.get("cleon_final_approval"):
            return
        return super()._check_double_validation_rules(employees, state)

    def _approval_finalize_approve(self):
        self.ensure_one()
        ctx = dict(self.env.context, cleon_final_approval=True)
        leave = self.sudo().with_context(ctx)
        if leave.state == "confirm":
            super(HrLeave, leave).action_approve()
        if leave.state == "validate1":
            super(HrLeave, leave).action_validate()

    def _approval_finalize_reject(self, reason=False):
        self.ensure_one()
        self.sudo().write({"changes_requested": False, "rejection_reason": reason or False})
        super(HrLeave, self.with_context(cleon_final_approval=True)).action_refuse()

    def _approval_finalize_request_changes(self, reason=False, deciding_user=False):
        self.ensure_one()
        actor = deciding_user or (self.env.user if not self.env.su else False)
        self.sudo().write({
            "changes_requested": True,
            "changes_requested_comment": reason or False,
            "changes_requested_by_id": actor.id if actor else False,
            "changes_requested_at": fields.Datetime.now(),
            "state": "confirm",
        })
        self.message_post(body=_("Changes requested by approver: %s") % (reason or ""))

    def _approval_resolve_chain(self, workflow_type=False):
        self.ensure_one()
        if self.blackout_exception_requested and self.blackout_exception_window_id:
            chain = self.blackout_exception_window_id.exception_chain_id
            if not chain or not chain.active:
                raise UserError(_("Configuration Integrity Error: the blackout exception route is unavailable."))
            return chain
        leave_type = self.holiday_status_id
        if not leave_type:
            return False
        policy_line = self._policy_rule_line()
        if policy_line:
            policy = policy_line.policy_id
            if not policy.approval_required:
                return "no_approval"
            if policy.approval_workflow == "custom":
                # Submitted snapshots carry the resolved executable chain so
                # later template edits/deactivation cannot rewrite history.
                chain = policy.approval_chain_id or (policy.approval_template_id.chain_id if policy.approval_template_id else False)
                if not chain:
                    raise UserError(_("Configuration Integrity Error: Policy '%s' has no active custom approval route.") % policy.name)
                return chain
            # Workflow Type rules and its default Approval Route are resolved
            # centrally by the shared approval engine.
            return False
        if leave_type.approval_workflow == "none":
            return "no_approval"
        if leave_type.approval_workflow == "single":
            return "single_fallback"
        if leave_type.approval_workflow == "multi":
            if not leave_type.approval_chain_id or not leave_type.approval_chain_id.active:
                raise UserError(_("Configuration Integrity Error: Multi-stage Leave Type '%s' has no linked approval chain.") % leave_type.name)
            return leave_type.approval_chain_id
        return False

    def _approval_resolve_step_users(self, step, employee):
        self.ensure_one()
        code = getattr(step, "step_code", False)
        if not code and getattr(step, "approver_type", False) == "line_manager":
            code = "direct_manager"

        requester = employee.sudo().user_id

        def next_non_self_manager(candidate):
            visited = set()
            while candidate and candidate == requester and candidate.id not in visited:
                visited.add(candidate.id)
                manager_employee = self.env["hr.employee"].sudo().search([
                    ("user_id", "=", candidate.id),
                    ("company_id", "=", employee.company_id.id),
                    ("active", "=", True),
                ], limit=1)
                candidate = manager_employee.leave_manager_id or manager_employee.parent_id.user_id
            return candidate if candidate and candidate != requester else self.env["res.users"]

        if code == "direct_manager":
            manager = employee.sudo().leave_manager_id or employee.sudo().parent_id.sudo().user_id
            res = next_non_self_manager(manager)
            if not res:
                raise UserError(_("Configuration Error: No direct manager found for employee '%s'.") % employee.name)
            return res

        if code == "department_head":
            dept = employee.sudo().department_id
            dept_mgr = dept.sudo().manager_id if dept else False
            dept_user = dept_mgr.sudo().user_id if dept_mgr else False
            if not dept or not dept_mgr or not dept_user:
                raise UserError(_("Configuration Error: Department '%s' has no valid department head user configured.") % (dept.name if dept else "None"))
            res = next_non_self_manager(dept_user)
            if not res:
                raise UserError(_("Configuration Error: Department head user for '%s' cannot self-approve their own request.") % dept.name)
            return res

        if code == "hr_manager":
            grp = self.env.ref("hr_leave_dashboard.group_leave_permission_approve", raise_if_not_found=False)
            users = grp.users.filtered(lambda u: u.active and self.company_id.id in u.company_ids.ids) if grp else self.env["res.users"]
            if not users:
                raise UserError(_("Configuration Error: No active HR Manager user found for company '%s'.") % self.company_id.name)
            return users

        if code == "hr_director":
            param_uid = self.env["ir.config_parameter"].sudo().get_param("cleon_approval.hr_director_user_id")
            if param_uid:
                user = self.env["res.users"].browse(int(param_uid)).filtered(lambda u: u.active and self.company_id.id in u.company_ids.ids)
                if user:
                    return user
            grp = self.env.ref("hr_leave_dashboard.group_role_hr_director", raise_if_not_found=False)
            users = grp.users.filtered(lambda u: u.active and self.company_id.id in u.company_ids.ids) if grp else self.env["res.users"]
            if not users:
                raise UserError(_("Configuration Error: No authoritative HR Director is configured for company '%s'. System Admin or generic permissions do not confer HR Director authority.") % self.company_id.name)
            return users

        if code == "finance_director":
            param_uid = self.env["ir.config_parameter"].sudo().get_param("cleon_approval.finance_director_user_id")
            if param_uid:
                user = self.env["res.users"].browse(int(param_uid)).filtered(lambda u: u.active and self.company_id.id in u.company_ids.ids)
                if user:
                    return user
            grp = self.env.ref("hr_leave_dashboard.group_role_finance_director", raise_if_not_found=False)
            users = grp.users.filtered(lambda u: u.active and self.company_id.id in u.company_ids.ids) if grp else self.env["res.users"]
            if not users:
                raise UserError(_("Configuration Error: No authoritative Finance Director is configured for company '%s'.") % self.company_id.name)
            return users

        if code == "ceo":
            param_uid = self.env["ir.config_parameter"].sudo().get_param("cleon_approval.ceo_user_id")
            if param_uid:
                user = self.env["res.users"].browse(int(param_uid)).filtered(lambda u: u.active and self.company_id.id in u.company_ids.ids)
                if user:
                    return user
            grp = self.env.ref("hr_leave_dashboard.group_role_ceo", raise_if_not_found=False)
            users = grp.users.filtered(lambda u: u.active and self.company_id.id in u.company_ids.ids) if grp else self.env["res.users"]
            if not users:
                raise UserError(_("Configuration Error: No authoritative CEO / Managing Director is configured for company '%s'. System Administrator membership does not confer CEO approval authority.") % self.company_id.name)
            return users

        return self.env["res.users"]

    def _approval_fallback_config(self):
        self.ensure_one()
        policy_line = self._policy_rule_line() if self.holiday_status_id else False
        if policy_line and not policy_line.policy_id.approval_required:
            return {"require_approval": False}
        if not policy_line and self.holiday_status_id and self.holiday_status_id.approval_workflow == "none":
            return {"require_approval": False}
        parent_user = self.employee_id.leave_manager_id or self.employee_id.parent_id.user_id
        if not parent_user:
            approve_grp = self.env.ref("hr_leave_dashboard.group_leave_permission_approve", raise_if_not_found=False)
            if approve_grp and approve_grp.users:
                parent_user = approve_grp.users
        if not parent_user:
            raise UserError(_("No eligible approver could be resolved for employee '%s'.") % self.employee_id.name)
        return {
            "require_approval": True,
            "fallback_users": parent_user,
        }

    def _get_pending_approval_instance(self, repair_missing=True):
        """Return the active shared approval instance for a pending leave.

        Leave requests created before the shared approval engine was enabled,
        or affected by an interrupted data migration, can legitimately still
        be in ``confirm``/``validate1`` while their instance is absent. They
        must not be left visible in an approver's queue but impossible to act
        on. Rebuild the route from the current leave configuration in that
        narrow case; the instance's normal decision check still determines
        whether the current user is an assigned approver.

        A rebuild is deliberately refused if the current configuration would
        auto-finalise the historical pending request. That kind of lifecycle
        reconciliation needs an administrator, not an implicit approval.
        """
        self.ensure_one()
        if "cleon.approval.instance" not in self.env:
            raise UserError(_("Configuration Integrity Error: the shared approval engine is not installed."))

        instance_model = self.env["cleon.approval.instance"].sudo()
        domain = [
            ("res_model", "=", self._name),
            ("res_id", "=", self.id),
            ("state", "=", "pending"),
        ]
        instance = instance_model.search(domain, limit=1)
        if instance or not repair_missing:
            return instance

        if self.state not in ("confirm", "validate1") or self.is_cancelled:
            return instance

        _logger.warning(
            "Rebuilding missing approval instance for pending leave %s (id=%s).",
            self.display_name,
            self.id,
        )
        # ``action_start`` is concurrency-safe via the instance open-key. A
        # savepoint also guarantees that an old pending leave is not silently
        # auto-approved if its policy was changed after it was submitted.
        with self.env.cr.savepoint():
            instance_model.action_start(self)
            self.invalidate_recordset(["state"])
            instance = instance_model.search(domain, limit=1)
            if not instance:
                if self.state not in ("confirm", "validate1"):
                    raise UserError(_(
                        "This pending leave request is missing its approval workflow. "
                        "Its current configuration would finalise it automatically, so it "
                        "cannot be safely rebuilt. Ask an administrator to reconcile it."
                    ))
                raise UserError(_(
                    "Configuration Integrity Error: an approval workflow could not be rebuilt "
                    "for this pending leave request. Check its workflow configuration."
                ))
        return instance

    def action_confirm(self):
        # Signal to write() that this is a sanctioned lifecycle transition so the
        # workflow-field guard does not block a regular employee from submitting
        # their own leave request.
        self_with_ctx = self.with_context(_leave_authorised_state_change=True)
        result = super(HrLeave, self_with_ctx).action_confirm()
        if "cleon.approval.instance" in self.env:
            for leave in self:
                self.env["cleon.approval.instance"].sudo().action_start(leave)
        return result

    def _resolve_stage_approver(self, stage):
        self.ensure_one()
        employee = self.employee_id
        requester = employee.user_id

        def next_non_self_manager(candidate):
            """Walk the reporting chain instead of returning the requester."""
            visited = set()
            while candidate and candidate == requester and candidate.id not in visited:
                visited.add(candidate.id)
                manager_employee = self.env["hr.employee"].sudo().search([
                    ("user_id", "=", candidate.id),
                    ("company_id", "=", employee.company_id.id),
                    ("active", "=", True),
                ], limit=1)
                candidate = manager_employee.leave_manager_id or manager_employee.parent_id.user_id
            return candidate if candidate and candidate != requester else self.env["res.users"]

        if stage.approver_type == "direct_manager":
            approver = employee.leave_manager_id or employee.parent_id.user_id
            return next_non_self_manager(approver)
        if stage.approver_type == "department_head":
            approver = employee.department_id.manager_id.user_id if employee.department_id.manager_id else False
            return next_non_self_manager(approver or employee.parent_id.user_id)
        group_xmlid = {
            "hr_manager": "hr_holidays.group_hr_holidays_manager",
            "hr_director": "hr_holidays.group_hr_holidays_manager",
            "finance_director": "account.group_account_manager",
            "ceo": "base.group_system",
        }.get(stage.approver_type)
        group = self.env.ref(group_xmlid, raise_if_not_found=False) if group_xmlid else False
        users = group.users.filtered(
            lambda user: self.employee_id.company_id in user.company_ids
            and user != employee.user_id
        ) if group else self.env["res.users"]
        return users[:1]

    def _initialize_configured_approval_lines(self):
        Line = self.env["hr.leave.approval.line"].sudo()
        now = fields.Datetime.now()
        for leave in self:
            stages = leave.holiday_status_id.approval_stage_ids.sorted(lambda stage: (stage.sequence, stage.id))
            if leave.holiday_status_id.approval_workflow != "multi" or not stages or leave.approval_line_ids:
                continue
            for index, stage in enumerate(stages):
                approver = leave._resolve_stage_approver(stage)
                if not approver:
                    raise ValidationError(_(
                        "No non-self approver could be resolved for approval level %(level)s (%(stage)s). Configure a valid reporting manager or fallback approver.",
                        level=index + 1, stage=stage.display_name,
                    ))
                line = Line.create({
                    "leave_id": leave.id,
                    "stage_id": stage.id,
                    "sequence": stage.sequence,
                    "level": index + 1,
                    "approver_id": approver.id,
                    "status": "pending" if index == 0 else "waiting",
                })
                if index == 0:
                    line.write({"deadline": line._deadline_from_stage(now)})

    def _approve_configured_stage(self, comment=""):
        self.ensure_one()
        pending = self.approval_line_ids.filtered(lambda line: line.status == "pending")[:1]
        if not pending:
            return False
        now = fields.Datetime.now()
        pending.sudo().write({
            "status": "approved", "actioned_at": now,
            "actioned_by_id": self.env.user.id, "comments": comment or False,
        })
        waiting = self.approval_line_ids.filtered(lambda line: line.status == "waiting").sorted(
            lambda line: (line.sequence, line.id)
        )[:1]
        if waiting:
            waiting.sudo().write({"status": "pending", "deadline": waiting._deadline_from_stage(now)})
            return "stage"
        super(HrLeave, self.with_context(cleon_final_approval=True)).action_approve()
        return "final"

    def action_approve(self, check_state=True):
        """Prevent native approval entry points from skipping custom stages."""
        if self.env.context.get("cleon_final_approval"):
            return super().action_approve(check_state=check_state)
        configured = self.filtered(
            lambda leave: leave.holiday_status_id.approval_workflow == "multi"
            and leave.approval_line_ids
        )
        regular = self - configured
        result = super(HrLeave, regular).action_approve(check_state=check_state) if regular else True
        for leave in configured:
            leave._approve_configured_stage()
        return result

    def _reject_configured_stages(self, reason):
        for leave in self:
            leave.approval_line_ids.filtered(lambda line: line.status == "pending").sudo().write({
                "status": "rejected", "actioned_at": fields.Datetime.now(),
                "actioned_by_id": self.env.user.id, "comments": reason,
            })
            leave.approval_line_ids.filtered(lambda line: line.status == "waiting").sudo().write({
                "status": "skipped",
            })

    def _has_active_disciplinary_suspension(self):
        self.ensure_one()
        if "hr.warning.interim_measure" not in self.env:
            return False
        now = fields.Datetime.now()
        domain = [
            ("employee_id", "=", self.employee_id.id),
            ("measure_type_suspension_pending", "=", True),
            "|", ("start_date", "=", False), ("start_date", "<=", now),
            "|", ("expected_end_date", "=", False), ("expected_end_date", ">=", now),
        ]
        return bool(self.env["hr.warning.interim_measure"].sudo().search_count(domain))

    @api.model
    def _employee_has_active_disciplinary_suspension(self, employee):
        pseudo_leave = self.new({"employee_id": employee.id})
        return pseudo_leave._has_active_disciplinary_suspension()

    @api.model
    def _cron_escalate_overdue_approval_stages(self):
        lines = self.env["hr.leave.approval.line"].sudo().search([
            ("status", "=", "pending"), ("deadline", "!=", False),
            ("deadline", "<", fields.Datetime.now()), ("escalated", "=", False),
        ])
        for line in lines:
            line.write({"escalated": True, "escalated_at": fields.Datetime.now()})
            leave = line.leave_id
            leave.sudo().write({
                "escalated": True,
                "escalation_note": _("Approval stage %d exceeded its configured response time.") % line.level,
                "escalated_at": fields.Datetime.now(),
            })
            leave._create_audit_record("escalated", note=leave.escalation_note, is_system=True)
        return len(lines)

    def _validate_leave_policy(self, enforce_submission_timing=True):
        """Enforce request policy at submission/edit/approval boundaries."""
        for leave in self:
            if leave.state in ("confirm", "validate1", "validate") and leave.holiday_status_id and leave.employee_id:
                res = self.env["hr.leave.type"].evaluate_leave_request_policy(
                    employee_id=leave.employee_id.id,
                    leave_type_id=leave.holiday_status_id.id,
                    date_from=leave.request_date_from or leave.date_from,
                    date_to=leave.request_date_to or leave.date_to,
                    requested_days=leave.number_of_days or 1.0,
                    half_day=bool(getattr(leave, "request_unit_half", False)),
                    enforce_submission_timing=enforce_submission_timing,
                    exclude_leave_id=leave.id,
                )
                if not res.get("eligible") or res.get("errors"):
                    raise ValidationError(_("Policy validation error for '%s':\n%s") % (leave.holiday_status_id.name, "\n".join("• " + e for e in res["errors"])))

    @api.model
    def _leave_has_group(self, xmlid, user=None):
        """Small indirection so all Leave capability checks use one source."""
        return (user or self.env.user).has_group(xmlid)

    @api.model
    def _leave_is_administrator(self, user=None):
        user = user or self.env.user
        return self._leave_has_group(
            "hr_leave_dashboard.group_leave_permission_configuration", user,
        )

    @api.model
    def _leave_is_officer(self, user=None):
        user = user or self.env.user
        return self._leave_has_group(
            "hr_leave_dashboard.group_leave_permission_operations", user,
        )

    @api.model
    def _leave_can_mutate_requests(self, user=None, records=None, values=None):
        """Authorize generic mutation for own records or HR Operations only.

        Approval RPCs elevate only after ``_leave_can_review`` has authorised
        the exact request. Configuration and Approve capabilities therefore
        cannot be reused as generic create/write/delete grants.
        """
        user = user or self.env.user
        if self.env.su or self._leave_has_group(
            "hr_leave_dashboard.group_leave_permission_operations", user,
        ):
            return True
        employee_ids = self.env["hr.employee"].sudo().search([
            ("user_id", "=", user.id),
            ("company_id", "in", user.company_ids.ids),
            ("active", "=", True),
        ]).ids
        if not employee_ids:
            return False
        records = records or self.env["hr.leave"]
        if records and any(record.employee_id.id not in employee_ids for record in records):
            return False
        target_employee_id = (values or {}).get("employee_id")
        if target_employee_id and int(target_employee_id) not in employee_ids:
            return False
        return bool(records or target_employee_id)

    @api.model
    def _leave_pending_approval_domain(self, user=None):
        """Pending requests for which ``user`` currently has responsibility."""
        user = user or self.env.user
        company_domain = [("employee_id.company_id", "in", user.company_ids.ids)]
        pending_domain = [
            ("state", "in", ("confirm", "validate1")),
            ("is_cancelled", "=", False),
            ("changes_requested", "=", False),
            ("employee_id.user_id", "!=", user.id),
        ]
        if not self._leave_has_group("hr_leave_dashboard.group_leave_permission_approve", user):
            return [("id", "=", 0)]

        cleon_decisions = self.env["cleon.approval.instance.step.decision"].sudo().search([
            ("user_id", "=", user.id),
            ("state", "=", "pending"),
            ("step_id.state", "=", "pending"),
            ("instance_id.state", "=", "pending"),
            ("instance_id.res_model", "=", "hr.leave"),
        ]) if "cleon.approval.instance.step.decision" in self.env else False
        assigned_leave_ids = cleon_decisions.mapped("instance_id.res_id") if cleon_decisions else []

        manager_domain = expression.OR([
            [("employee_id.leave_manager_id", "=", user.id)],
            [("employee_id.parent_id.user_id", "=", user.id)],
        ])
        responsibility_domain = expression.OR([
            [("id", "in", assigned_leave_ids)],
            expression.AND([
                [("holiday_status_id.approval_workflow", "!=", "multi")],
                manager_domain,
            ]),
        ])
        return expression.AND([company_domain, pending_domain, responsibility_domain])

    def _leave_can_review(self, user=None):
        """Whether ``user`` is authorised to decide this specific request."""
        self.ensure_one()
        user = user or self.env.user
        if self.employee_id.user_id == user:
            return False
        if not self._leave_has_group(
            "hr_leave_dashboard.group_leave_permission_approve", user,
        ):
            return False
        if "cleon.approval.instance" in self.env:
            inst = self.env["cleon.approval.instance"].sudo().search([
                ("res_model", "=", "hr.leave"),
                ("res_id", "=", self.id),
                ("state", "=", "pending"),
            ], limit=1)
            if inst:
                current_step = inst.step_ids.filtered(lambda s: s.state == "pending")
                if current_step and user in current_step.resolved_user_ids:
                    pending_dec = current_step.decision_ids.filtered(lambda d: d.user_id == user and d.state == "pending")
                    return bool(pending_dec)
                return False
        is_manager = (
            self.employee_id.leave_manager_id == user
            or self.employee_id.parent_id.user_id == user
        )
        return bool(is_manager)

    @api.model
    def _check_leave_review_access(self, leaves):
        actor = self.env.user
        forbidden = leaves.filtered(lambda leave: not leave._leave_can_review(actor))
        if forbidden:
            raise AccessError(_("You can only review leave requests routed to you."))

    @api.model
    def is_ai_capability_enabled(self, capability, employee=None, policy=None):
        """Central authority for checking if an AI capability is enabled.

        Precedence (LM-046):
        1. Per-capability company toggle OFF -> HARD OFF (Policy cannot turn it back on).
        2. Per-capability company toggle ON  -> check applicable Leave Policy / scope.

        The company-level AI integration switch is the connection gate. The
        eight capability switches remain independently controlled below it.
        """
        company = self.env.company
        cap_field_map = {
            "assistant": "leave_ai_assistant_enabled",
            "nl_request": "leave_ai_nl_request_enabled",
            "date_recommendations": "leave_ai_date_recommendations_enabled",
            "conflict_coverage": "leave_ai_conflict_coverage_enabled",
            "approval_support": "leave_ai_approval_support_enabled",
            "anomaly_detection": "leave_ai_anomaly_detection_enabled",
            "calendar_summary": "leave_ai_calendar_summary_enabled",
            "executive_brief": "leave_ai_executive_brief_enabled",
        }
        field_name = cap_field_map.get(capability)
        if not field_name:
            return False

        # AI capabilities cannot be used when the CleonAI integration is
        # disabled, regardless of an individual capability's setting.
        if not getattr(company, "leave_ai_enabled", True):
            return False

        if not getattr(company, field_name, False):
            return False

        # If policy passed or derivable, check policy-level constraints.
        if not policy and employee:
            today = fields.Date.context_today(self)
            assignments = self.env["hr.leave.policy.assignment"].sudo().search([
                ("employee_id", "=", employee.id), ("company_id", "=", company.id),
                ("superseded", "=", False), ("policy_id.state", "=", "active"),
                ("policy_id.active", "=", True),
                ("date_from", "<=", today),
                "|", ("date_to", "=", False), ("date_to", ">=", today),
            ])
            if assignments and any(not assignment.policy_id.ai_enabled for assignment in assignments):
                return False
        if policy and hasattr(policy, "ai_enabled") and not policy.ai_enabled:
            return False

        return True

    @api.model
    def get_leave_access_profile(self):
        """Return additive Leave capabilities for the current signed-in user.

        This intentionally does not return an Admin/Employee *mode*.  A user
        may hold several roles concurrently and receives the union of the
        corresponding sections.
        """
        user = self.env.user
        is_system = self._leave_has_group("base.group_system", user)
        is_admin = self._leave_is_administrator(user)
        is_officer = self._leave_is_officer(user)
        can_team = self._leave_has_group(
            "hr_leave_dashboard.group_leave_permission_team", user,
        )
        can_decide = self._leave_has_group(
            "hr_leave_dashboard.group_leave_permission_approve", user,
        )
        can_audit = self._leave_has_group(
            "hr_leave_dashboard.group_leave_permission_audit", user,
        )
        can_operational_reports = self._leave_has_group(
            "hr_leave_dashboard.group_leave_permission_operational_reports", user,
        )
        can_strategic_reports = self._leave_has_group(
            "hr_leave_dashboard.group_leave_permission_strategic_reports", user,
        )
        can_ai_config = self._leave_has_group(
            "hr_leave_dashboard.group_leave_permission_ai_config", user,
        )
        can_ai_insights = self._leave_has_group(
            "hr_leave_dashboard.group_leave_permission_ai_insights", user,
        )
        can_executive_analytics = self._leave_has_group(
            "hr_leave_dashboard.group_leave_permission_executive_analytics", user,
        )
        has_employee = bool(self.env["hr.employee"].sudo().search_count([
            ("user_id", "=", user.id),
            ("company_id", "in", user.company_ids.ids),
            ("active", "=", True),
        ]))
        has_direct_reports = bool(self.env["hr.employee"].sudo().search_count([
            ("company_id", "in", user.company_ids.ids),
            ("active", "=", True),
            "|", ("leave_manager_id", "=", user.id), ("parent_id.user_id", "=", user.id),
        ]))
        has_team_scope = can_team and has_direct_reports
        pending_approvals = self.sudo().search_count(
            self._leave_pending_approval_domain(user),
        ) if (is_admin or can_decide) else 0

        return {
            "has_employee": has_employee,
            # A linked active employee is itself the personal-scope
            # relationship. The permission group is still available for
            # custom roles, while existing employee users remain compatible.
            "has_personal_scope": has_employee,
            "has_team_scope": has_team_scope,
            "calendar_defaults": {
                "view": self.env.company.leave_default_calendar_view,
                "privacy": self.env.company.leave_calendar_privacy,
                "future_months": self.env.company.leave_calendar_future_months,
            },
            "can_approve": can_decide,
            "pending_approvals": pending_approvals,
            "can_operate": is_officer,
            "can_configure": is_admin or is_system,
            "can_configure_ai": can_ai_config or is_admin or is_system,
            "can_view_ai_insights": can_ai_insights or is_admin or is_system,
            "can_view_executive_analytics": can_executive_analytics or is_system,
            "can_view_audit": can_audit,
            "can_view_operational_reports": can_operational_reports,
            "can_view_strategic_reports": can_strategic_reports,
            "can_view_reports": can_operational_reports or can_strategic_reports or has_team_scope,
            "show_organisation_dashboard": has_team_scope or is_officer or is_admin or can_audit,
            "is_system": is_system,
            "ai_capabilities": {
                "assistant": self.is_ai_capability_enabled("assistant"),
                "nl_request": self.is_ai_capability_enabled("nl_request"),
                "date_recommendations": self.is_ai_capability_enabled("date_recommendations"),
                "conflict_coverage": self.is_ai_capability_enabled("conflict_coverage"),
                "approval_support": self.is_ai_capability_enabled("approval_support"),
                "anomaly_detection": self.is_ai_capability_enabled("anomaly_detection"),
                "calendar_summary": self.is_ai_capability_enabled("calendar_summary"),
                "executive_brief": self.is_ai_capability_enabled("executive_brief"),
            },
        }

    @api.model
    def _check_leave_dashboard_access(self, employee_scope=False):
        if employee_scope and self.env.user.has_group("base.group_user"):
            return
        if not self._leave_is_administrator():
            raise AccessError(_("Only a Time Off Administrator can access this dashboard."))

    @api.model
    def _check_leave_calendar_access(self, employee_scope=False, calendar_scope=None):
        """Authorize the calendar without broadening mutation endpoints.

        Personal/team visibility is constrained again by the server-built
        calendar domain.  Organisation visibility is reserved for explicit
        configuration, operations, or audit capabilities.
        """
        profile = self.get_leave_access_profile()
        scope = calendar_scope or ("personal" if employee_scope else "organisation")
        if scope == "personal" and profile["has_personal_scope"]:
            return scope
        if scope == "team" and profile["has_team_scope"]:
            return scope
        if scope == "organisation" and (profile["can_operate"] or profile["can_view_audit"]):
            return scope
        raise AccessError(_("You do not have access to the requested Leave Calendar scope."))

    @api.model
    def _check_leave_operations_access(self):
        if not self._leave_is_officer():
            raise AccessError(_("Only an authorised Leave Officer can access operational leave records."))

    @api.model
    def _check_leave_organisation_dashboard_access(self):
        profile = self.get_leave_access_profile()
        if not profile["show_organisation_dashboard"]:
            raise AccessError(_("You do not have access to the organisation Leave dashboard."))

    @api.model
    def _get_dashboard_employee_ids(self):
        """Resolve the widest authorised scope without leaking organisation data."""
        user = self.env.user
        base_domain = [("active", "=", True), ("company_id", "in", user.company_ids.ids)]
        if (
            self._leave_is_officer(user)
            or self._leave_is_administrator(user)
            or self._leave_has_group("hr_leave_dashboard.group_leave_permission_audit", user)
        ):
            return self.env["hr.employee"].search(base_domain).ids
        if self._leave_has_group("hr_leave_dashboard.group_leave_permission_team", user):
            return self.env["hr.employee"].search(base_domain + [
                "|", ("leave_manager_id", "=", user.id), ("parent_id.user_id", "=", user.id),
            ]).ids
        return []

    @api.model
    def _get_company_employee_ids(self):
        """Organisation-operation scope; dashboard callers use the narrower resolver above."""
        return self.env["hr.employee"].sudo().search([
            ("active", "=", True),
            ("company_id", "in", self.env.user.company_ids.ids),
        ]).ids

    @api.model
    def get_dashboard_data(self, months=6):
        self._check_leave_organisation_dashboard_access()

        months = int(months) if months in (6, 12) else 6
        emp_ids = self._get_dashboard_employee_ids()
        # Scope is resolved above as the signed-in user.  Dashboard helpers
        # may read private employee fields, so aggregate only those already-
        # authorised ids with elevation (the same pattern used by Calendar).
        Dashboard = self.sudo()
        coverage = Dashboard._get_department_coverage(emp_ids)

        return {
            "kpis": Dashboard._get_kpis(emp_ids, coverage_alerts=coverage["alert_count"]),
            "trends": Dashboard._get_leave_trends(emp_ids, months),
            "by_type": Dashboard._get_leave_type_distribution(emp_ids),
            "balance": Dashboard._get_leave_balance_by_type(emp_ids),
            "approval_overview": Dashboard._get_approval_overview(emp_ids),
            "department_coverage": coverage["rows"],
            "recent_requests": Dashboard._get_recent_requests(emp_ids),
        }

    @api.model
    def get_employee_dashboard_data(self):
        """Return self-service leave data for the logged-in employee only."""
        employee = self.env["hr.employee"].sudo().search([
            ("user_id", "=", self.env.user.id),
            ("company_id", "in", self.env.companies.ids),
            ("active", "=", True),
        ], limit=1)
        if not employee:
            raise AccessError(_("Your user is not linked to an active employee record."))

        today = fields.Date.context_today(self)
        year_start = today.replace(month=1, day=1)
        year_end = today.replace(month=12, day=31)
        Leave = self.sudo()
        Allocation = self.env["hr.leave.allocation"].sudo()
        base_domain = [("employee_id", "=", employee.id), ("is_cancelled", "=", False)]
        allocations = Allocation.search([
            ("employee_id", "=", employee.id), ("state", "=", "validate"),
            "|", ("date_from", "=", False), ("date_from", "<=", today),
            "|", ("date_to", "=", False), ("date_to", ">=", today),
        ])
        approved = Leave.search(base_domain + [("state", "=", "validate")])
        pending = Leave.search(base_domain + [("state", "in", ("confirm", "validate1"))])
        type_ids = (allocations.mapped("holiday_status_id") | approved.mapped("holiday_status_id") | pending.mapped("holiday_status_id")).ids
        balance_components = self.env["hr.leave.balance.transaction"].sudo()._balance_components(
            [employee.id], type_ids,
        )
        balances = []
        for leave_type in self.env["hr.leave.type"].sudo().browse(type_ids).sorted("name"):
            component = balance_components.get((employee.id, leave_type.id), {})
            allocated_days = component.get("total_entitlement", 0.0)
            used_days = component.get("used", 0.0)
            pending_days = component.get("pending", 0.0)
            remaining = component.get("available", 0.0)
            carried_days = component.get("carried_forward", 0.0)
            balances.append({
                "id": leave_type.id, "name": leave_type.name,
                "color": leave_type.cleon_color_hex or "#3B82F6",
                "allocated": round(allocated_days, 1), "used": round(used_days, 1),
                "pending": round(pending_days, 1), "remaining": round(remaining, 1),
                "carried_forward": round(carried_days, 1),
                "percent": round(min(100, max(0, remaining * 100 / allocated_days)), 1) if allocated_days else 0,
            })

        upcoming = Leave.search(base_domain + [
            ("state", "=", "validate"), ("request_date_from", ">", today),
        ], order="request_date_from asc", limit=1)
        recent = Leave.search(base_domain, order="create_date desc", limit=5)
        on_leave = Leave.search_count(base_domain + [
            ("state", "=", "validate"), ("request_date_from", "<=", today),
            ("request_date_to", ">=", today),
        ])
        holidays = self.env["resource.calendar.leaves"].sudo().search([
            ("date_from", ">=", fields.Datetime.to_string(today)),
            ("date_from", "<=", fields.Datetime.to_string(today + relativedelta(days=90))),
            "|", ("calendar_id", "=", False), ("calendar_id", "=", employee.resource_calendar_id.id),
        ], order="date_from asc", limit=5)
        status_labels = {"draft": _("Draft"), "confirm": _("Pending"), "validate1": _("Pending"), "validate": _("Approved"), "refuse": _("Rejected"), "cancel": _("Cancelled")}
        return {
            "employee": {
                "id": employee.id,
                "name": employee.name,
                "employee_number": employee.employee_number or "",
                "identification_id": self._employee_identification(employee),
                "department": employee.department_id.name or "No Department",
                "job_title": employee.job_title or (employee.job_id.name if hasattr(employee, "job_id") and employee.job_id else "") or "Employee",
            },
            "can_admin": self._leave_is_administrator(),
            "kpis": {
                "total_balance": round(sum(item["remaining"] for item in balances), 1),
                "pending_requests": len(pending),
                "approved_this_year": Leave.search_count(base_domain + [("state", "=", "validate"), ("request_date_from", ">=", year_start), ("request_date_from", "<=", year_end)]),
                "at_work": not bool(on_leave),
            },
            "balances": balances,
            "upcoming_leave": [{"type": leave.holiday_status_id.name, "start": fields.Date.to_string(leave.request_date_from), "end": fields.Date.to_string(leave.request_date_to), "days": round(leave.number_of_days, 1)} for leave in upcoming],
            "holidays": [{"name": holiday.name, "date": fields.Datetime.to_string(holiday.date_from), "days_away": max(0, (holiday.date_from.date() - today).days)} for holiday in holidays],
            "recent": [{"id": leave.id, "type": leave.holiday_status_id.name, "start": fields.Date.to_string(leave.request_date_from), "end": fields.Date.to_string(leave.request_date_to), "days": round(leave.number_of_days, 1), "state": leave.state, "status": status_labels.get(leave.state, leave.state)} for leave in recent],
        }

    @api.model
    def _employee_for_current_user(self, required=True):
        employee = self.env["hr.employee"].sudo().search([
            ("user_id", "=", self.env.user.id), ("company_id", "in", self.env.companies.ids), ("active", "=", True),
        ], limit=1)
        if not employee and required:
            raise AccessError(_("Your user is not linked to an active employee record."))
        return employee

    @api.model
    def get_employee_request_options(self):
        employee = self._employee_for_current_user()
        types = self.env["hr.leave.type"].sudo().search([
            ("active", "=", True), ("visible_to_employees", "=", True),
            "|", ("company_id", "=", False), ("company_id", "=", employee.company_id.id),
        ]).filtered(lambda leave_type: employee in leave_type._get_eligible_employees())
        components = self.env["hr.leave.balance.transaction"].sudo()._balance_components(
            [employee.id], types.ids,
        )
        colleagues = self.env["hr.employee"].sudo().search([
            ("company_id", "=", employee.company_id.id),
            ("active", "=", True), ("id", "!=", employee.id),
        ], order="name")
        return {"employee": {
            "id": employee.id,
            "name": employee.name,
            "employee_number": employee.employee_number or "",
            "identification_id": self._employee_identification(employee),
        }, "backup_colleagues": [{
            "id": colleague.id,
            "name": colleague.name,
            "department": colleague.department_id.name or _("No Department"),
        } for colleague in colleagues], "leave_types": [{
            "id": leave_type.id, "name": leave_type.name, "color": leave_type.cleon_color_hex or "#3B82F6",
            "allocated": components.get((employee.id, leave_type.id), {}).get("total_entitlement", 0.0),
            "used": components.get((employee.id, leave_type.id), {}).get("used", 0.0),
            "pending": components.get((employee.id, leave_type.id), {}).get("pending", 0.0),
            "available": components.get((employee.id, leave_type.id), {}).get("available", 0.0),
            "unlimited": bool(leave_type.unlimited_entitlement), "allow_half_day": bool(leave_type.allow_half_day),
        } for leave_type in types], "ai_capabilities": {
            "nl_request": self.is_ai_capability_enabled("nl_request"),
            "date_recommendations": self.is_ai_capability_enabled("date_recommendations"),
            "conflict_coverage": self.is_ai_capability_enabled("conflict_coverage"),
        }}

    @api.model
    def preview_employee_leave_request(self, leave_type_id, date_from, date_to, half_day=False, period="am"):
        employee = self._employee_for_current_user()
        leave_type = self.env["hr.leave.type"].sudo().browse(int(leave_type_id)).exists()
        options = self.get_employee_request_options()
        if not leave_type or leave_type.id not in [item["id"] for item in options["leave_types"]]:
            raise ValidationError(_("This leave type is not available to you."))
        if not date_from or not date_to or fields.Date.from_string(date_to) < fields.Date.from_string(date_from):
            raise ValidationError(_("Select a valid start and end date."))
        preview = self.sudo().new({"employee_id": employee.id, "holiday_status_id": leave_type.id, "request_date_from": date_from, "request_date_to": date_to, "request_unit_half": bool(half_day), "request_date_from_period": period})
        preview._compute_department_id(); preview._compute_resource_calendar_id(); preview._compute_date_from_to()
        duration = 0.5 if half_day else round(preview.number_of_days or 0.0, 1)
        policy = self.env["hr.leave.type"].sudo().evaluate_leave_request_policy(employee.id, leave_type.id, date_from, date_to, duration, half_day)
        row = next(item for item in options["leave_types"] if item["id"] == leave_type.id)
        remaining = row["available"]
        holidays = self.env["resource.calendar.leaves"].sudo().search_count([
            ("date_from", "<=", date_to + " 23:59:59"), ("date_to", ">=", date_from + " 00:00:00"),
            ("calendar_id", "=", employee.resource_calendar_id.id),
        ])
        return {"duration": duration, "holiday_count": holidays, "current_balance": remaining, "projected_balance": remaining - duration if not row["unlimited"] else remaining, "unlimited": row["unlimited"], **policy}

    @api.model
    def submit_employee_leave_request(self, values):
        employee = self._employee_for_current_user()
        if self._employee_has_active_disciplinary_suspension(employee):
            self.env["hr.leave.audit.log"].sudo().create({
                "action": "failed", "event_status": "failed",
                "employee_id": employee.id, "actor_id": self.env.user.id,
                "actor_label": self.env.user.name,
                "note": _("Submission blocked: employee is under an active disciplinary suspension."),
            })
            return {"ok": False, "message": _("You cannot submit leave while an active disciplinary suspension applies.")}
        try:
            with self.env.cr.savepoint():
                result = self._submit_employee_leave_request(values)
            return {"ok": True, **result}
        except (ValidationError, UserError, AccessError) as error:
            message = error.args[0] if error.args else _("The leave request could not be submitted.")
            return {"ok": False, "message": str(message)}

    @api.model
    def _submit_employee_leave_request(self, values):
        employee = self._employee_for_current_user()
        reason = (values.get("reason") or "").strip()
        if len(reason) < 5:
            raise ValidationError(_("Please provide a reason of at least 5 characters."))
        preview = self.preview_employee_leave_request(values.get("leave_type_id"), values.get("date_from"), values.get("date_to"), values.get("half_day", False), values.get("period", "am"))
        request_exception = bool(values.get("blackout_exception_requested"))
        if preview.get("blackout_exception_available") and not request_exception:
            raise ValidationError(_("These dates require an authorised blackout exception. Select Request Exception to continue."))
        if not preview.get("eligible") or preview.get("errors"):
            raise ValidationError("\n".join(preview.get("errors") or [_('This request does not comply with the leave policy.')]))
        attachment = values.get("attachment") or {}
        if attachment.get("data") and attachment.get("mimetype") not in (
            "application/pdf", "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/jpeg", "image/png",
        ):
            raise ValidationError(_("Only PDF, DOC, DOCX, JPG, and PNG attachments are supported."))
        if attachment.get("data") and preview.get("accepted_document_types") and attachment.get("mimetype") not in preview["accepted_document_types"]:
            raise ValidationError(_("This policy accepts only: %s") % ", ".join(preview["accepted_document_types"]))
        if attachment.get("data"):
            try:
                if len(base64.b64decode(attachment["data"], validate=True)) > 10 * 1024 * 1024:
                    raise ValidationError(_("The attachment must not exceed 10 MB."))
            except ValueError:
                raise ValidationError(_("The supporting document is not a valid encoded file."))
        handover_enabled = bool(values.get("handover_enabled"))
        backup_ids = [int(item) for item in (values.get("backup_colleague_ids") or [])]
        valid_backups = self.env["hr.employee"].sudo().search([
            ("id", "in", backup_ids), ("company_id", "=", employee.company_id.id),
            ("active", "=", True), ("id", "!=", employee.id),
        ])
        if handover_enabled and not valid_backups:
            raise ValidationError(_("Select at least one backup colleague for the handover."))
        if len((values.get("handover_notes") or "")) > 500:
            raise ValidationError(_("Handover notes must not exceed 500 characters."))
        if preview.get("document_required") and not attachment.get("data"):
            raise ValidationError(_("A supporting document is required for this Leave Type and duration."))
        leave = self.create({
            "employee_id": employee.id,
            "holiday_status_id": int(values["leave_type_id"]),
            "request_date_from": values["date_from"], "request_date_to": values["date_to"],
            "request_unit_half": bool(values.get("half_day")),
            "request_date_from_period": values.get("period", "am"),
            "notes": reason, "handover_enabled": handover_enabled,
            "blackout_exception_requested": request_exception,
            "blackout_exception_window_id": int(preview.get("blackout_window_id") or 0) or False,
            "backup_colleague_ids": [(6, 0, valid_backups.ids)] if handover_enabled else [(5, 0, 0)],
            "emergency_contact": (values.get("emergency_contact") or "").strip(),
            "handover_notes": (values.get("handover_notes") or "").strip(),
            "submission_channel": "ai_assisted" if values.get("submission_channel") == "ai_assisted" else "form",
        })
        if attachment.get("data"):
            self.env["ir.attachment"].sudo().create({"name": attachment.get("name") or _("Supporting document"), "datas": attachment["data"], "mimetype": attachment.get("mimetype"), "res_model": "hr.leave", "res_id": leave.id})
        if leave.state == "draft":
            leave.sudo().action_confirm()

        return {"id": leave.id, "reference": leave.request_ref, "message": _("Your leave request has been submitted for approval.")}

    @api.model
    def get_my_leave_requests(self, status="all", search="", leave_type_id=False):
        employee = self._employee_for_current_user(required=False)
        if not employee:
            return {"rows": [], "counts": {key: 0 for key in ("all", "pending", "approved", "rejected", "changes_requested", "cancelled")}, "leave_types": []}
        domain = [("employee_id", "=", employee.id)]
        if status == "pending": domain += [("state", "in", ("confirm", "validate1")), ("is_cancelled", "=", False), ("changes_requested", "=", False)]
        elif status == "approved": domain += [("state", "=", "validate"), ("is_cancelled", "=", False)]
        elif status == "rejected": domain += [("state", "=", "refuse"), ("is_cancelled", "=", False)]
        elif status == "changes_requested": domain += [("changes_requested", "=", True), ("is_cancelled", "=", False)]
        elif status == "cancelled": domain += [("is_cancelled", "=", True)]
        if leave_type_id: domain.append(("holiday_status_id", "=", int(leave_type_id)))
        search = (search or "").strip()
        if search:
            domain = expression.AND([domain, expression.OR([
                [("request_ref", "ilike", search)],
                [("holiday_status_id.name", "ilike", search)],
                [("notes", "ilike", search)],
            ])])
        all_records = self.sudo().search([("employee_id", "=", employee.id)])
        records = self.sudo().search(domain, order="create_date desc, id desc")
        def request_status(record):
            if record.is_cancelled: return "cancelled"
            if record.changes_requested: return "changes_requested"
            return "approved" if record.state == "validate" else "pending" if record.state in ("confirm", "validate1") else "rejected" if record.state == "refuse" else "draft"
        counts = {key: 0 for key in ("all", "pending", "approved", "rejected", "changes_requested", "cancelled")}; counts["all"] = len(all_records)
        for record in all_records: counts[request_status(record)] = counts.get(request_status(record), 0) + 1
        balance_components = self.env["hr.leave.balance.transaction"].sudo()._balance_components(
            [employee.id], all_records.mapped("holiday_status_id").ids,
        )
        rows = []
        for record in records:
            approver = record.second_approver_id or record.first_approver_id
            if not approver and employee.parent_id: approver = employee.parent_id.user_id
            component = balance_components.get((employee.id, record.holiday_status_id.id), {})
            rows.append({"id": record.id, "reference": record.request_ref or "LR-%06d" % record.id, "leave_type_id": record.holiday_status_id.id, "leave_type": record.holiday_status_id.name, "color": record.holiday_status_id.cleon_color_hex or "#3B82F6", "balance": round(component.get("available", 0.0), 1), "date_from": fields.Date.to_string(record.request_date_from), "date_to": fields.Date.to_string(record.request_date_to), "duration": round(record.number_of_days or 0, 1), "reason": record.notes or "", "status": request_status(record), "approver": approver.name if approver else _("Line Manager"), "submitted": fields.Datetime.to_string(record.submitted_at or record.create_date), "can_cancel": request_status(record) in ("pending", "approved", "changes_requested"), "can_escalate": request_status(record) == "pending" and not record.escalated, "escalated": bool(record.escalated), "can_resubmit": request_status(record) in ("rejected", "changes_requested"), "changes_requested_comment": record.changes_requested_comment or "", "handover_enabled": bool(record.handover_enabled), "backup_colleague_ids": record.backup_colleague_ids.ids, "emergency_contact": record.emergency_contact or "", "handover_notes": record.handover_notes or ""})
        types = self.env["hr.leave.type"].sudo().browse(all_records.mapped("holiday_status_id").ids).sorted("name")
        return {"rows": rows, "counts": counts, "leave_types": [{"id": item.id, "name": item.name} for item in types]}

    @api.model
    def get_pending_my_leave_approvals(self):
        """Requests currently routed to this user, never an organisation dump."""
        profile = self.get_leave_access_profile()
        if not profile["can_approve"]:
            return {"rows": [], "count": 0}
        records = self.sudo().search(
            self._leave_pending_approval_domain(),
            order="escalated desc, create_date asc, id asc",
        )
        rows = [self._serialize_leave_request(record) for record in records]
        components = self.env["hr.leave.balance.transaction"].sudo()._balance_components(
            records.mapped("employee_id").ids, records.mapped("holiday_status_id").ids,
        )
        for row, record in zip(rows, records):
            row.update({
                "balance": round(components.get((record.employee_id.id, record.holiday_status_id.id), {}).get("available", 0.0), 1),
                "handover_enabled": bool(record.handover_enabled),
                "reason": record.notes or record.admin_creation_note or "",
            })
        return {
            "rows": rows,
            "count": len(records),
        }

    @api.model
    def cancel_my_pending_leave(self, leave_id, reason):
        employee = self._employee_for_current_user(); reason = (reason or "").strip()
        if len(reason) < 3: return {"ok": False, "message": _("Please provide a cancellation reason of at least 3 characters.")}
        leave = self.search([("id", "=", int(leave_id)), ("employee_id", "=", employee.id)], limit=1)
        if not leave: return {"ok": False, "message": _("This leave request could not be found.")}
        if leave.state not in ("confirm", "validate1", "validate") or leave.is_cancelled: return {"ok": False, "message": _("Only a pending or approved leave request can be cancelled.")}
        policy_line = leave._policy_rule_line()
        if policy_line and not policy_line.policy_id.allow_withdrawal:
            return {"ok": False, "message": _("Withdrawal is not permitted by this request's governing policy.")}
        try:
            with self.env.cr.savepoint():
                if "cleon.approval.instance" in self.env:
                    self.env["cleon.approval.instance"].sudo().action_cancel_for_target(leave, reason=reason)
                leave.sudo().action_refuse()
                leave.sudo().write({"is_cancelled": True, "cancelled_by_id": self.env.user.id, "cancelled_at": fields.Datetime.now(), "cancellation_reason": reason})
                leave.sudo()._create_audit_record("cancelled", note=reason)
            return {"ok": True, "message": _("Your leave request has been cancelled and its balance restored.")}
        except (ValidationError, UserError, AccessError) as error:
            return {"ok": False, "message": str(error.args[0] if error.args else _("The request could not be cancelled."))}

    @api.model
    def escalate_my_leave_request(self, leave_id, note):
        employee = self._employee_for_current_user()
        note = (note or "").strip()
        if not note or len(note) > 300:
            return {"ok": False, "message": _("Provide an escalation note of no more than 300 characters.")}
        leave = self.sudo().search([
            ("id", "=", int(leave_id)), ("employee_id", "=", employee.id),
            ("state", "in", ("confirm", "validate1")), ("is_cancelled", "=", False),
        ], limit=1)
        if not leave:
            return {"ok": False, "message": _("Only your own pending request can be escalated.")}
        if leave.escalated:
            return {"ok": False, "message": _("This request has already been escalated.")}
        leave.write({
            "escalated": True, "escalation_note": note,
            "escalated_by_id": self.env.user.id, "escalated_at": fields.Datetime.now(),
        })
        leave.approval_line_ids.filtered(lambda line: line.status == "pending").write({
            "escalated": True, "escalated_at": fields.Datetime.now(),
        })
        leave._create_audit_record("escalated", note=note)
        leave._post_configured_leave_update(_("Leave request escalated by %(employee)s: %(note)s", employee=employee.name, note=note))
        return {"ok": True, "message": _("Your request has been escalated for review.")}

    @api.model
    def resubmit_employee_leave_request(self, leave_id, values):
        """Edit and resubmit the same record, preserving its audit history."""
        employee = self._employee_for_current_user()
        leave = self.sudo().search([
            ("id", "=", int(leave_id)), ("employee_id", "=", employee.id),
            ("is_cancelled", "=", False),
        ], limit=1)
        if not leave or not (leave.changes_requested or leave.state == "refuse"):
            return {"ok": False, "message": _("Only a returned or rejected request can be edited and resubmitted.")}
        reason = (values.get("reason") or "").strip()
        if len(reason) < 5:
            return {"ok": False, "message": _("Please provide a reason of at least 5 characters.")}
        preview = self.preview_employee_leave_request(
            values.get("leave_type_id"), values.get("date_from"), values.get("date_to"),
            values.get("half_day", False), values.get("period", "am"),
        )
        attachment = values.get("attachment") or {}
        if not preview.get("eligible") or preview.get("errors"):
            return {"ok": False, "message": "\n".join(preview.get("errors") or [_('This request does not comply with the leave policy.')])}
        if attachment.get("data") and attachment.get("mimetype") not in (
            "application/pdf", "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/jpeg", "image/png",
        ):
            return {"ok": False, "message": _("Only PDF, DOC, DOCX, JPG, and PNG attachments are supported.")}
        if attachment.get("data") and preview.get("accepted_document_types") and attachment.get("mimetype") not in preview["accepted_document_types"]:
            return {"ok": False, "message": _("This policy accepts only: %s") % ", ".join(preview["accepted_document_types"])}
        if attachment.get("data"):
            try:
                if len(base64.b64decode(attachment["data"], validate=True)) > 10 * 1024 * 1024:
                    return {"ok": False, "message": _("The attachment must not exceed 10 MB.")}
            except ValueError:
                return {"ok": False, "message": _("The supporting document is not a valid encoded file.")}
        if preview.get("document_required") and not attachment.get("data") and not self.env["ir.attachment"].sudo().search_count([("res_model", "=", "hr.leave"), ("res_id", "=", leave.id)]):
            return {"ok": False, "message": _("A supporting document is required.")}
        backup_ids = [int(item) for item in (values.get("backup_colleague_ids") or [])]
        backups = self.env["hr.employee"].sudo().search([("id", "in", backup_ids), ("company_id", "=", employee.company_id.id), ("active", "=", True), ("id", "!=", employee.id)])
        if values.get("handover_enabled") and not backups:
            return {"ok": False, "message": _("Select at least one backup colleague.")}
        if len((values.get("handover_notes") or "")) > 500:
            return {"ok": False, "message": _("Handover notes must not exceed 500 characters.")}
        was_rejected = leave.state == "refuse"
        if was_rejected:
            leave.action_draft()
        leave.sudo().write({
            "holiday_status_id": int(values["leave_type_id"]),
            "request_date_from": values["date_from"],
            "request_date_to": values["date_to"],
            "request_unit_half": bool(values.get("half_day")),
            "request_date_from_period": values.get("period", "am"),
            "notes": reason,
            "name": reason,
            "handover_enabled": bool(values.get("handover_enabled")),
            "backup_colleague_ids": [(6, 0, backups.ids)] if values.get("handover_enabled") else [(5, 0, 0)],
            "emergency_contact": (values.get("emergency_contact") or "").strip(),
            "handover_notes": (values.get("handover_notes") or "").strip(),
            "changes_requested": False,
            "changes_requested_comment": False,
            "changes_requested_by_id": False,
            "changes_requested_at": False,
            "rejection_reason": False,
            "rejection_category": False,
            "state": "confirm",
            "submitted_at": fields.Datetime.now(),
        })
        # Sole runtime source of truth: start a new generic approval instance restarting at Stage 1.
        # Historical approval instance(s) remain immutable in state 'changes_requested'.
        if "cleon.approval.instance" in self.env:
            self.env["cleon.approval.instance"].sudo().action_start(leave)
        if attachment.get("data"):
            self.env["ir.attachment"].sudo().search([("res_model", "=", "hr.leave"), ("res_id", "=", leave.id)]).unlink()
            self.env["ir.attachment"].sudo().create({"name": attachment.get("name") or _("Supporting document"), "datas": attachment["data"], "mimetype": attachment.get("mimetype"), "res_model": "hr.leave", "res_id": leave.id})
        leave._create_audit_record("resubmitted", note=_("Request edited and resubmitted by the employee."))
        leave._post_configured_leave_update(_("Leave request edited and resubmitted by %s.", employee.name))
        return {"ok": True, "id": leave.id, "reference": leave.request_ref, "message": _("Leave request resubmitted successfully.")}

    # ---------------------------------------------------------
    # KPI CARDS (FR-055 to FR-060)
    # ---------------------------------------------------------

    @api.model
    def _get_kpis(self, emp_ids, coverage_alerts=0):
        today = fields.Date.context_today(self)

        total_employees = len(emp_ids)

        on_leave_today = self.search_count([
            ("employee_id", "in", emp_ids),
            ("state", "=", "validate"),
            ("request_date_from", "<=", today),
            ("request_date_to", ">=", today),
        ]) if emp_ids else 0

        pending_approvals = self.search_count([
            ("employee_id", "in", emp_ids),
            ("state", "in", ("confirm", "validate1")),
        ]) if emp_ids else 0

        upcoming_7_days = self.search_count([
            ("employee_id", "in", emp_ids),
            ("state", "=", "validate"),
            ("request_date_from", ">", today),
            ("request_date_from", "<=", today + relativedelta(days=7)),
        ]) if emp_ids else 0

        allocations = self.env["hr.leave.allocation"].search([
            ("employee_id", "in", emp_ids),
            ("state", "=", "validate"),
        ]) if emp_ids else self.env["hr.leave.allocation"]

        allocated_days = sum(allocations.mapped("number_of_days"))

        approved_leaves = self.search([
            ("employee_id", "in", emp_ids),
            ("state", "=", "validate"),
        ]) if emp_ids else self.env["hr.leave"]

        used_days = sum(approved_leaves.mapped("number_of_days"))

        utilisation_rate = (
            round((used_days / allocated_days) * 100, 1)
            if allocated_days else 0
        )

        on_leave_pct = (
            round((on_leave_today / total_employees) * 100, 1)
            if total_employees else 0
        )

        return {
            "total_employees": total_employees,
            "on_leave_today": on_leave_today,
            "on_leave_pct": on_leave_pct,
            "pending_approvals": pending_approvals,
            "upcoming_7_days": upcoming_7_days,
            "utilisation_rate": utilisation_rate,
            "coverage_alerts": coverage_alerts,
        }

    # ---------------------------------------------------------
    # LEAVE TRENDS AREA CHART (FR-061 to FR-063)
    # ---------------------------------------------------------

    @api.model
    def _get_leave_trends(self, emp_ids, months=6):
        months = int(months) if months in (6, 12) else 6
        today = fields.Date.context_today(self)
        range_start = today.replace(day=1) - relativedelta(months=months - 1)

        buckets = OrderedDict()
        cursor = range_start
        for _ in range(months):
            buckets[cursor.strftime("%Y-%m")] = {
                "label": cursor.strftime("%b"),
                "total": 0, "approved": 0, "pending": 0, "rejected": 0,
            }
            cursor += relativedelta(months=1)

        leaves = self.search([
            ("employee_id", "in", emp_ids),
            ("request_date_from", ">=", range_start),
            ("request_date_from", "<=", today.replace(day=1) + relativedelta(months=1, days=-1)),
        ]) if emp_ids else self.env["hr.leave"]

        for leave in leaves:
            if not leave.request_date_from:
                continue
            key = leave.request_date_from.strftime("%Y-%m")
            if key not in buckets:
                continue
            b = buckets[key]
            b["total"] += 1
            if leave.state == "validate":
                b["approved"] += 1
            elif leave.state in ("confirm", "validate1"):
                b["pending"] += 1
            elif leave.state == "refuse":
                b["rejected"] += 1

        return {
            "labels": [b["label"] for b in buckets.values()],
            "total": [b["total"] for b in buckets.values()],
            "approved": [b["approved"] for b in buckets.values()],
            "pending": [b["pending"] for b in buckets.values()],
            "rejected": [b["rejected"] for b in buckets.values()],
            "summary": {
                "total": sum(b["total"] for b in buckets.values()),
                "approved": sum(b["approved"] for b in buckets.values()),
                "pending": sum(b["pending"] for b in buckets.values()),
                "rejected": sum(b["rejected"] for b in buckets.values()),
            },
        }

    # ---------------------------------------------------------
    # BY LEAVE TYPE DONUT CHART (FR-064)
    # ---------------------------------------------------------

    @api.model
    def _get_leave_type_distribution(self, emp_ids):
        if not emp_ids:
            return []
        groups = self.read_group(
            domain=[("employee_id", "in", emp_ids)],
            fields=["id"],
            groupby=["holiday_status_id"],
        )
        total = sum(g["holiday_status_id_count"] for g in groups) or 1
        result = []
        for g in groups:
            if not g["holiday_status_id"]:
                continue
            count = g["holiday_status_id_count"]
            result.append({
                "name": g["holiday_status_id"][1],
                "count": count,
                "percent": round((count / total) * 100),
            })
        result.sort(key=lambda r: r["count"], reverse=True)
        return result

    # ---------------------------------------------------------
    # LEAVE BALANCE BY TYPE (FR-065)
    # ---------------------------------------------------------

    @api.model
    def _get_leave_balance_by_type(self, emp_ids):
        if not emp_ids:
            return []
        LeaveType = self.env["hr.leave.type"]
        types = LeaveType.search([])
        result = []
        for lt in types:
            allocated = sum(self.env["hr.leave.allocation"].search([
                ("employee_id", "in", emp_ids),
                ("holiday_status_id", "=", lt.id),
                ("state", "=", "validate"),
            ]).mapped("number_of_days"))
            used = sum(self.search([
                ("employee_id", "in", emp_ids),
                ("holiday_status_id", "=", lt.id),
                ("state", "=", "validate"),
            ]).mapped("number_of_days"))
            if not allocated and not used:
                continue

            percent = round((used / allocated) * 100) if allocated else 0

            # FR-065: Threshold colour-coding: green (<60%), amber (60-79%), red (>=80%)
            if percent < 60:
                bar_color = "#10b981"  # green
            elif percent < 80:
                bar_color = "#f59e0b"  # amber
            else:
                bar_color = "#ef4444"  # red

            result.append({
                "name": lt.name,
                "type_color": lt.cleon_color_hex or "#64748B",
                "bar_color": bar_color,
                "used": round(used, 1),
                "allocated": round(allocated, 1),
                "percent": min(100, max(0, percent)),
            })
        return result

    # ---------------------------------------------------------
    # APPROVAL OVERVIEW (FR-066)
    # ---------------------------------------------------------

    @api.model
    def _get_approval_overview(self, emp_ids):
        if not emp_ids:
            return {"approved": 0, "pending": 0, "rejected": 0, "approval_rate": 0}
        approved = self.search_count([("employee_id", "in", emp_ids), ("state", "=", "validate")])
        pending = self.search_count([("employee_id", "in", emp_ids), ("state", "in", ("confirm", "validate1"))])
        rejected = self.search_count([("employee_id", "in", emp_ids), ("state", "=", "refuse")])
        total = approved + pending + rejected
        rate = round((approved / total) * 100) if total else 0
        return {
            "approved": approved,
            "pending": pending,
            "rejected": rejected,
            "approval_rate": rate,
        }

    # ---------------------------------------------------------
    # DEPARTMENT COVERAGE HEATMAP (FR-067)
    # ---------------------------------------------------------

    @api.model
    def _get_department_coverage(self, emp_ids):
        if not emp_ids:
            return {"rows": [], "alert_count": 0}

        company = self.env.company
        today = fields.Date.context_today(self)

        monday = today - relativedelta(days=today.weekday())
        work_days = [monday + relativedelta(days=i) for i in range(5)]

        employees = self.env["hr.employee"].browse(emp_ids).filtered(lambda e: e.department_id)
        departments = employees.mapped("department_id")

        approved_leaves = self.search([
            ("employee_id", "in", emp_ids),
            ("state", "=", "validate"),
            ("request_date_from", "<=", work_days[-1]),
            ("request_date_to", ">=", work_days[0]),
        ])

        away_by_day = {}
        for day in work_days:
            away_by_day[day] = set(
                approved_leaves.filtered(
                    lambda l: l.request_date_from and l.request_date_to and l.request_date_from <= day <= l.request_date_to
                ).mapped("employee_id").ids
            )

        rows = []
        alert_count = 0

        for department in departments.sorted("name"):
            dept_emp_ids = set(
                employees.filtered(lambda e: e.department_id == department).ids
            )
            total = len(dept_emp_ids)
            values = []

            for day in work_days:
                away = len(dept_emp_ids & away_by_day[day])
                coverage = (
                    round(((total - away) / total) * 100)
                    if total else 100
                )
                values.append(coverage)

            if any(val < 70 for val in values):
                alert_count += 1

            # Weekend columns (Sat, Sun) show None
            values.extend([None, None])

            rows.append({
                "department": department.name,
                "values": values,
            })

        return {
            "rows": rows,
            "alert_count": alert_count,
        }

    # ---------------------------------------------------------
    # RECENT REQUESTS (FR-068)
    # ---------------------------------------------------------

    @api.model
    def _get_recent_requests(self, emp_ids):
        if not emp_ids:
            return []

        leaves = self.search(
            [
                ("employee_id", "in", emp_ids),
                ("state", "!=", "draft"),
            ],
            order="create_date desc",
            limit=8,
        )

        state_map = {
            "confirm": "pending",
            "validate1": "pending",
            "validate": "approved",
            "refuse": "rejected",
        }

        result = []
        for leave in leaves:
            create_dt = leave.create_date
            submitted = (
                fields.Datetime.context_timestamp(self, create_dt).strftime("%d %b")
                if create_dt else ""
            )
            result.append({
                "id": leave.id,
                "employee": leave.employee_id.name or "",
                "leave_type": leave.holiday_status_id.name or "",
                "duration": round(leave.number_of_days, 1),
                "status": state_map.get(leave.state, "pending"),
                "submitted_date": submitted,
            })

        return result

    # ═════════════════════════════════════════════════════════
    # SCREEN 9: LEAVE REQUESTS PAGE BACKEND METHODS (FR-073 to FR-113)
    # ═════════════════════════════════════════════════════════

    @api.model
    def _get_leave_approver_label(self, leave):
        if leave.state == "confirm":
            if hasattr(leave, "validation_type") and leave.validation_type in ("manager", "both"):
                return leave.employee_id.leave_manager_id.name or _("Line Manager")
            if hasattr(leave, "holiday_status_id") and leave.holiday_status_id.responsible_ids:
                resp = leave.holiday_status_id.responsible_ids.mapped("name")
                return ", ".join(resp) or _("Time Off Officer")
            return _("Line Manager")

        if leave.state == "validate1":
            if hasattr(leave, "holiday_status_id") and leave.holiday_status_id.responsible_ids:
                resp = leave.holiday_status_id.responsible_ids.mapped("name")
                return ", ".join(resp) or _("Time Off Officer")
            return _("Time Off Officer")

        approver = (
            getattr(leave, "second_approver_id", False)
            or getattr(leave, "first_approver_id", False)
            or getattr(leave, "user_id", False)
        )
        return approver.name if approver else ""

    def _get_cleon_leave_status(self):
        self.ensure_one()
        if self.is_cancelled:
            return "cancelled"
        if self.changes_requested:
            return "changes_requested"
        return {
            "draft": "draft",
            "confirm": "pending",
            "validate1": "pending",
            "validate": "approved",
            "refuse": "rejected",
        }.get(self.state, "pending")

    def _serialize_leave_request(self, leave=None):
        rec = leave or self
        rec.ensure_one()
        status = rec._get_cleon_leave_status()
        return {
            "id": rec.id,
            "request_ref": rec.request_ref or f"LR-{rec.id:06d}",
            "employee": {
                "id": rec.employee_id.id,
                "name": rec.employee_id.name or "",
                "employee_number": rec.employee_id.employee_number or "",
                "identification_id": self._employee_identification(rec.employee_id),
                "department": rec.department_id.name or "No Department",
                "job_title": rec.employee_id.job_title or (rec.employee_id.job_id.name if hasattr(rec.employee_id, "job_id") and rec.employee_id.job_id else "") or "Employee",
                "email": rec.employee_id.work_email or f"{rec.employee_id.name.lower().replace(' ', '.')}@cleonhr.com",
            },
            "leave_type": {
                "id": rec.holiday_status_id.id,
                "name": rec.holiday_status_id.name or "",
                "color": getattr(rec.holiday_status_id, "color", 0),
                "color_hex": rec.holiday_status_id.cleon_color_hex or "#64748B",
            },
            "date_from": fields.Date.to_string(rec.request_date_from) if rec.request_date_from else "",
            "date_to": fields.Date.to_string(rec.request_date_to) if rec.request_date_to else "",
            "duration": round(rec.number_of_days or 0.0, 1),
            "half_day": bool(rec.request_unit_half),
            "half_day_period": rec.request_date_from_period if rec.request_unit_half else False,
            "status": status,
            "approver": self._get_leave_approver_label(rec),
            "submitted": fields.Date.to_string(rec.create_date.date()) if rec.create_date else "",
            "submitted_at": fields.Datetime.to_string(rec.submitted_at) if rec.submitted_at else "",
            "admin_created": rec.admin_created,
            "admin_created_by": rec.create_uid.name if rec.admin_created else "",
            "admin_created_at": fields.Date.to_string(rec.create_date.date()) if rec.admin_created and rec.create_date else "",
            "can_review": status == "pending" and not rec.is_cancelled and rec._leave_can_review(self.env.user),
            "escalated": bool(rec.escalated),
            "escalation_note": rec.escalation_note or "",
            "rejection_reason": rec.rejection_reason or "",
            "rejection_category": rec.rejection_category or "",
            "has_handover": bool(rec.handover_enabled and rec.backup_colleague_ids),
            "changes_requested_comment": rec.changes_requested_comment or "",
            "notes": rec.notes or rec.admin_creation_note or "",
        }

    @api.model
    def get_leave_requests_page(
        self,
        search_term="",
        status="all",
        leave_type_id=False,
        department_id=False,
        request_id="",
        approver="",
        reason="",
        added_type="",
        date_from=False,
        date_to=False,
        page=1,
        page_size=10,
    ):
        self._check_leave_operations_access()
        emp_ids = self._get_company_employee_ids()
        if not emp_ids:
            return {
                "rows": [],
                "counts": {"all": 0, "pending": 0, "approved": 0, "rejected": 0, "changes_requested": 0, "cancelled": 0},
                "pagination": {"page": 1, "page_size": 10, "total": 0, "page_count": 1, "from": 0, "to": 0},
                "leave_types": [],
                "departments": [],
            }

        page = max(int(page or 1), 1)
        allowed_sizes = (5, 10, 25, 50, 100)
        page_size = int(page_size or 10)
        if page_size not in allowed_sizes:
            page_size = 10

        base_domain = [("employee_id", "in", emp_ids)]
        if search_term and search_term.strip():
            st = search_term.strip()
            base_domain = expression.AND([
                base_domain,
                expression.OR([
                    [("employee_id.name", "ilike", st)],
                    [("employee_id.employee_number", "ilike", st)],
                    [("employee_id.identification_id", "ilike", st)],
                    [("holiday_status_id.name", "ilike", st)],
                    [("name", "ilike", st)],
                    [("notes", "ilike", st)],
                    [("request_ref", "ilike", st)],
                ])
            ])

        if leave_type_id:
            base_domain.append(("holiday_status_id", "=", int(leave_type_id)))
        if department_id:
            base_domain.append(("department_id", "=", int(department_id)))
        if (request_id or "").strip():
            base_domain.append(("request_ref", "ilike", request_id.strip()))
        if (reason or "").strip():
            base_domain.append(("notes", "ilike", reason.strip()))
        if (approver or "").strip():
            name = approver.strip()
            base_domain = expression.AND([base_domain, expression.OR([
                [("first_approver_id.name", "ilike", name)],
                [("second_approver_id.name", "ilike", name)],
                [("employee_id.parent_id.name", "ilike", name)],
            ])])
        if added_type == "with_handover":
            base_domain.append(("handover_enabled", "=", True))
        elif added_type == "without_handover":
            base_domain.append(("handover_enabled", "=", False))
        # Date filters use overlap semantics: a request is included when any
        # portion of its range intersects the selected range.
        if date_from:
            base_domain.append(("request_date_to", ">=", fields.Date.to_date(date_from)))
        if date_to:
            base_domain.append(("request_date_from", "<=", fields.Date.to_date(date_to)))

        counts = {
            "all": self.search_count(base_domain + [("state", "!=", "draft")]),
            "pending": self.search_count(base_domain + [("state", "in", ("confirm", "validate1")), ("changes_requested", "=", False), ("is_cancelled", "=", False)]),
            "approved": self.search_count(base_domain + [("state", "=", "validate"), ("is_cancelled", "=", False)]),
            "rejected": self.search_count(base_domain + [("state", "=", "refuse"), ("is_cancelled", "=", False)]),
            "changes_requested": self.search_count(base_domain + [("changes_requested", "=", True), ("is_cancelled", "=", False)]),
            "cancelled": self.search_count(base_domain + [("is_cancelled", "=", True)]),
        }

        domain = list(base_domain)
        if status == "pending":
            domain += [("state", "in", ("confirm", "validate1")), ("changes_requested", "=", False), ("is_cancelled", "=", False)]
        elif status == "approved":
            domain += [("state", "=", "validate"), ("is_cancelled", "=", False)]
        elif status == "rejected":
            domain += [("state", "=", "refuse"), ("is_cancelled", "=", False)]
        elif status == "changes_requested":
            domain += [("changes_requested", "=", True), ("is_cancelled", "=", False)]
        elif status == "cancelled":
            domain.append(("is_cancelled", "=", True))
        else:
            domain.append(("state", "!=", "draft"))

        total = self.search_count(domain)
        page_count = max(math.ceil(total / page_size), 1)
        if page > page_count:
            page = page_count

        offset = (page - 1) * page_size
        leaves = self.search(domain, offset=offset, limit=page_size, order="create_date desc, id desc")
        rows = [self._serialize_leave_request(leave) for leave in leaves]
        balance_components = self.env["hr.leave.balance.transaction"].sudo()._balance_components(
            leaves.mapped("employee_id").ids, leaves.mapped("holiday_status_id").ids,
        )
        for row, leave in zip(rows, leaves):
            row["balance"] = round(balance_components.get(
                (leave.employee_id.id, leave.holiday_status_id.id), {}
            ).get("available", 0.0), 1)

        leave_types = self.env["hr.leave.type"].search([
            ("active", "=", True),
            "|", ("company_id", "=", False), ("company_id", "=", self.env.company.id),
        ])
        departments = self.env["hr.department"].search(
            [("company_id", "=", self.env.company.id)],
            order="name",
        )

        return {
            "rows": rows,
            "counts": counts,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "page_count": page_count,
                "from": offset + 1 if total else 0,
                "to": min(offset + page_size, total),
            },
            "leave_types": [{
                "id": lt.id,
                "name": lt.name,
                "color": lt.color or 0,
                "color_hex": lt.cleon_color_hex or "#64748B",
            } for lt in leave_types],
            "departments": [{"id": dept.id, "name": dept.name} for dept in departments],
        }

    # ---------------------------------------------------------
    # BULK & INDIVIDUAL ACTION METHODS (FR-089, FR-097 to FR-100)
    # ---------------------------------------------------------

    @api.model
    def bulk_approve_leave_requests(self, leave_ids):
        leaves = self.sudo().browse(leave_ids).exists().filtered(
            lambda leave: leave.employee_id.company_id in self.env.user.company_ids
            and leave.state in ("confirm", "validate1")
        )
        self._check_leave_review_access(leaves)
        processed = 0
        failures = []
        for leave in leaves:
            try:
                with self.env.cr.savepoint():
                    # Use the same guarded path as the detail modal.  Requests
                    # with coverage conflicts are intentionally skipped: an
                    # approver must open Review and log an acknowledgement.
                    self.approve_leave_request(leave.id)
                    processed += 1
            except (ValidationError, UserError, AccessError) as error:
                failures.append({
                    "id": leave.id,
                    "reference": leave.request_ref or "LR-%06d" % leave.id,
                    "message": str(error.args[0] if error.args else error),
                })
        return {"processed": processed, "failed": failures}

    @api.model
    def bulk_reject_leave_requests(self, leave_ids, reason="", category=""):
        reason = (reason or "").strip()
        if category not in dict(self._fields["rejection_category"].selection):
            raise ValidationError(_("Select a valid rejection category."))
        if len(reason) < 3:
            raise ValidationError(_("A rejection reason is required (at least 3 characters)."))
        leaves = self.sudo().browse(leave_ids).exists().filtered(
            lambda leave: leave.employee_id.company_id in self.env.user.company_ids
            and leave.state in ("confirm", "validate1")
        )
        self._check_leave_review_access(leaves)
        processed = 0
        failures = []
        for leave in leaves:
            try:
                with self.env.cr.savepoint():
                    self.reject_leave_request(leave.id, reason=reason, category=category)
                    processed += 1
            except (ValidationError, UserError, AccessError) as error:
                failures.append({
                    "id": leave.id,
                    "reference": leave.request_ref or "LR-%06d" % leave.id,
                    "message": str(error.args[0] if error.args else error),
                })
        return {"processed": processed, "failed": failures}

    def _create_audit_record(
        self,
        action,
        note="",
        actor_label=None,
        actor_role=None,
        is_system=False,
    ):
        self.ensure_one()
        ip_addr = "127.0.0.1"
        sess_ref = ""
        try:
            from odoo.http import request
            if request and hasattr(request, "httprequest") and request.httprequest:
                ip_addr = getattr(request.httprequest, "remote_addr", "127.0.0.1") or "127.0.0.1"
            if request and hasattr(request, "session") and request.session:
                sess_ref = getattr(request.session, "sid", "") or ""
        except Exception:
            pass

        user = False if is_system else self.env.user

        self.env["hr.leave.audit.log"].sudo().create({
            "leave_id": self.id,
            "action": action,
            "actor_id": user.id if user else False,
            "actor_label": actor_label or ("System" if is_system else (user.name if user else "System")),
            "actor_role": actor_role or ("" if is_system else ("Super Admin" if user and user.has_group("base.group_system") else "Leave Manager")),
            "is_system": is_system,
            "employee_id": self.employee_id.id,
            "leave_type_id": self.holiday_status_id.id,
            "date_from": self.request_date_from,
            "date_to": self.request_date_to,
            "duration": self.number_of_days,
            "note": note or "",
            "after_values": {
                "status": "Cancelled" if self.is_cancelled else self.state,
                "startDate": fields.Date.to_string(self.request_date_from),
                "endDate": fields.Date.to_string(self.request_date_to),
                "duration": self.number_of_days,
                "leaveType": self.holiday_status_id.name,
                "employee": self.employee_id.name,
                "submissionChannel": self.submission_channel or "form",
            },
            "occurred_at": fields.Datetime.now(),
            "ip_address": ip_addr,
            "session_ref": sess_ref,
        })

    def _get_leave_balance_impact(self, leave):
        employee = leave.employee_id
        leave_type = leave.holiday_status_id

        allocations = self.env["hr.leave.allocation"].search([
            ("employee_id", "=", employee.id),
            ("holiday_status_id", "=", leave_type.id),
            ("state", "=", "validate"),
        ])
        allocated = sum(allocations.mapped("number_of_days"))

        other_used = sum(
            self.search([
                ("id", "!=", leave.id),
                ("employee_id", "=", employee.id),
                ("holiday_status_id", "=", leave_type.id),
                ("state", "=", "validate"),
                ("is_cancelled", "=", False),
            ]).mapped("number_of_days")
        )

        current_balance = round(allocated - other_used, 1)
        used = round(leave.number_of_days or 0.0, 1) if not leave.is_cancelled and leave.state != "refuse" else 0.0
        remaining = round(current_balance - used, 1)

        return {
            "current": current_balance,
            "used": used,
            "remaining": remaining,
            "has_allocation": bool(allocations),
        }

    def _get_leave_coverage_impact(self, leave):
        dept = leave.employee_id.department_id
        if not dept:
            return {
                "percentage": 100,
                "level": "good",
                "other_on_leave": 0,
                "department": "Company",
            }

        dept_employees = self.env["hr.employee"].search([
            ("department_id", "=", dept.id),
            ("company_id", "=", self.env.company.id),
            ("active", "=", True),
        ])
        total_dept = len(dept_employees) or 1

        start_date = leave.request_date_from
        end_date = leave.request_date_to
        if not start_date or not end_date:
            return {
                "percentage": 100,
                "level": "good",
                "other_on_leave": 0,
                "department": dept.name,
            }

        overlapping_leaves = self.search([
            ("id", "!=", leave.id),
            ("employee_id.department_id", "=", dept.id),
            ("state", "in", ("confirm", "validate1", "validate")),
            ("is_cancelled", "=", False),
            ("request_date_from", "<=", end_date),
            ("request_date_to", ">=", start_date),
        ])

        other_emp_ids = set(overlapping_leaves.mapped("employee_id.id"))
        other_count = len(other_emp_ids)

        # Day-by-day availability calculation
        curr = start_date
        lowest_available_pct = 100.0
        while curr <= end_date:
            absent_today = len(set(
                overlapping_leaves.filtered(
                    lambda l: l.request_date_from <= curr <= l.request_date_to
                ).mapped("employee_id.id")
            )) + 1  # Include current request employee
            avail_pct = max(0.0, min(100.0, round(((total_dept - absent_today) / total_dept) * 100)))
            if avail_pct < lowest_available_pct:
                lowest_available_pct = avail_pct
            curr += relativedelta(days=1)

        available_pct = int(lowest_available_pct)
        if available_pct >= 85:
            level = "good"
        elif available_pct >= 70:
            level = "medium"
        else:
            level = "low"

        conflicts = [
            {
                "employee_id": l.employee_id.id,
                "employee_name": l.employee_id.name,
                "leave_type": l.holiday_status_id.name,
                "date_from": fields.Date.to_string(l.request_date_from),
                "date_to": fields.Date.to_string(l.request_date_to),
                "status": "approved" if l.state == "validate" else "pending",
                "status_label": _("Approved") if l.state == "validate" else _("Pending"),
            }
            for l in overlapping_leaves
        ]
        threshold_pct = float(self.env.company.leave_default_team_overlap_percent or 40.0)
        overlap_pct = 100 - available_pct
        threshold_exceeded = bool(other_count > 0 and overlap_pct > threshold_pct)

        return {
            "percentage": available_pct,
            "level": level,
            "other_on_leave": other_count,
            "total_dept": total_dept,
            "overlap_percentage": overlap_pct,
            "threshold_percent": int(threshold_pct),
            "threshold_exceeded": threshold_exceeded,
            "department": dept.name,
            "conflicts": conflicts,
        }

    @api.model
    def get_leave_request_detail(self, leave_id):
        actor = self.env.user
        access = self.get_leave_access_profile()
        leave = self.sudo().browse(int(leave_id)).exists()
        if not leave or leave.employee_id.company_id not in self.env.user.company_ids:
            raise ValidationError(_("Invalid leave request."))
        can_review = leave._leave_can_review(actor)
        can_read_operations = access["can_operate"] or access["can_view_audit"]
        is_approver_on_workflow = False
        if "cleon.approval.instance" in self.env:
            inst = self.env["cleon.approval.instance"].sudo().search([
                ("res_model", "=", "hr.leave"),
                ("res_id", "=", leave.id),
            ], limit=1)
            if inst:
                all_step_users = inst.step_ids.mapped("resolved_user_ids")
                if actor in all_step_users:
                    is_approver_on_workflow = True

        if not (leave.employee_id.user_id == actor or can_review or can_read_operations or is_approver_on_workflow):
            raise AccessError(_("You can only view your own or assigned leave requests."))

        res = self._serialize_leave_request(leave)
        status = leave._get_cleon_leave_status()

        # Attachments (FR-124)
        attachments = self.env["ir.attachment"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave.id),
        ])
        attachment_list = [{
            "id": att.id,
            "name": att.name,
            "mimetype": att.mimetype or "application/octet-stream",
        } for att in attachments]

        # Balance & Coverage Impacts (FR-125 to FR-128)
        balance_impact = self._get_leave_balance_impact(leave)
        coverage_impact = self._get_leave_coverage_impact(leave)

        # Fetch Audit Logs for history and timeline (FR-129 to FR-132)
        audit_logs = self.env["hr.leave.audit.log"].sudo().search(
            [("leave_id", "=", leave.id)], order="occurred_at asc"
        )

        workflow = []
        approval_inst = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave.id),
        ], limit=1, order="id desc") if "cleon.approval.instance" in self.env else False

        if approval_inst and approval_inst.step_ids:
            for step in approval_inst.step_ids.sorted(lambda s: (s.sequence, s.id)):
                approver_names = ", ".join(step.resolved_user_ids.mapped("name")) or _("Unassigned")
                decisions_list = []
                for dec in step.decision_ids:
                    decisions_list.append({
                        "user_id": dec.user_id.id,
                        "user_name": dec.user_id.name,
                        "state": dec.state,
                        "decision_at": fields.Datetime.to_string(dec.decision_at) if dec.decision_at else False,
                        "comments": dec.decision_comment or "",
                    })
                mode_label = dict(step._fields["completion_mode"].selection).get(step.completion_mode, step.completion_mode)
                total_approvers = len(step.decision_ids)
                approved_count = len(step.decision_ids.filtered(lambda d: d.state == "approved"))

                if step.completion_mode == "all":
                    progress_label = _("%(approved)d of %(total)d Approved") % {"approved": approved_count, "total": total_approvers}
                elif step.completion_mode == "any":
                    progress_label = _("Any 1 of %(total)d Approvers") % {"total": total_approvers}
                else:
                    progress_label = _("Single Approver")

                step_state_val = "done" if step.state == "approved" else ("rejected" if step.state == "rejected" else ("changes_requested" if step.state == "changes_requested" else step.state))
                workflow.append({
                    "key": "cleon_step_%d" % step.id,
                    "label": "%s (%s)" % (step.name, mode_label),
                    "actor": approver_names,
                    "role": dict(step._fields["state"].selection).get(step.state, step.state),
                    "timestamp": fields.Datetime.to_string(step.decision_at) if step.decision_at else False,
                    "state": step_state_val,
                    "completion_mode": step.completion_mode,
                    "progress_label": progress_label,
                    "total_approvers": total_approvers,
                    "approved_count": approved_count,
                    "decisions": decisions_list,
                    "comments": step.decision_comment or "",
                    "escalated": step.state == "escalated",
                    "system": False,
                })
        elif leave.approval_line_ids:
            workflow = [{
                "key": "approval_stage_%d" % line.id,
                "label": "%s · Level %d" % (line.stage_id.approver_type.replace("_", " ").title(), line.level),
                "actor": line.approver_id.name or _("Unassigned"),
                "role": dict(line._fields["status"].selection).get(line.status, line.status),
                "timestamp": fields.Datetime.to_string(line.actioned_at) if line.actioned_at else False,
                "state": line.status,
                "system": False,
                "comments": line.comments or "",
                "escalated": bool(line.escalated),
            } for line in leave.approval_line_ids.sorted(lambda item: (item.sequence, item.id))]
        for log in audit_logs:
            if log.action in ("submitted", "admin_create"):
                workflow.append({
                    "key": "submitted",
                    "label": "Request Submitted" if log.action == "submitted" else "Admin Created Request",
                    "actor": log.actor_label or (log.actor_id.name if log.actor_id else "Employee"),
                    "role": log.actor_role or ("Administrator" if log.action == "admin_create" else "Employee"),
                    "timestamp": fields.Datetime.to_string(log.occurred_at),
                    "state": "done",
                    "system": log.is_system,
                })
            elif log.action == "forwarded":
                workflow.append({
                    "key": "forwarded",
                    "label": "Forwarded to Manager",
                    "actor": log.actor_label or "System",
                    "role": log.actor_role or "Automated",
                    "timestamp": fields.Datetime.to_string(log.occurred_at),
                    "state": "done",
                    "system": True,
                })
            elif log.action in ("first_approval", "final_approval", "approve"):
                workflow.append({
                    "key": log.action,
                    "label": "Approved by Manager" if log.action in ("final_approval", "approve") else "First Approval Passed",
                    "actor": log.actor_label or (log.actor_id.name if log.actor_id else "Manager"),
                    "role": log.actor_role or "Line Manager",
                    "timestamp": fields.Datetime.to_string(log.occurred_at),
                    "state": "done",
                    "system": False,
                })
            elif log.action == "reject":
                workflow.append({
                    "key": "reject",
                    "label": "Rejected by Manager",
                    "actor": log.actor_label or (log.actor_id.name if log.actor_id else "Manager"),
                    "role": log.actor_role or "Line Manager",
                    "timestamp": fields.Datetime.to_string(log.occurred_at),
                    "state": "rejected",
                    "system": False,
                })
            elif log.action == "cancelled":
                workflow.append({
                    "key": "cancelled",
                    "label": "Leave Cancelled",
                    "actor": log.actor_label or (log.actor_id.name if log.actor_id else "Manager"),
                    "role": log.actor_role or "Manager",
                    "timestamp": fields.Datetime.to_string(log.occurred_at),
                    "state": "cancelled",
                    "system": False,
                })
            elif log.action == "escalated":
                workflow.append({
                    "key": "escalated",
                    "label": "Request Escalated",
                    "actor": log.actor_label or (log.actor_id.name if log.actor_id else "System"),
                    "role": log.actor_role or "Employee",
                    "timestamp": fields.Datetime.to_string(log.occurred_at),
                    "state": "escalated",
                    "system": log.is_system,
                    "comments": log.note or "",
                })

        if not workflow:
            submitted_by = leave.create_uid.name if leave.admin_created else leave.employee_id.name
            submitted_role = "Administrator" if leave.admin_created else "Employee"
            workflow.append({
                "key": "submitted",
                "label": "Request Submitted" if not leave.admin_created else "Admin Created Request",
                "actor": submitted_by,
                "role": submitted_role,
                "timestamp": fields.Datetime.to_string(leave.create_date),
                "state": "done",
                "system": False,
            })

        if status == "pending":
            workflow.append({
                "key": "pending_approval",
                "label": "Line Manager — Manager · Level 1",
                "actor": "Line Manager",
                "role": "Pending",
                "timestamp": False,
                "state": "pending",
                "system": False,
            })

        # Single Canonical Request History Log (FR-132, no duplicate entries)
        history = []
        for log in audit_logs:
            actor = "System" if log.is_system else (log.actor_label or (log.actor_id.name if log.actor_id else "User"))
            role = f" ({log.actor_role})" if log.actor_role and not log.is_system else ""

            if log.action == "admin_create":
                title = f"Request created by {actor} on behalf of {leave.employee_id.name}"
            elif log.action == "submitted":
                title = f"Request submitted by {leave.employee_id.name}"
            else:
                action_label = {
                    "forwarded": "Forwarded to Manager",
                    "first_approval": "First Approval",
                    "final_approval": "Final Approval",
                    "approve": "Approved",
                    "reject": "Rejected",
                    "cancelled": "Cancelled",
                    "escalated": "Escalated",
                    "request_changes": "Changes Requested",
                    "resubmitted": "Request Resubmitted",
                    "insight_feedback": "AI Insight Feedback",
                    "override_conflict": "Conflict Overridden",
                }.get(log.action, log.action)
                title = f"{action_label} by {actor}{role}"

            history.append({
                "title": title,
                "timestamp": fields.Datetime.to_string(log.occurred_at),
                "type": log.action,
                "note": log.note or "",
            })

        actions = {
            "can_approve": can_review and status == "pending" and not leave.is_cancelled,
            "can_reject": can_review and status == "pending" and not leave.is_cancelled,
            "can_request_changes": can_review and status == "pending" and not leave.is_cancelled,
            "can_cancel": access["can_operate"] and status == "approved" and not leave.is_cancelled,
        }

        res.update({
            "attachments": attachment_list,
            "balance_impact": balance_impact,
            "coverage_impact": coverage_impact,
            "workflow": workflow,
            "history": history,
            "actions": actions,
            "cancellation_reason": leave.cancellation_reason or "",
            "escalated": bool(leave.escalated),
            "escalation_note": leave.escalation_note or "",
            "rejection_reason": leave.rejection_reason or "",
            "rejection_category": leave.rejection_category or "",
            "changes_requested_comment": leave.changes_requested_comment or "",
            "changes_requested_by": leave.changes_requested_by_id.name if leave.changes_requested_by_id else "",
            "changes_requested_at": fields.Datetime.to_string(leave.changes_requested_at) if leave.changes_requested_at else "",
            "handover": {
                "enabled": bool(leave.handover_enabled),
                "backup_colleagues": [{"id": employee.id, "name": employee.name} for employee in leave.backup_colleague_ids],
                "emergency_contact": leave.emergency_contact or "",
                "notes": leave.handover_notes or "",
            },
            "submission_channel": leave.submission_channel,
            "cancelled_by": leave.cancelled_by_id.name if leave.cancelled_by_id else "",
            "cancelled_at": fields.Datetime.to_string(leave.cancelled_at) if leave.cancelled_at else "",
        })
        return res

    @api.model
    def approve_leave_request(self, leave_id, override_conflict=False, conflict_acknowledgment=""):
        leave = self.sudo().browse(int(leave_id)).exists()
        if not leave or leave.employee_id.company_id not in self.env.user.company_ids:
            raise ValidationError(_("Invalid leave request."))
        if leave.state not in ("confirm", "validate1") or leave.is_cancelled:
            raise ValidationError(_("This leave request is not awaiting approval."))

        inst = leave._get_pending_approval_instance()
        if not inst:
            raise UserError(_("Configuration Integrity Error: No active approval instance found for this pending leave request."))

        # Verify approver authority before checking business advisory thresholds
        current_step = inst.sudo().step_ids.filtered(lambda s: s.state == "pending")
        if current_step and not self.env.su:
            step_obj = current_step[0]
            if self.env.user not in step_obj.resolved_user_ids:
                raise AccessError(_("You are not authorized to decide on approval step '%s'.") % step_obj.name)

        # LM-041: Enforce coverage threshold server-side when capability is enabled
        if self.is_ai_capability_enabled("conflict_coverage"):
            coverage = self._get_leave_coverage_impact(leave)
            if coverage.get("threshold_exceeded") and not override_conflict:
                raise ValidationError(
                    _("Team absence threshold exceeded (coverage would drop below %(thresh)d%%). "
                      "Explicit conflict acknowledgment is required to proceed.",
                      thresh=100 - coverage.get("threshold_percent", 40))
                )

        inst.with_user(self.env.user).action_decide("approve")

        if override_conflict:
            note = conflict_acknowledgment or _("I have reviewed the coverage risk and choose to proceed.")
            leave._create_audit_record("override_conflict", note=note)

        leave._create_audit_record("approve")
        leave._post_configured_leave_update(
            _("Leave request approved by %s.", self.env.user.name)
        )
        return self.get_leave_request_detail(leave.id)

    @api.model
    def reject_leave_request(self, leave_id, reason="", category=""):
        reason = (reason or "").strip()
        if category not in dict(self._fields["rejection_category"].selection):
            raise ValidationError(_("A categorised rejection reason is required."))
        if len(reason) < 3:
            raise ValidationError(_("A rejection reason is required (at least 3 characters)."))
        leave = self.sudo().browse(int(leave_id)).exists()
        if not leave or leave.employee_id.company_id not in self.env.user.company_ids:
            raise ValidationError(_("Invalid leave request."))
        if leave.state not in ("confirm", "validate1") or leave.is_cancelled:
            raise ValidationError(_("Only a pending leave request can be rejected."))

        body = _("Leave request rejected by %(user)s.<br/><strong>Reason:</strong> %(reason)s",
                 user=self.env.user.name, reason=reason)
        leave._post_configured_leave_update(body)
        leave.sudo().write({"rejection_reason": reason, "rejection_category": category})

        inst = leave._get_pending_approval_instance()
        if not inst:
            raise UserError(_("Configuration Integrity Error: No active approval instance found for this pending leave request."))

        inst.with_user(self.env.user).action_decide("reject", comment=reason)

        leave._create_audit_record("reject", note=reason)
        return self.get_leave_request_detail(leave.id)

    @api.model
    def request_leave_changes(self, leave_id, comment=""):
        comment = (comment or "").strip()
        if not comment or len(comment) > 500:
            raise ValidationError(_("A comment of no more than 500 characters is required."))
        leave = self.sudo().browse(int(leave_id)).exists()
        if not leave or leave.employee_id.company_id not in self.env.user.company_ids:
            raise ValidationError(_("Invalid leave request."))
        if leave.state not in ("confirm", "validate1") or leave.is_cancelled or leave.changes_requested:
            raise ValidationError(_("Only a pending leave request can be returned for changes."))

        inst = leave._get_pending_approval_instance()
        if not inst:
            raise UserError(_("Configuration Integrity Error: No active approval instance found for this pending leave request."))

        inst.with_user(self.env.user).action_decide("request_changes", comment=comment)

        leave._create_audit_record("request_changes", note=comment)
        leave._post_configured_leave_update(_(
            "%(approver)s requested modifications.<br/><strong>Comment:</strong> %(comment)s",
            approver=self.env.user.name, comment=comment,
        ))
        return self.get_leave_request_detail(leave.id)

    @api.model
    def cancel_approved_leave(self, leave_id, reason=""):
        self._check_leave_operations_access()
        reason = (reason or "").strip()
        if len(reason) < 3:
            raise ValidationError(_("A cancellation reason is required (at least 3 characters)."))
        leave = self.browse(int(leave_id)).exists()
        if not leave or leave.employee_id.company_id != self.env.company:
            raise ValidationError(_("Invalid leave request."))

        if leave.state != "validate" or leave.is_cancelled:
            raise ValidationError(_("Only active approved leave requests can be cancelled."))

        if "cleon.approval.instance" in self.env:
            self.env["cleon.approval.instance"].sudo().action_cancel_for_target(leave, reason=reason)

        leave.action_refuse()
        leave.write({
            "is_cancelled": True,
            "cancelled_by_id": self.env.user.id,
            "cancelled_at": fields.Datetime.now(),
            "cancellation_reason": reason,
        })

        leave._create_audit_record("cancelled", note=reason)

        body = _("Approved leave cancelled by %(user)s.<br/><strong>Reason:</strong> %(reason)s",
                 user=self.env.user.name, reason=reason)
        leave._post_configured_leave_update(body)
        return self.get_leave_request_detail(leave.id)

    @api.model
    def approve_single_request(self, leave_id):
        return self.bulk_approve_leave_requests([leave_id])

    @api.model
    def reject_single_request(self, leave_id, reason="", category=""):
        return self.bulk_reject_leave_requests([leave_id], reason, category)

    # ---------------------------------------------------------
    # ADMIN CREATE LEAVE REQUEST METHODS (FR-101 to FR-112)
    # ---------------------------------------------------------

    @api.model
    def get_admin_create_options(self):
        self._check_leave_operations_access()
        emp_ids = self._get_company_employee_ids()
        employees = self.env["hr.employee"].sudo().browse(emp_ids).filtered("active")
        return {
            "employees": [{
                "id": emp.id,
                "name": emp.name,
                "employee_number": emp.employee_number or "",
                "identification_id": self._employee_identification(emp),
                "department": emp.department_id.name or "No Department",
                "job_title": emp.job_title or (emp.job_id.name if hasattr(emp, "job_id") and emp.job_id else "") or "Employee",
                "is_current_user": emp.user_id == self.env.user,
                "label": f"{emp.name} ({emp.employee_number or _('Staff number not assigned')} - {emp.department_id.name or _('No Department')})",
            } for emp in employees],
        }

    @api.model
    def get_admin_leave_types_for_employee(self, employee_id):
        self._check_leave_operations_access()
        employee = self.env["hr.employee"].sudo().browse(int(employee_id)).exists()
        if not employee or employee.company_id != self.env.company:
            raise ValidationError(_("Invalid employee."))

        LeaveType = self.env["hr.leave.type"].sudo().with_context(
            employee_id=employee.id,
            default_employee_id=employee.id,
        )
        leave_types = LeaveType.search([
            ("active", "=", True),
            "|", ("company_id", "=", False), ("company_id", "=", self.env.company.id),
        ])

        return [{
            "id": lt.id,
            "name": lt.name,
            "balance": getattr(lt, "virtual_remaining_leaves", 0),
            "requires_allocation": getattr(lt, "requires_allocation", "no"),
            "allows_negative": getattr(lt, "allows_negative", False),
            "max_allowed_negative": getattr(lt, "max_allowed_negative", 0) if getattr(lt, "allows_negative", False) else 0,
            "request_unit": getattr(lt, "request_unit", "day"),
        } for lt in leave_types]

    @api.model
    def preview_admin_leave_request(self, employee_id, leave_type_id, date_from, date_to, half_day=False, period="am"):
        self._check_leave_operations_access()
        employee = self.env["hr.employee"].sudo().browse(int(employee_id)).exists()
        leave_type = self.env["hr.leave.type"].sudo().browse(int(leave_type_id)).exists()
        if not employee or employee.company_id not in self.env.user.company_ids or not leave_type:
            raise ValidationError(_("Invalid leave request data."))

        vals = {
            "employee_id": employee.id,
            "holiday_status_id": leave_type.id,
            "request_date_from": date_from,
            "request_date_to": date_to,
            "request_unit_half": bool(half_day),
            "request_date_from_period": period,
        }
        preview = self.sudo().new(vals)
        if hasattr(preview, "_compute_department_id"):
            preview._compute_department_id()
        if hasattr(preview, "_compute_resource_calendar_id"):
            preview._compute_resource_calendar_id()
        if hasattr(preview, "_compute_date_from_to"):
            preview._compute_date_from_to()

        days = preview.number_of_days or 0.0

        # Check overlapping existing leave requests for FR-107.
        conflicts = self.sudo().search([
            ("employee_id", "=", employee.id),
            ("state", "in", ("confirm", "validate1", "validate")),
            ("request_date_from", "<=", date_to),
            ("request_date_to", ">=", date_from),
        ])

        return {
            "duration": round(days, 1),
            "conflicts": [{
                "id": c.id,
                "leave_type": c.holiday_status_id.name or "",
                "date_from": fields.Date.to_string(c.request_date_from),
                "date_to": fields.Date.to_string(c.request_date_to),
                "state": c.state,
            } for c in conflicts],
        }

    @api.model
    def create_admin_leave_request(
        self,
        employee_id,
        leave_type_id,
        date_from,
        date_to,
        admin_note,
        half_day=False,
        period="am",
        override_conflict=False,
        note="",
        attachment=None,
    ):
        self._check_leave_operations_access()
        admin_note = (admin_note or "").strip()
        note = (note or "").strip()
        attachment = attachment or {}
        if len(admin_note) < 10:
            raise ValidationError(_("Admin Note / Reason must contain at least 10 characters."))
        if len(note) > 1000:
            raise ValidationError(_("The optional note must not exceed 1,000 characters."))
        if attachment.get("data") and attachment.get("mimetype") not in (
            "application/pdf", "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/jpeg", "image/png",
        ):
            raise ValidationError(_("Only PDF, DOC, DOCX, JPG, and PNG attachments are supported."))
        if attachment.get("data"):
            try:
                if len(base64.b64decode(attachment["data"], validate=True)) > 10 * 1024 * 1024:
                    raise ValidationError(_("The attachment must not exceed 10 MB."))
            except ValueError:
                raise ValidationError(_("The supporting document is not a valid encoded file."))

        employee = self.env["hr.employee"].sudo().browse(int(employee_id)).exists()
        leave_type = self.env["hr.leave.type"].sudo().browse(int(leave_type_id)).exists()
        if not employee or employee.company_id != self.env.company or not leave_type:
            raise ValidationError(_("Invalid request data."))
        if self._employee_has_active_disciplinary_suspension(employee):
            self.env["hr.leave.audit.log"].sudo().create({
                "action": "failed", "event_status": "failed",
                "employee_id": employee.id, "leave_type_id": leave_type.id,
                "actor_id": self.env.user.id, "actor_label": self.env.user.name,
                "note": _("Admin submission blocked: employee is under an active disciplinary suspension."),
            })
            return {
                "created": False,
                "message": _("A leave request cannot be created while this employee is under an active disciplinary suspension."),
            }

        preview = self.preview_admin_leave_request(
            employee.id, leave_type.id, date_from, date_to, half_day, period
        )

        if preview["conflicts"] and not override_conflict:
            return {
                "created": False,
                "conflict": True,
                "conflicts": preview["conflicts"],
            }

        vals = {
            "employee_id": employee.id,
            "holiday_status_id": leave_type.id,
            "request_date_from": date_from,
            "request_date_to": date_to,
            "notes": admin_note + (("\n\n" + note) if note else ""),
            "request_unit_half": bool(half_day),
            "request_date_from_period": period,
            "admin_created": True,
            "admin_creation_note": admin_note,
            "admin_overlap_override": bool(override_conflict),
        }

        LeaveObj = self.sudo()
        if override_conflict:
            LeaveObj = LeaveObj.with_context(leave_skip_date_check=True)

        leave = LeaveObj.create(vals)
        if leave.state == "draft":
            leave.action_confirm()

        if attachment.get("data"):
            self.env["ir.attachment"].sudo().create({
                "name": attachment.get("name") or _("Supporting document"),
                "datas": attachment["data"],
                "mimetype": attachment.get("mimetype"),
                "res_model": "hr.leave",
                "res_id": leave.id,
            })

        # A calendar booking uses the same approval contract as every other
        # leave request. Only an explicitly configured "No Approval
        # Required" type may take effect immediately; single and multi-level
        # workflows remain pending for their configured approvers.
        if leave_type.approval_workflow == "none" and leave.state in ("confirm", "validate1"):
            leave.sudo().action_approve()
            if leave.state == "validate1":
                leave.sudo().action_validate()

        # Notify employee via chatter (FR-110)
        leave._post_configured_leave_update(
            _(
                "%(admin)s created a %(leave_type)s request on your behalf from %(start)s to %(end)s (%(duration)s days).",
                admin=self.env.user.name,
                leave_type=leave_type.name,
                start=leave.request_date_from,
                end=leave.request_date_to,
                duration=leave.number_of_days,
            )
        )

        # Create Immutable Audit Log (FR-111)
        action_type = "override_conflict" if override_conflict else "admin_create"
        leave._create_audit_record(action_type, note=admin_note)

        return {
            "created": True,
            "id": leave.id,
            "state": leave.state,
            "approved": leave.state == "validate",
            "message": _("Time off was booked and approved.") if leave.state == "validate" else _("The booking was submitted to its configured approval workflow."),
        }

    # ---------------------------------------------------------
    # SCREEN 11: LEAVE CALENDAR BACKEND API (FR-138 to FR-177)
    # ---------------------------------------------------------

    @api.model
    def _calendar_visibility_domain(self, calendar_scope):
        """Return a fail-closed record domain for an authorised scope."""
        if calendar_scope == "organisation":
            return [], False
        employee = self.env["hr.employee"].sudo().search([
            ("user_id", "=", self.env.user.id),
            ("company_id", "in", self.env.companies.ids),
            ("active", "=", True),
        ], limit=1)
        if not employee:
            return [("id", "=", 0)], False
        if calendar_scope == "personal":
            return [("employee_id", "=", employee.id)], employee
        direct_reports = self.env["hr.employee"].sudo().search([
            ("company_id", "in", self.env.companies.ids),
            ("active", "=", True),
            "|", ("leave_manager_id", "=", self.env.user.id),
                 ("parent_id", "=", employee.id),
        ])
        # A manager's calendar is the union of their own requests and
        # requests belonging to direct reports.  Build this on the
        # server so caller-supplied filters can narrow, never widen, access.
        team_domain = [
            ("employee_id", "in", [employee.id] + direct_reports.ids),
        ]
        return team_domain, employee

    @api.model
    def _calendar_default_status_domain(self):
        """Company visibility defaults used when the caller has not filtered status."""
        company = self.env.company
        conditions = [[("state", "in", ("confirm", "validate1", "validate")), ("is_cancelled", "=", False)]]
        if company.leave_show_cancelled:
            conditions.append([("is_cancelled", "=", True)])
        if company.leave_show_rejected:
            conditions.append([("state", "=", "refuse")])
        return expression.OR(conditions)

    @api.model
    def get_leave_calendar_data(
        self,
        date_from,
        date_to,
        department_ids=None,
        leave_type_ids=None,
        statuses=None,
        employee_ids=None,
        employee_view=False,
        calendar_scope=None,
    ):
        scope = self._check_leave_calendar_access(
            employee_scope=employee_view, calendar_scope=calendar_scope,
        )
        future_limit = fields.Date.context_today(self) + relativedelta(
            months=self.env.company.leave_calendar_future_months,
        )
        if fields.Date.to_date(date_from) > future_limit:
            raise ValidationError(_("This date is beyond the organisation calendar visibility window."))
        employee_view = scope != "organisation"

        department_ids = [int(x) for x in (department_ids or []) if x]
        leave_type_ids = [int(x) for x in (leave_type_ids or []) if x]
        statuses = [str(s) for s in (statuses or []) if s]
        employee_ids = [int(x) for x in (employee_ids or []) if x]

        domain = [
            ("employee_id.company_id", "=", self.env.company.id),
            ("request_date_from", "<=", date_to),
            ("request_date_to", ">=", date_from),
        ]

        visibility_domain, curr_emp = self._calendar_visibility_domain(scope)
        if visibility_domain:
            domain = expression.AND([domain, visibility_domain])
        if employee_ids:
            domain.append(("employee_id", "in", employee_ids))

        if department_ids:
            domain.append(("employee_id.department_id", "in", department_ids))

        if leave_type_ids:
            domain.append(("holiday_status_id", "in", leave_type_ids))

        if statuses:
            state_conditions = []
            if "approved" in statuses:
                state_conditions.append(("state", "=", "validate"))
            if "pending" in statuses:
                state_conditions.append(("state", "in", ("confirm", "validate1")))
            if "cancelled" in statuses:
                state_conditions.append(("is_cancelled", "=", True))

            if state_conditions:
                or_domain = []
                for idx, cond in enumerate(state_conditions):
                    if idx > 0:
                        or_domain = ["|"] + or_domain
                    or_domain.append(cond)
                domain.extend(or_domain)
        else:
            domain = expression.AND([domain, self._calendar_default_status_domain()])

        # Personal scope is also evaluated by Odoo's native hr.leave record
        # rules. Team/organisation scopes use the explicit capability check
        # and server-built relationship domain above because the custom team
        # role is intentionally independent of Odoo's mutation-capable Time
        # Off Officer groups.
        CalendarLeave = self if scope == "personal" else self.sudo()
        authorised_leave_ids = CalendarLeave.search(
            domain, order="request_date_from asc",
        ).ids
        # hr.employee contains private fields in this installation. Elevate
        # only the already-authorised ids while serialising public calendar
        # labels, otherwise a self-service user cannot read employee_id.name.
        leaves = self.sudo().browse(authorised_leave_ids)

        privacy = self.env.company.leave_calendar_privacy
        access = self.get_leave_access_profile()
        can_read_operations = access["can_operate"] or access["can_view_audit"]
        approval_users_by_leave = {}
        if "cleon.approval.instance" in self.env and leaves:
            approval_instances = self.env["cleon.approval.instance"].sudo().search([
                ("res_model", "=", "hr.leave"),
                ("res_id", "in", leaves.ids),
            ], order="id desc")
            for approval_instance in approval_instances:
                approval_users_by_leave.setdefault(
                    approval_instance.res_id,
                    approval_instance.step_ids.mapped("resolved_user_ids"),
                )
        leave_list = []
        for l in leaves:
            status = l._get_cleon_leave_status()
            is_own = bool(curr_emp and l.employee_id == curr_emp)
            can_review = l._leave_can_review(self.env.user)
            is_approver_on_workflow = self.env.user in approval_users_by_leave.get(
                l.id, self.env["res.users"],
            )
            can_open_detail = bool(
                is_own or can_review or can_read_operations or is_approver_on_workflow
            )
            restricted = not can_open_detail and privacy in ("limited", "anonymous")
            leave_list.append({
                "id": l.id,
                "request_ref": l.request_ref or f"LR-{l.id:06d}",
                "employee_id": l.employee_id.id,
                "employee_name": _("Unavailable") if restricted and privacy == "anonymous" else l.employee_id.name or "",
                "department_id": False if restricted and privacy == "anonymous" else l.employee_id.department_id.id if l.employee_id.department_id else False,
                "department_name": "" if restricted and privacy == "anonymous" else l.employee_id.department_id.name or "No Department",
                "job_title": "" if restricted else l.employee_id.job_title or (l.employee_id.job_id.name if l.employee_id.job_id else "") or _("Employee"),
                "leave_type_id": l.holiday_status_id.id,
                "leave_type_name": _("Leave") if restricted else l.holiday_status_id.name or "",
                "color": getattr(l.holiday_status_id, "color", 0),
                "color_hex": l.holiday_status_id.cleon_color_hex or "#64748B",
                "date_from": fields.Date.to_string(l.request_date_from),
                "date_to": fields.Date.to_string(l.request_date_to),
                "duration": round(l.number_of_days or 0.0, 1),
                "status": status,
                "status_label": dict(self._fields["state"]._description_selection(self.env)).get(l.state, status.title()),
                "half_day": bool(l.request_unit_half),
                "half_day_period": l.request_date_from_period if l.request_unit_half else False,
                "notes": (l.notes or l.admin_creation_note or "") if not restricted else "",
                "is_own": is_own,
                "can_open_detail": can_open_detail,
            })

        leave_types = self.env["hr.leave.type"].sudo().search([
            ("active", "=", True),
            ("company_id", "in", [False, self.env.company.id]),
        ])
        if scope != "organisation":
            if scope == "personal":
                visible_employee_ids = [curr_emp.id] if curr_emp else []
            else:
                visible_employee_ids = [curr_emp.id] + self.env["hr.employee"].sudo().search([
                    ("company_id", "in", self.env.companies.ids),
                    ("active", "=", True),
                    "|", ("leave_manager_id", "=", self.env.user.id),
                         ("parent_id", "=", curr_emp.id),
                ]).ids if curr_emp else []
            company_employees = self.env["hr.employee"].sudo().browse(
                list(set(visible_employee_ids)),
            ).exists()
            departments = company_employees.mapped("department_id")
        else:
            departments = self.env["hr.department"].sudo().search([
                ("company_id", "=", self.env.company.id),
            ])
            company_employees = self.env["hr.employee"].sudo().search([
                ("company_id", "=", self.env.company.id),
                ("active", "=", True),
            ])

        if department_ids:
            company_employees = company_employees.filtered(
                lambda employee: employee.department_id.id in department_ids
            )
        if employee_ids:
            company_employees = company_employees.filtered(
                lambda employee: employee.id in employee_ids
            )

        public_holidays = self.env["resource.calendar.leaves"].sudo().search([
            ("company_id", "in", [False, self.env.company.id]),
            ("resource_id", "=", False),
            ("date_from", "<=", date_to + " 23:59:59"),
            ("date_to", ">=", date_from + " 00:00:00"),
        ], order="date_from asc")

        return {
            "leaves": leave_list,
            "leave_types": [{
                "id": lt.id,
                "name": lt.name,
                "color": getattr(lt, "color", 0),
                "color_hex": lt.cleon_color_hex or "#64748B",
            } for lt in leave_types],
            "departments": [{
                "id": dept.id,
                "name": dept.name,
            } for dept in departments],
            "employees": [{
                "id": emp.id,
                "name": emp.name,
                "department": emp.department_id.name or "No Department",
            } for emp in company_employees],
            "total_active_employees": len(company_employees) or 1,
            "calendar_scope": scope,
            "holidays": [{
                "id": holiday.id,
                "name": holiday.name or _("Public Holiday"),
                "date_from": fields.Date.to_string(holiday.date_from.date()),
                "date_to": fields.Date.to_string(holiday.date_to.date()),
            } for holiday in public_holidays],
        }

    @api.model
    def get_leave_calendar_year_summary(
        self,
        year,
        department_ids=None,
        leave_type_ids=None,
        statuses=None,
        employee_ids=None,
        employee_view=False,
        calendar_scope=None,
        country_id=None,
    ):
        scope = self._check_leave_calendar_access(
            employee_scope=employee_view, calendar_scope=calendar_scope,
        )
        employee_view = scope != "organisation"
        year = int(year)
        future_limit = fields.Date.context_today(self) + relativedelta(
            months=self.env.company.leave_calendar_future_months,
        )
        if fields.Date.to_date(f"{year}-01-01") > future_limit:
            raise ValidationError(_("This year is beyond the organisation calendar visibility window."))
        date_from = f"{year}-01-01"
        date_to = f"{year}-12-31"

        department_ids = [int(x) for x in (department_ids or []) if x]
        leave_type_ids = [int(x) for x in (leave_type_ids or []) if x]
        statuses = [str(s) for s in (statuses or []) if s]
        employee_ids = [int(x) for x in (employee_ids or []) if x]

        domain = [
            ("employee_id.company_id", "=", self.env.company.id),
            ("request_date_from", "<=", date_to),
            ("request_date_to", ">=", date_from),
        ]

        visibility_domain, _curr_emp = self._calendar_visibility_domain(scope)
        if visibility_domain:
            domain = expression.AND([domain, visibility_domain])
        if employee_ids:
            domain.append(("employee_id", "in", employee_ids))

        if department_ids:
            domain.append(("employee_id.department_id", "in", department_ids))

        if leave_type_ids:
            domain.append(("holiday_status_id", "in", leave_type_ids))

        if statuses:
            state_conditions = []
            if "approved" in statuses:
                state_conditions.append(("state", "=", "validate"))
            if "pending" in statuses:
                state_conditions.append(("state", "in", ("confirm", "validate1")))
            if "cancelled" in statuses:
                state_conditions.append(("is_cancelled", "=", True))

            if state_conditions:
                or_domain = []
                for idx, cond in enumerate(state_conditions):
                    if idx > 0:
                        or_domain = ["|"] + or_domain
                    or_domain.append(cond)
                domain.extend(or_domain)
        else:
            domain = expression.AND([domain, self._calendar_default_status_domain()])

        CalendarLeave = self.sudo()
        leaves = CalendarLeave.search(domain)

        month_summary = {m: {"approved": 0, "pending": 0, "holidays": 0} for m in range(1, 13)}
        day_occupancy = {}

        for l in leaves:
            status = l._get_cleon_leave_status()

            # FR-164: Count each request ONCE per month it spans
            req_start_m = l.request_date_from.month if l.request_date_from else 1
            req_end_m = l.request_date_to.month if l.request_date_to else 12
            for m in range(req_start_m, req_end_m + 1):
                if 1 <= m <= 12:
                    if status == "approved":
                        month_summary[m]["approved"] += 1
                    elif status == "pending":
                        month_summary[m]["pending"] += 1

            # Day occupancy counts daily occupied days
            curr = max(l.request_date_from, fields.Date.from_string(date_from))
            end_d = min(l.request_date_to, fields.Date.from_string(date_to))
            while curr <= end_d:
                d_str = fields.Date.to_string(curr)
                if d_str not in day_occupancy:
                    day_occupancy[d_str] = {"approved": 0, "pending": 0, "total": 0}

                if status == "approved":
                    day_occupancy[d_str]["approved"] += 1
                elif status == "pending":
                    day_occupancy[d_str]["pending"] += 1
                day_occupancy[d_str]["total"] += 1

                curr += relativedelta(days=1)

        # Dynamic Public Holidays (Feedback 6 & 7 - No hardcoded fallback)
        public_leaves = self.env["resource.calendar.leaves"].sudo().search([
            ("company_id", "in", [False, self.env.company.id]),
            ("resource_id", "=", False),
            ("date_from", "<=", f"{year}-12-31 23:59:59"),
            ("date_to", ">=", f"{year}-01-01 00:00:00"),
        ])

        holidays_data = []
        for pl in public_leaves:
            h_date = fields.Date.to_string(pl.date_from.date())
            m = pl.date_from.date().month
            holidays_data.append({
                "date": h_date,
                "name": pl.name or "Public Holiday",
                "month": m,
            })

        for h in holidays_data:
            m = h["month"]
            if m in month_summary:
                month_summary[m]["holidays"] += 1

        selected_country = None
        if country_id:
            selected_country = self.env["res.country"].sudo().browse(int(country_id))
        if not selected_country or not selected_country.exists():
            selected_country = self.env.company.country_id
        if not selected_country:
            selected_country = self.env["res.country"].sudo().search([], limit=1)

        country_dict = {
            "id": selected_country.id if selected_country else 0,
            "name": selected_country.name if selected_country else "Default Region",
            "code": selected_country.code if selected_country else "DEF",
        }

        all_countries = [
            {"id": c.id, "name": c.name, "code": c.code}
            for c in self.env["res.country"].sudo().search([], order="name asc", limit=250)
        ]

        return {
            "year": year,
            "month_summary": month_summary,
            "day_occupancy": day_occupancy,
            "holidays": holidays_data,
            "country": country_dict,
            "all_countries": all_countries,
        }


class HrLeaveAllocation(models.Model):
    _inherit = "hr.leave.allocation"

    def _check_leave_allocation_mutation(self):
        if not self.env.user.has_group(
            "hr_leave_dashboard.group_leave_permission_operations"
        ):
            raise AccessError(_("You do not have permission to allocate or amend leave balances."))

    @api.model_create_multi
    def create(self, vals_list):
        self._check_leave_allocation_mutation()
        return super().create(vals_list)

    def write(self, values):
        self._check_leave_allocation_mutation()
        return super().write(values)

    def unlink(self):
        self._check_leave_allocation_mutation()
        return super().unlink()
