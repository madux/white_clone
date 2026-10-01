# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class CleonApprovalRule(models.Model):
    _name = "cleon.approval.rule"
    _description = "Conditional Approval Route Rule"
    _order = "priority, id"
    _check_company_auto = True

    name = fields.Char(required=True, index=True)
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)
    workflow_type_id = fields.Many2one("cleon.approval.workflow.type", required=True, ondelete="cascade", index=True)
    chain_id = fields.Many2one("cleon.approval.chain", required=True, ondelete="restrict", check_company=True, string="Approval Route")
    priority = fields.Integer(default=10, required=True, help="Lowest number is evaluated first.")
    applies_to = fields.Selection([
        ("all", "All Employees"), ("departments", "Specific Departments"),
        ("employees", "Specific Employees"),
    ], default="all", required=True)
    department_ids = fields.Many2many("hr.department", string="Departments")
    employee_ids = fields.Many2many("hr.employee", string="Employees")
    condition_ids = fields.One2many("cleon.approval.rule.condition", "rule_id", copy=True)
    description = fields.Text()
    active = fields.Boolean(default=True, index=True)

    @api.constrains("workflow_type_id", "chain_id", "company_id", "applies_to", "department_ids", "employee_ids")
    def _check_configuration(self):
        for rule in self:
            if rule.chain_id.company_id != rule.company_id or rule.chain_id.workflow_type_id != rule.workflow_type_id:
                raise ValidationError(_("The rule's Approval Route must use the same company and Workflow Type."))
            if rule.applies_to == "departments" and not rule.department_ids:
                raise ValidationError(_("Select at least one department for this rule."))
            if rule.applies_to == "employees" and not rule.employee_ids:
                raise ValidationError(_("Select at least one employee for this rule."))

    def _matches(self, target):
        self.ensure_one()
        employee = target._approval_employee().sudo()
        if self.applies_to == "departments" and employee.department_id not in self.department_ids:
            return False
        if self.applies_to == "employees" and employee not in self.employee_ids:
            return False
        context = target._approval_rule_context() if hasattr(target, "_approval_rule_context") else {}
        return all(condition._matches(context) for condition in self.condition_ids)

    @api.model
    def matching_rule(self, workflow_type, target):
        company = target._approval_company()
        rules = self.sudo().search([
            ("company_id", "=", company.id), ("workflow_type_id", "=", workflow_type.id),
            ("active", "=", True), ("chain_id.active", "=", True),
        ], order="priority, id")
        return next((rule for rule in rules if rule._matches(target)), self.browse())


class CleonApprovalRuleCondition(models.Model):
    _name = "cleon.approval.rule.condition"
    _description = "Approval Rule Condition"
    _order = "sequence, id"

    rule_id = fields.Many2one("cleon.approval.rule", required=True, ondelete="cascade", index=True)
    sequence = fields.Integer(default=10)
    field_name = fields.Selection([
        ("duration", "Leave Duration"), ("leave_type", "Leave Type"),
        ("department", "Department"), ("available_balance", "Available Balance"),
        ("blackout_exception", "Blackout Exception Requested"),
    ], required=True, default="duration")
    operator = fields.Selection([
        ("eq", "Equals"), ("ne", "Does Not Equal"), ("gt", "Greater Than"),
        ("gte", "Greater Than or Equal"), ("lt", "Less Than"),
        ("lte", "Less Than or Equal"), ("in", "Is One Of"),
    ], required=True, default="eq")
    value = fields.Char(required=True, help="For Is One Of, enter comma-separated IDs or values.")

    def _matches(self, context):
        self.ensure_one()
        if self.field_name not in context or context[self.field_name] is None:
            return False
        actual = context[self.field_name]
        expected = self.value or ""
        if self.operator == "in":
            return str(actual) in {item.strip() for item in expected.split(",")}
        if self.operator in ("gt", "gte", "lt", "lte"):
            try:
                actual, expected = float(actual or 0), float(expected)
            except (TypeError, ValueError):
                return False
            return {"gt": actual > expected, "gte": actual >= expected,
                    "lt": actual < expected, "lte": actual <= expected}[self.operator]
        actual_text = str(bool(actual)).lower() if isinstance(actual, bool) else str(actual)
        matched = actual_text.lower() == expected.strip().lower()
        return not matched if self.operator == "ne" else matched


