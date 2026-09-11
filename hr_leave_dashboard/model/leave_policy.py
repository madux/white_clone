# -*- coding: utf-8 -*-
from datetime import timedelta
import re
from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError


class HrLeavePolicy(models.Model):
    _name = "hr.leave.policy"
    _description = "Leave Policy"
    _order = "name, id"
    _check_company_auto = True

    name = fields.Char(required=True, index=True)
    code = fields.Char(required=True, index=True)
    description = fields.Text()
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)
    policy_mode = fields.Selection([("simple", "Simple"), ("advanced", "Advanced")], required=True, default="simple")
    policy_type = fields.Selection([
        ("paid", "Paid Leave"), ("sick", "Sick Leave"), ("family", "Family Leave"),
        ("compassionate", "Compassionate Leave"), ("career", "Career Development"),
        ("unpaid", "Unpaid Leave"),
    ], string="Leave Type", required=True, default="paid", index=True)
    category_name = fields.Char(string="Category", default="General")
    color = fields.Char(default="#E91E78")
    state = fields.Selection([
        ("draft", "Draft"),
        ("active", "Active"),
        ("inactive", "Inactive"),
    ], default="draft", required=True, index=True)
    active = fields.Boolean(default=True)

    apply_to = fields.Selection([("all", "All Employees"), ("selected", "Selected Employees / Groups"), ("conditions", "Conditions")], default="all", required=True)
    employee_ids = fields.Many2many("hr.employee", "hr_leave_policy_employee_rel", "policy_id", "employee_id")
    department_ids = fields.Many2many("hr.department", "hr_leave_policy_department_rel", "policy_id", "department_id")
    unit_ids = fields.Many2many("hr.unit", "hr_leave_policy_unit_rel", "policy_id", "unit_id")
    grade_ids = fields.Many2many("hr.grade", "hr_leave_policy_grade_rel", "policy_id", "grade_id")
    location_ids = fields.Many2many("hr.work.location", "hr_leave_policy_location_rel", "policy_id", "location_id")
    employee_type_ids = fields.Many2many("hr.core_employment_type", "hr_leave_policy_employee_type_rel", "policy_id", "employee_type_id")
    job_ids = fields.Many2many("hr.job", "hr_leave_policy_job_rel", "policy_id", "job_id")
    minimum_tenure_months = fields.Integer(default=0)
    condition_match = fields.Selection([("all", "All Conditions"), ("any", "Any Condition")], default="all", required=True)

    allow_carry_forward = fields.Boolean(default=False)
    maximum_carry_forward = fields.Float(default=0)
    carry_forward_expiry_value = fields.Integer(default=0)
    carry_forward_expiry_unit = fields.Selection([("days", "Days"), ("months", "Months")], default="months")
    balance_usage_priority = fields.Selection([("current", "Current balance first"), ("carried", "Carried-forward balance first")], default="current", required=True)
    approval_required = fields.Boolean(default=True)
    approval_workflow = fields.Selection([("default", "Default workflow"), ("custom", "Custom workflow")], default="default", required=True)
    approval_workflow_type_id = fields.Many2one("cleon.approval.workflow.type", ondelete="restrict", string="Workflow Type")
    approval_chain_id = fields.Many2one("cleon.approval.chain", ondelete="restrict", check_company=True)
    approval_template_id = fields.Many2one("hr.leave.approval.template", ondelete="restrict", check_company=True)
    allow_multiple_requests = fields.Boolean(default=True)
    allow_withdrawal = fields.Boolean(default=True)
    allow_half_day = fields.Boolean(default=True)
    ai_enabled = fields.Boolean(
        default=True,
        string="AI & Automation Enabled",
        help="Disable company-enabled advisory AI capabilities for employees governed by this policy.",
    )

    line_ids = fields.One2many("hr.leave.policy.line", "policy_id", copy=True)
    assignment_ids = fields.One2many("hr.leave.policy.assignment", "policy_id")

    _sql_constraints = [("policy_code_company_uniq", "unique(code, company_id)", "Policy code must be unique per company.")]

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if "state" in vals and vals["state"] != "draft":
                raise ValidationError(_("New policies can only be created in Draft state. Use change_policy_status() to activate a policy."))
            if "active" in vals and not vals["active"]:
                raise ValidationError(_("New policies cannot be created as archived."))
        return super().create(vals_list)

    def write(self, values):
        if {"state", "active"}.intersection(values):
            raise ValidationError(_("Policy lifecycle state and active status cannot be modified directly. Use the policy lifecycle actions."))
        leave_types = self.line_ids.leave_type_id
        result = super().write(values)
        if {"approval_required", "approval_workflow"}.intersection(values):
            (leave_types | self.line_ids.leave_type_id)._sync_native_validation_from_policies()
        return result

    def _write_lifecycle(self, values):
        leave_types = self.line_ids.leave_type_id
        result = super().write(values)
        if {"state", "active", "approval_required", "approval_workflow"}.intersection(values):
            (leave_types | self.line_ids.leave_type_id)._sync_native_validation_from_policies()
        return result

    def _check_configure(self):
        if not self.env.user.has_group("hr_leave_dashboard.group_leave_permission_configuration"):
            raise AccessError(_("You do not have permission to configure leave policies."))

    def _rule_snapshot(self, line):
        """Immutable values, not related fields pointing at editable configuration."""
        self.ensure_one()
        return {"line": line._payload(), "policy": {
            "id": self.id, "name": self.name, "code": self.code,
            **{name: self[name] for name in (
                "minimum_tenure_months", "allow_carry_forward", "maximum_carry_forward",
                "carry_forward_expiry_value", "carry_forward_expiry_unit", "balance_usage_priority",
                "approval_required", "approval_workflow", "allow_multiple_requests",
                "allow_withdrawal", "allow_half_day", "ai_enabled", "policy_type",
            )}, "approval_chain_id": (self.approval_template_id.chain_id or self.approval_chain_id).id,
            "approval_template_id": self.approval_template_id.id,
            "approval_workflow_type_id": self.approval_workflow_type_id.id,
        }}

    @api.model
    def _migrate_legacy_leave_types(self):
        """Create the new policy boundary without replacing legacy type IDs."""
        labels = dict(self.env["hr.leave.type"]._fields["policy_classification"].selection)
        for company in self.env["res.company"].sudo().search([]):
            leave_types = self.env["hr.leave.type"].sudo().with_context(active_test=False).search([
                ("company_id", "in", [False, company.id]),
            ])
            linked_type_ids = set(self.sudo().with_context(active_test=False).search([
                ("company_id", "=", company.id),
            ]).line_ids.leave_type_id.ids)
            for leave_type in leave_types.filtered(lambda item: item.id not in linked_type_ids):
                normalized = "%s %s" % (leave_type.name or "", leave_type.leave_code or "")
                if leave_type.policy_classification == "other":
                    if leave_type._bradford_is_sickness(normalized):
                        classification = "sick"
                    elif leave_type._bradford_is_protected(normalized):
                        classification = "family" if any(word in normalized.lower() for word in ("maternity", "paternity", "parental")) else "annual"
                    elif leave_type.cleon_category == "unpaid":
                        classification = "unpaid"
                    else:
                        classification = "other"
                    leave_type.with_context(skip_bradford_refresh=True).write({"policy_classification": classification})
                policy = self.sudo().create({
                    "name": _("%s Policy") % leave_type.name, "code": self.with_company(company)._code_for_name(leave_type.name),
                    "description": leave_type.description or "", "company_id": company.id,
                    "policy_mode": "advanced", "policy_type": {"sick": "sick", "family": "family", "career": "career", "unpaid": "unpaid", "compensatory": "compassionate"}.get(leave_type.policy_classification, "paid"),
                    "category_name": labels.get(leave_type.policy_classification, _("General")),
                    "color": leave_type.cleon_color_hex or "#E91E78", "state": "draft",
                    "apply_to": "all" if leave_type.eligibility_scope == "all" else "selected",
                    "employee_ids": [(6, 0, leave_type.eligible_employee_ids.ids)], "department_ids": [(6, 0, leave_type.eligible_department_ids.ids)],
                    "unit_ids": [(6, 0, leave_type.eligible_unit_ids.ids)], "grade_ids": [(6, 0, leave_type.eligible_grade_ids.ids)],
                    "location_ids": [(6, 0, leave_type.location_ids.ids)], "employee_type_ids": [(6, 0, leave_type.employee_type_ids.ids)],
                    "minimum_tenure_months": leave_type.minimum_service_months,
                    "allow_carry_forward": leave_type.allow_carryover, "maximum_carry_forward": leave_type.max_carryover_days,
                    "approval_required": leave_type.approval_workflow != "none", "allow_half_day": leave_type.allow_half_day,
                })
                line = self.env["hr.leave.policy.line"].sudo().create({
                    "policy_id": policy.id, "leave_type_id": leave_type.id, "compensation": leave_type.cleon_category,
                    "unit": "days", "entitlement_type": "accrued" if leave_type.accrual_method == "monthly" else "fixed",
                    "accrual_period": "monthly" if leave_type.accrual_method == "monthly" else "annually",
                    "accrual_basis": "anniversary" if leave_type.accrual_method == "hire_anniversary" else "calendar",
                    "accrual_amount": leave_type.max_entitlement, "waiting_period_days": 0,
                    "exclude_public_holidays": True, "exclude_non_working_days": True,
                    "minimum_notice_days": leave_type.minimum_notice_days, "minimum_duration": leave_type.minimum_request_days,
                    "maximum_duration": leave_type.max_consecutive_days, "allow_backdated": bool(leave_type.retroactive_request_days),
                    "allow_half_day": leave_type.allow_half_day, "allow_overlap": False,
                    "document_required_after_days": 3 if leave_type.supporting_document_policy == "conditional" else (0 if leave_type.supporting_document_policy == "never" else 0.01),
                })
                if leave_type.active:
                    policy._write_lifecycle({"state": "active"})
                    policy._sync_assignments("keep")
                else:
                    policy._write_lifecycle({"state": "inactive"})
                policy._audit(_("Migrated legacy Leave Type configuration into policy '%s'.") % policy.name, after={"leave_type_id": line.leave_type_id.id})
        return True

    @api.constrains("state", "line_ids")
    def _check_active_has_types(self):
        for policy in self:
            if policy.state == "active" and not policy.line_ids.filtered("active"):
                raise ValidationError(_("An active policy must contain at least one Leave Type."))

    @api.constrains("maximum_carry_forward", "carry_forward_expiry_value", "minimum_tenure_months")
    def _check_nonnegative(self):
        for policy in self:
            if min(policy.maximum_carry_forward, policy.carry_forward_expiry_value, policy.minimum_tenure_months) < 0:
                raise ValidationError(_("Policy limits cannot be negative."))

    @api.constrains("approval_required", "approval_workflow", "approval_chain_id", "approval_template_id")
    def _check_custom_approval_route(self):
        for policy in self:
            if not policy.approval_required or policy.approval_workflow != "custom":
                continue
            chain = policy.approval_template_id.chain_id or policy.approval_chain_id
            if not chain or not chain.active or (policy.approval_template_id and not policy.approval_template_id.active):
                raise ValidationError(_("A custom approval policy requires an active Approval Template or direct Approval Flow."))

    def _eligible_employees(self):
        self.ensure_one()
        employees = self.env["hr.employee"].sudo().search([
            ("company_id", "=", self.company_id.id), ("active", "=", True),
        ])
        if self.apply_to == "all":
            return employees
        tests = []
        if self.employee_ids:
            tests.append(set(self.employee_ids.ids))
        for records, field_name in (
            (self.department_ids, "department_id"), (self.unit_ids, "unit_id"),
            (self.grade_ids, "grade_id"), (self.location_ids, "work_location_id"),
            (self.employee_type_ids, "employee_type_id"), (self.job_ids, "job_id"),
        ):
            if records:
                tests.append(set(employees.filtered(lambda e, f=field_name, ids=set(records.ids): e[f].id in ids).ids))
        if self.apply_to == "conditions" and self.minimum_tenure_months:
            today = fields.Date.context_today(self)
            cutoff = today - timedelta(days=self.minimum_tenure_months * 30)
            tests.append(set(employees.filtered(lambda e: getattr(e, "first_contract_date", False) and e.first_contract_date <= cutoff).ids))
        if not tests:
            # Simple Policy's optional Assign To means blank is explicitly
            # equivalent to All Employees. Advanced empty conditions match none.
            return employees if self.policy_mode == "simple" else self.env["hr.employee"]
        eligible = set.intersection(*tests) if self.apply_to == "conditions" and self.condition_match == "all" else set.union(*tests)
        return employees.filtered(lambda e: e.id in eligible)

    def _audit(self, note, before=None, after=None, employee=False, leave_type=False):
        self.ensure_one()
        self.env["hr.leave.audit.log"].sudo().create({
            "action": "policy_change", "module_area": "policies", "entity_type": "policy",
            "entity_name": self.name, "entity_reference": self.code,
            "actor_id": self.env.user.id, "actor_label": self.env.user.name,
            "employee_id": employee.id if employee else False,
            "leave_type_id": leave_type.id if leave_type else False,
            "before_values": before or {}, "after_values": after or {}, "note": note,
        })

    @api.model
    def _options(self):
        employees = self.env["hr.employee"].sudo().search([("company_id", "in", self.env.companies.ids), ("active", "=", True)], order="name")
        company = self.env.company
        def rows(records):
            return [{"id": item.id, "name": item.name} for item in records]
        return {
            "policy_defaults": {
                "unit": company.leave_default_unit or "days",
                "approval_workflow": company.leave_default_approval_workflow or "single",
                "supporting_document_policy": company.leave_default_supporting_document_policy or "never",
                "minimum_notice_days": company.leave_default_minimum_notice_days,
                "allow_half_day": company.leave_default_allow_half_day,
                "allow_carryover": company.leave_default_allow_carryover,
                "maximum_balance_cap": company.leave_default_max_balance_cap,
                "allow_negative_balance": company.leave_default_allow_negative_balance,
                "team_overlap_percent": company.leave_default_team_overlap_percent,
                "block_overlap_threshold": company.leave_default_block_overlap_threshold,
            },
            "leave_types": [{"id": item.id, "name": item.name, "classification": item.policy_classification, "color": item.cleon_color_hex or "#3B82F6"} for item in self.env["hr.leave.type"].sudo().with_context(active_test=False).search([("company_id", "in", [False] + self.env.companies.ids)], order="name")],
            "employees": rows(employees), "departments": rows(employees.mapped("department_id").sorted("name")),
            "units": rows(employees.mapped("unit_id").sorted("name")), "grades": rows(employees.mapped("grade_id").sorted("name")),
            "locations": rows(employees.mapped("work_location_id").sorted("name")), "employee_types": rows(employees.mapped("employee_type_id").sorted("name")),
            "jobs": rows(employees.mapped("job_id").sorted("name")),
            # Draft and scheduled windows are valid configuration records too;
            # ``active`` is archive visibility, not the business lifecycle state.
            "blackout_periods": rows(self.env["hr.leave.blackout.period"].sudo().search([("company_id", "in", self.env.companies.ids), ("active", "=", True)], order="name")),
            "approval_chains": rows(self.env["cleon.approval.chain"].sudo().search([("company_id", "in", self.env.companies.ids), ("active", "=", True)], order="name")),
            "approval_workflow_types": rows(self.env["cleon.approval.workflow.type"].sudo().search([
                ("model_name", "=", "hr.leave"), ("active", "=", True),
            ], order="name")),
            "approval_templates": rows(self.env["hr.leave.approval.template"].sudo().search([
                ("company_id", "in", self.env.companies.ids), ("active", "=", True),
            ], order="name")),
        }

    def _row(self):
        self.ensure_one()
        eligible = self._eligible_employees()
        assigned = self.assignment_ids.filtered(lambda a: a.active_on(fields.Date.context_today(self))).mapped("employee_id")
        lines = self.line_ids.filtered("active")
        line = lines[:1]
        return {
            "id": self.id, "name": self.name, "code": self.code, "description": self.description or "",
            "mode": self.policy_mode, "policy_type": self.policy_type, "policy_type_label": dict(self._fields["policy_type"].selection).get(self.policy_type),
            "category": self.category_name or "General", "color": self.color or "#E91E78",
            "state": self.state, "active": self.active, "display_status": "archived" if not self.active else self.state, "ai_enabled": self.ai_enabled,
            "leave_types": [{"id": value.leave_type_id.id, "name": value.leave_type_id.name, "entitlement": value.accrual_amount, "unit": value.unit, "compensation": value.compensation} for value in lines],
            "applicability": _("All Employees") if self.apply_to == "all" else _("%d eligible employee(s)") % len(eligible),
            "employee_count": len(assigned or eligible), "employee_ids": (assigned or eligible).ids,
            "default_entitlement": line.accrual_amount if len(lines) == 1 else False,
            "default_unit": line.unit if len(lines) == 1 else "",
        }

    @api.model
    def get_policy_page_data(self, search="", state="current"):
        self._check_configure()
        domain = [("company_id", "in", self.env.companies.ids)]
        domain.append(("active", "=", state != "archived"))
        if search:
            domain += ["|", "|", ("name", "ilike", search), ("code", "ilike", search), ("line_ids.leave_type_id.name", "ilike", search)]
        policies = self.with_context(active_test=False).search(domain, order="name, id")
        return {"rows": [policy._row() for policy in policies], "options": self._options()}

    @api.model
    def get_policy_details(self, policy_id):
        self._check_configure()
        policy = self.with_context(active_test=False).browse(int(policy_id)).exists()
        if not policy or policy.company_id not in self.env.companies:
            raise UserError(_("Policy not found."))
        data = policy._row()
        data.update({
            "apply_to": policy.apply_to, "condition_match": policy.condition_match,
            "selected": {"employee_ids": policy.employee_ids.ids, "department_ids": policy.department_ids.ids, "unit_ids": policy.unit_ids.ids, "grade_ids": policy.grade_ids.ids, "location_ids": policy.location_ids.ids, "employee_type_ids": policy.employee_type_ids.ids, "job_ids": policy.job_ids.ids},
            "minimum_tenure_months": policy.minimum_tenure_months,
            "carry": {"enabled": policy.allow_carry_forward, "maximum": policy.maximum_carry_forward, "expiry_value": policy.carry_forward_expiry_value, "expiry_unit": policy.carry_forward_expiry_unit, "priority": policy.balance_usage_priority},
            "approval": {"required": policy.approval_required, "workflow": policy.approval_workflow, "workflow_type_id": policy.approval_workflow_type_id.id or False, "chain_id": policy.approval_chain_id.id or False, "template_id": policy.approval_template_id.id or False},
            "rules": {"multiple": policy.allow_multiple_requests, "withdrawal": policy.allow_withdrawal, "half_day": policy.allow_half_day},
            "ai_enabled": policy.ai_enabled,
            "lines": [line._payload() for line in policy.line_ids.filtered("active")],
        })
        return data

    @api.model
    def _code_for_name(self, name):
        base = re.sub(r"[^A-Z0-9]", "", (name or "POL").upper())[:8] or "POL"
        code = base
        index = 2
        while self.with_context(active_test=False).search_count([("company_id", "=", self.env.company.id), ("code", "=", code)]):
            code = "%s%d" % (base[:max(1, 8 - len(str(index)))], index)
            index += 1
        return code

    @api.model
    def _resolve_leave_type(self, values):
        type_id = int(values.get("leave_type_id") or 0)
        if type_id:
            leave_type = self.env["hr.leave.type"].sudo().browse(type_id).exists()
            if leave_type and (not leave_type.company_id or leave_type.company_id == self.env.company):
                return leave_type
            raise ValidationError(_("Select an existing Leave Type in this company."))
        name = (values.get("new_leave_type_name") or "").strip()
        if not name:
            raise ValidationError(_("Every policy line requires a Leave Type."))
        existing = self.env["hr.leave.type"].sudo().with_context(active_test=False).search([("name", "=ilike", name), ("company_id", "in", [False, self.env.company.id])], limit=1)
        if existing:
            return existing
        code = re.sub(r"[^A-Z0-9]", "", name.upper())[:4] or "LT"
        return self.env["hr.leave.type"].sudo().create({
            "name": name, "leave_code": code, "company_id": self.env.company.id,
            "cleon_color_hex": values.get("color") or "#3B82F6", "policy_classification": values.get("classification") or "other",
            "max_entitlement": float(values.get("accrual_amount") or 0),
        })

    @api.model
    def save_policy(self, payload):
        self._check_configure()
        payload = payload or {}
        lines = payload.get("lines") or []
        if not lines:
            raise ValidationError(_("Select at least one Leave Type before continuing."))
        record_id = int(payload.get("id") or 0)
        policy = self.with_context(active_test=False).browse(record_id).exists() if record_id else self
        if policy and policy.company_id not in self.env.companies:
            raise AccessError(_("You cannot update another company's policy."))
        if policy and not policy.active:
            raise UserError(_("Restore the archived policy before editing it."))
        selected = payload.get("selected") or {}
        carry = payload.get("carry") or {}
        approval = payload.get("approval") or {}
        rules = payload.get("rules") or {}
        vals = {
            "name": (payload.get("name") or "").strip(), "code": (payload.get("code") or "").strip().upper() or self._code_for_name(payload.get("name")),
            "description": payload.get("description") or "", "policy_mode": payload.get("mode") if payload.get("mode") in ("simple", "advanced") else "simple",
            "policy_type": payload.get("policy_type") if payload.get("policy_type") in dict(self._fields["policy_type"].selection) else "paid",
            "category_name": payload.get("category") or "General", "color": payload.get("color") or "#E91E78",
            "state": "draft", "active": True,
            "company_id": self.env.company.id, "apply_to": payload.get("apply_to") if payload.get("apply_to") in ("all", "selected", "conditions") else "all",
            "condition_match": payload.get("condition_match") if payload.get("condition_match") in ("all", "any") else "all",
            "minimum_tenure_months": int(payload.get("minimum_tenure_months") or 0),
            "allow_carry_forward": bool(carry.get("enabled")), "maximum_carry_forward": float(carry.get("maximum") or 0),
            "carry_forward_expiry_value": int(carry.get("expiry_value") or 0), "carry_forward_expiry_unit": carry.get("expiry_unit") if carry.get("expiry_unit") in ("days", "months") else "months",
            "balance_usage_priority": carry.get("priority") if carry.get("priority") in ("current", "carried") else "current",
            "approval_required": bool(approval.get("required", True)), "approval_workflow": approval.get("workflow") if approval.get("workflow") in ("default", "custom") else "default",
            "approval_chain_id": int(approval.get("chain_id") or 0) or False,
            "approval_template_id": int(approval.get("template_id") or 0) or False,
            "approval_workflow_type_id": int(approval.get("workflow_type_id") or 0) or False,
            "allow_multiple_requests": bool(rules.get("multiple", True)), "allow_withdrawal": bool(rules.get("withdrawal", True)), "allow_half_day": bool(rules.get("half_day", True)),
            "ai_enabled": bool(payload.get("ai_enabled", True)),
        }
        if not vals["name"]:
            raise ValidationError(_("Policy Name is required."))
        template = self.env["hr.leave.approval.template"].sudo().browse(vals["approval_template_id"]).exists()
        if template and (template.company_id != self.env.company or not template.active):
            raise ValidationError(_("Select an active Approval Template for this company."))
        if template and template.template_type == "assigned" and policy and policy not in template.policy_ids:
            raise ValidationError(_("This Approval Template is not assigned to this policy."))
        workflow_type = self.env["cleon.approval.workflow.type"].sudo().browse(vals["approval_workflow_type_id"]).exists()
        if workflow_type and (not workflow_type.active or workflow_type.model_name != "hr.leave"):
            raise ValidationError(_("Select an active Leave Workflow Type."))
        for key in ("employee_ids", "department_ids", "unit_ids", "grade_ids", "location_ids", "employee_type_ids", "job_ids"):
            vals[key] = [(6, 0, [int(value) for value in selected.get(key, [])])]
        before = policy._row() if policy else {}
        previous_leave_types = policy.line_ids.leave_type_id if policy else self.env["hr.leave.type"]
        if policy:
            target_state = payload.get("state")
            if target_state and target_state != policy.state:
                raise ValidationError(_("Policy lifecycle status cannot be changed via save_policy. Use change_policy_status() to activate or deactivate the policy."))
            vals.pop("state", None)
            vals.pop("active", None)
            policy.write(vals)
        else:
            initial_state = payload.get("state") or "active"
            if initial_state not in ("draft", "active"):
                raise ValidationError(_("Unsupported initial policy status '%s'. New policies can only be created as Draft or Active.") % initial_state)
            vals["state"] = "draft"
            vals["active"] = True
            policy = self.create(vals)
        retained_line_ids = []
        for index, line_values in enumerate(lines):
            leave_type = self._resolve_leave_type(line_values)
            existing_line = policy.line_ids.filtered(lambda line, value=int(line_values.get("id") or 0): line.id == value)[:1]
            line_vals = {**self.env["hr.leave.policy.line"]._values_from_payload(line_values), "leave_type_id": leave_type.id, "sequence": (index + 1) * 10, "active": True}
            if existing_line:
                existing_line.write(line_vals)
                retained_line_ids.append(existing_line.id)
            else:
                retained_line_ids.append(self.env["hr.leave.policy.line"].create({**line_vals, "policy_id": policy.id}).id)
        removed_lines = policy.line_ids.filtered(lambda line: line.id not in retained_line_ids)
        if removed_lines:
            effective = fields.Date.context_today(self)
            for assignment in removed_lines.assignment_ids.filtered(lambda item: not item.date_to or item.date_to >= effective):
                if effective <= assignment.date_from:
                    assignment.write({"superseded": True})
                else:
                    assignment.write({"date_to": effective - timedelta(days=1)})
            removed_lines.write({"active": False})
        if not record_id and initial_state == "active":
            policy._write_lifecycle({"state": "active"})
            policy._sync_assignments(payload.get("conflict_resolution") or "review")
        elif policy.state == "active":
            policy._sync_assignments(payload.get("conflict_resolution") or "review")
        (previous_leave_types | policy.line_ids.leave_type_id)._sync_native_validation_from_policies()
        policy._audit(_("%s policy '%s'.") % (_("Updated") if record_id else _("Created"), policy.name), before, policy._row())
        return {"id": policy.id, "name": policy.name}

    def _assignment_conflicts(self, employees=None, date_from=None, date_to=None):
        self.ensure_one()
        employees = self._eligible_employees() if employees is None else employees
        date_from = fields.Date.to_date(date_from) if date_from else fields.Date.context_today(self)
        conflicts = []
        for line in self.line_ids.filtered("active"):
            domain = [("superseded", "=", False), ("employee_id", "in", employees.ids), ("leave_type_id", "=", line.leave_type_id.id), ("policy_id.state", "=", "active"), ("policy_id.active", "=", True), ("policy_id", "!=", self.id), ("date_from", "<=", date_to or "9999-12-31"), "|", ("date_to", "=", False), ("date_to", ">=", date_from)]
            for assignment in self.env["hr.leave.policy.assignment"].sudo().search(domain):
                conflicts.append({"assignment": assignment, "employee": assignment.employee_id, "leave_type": line.leave_type_id, "policy": assignment.policy_id})
        return conflicts

    @api.model
    def preview_policy_conflicts(self, payload):
        """Build an in-memory candidate: preview never creates policies/types."""
        self._check_configure()
        selected = payload.get("selected") or {}
        values = {
            "company_id": self.env.company.id, "policy_mode": payload.get("mode", "simple"),
            "apply_to": payload.get("apply_to", "all"),
            "condition_match": payload.get("condition_match", "all"),
            "minimum_tenure_months": int(payload.get("minimum_tenure_months") or 0),
        }
        for key in ("employee_ids", "department_ids", "unit_ids", "grade_ids", "location_ids", "employee_type_ids", "job_ids"):
            values[key] = [(6, 0, [int(value) for value in selected.get(key, [])])]
        candidate = self.new(values)
        employees = candidate._eligible_employees()
        type_ids = set()
        for line in payload.get("lines", []):
            if line.get("leave_type_id"):
                type_ids.add(int(line["leave_type_id"]))
            elif line.get("new_leave_type_name"):
                type_ids.update(self.env["hr.leave.type"].sudo().search([
                    ("company_id", "in", [False, self.env.company.id]),
                    ("name", "=ilike", line["new_leave_type_name"].strip()),
                ]).ids)
        assignments = self.env["hr.leave.policy.assignment"].sudo().search([
            ("superseded", "=", False), ("employee_id", "in", employees.ids),
            ("leave_type_id", "in", list(type_ids)), ("policy_id.state", "=", "active"),
            ("policy_id.active", "=", True),
            ("date_from", "<=", fields.Date.context_today(self)), "|",
            ("date_to", "=", False), ("date_to", ">=", fields.Date.context_today(self)),
        ]).filtered(lambda item: item.company_id == self.env.company and item.policy_id.id != int(payload.get("id") or 0))
        return [{"id": item.id, "employee": item.employee_id.name, "leave_type": item.leave_type_id.name,
                 "existing_policy": item.policy_id.name, "effective_date": fields.Date.to_string(item.date_from),
                 "entitlement": (item.rule_snapshot or {}).get("line", {}).get("accrual_amount", item.policy_line_id.accrual_amount)} for item in assignments]

    def _sync_assignments(self, resolution="review", employees=None, effective_date=None):
        self.ensure_one()
        if self.state != "active" or not self.active:
            raise ValidationError(_("Only active policies can receive new assignments."))
        if resolution not in ("review", "keep", "replace"):
            raise ValidationError(_("Choose Review, Keep Existing, or Replace."))
        employees = self._eligible_employees() if employees is None else employees
        if any(employee.company_id != self.company_id for employee in employees):
            raise ValidationError(_("Employees must belong to the policy's company."))
        # Serialise competing assignments before reading conflicts (including
        # policies that have no assignment rows yet).
        if employees:
            self.env.cr.execute("SELECT id FROM hr_employee WHERE id IN %s ORDER BY id FOR UPDATE", [tuple(employees.ids)])
        effective_date = fields.Date.to_date(effective_date) if effective_date else fields.Date.context_today(self)
        conflicts = self._assignment_conflicts(employees, effective_date)
        if conflicts and resolution == "review":
            names = ", ".join(sorted(set(item["employee"].name for item in conflicts))[:10])
            raise ValidationError(_("Policy Assignment Conflict Detected for: %s. Review conflicts or choose Replace / Keep Existing.") % names)
        conflicting_employee_ids = set()
        if conflicts and resolution == "replace":
            for item in conflicts:
                old = item["assignment"]
                if effective_date <= old.date_from:
                    old.write({"superseded": True})
                else:
                    old.write({"date_to": effective_date - timedelta(days=1)})
        elif conflicts and resolution == "keep":
            conflicting_employee_ids = {item["employee"].id for item in conflicts}
        Assignment = self.env["hr.leave.policy.assignment"].sudo()
        for line in self.line_ids.filtered("active"):
            for employee in employees.filtered(lambda e: e.id not in conflicting_employee_ids):
                existing = Assignment.search([("superseded", "=", False), ("policy_id", "=", self.id), ("policy_line_id", "=", line.id), ("employee_id", "=", employee.id), "|", ("date_to", "=", False), ("date_to", ">=", effective_date)], limit=1)
                if existing and existing.rule_snapshot != self._rule_snapshot(line):
                    existing.write({"superseded": True} if effective_date <= existing.date_from else {"date_to": effective_date - timedelta(days=1)})
                    existing = Assignment.browse()
                if not existing:
                    Assignment.create({"policy_id": self.id, "policy_line_id": line.id, "leave_type_id": line.leave_type_id.id, "employee_id": employee.id, "date_from": effective_date})
        return {"assigned": len(employees) - len(conflicting_employee_ids), "conflicts": len(conflicting_employee_ids)}

    @api.model
    def get_assignment_conflicts(self, policy_id, employee_ids=None, effective_date=None):
        self._check_configure()
        policy = self.browse(int(policy_id)).exists()
        employees = self.env["hr.employee"].browse([int(value) for value in (employee_ids or [])]).exists() or policy._eligible_employees()
        return [{"employee_id": item["employee"].id, "employee": item["employee"].name, "leave_type": item["leave_type"].name, "existing_policy": item["policy"].name, "effective_date": fields.Date.to_string(item["assignment"].date_from), "entitlement": item["assignment"].policy_line_id.accrual_amount} for item in policy._assignment_conflicts(employees, effective_date)]

    @api.model
    def assign_policy(self, policy_id, employee_ids, effective_date=None, resolution="review"):
        self._check_configure()
        policy = self.with_context(active_test=False).browse(int(policy_id)).exists()
        if not policy:
            raise UserError(_("Policy not found."))
        if not policy.active:
            raise UserError(_("Cannot assign an archived policy. Restore the policy first."))
        employees = self.env["hr.employee"].browse([int(value) for value in employee_ids]).exists()
        result = policy._sync_assignments(resolution, employees, effective_date)
        policy._audit(_("Assigned policy to %d employee(s); %d conflict(s) retained.") % (result["assigned"], result["conflicts"]))
        return result

    @api.model
    def duplicate_policy(self, policy_id):
        self._check_configure()
        policy = self.with_context(active_test=False).browse(int(policy_id)).exists()
        values = self.get_policy_details(policy.id)
        values.update({"id": False, "name": _("%s (Copy)") % policy.name, "code": self._code_for_name(_("%s Copy") % policy.name), "state": "draft"})
        result = self.save_policy(values)
        duplicate = self.browse(result["id"])
        duplicate._audit(_("Duplicated from policy '%s'.") % policy.name)
        return {"id": duplicate.id, "name": duplicate.name}

    def _close_assignments(self, effective_date=None):
        effective = fields.Date.to_date(effective_date) if effective_date else fields.Date.context_today(self)
        assignments = self.assignment_ids.filtered(lambda item: not item.superseded and (not item.date_to or item.date_to >= effective))
        for assignment in assignments:
            if effective <= assignment.date_from:
                assignment.write({"superseded": True})
            else:
                assignment.write({"date_to": effective - timedelta(days=1)})

    @api.model
    def change_policy_status(self, policy_id, state, resolution="review"):
        self._check_configure()
        if state not in ("draft", "active", "inactive"):
            raise ValidationError(_("Unsupported policy status."))
        policy = self.with_context(active_test=False).browse(int(policy_id)).exists()
        if not policy:
            raise UserError(_("Policy not found."))
        if not policy.active:
            raise UserError(_("Restore the archived policy before changing its status."))
        if state == "draft":
            raise ValidationError(_("A policy cannot be transitioned to Draft."))
        if policy.state == state:
            return True
        if policy.state == "draft" and state == "inactive":
            raise ValidationError(_("A draft policy cannot be transitioned to Inactive directly. Activate the policy first."))
        before = policy.state
        leave_types = policy.line_ids.leave_type_id
        today = fields.Date.context_today(self)
        policy._write_lifecycle({"state": state})
        if state == "active":
            policy._sync_assignments(resolution, effective_date=today)
        elif before == "active" and state == "inactive":
            policy._close_assignments(effective_date=today)
        leave_types._sync_native_validation_from_policies()
        policy._audit(_("Changed policy status from %s to %s.") % (before, state), {"state": before}, {"state": state})
        return True

    @api.model
    def archive_policy(self, policy_id):
        self._check_configure()
        policy = self.with_context(active_test=False).browse(int(policy_id)).exists()
        if not policy:
            raise UserError(_("Policy not found."))
        if not policy.active:
            raise UserError(_("Policy is already archived."))
        today = fields.Date.context_today(self)
        if policy.state == "active" and policy.active:
            policy._close_assignments(effective_date=today)
        policy._write_lifecycle({"active": False})
        policy.line_ids.leave_type_id._sync_native_validation_from_policies()
        policy._audit(_("Archived policy '%s'.") % policy.name, {"active": True}, {"active": False})
        return {"archived": True}

    @api.model
    def restore_policy(self, policy_id):
        self._check_configure()
        policy = self.with_context(active_test=False).browse(int(policy_id)).exists()
        if not policy:
            raise UserError(_("Policy not found."))
        if policy.active:
            raise UserError(_("Policy is already active."))
        new_state = "inactive" if policy.state == "active" else policy.state
        policy._write_lifecycle({"active": True, "state": new_state})
        policy.line_ids.leave_type_id._sync_native_validation_from_policies()
        policy._audit(_("Restored policy '%s' as %s.") % (policy.name, new_state), {"active": False}, {"active": True, "state": new_state})
        return {"restored": True, "state": new_state}

    @api.ondelete(at_uninstall=False)
    def _unlink_except_archive(self):
        raise UserError(_("Leave Policies cannot be deleted. Archive the policy instead."))


