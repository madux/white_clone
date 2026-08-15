from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.tools.float_utils import float_compare


class HrExpenseAccount(models.Model):
    _name = "hr.expense.account"
    _description = "Expense Subledger Account"
    _order = "code, id"
    _parent_store = True
    _check_company_auto = True

    name = fields.Char(required=True, translate=True)
    code = fields.Char(required=True, index=True)
    account_type = fields.Selection(
        [
            ("asset", "Asset"),
            ("liability", "Liability"),
            ("equity", "Equity"),
            ("revenue", "Revenue"),
            ("expense", "Expense"),
        ],
        required=True,
        index=True,
    )
    subtype = fields.Char()
    parent_id = fields.Many2one(
        "hr.expense.account", ondelete="restrict", check_company=True, index=True
    )
    parent_path = fields.Char(index=True, unaccent=False)
    child_ids = fields.One2many("hr.expense.account", "parent_id")
    is_header = fields.Boolean(string="Header Account")
    active = fields.Boolean(default=True)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    currency_id = fields.Many2one(related="company_id.currency_id", store=True)
    debit = fields.Monetary(compute="_compute_balance", currency_field="currency_id")
    credit = fields.Monetary(compute="_compute_balance", currency_field="currency_id")
    balance = fields.Monetary(compute="_compute_balance", currency_field="currency_id")

    _sql_constraints = [
        (
            "expense_account_code_company_uniq",
            "unique(code, company_id)",
            "Account code must be unique per company.",
        ),
    ]

    @api.depends_context("allowed_company_ids")
    def _compute_balance(self):
        totals = {}
        if self.ids:
            grouped = self.env["hr.expense.journal.line"].read_group(
                [("account_id", "in", self.ids), ("journal_id.state", "=", "posted")],
                ["debit:sum", "credit:sum"],
                ["account_id"],
            )
            totals = {
                row["account_id"][0]: (row.get("debit", 0.0), row.get("credit", 0.0))
                for row in grouped
            }
        for account in self:
            account.debit, account.credit = totals.get(account.id, (0.0, 0.0))
            account.balance = account.debit - account.credit

    @api.constrains("parent_id")
    def _check_parent_company(self):
        if any(account.parent_id.company_id != account.company_id for account in self if account.parent_id):
            raise ValidationError("A parent account must belong to the same company.")

    def unlink(self):
        if self.env["hr.expense.journal.line"].search_count([("account_id", "in", self.ids)]):
            raise UserError("Accounts with journal activity cannot be deleted; archive them instead.")
        return super().unlink()


class HrExpenseGlMap(models.Model):
    _name = "hr.expense.gl.map"
    _description = "Expense GL Mapping"
    _order = "source_type, sequence, id"
    _check_company_auto = True

    name = fields.Char(required=True)
    sequence = fields.Integer(default=10)
    source_type = fields.Selection(
        [
            ("claim", "Claim"),
            ("payment", "Claim Payment"),
            ("advance", "Cash Advance"),
            ("petty_cash", "Petty Cash"),
            ("vendor", "Vendor Expense"),
        ],
        required=True,
        index=True,
    )
    claim_category_id = fields.Many2one("hr.claim.category", check_company=True)
    debit_account_id = fields.Many2one(
        "hr.expense.account", required=True, check_company=True,
        domain="[('company_id', '=', company_id), ('is_header', '=', False)]",
    )
    credit_account_id = fields.Many2one(
        "hr.expense.account", required=True, check_company=True,
        domain="[('company_id', '=', company_id), ('is_header', '=', False)]",
    )
    active = fields.Boolean(default=True)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )

    @api.constrains("debit_account_id", "credit_account_id")
    def _check_accounts(self):
        for mapping in self:
            if mapping.debit_account_id == mapping.credit_account_id:
                raise ValidationError("Debit and credit accounts must be different.")
            if mapping.debit_account_id.is_header or mapping.credit_account_id.is_header:
                raise ValidationError("GL mappings must use posting accounts.")


