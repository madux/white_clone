from collections import defaultdict

from dateutil.relativedelta import relativedelta

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError


class HrExpenseApp(models.AbstractModel):
    """Small, security-aware gateway for the OWL expense application.

    Business records remain in normal ORM models with ACLs and record rules.
    This model only describes the current user's capabilities and composes
    already-filtered dashboard data for the client shell.
    """

    _name = "hr.expense.app"
    _description = "Expense Management Application Service"

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
            ], allowed("manager")),
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
            ], allowed("admin")),
            self._app_module("theme", "Theme", "fa-paint-brush", [
                ("customize", "Customize"),
            ], allowed("admin")),
        ]
        modules = [module for module in modules if module["visible"]]

        theme = self.env["hr.expense.theme"].sudo().search([
            ("company_id", "=", self.env.company.id), ("active", "=", True)
        ], limit=1)
        return {
            "user": {"id": user.id, "name": user.name},
            "company": {"id": self.env.company.id, "name": self.env.company.name},
            "role": role,
            "role_label": self._role_label(role),
            "modules": modules,
            "dashboard": self.env["hr.claim"].get_dashboard_data(),
            "theme": self._serialize_theme(theme),
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
        if module == "dashboard":
            return self._get_dashboard_section(page)
        if module == "claims":
            return self._get_claims_page(page)
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
        if module == "setup":
            return self._get_setup_page(page)
        if module == "teams":
            return self._get_teams_page(page)
        if module == "reports":
            return self._get_reports_page(page)
        if module == "audit":
            return self._get_audit_page(page)
        if module == "settings":
            return self._get_settings_page(page)
        if module == "theme":
            return self._get_theme_page(page)
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
            "charts": {"series": [{"label": dict(Request._fields["state"].selection).get(key), "value": value} for key, value in states.items() if value]},
        }

    @api.model
    def _get_dashboard_section(self, page):
        dashboard = self.env["hr.claim"].get_dashboard_data()
        if page == "quick":
            can_submit = (
                self.env.user.has_group("hr_expense_management.group_hr_expense_employee")
                or self.env.user.has_group("hr_expense_management.group_hr_expense_admin")
            )
            records = [{"id": 3, "name": _("Claims"), "description": _("Review your visible claim history."), "action": "claims", "state": "ready"}]
            if can_submit:
                records[0:0] = [
                    {"id": 1, "name": _("New Claim"), "description": _("Create and submit an employee expense claim."), "action": "new_claim", "state": "ready"},
                    {"id": 2, "name": _("New Request"), "description": _("Request pre-approval or a cash advance."), "action": "new_request", "state": "ready"},
                ]
        elif page == "recent":
            records = [{"id": item["id"], "name": item["name"], "description": item["title"], "employee": item["employee"], "amount": item["amount"], "state": item["state"], "state_label": item["state_label"], "action": "claim"} for item in dashboard.get("recent", [])]
        elif page == "tasks":
            activities = self.env["mail.activity"].search([("user_id", "=", self.env.user.id)], order="date_deadline, id", limit=100)
            records = [{"id": item.id, "name": item.summary or item.activity_type_id.name, "description": item.note or "", "model": item.res_model, "reference": item.res_name, "date": item.date_deadline, "state": "overdue" if item.date_deadline and item.date_deadline < fields.Date.context_today(item) else "pending"} for item in activities]
        elif page == "announcements":
            records = [{"id": 1, "name": _("Expense workspace is ready"), "description": _("Use the module navigation to submit, approve, pay, reconcile, report, and configure expenses."), "date": fields.Date.context_today(self), "state": "active"}]
        else:
            records = []
        return {"available": True, "records": records, "kpis": dashboard.get("kpis", {})}

    @api.model
    def _get_claims_page(self, page):
        claims = self.env["hr.claim"].search([], order="create_date desc", limit=200)
        claim_types = self.env["hr.claim.type"].with_context(active_test=False).search([], order="sequence, name")
        windows = self.env["hr.claim.window"].with_context(active_test=False).search([], order="window_type, name")
        if page == "types":
            records = [{
                "id": item.id, "code": item.code, "name": item.name,
                "category": item.category_id.name, "amount_type": dict(item._fields["amount_type"].selection).get(item.amount_type),
                "maximum": item.maximum_per_claim or item.maximum_amount, "receipt": dict(item._fields["receipt_policy"].selection).get(item.receipt_policy),
                "approval": dict(item._fields["approval_type"].selection).get(item.approval_type),
                "state": "active" if item.active else "inactive",
            } for item in claim_types]
        elif page == "windows":
            records = [{
                "id": item.id, "name": item.name, "type": dict(item._fields["window_type"].selection).get(item.window_type),
                "duration": item.duration_days, "start": item.start_date, "end": item.end_date,
                "claim_types": len(item.claim_type_ids), "state": "active" if item.active else "inactive",
            } for item in windows]
        elif page == "assignments":
            records = []
            for item in claim_types.filtered(lambda record: record.eligibility == "restricted"):
                for employee in item.employee_ids:
                    records.append({"id": "e-%s-%s" % (item.id, employee.id), "name": item.name, "type": _("Employee"), "assignee": employee.name, "department": employee.department_id.name or "", "state": "active"})
                for department in item.department_ids:
                    records.append({"id": "d-%s-%s" % (item.id, department.id), "name": item.name, "type": _("Department"), "assignee": department.name, "department": department.name, "state": "active"})
        else:
            records = [{
                "id": item.id, "name": item.name, "title": item.title,
                "employee": item.employee_id.name, "department": item.department_id.name or _("No Department"),
                "type": item.claim_type_id.name, "amount": item.amount_total,
                "date": item.expense_start_date, "state": item.state,
                "state_label": dict(item._fields["state"].selection).get(item.state),
                "can_appeal": item.state == "rejected"
                    and self.env.company.expense_enable_appeals
                    and (item._is_owner() or item._is_admin()),
            } for item in claims]
        return {
            "available": True, "records": records,
            "kpis": {"total": len(claims), "types": len(claim_types), "windows": len(windows), "submitted": len(claims.filtered(lambda item: item.state == "submitted")), "approved": len(claims.filtered(lambda item: item.state == "approved"))},
            "claim_options": {
                "types": [{"id": item.id, "name": item.name, "receipt_policy": item.receipt_policy} for item in claim_types.filtered("active")],
                "categories": [{"key": key, "label": label} for key, label in self.env["hr.claim.line"]._fields["category"].selection],
                "claim_categories": [{"id": item.id, "name": item.name} for item in self.env["hr.claim.category"].search([])],
            },
        }

    @api.model
    def app_create_claim(self, values):
        employee = self.env["hr.claim"]._default_employee()
        if not employee:
            raise UserError(_("Your user is not linked to an employee in this company."))
        line_values = values.get("lines") or [{
            "category": values.get("category"),
            "description": values.get("line_description"),
            "amount": values.get("amount"),
            "receipt_reference": values.get("receipt_reference"),
        }]
        if not line_values:
            raise UserError(_("Add at least one expense line."))
        claim = self.env["hr.claim"].create({
            "employee_id": employee.id, "claim_type_id": int(values.get("claim_type_id")),
            "title": (values.get("title") or "").strip(), "description": (values.get("description") or "").strip(),
            "money_type": values.get("money_type") or "personal",
            "expense_start_date": values.get("expense_date"), "expense_end_date": values.get("expense_date"),
            "line_ids": [(0, 0, {
                "description": (line.get("description") or values.get("title") or "").strip(),
                "category": line.get("category") or "other", "amount": float(line.get("amount") or 0),
                "expense_date": values.get("expense_date"), "receipt_reference": (line.get("receipt_reference") or "").strip() or False,
            }) for line in line_values],
        })
        if values.get("receipt_data"):
            attachment = self._app_create_attachment(
                values.get("receipt_name") or _("Receipt"), values["receipt_data"],
                values.get("receipt_mimetype") or "application/octet-stream", claim,
            )
            claim.write({"attachment_ids": [(4, attachment.id)]})
        if values.get("submit"):
            claim.action_submit()
        self.env["hr.expense.audit"].log_event("claims", "claim_created", _("Claim created from the OWL application."), claim, "user", origin="owl")
        return {"id": claim.id, "name": claim.name}

    @api.model
    def _app_create_attachment(self, name, data, mimetype, record):
        return self.env["ir.attachment"].sudo().create({
            "name": name, "datas": data, "mimetype": mimetype,
            "res_model": record._name, "res_id": record.id,
            "company_id": record.company_id.id if "company_id" in record._fields else self.env.company.id,
            "public": False,
        })

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
        writeoffs = self.env["hr.cash.advance.writeoff"].search([], order="request_date desc, id desc", limit=200) if can_finance else self.env["hr.cash.advance.writeoff"]
        if page == "writeoffs":
            records = [{"id": item.id, "name": item.name, "advance": item.advance_id.name, "employee": item.advance_id.employee_id.name, "amount": item.amount, "reason": item.reason, "date": item.request_date, "state": item.state, "state_label": dict(item._fields["state"].selection).get(item.state), "can_decide": item.state == "submitted" and self.env.user.has_group("hr_expense_management.group_hr_expense_admin")} for item in writeoffs]
        else:
            records = [{
                "id": item.id, "name": item.name, "employee": item.employee_id.name,
                "department": item.department_id.name or _("No Department"),
                "issued": item.issued_amount, "retired": item.retired_amount,
                "outstanding": item.outstanding_amount, "issue_date": item.issue_date,
                "due_date": item.retirement_due_date, "days": item.days_outstanding,
                "age": dict(item._fields["age_bracket"].selection).get(item.age_bracket),
                "state": item.state,
                "state_label": dict(item._fields["state"].selection).get(item.state),
                "can_retire": item.state in ("outstanding", "partial") and can_finance,
                "can_writeoff": item.state in ("outstanding", "partial") and can_finance,
            } for item in advances]
        return {
            "available": True,
            "kpis": {
                "total_outstanding": sum(outstanding.mapped("outstanding_amount")),
                "active": len(outstanding), "overdue": len(overdue),
                "critical": len(outstanding.filtered(lambda item: item.outstanding_amount >= 100000)),
            },
            "can_finance": can_finance,
            "issuable_requests": [self._serialize_request(request) for request in issuable],
            "records": records,
            "advance_options": [{"id": item.id, "name": "%s · %s" % (item.name, item.employee_id.name), "outstanding": item.outstanding_amount} for item in outstanding],
            "charts": {"series": [{"label": label, "value": sum(outstanding.filtered(lambda advance: advance.age_bracket == key).mapped("outstanding_amount"))} for key, label in self.env["hr.cash.advance"]._fields["age_bracket"].selection]},
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
        claim_domain = [("state", "in", ("submitted", "appealed"))]
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
            "charts": {"series": [{"label": _("Claims"), "value": len(claims)}, {"label": _("Requests"), "value": len(requests)}]},
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
        if values.get("receipt_data"):
            attachment = self._app_create_attachment(
                values.get("receipt_name") or _("Request Document"), values["receipt_data"],
                values.get("receipt_mimetype") or "application/octet-stream", request,
            )
            request.write({"attachment_ids": [(4, attachment.id)]})
        if values.get("submit"):
            request.action_submit()
        self.env["hr.expense.audit"].log_event("requests", "request_created", _("Expense request created from the OWL application."), request, "user", origin="owl")
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
        self.env["hr.expense.audit"].log_event("requests", "request_%s" % action, _("Request workflow action completed."), request, "workflow", {"comment": comment or ""}, origin="owl")
        return True

    @api.model
    def app_workflow_decision(self, kind, record_id, decision, comment=None):
        if kind == "claim":
            record = self.env["hr.claim"].browse(int(record_id)).exists()
            if decision == "approve":
                record.action_approve(comment)
            elif decision in ("reject", "return"):
                record._apply_negative_decision(decision, comment)
            elif decision == "appeal":
                record.action_appeal(comment)
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
        self.env["hr.expense.audit"].log_event("advances", "advance_retired", _("Cash advance retirement posted."), advance, "workflow", {"amount": amount, "reference": reference or ""}, origin="owl")
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
        elif page == "reports":
            records = [{
                "id": batch.id, "name": batch.name, "employee": _("Batch"),
                "amount": batch.total_amount, "method": batch.method_id.name,
                "count": batch.claim_count, "date": batch.create_date, "state": batch.state,
            } for batch in batches]
        return {"available": True, "records": records, "methods": [{"id": item.id, "name": item.name} for item in methods], "batches": [{"id": batch.id, "name": batch.name, "amount": batch.total_amount, "count": batch.claim_count, "state": batch.state} for batch in batches], "kpis": {"payable_count": len(claims), "payable_value": sum(claims.mapped("residual_amount")), "paid_count": len(payments.filtered(lambda item: item.state == "completed")), "paid_value": sum(payments.filtered(lambda item: item.state == "completed").mapped("amount"))}, "charts": {"series": [{"label": dict(payments._fields["payment_method"].selection).get(key), "value": sum(payments.filtered(lambda item: item.payment_method == key and item.state == "completed").mapped("amount"))} for key, _label in payments._fields["payment_method"].selection]}}

    @api.model
    def app_process_payment_batch(self, claim_ids, method_id):
        batch = self.env["hr.expense.payment.batch"].create({"method_id": int(method_id), "claim_ids": [(6, 0, [int(item) for item in claim_ids])]})
        batch.action_validate()
        batch.action_process()
        self.env["hr.expense.audit"].log_event("payments", "payment_batch_processed", _("Payment batch processed from the OWL application."), batch, "workflow", {"claim_count": len(claim_ids)}, origin="owl")
        return {"id": batch.id, "name": batch.name, "state": batch.state}

    @api.model
    def _get_petty_cash_page(self, page):
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
        can_finance = self.env.user.has_group("hr_expense_management.group_hr_expense_finance") or self.env.user.has_group("hr_expense_management.group_hr_expense_admin")
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
        self._check_financial_workspace()
        fund = self.env["hr.petty.cash.fund"].browse(int(fund_id)).exists()
        employee = self.env["hr.employee"].browse(int(employee_id)).exists()
        if not fund or not employee or (employee.company_id and employee.company_id != fund.company_id):
            raise UserError(_("Select a valid fund and employee in the same company."))
        fund.write({"custodian_id": employee.id})
        self.env["hr.expense.audit"].log_event("petty_cash", "custodian_assigned", _("Petty cash custodian reassigned."), fund, "configuration", {"employee_id": employee.id}, origin="owl")
        return True

    @api.model
    def app_petty_action(self, kind, record_id, action):
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
        if not (
            self.env.user.has_group("hr_expense_management.group_hr_expense_finance")
            or self.env.user.has_group("hr_expense_management.group_hr_expense_admin")
        ):
            raise AccessError("Only Finance can access this financial workspace.")

    @api.model
    def _get_accounts_page(self, page):
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
        self._check_financial_workspace()
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
        self._check_financial_workspace()
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
        admin_kinds = {"claim_type", "claim_window", "request_type", "approval_rule", "email", "integration", "payment_method"}
        if kind in admin_kinds:
            self._check_admin_workspace()
        elif kind in {"vendor_category", "payment_term"}:
            self._check_financial_workspace()
        else:
            raise UserError(_("Unsupported configuration record type."))
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

    @api.model
    def _check_admin_workspace(self):
        if not self.env.user.has_group("hr_expense_management.group_hr_expense_admin"):
            raise AccessError(_("Only Administrators can access this workspace."))

    @api.model
    def _check_report_workspace(self):
        if not (
            self.env.user.has_group("hr_expense_management.group_hr_expense_manager")
            or self.env.user.has_group("hr_expense_management.group_hr_expense_finance")
            or self.env.user.has_group("hr_expense_management.group_hr_expense_admin")
        ):
            raise AccessError(_("You do not have report access."))

    @api.model
    def _get_setup_page(self, page):
        self._check_admin_workspace()
        company = self.env.company
        policies = self.env["hr.expense.policy"].search([], order="sequence, name")
        configured = [
            bool(company.name), bool(policies), bool(self.env["hr.claim.type"].search_count([])),
            bool(self.env["hr.expense.approval.rule"].search_count([])),
            bool(self.env["hr.expense.payment.method"].search_count([])),
            bool(self.env["hr.expense.theme"].search_count([])),
        ]
        if page == "company":
            records = [{
                "id": company.id, "name": company.name, "email": company.email or "",
                "phone": company.phone or "", "currency": company.currency_id.name,
                "country": company.country_id.name or "", "state": "configured" if company.name else "pending",
            }]
        elif page == "policies":
            records = [self._serialize_policy(item) for item in policies]
        elif page == "onboarding":
            labels = ["Company profile", "Policies", "Claim types", "Approval routes", "Payment methods", "Theme"]
            records = [{"id": index + 1, "name": label, "complete": configured[index], "state": "complete" if configured[index] else "pending"} for index, label in enumerate(labels)]
        else:
            records = []
        return {
            "available": True, "records": records,
            "kpis": {"complete": sum(configured), "total": len(configured), "percent": round(sum(configured) / len(configured) * 100)},
            "company": {"id": company.id, "name": company.name, "email": company.email or "", "phone": company.phone or ""},
        }

    @api.model
    def _serialize_policy(self, policy):
        return {
            "id": policy.id, "code": policy.code, "name": policy.name,
            "type": dict(policy._fields["policy_type"].selection).get(policy.policy_type),
            "description": policy.description or "", "effective_date": policy.effective_date,
            "state": "active" if policy.active else "inactive",
        }

    @api.model
    def _get_teams_page(self, page):
        if not (
            self.env.user.has_group("hr_expense_management.group_hr_expense_manager")
            or self.env.user.has_group("hr_expense_management.group_hr_expense_admin")
        ):
            raise AccessError(_("Only Managers can access Teams."))
        company_domain = [("company_id", "in", [False, self.env.company.id])]
        employees = self.env["hr.employee"].sudo().search(company_domain, order="name")
        departments = self.env["hr.department"].sudo().search(company_domain, order="name")
        claims = self.env["hr.claim"].sudo().search([("company_id", "=", self.env.company.id)])
        requests = self.env["hr.expense.request"].sudo().search([("company_id", "=", self.env.company.id)])
        exposure = defaultdict(float)
        for claim in claims.filtered(lambda item: item.state in ("submitted", "approved")):
            exposure[claim.employee_id.id] += claim.residual_amount or claim.amount_total
        for request in requests.filtered(lambda item: item.state in ("submitted", "approved")):
            exposure[request.employee_id.id] += request.amount
        if page == "departments":
            records = []
            for department in departments:
                members = employees.filtered(lambda item: item.department_id == department)
                records.append({
                    "id": department.id, "name": department.name,
                    "manager": department.manager_id.name or _("Not assigned"),
                    "members": len(members), "exposure": sum(exposure[item.id] for item in members),
                    "state": "active" if department.active else "inactive",
                })
        elif page == "roles":
            role_specs = [
                ("Employee", "group_hr_expense_employee", "Submit Claims · View Own Claims · Create Requests"),
                ("Manager", "group_hr_expense_manager", "Approve/Reject · Reports · Manage Team · View All Claims"),
                ("Finance", "group_hr_expense_finance", "Process Payments · All Claims · Generate Reports"),
                ("Admin", "group_hr_expense_admin", "Full System Access · Users · Settings · Audit"),
            ]
            records = []
            for index, (label, xmlid, permissions) in enumerate(role_specs):
                group = self.env.ref("hr_expense_management.%s" % xmlid)
                records.append({"id": index + 1, "name": label, "members": len(group.sudo().users), "permissions": permissions, "state": "active"})
        else:
            records = [{
                "id": item.id, "name": item.name,
                "department": item.department_id.name or _("No Department"),
                "job": item.job_title or "", "manager": item.parent_id.name or "",
                "email": item.work_email or "", "phone": item.work_phone or "",
                "exposure": exposure[item.id], "state": "active" if item.active else "inactive",
            } for item in employees]
        return {
            "available": True, "records": records,
            "kpis": {"members": len(employees), "departments": len(departments), "managers": len(employees.filtered(lambda item: item.child_ids)), "exposure": sum(exposure.values())},
            "charts": {
                "departments": [{"label": item.name, "value": len(employees.filtered(lambda employee: employee.department_id == item))} for item in departments],
                "roles": [{"label": "Managers", "value": len(employees.filtered(lambda item: item.child_ids))}, {"label": "Employees", "value": len(employees.filtered(lambda item: not item.child_ids))}],
            },
        }

    @api.model
    def _get_reports_page(self, page):
        self._check_report_workspace()
        company = self.env.company
        Claim = self.env["hr.claim"].sudo().with_company(company)
        Request = self.env["hr.expense.request"].sudo().with_company(company)
        Payment = self.env["hr.claim.payment"].sudo().with_company(company)
        claims = Claim.search([("company_id", "=", company.id)])
        requests = Request.search([("company_id", "=", company.id)])
        payments = Payment.search([("company_id", "=", company.id)])
        custom = self.env["hr.expense.custom.report"].search([])
        scheduled = self.env["hr.expense.scheduled.report"].search([])
        if page == "custom":
            records = [{"id": item.id, "name": item.name, "type": dict(item._fields["report_type"].selection).get(item.report_type), "owner": item.owner_id.name, "basis": dict(item._fields["date_basis"].selection).get(item.date_basis), "state": "active" if item.active else "inactive"} for item in custom]
        elif page == "scheduled":
            records = [{"id": item.id, "name": item.name, "report": item.report_id.name, "frequency": dict(item._fields["frequency"].selection).get(item.frequency), "next_run": item.next_run, "recipients": len(item.recipient_ids), "format": item.format.upper(), "state": "active" if item.active else "inactive"} for item in scheduled]
        elif page == "employees":
            employee_ids = (claims.mapped("employee_id") | requests.mapped("employee_id"))
            records = [{
                "id": employee.id, "name": employee.name,
                "department": employee.department_id.name or _("No Department"),
                "claims": len(claims.filtered(lambda item: item.employee_id == employee)),
                "submitted": sum(claims.filtered(lambda item: item.employee_id == employee).mapped("amount_total")),
                "paid": sum(payments.filtered(lambda item: item.employee_id == employee and item.state == "completed").mapped("amount")),
                "requests": sum(requests.filtered(lambda item: item.employee_id == employee).mapped("amount")),
                "state": "active",
            } for employee in employee_ids]
        else:
            by_department = defaultdict(lambda: {"claims": 0, "submitted": 0.0, "approved": 0.0, "paid": 0.0})
            for claim in claims:
                key = claim.department_id.name or _("No Department")
                by_department[key]["claims"] += 1
                by_department[key]["submitted"] += claim.amount_total
                if claim.state in ("approved", "paid"):
                    by_department[key]["approved"] += claim.amount_total
            for payment in payments.filtered(lambda item: item.state == "completed"):
                by_department[payment.employee_id.department_id.name or _("No Department")]["paid"] += payment.amount
            records = [dict(id=index + 1, name=name, state="reported", **values) for index, (name, values) in enumerate(sorted(by_department.items()))]
        monthly = []
        start = fields.Date.start_of(fields.Date.context_today(self), "month") - relativedelta(months=5)
        for offset in range(6):
            month_start = start + relativedelta(months=offset)
            month_end = month_start + relativedelta(months=1)
            month_claims = claims.filtered(lambda item: item.submitted_date and month_start <= fields.Date.to_date(item.submitted_date) < month_end)
            month_payments = payments.filtered(lambda item: item.payment_date and month_start <= item.payment_date < month_end and item.state == "completed")
            monthly.append({"label": month_start.strftime("%b"), "submitted": sum(month_claims.mapped("amount_total")), "paid": sum(month_payments.mapped("amount"))})
        return {
            "available": True, "records": records,
            "kpis": {"claims": len(claims), "submitted": sum(claims.mapped("amount_total")), "approved": sum(claims.filtered(lambda item: item.state in ("approved", "paid")).mapped("amount_total")), "paid": sum(payments.filtered(lambda item: item.state == "completed").mapped("amount")), "requests": sum(requests.mapped("amount")), "custom": len(custom), "scheduled": len(scheduled.filtered("active"))},
            "charts": {"monthly": monthly},
            "report_options": [{"id": item.id, "name": item.name} for item in custom.filtered("active")],
            "recipient_options": self._get_report_recipient_options(),
        }

    @api.model
    def _get_report_recipient_options(self):
        self._check_report_workspace()
        groups = [
            self.env.ref("hr_expense_management.group_hr_expense_manager").sudo(),
            self.env.ref("hr_expense_management.group_hr_expense_finance").sudo(),
            self.env.ref("hr_expense_management.group_hr_expense_admin").sudo(),
        ]
        users = groups[0].users | groups[1].users | groups[2].users
        users = users.filtered(
            lambda user: user.active and self.env.company in user.company_ids and user.partner_id.email
        )
        return [{"id": user.id, "name": user.name, "email": user.partner_id.email} for user in users.sorted("name")]

    @api.model
    def _get_audit_page(self, page):
        self._check_admin_workspace()
        domain = []
        if page == "users":
            domain = [("category", "=", "user")]
        elif page == "system":
            domain = [("category", "in", ("configuration", "system"))]
        events = self.env["hr.expense.audit"].sudo().search(domain, limit=300)
        records = [{
            "id": item.id, "date": item.event_date, "user": item.user_id.name,
            "module": dict(item._fields["module"].selection).get(item.module),
            "action": item.action.replace("_", " ").title(), "description": item.description,
            "reference": item.record_reference or "", "category": dict(item._fields["category"].selection).get(item.category),
            "origin": dict(item._fields["origin"].selection).get(item.origin),
            "state": item.severity,
        } for item in events]
        if page not in ("system",):
            claim_events = self.env["hr.claim.audit"].sudo().search([], order="date desc, id desc", limit=200)
            records += [{
                "id": "claim-%s" % item.id, "date": item.date, "user": item.user_id.name,
                "module": _("Claims"), "action": dict(item._fields["action"].selection).get(item.action),
                "description": item.description, "reference": item.claim_id.name,
                "category": _("Workflow"), "origin": _("Server"), "state": "info",
            } for item in claim_events]
        records.sort(key=lambda item: str(item.get("date") or ""), reverse=True)
        return {"available": True, "records": records[:300], "kpis": {"events": len(records), "users": len(set(item["user"] for item in records)), "configuration": len(events.filtered(lambda item: item.category == "configuration")), "critical": len(events.filtered(lambda item: item.severity == "critical"))}}

    @api.model
    def _get_settings_page(self, page):
        self._check_admin_workspace()
        company = self.env.company
        policies = self.env["hr.expense.policy"].search([])
        templates = self.env["hr.expense.email.template"].search([])
        integrations = self.env["hr.expense.integration"].search([])
        if page == "policies":
            records = [self._serialize_policy(item) for item in policies]
        elif page == "email":
            records = [{"id": item.id, "name": item.name, "event": dict(item._fields["event"].selection).get(item.event), "subject": item.subject, "state": "active" if item.active else "inactive"} for item in templates]
        elif page == "integrations":
            records = [{"id": item.id, "name": item.name, "provider": dict(item._fields["provider"].selection).get(item.provider), "summary": item.configuration_summary or "", "last_sync": item.last_sync, "state": item.status, "state_label": dict(item._fields["status"].selection).get(item.status)} for item in integrations]
        else:
            records = [{"id": 1, "name": "Approval turnaround", "value": company.expense_default_approval_days, "unit": "days", "state": "active"}, {"id": 2, "name": "Payment turnaround", "value": company.expense_default_payment_days, "unit": "days", "state": "active"}, {"id": 3, "name": "Receipt threshold", "value": company.expense_receipt_threshold, "unit": company.currency_id.symbol, "state": "active"}]
        return {
            "available": True, "records": records,
            "settings": {"require_receipts": company.expense_require_receipts, "receipt_threshold": company.expense_receipt_threshold, "approval_days": company.expense_default_approval_days, "payment_days": company.expense_default_payment_days, "allow_over_budget": company.expense_allow_over_budget, "enable_email": company.expense_enable_email, "enable_appeals": company.expense_enable_appeals},
            "kpis": {"policies": len(policies.filtered("active")), "templates": len(templates.filtered("active")), "integrations": len(integrations.filtered(lambda item: item.status == "connected")), "configured": len(integrations.filtered(lambda item: item.status in ("configured", "connected")))},
        }

    @api.model
    def _serialize_theme(self, theme):
        if not theme:
            return {"primary_color": "#ec4899", "secondary_color": "#8b5cf6", "sidebar_color": "#1f1835", "surface_color": "#f6f7fb", "font_family": "system", "density": "comfortable", "corner_style": "rounded"}
        return {"id": theme.id, "name": theme.name, "primary_color": theme.primary_color, "secondary_color": theme.secondary_color, "sidebar_color": theme.sidebar_color, "surface_color": theme.surface_color, "font_family": theme.font_family, "density": theme.density, "corner_style": theme.corner_style}

    @api.model
    def _get_theme_page(self, page):
        self._check_admin_workspace()
        theme = self.env["hr.expense.theme"].search([], limit=1)
        return {"available": True, "records": [], "theme": self._serialize_theme(theme), "kpis": {"configured": bool(theme)}}

    @api.model
    def app_save_company_settings(self, values):
        self._check_admin_workspace()
        allowed = {
            "expense_require_receipts": bool(values.get("require_receipts")),
            "expense_receipt_threshold": float(values.get("receipt_threshold") or 0),
            "expense_default_approval_days": int(values.get("approval_days") or 0),
            "expense_default_payment_days": int(values.get("payment_days") or 0),
            "expense_allow_over_budget": bool(values.get("allow_over_budget")),
            "expense_enable_email": bool(values.get("enable_email")),
            "expense_enable_appeals": bool(values.get("enable_appeals")),
        }
        self.env.company.sudo().write(allowed)
        self.env["hr.expense.audit"].log_event("settings", "settings_updated", _("Expense settings updated."), self.env.company, "configuration", origin="owl")
        return True

    @api.model
    def app_save_company_profile(self, values):
        self._check_admin_workspace()
        name = (values.get("name") or "").strip()
        if not name:
            raise UserError(_("Company name is required."))
        self.env.company.sudo().write({
            "name": name,
            "email": (values.get("email") or "").strip() or False,
            "phone": (values.get("phone") or "").strip() or False,
        })
        self.env["hr.expense.audit"].log_event(
            "setup", "company_profile_updated", _("Company expense profile updated."),
            self.env.company, "configuration", origin="owl",
        )
        return {"id": self.env.company.id, "name": self.env.company.name,
                "email": self.env.company.email or "", "phone": self.env.company.phone or ""}

    @api.model
    def app_save_theme(self, values):
        self._check_admin_workspace()
        Theme = self.env["hr.expense.theme"]
        theme = Theme.search([], limit=1)
        allowed = {key: values.get(key) for key in ("name", "primary_color", "secondary_color", "sidebar_color", "surface_color", "font_family", "density", "corner_style") if values.get(key)}
        if theme:
            theme.write(allowed)
        else:
            allowed["company_id"] = self.env.company.id
            theme = Theme.create(allowed)
        self.env["hr.expense.audit"].log_event("theme", "theme_updated", _("Application theme updated."), theme, "configuration", origin="owl")
        return self._serialize_theme(theme)

    @api.model
    def app_create_policy(self, values):
        self._check_admin_workspace()
        policy = self.env["hr.expense.policy"].create({
            "name": (values.get("name") or "").strip(), "code": (values.get("code") or "").strip().upper(),
            "policy_type": values.get("policy_type") or "general", "description": values.get("description") or False,
            "effective_date": values.get("effective_date") or fields.Date.context_today(self),
        })
        self.env["hr.expense.audit"].log_event("settings", "policy_created", _("Expense policy created."), policy, "configuration", origin="owl")
        return {"id": policy.id, "name": policy.name}

    @api.model
    def app_create_custom_report(self, values):
        self._check_report_workspace()
        report = self.env["hr.expense.custom.report"].create({
            "name": (values.get("name") or "").strip(), "report_type": values.get("report_type") or "custom",
            "description": values.get("description") or False, "date_basis": values.get("date_basis") or "current_month",
        })
        self.env["hr.expense.audit"].log_event("reports", "report_created", _("Custom report definition created."), report, "configuration", origin="owl")
        return {"id": report.id, "name": report.name}

    @api.model
    def app_create_scheduled_report(self, values):
        self._check_report_workspace()
        recipient_id = int(values.get("recipient_id") or 0)
        allowed_recipients = {item["id"] for item in self._get_report_recipient_options()}
        if recipient_id not in allowed_recipients:
            raise UserError(_("Select an active report recipient with an email address."))
        report = self.env["hr.expense.scheduled.report"].create({
            "name": (values.get("name") or "").strip(), "report_id": int(values.get("report_id")),
            "frequency": values.get("frequency") or "monthly", "format": values.get("format") or "pdf",
            "next_run": values.get("next_run") or fields.Datetime.now(),
            "recipient_ids": [(6, 0, [recipient_id])],
        })
        self.env["hr.expense.audit"].log_event("reports", "schedule_created", _("Scheduled report created."), report, "configuration", origin="owl")
        return {"id": report.id, "name": report.name}

    @api.model
    def app_create_writeoff(self, advance_id, amount, reason):
        item = self.env["hr.cash.advance.writeoff"].create({"advance_id": int(advance_id), "amount": float(amount or 0), "reason": (reason or "").strip()})
        item.action_submit()
        return {"id": item.id, "name": item.name}

    @api.model
    def app_writeoff_decision(self, writeoff_id, decision, note=None):
        item = self.env["hr.cash.advance.writeoff"].browse(int(writeoff_id)).exists()
        if not item:
            raise UserError(_("The write-off no longer exists."))
        if decision == "approve":
            item.action_approve(note)
        elif decision == "reject":
            item.action_reject(note)
        else:
            raise UserError(_("Unsupported write-off decision."))
        return True
