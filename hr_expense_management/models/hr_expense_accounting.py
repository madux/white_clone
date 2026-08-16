from odoo import _, api, fields, models
from odoo.exceptions import UserError, ValidationError


class HrExpenseGlMap(models.Model):
    """Map expense events to Odoo Community Accounting configuration."""

    _name = "hr.expense.gl.map"
    _description = "Expense Accounting Mapping"
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
    journal_id = fields.Many2one(
        "account.journal",
        string="Odoo Journal",
        check_company=True,
        domain="[('company_id', '=', company_id), ('type', '=', 'general')]",
    )
    debit_account_id = fields.Many2one(
        "account.account",
        required=True,
        check_company=True,
        domain="[('company_id', '=', company_id), ('deprecated', '=', False), ('account_type', '!=', 'off_balance')]",
    )
    credit_account_id = fields.Many2one(
        "account.account",
        required=True,
        check_company=True,
        domain="[('company_id', '=', company_id), ('deprecated', '=', False), ('account_type', '!=', 'off_balance')]",
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
            if "off_balance" in (
                mapping.debit_account_id.account_type,
                mapping.credit_account_id.account_type,
            ):
                raise ValidationError("Expense mappings cannot use off-balance accounts.")

    @api.model
    def _mapping_domain(self, source, source_type):
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
            return [
                "|",
                ("claim_category_id", "=", category.id),
                ("claim_category_id", "=", False),
            ] + domain
        return domain + [("claim_category_id", "=", False)]

    @api.model
    def _default_journal(self, company):
        return self.env["account.journal"].sudo().with_company(company).search(
            [("company_id", "=", company.id), ("type", "=", "general")],
            order="sequence, id",
            limit=1,
        )

    @api.model
    def create_move_from_mapping(
        self, source, source_type, amount, description=None, auto_post=False
    ):
        if not amount or amount <= 0:
            raise ValidationError("The accounting-entry amount must be positive.")
        mapping = self.sudo().search(
            self._mapping_domain(source, source_type),
            order="claim_category_id desc, sequence, id",
            limit=1,
        )
        if not mapping:
            raise UserError(_("No active accounting mapping is configured for %s.") % source_type)
        journal = mapping.journal_id or self._default_journal(source.company_id)
        if not journal:
            raise UserError(
                _("Configure a miscellaneous Odoo accounting journal before posting expenses.")
            )
        entry_date = fields.Date.context_today(source)
        self.env["hr.expense.period"]._ensure_date_open(entry_date, "gl")
        partner = getattr(source, "vendor_id", False)
        label = description or source.display_name
        move = self.env["account.move"].sudo().with_company(source.company_id).create({
            "move_type": "entry",
            "journal_id": journal.id,
            "date": entry_date,
            "ref": label,
            "expense_source_model": source._name,
            "expense_source_id": source.id,
            "expense_source_reference": source.display_name,
            "line_ids": [
                (0, 0, {
                    "name": label,
                    "account_id": mapping.debit_account_id.id,
                    "partner_id": partner.id if partner else False,
                    "debit": amount,
                    "credit": 0.0,
                }),
                (0, 0, {
                    "name": label,
                    "account_id": mapping.credit_account_id.id,
                    "partner_id": partner.id if partner else False,
                    "debit": 0.0,
                    "credit": amount,
                }),
            ],
        })
        if auto_post:
            move.action_post()
        return move

    @api.model
    def create_move_if_configured(
        self, source, source_type, amount, description=None, auto_post=False
    ):
        if not self.sudo().search_count(self._mapping_domain(source, source_type)):
            return self.env["account.move"]
        return self.create_move_from_mapping(
            source,
            source_type,
            amount,
            description=description,
            auto_post=auto_post,
        )


class AccountMoveExpenseSource(models.Model):
    _inherit = "account.move"

    expense_source_model = fields.Char(readonly=True, copy=False, index=True)
    expense_source_id = fields.Integer(readonly=True, copy=False, index=True)
    expense_source_reference = fields.Char(readonly=True, copy=False, index=True)


class HrClaimExpenseMove(models.Model):
    _inherit = "hr.claim"

    expense_move_id = fields.Many2one(
        "account.move", string="Accounting Entry", readonly=True, copy=False, check_company=True
    )

    def action_approve(self, comment=None):
        result = super().action_approve(comment)
        for claim in self.filtered(lambda item: item.state == "approved" and not item.expense_move_id):
            move = self.env["hr.expense.gl.map"].create_move_if_configured(
                claim,
                "claim",
                claim.amount_total,
                description=_("Approved expense claim %s") % claim.name,
            )
            if move:
                claim.sudo().write({"expense_move_id": move.id})
        return result


class HrClaimPaymentExpenseMove(models.Model):
    _inherit = "hr.claim.payment"

    expense_move_id = fields.Many2one(
        "account.move", string="Accounting Entry", readonly=True, copy=False, check_company=True
    )

    def action_confirm(self):
        result = super().action_confirm()
        for payment in self.filtered(
            lambda item: item.state == "completed" and not item.expense_move_id
        ):
            move = self.env["hr.expense.gl.map"].create_move_if_configured(
                payment,
                "payment",
                payment.amount,
                description=_("Expense payment %s") % payment.name,
                auto_post=True,
            )
            if move:
                payment.sudo().write({"expense_move_id": move.id})
        return result


class HrCashAdvanceExpenseMove(models.Model):
    _inherit = "hr.cash.advance"

    expense_move_id = fields.Many2one(
        "account.move", string="Accounting Entry", readonly=True, copy=False, check_company=True
    )


class HrExpenseRequestAdvanceMove(models.Model):
    _inherit = "hr.expense.request"

    def action_issue_advance(self):
        advance = super().action_issue_advance()
        if advance and not advance.expense_move_id:
            move = self.env["hr.expense.gl.map"].create_move_if_configured(
                advance,
                "advance",
                advance.issued_amount,
                description=_("Cash advance %s") % advance.name,
                auto_post=True,
            )
            if move:
                advance.sudo().write({"expense_move_id": move.id})
        return advance


class HrPettyCashExpenseMove(models.Model):
    _inherit = "hr.petty.cash.transaction"

    expense_move_id = fields.Many2one(
        "account.move", string="Accounting Entry", readonly=True, copy=False, check_company=True
    )

    def action_approve(self):
        result = super().action_approve()
        for transaction in self.filtered(
            lambda item: item.state == "posted"
            and item.transaction_type == "expense"
            and not item.expense_move_id
        ):
            move = self.env["hr.expense.gl.map"].create_move_if_configured(
                transaction,
                "petty_cash",
                transaction.amount,
                description=_("Petty cash expense %s") % transaction.name,
                auto_post=True,
            )
            if move:
                transaction.sudo().write({"expense_move_id": move.id})
        return result
