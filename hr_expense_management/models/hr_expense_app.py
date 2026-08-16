from odoo import api, models

from .hr_expense_app_contract import (
    APP_CONTRACT_VERSION,
    page_payload,
    public_action_contracts,
)


class HrExpenseApp(models.AbstractModel):
    """Small, security-aware gateway for the OWL expense application.

    Business records remain in normal ORM models with ACLs and record rules.
    This model only describes the current user's capabilities and composes
    already-filtered dashboard data for the client shell.
    """

    _name = "hr.expense.app"
    _description = "Expense Management Application Service"
    _inherit = "hr.expense.security.mixin"

    _PAGE_LOADERS = {
        "dashboard": "_get_dashboard_section",
        "claims": "_get_claims_page",
        "requests": "_get_request_page",
        "advances": "_get_advance_page",
        "workflow": "_get_workflow_page",
        "payments": "_get_payment_page",
        "petty_cash": "_get_petty_cash_page",
        "accounts": "_get_accounts_page",
        "vendors": "_get_vendors_page",
        "budget": "_get_budget_page",
        "setup": "_get_setup_page",
        "teams": "_get_teams_page",
        "reports": "_get_reports_page",
        "audit": "_get_audit_page",
        "settings": "_get_settings_page",
        "theme": "_get_theme_page",
    }

    @api.model
    def get_app_bootstrap(self):
        """Return user capabilities, navigation, theme, and RPC contracts."""
        user = self.env.user
        role = {
            "employee": self._expense_has_role("employee"),
            "manager": self._expense_has_role("manager"),
            "finance": self._expense_has_role("finance"),
            "admin": self._expense_has_role("admin"),
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
            "contract": {
                "version": APP_CONTRACT_VERSION,
                "modules": list(self._PAGE_LOADERS),
                "actions": public_action_contracts(),
            },
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
        """Return a versioned, record-rule-filtered page payload.

        Every loader is normalized to the same envelope.  Adding a module now
        requires one registry entry instead of another dispatcher branch.
        """
        loader_name = self._PAGE_LOADERS.get(module)
        if not loader_name:
            return page_payload(module, page, {"available": False})
        return page_payload(module, page, getattr(self, loader_name)(page))
