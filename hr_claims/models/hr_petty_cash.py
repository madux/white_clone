from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError


class HrPettyCashFund(models.Model):
    _name = "hr.petty.cash.fund"
    _description = "Petty Cash Fund"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "name"
    _check_company_auto = True

    name = fields.Char(required=True, tracking=True)
    code = fields.Char(required=True, tracking=True)
    location = fields.Char(required=True)
    custodian_id = fields.Many2one("hr.employee", required=True, tracking=True, check_company=True)
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)
    currency_id = fields.Many2one(related="company_id.currency_id", store=True, readonly=True)
    maximum_amount = fields.Monetary(required=True, currency_field="currency_id", tracking=True)
    minimum_threshold = fields.Monetary(currency_field="currency_id", tracking=True)
    current_balance = fields.Monetary(compute="_compute_balance", store=True, currency_field="currency_id")
    active = fields.Boolean(default=True)
    last_reconciled_date = fields.Date(readonly=True)
    transaction_ids = fields.One2many("hr.petty.cash.transaction", "fund_id")

    _sql_constraints = [
        ("petty_cash_fund_code_company_uniq", "unique(code, company_id)", "Fund code must be unique per company."),
        ("petty_cash_fund_max_positive", "check(maximum_amount > 0)", "Maximum fund amount must be positive."),
    ]

    @api.depends("transaction_ids.amount", "transaction_ids.transaction_type", "transaction_ids.state")
    def _compute_balance(self):
        for fund in self:
            posted = fund.transaction_ids.filtered(lambda tx: tx.state == "posted")
            incoming = sum(posted.filtered(lambda tx: tx.transaction_type in ("opening", "replenishment", "positive_adjustment")).mapped("amount"))
            outgoing = sum(posted.filtered(lambda tx: tx.transaction_type in ("expense", "negative_adjustment", "closure")).mapped("amount"))
            fund.current_balance = incoming - outgoing


class HrPettyCashTransaction(models.Model):
    _name = "hr.petty.cash.transaction"
    _description = "Petty Cash Transaction"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "date desc, id desc"
    _check_company_auto = True

    name = fields.Char(default="New", readonly=True, copy=False, index=True)
    fund_id = fields.Many2one("hr.petty.cash.fund", required=True, check_company=True, index=True)
    company_id = fields.Many2one(related="fund_id.company_id", store=True, readonly=True, index=True)
    currency_id = fields.Many2one(related="fund_id.currency_id", store=True, readonly=True)
    transaction_type = fields.Selection(
        [("opening", "Opening Balance"), ("expense", "Expense"),
         ("replenishment", "Replenishment"), ("positive_adjustment", "Positive Adjustment"),
         ("negative_adjustment", "Negative Adjustment"), ("closure", "Closure")],
        default="expense", required=True, tracking=True,
    )
    date = fields.Date(default=fields.Date.context_today, required=True, tracking=True)
    payee = fields.Char(required=True, tracking=True)
    category = fields.Char(tracking=True)
    description = fields.Text()
    amount = fields.Monetary(required=True, currency_field="currency_id", tracking=True)
    receipt_attachment_id = fields.Many2one("ir.attachment")
    state = fields.Selection(
        [("draft", "Draft"), ("submitted", "Pending Approval"),
         ("approved", "Approved"), ("posted", "Posted"), ("rejected", "Rejected")],
        default="draft", required=True, tracking=True, copy=False, index=True,
    )
    approved_by_id = fields.Many2one("res.users", readonly=True)

    _sql_constraints = [
        ("petty_cash_tx_amount_positive", "check(amount > 0)", "Transaction amount must be positive."),
    ]

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("name", "New") == "New":
                vals["name"] = self.env["ir.sequence"].next_by_code("hr.petty.cash.transaction") or "New"
        records = super().create(vals_list)
        for record in records:
            record._check_custodian_or_finance()
        return records

    def _check_custodian_or_finance(self):
        for record in self:
            if not (record.fund_id.custodian_id.sudo().user_id == self.env.user or self.env.user.has_group("hr_claims.group_hr_claim_finance") or self.env.user.has_group("hr_claims.group_hr_claim_admin")):
                raise AccessError("Only the assigned custodian or Finance can manage this fund.")

    def write(self, vals):
        if {"state", "approved_by_id"}.intersection(vals) and not self.env.context.get("petty_workflow") and not (
            self.env.user.has_group("hr_claims.group_hr_claim_finance")
            or self.env.user.has_group("hr_claims.group_hr_claim_admin")
        ):
            raise AccessError("Use the petty cash workflow actions to change status.")
        return super().write(vals)

    def action_submit(self):
        self._check_custodian_or_finance()
        for tx in self:
            if tx.state != "draft": raise UserError("Only draft transactions can be submitted.")
            tx.with_context(petty_workflow=True).write({"state": "submitted"})
        return True

    def action_approve(self):
        if not (self.env.user.has_group("hr_claims.group_hr_claim_finance") or self.env.user.has_group("hr_claims.group_hr_claim_admin")):
            raise AccessError("Only Finance can approve petty cash transactions.")
        for tx in self:
            if tx.state != "submitted": raise UserError("Only pending transactions can be approved.")
            if tx.transaction_type in ("expense", "negative_adjustment", "closure") and tx.amount > tx.fund_id.current_balance:
                raise ValidationError("The transaction exceeds the fund balance.")
            tx.write({"state": "posted", "approved_by_id": self.env.user.id})
        return True


