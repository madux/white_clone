import json
import re

from dateutil.relativedelta import relativedelta

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError


class HrExpenseAudit(models.Model):
    _name = "hr.expense.audit"
    _description = "Expense Management Audit Event"
    _order = "event_date desc, id desc"
    _check_company_auto = True

    event_date = fields.Datetime(required=True, default=fields.Datetime.now, index=True)
    user_id = fields.Many2one("res.users", required=True, default=lambda self: self.env.user, index=True)
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)
    module = fields.Selection([
        ("claims", "Claims"), ("requests", "Requests"), ("advances", "Advances"),
        ("payments", "Payments"), ("petty_cash", "Petty Cash"),
        ("accounts", "Accounts"), ("vendors", "Vendors"), ("budget", "Budget"),
        ("setup", "Setup"), ("teams", "Teams"), ("reports", "Reports"), ("settings", "Settings"),
        ("theme", "Theme"), ("system", "System"),
    ], required=True, default="system", index=True)
    action = fields.Char(required=True, index=True)
    category = fields.Selection([
        ("user", "User Action"), ("workflow", "Workflow"),
        ("configuration", "Configuration"), ("system", "System"),
    ], required=True, default="user", index=True)
    model_name = fields.Char(index=True)
    record_id = fields.Integer(index=True)
    record_reference = fields.Char(index=True)
    description = fields.Text(required=True)
    details_json = fields.Text(default="{}", readonly=True)
    severity = fields.Selection([
        ("info", "Information"), ("warning", "Warning"), ("critical", "Critical")
    ], default="info", required=True, index=True)
    origin = fields.Selection([
        ("owl", "OWL Application"), ("server", "Server"), ("scheduler", "Scheduler")
    ], default="server", required=True)

    @api.model
    def log_event(self, module, action, description, record=None, category="user",
                  details=None, severity="info", origin="server"):
        """Append an immutable, company-scoped audit event."""
        return self.sudo().create({
            "module": module, "action": action, "description": description,
            "category": category, "severity": severity, "origin": origin,
            "company_id": (record.company_id.id if record and "company_id" in record._fields else self.env.company.id),
            "user_id": self.env.user.id,
            "model_name": record._name if record else False,
            "record_id": record.id if record else False,
            "record_reference": (record.display_name if record else False),
            "details_json": json.dumps(details or {}, default=str, sort_keys=True),
        })

    def write(self, vals):
        raise AccessError(_("Audit events are immutable."))

    def unlink(self):
        if self.env.context.get("uninstall_mode"):
            return super().unlink()
        raise AccessError(_("Audit events are immutable."))


class HrExpensePolicy(models.Model):
    _name = "hr.expense.policy"
    _description = "Expense Policy"
    _order = "sequence, name"
    _check_company_auto = True

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    sequence = fields.Integer(default=10)
    policy_type = fields.Selection([
        ("claim", "Claims"), ("request", "Requests"), ("advance", "Advances"),
        ("payment", "Payments"), ("petty_cash", "Petty Cash"), ("general", "General"),
    ], default="general", required=True)
    description = fields.Html()
    effective_date = fields.Date(default=fields.Date.context_today)
    active = fields.Boolean(default=True)
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)

    _sql_constraints = [("expense_policy_code_company_uniq", "unique(code, company_id)", "Policy codes must be unique per company.")]


class HrExpenseEmailTemplate(models.Model):
    _name = "hr.expense.email.template"
    _description = "Expense Notification Template"
    _order = "event, name"
    _check_company_auto = True

    name = fields.Char(required=True)
    event = fields.Selection([
        ("submitted", "Submitted"), ("approved", "Approved"), ("rejected", "Rejected"),
        ("returned", "Returned"), ("paid", "Paid"), ("overdue", "Overdue"),
        ("replenishment", "Replenishment"), ("scheduled_report", "Scheduled Report"),
    ], required=True)
    subject = fields.Char(required=True)
    body_html = fields.Html(required=True)
    active = fields.Boolean(default=True)
    mail_template_id = fields.Many2one("mail.template", ondelete="set null")
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)


