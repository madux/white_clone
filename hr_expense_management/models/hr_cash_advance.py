from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError


class HrCashAdvance(models.Model):
    _name = "hr.cash.advance"
    _description = "Employee Cash Advance"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "issue_date desc, id desc"
    _check_company_auto = True

    name = fields.Char(default="New", readonly=True, copy=False, index=True)
    request_id = fields.Many2one(
        "hr.expense.request", readonly=True, copy=False, ondelete="restrict", check_company=True
    )
    employee_id = fields.Many2one(
        "hr.employee", required=True, tracking=True, check_company=True, index=True
    )
    department_id = fields.Many2one(
        related="employee_id.department_id", store=True, readonly=True, index=True
    )
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    currency_id = fields.Many2one(related="company_id.currency_id", store=True, readonly=True)
    issued_amount = fields.Monetary(required=True, tracking=True, currency_field="currency_id")
    retired_amount = fields.Monetary(
        compute="_compute_balances", store=True, currency_field="currency_id"
    )
    outstanding_amount = fields.Monetary(
        compute="_compute_balances", store=True, currency_field="currency_id"
    )
    issue_date = fields.Date(required=True, default=fields.Date.context_today, tracking=True)
    retirement_due_date = fields.Date(required=True, tracking=True)
    days_outstanding = fields.Integer(compute="_compute_age")
    age_bracket = fields.Selection(
        [("0_30", "0-30 days"), ("31_60", "31-60 days"),
         ("61_90", "61-90 days"), ("over_90", ">90 days")],
        compute="_compute_age",
    )
    state = fields.Selection(
        [("draft", "Draft"), ("outstanding", "Outstanding"),
         ("partial", "Partially Retired"), ("retired", "Retired"),
         ("written_off", "Written Off"), ("cancelled", "Cancelled")],
        default="draft", required=True, tracking=True, copy=False, index=True,
    )
    payment_method = fields.Selection(
        [("bank", "Bank Transfer"), ("cash", "Cash"),
         ("cheque", "Cheque"), ("payroll", "Payroll")],
        default="bank", required=True, tracking=True,
    )
    reference = fields.Char(tracking=True)
    notes = fields.Text()
    retirement_ids = fields.One2many(
        "hr.cash.advance.retirement", "advance_id", string="Retirements"
    )

    _sql_constraints = [
        ("cash_advance_name_uniq", "unique(name)", "Advance reference must be unique."),
        ("cash_advance_request_uniq", "unique(request_id)", "A request can create only one advance."),
        ("cash_advance_amount_positive", "check(issued_amount > 0)", "Issued amount must be positive."),
    ]

    @api.model_create_multi
    def create(self, vals_list):
        if not self.env.su and not (
            self.env.user.has_group("hr_expense_management.group_hr_expense_finance")
            or self.env.user.has_group("hr_expense_management.group_hr_expense_admin")
        ):
            raise AccessError("Only Finance can create cash advances.")
        for vals in vals_list:
            if vals.get("name", "New") == "New":
                vals["name"] = self.env["ir.sequence"].next_by_code("hr.cash.advance") or "New"
            vals["state"] = "draft"
        return super().create(vals_list)

    @api.depends("issued_amount", "retirement_ids.amount", "retirement_ids.state")
    def _compute_balances(self):
        for advance in self:
            retired = sum(
                advance.retirement_ids.filtered(lambda item: item.state == "posted").mapped("amount")
            )
            advance.retired_amount = retired
            advance.outstanding_amount = max(advance.issued_amount - retired, 0.0)

    @api.depends("issue_date", "state")
    def _compute_age(self):
        today = fields.Date.context_today(self)
        for advance in self:
            days = max((today - advance.issue_date).days, 0) if advance.issue_date else 0
            advance.days_outstanding = days
            advance.age_bracket = (
                "0_30" if days <= 30 else "31_60" if days <= 60
                else "61_90" if days <= 90 else "over_90"
            )

    def action_issue(self):
        self._check_finance()
        for advance in self:
            if advance.state != "draft":
                raise UserError("Only draft advances can be issued.")
            advance.sudo().write({"state": "outstanding"})
            advance.message_post(body=_("Cash advance issued."))
        return True

    def action_retire(self, amount, reference=None):
        self.ensure_one()
        self._check_finance()
        if self.state not in ("outstanding", "partial"):
            raise UserError("Only outstanding advances can be retired.")
        amount = float(amount or 0)
        if amount <= 0 or self.currency_id.compare_amounts(amount, self.outstanding_amount) > 0:
            raise ValidationError(
                "Retirement amount must be positive and cannot exceed the outstanding balance."
            )
        retirement = self.env["hr.cash.advance.retirement"].create({
            "advance_id": self.id, "amount": amount, "reference": reference,
        })
        retirement.action_post()
        self.invalidate_recordset(["retired_amount", "outstanding_amount"])
        new_state = (
            "retired"
            if self.currency_id.compare_amounts(self.outstanding_amount, 0) == 0
            else "partial"
        )
        self.sudo().write({"state": new_state})
        return retirement

    def _check_finance(self):
        if not (
            self.env.user.has_group("hr_expense_management.group_hr_expense_finance")
            or self.env.user.has_group("hr_expense_management.group_hr_expense_admin")
        ):
            raise AccessError("Only Finance can process cash advances.")


class HrCashAdvanceRetirement(models.Model):
    _name = "hr.cash.advance.retirement"
    _description = "Cash Advance Retirement"
    _order = "date desc, id desc"
    _check_company_auto = True

    advance_id = fields.Many2one(
        "hr.cash.advance", required=True, ondelete="cascade", check_company=True
    )
    company_id = fields.Many2one(
        related="advance_id.company_id", store=True, readonly=True, index=True
    )
    currency_id = fields.Many2one(related="advance_id.currency_id", store=True, readonly=True)
    amount = fields.Monetary(required=True, currency_field="currency_id")
    date = fields.Date(default=fields.Date.context_today, required=True)
    reference = fields.Char()
    state = fields.Selection(
        [("draft", "Draft"), ("posted", "Posted"), ("cancelled", "Cancelled")],
        default="draft", required=True,
    )
    processed_by_id = fields.Many2one("res.users", readonly=True)

    _sql_constraints = [
        ("cash_advance_retirement_amount_positive", "check(amount > 0)", "Retirement amount must be positive."),
    ]

    def action_post(self):
        for retirement in self:
            retirement.advance_id._check_finance()
            if retirement.state != "draft":
                raise UserError("Only draft retirements can be posted.")
            other = sum(
                retirement.advance_id.retirement_ids.filtered(
                    lambda item: item != retirement and item.state == "posted"
                ).mapped("amount")
            )
            if retirement.currency_id.compare_amounts(
                other + retirement.amount, retirement.advance_id.issued_amount
            ) > 0:
                raise ValidationError("Posted retirements cannot exceed the issued amount.")
            retirement.sudo().write({
                "state": "posted", "processed_by_id": self.env.user.id,
            })
        return True
