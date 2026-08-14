from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class CleonTimeSheet(models.Model):
    _name = "cleon.time.sheet"
    _description = "CleonHR Weekly Timesheet"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "week_start desc, id desc"

    employee_id = fields.Many2one("hr.employee", required=True, index=True, tracking=True)
    company_id = fields.Many2one(related="employee_id.company_id", store=True, index=True)
    week_start = fields.Date(required=True, index=True, tracking=True)
    week_end = fields.Date(compute="_compute_week_end", store=True)
    state = fields.Selection([
        ("draft", "Draft"), ("submitted", "Submitted"),
        ("approved", "Approved"), ("rejected", "Rejected"),
        ("correction", "Corrections Requested"),
    ], default="draft", required=True, index=True, tracking=True)
    line_ids = fields.One2many("cleon.time.sheet.line", "sheet_id", string="Entries")
    total_hours = fields.Float(compute="_compute_totals", store=True)
    billable_hours = fields.Float(compute="_compute_totals", store=True)
    submitted_at = fields.Datetime(readonly=True)
    approved_at = fields.Datetime(readonly=True)
    approver_id = fields.Many2one("res.users", readonly=True)
    manager_comment = fields.Text(readonly=True)

    _sql_constraints = [
        ("employee_week_unique", "unique(employee_id, week_start)", "An employee can have only one timesheet per week."),
    ]

    @api.depends("week_start")
    def _compute_week_end(self):
        for sheet in self:
            sheet.week_end = sheet.week_start + timedelta(days=6) if sheet.week_start else False

    @api.depends("line_ids.hours", "line_ids.billable")
    def _compute_totals(self):
        for sheet in self:
            sheet.total_hours = sum(sheet.line_ids.mapped("hours"))
            sheet.billable_hours = sum(sheet.line_ids.filtered("billable").mapped("hours"))

    @api.constrains("week_start")
    def _check_monday(self):
        for sheet in self.filtered("week_start"):
            if sheet.week_start.weekday() != 0:
                raise ValidationError(_("A timesheet week must start on Monday."))

    def _assert_owner_or_manager(self):
        employee = self.env.user.employee_id
        if self.env.user.has_group("hr_time_management.group_time_management_manager") or self.env.user.has_group("base.group_system"):
            return
        if not employee or any(sheet.employee_id != employee for sheet in self):
            raise AccessError(_("You can only manage your own timesheet."))

    def _audit(self, action, details):
        for sheet in self:
            self.env["cleon.time.audit.log"].sudo().create({
                "action": action,
                "module_area": "timesheet",
                "entity_type": "timesheet",
                "entity_name": "%s · %s" % (sheet.employee_id.name, sheet.week_start),
                "entity_id": sheet.id,
                "employee_id": sheet.employee_id.id,
                "details": details,
                "status": "success",
                "source": "web",
            })

    def _validate_entries(self):
        for sheet in self:
            if not sheet.line_ids:
                raise ValidationError(_("Add at least one time entry before submitting."))
            if any(not (line.description or "").strip() for line in sheet.line_ids):
                raise ValidationError(_("Every time entry must have a work description."))
            for day in set(sheet.line_ids.mapped("date")):
                total = sum(sheet.line_ids.filtered(lambda line: line.date == day).mapped("hours"))
                if total > 24:
                    raise ValidationError(_("Invalid entry: hours cannot exceed 24 in a day."))

    def action_submit(self):
        self._assert_owner_or_manager()
        self._validate_entries()
        for sheet in self:
            if sheet.state not in ("draft", "rejected", "correction"):
                raise ValidationError(_("Only a draft, rejected, or correction-requested timesheet can be submitted."))
            sheet.write({"state": "submitted", "submitted_at": fields.Datetime.now(), "manager_comment": False})
            sheet._audit("submitted", _("Timesheet submitted for manager approval."))
        return True

    def action_withdraw(self):
        self._assert_owner_or_manager()
        for sheet in self:
            if sheet.state != "submitted":
                raise ValidationError(_("Only a submitted timesheet can be withdrawn."))
            sheet.write({"state": "draft", "submitted_at": False})
            sheet._audit("modified", _("Timesheet withdrawn to draft."))
        return True

    def action_decide(self, decision, comment=False):
        if not (self.env.user.has_group("hr_time_management.group_time_management_manager") or self.env.user.has_group("base.group_system")):
            raise AccessError(_("Only a Time Management manager can approve timesheets."))
        if decision not in ("approve", "reject", "request_changes"):
            raise ValidationError(_("Invalid timesheet decision."))
        if decision in ("reject", "request_changes") and not (comment or "").strip():
            raise ValidationError(_("A reason is required when rejecting or requesting corrections."))
        for sheet in self:
            if sheet.state != "submitted":
                raise ValidationError(_("Only submitted timesheets can be reviewed."))
            target_state = {
                "approve": "approved",
                "reject": "rejected",
                "request_changes": "correction",
            }[decision]
            values = {
                "state": target_state,
                "approver_id": self.env.user.id,
                "approved_at": fields.Datetime.now(),
                "manager_comment": comment,
            }
            sheet.write(values)
            if decision == "approve":
                sheet.line_ids._sync_analytic_lines()
            sheet._audit(target_state, comment or _("Timesheet approved."))
        return True

    @api.model
    def get_tracking_data(self, page="dashboard", state="all", search=""):
        if not (self.env.user.has_group("hr_time_management.group_time_management_manager") or self.env.user.has_group("base.group_system")):
            raise AccessError(_("Only a Time Management manager can view team timesheets."))
        company = self.env.company
        domain = [("company_id", "=", company.id)]
        if state and state != "all":
            domain.append(("state", "=", state))
        if search:
            domain += ["|", ("employee_id.name", "ilike", search), ("line_ids.description", "ilike", search)]
        sheets = self.search(domain, order="week_start desc, submitted_at asc, id desc")
        employee_count = self.env["hr.employee"].search_count([("company_id", "=", company.id), ("active", "=", True)])
        current_monday = fields.Date.context_today(self) - timedelta(days=fields.Date.context_today(self).weekday())
        current = self.search([("company_id", "=", company.id), ("week_start", "=", current_monday)])
        rows = [{
            "id": sheet.id, "employee": sheet.employee_id.name,
            "employee_code": sheet.employee_id.identification_id or "",
            "department": sheet.employee_id.department_id.name or "—",
            "week_start": fields.Date.to_string(sheet.week_start),
            "week_end": fields.Date.to_string(sheet.week_end),
            "week": "%s – %s" % (sheet.week_start.strftime("%b %d"), sheet.week_end.strftime("%d")),
            "total": round(sheet.total_hours, 2), "billable": round(sheet.billable_hours, 2),
            "variance": round(sheet.total_hours - 40, 2), "state": sheet.state,
            "submitted_at": fields.Datetime.to_string(sheet.submitted_at) if sheet.submitted_at else False,
            "comment": sheet.manager_comment or "",
            "work_item": sheet.line_ids[:1].description or "—",
        } for sheet in sheets]
        return {
            "rows": rows,
            "kpis": {
                "pending": len(current.filtered(lambda row: row.state == "submitted")),
                "submitted": len(current.filtered(lambda row: row.state in ("submitted", "approved"))),
                "expected": employee_count,
                "missing": max(0, employee_count - len(current)),
                "total_hours": round(sum(current.mapped("total_hours")), 2),
            },
        }

    @api.model
    def manager_decide(self, sheet_id, decision, comment=False):
        sheet = self.browse(int(sheet_id)).exists()
        sheet.action_decide(decision, comment)
        return True