class HrPettyCashReconciliation(models.Model):
    _name = "hr.petty.cash.reconciliation"
    _description = "Petty Cash Reconciliation"
    _order = "date desc, id desc"
    _check_company_auto = True

    name = fields.Char(default="New", readonly=True, copy=False)
    fund_id = fields.Many2one("hr.petty.cash.fund", required=True, check_company=True)
    company_id = fields.Many2one(related="fund_id.company_id", store=True, readonly=True, index=True)
    currency_id = fields.Many2one(related="fund_id.currency_id", store=True, readonly=True)
    date = fields.Date(default=fields.Date.context_today, required=True)
    period_start = fields.Date(required=True)
    system_balance = fields.Monetary(required=True, currency_field="currency_id", readonly=True)
    physical_count = fields.Monetary(required=True, currency_field="currency_id")
    variance = fields.Monetary(compute="_compute_variance", store=True, currency_field="currency_id")
    state = fields.Selection([("draft", "Draft"), ("passed", "Passed"), ("variance", "Variance")], default="draft", required=True)
    reconciled_by_id = fields.Many2one("res.users", readonly=True)
    notes = fields.Text()

    @api.depends("system_balance", "physical_count")
    def _compute_variance(self):
        for record in self: record.variance = record.physical_count - record.system_balance

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("name", "New") == "New": vals["name"] = self.env["ir.sequence"].next_by_code("hr.petty.cash.reconciliation") or "New"
            fund = self.env["hr.petty.cash.fund"].browse(vals.get("fund_id"))
            vals["system_balance"] = fund.current_balance
        return super().create(vals_list)

    def write(self, vals):
        if {"state", "reconciled_by_id", "system_balance"}.intersection(vals) and not self.env.context.get("petty_workflow") and not (
            self.env.user.has_group("hr_claims.group_hr_claim_finance")
            or self.env.user.has_group("hr_claims.group_hr_claim_admin")
        ):
            raise AccessError("Use the reconciliation action to confirm the cash count.")
        return super().write(vals)

    def action_confirm(self):
        for record in self:
            record.fund_id.transaction_ids[:1]._check_custodian_or_finance() if record.fund_id.transaction_ids else None
            if record.state != "draft": raise UserError("Only draft reconciliations can be confirmed.")
            record.with_context(petty_workflow=True).write({"state": "passed" if record.currency_id.is_zero(record.variance) else "variance", "reconciled_by_id": self.env.user.id})
            record.fund_id.sudo().write({"last_reconciled_date": record.date})
        return True


