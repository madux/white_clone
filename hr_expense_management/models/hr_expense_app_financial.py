from odoo import _, api, fields, models
from odoo.exceptions import UserError

from .hr_expense_app_contract import serialize_records, validate_action_values


class HrExpenseAppFinancial(models.AbstractModel):
    """Expose payment, petty-cash, accounting, vendor, and budget pages."""

    _inherit = "hr.expense.app"

    @api.model
    def _get_payment_page(self, page):
        """Return payment records, batches, methods, KPIs, and chart data."""
        claims = self.env["hr.claim"].search([("state", "=", "approved"), ("residual_amount", ">", 0)], order="approved_date")
        payments = self.env["hr.claim.payment"].search([], order="payment_date desc, id desc", limit=200)
        methods = self.env["hr.expense.payment.method"].search([]) if self._expense_has_role("finance", "admin") else self.env["hr.expense.payment.method"]
        batches = self.env["hr.expense.payment.batch"].search([], limit=100) if methods else self.env["hr.expense.payment.batch"]
        records = []
        if page in ("queue", "receivables", "process"):
            records = serialize_records(claims, {
                "id": "id", "name": "name", "employee": "employee_id.name",
                "department": lambda claim: claim.department_id.name or _("No Department"),
                "amount": "residual_amount", "approved_date": "approved_date",
                "days": lambda claim: max(
                    (fields.Date.context_today(claim) - fields.Date.to_date(claim.approved_date)).days, 0
                ) if claim.approved_date else 0,
                "state": lambda _claim: "payable",
            })
        elif page == "history":
            records = serialize_records(payments, {
                "id": "id", "name": "name", "employee": "employee_id.name",
                "amount": "amount", "method": lambda item: dict(
                    item._fields["payment_method"].selection
                ).get(item.payment_method), "date": "payment_date", "state": "state",
            })
        elif page == "methods":
            records = serialize_records(methods, {
                "id": "id", "name": "name", "type": lambda item: dict(
                    item._fields["method_type"].selection
                ).get(item.method_type), "active": "active", "batch": "supports_batch",
            })
        elif page == "reports":
            records = [{
                "id": batch.id, "name": batch.name, "employee": _("Batch"),
                "amount": batch.total_amount, "method": batch.method_id.name,
                "count": batch.claim_count, "date": batch.create_date, "state": batch.state,
            } for batch in batches]
        completed = payments.filtered(lambda item: item.state == "completed")
        return {
            "available": True,
            "records": records,
            "methods": serialize_records(methods, {"id": "id", "name": "name"}),
            "batches": serialize_records(batches, {
                "id": "id", "name": "name", "amount": "total_amount",
                "count": "claim_count", "state": "state",
            }),
            "kpis": {
                "payable_count": len(claims),
                "payable_value": sum(claims.mapped("residual_amount")),
                "paid_count": len(completed),
                "paid_value": sum(completed.mapped("amount")),
            },
            "charts": {"series": [{
                "label": dict(payments._fields["payment_method"].selection).get(key),
                "value": sum(completed.filtered(
                    lambda item, payment_method=key: item.payment_method == payment_method
                ).mapped("amount")),
            } for key, _label in payments._fields["payment_method"].selection]},
        }

    @api.model
    def app_process_payment_batch(self, claim_ids, method_id):
        """Execute the server-authorized process payment batch operation for the OWL application."""
        batch = self.env["hr.expense.payment.batch"].create({"method_id": int(method_id), "claim_ids": [(6, 0, [int(item) for item in claim_ids])]})
        batch.action_validate()
        batch.action_process()
        self.env["hr.expense.audit"].log_event("payments", "payment_batch_processed", _("Payment batch processed from the OWL application."), batch, "workflow", {"claim_count": len(claim_ids)}, origin="owl")
        return {"id": batch.id, "name": batch.name, "state": batch.state}

    @api.model
    def _get_petty_cash_page(self, page):
        """Return petty-cash funds, activity, KPIs, and page options."""
        funds = self.env["hr.petty.cash.fund"].search([])
        transactions = self.env["hr.petty.cash.transaction"].search([], order="date desc, id desc", limit=200)
        reconciliations = self.env["hr.petty.cash.reconciliation"].search([], order="date desc", limit=100)
        replenishments = self.env["hr.petty.cash.replenishment"].search([], order="request_date desc", limit=100)
        if page == "transactions":
            records = [{"id": tx.id, "name": tx.name, "date": tx.date, "fund": tx.fund_id.name, "payee": tx.payee, "category": tx.category or "", "amount": tx.amount, "type": dict(tx._fields["transaction_type"].selection).get(tx.transaction_type), "state": tx.state, "state_label": dict(tx._fields["state"].selection).get(tx.state), "can_approve": tx.state == "submitted"} for tx in transactions]
        elif page == "reconciliation":
            records = [{"id": rec.id, "name": rec.name, "date": rec.date, "fund": rec.fund_id.name, "system": rec.system_balance, "physical": rec.physical_count, "variance": rec.variance, "state": rec.state, "state_label": dict(rec._fields["state"].selection).get(rec.state)} for rec in reconciliations]
        elif page == "replenishment":
            records = [{"id": rep.id, "name": rep.name, "fund": rep.fund_id.name, "amount": rep.requested_amount, "date": rep.request_date, "urgent": rep.urgent, "justification": rep.justification, "state": rep.state, "state_label": dict(rep._fields["state"].selection).get(rep.state), "can_approve": rep.state == "submitted", "can_issue": rep.state == "approved"} for rep in replenishments]
        else:
            records = [{"id": fund.id, "name": fund.name, "code": fund.code, "location": fund.location, "custodian": fund.custodian_id.name, "balance": fund.current_balance, "maximum": fund.maximum_amount, "threshold": fund.minimum_threshold, "state": "active" if fund.active else "inactive"} for fund in funds]
        can_finance = self._expense_has_role("finance", "admin")
        employees = self.env["hr.employee"].sudo().search([("company_id", "in", [False, self.env.company.id])], order="name") if can_finance else funds.mapped("custodian_id")
        return {
            "available": True, "records": records,
            "kpis": {"funds": len(funds), "balance": sum(funds.mapped("current_balance")), "maximum": sum(funds.mapped("maximum_amount")), "low": len(funds.filtered(lambda fund: fund.current_balance <= fund.minimum_threshold)), "pending": len(transactions.filtered(lambda tx: tx.state == "submitted")), "replenishments": len(replenishments.filtered(lambda rep: rep.state == "submitted"))},
            "petty_options": {
                "funds": [{"id": item.id, "name": item.name, "balance": item.current_balance} for item in funds],
                "employees": [{"id": item.id, "name": item.name} for item in employees],
            },
            "charts": {"series": [{"label": item.name, "value": item.current_balance} for item in funds]},
        }

    @api.model
    def app_create_petty_record(self, kind, values):
        """Execute the server-authorized create petty record operation for the OWL application."""
        values = validate_action_values("petty", kind, values)
        if kind == "fund":
            record = self.env["hr.petty.cash.fund"].create({
                "name": (values.get("name") or "").strip(), "code": (values.get("code") or "").strip().upper(),
                "location": (values.get("location") or "").strip(), "custodian_id": int(values.get("custodian_id")),
                "maximum_amount": float(values.get("maximum_amount") or 0), "minimum_threshold": float(values.get("minimum_threshold") or 0),
            })
        elif kind == "transaction":
            record = self.env["hr.petty.cash.transaction"].create({
                "fund_id": int(values.get("fund_id")), "transaction_type": values.get("transaction_type") or "expense",
                "date": values.get("date") or fields.Date.context_today(self), "payee": (values.get("payee") or "").strip(),
                "category": (values.get("category") or "").strip(), "description": values.get("description") or False,
                "amount": float(values.get("amount") or 0),
            })
            if values.get("receipt_data"):
                attachment = self._app_create_attachment(values.get("receipt_name") or _("Petty Cash Receipt"), values["receipt_data"], values.get("receipt_mimetype") or "application/octet-stream", record)
                record.receipt_attachment_id = attachment
            record.action_submit()
        elif kind == "reconciliation":
            record = self.env["hr.petty.cash.reconciliation"].create({
                "fund_id": int(values.get("fund_id")), "period_start": values.get("period_start"),
                "date": values.get("date") or fields.Date.context_today(self), "physical_count": float(values.get("physical_count") or 0),
                "notes": values.get("notes") or False,
            })
            record.action_confirm()
        elif kind == "replenishment":
            record = self.env["hr.petty.cash.replenishment"].create({
                "fund_id": int(values.get("fund_id")), "requested_amount": float(values.get("requested_amount") or 0),
                "justification": (values.get("justification") or "").strip(), "urgent": bool(values.get("urgent")),
            })
            record.action_submit()
        else:
            raise UserError(_("Unsupported petty cash record type."))
        self.env["hr.expense.audit"].log_event("petty_cash", "%s_created" % kind, _("Petty cash record created from the OWL application."), record, "user", origin="owl")
        return {"id": record.id, "name": record.display_name}

    @api.model
    def app_assign_custodian(self, fund_id, employee_id):
        """Execute the server-authorized assign custodian operation for the OWL application."""
        self._check_financial_workspace()
        values = validate_action_values("petty", "custodian", {
            "fund_id": fund_id, "custodian_id": employee_id,
        })
        fund = self.env["hr.petty.cash.fund"].browse(int(values["fund_id"])).exists()
        employee = self.env["hr.employee"].browse(int(values["custodian_id"])).exists()
        if not fund or not employee or (employee.company_id and employee.company_id != fund.company_id):
            raise UserError(_("Select a valid fund and employee in the same company."))
        fund.write({"custodian_id": employee.id})
        self.env["hr.expense.audit"].log_event("petty_cash", "custodian_assigned", _("Petty cash custodian reassigned."), fund, "configuration", {"employee_id": employee.id}, origin="owl")
        return True

    @api.model
    def app_petty_action(self, kind, record_id, action):
        """Execute the server-authorized petty action operation for the OWL application."""
        self._check_financial_workspace()
        if kind == "transaction":
            record = self.env["hr.petty.cash.transaction"].browse(int(record_id)).exists()
            if action != "approve":
                raise UserError(_("Unsupported transaction action."))
            record.action_approve()
        elif kind == "replenishment":
            record = self.env["hr.petty.cash.replenishment"].browse(int(record_id)).exists()
            if action == "approve":
                record.action_approve()
            elif action == "issue":
                record.action_issue()
            else:
                raise UserError(_("Unsupported replenishment action."))
        else:
            raise UserError(_("Unsupported petty cash action."))
        self.env["hr.expense.audit"].log_event("petty_cash", "%s_%s" % (kind, action), _("Petty cash workflow action completed."), record, "workflow", origin="owl")
        return True

    @api.model
    def _check_financial_workspace(self):
        return self._expense_check_role(
            "finance", "admin", message=_("Only Finance can access this financial workspace.")
        )

    @api.model
    def _get_accounts_page(self, page):
        """Return Odoo accounting mappings, entries, KPIs, and page options."""
        self._check_financial_workspace()
        company = self.env.company
        accounts = self.env["account.account"].sudo().with_company(company).search(
            [("company_id", "=", company.id)], order="code, id"
        )
        mappings = self.env["hr.expense.gl.map"].with_context(active_test=False).search([], order="source_type, sequence, id")
        moves = self.env["account.move"].sudo().with_company(company).search([
            ("company_id", "=", company.id),
            ("move_type", "=", "entry"),
            ("expense_source_model", "!=", False),
        ], order="date desc, id desc", limit=200)
        journals = self.env["account.journal"].sudo().with_company(company).search([
            ("company_id", "=", company.id), ("type", "=", "general"), ("active", "=", True)
        ], order="sequence, id")
        account_type_labels = dict(
            self.env["account.account"]._fields["account_type"]._description_selection(self.env)
        )
        if page == "mapping":
            records = [{
                "id": item.id,
                "name": item.name,
                "source": dict(item._fields["source_type"].selection).get(item.source_type),
                "category": item.claim_category_id.name or _("All Categories"),
                "journal": item.journal_id.display_name or _("Default Miscellaneous Journal"),
                "debit": "%s · %s" % (item.debit_account_id.code, item.debit_account_id.name),
                "credit": "%s · %s" % (item.credit_account_id.code, item.credit_account_id.name),
                "state": "active" if item.active else "inactive",
            } for item in mappings]
        elif page == "journals":
            records = [{
                "id": item.id,
                "name": item.name,
                "date": item.date,
                "description": item.ref or item.display_name,
                "source": item.expense_source_reference or _("Manual"),
                "debit": sum(item.line_ids.mapped("debit")),
                "credit": sum(item.line_ids.mapped("credit")),
                "balanced": item.company_currency_id.is_zero(sum(item.line_ids.mapped("balance"))),
                "state": item.state,
            } for item in moves]
        else:
            records = [{
                "id": item.id,
                "code": item.code,
                "name": item.name,
                "type": account_type_labels.get(item.account_type, item.account_type),
                "subtype": dict(item._fields["internal_group"].selection).get(item.internal_group, "—"),
                "parent": item.group_id.display_name or "",
                "level": 0,
                "header": False,
                "balance": item.current_balance,
                "state": "inactive" if item.deprecated else "active",
            } for item in accounts]
        posting_accounts = accounts.filtered(lambda item: not item.deprecated and item.account_type != "off_balance")
        posted_moves = moves.filtered(lambda item: item.state == "posted")
        draft_moves = moves.filtered(lambda item: item.state == "draft")
        return {
            "available": True,
            "records": records,
            "kpis": {
                "total": len(accounts),
                "active": len(accounts.filtered(lambda item: not item.deprecated)),
                "headers": len(accounts.filtered("deprecated")),
                "posting": len(posting_accounts),
                "mappings": len(mappings.filtered("active")),
                "draft_journals": len(draft_moves),
                "posted_value": sum(sum(move.line_ids.mapped("debit")) for move in posted_moves),
            },
            "account_options": {
                "accounts": [{"id": item.id, "name": "%s · %s" % (item.code, item.name), "type": item.account_type} for item in posting_accounts],
                "categories": [{"id": item.id, "name": item.name} for item in self.env["hr.claim.category"].search([])],
                "journals": [{"id": item.id, "name": item.display_name} for item in journals],
            },
            "charts": {"series": [
                {"label": _("Posted"), "value": sum(sum(move.line_ids.mapped("debit")) for move in posted_moves)},
                {"label": _("Draft"), "value": sum(sum(move.line_ids.mapped("debit")) for move in draft_moves)},
            ]},
        }

    @api.model
    def app_create_accounting_record(self, kind, values):
        """Execute the server-authorized create accounting record operation for the OWL application."""
        self._check_financial_workspace()
        values = validate_action_values("accounting", kind, values)
        if kind == "account":
            record = self.env["account.account"].sudo().with_company(self.env.company).create({
                "code": (values.get("code") or "").strip(), "name": (values.get("name") or "").strip(),
                "account_type": values.get("account_type") or "expense", "company_id": self.env.company.id,
            })
        elif kind == "mapping":
            record = self.env["hr.expense.gl.map"].create({
                "name": (values.get("name") or "").strip(), "source_type": values.get("source_type") or "claim",
                "claim_category_id": int(values["category_id"]) if values.get("category_id") else False,
                "journal_id": int(values["journal_id"]) if values.get("journal_id") else False,
                "debit_account_id": int(values.get("debit_account_id")), "credit_account_id": int(values.get("credit_account_id")),
            })
        elif kind == "journal":
            amount = float(values.get("amount") or 0)
            if amount <= 0:
                raise UserError(_("The journal amount must be positive."))
            journal_id = values.get("journal_id")
            if not journal_id:
                journal_id = self.env["hr.expense.gl.map"]._default_journal(self.env.company).id
            if not journal_id:
                raise UserError(_("Configure a miscellaneous Odoo journal first."))
            description = (values.get("description") or "").strip()
            record = self.env["account.move"].sudo().with_company(self.env.company).create({
                "move_type": "entry", "journal_id": int(journal_id),
                "date": values.get("date") or fields.Date.context_today(self), "ref": description,
                "expense_source_model": "hr.expense.app", "expense_source_id": 0,
                "expense_source_reference": _("Manual Expense Entry"),
                "line_ids": [
                    (0, 0, {"name": description, "account_id": int(values.get("debit_account_id")), "debit": amount}),
                    (0, 0, {"name": description, "account_id": int(values.get("credit_account_id")), "credit": amount}),
                ],
            })
            if values.get("post"):
                record.action_post()
        else:
            raise UserError(_("Unsupported accounting record type."))
        self.env["hr.expense.audit"].log_event("accounts", "%s_created" % kind, _("Accounting record created from the OWL application."), record, "configuration", origin="owl")
        return {"id": record.id, "name": record.display_name}

    @api.model
    def app_create_vendor(self, values):
        """Execute the server-authorized create vendor operation for the OWL application."""
        self._check_financial_workspace()
        name = (values.get("name") or "").strip()
        code = (values.get("code") or "").strip()
        if not name or not code:
            raise UserError("Vendor name and code are required.")
        rating = int(values.get("rating") or 3)
        if rating < 1 or rating > 5:
            raise UserError("Vendor rating must be from 1 to 5.")
        vendor = self.env["res.partner"].sudo().create({
            "name": name,
            "company_type": "company",
            "company_id": self.env.company.id,
            "email": (values.get("email") or "").strip() or False,
            "phone": (values.get("phone") or "").strip() or False,
            "is_expense_vendor": True,
            "expense_vendor_code": code,
            "expense_vendor_category_id": int(values["category_id"]) if values.get("category_id") else False,
            "expense_payment_term_id": int(values["term_id"]) if values.get("term_id") else False,
            "default_expense_account_id": int(values["account_id"]) if values.get("account_id") else False,
            "expense_rating": rating,
            "expense_vendor_active": True,
        })
        self.env["hr.expense.audit"].log_event("vendors", "vendor_created", _("Expense vendor created from the OWL application."), None, "configuration", {"vendor_id": vendor.id, "vendor_code": code}, origin="owl")
        return {"id": vendor.id, "name": vendor.name}

    @api.model
    def _get_vendors_page(self, page):
        """Return vendor records, categories, terms, KPIs, and page options."""
        self._check_financial_workspace()
        vendors = self.env["res.partner"].search([("is_expense_vendor", "=", True)], order="name")
        categories = self.env["hr.expense.vendor.category"].with_context(active_test=False).search([], order="sequence, name")
        terms = self.env["hr.expense.payment.term"].with_context(active_test=False).search([], order="due_days, name")
        vendor_lines = self.env["hr.claim.line"].search([("vendor_id", "!=", False)], order="expense_date desc, id desc", limit=200)
        if page == "categories":
            records = [{
                "id": item.id, "code": item.code, "name": item.name,
                "tax": item.tax_rate,
                "account": item.default_expense_account_id.code or "—",
                "state": "active" if item.active else "inactive",
            } for item in categories]
        elif page == "terms":
            records = [{
                "id": item.id, "code": item.code, "name": item.name,
                "days": item.due_days, "discount": item.early_discount_percent,
                "discount_days": item.early_discount_days,
                "state": "active" if item.active else "inactive",
            } for item in terms]
        elif page == "claims":
            records = [{
                "id": item.id, "name": item.claim_id.name,
                "vendor": item.vendor_id.name, "employee": item.claim_id.employee_id.name,
                "description": item.description, "category": dict(item._fields["category"].selection).get(item.category),
                "date": item.expense_date, "amount": item.amount,
                "state": item.claim_id.state,
            } for item in vendor_lines]
        else:
            records = [{
                "id": item.id, "code": item.expense_vendor_code or "—", "name": item.name,
                "category": item.expense_vendor_category_id.name or _("Uncategorized"),
                "email": item.email or "", "phone": item.phone or "",
                "rating": item.expense_rating, "account": item.default_expense_account_id.code or "—",
                "claim_count": item.expense_claim_count, "spend": item.expense_claim_value,
                "state": "active" if item.expense_vendor_active else "inactive",
            } for item in vendors]
        return {
            "available": True,
            "records": records,
            "vendor_options": {
                "categories": [{"id": item.id, "name": item.name} for item in categories.filtered("active")],
                "terms": [{"id": item.id, "name": item.name} for item in terms.filtered("active")],
                "accounts": [{"id": item.id, "name": "%s · %s" % (item.code, item.name)} for item in self.env["account.account"].sudo().search([
                    ("company_id", "=", self.env.company.id),
                    ("account_type", "in", ("expense", "expense_depreciation", "expense_direct_cost")),
                    ("deprecated", "=", False)
                ], order="code")],
            },
            "kpis": {
                "total": len(vendors),
                "active": len(vendors.filtered("expense_vendor_active")),
                "high_rating": len(vendors.filtered(lambda vendor: vendor.expense_rating >= 4)),
                "categories": len(categories.filtered("active")),
                "spend": sum(vendors.mapped("expense_claim_value")),
                "claims": len(vendor_lines.mapped("claim_id")),
            },
            "charts": {"series": [{"label": item.name, "value": item.expense_claim_value} for item in vendors.sorted(key=lambda vendor: vendor.expense_claim_value, reverse=True)[:8]]},
        }

    @api.model
    def _get_budget_page(self, page):
        """Return periods, budgets, utilization KPIs, and page options."""
        self._check_financial_workspace()
        budgets = self.env["hr.expense.budget"].search([], order="period_id desc, department_id")
        lines = self.env["hr.expense.budget.line"].search([], order="department_id, category_id, account_id")
        periods = self.env["hr.expense.period"].search([], order="date_start desc")
        if page == "periods":
            records = [{
                "id": item.id, "code": item.code, "name": item.name,
                "start": item.date_start, "end": item.date_end,
                "submission": item.submission_cutoff, "approval": item.approval_cutoff,
                "payment": item.payment_cutoff, "gl": item.gl_cutoff,
                "state": item.state,
            } for item in periods]
        elif page == "departments":
            records = [{
                "id": item.id, "code": item.code, "name": item.name,
                "department": item.department_id.name, "period": item.period_id.name,
                "approved": item.total_approved, "committed": item.total_committed,
                "actual": item.total_actual, "available": item.total_available,
                "utilization": item.utilization, "state": item.state,
            } for item in budgets]
        else:
            records = [{
                "id": item.id,
                "name": item.category_id.name or item.account_id.name,
                "department": item.department_id.name,
                "cost_center": item.budget_id.cost_center or item.budget_id.code,
                "period": item.period_id.name,
                "account": item.account_id.code or "—",
                "approved": item.approved_amount, "forecast": item.forecast_amount,
                "committed": item.committed_amount, "actual": item.actual_amount,
                "available": item.available_amount, "utilization": item.utilization,
                "state": item.status,
                "state_label": dict(item._fields["status"].selection).get(item.status),
            } for item in lines]
        approved = sum(lines.mapped("approved_amount"))
        committed = sum(lines.mapped("committed_amount"))
        actual = sum(lines.mapped("actual_amount"))
        return {
            "available": True,
            "records": records,
            "kpis": {
                "approved": approved, "committed": committed, "actual": actual,
                "available": approved - committed - actual,
                "utilization": ((committed + actual) / approved * 100) if approved else 0,
                "over": len(lines.filtered(lambda line: line.status == "over")),
                "at_risk": len(lines.filtered(lambda line: line.status == "risk")),
                "periods_open": len(periods.filtered(lambda period: period.state == "open")),
            },
            "budget_options": {
                "budgets": [{"id": item.id, "name": item.display_name} for item in budgets.filtered(lambda item: item.state != "closed")],
                "periods": [{"id": item.id, "name": item.name} for item in periods.filtered(lambda item: item.state != "closed")],
                "departments": [{"id": item.id, "name": item.name} for item in self.env["hr.department"].sudo().search([("company_id", "in", [False, self.env.company.id])], order="name")],
                "categories": [{"id": item.id, "name": item.name} for item in self.env["hr.claim.category"].search([])],
                "accounts": [{"id": item.id, "name": "%s · %s" % (item.code, item.name)} for item in self.env["account.account"].sudo().search([
                    ("company_id", "=", self.env.company.id), ("deprecated", "=", False),
                ], order="code")],
            },
            "charts": {"series": [{"label": _("Approved"), "value": approved}, {"label": _("Committed"), "value": committed}, {"label": _("Actual"), "value": actual}, {"label": _("Available"), "value": approved - committed - actual}]},
        }

    @api.model
    def app_create_budget_record(self, kind, values):
        """Execute the server-authorized create budget record operation for the OWL application."""
        self._check_financial_workspace()
        values = validate_action_values("budget", kind, values)
        if kind == "period":
            record = self.env["hr.expense.period"].create({
                "name": (values.get("name") or "").strip(), "code": (values.get("code") or "").strip().upper(),
                "date_start": values.get("date_start"), "date_end": values.get("date_end"),
                "submission_cutoff": values.get("submission_cutoff") or False, "approval_cutoff": values.get("approval_cutoff") or False,
                "payment_cutoff": values.get("payment_cutoff") or False, "gl_cutoff": values.get("gl_cutoff") or False,
            })
        elif kind == "budget":
            record = self.env["hr.expense.budget"].create({
                "name": (values.get("name") or "").strip(), "code": (values.get("code") or "").strip().upper(),
                "period_id": int(values.get("period_id")), "department_id": int(values.get("department_id")),
                "cost_center": (values.get("cost_center") or "").strip() or False,
            })
        elif kind == "line":
            if not values.get("category_id") and not values.get("account_id"):
                raise UserError(_("Select a claim category or GL account."))
            record = self.env["hr.expense.budget.line"].create({
                "budget_id": int(values.get("budget_id")), "category_id": int(values["category_id"]) if values.get("category_id") else False,
                "account_id": int(values["account_id"]) if values.get("account_id") else False,
                "approved_amount": float(values.get("approved_amount") or 0), "forecast_amount": float(values.get("forecast_amount") or 0),
                "warning_threshold": float(values.get("warning_threshold") or 80),
            })
        else:
            raise UserError(_("Unsupported budget record type."))
        self.env["hr.expense.audit"].log_event("budget", "%s_created" % kind, _("Budget record created from the OWL application."), record, "configuration", origin="owl")
        return {"id": record.id, "name": record.display_name}

    @api.model
    def app_create_configuration(self, kind, values):
        """Execute the server-authorized create configuration operation for the OWL application."""
        admin_kinds = {"claim_type", "claim_window", "request_type", "approval_rule", "email", "integration", "payment_method"}
        if kind in admin_kinds:
            self._check_admin_workspace()
        elif kind in {"vendor_category", "payment_term"}:
            self._check_financial_workspace()
        else:
            raise UserError(_("Unsupported configuration record type."))
        values = validate_action_values("configuration", kind, values)
        if kind == "claim_type":
            record = self.env["hr.claim.type"].create({
                "name": (values.get("name") or "").strip(), "code": (values.get("code") or "").strip().upper(),
                "category_id": int(values.get("category_id")), "amount_type": values.get("amount_type") or "open",
                "fixed_amount": float((values.get("fixed_amount") or values.get("maximum_amount")) if values.get("amount_type") == "fixed" else 0),
                "maximum_per_claim": float(values.get("maximum_amount") or 0),
                "receipt_policy": values.get("receipt_policy") or "optional", "receipt_threshold": float(values.get("receipt_threshold") or 0),
                "approval_type": values.get("approval_type") or "single", "description": values.get("description") or False,
            })
        elif kind == "claim_window":
            record = self.env["hr.claim.window"].create({
                "name": (values.get("name") or "").strip(), "window_type": values.get("window_type") or "submission",
                "duration_days": int(values.get("duration_days") or 0), "start_date": values.get("start_date") or False,
                "end_date": values.get("end_date") or False, "description": values.get("description") or False,
            })
        elif kind == "request_type":
            record = self.env["hr.expense.request.type"].create({
                "name": (values.get("name") or "").strip(), "code": (values.get("code") or "").strip().upper(),
                "minimum_amount": float(values.get("minimum_amount") or 0), "maximum_amount": float(values.get("maximum_amount") or 0),
                "creates_advance": bool(values.get("creates_advance")), "retirement_days": int(values.get("retirement_days") or 30),
                "description": values.get("description") or False,
            })
        elif kind == "approval_rule":
            record = self.env["hr.expense.approval.rule"].create({
                "name": (values.get("name") or "").strip(), "target": values.get("target") or "claim",
                "department_id": int(values["department_id"]) if values.get("department_id") else False,
                "minimum_amount": float(values.get("minimum_amount") or 0), "maximum_amount": float(values.get("maximum_amount") or 0),
                "line_ids": [(0, 0, {"name": _("Manager Approval"), "sequence": 10, "approver_type": "group", "group_id": self.env.ref("hr_expense_management.group_hr_expense_manager").id})],
            })
        elif kind == "vendor_category":
            record = self.env["hr.expense.vendor.category"].create({
                "name": (values.get("name") or "").strip(), "code": (values.get("code") or "").strip().upper(),
                "tax_rate": float(values.get("tax_rate") or 0), "default_expense_account_id": int(values["account_id"]) if values.get("account_id") else False,
            })
        elif kind == "payment_term":
            record = self.env["hr.expense.payment.term"].create({
                "name": (values.get("name") or "").strip(), "code": (values.get("code") or "").strip().upper(),
                "due_days": int(values.get("due_days") or 0), "early_discount_percent": float(values.get("discount") or 0),
                "early_discount_days": int(values.get("discount_days") or 0),
            })
        elif kind == "email":
            record = self.env["hr.expense.email.template"].create({
                "name": (values.get("name") or "").strip(), "event": values.get("event") or "submitted",
                "subject": (values.get("subject") or "").strip(), "body_html": values.get("body_html") or "<p></p>",
            })
        elif kind == "integration":
            record = self.env["hr.expense.integration"].create({
                "name": (values.get("name") or "").strip(), "provider": values.get("provider") or "other",
                "configuration_summary": values.get("configuration_summary") or False,
            })
        else:
            record = self.env["hr.expense.payment.method"].create({
                "name": (values.get("name") or "").strip(), "code": (values.get("code") or "").strip().upper(),
                "method_type": values.get("method_type") or "bank", "supports_batch": bool(values.get("supports_batch", True)),
            })
        module = "vendors" if kind in {"vendor_category", "payment_term"} else "settings"
        self.env["hr.expense.audit"].log_event(module, "%s_created" % kind, _("Configuration created from the OWL application."), record, "configuration", origin="owl")
        return {"id": record.id, "name": record.display_name}