class HrExpenseIntegration(models.Model):
    _name = "hr.expense.integration"
    _description = "Expense Integration Adapter"
    _order = "sequence, name"
    _check_company_auto = True

    name = fields.Char(required=True)
    provider = fields.Selection([
        ("bank", "Bank / NIBSS"), ("paystack", "Paystack"), ("payroll", "Payroll"),
        ("quickbooks", "QuickBooks"), ("sage", "Sage"), ("storage", "Document Storage"),
        ("other", "Other"),
    ], required=True)
    sequence = fields.Integer(default=10)
    status = fields.Selection([
        ("not_configured", "Not Configured"), ("configured", "Configured"),
        ("connected", "Connected"), ("error", "Error"),
    ], default="not_configured", required=True, readonly=True)
    active = fields.Boolean(default=True)
    configuration_summary = fields.Text(help="Non-secret configuration summary only.")
    last_sync = fields.Datetime(readonly=True)
    last_message = fields.Text(readonly=True)
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)


class HrExpenseTheme(models.Model):
    _name = "hr.expense.theme"
    _description = "Expense Application Theme"
    _check_company_auto = True

    name = fields.Char(required=True, default="Company Theme")
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)
    primary_color = fields.Char(default="#ec4899", required=True)
    secondary_color = fields.Char(default="#8b5cf6", required=True)
    sidebar_color = fields.Char(default="#1f1835", required=True)
    surface_color = fields.Char(default="#f6f7fb", required=True)
    font_family = fields.Selection([
        ("system", "System"), ("inter", "Inter"), ("roboto", "Roboto"), ("serif", "Serif")
    ], default="system", required=True)
    density = fields.Selection([("compact", "Compact"), ("comfortable", "Comfortable")], default="comfortable", required=True)
    corner_style = fields.Selection([("square", "Square"), ("soft", "Soft"), ("rounded", "Rounded")], default="rounded", required=True)
    active = fields.Boolean(default=True)

    _sql_constraints = [("expense_theme_company_uniq", "unique(company_id)", "Only one expense theme is allowed per company.")]

    @api.constrains("primary_color", "secondary_color", "sidebar_color", "surface_color")
    def _check_colors(self):
        for theme in self:
            for field_name in ("primary_color", "secondary_color", "sidebar_color", "surface_color"):
                if not re.fullmatch(r"#[0-9a-fA-F]{6}", theme[field_name] or ""):
                    raise ValidationError(_("Theme colors must use six-digit hex values."))


class HrExpenseCustomReport(models.Model):
    _name = "hr.expense.custom.report"
    _description = "Expense Custom Report"
    _order = "name"
    _check_company_auto = True

    name = fields.Char(required=True)
    report_type = fields.Selection([
        ("financial", "Financial"), ("claims", "Claims"), ("employees", "Employees"),
        ("vendors", "Vendors"), ("budgets", "Budgets"), ("custom", "Custom"),
    ], default="custom", required=True)
    description = fields.Text()
    date_basis = fields.Selection([
        ("current_month", "Current Month"), ("current_quarter", "Current Quarter"),
        ("current_year", "Current Year"), ("all", "All Time"),
    ], default="current_month", required=True)
    columns_json = fields.Text(default="[]")
    filters_json = fields.Text(default="{}")
    active = fields.Boolean(default=True)
    owner_id = fields.Many2one("res.users", required=True, default=lambda self: self.env.user)
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)


