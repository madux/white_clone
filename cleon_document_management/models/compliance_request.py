# -*- coding: utf-8 -*-
"""Compliance Request (Section 11): task definitions, cycles, policy fields."""

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

REQUEST_TASK_TYPES = [
    ("read", "Read"),
    ("acknowledge", "Acknowledge"),
    ("declaration", "Declaration"),
    ("upload_evidence", "Upload evidence"),
    ("complete_form", "Complete form"),
]

REQUEST_TRIGGERS = [
    ("policy_effective", "Policy effective date"),
    ("employee_start", "Employee start date"),
    ("joined_scope", "Joined scope"),
    ("people_change", "Role / department / location change"),
    ("specific_date", "Specific date"),
    ("recurring", "Recurring schedule"),
]

TASKS_NEEDED_MODES = [
    ("all_required", "All required tasks"),
    ("any_required", "At least one required task"),
    ("minimum_count", "Minimum number of required tasks"),
]


class ComplianceRequestTaskDefinition(models.Model):
    _name = "doc.compliance.request.task.definition"
    _description = "Compliance request task definition"
    _order = "sequence, id"

    policy_id = fields.Many2one(
        "doc.compliance.policy",
        required=True,
        ondelete="cascade",
        index=True,
    )
    sequence = fields.Integer(default=10)
    name = fields.Char(required=True)
    instructions = fields.Text()
    task_type = fields.Selection(REQUEST_TASK_TYPES, required=True, default="acknowledge")
    requirement = fields.Selection(
        [("required", "Required"), ("optional", "Optional")],
        required=True,
        default="required",
    )
    linked_org_policy_id = fields.Many2one(
        "doc.organizational.policy",
        string="Linked organizational policy",
        ondelete="set null",
    )
    linked_document_id = fields.Many2one(
        "doc.document",
        string="Linked document",
        ondelete="set null",
        domain="[('folder_id.is_organizational', '=', True)]",
    )
    source_folder_id = fields.Many2one(
        "doc.folder",
        string="Picked from folder",
        ondelete="set null",
        help="Folder the linked content was selected from; used to group tasks.",
    )
    declaration_text = fields.Text(string="Declaration statement")
    evidence_document_type_id = fields.Many2one(
        "doc.document.type",
        string="Evidence document type",
        ondelete="restrict",
    )
    linked_form_id = fields.Many2one(
        "doc.template",
        string="Form template",
        ondelete="restrict",
        domain="[('kind', '=', 'form'), ('status', '=', 'published')]",
    )

    @api.constrains(
        "task_type",
        "linked_org_policy_id",
        "linked_document_id",
        "declaration_text",
        "evidence_document_type_id",
        "linked_form_id",
    )
    def _check_task_configuration(self):
        for task in self:
            code = task.task_type
            if code in ("read", "acknowledge"):
                if not task.linked_org_policy_id and not task.linked_document_id:
                    raise ValidationError(
                        _(
                            "Task “%s” must link to organizational content or a document."
                        )
                        % task.name
                    )
            elif code == "declaration":
                if not (task.declaration_text or "").strip():
                    raise ValidationError(
                        _("Task “%s” requires a declaration statement.") % task.name
                    )
            elif code == "upload_evidence":
                if not task.evidence_document_type_id:
                    raise ValidationError(
                        _("Task “%s” requires an evidence document type.") % task.name
                    )
            elif code == "complete_form":
                if not task.linked_form_id:
                    raise ValidationError(
                        _("Task “%s” requires an active form template.") % task.name
                    )

    def to_api_dict(self):
        self.ensure_one()
        return {
            "id": self.id,
            "sequence": self.sequence,
            "name": self.name,
            "instructions": self.instructions or "",
            "task_type": self.task_type,
            "requirement": self.requirement,
            "linked_org_policy_id": self.linked_org_policy_id.id or False,
            "linked_org_policy_name": self.linked_org_policy_id.name or "",
            "linked_document_id": self.linked_document_id.id or False,
            "linked_document_name": self.linked_document_id.name or "",
            "source_folder_id": self.source_folder_id.id or False,
            "source_folder_name": self.source_folder_id.folder_name or "",
            "declaration_text": self.declaration_text or "",
            "evidence_document_type_id": self.evidence_document_type_id.id or False,
            "evidence_document_type_name": self.evidence_document_type_id.name or "",
            "linked_form_id": self.linked_form_id.id or False,
            "linked_form_name": self.linked_form_id.name or "",
        }