class HrLeavePolicyLine(models.Model):
    _name = "hr.leave.policy.line"
    _description = "Leave Policy Type Configuration"
    _order = "sequence, id"
    _check_company_auto = True

    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True, copy=False)
    policy_id = fields.Many2one("hr.leave.policy", required=True, ondelete="cascade", index=True)
    company_id = fields.Many2one(related="policy_id.company_id", store=True, index=True)
    leave_type_id = fields.Many2one("hr.leave.type", required=True, ondelete="restrict", index=True)
    compensation = fields.Selection([("paid", "Paid"), ("unpaid", "Unpaid"), ("partially_paid", "Partially Paid")], default="paid", required=True)
    unit = fields.Selection([("days", "Days"), ("hours", "Hours")], default="days", required=True)
    entitlement_type = fields.Selection([("fixed", "Fixed"), ("accrued", "Accrued")], default="fixed", required=True)
    accrual_period = fields.Selection([("annually", "Annually"), ("monthly", "Monthly"), ("weekly", "Weekly")], default="annually", required=True)
    accrual_basis = fields.Selection([("calendar", "Calendar Year"), ("join_date", "Joined Date"), ("anniversary", "Anniversary")], default="join_date", required=True)
    accrual_amount = fields.Float(default=0, required=True)
    waiting_period_days = fields.Integer(default=0)
    exclude_public_holidays = fields.Boolean(default=True)
    exclude_non_working_days = fields.Boolean(default=True)
    minimum_notice_days = fields.Integer(default=0)
    minimum_duration = fields.Float(default=0)
    maximum_duration = fields.Float(default=0)
    allow_backdated = fields.Boolean(default=False)
    allow_half_day = fields.Boolean(default=True)
    allow_overlap = fields.Boolean(default=False)
    document_policy = fields.Selection([
        ("not_required", "Not Required"), ("optional", "Optional"), ("required", "Required"),
    ], default="not_required", required=True)
    document_required_after_days = fields.Float(default=0)
    accepted_document_types = fields.Char(help="Comma-separated accepted document types.")
    allow_negative_balance = fields.Boolean(default=False)
    blackout_period_ids = fields.Many2many("hr.leave.blackout.period", string="Blackout Periods")
    assignment_ids = fields.One2many("hr.leave.policy.assignment", "policy_line_id")

    _sql_constraints = [("policy_leave_type_uniq", "unique(policy_id, leave_type_id)", "A Leave Type can only appear once in a policy.")]

    @api.ondelete(at_uninstall=False)
    def _unlink_except_assignments(self):
        for line in self:
            policy = line.policy_id.with_context(active_test=False)
            if not policy.active:
                raise ValidationError(_("Policy lines belonging to an archived policy cannot be deleted."))
            if policy.state != "draft":
                raise ValidationError(_("Policy lines can only be deleted while the policy is in Draft state. Deactivate the line instead."))
            if line.assignment_ids:
                raise ValidationError(_("Policy lines with employee assignments cannot be deleted. Archive or deactivate the line instead."))

    @api.model_create_multi
    def create(self, vals_list):
        lines = super().create(vals_list)
        lines.leave_type_id._sync_native_validation_from_policies()
        return lines

    def write(self, values):
        leave_types = self.leave_type_id
        result = super().write(values)
        if {"active", "policy_id", "leave_type_id"}.intersection(values):
            (leave_types | self.leave_type_id)._sync_native_validation_from_policies()
        return result

    def unlink(self):
        leave_types = self.leave_type_id
        result = super().unlink()
        leave_types._sync_native_validation_from_policies()
        return result

    @api.constrains("accrual_amount", "waiting_period_days", "minimum_notice_days", "minimum_duration", "maximum_duration", "document_required_after_days")
    def _check_limits(self):
        for line in self:
            if min(line.accrual_amount, line.waiting_period_days, line.minimum_notice_days, line.minimum_duration, line.maximum_duration, line.document_required_after_days) < 0:
                raise ValidationError(_("Policy type limits cannot be negative."))
            if line.maximum_duration and line.minimum_duration > line.maximum_duration:
                raise ValidationError(_("Minimum duration cannot exceed maximum duration."))

    @api.model
    def _values_from_payload(self, value):
        selection = lambda key, choices, default: value.get(key) if value.get(key) in choices else default
        return {
            "compensation": selection("compensation", ("paid", "unpaid", "partially_paid"), "paid"), "unit": selection("unit", ("days", "hours"), "days"),
            "entitlement_type": selection("entitlement_type", ("fixed", "accrued"), "fixed"), "accrual_period": selection("accrual_period", ("annually", "monthly", "weekly"), "annually"),
            "accrual_basis": selection("accrual_basis", ("calendar", "join_date", "anniversary"), "join_date"), "accrual_amount": float(value.get("accrual_amount") or 0),
            "waiting_period_days": int(value.get("waiting_period_days") or 0), "exclude_public_holidays": bool(value.get("exclude_public_holidays", True)), "exclude_non_working_days": bool(value.get("exclude_non_working_days", True)),
            "minimum_notice_days": int(value.get("minimum_notice_days") or 0), "minimum_duration": float(value.get("minimum_duration") or 0), "maximum_duration": float(value.get("maximum_duration") or 0),
            "allow_backdated": bool(value.get("allow_backdated")), "allow_half_day": bool(value.get("allow_half_day", True)), "allow_overlap": bool(value.get("allow_overlap")),
            "document_policy": selection("document_policy", ("not_required", "optional", "required"), "not_required"),
            "document_required_after_days": float(value.get("document_required_after_days") or 0), "accepted_document_types": value.get("accepted_document_types") or "",
            "allow_negative_balance": bool(value.get("allow_negative_balance")),
            "blackout_period_ids": [(6, 0, [int(item) for item in value.get("blackout_period_ids", [])])],
        }

    def _payload(self):
        self.ensure_one()
        return {"id": self.id, "leave_type_id": self.leave_type_id.id, "leave_type": self.leave_type_id.name, "classification": self.leave_type_id.policy_classification, "compensation": self.compensation, "unit": self.unit, "entitlement_type": self.entitlement_type, "accrual_period": self.accrual_period, "accrual_basis": self.accrual_basis, "accrual_amount": self.accrual_amount, "waiting_period_days": self.waiting_period_days, "exclude_public_holidays": self.exclude_public_holidays, "exclude_non_working_days": self.exclude_non_working_days, "minimum_notice_days": self.minimum_notice_days, "minimum_duration": self.minimum_duration, "maximum_duration": self.maximum_duration, "allow_backdated": self.allow_backdated, "allow_half_day": self.allow_half_day, "allow_overlap": self.allow_overlap, "document_policy": self.document_policy, "document_required_after_days": self.document_required_after_days, "accepted_document_types": self.accepted_document_types or "", "allow_negative_balance": self.allow_negative_balance, "blackout_period_ids": self.blackout_period_ids.ids}

    @api.model
    def _process_policy_accruals(self, process_date):
        """Process every due period up to ``process_date`` exactly once.

        The scheduler normally calls this for today. Manual runs must also
        recover missed month, week, year, and anniversary periods, while the
        period keys in the underlying method keep the operation idempotent.
        """
        process_date = fields.Date.to_date(process_date)
        assignments = self.env["hr.leave.policy.assignment"].sudo().search([
            ("superseded", "=", False), ("policy_id.state", "=", "active"),
            ("policy_id.active", "=", True), ("policy_line_id.active", "=", True),
            ("date_from", "<=", process_date),
        ])
        dates = set()
        for assignment in assignments:
            line = assignment.policy_line_id
            run_prefix = "policy:%s:" % assignment.id
            existing_keys = set(self.env["hr.leave.accrual.run"].sudo().search([
                ("employee_id", "=", assignment.employee_id.id),
                ("leave_type_id", "=", line.leave_type_id.id),
                ("period_key", "like", "%s%%" % run_prefix),
            ]).mapped("period_key"))
            accrual_end = min(process_date, assignment.date_to or process_date)
            if assignment.date_from > accrual_end:
                continue

            def add_if_due(period_key, due_date, trigger_date=None):
                trigger_date = trigger_date or due_date
                if assignment.date_from <= trigger_date <= accrual_end and period_key not in existing_keys:
                    dates.add(trigger_date)

            hire_date = assignment.employee_id.first_contract_date
            if line.accrual_period == "monthly":
                month = assignment.date_from.replace(day=1)
                while month <= accrual_end:
                    if line.accrual_basis == "join_date" and hire_date:
                        due_date = hire_date + relativedelta(year=month.year, month=month.month)
                    else:
                        due_date = month
                    trigger_date = due_date if line.accrual_basis == "join_date" and hire_date else max(month, assignment.date_from)
                    add_if_due("policy:%s:month:%s" % (assignment.id, month.strftime("%Y-%m")), due_date, trigger_date)
                    month += relativedelta(months=1)
            elif line.accrual_period == "weekly":
                week = assignment.date_from - timedelta(days=assignment.date_from.weekday())
                while week <= accrual_end:
                    year, week_number, _weekday = week.isocalendar()
                    add_if_due("policy:%s:week:%s-%02d" % (assignment.id, year, week_number), week, max(week, assignment.date_from))
                    week += timedelta(days=7)
            elif line.accrual_basis in ("join_date", "anniversary") and hire_date:
                year = max(assignment.date_from.year, hire_date.year)
                while year <= accrual_end.year:
                    anniversary = hire_date + relativedelta(years=year - hire_date.year)
                    add_if_due("policy:%s:year:%s" % (assignment.id, year), anniversary)
                    year += 1
            else:
                year = assignment.date_from.replace(month=1, day=1)
                while year <= accrual_end:
                    add_if_due("policy:%s:year:%s" % (assignment.id, year.year), year, max(year, assignment.date_from))
                    year += relativedelta(years=1)
        return sum(self._process_policy_accruals_for_date(date) for date in sorted(dates))

    @api.model
    def _process_policy_accruals_for_date(self, process_date):
        """Apply the configured Policy-Line amount once per configured period."""
        process_date = fields.Date.to_date(process_date)
        Run = self.env["hr.leave.accrual.run"].sudo()
        Balance = self.env["hr.leave.balance.transaction"].sudo()
        processed = 0
        assignments = self.env["hr.leave.policy.assignment"].sudo().search([
            ("superseded", "=", False), ("policy_id.state", "=", "active"),
            ("policy_id.active", "=", True),
            ("policy_line_id.active", "=", True), ("date_from", "<=", process_date),
            "|", ("date_to", "=", False), ("date_to", ">=", process_date),
        ])
        for assignment in assignments:
            line = assignment.policy_line_id
            hire_date = assignment.employee_id.first_contract_date
            if line.waiting_period_days and (not hire_date or (process_date - hire_date).days < line.waiting_period_days):
                continue
            if line.accrual_period == "monthly":
                period_key = "policy:%s:month:%s" % (assignment.id, process_date.strftime("%Y-%m"))
                if line.accrual_basis == "join_date" and hire_date:
                    effective = hire_date + relativedelta(years=process_date.year - hire_date.year, month=process_date.month)
                else:
                    effective = max(process_date.replace(day=1), assignment.date_from)
            elif line.accrual_period == "weekly":
                year, week, _day = process_date.isocalendar()
                period_key = "policy:%s:week:%s-%02d" % (assignment.id, year, week)
                effective = max(process_date - timedelta(days=process_date.weekday()), assignment.date_from)
            else:
                if line.accrual_basis in ("join_date", "anniversary"):
                    # ``relativedelta`` normalizes a Feb-29 anniversary to
                    # Feb-28 in non-leap years instead of raising or silently
                    # skipping the employee's annual accrual.
                    anniversary = hire_date + relativedelta(years=process_date.year - hire_date.year) if hire_date else False
                    if not anniversary or anniversary != process_date:
                        continue
                    effective = process_date
                else:
                    effective = max(process_date.replace(month=1, day=1), assignment.date_from)
                period_key = "policy:%s:year:%s" % (assignment.id, process_date.year)
            if effective > process_date:
                continue
            if Run.search_count([("employee_id", "=", assignment.employee_id.id), ("leave_type_id", "=", line.leave_type_id.id), ("period_key", "=", period_key)]):
                continue
            amount = round(line.accrual_amount, 2)
            expiry = effective + relativedelta(years=1, days=-1)
            allocation = self.env["hr.leave.allocation"].sudo().with_context(
                tracking_disable=True, mail_create_nosubscribe=True, mail_notify_force_send=False,
            ).create({
                "private_name": _("Policy accrual: %s") % assignment.policy_id.name,
                "holiday_type": "employee", "employee_id": assignment.employee_id.id,
                "holiday_status_id": line.leave_type_id.id, "number_of_days": amount,
                "date_from": effective, "date_to": expiry,
            })
            if allocation.state != "validate":
                allocation.action_validate()
            Run.create({"employee_id": assignment.employee_id.id, "leave_type_id": line.leave_type_id.id,
                        "period_key": period_key, "effective_date": effective, "amount": amount,
                        "allocation_id": allocation.id, "reason": _("Policy accrual: %s") % assignment.policy_id.name})
            Balance._record_transaction({"employee_id": assignment.employee_id.id, "leave_type_id": line.leave_type_id.id,
                "transaction_type": "accrual", "effective_date": effective, "delta": amount,
                "balance_after": Balance._current_balance(assignment.employee_id.id, line.leave_type_id.id),
                "allocation_id": allocation.id, "reason": _("Policy accrual: %s") % assignment.policy_id.name,
                "expiry_date": expiry})
            self.env["hr.leave.audit.log"].sudo().create({"action": "accrual_processed", "module_area": "accrual",
                "entity_type": "policy", "entity_name": assignment.policy_id.name, "employee_id": assignment.employee_id.id,
                "leave_type_id": line.leave_type_id.id, "actor_id": self.env.user.id,
                "actor_label": self.env.user.name, "is_system": not bool(self.env.user),
                "note": _("Applied %.2f from Policy-Line %s for %s.") % (amount, line.id, period_key)})
            processed += 1
        return processed


