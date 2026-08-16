from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError


class HrExpensePeriod(models.Model):
    _name = "hr.expense.period"
    _description = "Expense Fiscal Period"
    _inherit = ["mail.thread", "mail.activity.mixin", "hr.expense.security.mixin"]
    _order = "date_start desc, id desc"
    _check_company_auto = True

    name = fields.Char(required=True, tracking=True)
    code = fields.Char(required=True, tracking=True)
    date_start = fields.Date(required=True, tracking=True)
    date_end = fields.Date(required=True, tracking=True)
    submission_cutoff = fields.Date(
        tracking=True, help="Last date on which a claim or request may be submitted."
    )
    approval_cutoff = fields.Date(
        tracking=True, help="Last date on which a submission may be approved."
    )
    payment_cutoff = fields.Date(
        tracking=True, help="Last date on which a claim payment may be completed."
    )
    gl_cutoff = fields.Date(
        tracking=True, help="Last date on which an expense journal entry may be created."
    )
    state = fields.Selection(
        [("future", "Future"), ("open", "Open"), ("closed", "Closed")],
        default="future", required=True, tracking=True, index=True,
    )
    closed_by_id = fields.Many2one("res.users", readonly=True, copy=False)
    closed_date = fields.Datetime(readonly=True, copy=False)
    reopen_reason = fields.Text(readonly=True, copy=False)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )

    _sql_constraints = [
        ("expense_period_code_company_uniq", "unique(code, company_id)", "Period code must be unique per company."),
        ("expense_period_dates", "check(date_start <= date_end)", "Period start must not be after its end."),
    ]

    @api.constrains("date_start", "date_end", "company_id")
    def _check_overlap(self):
        for period in self:
            if self.search_count([
                ("id", "!=", period.id),
                ("company_id", "=", period.company_id.id),
                ("date_start", "<=", period.date_end),
                ("date_end", ">=", period.date_start),
            ]):
                raise ValidationError("Expense periods cannot overlap within a company.")

    @api.constrains("submission_cutoff", "approval_cutoff", "payment_cutoff", "gl_cutoff")
    def _check_cutoffs(self):
        for period in self:
            for cutoff in (
                period.submission_cutoff,
                period.approval_cutoff,
                period.payment_cutoff,
                period.gl_cutoff,
            ):
                if cutoff and not (period.date_start <= cutoff <= period.date_end):
                    raise ValidationError("Every cutoff must fall inside the expense period.")

    def _check_finance(self):
        return self._expense_check_role(
            "finance", "admin", message=_("Only Finance can manage expense periods.")
        )

    def action_open(self):
        self._check_finance()
        for period in self:
            if period.state != "future":
                raise UserError("Only future periods can be opened.")
            period.write({"state": "open", "reopen_reason": False})
        return True

    def action_close(self):
        self._check_finance()
        for period in self:
            if period.state != "open":
                raise UserError("Only open periods can be closed.")
            period.write({
                "state": "closed",
                "closed_by_id": self.env.user.id,
                "closed_date": fields.Datetime.now(),
            })
        return True

    def action_reopen(self, reason):
        if not self._expense_has_role("admin"):
            raise AccessError("Only an Expense Administrator can reopen a period.")
        if not reason or not reason.strip():
            raise ValidationError("A reopen reason is required.")
        for period in self:
            if period.state != "closed":
                raise UserError("Only closed periods can be reopened.")
            period.write({"state": "open", "reopen_reason": reason.strip()})
            period.message_post(body=_("Period reopened: %s") % reason.strip())
        return True

    @api.model
    def _ensure_date_open(self, target_date, operation):
        """Validate a cutoff only when periods have been configured for the date.

        This keeps existing companies operational until Finance opts into period
        controls, while making every configured period authoritative.
        """
        target_date = fields.Date.to_date(target_date)
        period = self.sudo().search([
            ("company_id", "=", self.env.company.id),
            ("date_start", "<=", target_date),
            ("date_end", ">=", target_date),
        ], limit=1)
        if not period:
            return True
        if period.state != "open":
            raise UserError(_("The expense period %s is not open.") % period.display_name)
        cutoff_field = {
            "submission": "submission_cutoff",
            "approval": "approval_cutoff",
            "payment": "payment_cutoff",
            "gl": "gl_cutoff",
        }.get(operation)
        cutoff = period[cutoff_field] if cutoff_field else False
        if cutoff and target_date > cutoff:
            raise UserError(_("The %s cutoff for %s has passed.") % (operation, period.display_name))
        return True


