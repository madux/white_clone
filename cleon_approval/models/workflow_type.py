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
