# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class CleonApprovalWorkflowType(models.Model):
    _name = "cleon.approval.workflow.type"
    _description = "CleonHR Approval Workflow Type Registry"
    _order = "name, id"

    code = fields.Char(required=True, index=True, string="Workflow Type Code")
    name = fields.Char(required=True, string="Workflow Name")
    model_id = fields.Many2one("ir.model", required=True, ondelete="cascade", string="Target Model")
    model_name = fields.Char(related="model_id.model", store=True, readonly=True, string="Technical Model Name")
    active = fields.Boolean(default=True)
    description = fields.Text()
    event_trigger = fields.Selection([
        ("leave_request", "Leave Request"), ("leave_extension", "Leave Extension"),
        ("leave_cancellation", "Leave Cancellation"), ("early_return", "Early Return"),
        ("normal_return", "Normal Return"), ("late_return", "Late / Unconfirmed Return"),
        ("balance_amendment", "Leave Balance Amendment"),
        ("negative_balance", "Negative Balance Exception"),
        ("blackout_exception", "Blackout Period Exception"),
        ("coverage_exception", "Coverage / Handover Exception"),
        ("handover_requirement", "Handover Requirement"),
        ("approval_override", "Approval Override"),
    ], default="leave_request", required=True)
    module_code = fields.Selection([
        ("leave", "Leave Management"), ("hr", "HR Administration"),
        ("organisation", "Organisation"),
    ], default="leave", required=True)
    approval_requirement = fields.Selection([
        ("yes", "Yes"), ("no", "No — Automatic"), ("conditional", "Conditional — Based on Rules"),
    ], default="yes", required=True)
    default_behavior = fields.Selection([
        ("approval_route", "Approval Route"), ("linked", "Linked Approval"),
        ("exception", "Exception Review"), ("automatic", "Automatic"),
        ("override", "Override Workflow"),
    ], default="approval_route", required=True)
    default_chain_id = fields.Many2one("cleon.approval.chain", ondelete="restrict", string="Default Approval Route")
    rules_enabled = fields.Boolean(default=False)
    escalation_enabled = fields.Boolean(default=True)
    use_global_sla = fields.Boolean(default=False)
    global_sla_hours = fields.Integer(default=24)

    _sql_constraints = [
        ("code_unique", "unique(code)", "Workflow type code must be unique."),
    ]

    @api.constrains("model_id")
    def _check_target_model_hooks(self):
        for wft in self:
            if wft.model_name and wft.model_name in self.env:
                ModelClass = self.env[wft.model_name].__class__
                required_hooks = [
                    "_approval_workflow_code",
                    "_approval_employee",
                    "_approval_company",
                    "_approval_period",
                    "_approval_validate_decision",
                    "_approval_finalize_approve",
                    "_approval_finalize_reject",
                ]
                missing = [hook for hook in required_hooks if not hasattr(ModelClass, hook)]
                if missing:
                    raise ValidationError(_("Target model '%s' registered for workflow type '%s' is missing required callback hooks: %s") % (wft.model_name, wft.code, ", ".join(missing)))

    @api.constrains("default_chain_id", "global_sla_hours", "approval_requirement")
    def _check_approval_configuration(self):
        for workflow in self:
            if workflow.global_sla_hours < 0:
                raise ValidationError(_("Global SLA cannot be negative."))
            if workflow.default_chain_id and workflow.default_chain_id.workflow_type_id != workflow:
                raise ValidationError(_("The default Approval Route must belong to this Workflow Type."))
            if workflow.approval_requirement == "no" and workflow.default_chain_id:
                raise ValidationError(_("An automatic Workflow Type cannot have a mandatory default Approval Route."))