class ComplianceRequestCycle(models.Model):
    _name = "doc.compliance.request.cycle"
    _description = "Compliance request cycle"
    _order = "opened_at desc, id desc"

    policy_id = fields.Many2one(
        "doc.compliance.policy", required=True, ondelete="cascade", index=True
    )
    employee_id = fields.Many2one(
        "hr.employee", required=True, ondelete="cascade", index=True
    )
    trigger_kind = fields.Selection(REQUEST_TRIGGERS, required=True)
    triggered_at = fields.Datetime(required=True, default=fields.Datetime.now)
    opened_at = fields.Datetime(required=True, default=fields.Datetime.now)
    due_date = fields.Date(required=True, index=True)
    grace_end_date = fields.Date(required=True)
    state = fields.Selection(
        [
            ("open", "Open"),
            ("compliant", "Compliant"),
            ("non_compliant", "Non-compliant"),
            ("withdrawn", "Withdrawn"),
        ],
        default="open",
        required=True,
        index=True,
    )
    closed_at = fields.Datetime()
    task_ids = fields.One2many(
        "doc.compliance.task", "cycle_id", string="Tasks"
    )

    def write(self, vals):
        closing = "state" in vals and vals.get("state") != "open"
        res = super().write(vals)
        if closing:
            for cycle in self:
                cycle.policy_id._revoke_compliance_content_assignments(cycle)
        return res


