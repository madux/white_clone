from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError


class HrExpenseApp(models.Model):
    """Small, security-aware gateway for the OWL expense application.

    Business records remain in normal ORM models with ACLs and record rules.
    This model only describes the current user's capabilities and composes
    already-filtered dashboard data for the client shell.
    """

    _inherit = "hr.claim"

    @api.model
    def get_app_bootstrap(self):
        user = self.env.user
        role = {
            "employee": user.has_group("hr_expense_management.group_hr_expense_employee"),
            "manager": user.has_group("hr_expense_management.group_hr_expense_manager"),
            "finance": user.has_group("hr_expense_management.group_hr_expense_finance"),
            "admin": user.has_group("hr_expense_management.group_hr_expense_admin"),
        }

        def allowed(*roles):
            return role["admin"] or any(role.get(item) for item in roles)

        modules = [
            self._app_module("dashboard", "Dashboard", "fa-home", [
                ("overview", "Overview"), ("quick", "Quick Actions"),
                ("recent", "Recent"), ("tasks", "My Tasks"),
                ("announcements", "Announcements"),
            ]),
            self._app_module("setup", "Setup", "fa-rocket", [
                ("progress", "Progress"), ("company", "Company"),
                ("policies", "Policies"), ("onboarding", "Onboarding"),
            ], allowed("admin")),
            self._app_module("claims", "Claims", "fa-file-text-o", [
                ("data", "Claims Data"), ("types", "Claim Types"),
                ("windows", "Windows"), ("assignments", "Assignments"),
            ]),
            self._app_module("requests", "Requests", "fa-clipboard", [
                ("data", "Request Data"), ("types", "Request Types"),
                ("history", "History"), ("analytics", "Analytics"),
            ], allowed("employee", "manager")),
            self._app_module("advances", "Advances", "fa-money", [
                ("outstanding", "Outstanding"), ("issue", "Issue Advance"),
                ("retirement", "Retirement"), ("aging", "Age Analysis"),
                ("writeoffs", "Write-Offs"),
            ], allowed("employee", "finance")),
            self._app_module("workflow", "Workflow", "fa-random", [
                ("pending", "Pending"), ("approved", "Approved"),
                ("rejected", "Rejected"), ("rules", "Rules"),
                ("claim_rules", "Claim Approvals"),
                ("request_rules", "Request Approvals"),
                ("analytics", "Analytics"),
            ], allowed("manager")),
            self._app_module("payments", "Payments", "fa-credit-card", [
                ("queue", "Queue"), ("receivables", "Receivables"),
                ("process", "Process"), ("history", "History"),
                ("methods", "Methods"), ("reports", "Reports"),
            ], allowed("employee", "finance")),
            self._app_module("petty_cash", "Petty Cash", "fa-briefcase", [
                ("accounts", "Accounts"), ("transactions", "Transactions"),
                ("reconciliation", "Reconciliation"),
                ("replenishment", "Replenishment"),
                ("custodians", "Custodians"),
            ], allowed("finance") or bool(self.env["hr.petty.cash.fund"].search_count([
                ("custodian_id.user_id", "=", user.id)
            ]))),
            self._app_module("teams", "Teams", "fa-users", [
                ("members", "Members"), ("departments", "Departments"),
                ("roles", "Roles"), ("analytics", "Analytics"),
                ("settings", "Settings"),
            ], allowed("manager"), False),
            self._app_module("accounts", "Accounts", "fa-book", [
                ("accounts", "Accounts"), ("tree", "Tree"),
                ("mapping", "GL Mapping"), ("journals", "Journal Entries"),
                ("settings", "Settings"),
            ], allowed("finance")),
            self._app_module("vendors", "Vendors", "fa-building-o", [
                ("directory", "Directory"), ("categories", "Categories"),
                ("claims", "Vendor Claims"), ("terms", "Terms"),
                ("analytics", "Analytics"),
            ], allowed("finance")),
            self._app_module("budget", "Budget", "fa-pie-chart", [
                ("overview", "Overview"), ("departments", "By Department"),
                ("variance", "Budget vs Actual"), ("periods", "Periods"),
            ], allowed("finance")),
            self._app_module("reports", "Reports", "fa-bar-chart", [
                ("financial", "Financial"), ("claims", "Claims"),
                ("employees", "Employees"), ("custom", "Custom"),
                ("scheduled", "Scheduled"),
            ], allowed("manager", "finance")),
            self._app_module("audit", "Audit", "fa-history", [
                ("activity", "Activity Log"), ("users", "User Actions"),
                ("system", "System"), ("search", "Search"),
                ("filters", "Filters"),
            ], allowed("admin")),
            self._app_module("settings", "Settings", "fa-cog", [
                ("policies", "Policies"), ("workflows", "Workflows"),
                ("email", "Email"), ("integrations", "Integrations"),
            ], allowed("admin"), False),
            self._app_module("theme", "Theme", "fa-paint-brush", [
                ("customize", "Customize"),
            ], allowed("admin"), False),
        ]
        modules = [module for module in modules if module["visible"]]

        return {
            "user": {"id": user.id, "name": user.name},
            "company": {"id": self.env.company.id, "name": self.env.company.name},
            "role": role,
            "role_label": self._role_label(role),
            "modules": modules,
            "dashboard": self.env["hr.claim"].get_dashboard_data(),
        }

    @api.model
    def _app_module(self, key, label, icon, pages, visible=True, available=True):
        return {
            "key": key,
            "label": label,
            "icon": icon,
            "visible": visible,
            "available": available,
            "pages": [{"key": page[0], "label": page[1]} for page in pages],
        }

    @api.model
    def _role_label(self, role):
        if role["admin"]:
            return "Admin"
        if role["finance"]:
            return "Finance"
        if role["manager"]:
            return "Manager"
        return "Employee"

    @api.model
    def get_app_page(self, module, page=None):
        """Return a compact, record-rule-filtered payload for an OWL feature page."""
        if module == "requests":
            return self._get_request_page(page)
        if module == "advances":
            return self._get_advance_page(page)
        if module == "workflow":
            return self._get_workflow_page(page)
        if module == "payments":
            return self._get_payment_page(page)
        if module == "petty_cash":
            return self._get_petty_cash_page(page)
        if module == "accounts":
            return self._get_accounts_page(page)
        if module == "vendors":
            return self._get_vendors_page(page)
        if module == "budget":
            return self._get_budget_page(page)
        return {"records": [], "kpis": {}, "available": False}

    @api.model
    def _get_request_page(self, page):
        Request = self.env["hr.expense.request"]
        requests = Request.search([], order="submitted_date desc, id desc", limit=200)
        states = {key: 0 for key in ("draft", "submitted", "approved", "fulfilled", "rejected", "returned", "cancelled")}
        for request in requests:
            states[request.state] += 1
        type_records = self.env["hr.expense.request.type"].search(
            [("active", "=", True)], order="sequence, name"
        )
        return {
            "available": True,
            "kpis": {
                "total": len(requests), "pending": states["submitted"],
                "approved": states["approved"] + states["fulfilled"],
                "rejected": states["rejected"],
            },
            "request_types": [
                {"id": item.id, "name": item.name, "creates_advance": item.creates_advance,
                 "minimum": item.minimum_amount, "maximum": item.maximum_amount}
                for item in type_records
            ],
            "records": [self._serialize_request(request) for request in requests],
        }

    @api.model
    def _serialize_request(self, request):
        return {
            "id": request.id, "name": request.name,
            "employee": request.employee_id.name,
            "department": request.department_id.name or _("No Department"),
            "type": request.request_type_id.name,
            "creates_advance": request.request_type_id.creates_advance,
            "purpose": request.purpose, "description": request.description or "",
            "amount": request.amount, "needed_date": request.needed_date,
            "submitted_date": request.submitted_date,
            "state": request.state,
            "state_label": dict(request._fields["state"].selection).get(request.state),
            "advance_id": request.advance_id.id or False,
            "can_submit": request.state in ("draft", "returned") and (request._is_owner() or request._is_admin()),
            "can_decide": request.state == "submitted" and (request._is_manager() or request._is_admin()),
            "can_issue": request.state == "approved" and request.request_type_id.creates_advance
                and (self.env.user.has_group("hr_expense_management.group_hr_expense_finance") or request._is_admin()),
        }

    @api.model
    def _get_advance_page(self, page):
        advances = self.env["hr.cash.advance"].search(
            [], order="issue_date desc, id desc", limit=200
        )
        outstanding = advances.filtered(lambda item: item.state in ("outstanding", "partial"))
        overdue = outstanding.filtered(lambda item: item.retirement_due_date < fields.Date.context_today(item))
        can_finance = (
            self.env.user.has_group("hr_expense_management.group_hr_expense_finance")
            or self.env.user.has_group("hr_expense_management.group_hr_expense_admin")
        )
        issuable = self.env["hr.expense.request"]
        if can_finance:
            issuable = self.env["hr.expense.request"].search([
                ("state", "=", "approved"), ("request_type_id.creates_advance", "=", True),
                ("advance_id", "=", False),
            ], order="decision_date")
        return {
            "available": True,
            "kpis": {
                "total_outstanding": sum(outstanding.mapped("outstanding_amount")),
                "active": len(outstanding), "overdue": len(overdue),
                "critical": len(outstanding.filtered(lambda item: item.outstanding_amount >= 100000)),
            },
            "can_finance": can_finance,
            "issuable_requests": [self._serialize_request(request) for request in issuable],
            "records": [{
                "id": item.id, "name": item.name, "employee": item.employee_id.name,
                "department": item.department_id.name or _("No Department"),
                "issued": item.issued_amount, "retired": item.retired_amount,
                "outstanding": item.outstanding_amount, "issue_date": item.issue_date,
                "due_date": item.retirement_due_date, "days": item.days_outstanding,
                "age": dict(item._fields["age_bracket"].selection).get(item.age_bracket),
                "state": item.state,
                "state_label": dict(item._fields["state"].selection).get(item.state),
                "can_retire": item.state in ("outstanding", "partial") and (
                    self.env.user.has_group("hr_expense_management.group_hr_expense_finance")
                    or self.env.user.has_group("hr_expense_management.group_hr_expense_admin")
                ),
            } for item in advances],
        }

    @api.model
    def _get_workflow_page(self, page):
        if not (
            self.env.user.has_group("hr_expense_management.group_hr_expense_manager")
            or self.env.user.has_group("hr_expense_management.group_hr_expense_admin")
        ):
            raise AccessError("Only Managers can access the approval workspace.")
        if page in ("rules", "claim_rules", "request_rules"):
            domain = []
            if page == "claim_rules":
                domain = [("target", "=", "claim")]
            elif page == "request_rules":
                domain = [("target", "=", "request")]
            rules = self.env["hr.expense.approval.rule"].search(domain, order="sequence, id")
            return {
                "available": True,
                "kpis": {"rules": len(rules), "active": len(rules.filtered("active"))},
                "records": [{
                    "id": rule.id, "name": rule.name,
                    "target": dict(rule._fields["target"].selection).get(rule.target),
                    "department": rule.department_id.name or _("All Departments"),
                    "minimum": rule.minimum_amount, "maximum": rule.maximum_amount,
                    "levels": len(rule.line_ids), "active": rule.active,
                } for rule in rules],
                "rule_page": True,
            }
        claim_domain = [("state", "=", "submitted")]
        request_domain = [("state", "=", "submitted")]
        if page == "approved":
            claim_domain = [("state", "in", ("approved", "paid"))]
            request_domain = [("state", "in", ("approved", "fulfilled"))]
        elif page == "rejected":
            claim_domain = [("state", "=", "rejected")]
            request_domain = [("state", "=", "rejected")]
        claims = self.env["hr.claim"].search(claim_domain, order="submitted_date desc", limit=100)
        requests = self.env["hr.expense.request"].search(request_domain, order="submitted_date desc", limit=100)
        records = [{
            "kind": "claim", "kind_label": _("Claim"), "id": claim.id,
            "reference": claim.name, "employee": claim.employee_id.name,
            "department": claim.department_id.name or _("No Department"),
            "description": claim.title, "amount": claim.amount_total,
            "date": claim.submitted_date, "state": claim.state,
        } for claim in claims]
        records += [{
            "kind": "request", "kind_label": _("Request"), "id": request.id,
            "reference": request.name, "employee": request.employee_id.name,
            "department": request.department_id.name or _("No Department"),
            "description": request.purpose, "amount": request.amount,
            "date": request.submitted_date, "state": request.state,
        } for request in requests]
        records.sort(key=lambda item: str(item["date"] or ""), reverse=True)
        return {
            "available": True,
            "kpis": {
                "awaiting": len(records) if page not in ("approved", "rejected") else 0,
                "claims": len(claims), "requests": len(requests),
                "total_value": sum(item["amount"] for item in records),
            },
            "records": records,
        }

    @api.model
    def app_create_request(self, values):
        employee = self.env["hr.expense.request"]._default_employee()
        if not employee:
            raise UserError("Your user is not linked to an employee in this company.")
        request = self.env["hr.expense.request"].create({
            "employee_id": employee.id,
            "request_type_id": int(values.get("request_type_id")),
            "purpose": (values.get("purpose") or "").strip(),
            "description": (values.get("description") or "").strip(),
            "amount": float(values.get("amount") or 0),
            "needed_date": values.get("needed_date"),
        })
        if values.get("submit"):
            request.action_submit()
        return {"id": request.id, "name": request.name}

    @api.model
    def app_request_action(self, request_id, action, comment=None):
        request = self.env["hr.expense.request"].browse(int(request_id)).exists()
        if not request:
            raise UserError("The request no longer exists.")
        if action == "submit":
            request.action_submit()
        elif action == "approve":
            request.action_approve(comment)
        elif action == "reject":
            request.action_reject(comment)
        elif action == "return":
            request.action_return(comment)
        elif action == "issue":
            request.action_issue_advance()
        else:
            raise UserError("Unsupported request action.")
        return True

    @api.model
    def app_workflow_decision(self, kind, record_id, decision, comment=None):
        if kind == "claim":
            record = self.env["hr.claim"].browse(int(record_id)).exists()
            if decision == "approve":
                record.action_approve(comment)
            elif decision in ("reject", "return"):
                record._apply_negative_decision(decision, comment)
            else:
                raise UserError("Unsupported claim decision.")
        elif kind == "request":
            return self.app_request_action(record_id, decision, comment)
        else:
            raise UserError("Unsupported approval record type.")
        return True

    @api.model
    def app_retire_advance(self, advance_id, amount, reference=None):
        advance = self.env["hr.cash.advance"].browse(int(advance_id)).exists()
        if not advance:
            raise UserError("The cash advance no longer exists.")
        advance.action_retire(amount, reference)
        return True

    @api.model
    def _get_payment_page(self, page):
        claims = self.env["hr.claim"].search([("state", "=", "approved"), ("residual_amount", ">", 0)], order="approved_date")
        payments = self.env["hr.claim.payment"].search([], order="payment_date desc, id desc", limit=200)
        methods = self.env["hr.expense.payment.method"].search([]) if self.env.user.has_group("hr_expense_management.group_hr_expense_finance") or self.env.user.has_group("hr_expense_management.group_hr_expense_admin") else self.env["hr.expense.payment.method"]
        batches = self.env["hr.expense.payment.batch"].search([], limit=100) if methods else self.env["hr.expense.payment.batch"]
        records = []
        if page in ("queue", "receivables", "process"):
            records = [{"id": claim.id, "name": claim.name, "employee": claim.employee_id.name, "department": claim.department_id.name or _("No Department"), "amount": claim.residual_amount, "approved_date": claim.approved_date, "days": max((fields.Date.context_today(claim) - fields.Date.to_date(claim.approved_date)).days, 0) if claim.approved_date else 0, "state": "payable"} for claim in claims]
        elif page == "history":
            records = [{"id": item.id, "name": item.name, "employee": item.employee_id.name, "amount": item.amount, "method": dict(item._fields["payment_method"].selection).get(item.payment_method), "date": item.payment_date, "state": item.state} for item in payments]
        elif page == "methods":
            records = [{"id": item.id, "name": item.name, "type": dict(item._fields["method_type"].selection).get(item.method_type), "active": item.active, "batch": item.supports_batch} for item in methods]
        return {"available": True, "records": records, "methods": [{"id": item.id, "name": item.name} for item in methods], "batches": [{"id": batch.id, "name": batch.name, "amount": batch.total_amount, "count": batch.claim_count, "state": batch.state} for batch in batches], "kpis": {"payable_count": len(claims), "payable_value": sum(claims.mapped("residual_amount")), "paid_count": len(payments.filtered(lambda item: item.state == "completed")), "paid_value": sum(payments.filtered(lambda item: item.state == "completed").mapped("amount"))}}

    @api.model
    def app_process_payment_batch(self, claim_ids, method_id):
        batch = self.env["hr.expense.payment.batch"].create({"method_id": int(method_id), "claim_ids": [(6, 0, [int(item) for item in claim_ids])]})
        batch.action_validate()
        batch.action_process()
        return {"id": batch.id, "name": batch.name, "state": batch.state}

    @api.model
    def _get_petty_cash_page(self, page):
        funds = self.env["hr.petty.cash.fund"].search([])
        transactions = self.env["hr.petty.cash.transaction"].search([], order="date desc, id desc", limit=200)
        reconciliations = self.env["hr.petty.cash.reconciliation"].search([], order="date desc", limit=100)
        replenishments = self.env["hr.petty.cash.replenishment"].search([], order="request_date desc", limit=100)
        if page == "transactions":
            records = [{"id": tx.id, "name": tx.name, "date": tx.date, "fund": tx.fund_id.name, "payee": tx.payee, "category": tx.category or "", "amount": tx.amount, "type": dict(tx._fields["transaction_type"].selection).get(tx.transaction_type), "state": tx.state, "state_label": dict(tx._fields["state"].selection).get(tx.state)} for tx in transactions]
        elif page == "reconciliation":
            records = [{"id": rec.id, "name": rec.name, "date": rec.date, "fund": rec.fund_id.name, "system": rec.system_balance, "physical": rec.physical_count, "variance": rec.variance, "state": rec.state, "state_label": dict(rec._fields["state"].selection).get(rec.state)} for rec in reconciliations]
        elif page == "replenishment":
            records = [{"id": rep.id, "name": rep.name, "fund": rep.fund_id.name, "amount": rep.requested_amount, "date": rep.request_date, "urgent": rep.urgent, "justification": rep.justification, "state": rep.state, "state_label": dict(rep._fields["state"].selection).get(rep.state)} for rep in replenishments]
        else:
            records = [{"id": fund.id, "name": fund.name, "code": fund.code, "location": fund.location, "custodian": fund.custodian_id.name, "balance": fund.current_balance, "maximum": fund.maximum_amount, "threshold": fund.minimum_threshold, "state": "active" if fund.active else "inactive"} for fund in funds]
        return {"available": True, "records": records, "kpis": {"funds": len(funds), "balance": sum(funds.mapped("current_balance")), "maximum": sum(funds.mapped("maximum_amount")), "low": len(funds.filtered(lambda fund: fund.current_balance <= fund.minimum_threshold)), "pending": len(transactions.filtered(lambda tx: tx.state == "submitted")), "replenishments": len(replenishments.filtered(lambda rep: rep.state == "submitted"))}}

    @api.model
    def _check_financial_workspace(self):
        if not (
            self.env.user.has_group("hr_expense_management.group_hr_expense_finance")
            or self.env.user.has_group("hr_expense_management.group_hr_expense_admin")
        ):
            raise AccessError("Only Finance can access this financial workspace.")

    @api.model
    def _get_accounts_page(self, page):
        self._check_financial_workspace()
        accounts = self.env["hr.expense.account"].with_context(active_test=False).search([], order="code, id")
        mappings = self.env["hr.expense.gl.map"].with_context(active_test=False).search([], order="source_type, sequence, id")
        journals = self.env["hr.expense.journal"].search([], order="date desc, id desc", limit=200)
        if page == "mapping":
            records = [{
                "id": item.id,
                "name": item.name,
                "source": dict(item._fields["source_type"].selection).get(item.source_type),
                "category": item.claim_category_id.name or _("All Categories"),
                "debit": "%s · %s" % (item.debit_account_id.code, item.debit_account_id.name),
                "credit": "%s · %s" % (item.credit_account_id.code, item.credit_account_id.name),
                "state": "active" if item.active else "inactive",
            } for item in mappings]
        elif page == "journals":
            records = [{
                "id": item.id,
                "name": item.name,
                "date": item.date,
                "description": item.description,
                "source": item.source_reference or _("Manual"),
                "debit": item.total_debit,
                "credit": item.total_credit,
                "balanced": item.balanced,
                "state": item.state,
            } for item in journals]
        else:
            records = [{
                "id": item.id,
                "code": item.code,
                "name": item.name,
                "type": dict(item._fields["account_type"].selection).get(item.account_type),
                "subtype": item.subtype or "—",
                "parent": item.parent_id.name or "",
                "level": len((item.parent_path or "").strip("/").split("/")) - 1,
                "header": item.is_header,
                "balance": item.balance,
                "state": "active" if item.active else "inactive",
            } for item in accounts]
        return {
            "available": True,
            "records": records,
            "kpis": {
                "total": len(accounts),
                "active": len(accounts.filtered("active")),
                "headers": len(accounts.filtered("is_header")),
                "posting": len(accounts.filtered(lambda account: not account.is_header)),
                "mappings": len(mappings.filtered("active")),
                "draft_journals": len(journals.filtered(lambda journal: journal.state == "draft")),
                "posted_value": sum(journals.filtered(lambda journal: journal.state == "posted").mapped("total_debit")),
            },
        }

    @api.model
    def app_create_vendor(self, values):
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
        return {"id": vendor.id, "name": vendor.name}

    @api.model
    def _get_vendors_page(self, page):
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
                "accounts": [{"id": item.id, "name": "%s · %s" % (item.code, item.name)} for item in self.env["hr.expense.account"].search([
                    ("account_type", "=", "expense"), ("is_header", "=", False), ("active", "=", True)
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
        }

    @api.model
    def _get_budget_page(self, page):
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
        }