class HrExpenseScheduledReport(models.Model):
    _name = "hr.expense.scheduled.report"
    _description = "Scheduled Expense Report"
    _order = "next_run, name"
    _check_company_auto = True

    name = fields.Char(required=True)
    report_id = fields.Many2one("hr.expense.custom.report", required=True, ondelete="cascade", check_company=True)
    frequency = fields.Selection([
        ("daily", "Daily"), ("weekly", "Weekly"), ("monthly", "Monthly"), ("quarterly", "Quarterly")
    ], default="monthly", required=True)
    next_run = fields.Datetime(required=True, default=fields.Datetime.now)
    recipient_ids = fields.Many2many("res.users", string="Recipients")
    format = fields.Selection([("pdf", "PDF"), ("xlsx", "Excel"), ("csv", "CSV")], default="pdf", required=True)
    active = fields.Boolean(default=True)
    last_run = fields.Datetime(readonly=True)
    last_status = fields.Selection([("success", "Success"), ("failed", "Failed")], readonly=True)
    company_id = fields.Many2one("res.company", related="report_id.company_id", store=True, readonly=True)

    def _next_delivery(self, base=None):
        self.ensure_one()
        base = base or self.next_run or fields.Datetime.now()
        delta = {
            "daily": relativedelta(days=1), "weekly": relativedelta(weeks=1),
            "monthly": relativedelta(months=1), "quarterly": relativedelta(months=3),
        }[self.frequency]
        return base + delta

    def action_queue_delivery(self):
        for schedule in self:
            recipients = schedule.recipient_ids.filtered(lambda user: user.partner_id.email)
            if not recipients:
                schedule.write({"last_run": fields.Datetime.now(), "last_status": "failed", "next_run": schedule._next_delivery()})
                self.env["hr.expense.audit"].log_event(
                    "reports", "scheduled_report_failed",
                    _("Scheduled report has no recipients with email addresses."), schedule,
                    "system", severity="warning", origin="scheduler",
                )
                continue
            body = _("<p>Your scheduled Expense Management report <strong>%s</strong> is ready.</p><p>Open Expense Management → Reports to view the latest record-rule-filtered figures.</p>") % schedule.report_id.name
            self.env["mail.mail"].sudo().create({
                "subject": _("Expense report: %s") % schedule.report_id.name,
                "body_html": body,
                "email_to": ",".join(recipients.mapped("partner_id.email")),
                "auto_delete": True,
            })
            schedule.write({"last_run": fields.Datetime.now(), "last_status": "success", "next_run": schedule._next_delivery()})
            self.env["hr.expense.audit"].log_event(
                "reports", "scheduled_report_queued", _("Scheduled report email queued."),
                schedule, "system", {"recipient_count": len(recipients)}, origin="scheduler",
            )
        return True

    @api.model
    def _cron_queue_due_reports(self):
        due = self.search([("active", "=", True), ("next_run", "<=", fields.Datetime.now())])
        for company in due.mapped("company_id"):
            due.filtered(lambda item: item.company_id == company).with_company(company).action_queue_delivery()
        return True


class ResCompanyExpenseSettings(models.Model):
    _inherit = "res.company"

    expense_require_receipts = fields.Boolean(default=True)
    expense_receipt_threshold = fields.Monetary(default=0, currency_field="currency_id")
    expense_default_approval_days = fields.Integer(default=3)
    expense_default_payment_days = fields.Integer(default=5)
    expense_allow_over_budget = fields.Boolean(default=False)
    expense_enable_email = fields.Boolean(default=True)
    expense_enable_appeals = fields.Boolean(default=True)
    expense_setup_completed = fields.Boolean(default=False)

    @api.constrains("expense_receipt_threshold", "expense_default_approval_days", "expense_default_payment_days")
    def _check_expense_settings(self):
        for company in self:
            if company.expense_receipt_threshold < 0 or company.expense_default_approval_days < 0 or company.expense_default_payment_days < 0:
                raise ValidationError(_("Expense limits and turnaround days cannot be negative."))


