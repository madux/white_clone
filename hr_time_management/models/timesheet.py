from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class AccountAnalyticLine(models.Model):
    _inherit = "account.analytic.line"

    cleon_sheet_id = fields.Many2one(
        "cleon.time.sheet",
        string="Weekly Timesheet Envelope",
        ondelete="set null",
        index=True,
    )
    cleon_billable = fields.Boolean(default=True, string="Billable Entry")
    cleon_locked = fields.Boolean(
        compute="_compute_cleon_locked",
        store=True,
        string="Timesheet Locked",
    )

    @api.depends("cleon_sheet_id.state")
    def _compute_cleon_locked(self):
        for line in self:
            line.cleon_locked = bool(line.cleon_sheet_id and line.cleon_sheet_id.state in ("submitted", "approved"))

    def _is_lock_bypassed(self):
        return bool(self.env.su or self.env.user.has_group("base.group_system"))

    @api.model_create_multi
    def create(self, vals_list):
        lines = super().create(vals_list)
        if not self._is_lock_bypassed():
            for line in lines:
                if line.date and line.employee_id:
                    monday = line.date - timedelta(days=line.date.weekday())
                    sheet = self.env["cleon.time.sheet"].sudo().search([
                        ("company_id", "=", line.company_id.id),
                        ("employee_id", "=", line.employee_id.id),
                        ("week_start", "=", monday),
                        ("state", "in", ("submitted", "approved")),
                    ], limit=1)
                    if sheet:
                        raise AccessError(_("Cannot create time entries in a week that is submitted or approved for employee '%s'.") % line.employee_id.name)
        return lines

    def write(self, vals):
        if not self._is_lock_bypassed():
            for line in self:
                if line.cleon_locked:
                    raise AccessError(_("Timesheet entry '%s' is locked under a submitted or approved weekly timesheet envelope.") % line.name)
                # Compute prospective date and prospective employee
                target_date = fields.Date.to_date(vals["date"]) if "date" in vals else line.date
                target_emp_id = vals["employee_id"] if "employee_id" in vals else line.employee_id.id
                if target_date and target_emp_id:
                    monday = target_date - timedelta(days=target_date.weekday())
                    sheet = self.env["cleon.time.sheet"].sudo().search([
                        ("company_id", "=", line.company_id.id),
                        ("employee_id", "=", target_emp_id),
                        ("week_start", "=", monday),
                        ("state", "in", ("submitted", "approved")),
                    ], limit=1)
                    if sheet and sheet != line.cleon_sheet_id:
                        target_emp_name = self.env["hr.employee"].sudo().browse(target_emp_id).name
                        raise AccessError(_("Cannot move time entry '%s' into a submitted or approved week for employee '%s'.") % (line.name, target_emp_name))
        return super().write(vals)

    def unlink(self):
        if not self._is_lock_bypassed():
            for line in self:
                if line.cleon_locked:
                    raise AccessError(_("Timesheet entry '%s' is locked under a submitted or approved weekly timesheet envelope.") % line.name)
        return super().unlink()


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
    entry_source = fields.Selection([
        ("legacy", "Legacy Sheet Line"),
        ("analytic", "Analytic Timesheet Line"),
    ], default="analytic", required=True, tracking=True)
    analytic_line_ids = fields.One2many("account.analytic.line", "cleon_sheet_id", string="Analytic Timesheet Entries")
    line_ids = fields.One2many("cleon.time.sheet.line", "sheet_id", string="Legacy Entry Lines")
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

    @api.depends("analytic_line_ids.unit_amount", "analytic_line_ids.cleon_billable", "line_ids.hours", "line_ids.billable", "entry_source")
    def _compute_totals(self):
        for sheet in self:
            if sheet.entry_source == "analytic" and sheet.analytic_line_ids:
                sheet.total_hours = sum(sheet.analytic_line_ids.mapped("unit_amount"))
                sheet.billable_hours = sum(sheet.analytic_line_ids.filtered("cleon_billable").mapped("unit_amount"))
            else:
                sheet.total_hours = sum(sheet.line_ids.mapped("hours"))
                sheet.billable_hours = sum(sheet.line_ids.filtered("billable").mapped("hours"))

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            self._check_workflow_protection(vals)
            if vals.get("week_start"):
                emp = self.env["hr.employee"].browse(vals.get("employee_id")).exists()
                c_id = vals.get("company_id") or (emp.company_id.id if emp else self.env.company.id)
                week_start = fields.Date.to_date(vals["week_start"])
                week_end = week_start + timedelta(days=6)
                self.env["cleon.time.period.lock"].check_period_range(c_id, week_start, week_end, _("Weekly Timesheet"))
        return super().create(vals_list)

    def write(self, vals):
        self._check_workflow_protection(vals)
        if not self.env.su and not self.env.user.has_group("base.group_system"):
            for sheet in self:
                c_id = sheet.company_id.id
                w_start = fields.Date.to_date(vals.get("week_start") or sheet.week_start)
                w_end = w_start + timedelta(days=6)
                if w_start:
                    self.env["cleon.time.period.lock"].check_period_range(c_id, w_start, w_end, _("Weekly Timesheet"), vals.get("manager_comment"))
        return super().write(vals)

    def unlink(self):
        if not self.env.su and not self.env.user.has_group("base.group_system"):
            for sheet in self:
                if sheet.week_start:
                    self.env["cleon.time.period.lock"].check_period_range(sheet.company_id.id, sheet.week_start, sheet.week_end, _("Weekly Timesheet"))
        return super().unlink()

    def _check_workflow_protection(self, vals):
        if self.env.su or self.env.user.has_group("base.group_system"):
            return
        if "state" in vals:
            raise AccessError(_("Direct timesheet state mutation is prohibited. Use workflow action methods instead."))
        protected_fields = {"manager_comment", "submitted_at", "approved_at", "approver_id", "entry_source"}
        if protected_fields.intersection(vals.keys()):
            raise AccessError(_("Direct mutation of protected workflow/migration fields is prohibited."))

    def action_migrate_legacy_lines(self):
        """Idempotently convert legacy cleon.time.sheet.line records into account.analytic.line records."""
        Policy = self.env["cleon.time.policy"]
        if Policy._tm_role() not in ("hr_manager", "hr_admin", "system_admin"):
            raise AccessError(_("Only HR managers or System Admins can perform legacy timesheet migration."))
        for sheet in self:
            if sheet.line_ids and not sheet.analytic_line_ids:
                sheet.line_ids._sync_analytic_lines()
                if len(sheet.analytic_line_ids) >= len(sheet.line_ids):
                    sheet.sudo().write({"entry_source": "analytic"})
                else:
                    raise UserError(_("Legacy timesheet migration failed to convert all lines for timesheet %s.") % sheet.id)
        return True

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
                "company_id": sheet.company_id.id,
            })

    def _validate_entries(self):
        for sheet in self:
            if sheet.entry_source == "analytic":
                lines = sheet.analytic_line_ids
                if not lines:
                    raise ValidationError(_("Add at least one time entry before submitting."))
                if any(not (line.name or "").strip() for line in lines):
                    raise ValidationError(_("Every time entry must have a work description."))
                for day in set(lines.mapped("date")):
                    total = sum(lines.filtered(lambda l: l.date == day).mapped("unit_amount"))
                    if total > 24:
                        raise ValidationError(_("Invalid entry: hours cannot exceed 24 in a day."))
            else:
                lines = sheet.line_ids
                if not lines:
                    raise ValidationError(_("Add at least one time entry before submitting."))
                if any(not (line.description or "").strip() for line in lines):
                    raise ValidationError(_("Every time entry must have a work description."))
                for day in set(lines.mapped("date")):
                    total = sum(lines.filtered(lambda l: l.date == day).mapped("hours"))
                    if total > 24:
                        raise ValidationError(_("Invalid entry: hours cannot exceed 24 in a day."))

    def action_submit(self):
        self._assert_owner_or_manager()
        AnalyticLine = self.env["account.analytic.line"]
        for sheet in self:
            if sheet.state not in ("draft", "rejected", "correction"):
                raise ValidationError(_("Only a draft, rejected, or correction-requested timesheet can be submitted."))
            self.env["cleon.time.period.lock"].check_period_range(sheet.company_id.id, sheet.week_start, sheet.week_end, _("Weekly Timesheet Submit"))
            if sheet.entry_source == "analytic":
                candidates = AnalyticLine.sudo().search([
                    ("company_id", "=", sheet.company_id.id),
                    ("employee_id", "=", sheet.employee_id.id),
                    ("date", ">=", sheet.week_start),
                    ("date", "<=", sheet.week_end),
                    "|", ("cleon_sheet_id", "=", False), ("cleon_sheet_id", "=", sheet.id),
                ])
                if candidates:
                    candidates.sudo().write({"cleon_sheet_id": sheet.id})
            sheet._validate_entries()
            sheet.sudo().write({
                "state": "submitted", "submitted_at": fields.Datetime.now(), "manager_comment": False
            })
            sheet._audit("submitted", _("Timesheet submitted for manager approval."))
        return True

    def action_withdraw(self):
        self._assert_owner_or_manager()
        for sheet in self:
            if sheet.state != "submitted":
                raise ValidationError(_("Only a submitted timesheet can be withdrawn."))
            self.env["cleon.time.period.lock"].check_period_range(sheet.company_id.id, sheet.week_start, sheet.week_end, _("Weekly Timesheet Withdraw"))
            if sheet.analytic_line_ids:
                sheet.analytic_line_ids.sudo().write({"cleon_sheet_id": False})
            sheet.sudo().write({"state": "draft", "submitted_at": False})
            sheet._audit("modified", _("Timesheet withdrawn to draft."))
        return True

    def action_decide(self, decision, comment=False):
        Policy = self.env["cleon.time.policy"]
        if decision not in ("approve", "reject", "request_changes"):
            raise ValidationError(_("Invalid timesheet decision."))
        if decision in ("reject", "request_changes") and not (comment or "").strip():
            raise ValidationError(_("A reason is required when rejecting or requesting corrections."))
        for sheet in self:
            if not Policy._tm_can_approve(sheet, self.env.user):
                raise AccessError(_("You are not authorized to review this timesheet (self-approval is not permitted for Line Managers)."))
            if sheet.state != "submitted":
                raise ValidationError(_("Only submitted timesheets can be reviewed."))
            self.env["cleon.time.period.lock"].check_period_range(sheet.company_id.id, sheet.week_start, sheet.week_end, _("Weekly Timesheet Decision"), comment)
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
            sheet.sudo().write(values)
            if decision in ("reject", "request_changes"):
                if sheet.analytic_line_ids:
                    sheet.analytic_line_ids.sudo().write({"cleon_sheet_id": False})
            if decision == "approve" and sheet.line_ids:
                sheet.line_ids._sync_analytic_lines()
            sheet._audit(target_state, comment or _("Timesheet approved."))
        return True

    def unlink(self):
        if not self.env.user.has_group("base.group_system"):
            for sheet in self:
                if sheet.state in ("submitted", "approved"):
                    raise AccessError(_("Submitted or approved weekly timesheets cannot be deleted."))
        return super().unlink()

    @api.model
    def get_tracking_data(self, page="dashboard", state="all", search=""):
        Policy = self.env["cleon.time.policy"]
        Shift = self.env["cleon.hr.shift"]
        role = Policy._tm_role()
        if role not in ("line_manager", "hr_manager", "hr_admin", "system_admin"):
            raise AccessError(_("Only a Time Management manager or administrator can view team timesheets."))
        company = self.env.company
        allowed_emp_ids = Policy._tm_scope_employee_ids()
        domain = [("company_id", "=", company.id), ("employee_id", "in", allowed_emp_ids)]
        if state and state != "all":
            domain.append(("state", "=", state))
        if search:
            domain += [
                "|", ("employee_id.name", "ilike", search),
                "|", ("line_ids.description", "ilike", search),
                ("analytic_line_ids.name", "ilike", search)
            ]
        sheets = self.search(domain, order="week_start desc, submitted_at asc, id desc")
        employee_count = len(allowed_emp_ids)
        current_monday = fields.Date.context_today(self) - timedelta(days=fields.Date.context_today(self).weekday())
        current = self.search([("company_id", "=", company.id), ("employee_id", "in", allowed_emp_ids), ("week_start", "=", current_monday)])

        rows = []
        for sheet in sheets:
            expected_h = Shift._get_expected_hours_for_period(sheet.employee_id.id, sheet.week_start, sheet.week_end)
            rows.append({
                "id": sheet.id, "employee": sheet.employee_id.sudo().name,
                "employee_code": sheet.employee_id.sudo().identification_id or "",
                "department": sheet.employee_id.sudo().department_id.name or "—",
                "week_start": fields.Date.to_string(sheet.week_start),
                "week_end": fields.Date.to_string(sheet.week_end),
                "week": "%s – %s" % (sheet.week_start.strftime("%b %d"), sheet.week_end.strftime("%d")),
                "total": round(sheet.total_hours, 2), "billable": round(sheet.billable_hours, 2),
                "variance": round(sheet.total_hours - expected_h, 2), "state": sheet.state,
                "submitted_at": fields.Datetime.to_string(sheet.submitted_at) if sheet.submitted_at else False,
                "comment": sheet.manager_comment or "",
                "work_item": (sheet.analytic_line_ids[:1].name if sheet.analytic_line_ids else sheet.line_ids[:1].description) or "—",
            })
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