class CleonTimeSheetLine(models.Model):
    _name = "cleon.time.sheet.line"
    _description = "CleonHR Timesheet Entry"
    _order = "date, id"

    sheet_id = fields.Many2one("cleon.time.sheet", required=True, ondelete="cascade", index=True)
    date = fields.Date(required=True)
    description = fields.Char(required=True, size=200)
    project_id = fields.Many2one("project.project")
    task_id = fields.Many2one("project.task", domain="[('project_id', '=', project_id)]")
    hours = fields.Float(required=True)
    billable = fields.Boolean(default=False)
    analytic_line_id = fields.Many2one("account.analytic.line", readonly=True, ondelete="set null")

    @api.constrains("hours", "date", "sheet_id")
    def _check_line(self):
        for line in self:
            if line.hours <= 0 or line.hours > 24:
                raise ValidationError(_("Time entry hours must be greater than zero and no more than 24."))
            if line.sheet_id.week_start and not line.sheet_id.week_start <= line.date <= line.sheet_id.week_end:
                raise ValidationError(_("Time entry date must fall within its timesheet week."))
            if line.sheet_id.state not in ("draft", "rejected", "correction"):
                raise ValidationError(_("Timesheets awaiting review or already approved are read-only."))

    def _sync_analytic_lines(self):
        for line in self:
            # Odoo analytic timesheet entries need an analytic account. Keep
            # internal/non-project work in CleonHR without inventing one.
            if not line.project_id or not line.project_id.analytic_account_id:
                continue
            values = {
                "name": line.description,
                "date": line.date,
                "unit_amount": line.hours,
                "employee_id": line.sheet_id.employee_id.id,
                "project_id": line.project_id.id or False,
                "task_id": line.task_id.id or False,
                "account_id": line.project_id.analytic_account_id.id,
                "company_id": line.sheet_id.company_id.id,
            }
            if line.analytic_line_id:
                line.analytic_line_id.sudo().write(values)
            else:
                analytic = self.env["account.analytic.line"].sudo().create(values)
                line.sudo().analytic_line_id = analytic.id