class CompliancePolicyRequestFields(models.Model):
    _inherit = "doc.compliance.policy"

    request_task_definition_ids = fields.One2many(
        "doc.compliance.request.task.definition",
        "policy_id",
        string="Request task definitions",
    )
    request_cycle_ids = fields.One2many(
        "doc.compliance.request.cycle",
        "policy_id",
        string="Request cycles",
    )
    request_trigger = fields.Selection(
        REQUEST_TRIGGERS,
        string="When it starts",
    )
    request_start_date = fields.Date(string="Start / anchor date")
    repeat_every_months = fields.Integer(
        string="Repeat every (months)",
        default=0,
        help="0 = one-off (non-recurring).",
    )
    tasks_needed_mode = fields.Selection(
        TASKS_NEEDED_MODES,
        default="all_required",
    )
    tasks_needed_minimum = fields.Integer(default=1)
    reopen_on_content_change = fields.Boolean(
        string="Reopen if linked content changes",
        default=True,
    )
    last_request_cycle_at = fields.Datetime(
        help="Last time a recurring cycle was opened for this policy.",
    )

    def _is_compliance_request(self):
        self.ensure_one()
        return (
            self.policy_type_id
            and self.policy_type_id.code == "compliance_request"
        )

    @api.constrains(
        "policy_type_id",
        "request_task_definition_ids",
        "request_trigger",
        "due_days",
        "repeat_every_months",
        "tasks_needed_mode",
        "tasks_needed_minimum",
        "request_start_date",
        "active",
        "lifecycle_status",
    )
    def _check_compliance_request_policy(self):
        # Tasks are synced after create(); the controller re-runs this check once they exist.
        if self.env.context.get("defer_compliance_request_check"):
            return
        for policy in self:
            if not policy._is_compliance_request():
                continue
            if policy.lifecycle_status == "draft":
                continue
            definitions = policy.request_task_definition_ids
            if not definitions:
                raise ValidationError(
                    _("Add at least one task for this compliance request.")
                )
            if not definitions.filtered(lambda d: d.requirement == "required"):
                raise ValidationError(
                    _("Add at least one required task for this compliance request.")
                )
            if not policy.request_trigger:
                raise ValidationError(_("Select when this compliance request starts."))
            if policy.request_trigger == "specific_date" and not policy.request_start_date:
                raise ValidationError(
                    _("Specific date trigger requires a start date.")
                )
            if policy.request_trigger == "recurring":
                if not policy.repeat_every_months or policy.repeat_every_months < 1:
                    raise ValidationError(
                        _("Recurring requests require a repeat interval of at least 1 month.")
                    )
                if not policy.request_start_date:
                    raise ValidationError(
                        _("Recurring requests require a start date.")
                    )
                repeat_days = policy.repeat_every_months * 30
                due = max(policy.due_days or 0, 1)
                if due >= repeat_days:
                    raise ValidationError(
                        _(
                            "Due within must be shorter than the repeat period "
                            "for recurring compliance requests."
                        )
                    )
            if policy.tasks_needed_mode == "minimum_count":
                required_count = len(
                    definitions.filtered(lambda d: d.requirement == "required")
                )
                minimum = max(policy.tasks_needed_minimum or 0, 1)
                if minimum > required_count:
                    raise ValidationError(
                        _(
                            "Minimum tasks needed cannot exceed the number of required tasks."
                        )
                    )

    def _sync_request_task_definitions(self, task_payloads):
        """Replace task definitions from API payload list."""
        self.ensure_one()
        Definition = self.env["doc.compliance.request.task.definition"]
        existing = {item.id: item for item in self.request_task_definition_ids}
        keep_ids = []
        for index, payload in enumerate(task_payloads or []):
            vals = {
                "policy_id": self.id,
                "sequence": (index + 1) * 10,
                "name": (payload.get("name") or "").strip(),
                "instructions": payload.get("instructions") or "",
                "task_type": payload.get("task_type") or "acknowledge",
                "requirement": payload.get("requirement") or "required",
                "linked_org_policy_id": int(payload.get("linked_org_policy_id") or 0)
                or False,
                "linked_document_id": int(payload.get("linked_document_id") or 0)
                or False,
                "source_folder_id": int(payload.get("source_folder_id") or 0) or False,
                "declaration_text": payload.get("declaration_text") or "",
                "evidence_document_type_id": int(
                    payload.get("evidence_document_type_id") or 0
                )
                or False,
                "linked_form_id": int(payload.get("linked_form_id") or 0) or False,
            }
            if not vals["name"]:
                raise ValidationError(_("Each task requires a name."))
            task_id = int(payload.get("id") or 0)
            if task_id and task_id in existing:
                existing[task_id].write(vals)
                keep_ids.append(task_id)
            else:
                keep_ids.append(Definition.create(vals).id)
            definition = Definition.browse(keep_ids[-1])
            if definition.task_type in ("read", "acknowledge"):
                if definition.linked_org_policy_id and definition.linked_document_id:
                    raise ValidationError(
                        _("Task “%s” must link to either a policy or a document.")
                        % definition.name
                    )
                self.validate_compliance_request_link(
                    org_policy=definition.linked_org_policy_id,
                    document=definition.linked_document_id
                    if not definition.linked_org_policy_id
                    else False,
                )
        unlink = self.request_task_definition_ids.filtered(
            lambda item: item.id not in keep_ids
        )
        if unlink:
            unlink.unlink()

    def request_fields_api(self):
        self.ensure_one()
        return {
            "request_trigger": self.request_trigger or "",
            "request_start_date": str(self.request_start_date or ""),
            "repeat_every_months": self.repeat_every_months or 0,
            "tasks_needed_mode": self.tasks_needed_mode or "all_required",
            "tasks_needed_minimum": self.tasks_needed_minimum or 1,
            "reopen_on_content_change": bool(self.reopen_on_content_change),
            "request_tasks": [
                task.to_api_dict() for task in self.request_task_definition_ids
            ],
        }
