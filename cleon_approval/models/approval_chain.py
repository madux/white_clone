# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class CleonApprovalChain(models.Model):
    _name = "cleon.approval.chain"
    _description = "CleonHR Multi-Level Approval Chain"
    _order = "company_id, workflow_type_id, sequence, id"

    name = fields.Char(required=True, string="Chain Name")
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)
    workflow_type_id = fields.Many2one("cleon.approval.workflow.type", required=True, index=True, string="Workflow Type")
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    is_default = fields.Boolean(default=True, string="Default Active Chain")
    step_ids = fields.One2many("cleon.approval.step", "chain_id", string="Approval Steps")

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
    approver_type = fields.Selection([
        ("line_manager", "Direct Manager"),
        ("group", "User Group / Role"),
        ("specific_user", "Specific User"),
    ], default="line_manager", required=True)
    approver_group_id = fields.Many2one("res.groups", string="Approver Group / Role")
    specific_user_id = fields.Many2one("res.users", string="Specific Approver User")
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

    @api.constrains("approver_type", "approver_group_id", "specific_user_id")
    def _check_approver_fields(self):
        for step in self:
            if step.approver_type == "group" and not step.approver_group_id:
                raise ValidationError(_("Step '%s': An approver group must be specified when approver type is 'User Group / Role'.") % step.name)
            if step.approver_type == "specific_user" and not step.specific_user_id:
                raise ValidationError(_("Step '%s': A specific approver user must be designated when approver type is 'Specific User'.") % step.name)
