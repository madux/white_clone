from odoo import api, models


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
            ], allowed("employee", "manager"), False),
            self._app_module("advances", "Advances", "fa-money", [
                ("outstanding", "Outstanding"), ("issue", "Issue Advance"),
                ("retirement", "Retirement"), ("aging", "Age Analysis"),
                ("writeoffs", "Write-Offs"),
            ], allowed("employee", "finance"), False),
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
