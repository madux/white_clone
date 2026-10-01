# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class CleonApprovalChain(models.Model):
    _name = "cleon.approval.chain"
    _description = "CleonHR Multi-Level Approval Chain"
    _order = "company_id, workflow_type_id, sequence, id"

    name = fields.Char(required=True, string="Chain Name")
    code = fields.Char(index=True, string="Route Code")
    description = fields.Text()
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)
    workflow_type_id = fields.Many2one("cleon.approval.workflow.type", required=True, index=True, string="Workflow Type")
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    lifecycle_state = fields.Selection([
        ("draft", "Draft"), ("active", "Active"), ("inactive", "Inactive"),
        ("archived", "Archived"),
    ], default="active", required=True, index=True)
    route_type = fields.Selection([
        ("single", "Single Level"), ("multi", "Multi-Level"), ("custom", "Custom"),
    ], default="multi", required=True)
    on_approval = fields.Selection([
        ("next", "Move to Next Level"),
        ("complete", "Complete Workflow (single-level only)"),
        ("custom", "Legacy: Custom Action (unsupported — reconfigure)"),
    ], default="next", required=True)
    on_rejection = fields.Selection([
        ("stop", "Stop and Notify Requester"),
        ("return", "Legacy: Return to Previous Level (unsupported — reconfigure)"),
        ("specific", "Legacy: Return to Specific Level (unsupported — reconfigure)"),
        ("custom", "Legacy: Custom Action (unsupported — reconfigure)"),
    ], default="stop", required=True)
    remarks = fields.Text()
    is_default = fields.Boolean(default=True, string="Default Active Chain")
    step_ids = fields.One2many("cleon.approval.step", "chain_id", string="Approval Steps")

    def action_duplicate_workflow(self):
        """Copy route configuration and levels, never live approval instances."""
        self.ensure_one()
        steps = []
        for step in self.step_ids:
            values = step.copy_data()[0]
            values.pop("chain_id", None)
            steps.append((0, 0, values))
        return self.copy({
            "name": _("%s (Copy)") % self.name,
            "code": False,
            "active": False,
            "is_default": False,
            "step_ids": steps,
        }).id

    @api.constrains("company_id", "workflow_type_id", "active", "is_default")
    def _check_unique_default_chain(self):
        for chain in self:
            if chain.active and chain.is_default:
                domain = [
                    ("id", "!=", chain.id),
                    ("company_id", "=", chain.company_id.id),
                    ("workflow_type_id", "=", chain.workflow_type_id.id),
                    ("active", "=", True),
                    ("is_default", "=", True),
                ]
                if self.search_count(domain) > 0:
                    raise ValidationError(_("Only one active default approval chain is permitted per company and workflow type."))

    @api.constrains("route_type", "step_ids", "active")
    def _check_route_type(self):
        for chain in self:
            if chain.active and chain.route_type == "single" and len(chain.step_ids) != 1:
                raise ValidationError(_("A Single Level Approval Route must contain exactly one level."))

    @api.model_create_multi
    def create(self, vals_list):
        for values in vals_list:
            if "active" in values:
                values["lifecycle_state"] = "active" if values["active"] else "inactive"
            elif values.get("lifecycle_state"):
                values["active"] = values["lifecycle_state"] == "active"
        return super().create(vals_list)

    def write(self, values):
        values = dict(values)
        if "lifecycle_state" in values:
            values["active"] = values["lifecycle_state"] == "active"
        elif "active" in values:
            values["lifecycle_state"] = "active" if values["active"] else "inactive"
        return super().write(values)

    @api.constrains("step_ids")
    def _check_step_configuration(self):
        for chain in self:
            if chain.active and not chain.step_ids:
                raise ValidationError(_("An active approval chain must contain at least one step."))


class CleonApprovalStep(models.Model):
    _name = "cleon.approval.step"
    _description = "CleonHR Master Approval Step"
    _order = "sequence, id"

    chain_id = fields.Many2one("cleon.approval.chain", required=True, ondelete="cascade", index=True)
    sequence = fields.Integer(default=10, required=True)
    name = fields.Char(required=True, string="Step Name")
    completion_mode = fields.Selection([
        ("single", "Single Approver"),
        ("any", "Any One Approver"),
        ("all", "All Approvers"),
    ], default="any", required=True, string="Completion Mode")
    approver_type = fields.Selection([
        ("line_manager", "Direct Manager"),
        ("managers_manager", "Manager's Manager"),
        ("department_head", "Department Head"),
        ("job", "Position / Job"),
        ("group", "User Group / Role"),
        ("specific_user", "Specific User"),
        ("specific_users", "Multiple Specific Users"),
        ("target_resolver", "Target Record Dynamic Resolver"),
    ], default="line_manager", required=True)
    step_code = fields.Char(string="Step Code / Target Resolver Key", index=True)
    approver_group_id = fields.Many2one("res.groups", string="Approver Group / Role")
    specific_user_id = fields.Many2one("res.users", string="Specific Approver User")
    approver_user_ids = fields.Many2many(
        "res.users",
        "cleon_approval_step_users_rel",
        "step_id",
        "user_id",
        string="Specific Approver Users",
    )
    approver_job_id = fields.Many2one("hr.job", string="Approver Position / Job")
    sla_timeout_hours = fields.Integer(default=24, string="SLA Timeout (Hours)")
    sla_action = fields.Selection([
        ("escalate_next", "Escalate to Next Step"),
        ("auto_approve", "Auto-Approve"),
        ("auto_reject", "Auto-Reject"),
    ], default="escalate_next", required=True, string="SLA Escalation Action")

    _sql_constraints = [
        ("chain_sequence_unique", "unique(chain_id, sequence)", "Approval step sequence numbers must be unique within an approval chain."),
    ]

    @api.constrains("sla_timeout_hours")
    def _check_sla_timeout_hours(self):
        for step in self:
            if step.sla_timeout_hours < 0:
                raise ValidationError(_("Step '%s': SLA timeout hours cannot be negative.") % step.name)

    @api.constrains("approver_type", "approver_group_id", "specific_user_id", "approver_user_ids", "approver_job_id", "completion_mode")
    def _check_approver_fields(self):
        for step in self:
            if step.approver_type == "group" and not step.approver_group_id:
                raise ValidationError(_("Step '%s': An approver group must be specified when approver type is 'User Group / Role'.") % step.name)
            if step.approver_type == "specific_user" and not step.specific_user_id:
                raise ValidationError(_("Step '%s': A specific approver user must be designated when approver type is 'Specific User'.") % step.name)
            if step.approver_type == "specific_users" and not step.approver_user_ids:
                raise ValidationError(_("Step '%s': At least one designated user must be selected when approver type is 'Multiple Specific Users'.") % step.name)
            if step.approver_type == "job" and not step.approver_job_id:
                raise ValidationError(_("Step '%s': Select an approver position/job.") % step.name)
            if step.completion_mode == "single" and step.approver_type == "specific_users" and len(step.approver_user_ids) > 1:
                raise ValidationError(_("Step '%s': 'Single Approver' mode requires exactly one approver. Use 'Any One Approver' or 'All Approvers' for multiple designated users.") % step.name)