class HrLeavePolicyAssignment(models.Model):
    _name = "hr.leave.policy.assignment"
    _description = "Effective-dated Leave Policy Assignment"
    _order = "date_from desc, id desc"
    _check_company_auto = True

    policy_id = fields.Many2one("hr.leave.policy", required=True, ondelete="restrict", index=True)
    policy_line_id = fields.Many2one("hr.leave.policy.line", required=True, ondelete="restrict", index=True)
    leave_type_id = fields.Many2one("hr.leave.type", required=True, ondelete="restrict", index=True)
    employee_id = fields.Many2one("hr.employee", required=True, ondelete="restrict", index=True)
    company_id = fields.Many2one(related="policy_id.company_id", store=True, index=True)
    date_from = fields.Date(required=True, default=fields.Date.context_today, index=True)
    date_to = fields.Date(index=True)
    superseded = fields.Boolean(default=False, readonly=True, index=True, copy=False)
    rule_snapshot = fields.Json(readonly=True, copy=False)

    @api.model_create_multi
    def create(self, vals_list):
        employee_ids = sorted({int(vals["employee_id"]) for vals in vals_list})
        if employee_ids:
            self.env.cr.execute("SELECT id FROM hr_employee WHERE id IN %s ORDER BY id FOR UPDATE", [tuple(employee_ids)])
        for vals in vals_list:
            line = self.env["hr.leave.policy.line"].browse(vals["policy_line_id"])
            vals["rule_snapshot"] = line.policy_id._rule_snapshot(line)
        return super().create(vals_list)

    def write(self, vals):
        if {"rule_snapshot", "policy_id", "policy_line_id", "leave_type_id", "employee_id", "date_from"}.intersection(vals):
            raise ValidationError(_("Assignment provenance is immutable; create a prospective assignment instead."))
        return super().write(vals)

    @api.ondelete(at_uninstall=False)
    def _unlink_except_historical(self):
        raise ValidationError(_("Policy assignments are historical records. End or supersede them instead."))

    @api.constrains("date_from", "date_to", "employee_id", "policy_id", "policy_line_id", "leave_type_id", "superseded")
    def _check_dates_and_overlap(self):
        for assignment in self:
            if (assignment.policy_line_id.policy_id != assignment.policy_id
                    or assignment.policy_line_id.leave_type_id != assignment.leave_type_id
                    or assignment.employee_id.company_id != assignment.company_id):
                raise ValidationError(_("Policy, type, line, and employee company must agree."))
            if assignment.superseded:
                continue
            if assignment.date_to and assignment.date_to < assignment.date_from:
                raise ValidationError(_("Assignment end date cannot precede its start date."))
            overlap = self.search_count([
                ("superseded", "=", False), ("id", "!=", assignment.id), ("employee_id", "=", assignment.employee_id.id), ("leave_type_id", "=", assignment.leave_type_id.id),
                ("policy_id.state", "=", "active"), ("policy_id.active", "=", True), ("date_from", "<=", assignment.date_to or "9999-12-31"), "|", ("date_to", "=", False), ("date_to", ">=", assignment.date_from),
            ])
            if overlap and assignment.policy_id.state == "active" and assignment.policy_id.active:
                raise ValidationError(_("This employee already has an overlapping active policy for the same Leave Type."))

    def active_on(self, value):
        self.ensure_one()
        value = fields.Date.to_date(value)
        return not self.superseded and self.date_from <= value and (not self.date_to or self.date_to >= value)