class CleonApprovalEscalationRule(models.Model):
    _name = "cleon.approval.escalation.rule"
    _description = "Approval Escalation Rule"
    _order = "workflow_type_id, chain_id, step_id, id"
    _check_company_auto = True

    name = fields.Char(required=True)
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)
    workflow_type_id = fields.Many2one("cleon.approval.workflow.type", required=True, ondelete="cascade", index=True)
    chain_id = fields.Many2one("cleon.approval.chain", required=True, ondelete="cascade", check_company=True, string="Approval Route")
    step_id = fields.Many2one("cleon.approval.step", required=True, ondelete="cascade", string="From Level")
    response_value = fields.Integer(default=24, required=True)
    response_unit = fields.Selection([("minutes", "Minutes"), ("hours", "Hours"), ("days", "Days")], default="hours", required=True)
    escalation_action = fields.Selection([
        ("next", "Escalate to Next Level"), ("role", "Escalate to Specific Role"),
        ("employee", "Escalate to Specific Employee"), ("notify", "Notify Only"),
    ], default="next", required=True)
    target_group_id = fields.Many2one("res.groups", string="Specific Role")
    target_user_id = fields.Many2one("res.users", string="Specific Employee / User")
    notify_scope = fields.Selection([
        ("requester", "Requester"), ("original", "Original Approver"),
        ("target", "Escalation Target"), ("all", "All Parties"),
    ], default="all", required=True)
    active = fields.Boolean(default=True, index=True)

    @api.constrains("response_value", "chain_id", "step_id", "workflow_type_id", "escalation_action", "target_group_id", "target_user_id")
    def _check_values(self):
        for rule in self:
            if rule.response_value <= 0:
                raise ValidationError(_("Escalation response time must be greater than zero."))
            if rule.step_id.chain_id != rule.chain_id or rule.chain_id.workflow_type_id != rule.workflow_type_id:
                raise ValidationError(_("The monitored level must belong to the selected Workflow Type and Approval Route."))
            if rule.escalation_action == "role" and not rule.target_group_id:
                raise ValidationError(_("Select the role that receives this escalation."))
            if rule.escalation_action == "employee" and not rule.target_user_id:
                raise ValidationError(_("Select the employee/user that receives this escalation."))

    def timeout_hours(self):
        self.ensure_one()
        if self.response_unit == "working_days":
            raise ValidationError(_("Working-day escalation is not supported. Configure minutes, hours or calendar days instead."))
        factors = {"minutes": 1 / 60, "hours": 1, "days": 24}
        return self.response_value * factors[self.response_unit]


class CleonApprovalDelegation(models.Model):
    _name = "cleon.approval.delegation"
    _description = "Temporary Approval Delegation"
    _order = "date_from desc, id desc"

    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)
    user_id = fields.Many2one("res.users", required=True, index=True, string="Approver")
    delegate_user_id = fields.Many2one("res.users", required=True, index=True, string="Delegate")
    date_from = fields.Date(required=True, default=fields.Date.context_today, index=True)
    date_to = fields.Date(required=True, index=True)
    reason = fields.Char()
    active = fields.Boolean(default=True)

    @api.constrains("user_id", "delegate_user_id", "date_from", "date_to", "company_id", "active")
    def _check_delegation(self):
        for delegation in self:
            if delegation.active and self.sudo().search_count([
                ("id", "!=", delegation.id), ("company_id", "=", delegation.company_id.id),
                ("user_id", "=", delegation.user_id.id), ("active", "=", True),
                ("date_from", "<=", delegation.date_to), ("date_to", ">=", delegation.date_from),
            ]):
                raise ValidationError(_("An approver cannot have overlapping active delegations in the same company."))
            if delegation.user_id.share or delegation.delegate_user_id.share:
                raise ValidationError(_("Approval delegation requires internal users."))
            if delegation.user_id == delegation.delegate_user_id:
                raise ValidationError(_("An approver cannot delegate to themselves."))
            if delegation.date_to < delegation.date_from:
                raise ValidationError(_("Delegation end date cannot precede its start date."))
            if delegation.company_id not in delegation.user_id.company_ids or delegation.company_id not in delegation.delegate_user_id.company_ids:
                raise ValidationError(_("Approver and delegate must both have access to the delegation company."))

    @api.model
    def apply_to_users(self, users, company, excluded_user=False):
        today = fields.Date.context_today(self)
        result = self.env["res.users"]
        for user in users:
            delegation = self.sudo().search([
                ("company_id", "=", company.id), ("user_id", "=", user.id), ("active", "=", True),
                ("date_from", "<=", today), ("date_to", ">=", today),
            ], order="date_from desc, id desc", limit=1)
            candidate = delegation.delegate_user_id if delegation else user
            if candidate.active and not candidate.share and company in candidate.company_ids and candidate != excluded_user:
                result |= candidate
        return result
