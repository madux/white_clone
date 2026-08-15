from datetime import timedelta

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError


class HrExpenseRequestType(models.Model):
    _name = "hr.expense.request.type"
    _description = "Expense Request Type"
    _order = "sequence, name"
    _check_company_auto = True

    name = fields.Char(required=True, translate=True)
    code = fields.Char(required=True)
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    currency_id = fields.Many2one(
        related="company_id.currency_id", store=True, readonly=True
    )
    minimum_amount = fields.Monetary(currency_field="currency_id")
    maximum_amount = fields.Monetary(currency_field="currency_id")
    creates_advance = fields.Boolean(string="Creates Cash Advance")
    retirement_days = fields.Integer(default=30)
    description = fields.Text()

    _sql_constraints = [
        ("request_type_code_company_uniq", "unique(code, company_id)", "Request type code must be unique per company."),
    ]

    @api.constrains("minimum_amount", "maximum_amount", "retirement_days")
    def _check_limits(self):
        for record in self:
            if record.minimum_amount < 0 or record.maximum_amount < 0:
                raise ValidationError("Request limits cannot be negative.")
            if record.maximum_amount and record.minimum_amount > record.maximum_amount:
                raise ValidationError("The minimum amount cannot exceed the maximum amount.")
            if record.retirement_days < 1:
                raise ValidationError("Advance retirement days must be at least one day.")