class HrExpenseJournal(models.Model):
    _name = "hr.expense.journal"
    _description = "Expense Subledger Journal"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "date desc, id desc"
    _check_company_auto = True

    name = fields.Char(default="New", readonly=True, copy=False, index=True)
    date = fields.Date(default=fields.Date.context_today, required=True, tracking=True)
    description = fields.Char(required=True, tracking=True)
    source_model = fields.Char(readonly=True, copy=False, index=True)
    source_id = fields.Integer(readonly=True, copy=False, index=True)
    source_reference = fields.Char(readonly=True, copy=False, index=True)
    line_ids = fields.One2many(
        "hr.expense.journal.line", "journal_id", string="Journal Lines", copy=True
    )
    total_debit = fields.Monetary(
        compute="_compute_totals", store=True, currency_field="currency_id"
    )
    total_credit = fields.Monetary(
        compute="_compute_totals", store=True, currency_field="currency_id"
    )
    balanced = fields.Boolean(compute="_compute_totals", store=True)
    state = fields.Selection(
        [("draft", "Draft"), ("posted", "Posted"), ("cancelled", "Cancelled")],
        default="draft", required=True, tracking=True, copy=False, index=True,
    )
    posted_by_id = fields.Many2one("res.users", readonly=True, copy=False)
    posted_date = fields.Datetime(readonly=True, copy=False)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    currency_id = fields.Many2one(related="company_id.currency_id", store=True)

    _sql_constraints = [
        ("expense_journal_name_uniq", "unique(name)", "Journal reference must be unique."),
    ]

    @api.depends("line_ids.debit", "line_ids.credit")
    def _compute_totals(self):
        for journal in self:
            journal.total_debit = sum(journal.line_ids.mapped("debit"))
            journal.total_credit = sum(journal.line_ids.mapped("credit"))
            journal.balanced = bool(journal.line_ids) and not float_compare(
                journal.total_debit,
                journal.total_credit,
                precision_rounding=journal.currency_id.rounding,
            )

    @api.model_create_multi
    def create(self, vals_list):
        self._check_finance()
        for vals in vals_list:
            if vals.get("name", "New") == "New":
                vals["name"] = self.env["ir.sequence"].next_by_code("hr.expense.journal") or "New"
        return super().create(vals_list)

    def _check_finance(self):
        if self.env.su:
            return
        if not (
            self.env.user.has_group("hr_expense_management.group_hr_expense_finance")
            or self.env.user.has_group("hr_expense_management.group_hr_expense_admin")
        ):
            raise AccessError("Only Finance can manage expense journals.")

    def write(self, vals):
        protected = {"state", "posted_by_id", "posted_date"}
        if protected.intersection(vals) and not self.env.context.get("expense_journal_workflow"):
            self._check_finance()
            raise AccessError("Use the journal workflow actions to change posting status.")
        if any(journal.state != "draft" for journal in self) and not self.env.context.get("expense_journal_workflow"):
            raise UserError("Posted or cancelled journals cannot be edited.")
        return super().write(vals)

    def unlink(self):
        if any(journal.state != "draft" for journal in self):
            raise UserError("Only draft journals can be deleted.")
        return super().unlink()

    def action_post(self):
        self._check_finance()
        for journal in self:
            if journal.state != "draft":
                raise UserError("Only draft journals can be posted.")
            if not journal.line_ids or not journal.balanced or journal.currency_id.is_zero(journal.total_debit):
                raise ValidationError("A posted journal must contain non-zero balanced lines.")
            if any(line.account_id.is_header for line in journal.line_ids):
                raise ValidationError("Header accounts cannot receive journal postings.")
            self.env["hr.expense.period"]._ensure_date_open(journal.date, "gl")
            journal.with_context(expense_journal_workflow=True).write({
                "state": "posted",
                "posted_by_id": self.env.user.id,
                "posted_date": fields.Datetime.now(),
            })
        return True

    def action_cancel(self):
        self._check_finance()
        for journal in self:
            if journal.state != "draft":
                raise UserError("Only draft journals can be cancelled.")
            journal.with_context(expense_journal_workflow=True).write({"state": "cancelled"})
        return True

    @api.model
    def create_from_mapping(self, source, source_type, amount, description=None, auto_post=False):
        if not amount or amount <= 0:
            raise ValidationError("The journal amount must be positive.")
        domain = [
            ("source_type", "=", source_type),
            ("active", "=", True),
            ("company_id", "=", source.company_id.id),
        ]
        category = getattr(source, "category_id", False)
        if not category and getattr(source, "claim_type_id", False):
            category = source.claim_type_id.category_id
        if not category and getattr(source, "claim_id", False):
            category = source.claim_id.claim_type_id.category_id
        if category:
            domain = ["|", ("claim_category_id", "=", category.id), ("claim_category_id", "=", False)] + domain
        else:
            domain.append(("claim_category_id", "=", False))
        mapping = self.env["hr.expense.gl.map"].search(domain, order="claim_category_id desc, sequence, id", limit=1)
        if not mapping:
            raise UserError(_("No active GL mapping is configured for %s.") % source_type)
        journal = self.create({
            "date": fields.Date.context_today(source),
            "description": description or source.display_name,
            "source_model": source._name,
            "source_id": source.id,
            "source_reference": source.display_name,
            "company_id": source.company_id.id,
            "line_ids": [
                (0, 0, {"account_id": mapping.debit_account_id.id, "debit": amount}),
                (0, 0, {"account_id": mapping.credit_account_id.id, "credit": amount}),
            ],
        })
        if auto_post:
            journal.action_post()
        return journal

    @api.model
    def create_if_configured(self, source, source_type, amount, description=None, auto_post=False):
        domain = [
            ("source_type", "=", source_type),
            ("company_id", "=", source.company_id.id),
            ("active", "=", True),
        ]
        category = getattr(source, "category_id", False)
        if not category and getattr(source, "claim_type_id", False):
            category = source.claim_type_id.category_id
        if not category and getattr(source, "claim_id", False):
            category = source.claim_id.claim_type_id.category_id
        if category:
            domain = ["|", ("claim_category_id", "=", category.id), ("claim_category_id", "=", False)] + domain
        else:
            domain.append(("claim_category_id", "=", False))
        if not self.env["hr.expense.gl.map"].sudo().search_count(domain):
            return self.browse()
        return self.sudo().create_from_mapping(
            source, source_type, amount, description=description, auto_post=auto_post
        )


