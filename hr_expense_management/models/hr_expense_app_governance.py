from collections import defaultdict

from dateutil.relativedelta import relativedelta

from odoo import _, api, fields, models
from odoo.exceptions import UserError


class HrExpenseAppGovernance(models.AbstractModel):
    _inherit = "hr.expense.app"

    @api.model
    def _check_admin_workspace(self):
        return self._expense_check_role(
            "admin", message=_("Only Administrators can access this workspace.")
        )

    @api.model
    def _check_report_workspace(self):
        return self._expense_check_role(
            "manager", "finance", "admin", message=_("You do not have report access.")
        )

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
        self._expense_check_role("manager", "admin", message=_("Only Managers can access Teams."))
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

