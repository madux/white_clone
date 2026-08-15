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
            "employee": user.has_group("hr_claims.group_hr_claim_employee"),
            "manager": user.has_group("hr_claims.group_hr_claim_manager"),
            "finance": user.has_group("hr_claims.group_hr_claim_finance"),
            "admin": user.has_group("hr_claims.group_hr_claim_admin"),
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
            ], allowed("finance"), False),
            self._app_module("teams", "Teams", "fa-users", [
                ("members", "Members"), ("departments", "Departments"),
                ("roles", "Roles"), ("analytics", "Analytics"),
                ("settings", "Settings"),
            ], allowed("manager"), False),
            self._app_module("accounts", "Accounts", "fa-book", [
                ("accounts", "Accounts"), ("tree", "Tree"),
                ("mapping", "GL Mapping"), ("journals", "Journal Entries"),
                ("settings", "Settings"),
            ], allowed("finance"), False),
            self._app_module("vendors", "Vendors", "fa-building-o", [
                ("directory", "Directory"), ("categories", "Categories"),
                ("claims", "Vendor Claims"), ("terms", "Terms"),
                ("analytics", "Analytics"),
            ], allowed("finance"), False),
            self._app_module("budget", "Budget", "fa-pie-chart", [
                ("overview", "Overview"), ("departments", "By Department"),
                ("variance", "Budget vs Actual"), ("periods", "Periods"),
            ], allowed("finance"), False),
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
                and (self.env.user.has_group("hr_claims.group_hr_claim_finance") or request._is_admin()),
        }

    @api.model
    def _get_advance_page(self, page):
        advances = self.env["hr.cash.advance"].search(
            [], order="issue_date desc, id desc", limit=200
        )
        outstanding = advances.filtered(lambda item: item.state in ("outstanding", "partial"))
        overdue = outstanding.filtered(lambda item: item.retirement_due_date < fields.Date.context_today(item))
        can_finance = (
            self.env.user.has_group("hr_claims.group_hr_claim_finance")
            or self.env.user.has_group("hr_claims.group_hr_claim_admin")
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
                    self.env.user.has_group("hr_claims.group_hr_claim_finance")
                    or self.env.user.has_group("hr_claims.group_hr_claim_admin")
                ),
            } for item in advances],
        }

    @api.model
    def _get_workflow_page(self, page):
        if not (
            self.env.user.has_group("hr_claims.group_hr_claim_manager")
            or self.env.user.has_group("hr_claims.group_hr_claim_admin")
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
