from odoo import api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError


class HrExpenseApprovalRule(models.Model):
    """Represent expense approval rule records in the expense workflow."""

    _name = "hr.expense.approval.rule"
    _description = "Expense Approval Rule"
    _order = "sequence, id"
    _check_company_auto = True

    name = fields.Char(required=True)
    active = fields.Boolean(default=True)
    sequence = fields.Integer(
        default=10,
        help="Lower values are considered before higher values when rules overlap.",
    )
    target = fields.Selection(
        [("claim", "Claim"), ("request", "Request")], required=True, index=True
    )
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    currency_id = fields.Many2one(related="company_id.currency_id", store=True, readonly=True)
    department_id = fields.Many2one("hr.department", check_company=True)
    minimum_amount = fields.Monetary(currency_field="currency_id")
    maximum_amount = fields.Monetary(currency_field="currency_id")
    line_ids = fields.One2many(
        "hr.expense.approval.rule.line", "rule_id", string="Approval Levels", copy=True
    )

    @api.constrains("minimum_amount", "maximum_amount")
    def _check_amounts(self):
        for rule in self:
            if rule.minimum_amount < 0 or rule.maximum_amount < 0:
                raise ValidationError("Approval rule limits cannot be negative.")
            if rule.maximum_amount and rule.minimum_amount > rule.maximum_amount:
                raise ValidationError("The minimum amount cannot exceed the maximum amount.")

    @api.model
    def _create_steps_for(self, record, target):
        """Create sequential or parallel steps from the first matching rule."""
        amount = record.amount_total if target == "claim" else record.amount
        domain = [
            ("active", "=", True), ("target", "=", target),
            ("company_id", "=", record.company_id.id),
            "|", ("department_id", "=", False), ("department_id", "=", record.department_id.id),
        ]
        # Routing is server configuration. Submitters must not need direct read
        # access to the rule model in order to submit their own record.
        rules = self.sudo().search(domain, order="sequence, id")
        rule = rules.filtered(
            lambda item: amount >= item.minimum_amount
            and (not item.maximum_amount or amount <= item.maximum_amount)
        )[:1]
        if not rule:
            return self.env["hr.expense.approval.step"]
        if not rule.line_ids:
            raise UserError("The matching approval rule has no approval levels.")
        values = []
        lines = rule.line_ids.sorted(lambda line: (line.sequence, line.id))
        first_sequence = lines[0].sequence
        for line in lines:
            approver = line._resolve_approver(record.employee_id)
            values.append({
                "rule_id": rule.id,
                "rule_line_id": line.id,
                "target": target,
                "claim_id": record.id if target == "claim" else False,
                "request_id": record.id if target == "request" else False,
                "company_id": record.company_id.id,
                "sequence": line.sequence,
                # Lines sharing a sequence form a parallel approval level.
                "state": "pending" if line.sequence == first_sequence else "waiting",
                "approver_user_id": approver.id if approver else False,
                "approver_group_id": line.group_id.id if line.approver_type == "group" else False,
            })
        return self.env["hr.expense.approval.step"].sudo().create(values)


class HrExpenseApprovalRuleLine(models.Model):
    """Represent expense approval level records in the expense workflow."""

    _name = "hr.expense.approval.rule.line"
    _description = "Expense Approval Level"
    _order = "sequence, id"

    rule_id = fields.Many2one("hr.expense.approval.rule", required=True, ondelete="cascade")
    sequence = fields.Integer(
        default=10,
        help="Levels run in sequence order. Equal values form a parallel level.",
    )
    name = fields.Char(required=True)
    approver_type = fields.Selection(
        [("manager", "Employee Manager"), ("user", "Specific User"),
         ("group", "Any User in Group")],
        default="manager", required=True,
    )
    user_id = fields.Many2one("res.users")
    group_id = fields.Many2one("res.groups")

    @api.constrains("approver_type", "user_id", "group_id")
    def _check_approver(self):
        for line in self:
            if line.approver_type == "user" and not line.user_id:
                raise ValidationError("Select the user for this approval level.")
            if line.approver_type == "group" and not line.group_id:
                raise ValidationError("Select the group for this approval level.")

    def _resolve_approver(self, employee):
        self.ensure_one()
        if self.approver_type == "user":
            return self.user_id
        if self.approver_type == "manager":
            return employee.parent_id.user_id
        return self.env["res.users"]