class HrCashAdvanceWriteoff(models.Model):
    _name = "hr.cash.advance.writeoff"
    _description = "Cash Advance Write-Off"
    _inherit = ["mail.thread", "mail.activity.mixin", "hr.expense.security.mixin"]
    _order = "request_date desc, id desc"
    _check_company_auto = True

    name = fields.Char(default="New", readonly=True, copy=False)
    advance_id = fields.Many2one("hr.cash.advance", required=True, check_company=True, ondelete="restrict")
    company_id = fields.Many2one(related="advance_id.company_id", store=True, readonly=True, index=True)
    currency_id = fields.Many2one(related="advance_id.currency_id", store=True, readonly=True)
    amount = fields.Monetary(required=True, currency_field="currency_id")
    reason = fields.Text(required=True)
    request_date = fields.Date(default=fields.Date.context_today, required=True)
    state = fields.Selection([
        ("draft", "Draft"), ("submitted", "Pending Approval"), ("approved", "Approved"),
        ("rejected", "Rejected"), ("posted", "Posted"), ("cancelled", "Cancelled"),
    ], default="draft", required=True, tracking=True, index=True)
    requested_by_id = fields.Many2one("res.users", default=lambda self: self.env.user, readonly=True)
    decided_by_id = fields.Many2one("res.users", readonly=True)
    decision_date = fields.Datetime(readonly=True)
    decision_note = fields.Text(readonly=True)
    expense_move_id = fields.Many2one(
        "account.move", string="Accounting Entry", readonly=True, check_company=True
    )

    @api.model_create_multi
    def create(self, vals_list):
        self._expense_check_role(
            "finance", "admin", message=_("Only Finance can request an advance write-off.")
        )
        for vals in vals_list:
            if vals.get("name", "New") == "New":
                vals["name"] = self.env["ir.sequence"].next_by_code("hr.cash.advance.writeoff") or "New"
        return super().create(vals_list)

    @api.constrains("amount", "advance_id")
    def _check_amount(self):
        for item in self:
            if item.amount <= 0 or item.currency_id.compare_amounts(item.amount, item.advance_id.outstanding_amount) > 0:
                raise ValidationError(_("The write-off must be positive and cannot exceed the outstanding advance."))

    def action_submit(self):
        for item in self:
            if item.state != "draft":
                raise UserError(_("Only draft write-offs can be submitted."))
            item.write({"state": "submitted"})
            self.env["hr.expense.audit"].log_event("advances", "writeoff_submitted", _("Advance write-off submitted."), item, "workflow")
        return True

    def action_approve(self, note=None):
        if not self._expense_has_role("admin"):
            raise AccessError(_("An Administrator must approve advance write-offs."))
        for item in self:
            if item.state != "submitted":
                raise UserError(_("Only submitted write-offs can be approved."))
            item.write({"state": "posted", "decided_by_id": self.env.user.id, "decision_date": fields.Datetime.now(), "decision_note": note or False})
            retirement = self.env["hr.cash.advance.retirement"].sudo().create({
                "advance_id": item.advance_id.id, "amount": item.amount,
                "reference": _("Write-off %s") % item.name, "state": "posted",
                "processed_by_id": self.env.user.id,
            })
            item.advance_id.invalidate_recordset(["retired_amount", "outstanding_amount"])
            next_state = "written_off" if item.currency_id.is_zero(item.advance_id.outstanding_amount) else "partial"
            item.advance_id.sudo().write({"state": next_state})
            self.env["hr.expense.audit"].log_event("advances", "writeoff_posted", _("Advance write-off approved and posted."), item, "workflow", {"retirement_id": retirement.id})
        return True

    def action_reject(self, note):
        if not self._expense_has_role("admin"):
            raise AccessError(_("An Administrator must reject advance write-offs."))
        if not (note or "").strip():
            raise ValidationError(_("A rejection reason is required."))
        for item in self:
            if item.state != "submitted":
                raise UserError(_("Only submitted write-offs can be rejected."))
            item.write({"state": "rejected", "decided_by_id": self.env.user.id, "decision_date": fields.Datetime.now(), "decision_note": note})
        return True