class HrPettyCashReplenishment(models.Model):
    _name = "hr.petty.cash.replenishment"
    _description = "Petty Cash Replenishment"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "request_date desc, id desc"
    _check_company_auto = True

    name = fields.Char(default="New", readonly=True, copy=False)
    fund_id = fields.Many2one("hr.petty.cash.fund", required=True, check_company=True)
    company_id = fields.Many2one(related="fund_id.company_id", store=True, readonly=True, index=True)
    currency_id = fields.Many2one(related="fund_id.currency_id", store=True, readonly=True)
    requested_amount = fields.Monetary(required=True, currency_field="currency_id")
    issued_amount = fields.Monetary(currency_field="currency_id", readonly=True)
    request_date = fields.Date(default=fields.Date.context_today, required=True)
    justification = fields.Text(required=True)
    urgent = fields.Boolean()
    state = fields.Selection(
        [("draft", "Draft"), ("submitted", "Pending"), ("approved", "Approved"),
         ("issued", "Issued"), ("rejected", "Rejected"), ("cancelled", "Cancelled")],
        default="draft", required=True, tracking=True,
    )
    requested_by_id = fields.Many2one("res.users", default=lambda self: self.env.user, readonly=True)
    approved_by_id = fields.Many2one("res.users", readonly=True)
    issued_by_id = fields.Many2one("res.users", readonly=True)
    issued_date = fields.Date(readonly=True)
    reference = fields.Char()

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("name", "New") == "New": vals["name"] = self.env["ir.sequence"].next_by_code("hr.petty.cash.replenishment") or "New"
        records = super().create(vals_list)
        for record in records:
            if not (record.fund_id.custodian_id.sudo().user_id == self.env.user or self.env.user.has_group("hr_claims.group_hr_claim_finance") or self.env.user.has_group("hr_claims.group_hr_claim_admin")):
                raise AccessError("Only the custodian or Finance can request replenishment.")
        return records

    def action_submit(self):
        for record in self:
            if record.state != "draft": raise UserError("Only draft replenishments can be submitted.")
            record.with_context(petty_workflow=True).write({"state": "submitted"})
        return True

    def write(self, vals):
        protected = {"state", "approved_by_id", "issued_by_id", "issued_amount", "issued_date"}
        if protected.intersection(vals) and not self.env.context.get("petty_workflow") and not (
            self.env.user.has_group("hr_claims.group_hr_claim_finance")
            or self.env.user.has_group("hr_claims.group_hr_claim_admin")
        ):
            raise AccessError("Use the replenishment workflow actions to change protected fields.")
        return super().write(vals)

    def action_approve(self):
        if not (self.env.user.has_group("hr_claims.group_hr_claim_finance") or self.env.user.has_group("hr_claims.group_hr_claim_admin")): raise AccessError("Only Finance can approve replenishments.")
        for record in self:
            if record.state != "submitted": raise UserError("Only submitted replenishments can be approved.")
            record.write({"state": "approved", "approved_by_id": self.env.user.id})
        return True

    def action_issue(self):
        if not (self.env.user.has_group("hr_claims.group_hr_claim_finance") or self.env.user.has_group("hr_claims.group_hr_claim_admin")): raise AccessError("Only Finance can issue replenishments.")
        for record in self:
            if record.state != "approved": raise UserError("Only approved replenishments can be issued.")
            self.env["hr.petty.cash.transaction"].create({
                "fund_id": record.fund_id.id, "transaction_type": "replenishment",
                "payee": record.fund_id.name, "category": "Replenishment",
                "amount": record.requested_amount, "state": "draft",
                "description": record.justification,
            }).sudo().write({"state": "posted", "approved_by_id": self.env.user.id})
            record.write({"state": "issued", "issued_amount": record.requested_amount, "issued_by_id": self.env.user.id, "issued_date": fields.Date.context_today(record)})
        return True
