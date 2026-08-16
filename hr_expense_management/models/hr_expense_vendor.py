from odoo import api, fields, models
from odoo.exceptions import ValidationError


class HrExpenseVendorCategory(models.Model):
    """Represent expense vendor category records in the expense workflow."""

    _name = "hr.expense.vendor.category"
    _description = "Expense Vendor Category"
    _order = "sequence, name"
    _check_company_auto = True

    name = fields.Char(required=True, translate=True)
    code = fields.Char(required=True)
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    tax_rate = fields.Float()
    default_expense_account_id = fields.Many2one(
        "account.account", check_company=True,
        domain="[('company_id', '=', company_id), ('account_type', 'in', ('expense', 'expense_depreciation', 'expense_direct_cost')), ('deprecated', '=', False)]",
    )
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )

    _sql_constraints = [
        ("expense_vendor_category_code_company_uniq", "unique(code, company_id)", "Vendor category code must be unique per company."),
        ("expense_vendor_category_tax_range", "check(tax_rate >= 0 AND tax_rate <= 100)", "Tax rate must be from 0 to 100."),
    ]


class HrExpensePaymentTerm(models.Model):
    """Represent expense vendor payment term records in the expense workflow."""

    _name = "hr.expense.payment.term"
    _description = "Expense Vendor Payment Term"
    _order = "due_days, name"
    _check_company_auto = True

    name = fields.Char(required=True, translate=True)
    code = fields.Char(required=True)
    due_days = fields.Integer(default=30, required=True)
    early_discount_percent = fields.Float()
    early_discount_days = fields.Integer()
    active = fields.Boolean(default=True)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )

    _sql_constraints = [
        ("expense_payment_term_code_company_uniq", "unique(code, company_id)", "Payment-term code must be unique per company."),
        ("expense_payment_term_due_non_negative", "check(due_days >= 0)", "Due days cannot be negative."),
        ("expense_payment_term_discount_range", "check(early_discount_percent >= 0 AND early_discount_percent <= 100)", "Discount must be from 0 to 100."),
        ("expense_payment_term_discount_days_non_negative", "check(early_discount_days >= 0)", "Discount days cannot be negative."),
    ]


class ResPartnerExpenseVendor(models.Model):
    """Add controlled expense-vendor details to contacts."""

    _inherit = "res.partner"

    is_expense_vendor = fields.Boolean(
        string="Expense Vendor", index=True,
        groups="hr_expense_management.group_hr_expense_finance,hr_expense_management.group_hr_expense_admin",
    )
    expense_vendor_code = fields.Char(
        copy=False, index=True,
        groups="hr_expense_management.group_hr_expense_finance,hr_expense_management.group_hr_expense_admin",
    )
    expense_vendor_category_id = fields.Many2one(
        "hr.expense.vendor.category", check_company=True,
        domain="[('company_id', 'in', [company_id, False]), ('active', '=', True)]",
        groups="hr_expense_management.group_hr_expense_finance,hr_expense_management.group_hr_expense_admin",
    )
    expense_payment_term_id = fields.Many2one(
        "hr.expense.payment.term", check_company=True,
        domain="[('company_id', 'in', [company_id, False]), ('active', '=', True)]",
        groups="hr_expense_management.group_hr_expense_finance,hr_expense_management.group_hr_expense_admin",
    )
    expense_rating = fields.Integer(
        default=3,
        groups="hr_expense_management.group_hr_expense_finance,hr_expense_management.group_hr_expense_admin",
    )
    default_expense_account_id = fields.Many2one(
        "account.account", check_company=True,
        domain="[('company_id', '=', company_id), ('account_type', 'in', ('expense', 'expense_depreciation', 'expense_direct_cost')), ('deprecated', '=', False)]",
        groups="hr_expense_management.group_hr_expense_finance,hr_expense_management.group_hr_expense_admin",
    )
    expense_tax_identifier = fields.Char(
        groups="hr_expense_management.group_hr_expense_finance,hr_expense_management.group_hr_expense_admin"
    )
    expense_vendor_active = fields.Boolean(
        default=True,
        groups="hr_expense_management.group_hr_expense_finance,hr_expense_management.group_hr_expense_admin",
    )
    expense_claim_line_ids = fields.One2many(
        "hr.claim.line", "vendor_id",
        groups="hr_expense_management.group_hr_expense_finance,hr_expense_management.group_hr_expense_admin",
    )
    expense_claim_count = fields.Integer(
        compute="_compute_expense_vendor_metrics",
        groups="hr_expense_management.group_hr_expense_finance,hr_expense_management.group_hr_expense_admin",
    )
    expense_claim_value = fields.Monetary(
        compute="_compute_expense_vendor_metrics", currency_field="expense_currency_id",
        groups="hr_expense_management.group_hr_expense_finance,hr_expense_management.group_hr_expense_admin",
    )
    expense_currency_id = fields.Many2one(
        related="company_id.currency_id", readonly=True, string="Expense Currency",
        groups="hr_expense_management.group_hr_expense_finance,hr_expense_management.group_hr_expense_admin",
    )

    @api.depends("expense_claim_line_ids.amount", "expense_claim_line_ids.claim_id.state")
    def _compute_expense_vendor_metrics(self):
        for partner in self:
            lines = partner.expense_claim_line_ids.filtered(
                lambda line: line.claim_id.state in ("approved", "paid")
            )
            partner.expense_claim_count = len(lines.mapped("claim_id"))
            partner.expense_claim_value = sum(lines.mapped("amount"))

    @api.constrains("expense_rating")
    def _check_expense_rating(self):
        if any(partner.expense_rating < 1 or partner.expense_rating > 5 for partner in self if partner.is_expense_vendor):
            raise ValidationError("Expense vendor rating must be from 1 to 5.")

    @api.constrains("expense_vendor_code", "company_id", "is_expense_vendor")
    def _check_expense_vendor_code_unique(self):
        for partner in self.filtered(lambda item: item.is_expense_vendor and item.expense_vendor_code):
            if self.search_count([
                ("id", "!=", partner.id),
                ("is_expense_vendor", "=", True),
                ("expense_vendor_code", "=ilike", partner.expense_vendor_code),
                ("company_id", "=", partner.company_id.id),
            ]):
                raise ValidationError("Expense vendor code must be unique per company.")


class HrClaimLineVendor(models.Model):
    """Associate claim lines with approved expense vendors."""

    _inherit = "hr.claim.line"

    vendor_id = fields.Many2one(
        "res.partner", ondelete="restrict",
        domain="[('is_expense_vendor', '=', True), ('expense_vendor_active', '=', True)]",
    )


class HrPettyCashTransactionVendor(models.Model):
    """Associate petty-cash spend with approved expense vendors."""

    _inherit = "hr.petty.cash.transaction"

    vendor_id = fields.Many2one(
        "res.partner", ondelete="restrict",
        domain="[('is_expense_vendor', '=', True), ('expense_vendor_active', '=', True)]",
    )