class AccountAnalyticLine(models.Model):
    _inherit = "account.analytic.line"

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if "date" in vals and vals["date"]:
                emp = self.env["hr.employee"].browse(vals.get("employee_id")).exists() if vals.get("employee_id") else self.env.user.employee_id
                c_id = vals.get("company_id") or (emp.company_id.id if emp else self.env.company.id)
                self.env["cleon.time.period.lock"].check_period_lock(c_id, vals["date"], _("Analytic Timesheet Line"))
        return super().create(vals_list)

    def write(self, vals):
        if not self.env.su and not self.env.user.has_group("base.group_system"):
            for rec in self:
                target_emp_id = vals.get("employee_id") or (rec.employee_id.id if rec.employee_id else False)
                emp = self.env["hr.employee"].browse(target_emp_id).exists() if target_emp_id else False
                target_c_id = vals.get("company_id") or (emp.company_id.id if emp else rec.company_id.id or self.env.company.id)
                target_date = vals.get("date") or rec.date
                if target_date:
                    self.env["cleon.time.period.lock"].check_period_lock(target_c_id, target_date, _("Analytic Timesheet Line"))
        return super().write(vals)

    def unlink(self):
        if not self.env.su and not self.env.user.has_group("base.group_system"):
            for rec in self:
                c_id = rec.company_id.id or (rec.employee_id.company_id.id if rec.employee_id else self.env.company.id)
                if rec.date:
                    self.env["cleon.time.period.lock"].check_period_lock(c_id, rec.date, _("Analytic Timesheet Line"))
        return super().unlink()


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
        Analytic = self.env["account.analytic.line"].sudo()
        for line in self:
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
                "cleon_sheet_id": line.sheet_id.id,
                "cleon_billable": line.billable,
            }
            if line.analytic_line_id:
                line.analytic_line_id.sudo().write(values)
            else:
                created = Analytic.create(values)
                line.sudo().write({"analytic_line_id": created.id})