class HrLeaveTypePolicyClassification(models.Model):
    _inherit = "hr.leave.type"

    policy_classification = fields.Selection([
        ("annual", "Annual / Planned Leave"), ("sick", "Sick / Unplanned Absence"),
        ("family", "Family / Parental Leave"), ("compensatory", "Compensatory Leave"),
        ("career", "Career Development"), ("unpaid", "Unpaid Leave"), ("other", "Other"),
    ], default="other", required=True, string="Leave Classification", index=True)

    def _active_policy_line(self, employee, on_date=None):
        self.ensure_one()
        employee = employee.sudo()
        on_date = fields.Date.to_date(on_date) if on_date else fields.Date.context_today(self)
        assignment = self.env["hr.leave.policy.assignment"].sudo().search([
            ("superseded", "=", False),
            ("employee_id", "=", employee.id), ("leave_type_id", "=", self.id),
            ("policy_id.state", "=", "active"), ("policy_id.active", "=", True),
            ("date_from", "<=", on_date), "|", ("date_to", "=", False), ("date_to", ">=", on_date),
        ], order="date_from desc, id desc")
        assignment = assignment.filtered(lambda item: item.policy_id.apply_to != "conditions" or employee in item.policy_id._eligible_employees())
        if len(assignment) > 1:
            raise ValidationError(_("Multiple active policy assignments match this employee and Leave Type. HR must resolve the conflict."))
        if assignment:
            return assignment.policy_line_id
        candidates = self.env["hr.leave.policy.line"].sudo().search([
            ("leave_type_id", "=", self.id), ("active", "=", True),
            ("policy_id.state", "=", "active"), ("policy_id.active", "=", True),
            ("company_id", "=", employee.company_id.id),
        ])
        candidates = candidates.filtered(lambda line: employee in line.policy_id._eligible_employees())
        candidates = candidates.filtered(
            lambda line: not line.policy_id.assignment_ids.filtered(
                lambda a: a.employee_id == employee and a.leave_type_id == self and not a.superseded
            )
        )
        if len(candidates) > 1:
            raise ValidationError(_("Multiple eligible policies match this employee and Leave Type. HR must resolve the conflict."))
        return candidates

    def _get_eligible_employees(self):
        self.ensure_one()
        lines = self.env["hr.leave.policy.line"].sudo().search([
            ("leave_type_id", "=", self.id), ("active", "=", True),
            ("policy_id.state", "=", "active"), ("policy_id.active", "=", True),
            ("company_id", "=", self.env.company.id),
        ])
        if not lines:
            return super()._get_eligible_employees()
        employees = self.env["hr.employee"]
        for policy in lines.mapped("policy_id"):
            employees |= policy._eligible_employees()
        return employees


class HrEmployeePolicyEligibility(models.Model):
    _inherit = "hr.employee"

    def write(self, values):
        result = super().write(values)
        if not {"department_id", "unit_id", "grade_id", "work_location_id", "employee_type_id", "job_id", "company_id", "active", "first_contract_date"}.intersection(values):
            return result
        today = fields.Date.context_today(self)
        assignments = self.env["hr.leave.policy.assignment"].sudo().search([
            ("employee_id", "in", self.ids), ("superseded", "=", False),
            ("policy_id.apply_to", "=", "conditions"),
            "|", ("date_to", "=", False), ("date_to", ">=", today),
        ])
        for assignment in assignments:
            if assignment.employee_id not in assignment.policy_id._eligible_employees():
                assignment.write({"superseded": True} if assignment.date_from >= today else {"date_to": today - timedelta(days=1)})
                assignment.policy_id._audit(_("Ended condition-based assignment after employee attributes changed."), employee=assignment.employee_id, leave_type=assignment.leave_type_id)
        # Resolve newly eligible types on demand. Ambiguity raises a conflict
        # in _active_policy_line; never choose a policy by database row order.
        return result
