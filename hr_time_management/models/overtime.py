from datetime import datetime, time, timedelta

import pytz

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class CleonOvertimeRequest(models.Model):
    _name = "cleon.overtime.request"
    _description = "CleonHR Overtime Request"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "date desc, id desc"

    name = fields.Char(default=lambda self: _("New"), readonly=True, copy=False)
    employee_id = fields.Many2one("hr.employee", required=True, index=True, tracking=True)
    company_id = fields.Many2one(related="employee_id.company_id", store=True, index=True)
    date = fields.Date(required=True, index=True, tracking=True)
    start_time = fields.Datetime(tracking=True)
    end_time = fields.Datetime(tracking=True)
    regular_hours = fields.Float(readonly=True)
    overtime_hours = fields.Float(required=True, tracking=True)
    category = fields.Selection([
        ("daily", "Daily Overtime"), ("weekend", "Weekend Overtime"),
        ("holiday", "Holiday Overtime"), ("special", "Special Assignment"),
        ("on_call", "On-call Work"),
    ], required=True, default="daily", index=True, tracking=True)
    source = fields.Selection([
        ("attendance", "Auto Attendance"), ("employee", "Employee Request"),
        ("manager", "Manager Entry"),
    ], required=True, default="employee", index=True)
    state = fields.Selection([
        ("auto", "Auto-calculated"), ("submitted", "Pending Approval"),
        ("approved", "Approved"), ("rejected", "Rejected"),
        ("withdrawn", "Withdrawn"),
    ], required=True, default="submitted", index=True, tracking=True)
    justification = fields.Text()
    attachment = fields.Binary(attachment=True)
    attachment_name = fields.Char()
    attendance_id = fields.Many2one("hr.attendance", ondelete="set null", index=True)
    multiplier = fields.Float(default=1.5, readonly=True)
    estimated_cost = fields.Monetary(compute="_compute_estimated_cost", store=True)
    currency_id = fields.Many2one(related="company_id.currency_id", store=True)
    approver_id = fields.Many2one("res.users", readonly=True)
    decision_at = fields.Datetime(readonly=True)
    manager_comment = fields.Text(readonly=True)
    payroll_state = fields.Selection([
        ("not_ready", "Not Ready"),
        ("ready", "Ready for Payroll"),
        ("transferred", "Transferred to Payroll"),
    ], default="not_ready", required=True, readonly=True, index=True)

    _sql_constraints = [
        ("attendance_unique", "unique(attendance_id)", "Overtime was already generated for this attendance record."),
        ("positive_hours", "check(overtime_hours > 0 AND overtime_hours <= 24)", "Overtime must be greater than zero and no more than 24 hours."),
    ]

    @api.depends("overtime_hours", "multiplier", "employee_id")
    def _compute_estimated_cost(self):
        for request in self:
            hourly_cost = getattr(request.employee_id, "hourly_cost", 0.0) or 0.0
            request.estimated_cost = request.overtime_hours * request.multiplier * hourly_cost

    @api.model_create_multi
    def create(self, vals_list):
        for values in vals_list:
            if not values.get("name") or values["name"] == _("New"):
                values["name"] = "OT/%s" % fields.Datetime.now().strftime("%Y%m%d%H%M%S%f")
        return super().create(vals_list)

    def _audit(self, action, details, source="web"):
        for request in self:
            self.env["cleon.time.audit.log"].sudo().create({
                "employee_id": request.employee_id.id, "action": action,
                "module_area": "overtime", "entity_type": "overtime_request",
                "entity_name": request.name, "entity_id": request.id,
                "details": details, "status": "success", "source": source,
                "company_id": request.company_id.id,
            })

    @api.model
    def _manager_allowed(self):
        Policy = self.env["cleon.time.policy"]
        role = Policy._tm_role()
        return role in ("line_manager", "hr_manager", "hr_admin", "system_admin")

    @api.model
    def _sync_attendance_overtime(self):
        """Materialize calculated overtime once, keeping attendance authoritative."""
        if not self._manager_allowed():
            return
        Policy = self.env["cleon.time.policy"]
        allowed_emp_ids = Policy._tm_scope_employee_ids()
        cutoff = fields.Datetime.now() - timedelta(days=366)
        attendances = self.env["hr.attendance"].sudo().search([
            ("employee_id.company_id", "=", self.env.company.id),
            ("employee_id", "in", allowed_emp_ids),
            ("check_out", "!=", False), ("check_in", ">=", cutoff),
            ("id", "not in", self.sudo().search([("attendance_id", "!=", False)]).mapped("attendance_id").ids),
        ])
        for attendance in attendances:
            local_date = pytz.UTC.localize(attendance.check_in).astimezone(
                pytz.timezone(self.env.user.tz or "UTC")
            ).date()
            values = self.env["hr.attendance"]._time_integration_values(
                attendance, attendance.employee_id, local_date, attendance.cleon_shift_id
            )
            if values["overtime_hours"] <= 0:
                continue
            request = self.sudo().create({
                "employee_id": attendance.employee_id.id, "date": local_date,
                "start_time": attendance.check_in, "end_time": attendance.check_out,
                "regular_hours": max(0.0, values["net_hours"] - values["overtime_hours"]),
                "overtime_hours": values["overtime_hours"], "category": values["overtime_category"],
                "source": "attendance", "state": "auto", "attendance_id": attendance.id,
                "multiplier": values["overtime_rate"],
                "justification": _("Automatically calculated from attendance."),
            })
            request._audit("created", _("Overtime automatically calculated from attendance."), "system")

    @api.model
    def submit_manual_request(self, values):
        employee = self.env.user.employee_id
        if not employee:
            raise ValidationError(_("Your user is not linked to an employee record."))
        target_date = fields.Date.to_date(values.get("date"))
        if not target_date:
            raise ValidationError(_("Select an overtime date."))
        today = fields.Date.context_today(self)
        if target_date > today or target_date < today - timedelta(days=14):
            raise ValidationError(_("Overtime requests must be for one of the past 14 days."))
        justification = (values.get("justification") or "").strip()
        if len(justification) < 30 or len(justification) > 500:
            raise ValidationError(_("Justification must contain between 30 and 500 characters."))
        start = fields.Datetime.to_datetime(values.get("start_time"))
        end = fields.Datetime.to_datetime(values.get("end_time"))
        if not start or not end or end <= start:
            raise ValidationError(_("End time must be after start time."))
        hours = (end - start).total_seconds() / 3600
        duplicate = self.search_count([
            ("employee_id", "=", employee.id), ("date", "=", target_date),
            ("start_time", "<", end), ("end_time", ">", start),
            ("state", "not in", ("rejected", "withdrawn")),
        ])
        if duplicate:
            raise ValidationError(_("An overtime request already covers this date and time period."))
        policy = self.env["cleon.time.policy"].search([("company_id", "=", employee.company_id.id)], limit=1)
        category = values.get("category", "daily")
        multiplier = {
            "daily": policy.daily_overtime_rate or 1.5,
            "weekend": policy.weekend_overtime_rate or 2.0,
            "holiday": policy.holiday_overtime_rate or 2.5,
        }.get(category, policy.daily_overtime_rate or 1.5) if policy else 1.5
        request = self.create({
            "employee_id": employee.id, "date": target_date, "start_time": start, "end_time": end,
            "overtime_hours": hours, "category": category, "source": "employee",
            "state": "submitted", "justification": justification, "multiplier": multiplier,
        })
        request._audit("submitted", _("Manual overtime request submitted."))
        return {"id": request.id, "name": request.name}

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            self._check_workflow_protection(vals)
        return super().create(vals_list)

    def write(self, vals):
        self._check_workflow_protection(vals)
        return super().write(vals)

    def _check_workflow_protection(self, vals):
        if self.env.su or self.env.user.has_group("base.group_system"):
            return
        if "state" in vals:
            raise AccessError(_("Direct overtime state mutation is prohibited. Use approval/action methods instead."))
        protected_fields = {"manager_comment", "approver_id", "decision_at", "payroll_state"}
        if protected_fields.intersection(vals.keys()):
            raise AccessError(_("Direct decision field mutation is prohibited. Use approval/action methods instead."))

    def action_decide(self, decision, comment=False):
        Policy = self.env["cleon.time.policy"]
        if decision not in ("approve", "reject"):
            raise ValidationError(_("Invalid overtime decision."))
        if decision == "reject" and not (comment or "").strip():
            raise ValidationError(_("A rejection reason is required."))
        for request in self:
            if not Policy._tm_can_approve(request, self.env.user):
                raise AccessError(_("You are not authorized to review this overtime request (self-approval is not permitted for Line Managers)."))
            if request.state not in ("auto", "submitted"):
                raise ValidationError(_("Only pending or auto-calculated overtime can be reviewed."))
            request.sudo().write({
                "state": "approved" if decision == "approve" else "rejected",
                "approver_id": self.env.user.id, "decision_at": fields.Datetime.now(),
                "manager_comment": comment,
                "payroll_state": "ready" if decision == "approve" else "not_ready",
            })
            request._audit("approved" if decision == "approve" else "rejected", comment or _("Overtime approved."))
            request._notify_employee_decision(decision, comment)
        return True

    def _notify_employee_decision(self, decision, comment=False):
        """Notify through Odoo mail without assuming an external mail gateway."""
        for request in self:
            partner = request.employee_id.user_id.partner_id
            if not partner:
                continue
            outcome = _("approved") if decision == "approve" else _("rejected")
            body = _("Your overtime request %(reference)s for %(hours)s hour(s) was %(outcome)s.") % {
                "reference": request.name,
                "hours": round(request.overtime_hours, 2),
                "outcome": outcome,
            }
            if comment:
                body += "<br/>" + _("Manager comment: %s") % comment
            request.message_post(body=body, partner_ids=partner.ids, subtype_xmlid="mail.mt_note")

    def get_payroll_ready_values(self):
        """Stable handoff contract for a future CleonHR payroll connector."""
        self.ensure_one()
        if self.state != "approved" or self.payroll_state not in ("ready", "transferred"):
            raise ValidationError(_("Only approved overtime is eligible for payroll transfer."))
        return {
            "reference": self.name,
            "employee_id": self.employee_id.id,
            "company_id": self.company_id.id,
            "date": fields.Date.to_string(self.date),
            "hours": self.overtime_hours,
            "category": self.category,
            "multiplier": self.multiplier,
            "estimated_cost": self.estimated_cost,
            "currency_id": self.currency_id.id,
        }

    def mark_payroll_transferred(self):
        if not self._manager_allowed():
            raise AccessError(_("Only a Time Management manager can confirm payroll transfer."))
        for request in self:
            request.get_payroll_ready_values()
            request.sudo().write({"payroll_state": "transferred"})
            request._audit("modified", _("Approved overtime marked as transferred to payroll."), "system")
        return True

    @api.model
    def manager_decide(self, request_id, decision, comment=False):
        self.browse(int(request_id)).exists().action_decide(decision, comment)
        return True

    @api.model
    def get_my_overtime(self):
        employee = self.env.user.employee_id
        if not employee:
            return {"rows": [], "kpis": {"total": 0, "approved": 0, "pending": 0}}
        requests = self.search([("employee_id", "=", employee.id)])
        today = fields.Date.context_today(self)
        month_start = today.replace(day=1)
        month = requests.filtered(lambda request: request.date and request.date >= month_start)
        rows = [{
            "id": request.id, "name": request.name,
            "date": fields.Date.to_string(request.date),
            "start_time": fields.Datetime.to_string(request.start_time) if request.start_time else False,
            "end_time": fields.Datetime.to_string(request.end_time) if request.end_time else False,
            "hours": round(request.overtime_hours, 2), "category": request.category,
            "state": request.state, "reason": request.justification or "",
            "cost": round(request.estimated_cost, 2),
            "approver": request.approver_id.name or "",
            "decision_at": fields.Datetime.to_string(request.decision_at) if request.decision_at else False,
            "manager_comment": request.manager_comment or "",
            "payroll_state": request.payroll_state,
        } for request in requests]
        return {"rows": rows, "kpis": {
            "total": round(sum(month.mapped("overtime_hours")), 2),
            "approved": round(sum(month.filtered(lambda request: request.state == "approved").mapped("overtime_hours")), 2),
            "pending": len(month.filtered(lambda request: request.state in ("auto", "submitted"))),
        }}

    @api.model
    def withdraw_request(self, request_id):
        employee = self.env.user.employee_id
        request = self.browse(int(request_id)).exists()
        if not employee or request.employee_id != employee:
            raise AccessError(_("You can only withdraw your own overtime request."))
        if request.state != "submitted":
            raise ValidationError(_("Only a pending overtime request can be withdrawn."))
        request.state = "withdrawn"
        request._audit("withdrawn", _("Employee withdrew the overtime request."))
        return True

    @api.model
    def get_overtime_data(self, page="dashboard", state="all", search=""):
        if not self._manager_allowed():
            raise AccessError(_("Only a Time Management manager can view team overtime."))
        self._sync_attendance_overtime()
        Policy = self.env["cleon.time.policy"]
        allowed_emp_ids = Policy._tm_scope_employee_ids()
        today = fields.Date.context_today(self)
        month_start = today.replace(day=1)
        domain = [("company_id", "=", self.env.company.id), ("employee_id", "in", allowed_emp_ids)]
        if state and state != "all":
            domain.append(("state", "=", state))
        if search:
            domain += ["|", ("employee_id.name", "ilike", search), ("justification", "ilike", search)]
        requests = self.search(domain)
        month = requests.filtered(lambda row: row.date and row.date >= month_start)
        approved = month.filtered(lambda row: row.state == "approved")
        pending = month.filtered(lambda row: row.state in ("auto", "submitted"))
        employees = month.mapped("employee_id")
        rows = [{
            "id": row.id, "name": row.name, "employee": row.employee_id.name,
            "employee_code": row.employee_id.identification_id or "",
            "department": row.employee_id.department_id.name or _("Unassigned"),
            "date": fields.Date.to_string(row.date), "regular_hours": round(row.regular_hours, 2),
            "hours": round(row.overtime_hours, 2), "category": row.category,
            "source": row.source, "state": row.state, "reason": row.justification or "",
            "multiplier": row.multiplier, "cost": round(row.estimated_cost, 2),
            "payroll_state": row.payroll_state,
            "approver": row.approver_id.name or "", "decision_at": fields.Datetime.to_string(row.decision_at) if row.decision_at else False,
        } for row in requests.sorted(lambda row: (row.date, row.id), reverse=True)]
        daily = sum(month.filtered(lambda row: row.category == "daily").mapped("overtime_hours"))
        weekend = sum(month.filtered(lambda row: row.category == "weekend").mapped("overtime_hours"))
        holiday = sum(month.filtered(lambda row: row.category == "holiday").mapped("overtime_hours"))
        return {
            "rows": rows,
            "kpis": {
                "total": round(sum(month.mapped("overtime_hours")), 2),
                "daily": round(daily, 2), "weekend": round(weekend, 2), "holiday": round(holiday, 2),
                "pending": len(pending), "employees": len(employees),
                "cost": round(sum(approved.mapped("estimated_cost")), 2),
                "approved": round(sum(approved.mapped("overtime_hours")), 2),
                "average": round(sum(month.mapped("overtime_hours")) / len(employees), 2) if employees else 0,
            },
        }