class HrExpenseBudget(models.Model):
    _name = "hr.expense.budget"
    _description = "Expense Budget"
    _inherit = ["mail.thread", "mail.activity.mixin", "hr.expense.security.mixin"]
    _order = "period_id desc, department_id, id"
    _check_company_auto = True

    name = fields.Char(required=True, tracking=True)
    code = fields.Char(required=True, tracking=True)
    period_id = fields.Many2one("hr.expense.period", required=True, check_company=True, tracking=True)
    department_id = fields.Many2one("hr.department", required=True, check_company=True, tracking=True)
    cost_center = fields.Char()
    line_ids = fields.One2many("hr.expense.budget.line", "budget_id", copy=True)
    total_approved = fields.Monetary(compute="_compute_totals", store=True, currency_field="currency_id")
    total_forecast = fields.Monetary(compute="_compute_totals", store=True, currency_field="currency_id")
    total_committed = fields.Monetary(compute="_compute_totals", store=True, currency_field="currency_id")
    total_actual = fields.Monetary(compute="_compute_totals", store=True, currency_field="currency_id")
    total_available = fields.Monetary(compute="_compute_totals", store=True, currency_field="currency_id")
    utilization = fields.Float(compute="_compute_totals", store=True)
    state = fields.Selection(
        [("draft", "Draft"), ("approved", "Approved"), ("active", "Active"), ("closed", "Closed")],
        default="draft", required=True, tracking=True, index=True,
    )
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    currency_id = fields.Many2one(related="company_id.currency_id", store=True)

    _sql_constraints = [
        ("expense_budget_code_company_uniq", "unique(code, company_id)", "Budget code must be unique per company."),
        ("expense_budget_period_department_uniq", "unique(period_id, department_id)", "A department can have only one budget per period."),
    ]

    @api.depends(
        "line_ids.approved_amount", "line_ids.forecast_amount",
        "line_ids.committed_amount", "line_ids.actual_amount",
    )
    def _compute_totals(self):
        for budget in self:
            budget.total_approved = sum(budget.line_ids.mapped("approved_amount"))
            budget.total_forecast = sum(budget.line_ids.mapped("forecast_amount"))
            budget.total_committed = sum(budget.line_ids.mapped("committed_amount"))
            budget.total_actual = sum(budget.line_ids.mapped("actual_amount"))
            budget.total_available = budget.total_approved - budget.total_committed - budget.total_actual
            budget.utilization = (
                ((budget.total_committed + budget.total_actual) / budget.total_approved) * 100
                if budget.total_approved else 0.0
            )

    def _check_finance(self):
        return self._expense_check_role(
            "finance", "admin", message=_("Only Finance can manage budgets.")
        )

    def action_approve(self):
        self._check_finance()
        for budget in self:
            if budget.state != "draft" or not budget.line_ids:
                raise UserError("A draft budget must have at least one line before approval.")
            budget.write({"state": "approved"})
        return True

    def action_activate(self):
        self._check_finance()
        for budget in self:
            if budget.state != "approved" or budget.period_id.state != "open":
                raise UserError("Only approved budgets in an open period can be activated.")
            budget.write({"state": "active"})
        return True

    def action_close(self):
        self._check_finance()
        for budget in self:
            if budget.state != "active":
                raise UserError("Only active budgets can be closed.")
            budget.write({"state": "closed"})
        return True