class HrExpenseApprovalStep(models.Model):
    """Represent expense approval step records in the expense workflow."""

    _name = "hr.expense.approval.step"
    _description = "Expense Approval Step"
    _inherit = "hr.expense.security.mixin"
    _order = "sequence, id"
    _check_company_auto = True

    rule_id = fields.Many2one("hr.expense.approval.rule", required=True, ondelete="restrict")
    rule_line_id = fields.Many2one(
        "hr.expense.approval.rule.line", required=True, ondelete="restrict"
    )
    target = fields.Selection(
        [("claim", "Claim"), ("request", "Request")], required=True, index=True
    )
    claim_id = fields.Many2one("hr.claim", ondelete="cascade", check_company=True)
    request_id = fields.Many2one("hr.expense.request", ondelete="cascade", check_company=True)
    company_id = fields.Many2one("res.company", required=True, index=True)
    sequence = fields.Integer(default=10)
    state = fields.Selection(
        [("waiting", "Waiting"), ("pending", "Pending"),
         ("approved", "Approved"), ("rejected", "Rejected"),
         ("cancelled", "Cancelled")],
        default="waiting", required=True, index=True,
    )
    approver_user_id = fields.Many2one("res.users", index=True)
    approver_group_id = fields.Many2one("res.groups")
    decided_by_id = fields.Many2one("res.users", readonly=True)
    decision_date = fields.Datetime(readonly=True)
    comment = fields.Text(readonly=True)
    source_name = fields.Char(compute="_compute_source", store=True)
    employee_id = fields.Many2one("hr.employee", compute="_compute_source", store=True)
    department_id = fields.Many2one("hr.department", compute="_compute_source", store=True)
    amount = fields.Monetary(compute="_compute_source", store=True, currency_field="currency_id")
    currency_id = fields.Many2one(related="company_id.currency_id", store=True, readonly=True)

    @api.depends(
        "claim_id.name", "claim_id.employee_id", "claim_id.department_id", "claim_id.amount_total",
        "request_id.name", "request_id.employee_id", "request_id.department_id", "request_id.amount",
    )
    def _compute_source(self):
        for step in self:
            source = step.claim_id or step.request_id
            step.source_name = source.name if source else False
            step.employee_id = source.employee_id if source else False
            step.department_id = source.department_id if source else False
            step.amount = (source.amount_total if step.claim_id else source.amount) if source else 0.0

    @api.constrains("target", "claim_id", "request_id")
    def _check_source(self):
        for step in self:
            if step.target == "claim" and (not step.claim_id or step.request_id):
                raise ValidationError("A claim approval step must reference exactly one claim.")
            if step.target == "request" and (not step.request_id or step.claim_id):
                raise ValidationError("A request approval step must reference exactly one request.")

    def _can_current_user_approve(self):
        self.ensure_one()
        return (
            self._expense_has_role("admin")
            or self.approver_user_id == self.env.user
            or (self.approver_group_id and self.approver_group_id in self.env.user.groups_id)
            or (
                not self.approver_user_id
                and not self.approver_group_id
                and self._expense_has_role("manager")
            )
        )

    def action_approve(self, comment=None):
        """Approve eligible records under the model's authorization and routing rules."""
        self.ensure_one()
        if self.state != "pending":
            raise UserError("Only the current pending level can be approved.")
        if not self._can_current_user_approve():
            raise AccessError("You are not the approver for this level.")
        self.sudo().write({
            "state": "approved", "decided_by_id": self.env.user.id,
            "decision_date": fields.Datetime.now(), "comment": comment or False,
        })
        source_steps = self.claim_id.approval_step_ids if self.claim_id else self.request_id.approval_step_ids
        if source_steps.filtered(lambda step: step.state == "pending"):
            return False
        waiting = source_steps.filtered(lambda step: step.state == "waiting").sorted("sequence")
        if waiting:
            next_sequence = waiting[0].sequence
            waiting.filtered(lambda step: step.sequence == next_sequence).sudo().write(
                {"state": "pending"}
            )
            return False
        return True


class HrClaimApprovalRouting(models.Model):
    """Apply configured approval routing to expense claims."""

    _inherit = "hr.claim"

    approval_step_ids = fields.One2many(
        "hr.expense.approval.step", "claim_id", string="Approval Steps", copy=False
    )

    def action_submit(self):
        """Validate and submit an eligible draft record under its authorization rules."""
        result = super().action_submit()
        for claim in self:
            claim.approval_step_ids.filtered(
                lambda step: step.state in ("waiting", "pending")
            ).sudo().write({"state": "cancelled"})
            self.env["hr.expense.approval.rule"]._create_steps_for(claim, "claim")
        return result

    def action_approve(self, comment=None):
        """Approve eligible records under the model's authorization and routing rules."""
        remaining = self.env["hr.claim"]
        for claim in self:
            pending = claim.approval_step_ids.filtered(lambda step: step.state == "pending")[:1]
            if pending and not pending.action_approve(comment):
                continue
            remaining |= claim
        return super(HrClaimApprovalRouting, remaining).action_approve(comment) if remaining else True

    def _apply_negative_decision(self, decision, reason):
        """Apply an authorized rejection or return and close pending workflow work."""
        result = super()._apply_negative_decision(decision, reason)
        state = "rejected" if decision == "reject" else "cancelled"
        self.mapped("approval_step_ids").filtered(
            lambda step: step.state in ("waiting", "pending")
        ).sudo().write({
            "state": state, "decided_by_id": self.env.user.id,
            "decision_date": fields.Datetime.now(), "comment": reason,
        })
        return result