class HrExpenseRequest(models.Model):
    _name = "hr.expense.request"
    _description = "Expense Pre-Approval Request"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "submitted_date desc, id desc"
    _check_company_auto = True

    name = fields.Char(default="New", readonly=True, copy=False, index=True)
    employee_id = fields.Many2one(
        "hr.employee", required=True, default=lambda self: self._default_employee(),
        tracking=True, check_company=True, index=True,
    )
    department_id = fields.Many2one(
        related="employee_id.department_id", store=True, readonly=True, index=True
    )
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    currency_id = fields.Many2one(
        related="company_id.currency_id", store=True, readonly=True
    )
    request_type_id = fields.Many2one(
        "hr.expense.request.type", required=True, tracking=True, check_company=True,
        domain="[('company_id', '=', company_id), ('active', '=', True)]",
    )
    purpose = fields.Char(required=True, tracking=True)
    description = fields.Text(tracking=True)
    amount = fields.Monetary(required=True, tracking=True, currency_field="currency_id")
    needed_date = fields.Date(required=True, tracking=True)
    attachment_ids = fields.Many2many(
        "ir.attachment", "hr_expense_request_attachment_rel", "request_id",
        "attachment_id", string="Supporting Documents", copy=False,
    )
    state = fields.Selection(
        [("draft", "Draft"), ("submitted", "Pending"), ("approved", "Approved"),
         ("fulfilled", "Advance Issued"), ("rejected", "Rejected"),
         ("returned", "Returned"), ("cancelled", "Cancelled")],
        default="draft", required=True, tracking=True, copy=False, index=True,
    )
    submitted_date = fields.Datetime(readonly=True, copy=False, tracking=True)
    decision_date = fields.Datetime(readonly=True, copy=False, tracking=True)
    decided_by_id = fields.Many2one("res.users", readonly=True, copy=False)
    decision_comment = fields.Text(readonly=True, copy=False, tracking=True)
    advance_id = fields.Many2one("hr.cash.advance", readonly=True, copy=False)
    approval_step_ids = fields.One2many(
        "hr.expense.approval.step", "request_id", string="Approval Steps", copy=False
    )

    _sql_constraints = [
        ("expense_request_name_uniq", "unique(name)", "Request reference must be unique."),
        ("expense_request_amount_positive", "check(amount > 0)", "Request amount must be positive."),
    ]

    @api.model
    def _default_employee(self):
        return self.env["hr.employee"].search(
            [("user_id", "=", self.env.user.id), ("company_id", "=", self.env.company.id)], limit=1,
        )

    def _is_admin(self):
        return self.env.user.has_group("hr_expense_management.group_hr_expense_admin")

    def _is_manager(self):
        return self.env.user.has_group("hr_expense_management.group_hr_expense_manager")

    def _is_owner(self):
        self.ensure_one()
        return self.employee_id.sudo().user_id == self.env.user

    @api.constrains("amount", "request_type_id")
    def _check_amount_limits(self):
        for request in self:
            request_type = request.request_type_id
            if request.amount <= 0:
                raise ValidationError("Request amount must be positive.")
            if request_type.minimum_amount and request.amount < request_type.minimum_amount:
                raise ValidationError("The amount is below the request type minimum.")
            if request_type.maximum_amount and request.amount > request_type.maximum_amount:
                raise ValidationError("The amount exceeds the request type maximum.")

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("name", "New") == "New":
                vals["name"] = self.env["ir.sequence"].next_by_code("hr.expense.request") or "New"
            if not self.env.su and not self._is_admin():
                vals["state"] = "draft"
                employee_id = vals.get("employee_id")
                if employee_id and self.env["hr.employee"].browse(employee_id).sudo().user_id != self.env.user:
                    raise AccessError("You can only create requests for yourself.")
        return super().create(vals_list)

    def write(self, vals):
        protected = {"state", "submitted_date", "decision_date", "decided_by_id", "decision_comment", "advance_id"}
        workflow = self.env.context.get("request_workflow")
        if not self.env.su and protected.intersection(vals) and not (self._is_admin() or workflow):
            raise AccessError("Use the request workflow actions to change protected fields.")
        if not self.env.su and not self._is_admin() and not workflow:
            for request in self:
                if not request._is_owner() or request.state not in ("draft", "returned"):
                    raise AccessError("Only your draft or returned requests can be edited.")
        return super().write(vals)

    def unlink(self):
        for request in self:
            if not self.env.su and not self._is_admin() and (not request._is_owner() or request.state != "draft"):
                raise AccessError("Only your draft requests can be deleted.")
        return super().unlink()

    def action_submit(self):
        for request in self:
            if not (request._is_owner() or request._is_admin()):
                raise AccessError("Only the owner can submit this request.")
            if request.state not in ("draft", "returned"):
                raise UserError("Only draft or returned requests can be submitted.")
            request.with_context(request_workflow=True).sudo().write({
                "state": "submitted", "submitted_date": fields.Datetime.now(),
                "decision_comment": False,
            })
            request._create_approval_steps()
            request.message_post(body=_("Request submitted for approval."))
        return True

    def action_approve(self, comment=None):
        for request in self:
            if not (request._is_manager() or request._is_admin()):
                raise AccessError("Only Managers can approve requests.")
            if request.state != "submitted":
                raise UserError("Only pending requests can be approved.")
            pending = request.approval_step_ids.filtered(lambda step: step.state == "pending")[:1]
            if pending:
                route_complete = pending.action_approve(comment)
                if not route_complete:
                    continue
            request.with_context(request_workflow=True).sudo().write({
                "state": "approved", "decision_date": fields.Datetime.now(),
                "decided_by_id": self.env.user.id, "decision_comment": comment or False,
            })
            request.message_post(body=_("Request approved."))
        return True

    def action_reject(self, comment):
        if not comment:
            raise ValidationError("A rejection reason is required.")
        for request in self:
            if not (request._is_manager() or request._is_admin()):
                raise AccessError("Only Managers can reject requests.")
            if request.state != "submitted":
                raise UserError("Only pending requests can be rejected.")
            request.approval_step_ids.filtered(lambda step: step.state in ("waiting", "pending")).sudo().write({
                "state": "rejected", "decided_by_id": self.env.user.id,
                "decision_date": fields.Datetime.now(), "comment": comment,
            })
            request.with_context(request_workflow=True).sudo().write({
                "state": "rejected", "decision_date": fields.Datetime.now(),
                "decided_by_id": self.env.user.id, "decision_comment": comment,
            })
            request.message_post(body=_("Request rejected: %s") % comment)
        return True

    def action_return(self, comment):
        if not comment:
            raise ValidationError("A return reason is required.")
        for request in self:
            if not (request._is_manager() or request._is_admin()):
                raise AccessError("Only Managers can return requests.")
            if request.state != "submitted":
                raise UserError("Only pending requests can be returned.")
            request.approval_step_ids.filtered(lambda step: step.state in ("waiting", "pending")).sudo().write({"state": "cancelled"})
            request.with_context(request_workflow=True).sudo().write({
                "state": "returned", "decision_date": fields.Datetime.now(),
                "decided_by_id": self.env.user.id, "decision_comment": comment,
            })
        return True

    def action_cancel(self):
        for request in self:
            if not (request._is_owner() or request._is_admin()):
                raise AccessError("Only the owner can cancel this request.")
            if request.state not in ("draft", "submitted", "returned"):
                raise UserError("This request can no longer be cancelled.")
            request.with_context(request_workflow=True).sudo().write({"state": "cancelled"})
        return True

    def _create_approval_steps(self):
        self.ensure_one()
        return self.env["hr.expense.approval.rule"]._create_steps_for(self, "request")

    def action_issue_advance(self):
        self.ensure_one()
        if not (self.env.user.has_group("hr_expense_management.group_hr_expense_finance") or self._is_admin()):
            raise AccessError("Only Finance can issue cash advances.")
        if self.state != "approved" or not self.request_type_id.creates_advance:
            raise UserError("Only approved cash-advance requests can be issued.")
        if self.advance_id:
            return self.advance_id
        advance = self.env["hr.cash.advance"].create({
            "request_id": self.id, "employee_id": self.employee_id.id,
            "issued_amount": self.amount, "issue_date": fields.Date.context_today(self),
            "retirement_due_date": fields.Date.context_today(self) + timedelta(days=self.request_type_id.retirement_days),
        })
        advance.action_issue()
        self.with_context(request_workflow=True).sudo().write({"advance_id": advance.id, "state": "fulfilled"})
        return advance