class HrExpenseBudgetLine(models.Model):
    _name = "hr.expense.budget.line"
    _description = "Expense Budget Line"
    _order = "budget_id, category_id, account_id, id"
    _check_company_auto = True

    budget_id = fields.Many2one(
        "hr.expense.budget", required=True, ondelete="cascade", check_company=True, index=True
    )
    company_id = fields.Many2one(related="budget_id.company_id", store=True, index=True)
    currency_id = fields.Many2one(related="budget_id.currency_id", store=True)
    department_id = fields.Many2one(related="budget_id.department_id", store=True, index=True)
    period_id = fields.Many2one(related="budget_id.period_id", store=True, index=True)
    category_id = fields.Many2one("hr.claim.category", check_company=True)
    account_id = fields.Many2one(
        "account.account",
        check_company=True,
        domain="[('company_id', '=', company_id), ('deprecated', '=', False)]",
    )
    approved_amount = fields.Monetary(required=True, currency_field="currency_id")
    forecast_amount = fields.Monetary(currency_field="currency_id")
    committed_amount = fields.Monetary(compute="_compute_exposure", currency_field="currency_id")
    actual_amount = fields.Monetary(compute="_compute_exposure", currency_field="currency_id")
    available_amount = fields.Monetary(compute="_compute_exposure", currency_field="currency_id")
    utilization = fields.Float(compute="_compute_exposure")
    warning_threshold = fields.Float(default=80.0)
    status = fields.Selection(
        [("under", "Under Budget"), ("track", "On Track"), ("risk", "At Risk"), ("over", "Over Budget")],
        compute="_compute_exposure",
    )
    request_ids = fields.One2many("hr.expense.request", "budget_line_id")
    claim_ids = fields.One2many("hr.claim", "budget_line_id")
    petty_transaction_ids = fields.One2many("hr.petty.cash.transaction", "budget_line_id")

    _sql_constraints = [
        ("expense_budget_line_approved_non_negative", "check(approved_amount >= 0)", "Approved budget cannot be negative."),
        ("expense_budget_line_forecast_non_negative", "check(forecast_amount >= 0)", "Forecast cannot be negative."),
        ("expense_budget_line_threshold", "check(warning_threshold >= 0 AND warning_threshold <= 100)", "Warning threshold must be from 0 to 100."),
    ]

    @api.depends(
        "approved_amount",
        "request_ids.amount", "request_ids.state",
        "claim_ids.amount_total", "claim_ids.state",
        "petty_transaction_ids.amount", "petty_transaction_ids.state", "petty_transaction_ids.transaction_type",
        "warning_threshold",
    )
    def _compute_exposure(self):
        for line in self:
            line.committed_amount = sum(
                line.request_ids.filtered(lambda item: item.state in ("approved", "fulfilled")).mapped("amount")
            )
            line.actual_amount = sum(
                line.claim_ids.filtered(lambda item: item.state in ("approved", "paid")).mapped("amount_total")
            ) + sum(
                line.petty_transaction_ids.filtered(
                    lambda item: item.state == "posted" and item.transaction_type == "expense"
                ).mapped("amount")
            )
            line.available_amount = line.approved_amount - line.committed_amount - line.actual_amount
            exposure = line.committed_amount + line.actual_amount
            line.utilization = (exposure / line.approved_amount * 100) if line.approved_amount else 0.0
            if line.utilization > 100:
                line.status = "over"
            elif line.utilization >= line.warning_threshold:
                line.status = "risk"
            elif line.utilization >= 60:
                line.status = "track"
            else:
                line.status = "under"

    @api.constrains("category_id", "account_id")
    def _check_dimension(self):
        if any(not line.category_id and not line.account_id for line in self):
            raise ValidationError("A budget line requires a claim category or GL account.")


class HrExpenseRequestBudget(models.Model):
    _inherit = "hr.expense.request"

    budget_line_id = fields.Many2one(
        "hr.expense.budget.line", check_company=True,
        domain="[('company_id', '=', company_id), ('department_id', '=', department_id), ('budget_id.state', '=', 'active')]",
    )


class HrClaimBudget(models.Model):
    _inherit = "hr.claim"

    budget_line_id = fields.Many2one(
        "hr.expense.budget.line", check_company=True,
        domain="[('company_id', '=', company_id), ('department_id', '=', department_id), ('budget_id.state', '=', 'active')]",
    )


class HrPettyCashTransactionBudget(models.Model):
    _inherit = "hr.petty.cash.transaction"

    budget_line_id = fields.Many2one(
        "hr.expense.budget.line", check_company=True,
        domain="[('company_id', '=', company_id), ('budget_id.state', '=', 'active')]",
    )