class HrExpenseJournalLine(models.Model):
    _name = "hr.expense.journal.line"
    _description = "Expense Subledger Journal Line"
    _order = "journal_id, id"
    _check_company_auto = True

    journal_id = fields.Many2one(
        "hr.expense.journal", required=True, ondelete="cascade", check_company=True, index=True
    )
    company_id = fields.Many2one(related="journal_id.company_id", store=True, index=True)
    currency_id = fields.Many2one(related="journal_id.currency_id", store=True)
    account_id = fields.Many2one(
        "hr.expense.account", required=True, ondelete="restrict", check_company=True,
        domain="[('company_id', '=', company_id), ('is_header', '=', False)]",
    )
    label = fields.Char()
    debit = fields.Monetary(currency_field="currency_id")
    credit = fields.Monetary(currency_field="currency_id")
    department_id = fields.Many2one("hr.department", check_company=True)
    employee_id = fields.Many2one("hr.employee", check_company=True)
    vendor_id = fields.Many2one("res.partner")

    _sql_constraints = [
        (
            "expense_journal_line_non_negative",
            "check(debit >= 0 AND credit >= 0)",
            "Debit and credit cannot be negative.",
        ),
        (
            "expense_journal_line_one_side",
            "check((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))",
            "A journal line must contain either a debit or a credit.",
        ),
    ]

    @api.constrains("account_id")
    def _check_posting_account(self):
        if any(line.account_id.is_header for line in self):
            raise ValidationError("Header accounts cannot receive journal postings.")

    @api.model_create_multi
    def create(self, vals_list):
        journals = self.env["hr.expense.journal"].browse(
            [vals.get("journal_id") for vals in vals_list if vals.get("journal_id")]
        )
        if any(journal.state != "draft" for journal in journals):
            raise UserError("Lines can only be added to draft journals.")
        return super().create(vals_list)

    def write(self, vals):
        if any(line.journal_id.state != "draft" for line in self):
            raise UserError("Posted journal lines cannot be changed.")
        return super().write(vals)

    def unlink(self):
        if any(line.journal_id.state != "draft" for line in self):
            raise UserError("Posted journal lines cannot be removed.")
        return super().unlink()


class HrClaimExpenseJournal(models.Model):
    _inherit = "hr.claim"

    expense_journal_id = fields.Many2one(
        "hr.expense.journal", readonly=True, copy=False, check_company=True
    )

    def action_approve(self, comment=None):
        result = super().action_approve(comment)
        for claim in self.filtered(lambda item: item.state == "approved" and not item.expense_journal_id):
            journal = self.env["hr.expense.journal"].create_if_configured(
                claim, "claim", claim.amount_total,
                description=_("Approved expense claim %s") % claim.name,
            )
            if journal:
                claim.sudo().write({"expense_journal_id": journal.id})
        return result


class HrClaimPaymentExpenseJournal(models.Model):
    _inherit = "hr.claim.payment"

    expense_journal_id = fields.Many2one(
        "hr.expense.journal", readonly=True, copy=False, check_company=True
    )

    def action_confirm(self):
        result = super().action_confirm()
        for payment in self.filtered(lambda item: item.state == "completed" and not item.expense_journal_id):
            journal = self.env["hr.expense.journal"].create_if_configured(
                payment, "payment", payment.amount,
                description=_("Expense payment %s") % payment.name,
                auto_post=True,
            )
            if journal:
                payment.sudo().write({"expense_journal_id": journal.id})
        return result


class HrCashAdvanceExpenseJournal(models.Model):
    _inherit = "hr.cash.advance"

    expense_journal_id = fields.Many2one(
        "hr.expense.journal", readonly=True, copy=False, check_company=True
    )


class HrExpenseRequestAdvanceJournal(models.Model):
    _inherit = "hr.expense.request"

    def action_issue_advance(self):
        advance = super().action_issue_advance()
        if advance and not advance.expense_journal_id:
            journal = self.env["hr.expense.journal"].create_if_configured(
                advance, "advance", advance.issued_amount,
                description=_("Cash advance %s") % advance.name,
                auto_post=True,
            )
            if journal:
                advance.sudo().write({"expense_journal_id": journal.id})
        return advance


class HrPettyCashExpenseJournal(models.Model):
    _inherit = "hr.petty.cash.transaction"

    expense_journal_id = fields.Many2one(
        "hr.expense.journal", readonly=True, copy=False, check_company=True
    )

    def action_approve(self):
        result = super().action_approve()
        for transaction in self.filtered(
            lambda item: item.state == "posted" and item.transaction_type == "expense" and not item.expense_journal_id
        ):
            journal = self.env["hr.expense.journal"].create_if_configured(
                transaction, "petty_cash", transaction.amount,
                description=_("Petty cash expense %s") % transaction.name,
                auto_post=True,
            )
            if journal:
                transaction.sudo().write({"expense_journal_id": journal.id})
        return result
