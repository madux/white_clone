# -*- coding: utf-8 -*-
from collections import OrderedDict
from dateutil.relativedelta import relativedelta
from odoo import models, fields, api, _
from odoo.exceptions import AccessError, ValidationError, UserError
from odoo.osv import expression
import logging
import math
import base64

_logger = logging.getLogger(__name__)

class HrLeave(models.Model):
    _inherit = "hr.leave"

    # Admin Creation & Attribution Fields (FR-108 to FR-109)
    admin_created = fields.Boolean(
        string="Created by Administrator",
        readonly=True,
        copy=False,
        index=True,
    )
    admin_created_by_id = fields.Many2one(
        "res.users",
        string="Created By Administrator",
        readonly=True,
        copy=False,
    )
    admin_created_at = fields.Datetime(
        string="Created At",
        readonly=True,
        copy=False,
    )
    admin_creation_note = fields.Text(
        string="Admin Note / Reason",
        readonly=True,
        copy=False,
    )
    admin_overlap_override = fields.Boolean(
        string="Overlap Overridden",
        readonly=True,
        copy=False,
    )

    # Screen 10: Leave Request Detail Fields (FR-115, FR-136)
    request_ref = fields.Char(
        string="Request ID",
        readonly=True,
        copy=False,
        index=True,
    )
    is_cancelled = fields.Boolean(
        string="Is Cancelled",
        readonly=True,
        copy=False,
        index=True,
    )
    cancelled_by_id = fields.Many2one(
        "res.users",
        string="Cancelled By",
        readonly=True,
        copy=False,
    )
    cancelled_at = fields.Datetime(
        string="Cancelled At",
        readonly=True,
        copy=False,
    )
    cancellation_reason = fields.Text(
        string="Cancellation Reason",
        readonly=True,
        copy=False,
    )
    approval_line_ids = fields.One2many(
        "hr.leave.approval.line", "leave_id", string="Approval Timeline", copy=False,
    )
    escalated = fields.Boolean(readonly=True, copy=False, index=True)
    escalation_note = fields.Text(readonly=True, copy=False)
    escalated_by_id = fields.Many2one("res.users", readonly=True, copy=False)
    escalated_at = fields.Datetime(readonly=True, copy=False)
    rejection_reason = fields.Text(readonly=True, copy=False)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not vals.get("request_ref"):
                vals["request_ref"] = (
                    self.env["ir.sequence"].next_by_code("hr.leave.request.ref") or _("New")
                )
        leaves = super().create(vals_list)
        for leave in leaves:
            if not leave.admin_created:
                leave._create_audit_record("submitted", note=leave.notes or "")
            # Odoo may create an HR-approved leave type directly in the
            # "To Approve" state, without calling action_confirm().
            if leave.state in ("confirm", "validate1"):
                leave._initialize_configured_approval_lines()
        return leaves

    def action_confirm(self):
        result = super().action_confirm()
        self._initialize_configured_approval_lines()
        return result

    def _resolve_stage_approver(self, stage):
        self.ensure_one()
        employee = self.employee_id
        if stage.approver_type == "direct_manager":
            return employee.leave_manager_id or employee.parent_id.user_id
        if stage.approver_type == "department_head":
            return employee.department_id.manager_id.user_id if employee.department_id.manager_id else False
        group_xmlid = {
            "hr_manager": "hr_holidays.group_hr_holidays_manager",
            "hr_director": "hr_holidays.group_hr_holidays_manager",
            "finance_director": "account.group_account_manager",
            "ceo": "base.group_system",
        }.get(stage.approver_type)
        group = self.env.ref(group_xmlid, raise_if_not_found=False) if group_xmlid else False
        users = group.users.filtered(lambda user: self.employee_id.company_id in user.company_ids) if group else self.env["res.users"]
        return users[:1]

    def _initialize_configured_approval_lines(self):
        Line = self.env["hr.leave.approval.line"].sudo()
        now = fields.Datetime.now()
        for leave in self:
            stages = leave.holiday_status_id.approval_stage_ids.sorted(lambda stage: (stage.sequence, stage.id))
            if leave.holiday_status_id.approval_workflow != "multi" or not stages or leave.approval_line_ids:
                continue
            for index, stage in enumerate(stages):
                line = Line.create({
                    "leave_id": leave.id,
                    "stage_id": stage.id,
                    "sequence": stage.sequence,
                    "level": index + 1,
                    "approver_id": leave._resolve_stage_approver(stage).id,
                    "status": "pending" if index == 0 else "waiting",
                })
                if index == 0:
                    line.write({"deadline": line._deadline_from_stage(now)})

    def _approve_configured_stage(self, comment=""):
        self.ensure_one()
        pending = self.approval_line_ids.filtered(lambda line: line.status == "pending")[:1]
        if not pending:
            return False
        now = fields.Datetime.now()
        pending.sudo().write({
            "status": "approved", "actioned_at": now,
            "actioned_by_id": self.env.user.id, "comments": comment or False,
        })
        waiting = self.approval_line_ids.filtered(lambda line: line.status == "waiting").sorted(
            lambda line: (line.sequence, line.id)
        )[:1]
        if waiting:
            waiting.sudo().write({"status": "pending", "deadline": waiting._deadline_from_stage(now)})
            return "stage"
        super(HrLeave, self.with_context(cleon_final_approval=True)).action_approve()
        return "final"

    def action_approve(self, check_state=True):
        """Prevent native approval entry points from skipping custom stages."""
        if self.env.context.get("cleon_final_approval"):
            return super().action_approve(check_state=check_state)
        configured = self.filtered(
            lambda leave: leave.holiday_status_id.approval_workflow == "multi"
            and leave.approval_line_ids
        )
        regular = self - configured
        result = super(HrLeave, regular).action_approve(check_state=check_state) if regular else True
        for leave in configured:
            leave._approve_configured_stage()
        return result

    def _reject_configured_stages(self, reason):
        for leave in self:
            leave.approval_line_ids.filtered(lambda line: line.status == "pending").sudo().write({
                "status": "rejected", "actioned_at": fields.Datetime.now(),
                "actioned_by_id": self.env.user.id, "comments": reason,
            })
            leave.approval_line_ids.filtered(lambda line: line.status == "waiting").sudo().write({
                "status": "skipped",
            })

    def _has_active_disciplinary_suspension(self):
        self.ensure_one()
        if "hr.warning.interim_measure" not in self.env:
            return False
        now = fields.Datetime.now()
        domain = [
            ("employee_id", "=", self.employee_id.id),
            ("measure_type_suspension_pending", "=", True),
            "|", ("start_date", "=", False), ("start_date", "<=", now),
            "|", ("expected_end_date", "=", False), ("expected_end_date", ">=", now),
        ]
        return bool(self.env["hr.warning.interim_measure"].sudo().search_count(domain))

    @api.model
    def _employee_has_active_disciplinary_suspension(self, employee):
        pseudo_leave = self.new({"employee_id": employee.id})
        return pseudo_leave._has_active_disciplinary_suspension()

    @api.model
    def _cron_escalate_overdue_approval_stages(self):
        lines = self.env["hr.leave.approval.line"].sudo().search([
            ("status", "=", "pending"), ("deadline", "!=", False),
            ("deadline", "<", fields.Datetime.now()), ("escalated", "=", False),
        ])
        for line in lines:
            line.write({"escalated": True, "escalated_at": fields.Datetime.now()})
            leave = line.leave_id
            leave.sudo().write({
                "escalated": True,
                "escalation_note": _("Approval stage %d exceeded its configured response time.") % line.level,
                "escalated_at": fields.Datetime.now(),
            })
            leave._create_audit_record("escalated", note=leave.escalation_note, is_system=True)
        return len(lines)

    @api.constrains("holiday_status_id", "employee_id", "request_date_from", "request_date_to", "number_of_days", "state")
    def _check_leave_type_policy_enforcement(self):
        for leave in self:
            if leave.state in ("confirm", "validate1", "validate") and leave.holiday_status_id and leave.employee_id:
                res = self.env["hr.leave.type"].evaluate_leave_request_policy(
                    employee_id=leave.employee_id.id,
                    leave_type_id=leave.holiday_status_id.id,
                    date_from=leave.request_date_from or leave.date_from,
                    date_to=leave.request_date_to or leave.date_to,
                    requested_days=leave.number_of_days or 1.0,
                    half_day=bool(getattr(leave, "request_unit_half", False)),
                )
                if not res.get("eligible") or res.get("errors"):
                    raise ValidationError(_("Policy validation error for '%s':\n%s") % (leave.holiday_status_id.name, "\n".join("• " + e for e in res["errors"])))

    @api.model
    def _check_leave_dashboard_access(self, employee_scope=False):
        if employee_scope and self.env.user.has_group("base.group_user"):
            return
        if not (
            self.env.user.has_group("base.group_system")
            or self.env.user.has_group("hr_holidays.group_hr_holidays_manager")
        ):
            raise AccessError(_("Only a Time Off Administrator can access this dashboard."))

    @api.model
    def _get_company_employee_ids(self):
        return self.env["hr.employee"].search([
            ("active", "=", True),
            ("company_id", "=", self.env.company.id),
        ]).ids

    @api.model
    def get_dashboard_data(self, months=6):
        self._check_leave_dashboard_access()

        months = int(months) if months in (6, 12) else 6
        emp_ids = self._get_company_employee_ids()
        coverage = self._get_department_coverage(emp_ids)

        return {
            "kpis": self._get_kpis(emp_ids, coverage_alerts=coverage["alert_count"]),
            "trends": self._get_leave_trends(emp_ids, months),
            "by_type": self._get_leave_type_distribution(emp_ids),
            "balance": self._get_leave_balance_by_type(emp_ids),
            "approval_overview": self._get_approval_overview(emp_ids),
            "department_coverage": coverage["rows"],
            "recent_requests": self._get_recent_requests(emp_ids),
        }

    @api.model
    def get_employee_dashboard_data(self):
        """Return self-service leave data for the logged-in employee only."""
        employee = self.env["hr.employee"].sudo().search([
            ("user_id", "=", self.env.user.id),
            ("company_id", "in", self.env.companies.ids),
            ("active", "=", True),
        ], limit=1)
        if not employee:
            raise AccessError(_("Your user is not linked to an active employee record."))

        today = fields.Date.context_today(self)
        year_start = today.replace(month=1, day=1)
        year_end = today.replace(month=12, day=31)
        Leave = self.sudo()
        Allocation = self.env["hr.leave.allocation"].sudo()
        base_domain = [("employee_id", "=", employee.id), ("is_cancelled", "=", False)]
        allocations = Allocation.search([
            ("employee_id", "=", employee.id), ("state", "=", "validate"),
            "|", ("date_from", "=", False), ("date_from", "<=", today),
            "|", ("date_to", "=", False), ("date_to", ">=", today),
        ])
        approved = Leave.search(base_domain + [("state", "=", "validate")])
        pending = Leave.search(base_domain + [("state", "in", ("confirm", "validate1"))])
        type_ids = (allocations.mapped("holiday_status_id") | approved.mapped("holiday_status_id") | pending.mapped("holiday_status_id")).ids
        balances = []
        for leave_type in self.env["hr.leave.type"].sudo().browse(type_ids).sorted("name"):
            allocated_days = sum(allocations.filtered(lambda a: a.holiday_status_id == leave_type).mapped("number_of_days"))
            used_days = sum(approved.filtered(lambda l: l.holiday_status_id == leave_type).mapped("number_of_days"))
            pending_days = sum(pending.filtered(lambda l: l.holiday_status_id == leave_type).mapped("number_of_days"))
            # Pending requests reserve entitlement and must reduce the amount
            # that the employee can request again.
            remaining = allocated_days - used_days - pending_days
            carried_days = sum(self.env["hr.leave.balance.transaction"].sudo().search([
                ("employee_id", "=", employee.id),
                ("leave_type_id", "=", leave_type.id),
                ("transaction_type", "=", "carry_forward"),
                ("effective_date", ">=", year_start),
                ("effective_date", "<=", year_end),
            ]).mapped("delta"))
            balances.append({
                "id": leave_type.id, "name": leave_type.name,
                "color": leave_type.cleon_color_hex or "#3B82F6",
                "allocated": round(allocated_days, 1), "used": round(used_days, 1),
                "pending": round(pending_days, 1), "remaining": round(remaining, 1),
                "carried_forward": round(carried_days, 1),
                "percent": round(min(100, max(0, remaining * 100 / allocated_days)), 1) if allocated_days else 0,
            })

        upcoming = Leave.search(base_domain + [
            ("state", "=", "validate"), ("request_date_from", ">", today),
        ], order="request_date_from asc", limit=1)
        recent = Leave.search(base_domain, order="create_date desc", limit=5)
        on_leave = Leave.search_count(base_domain + [
            ("state", "=", "validate"), ("request_date_from", "<=", today),
            ("request_date_to", ">=", today),
        ])
        holidays = self.env["resource.calendar.leaves"].sudo().search([
            ("date_from", ">=", fields.Datetime.to_string(today)),
            ("date_from", "<=", fields.Datetime.to_string(today + relativedelta(days=90))),
            "|", ("calendar_id", "=", False), ("calendar_id", "=", employee.resource_calendar_id.id),
        ], order="date_from asc", limit=5)
        status_labels = {"draft": _("Draft"), "confirm": _("Pending"), "validate1": _("Pending"), "validate": _("Approved"), "refuse": _("Rejected"), "cancel": _("Cancelled")}
        return {
            "employee": {"id": employee.id, "name": employee.name},
            "can_admin": self.env.user.has_group("hr_holidays.group_hr_holidays_manager") or self.env.user.has_group("base.group_system"),
            "kpis": {
                "total_balance": round(sum(item["remaining"] for item in balances), 1),
                "pending_requests": len(pending),
                "approved_this_year": Leave.search_count(base_domain + [("state", "=", "validate"), ("request_date_from", ">=", year_start), ("request_date_from", "<=", year_end)]),
                "at_work": not bool(on_leave),
            },
            "balances": balances,
            "upcoming_leave": [{"type": leave.holiday_status_id.name, "start": fields.Date.to_string(leave.request_date_from), "end": fields.Date.to_string(leave.request_date_to), "days": round(leave.number_of_days, 1)} for leave in upcoming],
            "holidays": [{"name": holiday.name, "date": fields.Datetime.to_string(holiday.date_from), "days_away": max(0, (holiday.date_from.date() - today).days)} for holiday in holidays],
            "recent": [{"id": leave.id, "type": leave.holiday_status_id.name, "start": fields.Date.to_string(leave.request_date_from), "end": fields.Date.to_string(leave.request_date_to), "days": round(leave.number_of_days, 1), "state": leave.state, "status": status_labels.get(leave.state, leave.state)} for leave in recent],
        }

    @api.model
    def _employee_for_current_user(self):
        employee = self.env["hr.employee"].sudo().search([
            ("user_id", "=", self.env.user.id), ("company_id", "in", self.env.companies.ids), ("active", "=", True),
        ], limit=1)
        if not employee:
            raise AccessError(_("Your user is not linked to an active employee record."))
        return employee

    @api.model
    def get_employee_request_options(self):
        employee = self._employee_for_current_user()
        types = self.env["hr.leave.type"].sudo().search([
            ("active", "=", True), ("visible_to_employees", "=", True),
            "|", ("company_id", "=", False), ("company_id", "=", employee.company_id.id),
        ]).filtered(lambda leave_type: employee in leave_type._get_eligible_employees())
        allocations = self.env["hr.leave.allocation"].sudo().search([("employee_id", "=", employee.id), ("state", "=", "validate"), ("holiday_status_id", "in", types.ids)])
        approved = self.sudo().search([("employee_id", "=", employee.id), ("state", "=", "validate"), ("is_cancelled", "=", False), ("holiday_status_id", "in", types.ids)])
        pending = self.sudo().search([("employee_id", "=", employee.id), ("state", "in", ("confirm", "validate1")), ("is_cancelled", "=", False), ("holiday_status_id", "in", types.ids)])
        return {"employee": {"id": employee.id, "name": employee.name}, "leave_types": [{
            "id": leave_type.id, "name": leave_type.name, "color": leave_type.cleon_color_hex or "#3B82F6",
            "allocated": round(sum(allocations.filtered(lambda row: row.holiday_status_id == leave_type).mapped("number_of_days")), 1),
            "used": round(sum(approved.filtered(lambda row: row.holiday_status_id == leave_type).mapped("number_of_days")), 1),
            "pending": round(sum(pending.filtered(lambda row: row.holiday_status_id == leave_type).mapped("number_of_days")), 1),
            "unlimited": bool(leave_type.unlimited_entitlement), "allow_half_day": bool(leave_type.allow_half_day),
        } for leave_type in types]}

    @api.model
    def preview_employee_leave_request(self, leave_type_id, date_from, date_to, half_day=False, period="am"):
        employee = self._employee_for_current_user()
        leave_type = self.env["hr.leave.type"].sudo().browse(int(leave_type_id)).exists()
        options = self.get_employee_request_options()
        if not leave_type or leave_type.id not in [item["id"] for item in options["leave_types"]]:
            raise ValidationError(_("This leave type is not available to you."))
        if not date_from or not date_to or fields.Date.from_string(date_to) < fields.Date.from_string(date_from):
            raise ValidationError(_("Select a valid start and end date."))
        preview = self.sudo().new({"employee_id": employee.id, "holiday_status_id": leave_type.id, "request_date_from": date_from, "request_date_to": date_to, "request_unit_half": bool(half_day), "request_date_from_period": period})
        preview._compute_department_id(); preview._compute_resource_calendar_id(); preview._compute_date_from_to()
        duration = 0.5 if half_day else round(preview.number_of_days or 0.0, 1)
        policy = self.env["hr.leave.type"].sudo().evaluate_leave_request_policy(employee.id, leave_type.id, date_from, date_to, duration, half_day)
        row = next(item for item in options["leave_types"] if item["id"] == leave_type.id)
        remaining = row["allocated"] - row["used"] - row["pending"]
        holidays = self.env["resource.calendar.leaves"].sudo().search_count([
            ("date_from", "<=", date_to + " 23:59:59"), ("date_to", ">=", date_from + " 00:00:00"),
            ("calendar_id", "=", employee.resource_calendar_id.id),
        ])
        return {"duration": duration, "holiday_count": holidays, "current_balance": remaining, "projected_balance": remaining - duration if not row["unlimited"] else remaining, "unlimited": row["unlimited"], **policy}

    @api.model
    def submit_employee_leave_request(self, values):
        employee = self._employee_for_current_user()
        if self._employee_has_active_disciplinary_suspension(employee):
            self.env["hr.leave.audit.log"].sudo().create({
                "action": "failed", "event_status": "failed",
                "employee_id": employee.id, "actor_id": self.env.user.id,
                "actor_label": self.env.user.name,
                "note": _("Submission blocked: employee is under an active disciplinary suspension."),
            })
            return {"ok": False, "message": _("You cannot submit leave while an active disciplinary suspension applies.")}
        try:
            with self.env.cr.savepoint():
                result = self._submit_employee_leave_request(values)
            return {"ok": True, **result}
        except (ValidationError, UserError, AccessError) as error:
            message = error.args[0] if error.args else _("The leave request could not be submitted.")
            return {"ok": False, "message": str(message)}

    @api.model
    def _submit_employee_leave_request(self, values):
        employee = self._employee_for_current_user()
        reason = (values.get("reason") or "").strip()
        if len(reason) < 5:
            raise ValidationError(_("Please provide a reason of at least 5 characters."))
        preview = self.preview_employee_leave_request(values.get("leave_type_id"), values.get("date_from"), values.get("date_to"), values.get("half_day", False), values.get("period", "am"))
        if not preview.get("eligible") or preview.get("errors"):
            raise ValidationError("\n".join(preview.get("errors") or [_('This request does not comply with the leave policy.')]))
        attachment = values.get("attachment") or {}
        if attachment.get("data") and attachment.get("mimetype") not in (
            "application/pdf", "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/jpeg", "image/png",
        ):
            raise ValidationError(_("Only PDF, DOC, DOCX, JPG, and PNG attachments are supported."))
        if attachment.get("data"):
            try:
                if len(base64.b64decode(attachment["data"], validate=True)) > 10 * 1024 * 1024:
                    raise ValidationError(_("The attachment must not exceed 10 MB."))
            except ValueError:
                raise ValidationError(_("The supporting document is not a valid encoded file."))
        notes = reason
        if values.get("emergency_contact"):
            notes += "\n" + _("Emergency contact: %s") % values["emergency_contact"]
        leave = self.create({"employee_id": employee.id, "holiday_status_id": int(values["leave_type_id"]), "request_date_from": values["date_from"], "request_date_to": values["date_to"], "request_unit_half": bool(values.get("half_day")), "request_date_from_period": values.get("period", "am"), "notes": notes})
        if attachment.get("data"):
            self.env["ir.attachment"].sudo().create({"name": attachment.get("name") or _("Supporting document"), "datas": attachment["data"], "mimetype": attachment.get("mimetype"), "res_model": "hr.leave", "res_id": leave.id})
        if leave.state == "draft":
            leave.action_confirm()
        return {"id": leave.id, "reference": leave.request_ref, "message": _("Your leave request has been submitted for approval.")}

    @api.model
    def get_my_leave_requests(self, status="all", search="", leave_type_id=False):
        employee = self._employee_for_current_user()
        domain = [("employee_id", "=", employee.id)]
        if status == "pending": domain += [("state", "in", ("confirm", "validate1")), ("is_cancelled", "=", False)]
        elif status == "approved": domain += [("state", "=", "validate"), ("is_cancelled", "=", False)]
        elif status == "rejected": domain += [("state", "=", "refuse"), ("is_cancelled", "=", False)]
        elif status == "cancelled": domain += [("is_cancelled", "=", True)]
        if leave_type_id: domain.append(("holiday_status_id", "=", int(leave_type_id)))
        search = (search or "").strip()
        if search: domain += ["|", ("holiday_status_id.name", "ilike", search), ("notes", "ilike", search)]
        all_records = self.sudo().search([("employee_id", "=", employee.id)])
        records = self.sudo().search(domain, order="create_date desc, id desc")
        def request_status(record):
            if record.is_cancelled: return "cancelled"
            return "approved" if record.state == "validate" else "pending" if record.state in ("confirm", "validate1") else "rejected" if record.state == "refuse" else "draft"
        counts = {key: 0 for key in ("all", "pending", "approved", "rejected", "cancelled")}; counts["all"] = len(all_records)
        for record in all_records: counts[request_status(record)] = counts.get(request_status(record), 0) + 1
        rows = []
        for record in records:
            approver = record.second_approver_id or record.first_approver_id
            if not approver and employee.parent_id: approver = employee.parent_id.user_id
            rows.append({"id": record.id, "reference": record.request_ref or "LR-%06d" % record.id, "leave_type_id": record.holiday_status_id.id, "leave_type": record.holiday_status_id.name, "color": record.holiday_status_id.cleon_color_hex or "#3B82F6", "date_from": fields.Date.to_string(record.request_date_from), "date_to": fields.Date.to_string(record.request_date_to), "duration": round(record.number_of_days or 0, 1), "reason": record.notes or "", "status": request_status(record), "approver": approver.name if approver else _("Line Manager"), "submitted": fields.Datetime.to_string(record.create_date), "can_cancel": request_status(record) in ("pending", "approved"), "can_escalate": request_status(record) == "pending" and not record.escalated, "escalated": bool(record.escalated), "can_resubmit": request_status(record) == "rejected"})
        types = self.env["hr.leave.type"].sudo().browse(all_records.mapped("holiday_status_id").ids).sorted("name")
        return {"rows": rows, "counts": counts, "leave_types": [{"id": item.id, "name": item.name} for item in types]}

    @api.model
    def cancel_my_pending_leave(self, leave_id, reason):
        employee = self._employee_for_current_user(); reason = (reason or "").strip()
        if len(reason) < 3: return {"ok": False, "message": _("Please provide a cancellation reason of at least 3 characters.")}
        leave = self.search([("id", "=", int(leave_id)), ("employee_id", "=", employee.id)], limit=1)
        if not leave: return {"ok": False, "message": _("This leave request could not be found.")}
        if leave.state not in ("confirm", "validate1", "validate") or leave.is_cancelled: return {"ok": False, "message": _("Only a pending or approved leave request can be cancelled.")}
        try:
            with self.env.cr.savepoint():
                leave.sudo().action_refuse()
                leave.sudo().write({"is_cancelled": True, "cancelled_by_id": self.env.user.id, "cancelled_at": fields.Datetime.now(), "cancellation_reason": reason})
                leave.sudo()._create_audit_record("cancelled", note=reason)
            return {"ok": True, "message": _("Your leave request has been cancelled and its balance restored.")}
        except (ValidationError, UserError, AccessError) as error:
            return {"ok": False, "message": str(error.args[0] if error.args else _("The request could not be cancelled."))}

    @api.model
    def escalate_my_leave_request(self, leave_id, note):
        employee = self._employee_for_current_user()
        note = (note or "").strip()
        if not note or len(note) > 300:
            return {"ok": False, "message": _("Provide an escalation note of no more than 300 characters.")}
        leave = self.sudo().search([
            ("id", "=", int(leave_id)), ("employee_id", "=", employee.id),
            ("state", "in", ("confirm", "validate1")), ("is_cancelled", "=", False),
        ], limit=1)
        if not leave:
            return {"ok": False, "message": _("Only your own pending request can be escalated.")}
        if leave.escalated:
            return {"ok": False, "message": _("This request has already been escalated.")}
        leave.write({
            "escalated": True, "escalation_note": note,
            "escalated_by_id": self.env.user.id, "escalated_at": fields.Datetime.now(),
        })
        leave.approval_line_ids.filtered(lambda line: line.status == "pending").write({
            "escalated": True, "escalated_at": fields.Datetime.now(),
        })
        leave._create_audit_record("escalated", note=note)
        leave._post_configured_leave_update(_("Leave request escalated by %(employee)s: %(note)s", employee=employee.name, note=note))
        return {"ok": True, "message": _("Your request has been escalated for review.")}

    # ---------------------------------------------------------
    # KPI CARDS (FR-055 to FR-060)
    # ---------------------------------------------------------

    @api.model
    def _get_kpis(self, emp_ids, coverage_alerts=0):
        today = fields.Date.context_today(self)

        total_employees = len(emp_ids)

        on_leave_today = self.search_count([
            ("employee_id", "in", emp_ids),
            ("state", "=", "validate"),
            ("request_date_from", "<=", today),
            ("request_date_to", ">=", today),
        ]) if emp_ids else 0

        pending_approvals = self.search_count([
            ("employee_id", "in", emp_ids),
            ("state", "in", ("confirm", "validate1")),
        ]) if emp_ids else 0

        upcoming_7_days = self.search_count([
            ("employee_id", "in", emp_ids),
            ("state", "=", "validate"),
            ("request_date_from", ">", today),
            ("request_date_from", "<=", today + relativedelta(days=7)),
        ]) if emp_ids else 0

        allocations = self.env["hr.leave.allocation"].search([
            ("employee_id", "in", emp_ids),
            ("state", "=", "validate"),
        ]) if emp_ids else self.env["hr.leave.allocation"]

        allocated_days = sum(allocations.mapped("number_of_days"))

        approved_leaves = self.search([
            ("employee_id", "in", emp_ids),
            ("state", "=", "validate"),
        ]) if emp_ids else self.env["hr.leave"]

        used_days = sum(approved_leaves.mapped("number_of_days"))

        utilisation_rate = (
            round((used_days / allocated_days) * 100, 1)
            if allocated_days else 0
        )

        on_leave_pct = (
            round((on_leave_today / total_employees) * 100, 1)
            if total_employees else 0
        )

        return {
            "total_employees": total_employees,
            "on_leave_today": on_leave_today,
            "on_leave_pct": on_leave_pct,
            "pending_approvals": pending_approvals,
            "upcoming_7_days": upcoming_7_days,
            "utilisation_rate": utilisation_rate,
            "coverage_alerts": coverage_alerts,
        }

    # ---------------------------------------------------------
    # LEAVE TRENDS AREA CHART (FR-061 to FR-063)
    # ---------------------------------------------------------

    @api.model
    def _get_leave_trends(self, emp_ids, months=6):
        months = int(months) if months in (6, 12) else 6
        today = fields.Date.context_today(self)
        range_start = today.replace(day=1) - relativedelta(months=months - 1)

        buckets = OrderedDict()
        cursor = range_start
        for _ in range(months):
            buckets[cursor.strftime("%Y-%m")] = {
                "label": cursor.strftime("%b"),
                "total": 0, "approved": 0, "pending": 0, "rejected": 0,
            }
            cursor += relativedelta(months=1)

        leaves = self.search([
            ("employee_id", "in", emp_ids),
            ("request_date_from", ">=", range_start),
            ("request_date_from", "<=", today.replace(day=1) + relativedelta(months=1, days=-1)),
        ]) if emp_ids else self.env["hr.leave"]

        for leave in leaves:
            if not leave.request_date_from:
                continue
            key = leave.request_date_from.strftime("%Y-%m")
            if key not in buckets:
                continue
            b = buckets[key]
            b["total"] += 1
            if leave.state == "validate":
                b["approved"] += 1
            elif leave.state in ("confirm", "validate1"):
                b["pending"] += 1
            elif leave.state == "refuse":
                b["rejected"] += 1

        return {
            "labels": [b["label"] for b in buckets.values()],
            "total": [b["total"] for b in buckets.values()],
            "approved": [b["approved"] for b in buckets.values()],
            "pending": [b["pending"] for b in buckets.values()],
            "rejected": [b["rejected"] for b in buckets.values()],
            "summary": {
                "total": sum(b["total"] for b in buckets.values()),
                "approved": sum(b["approved"] for b in buckets.values()),
                "pending": sum(b["pending"] for b in buckets.values()),
                "rejected": sum(b["rejected"] for b in buckets.values()),
            },
        }

    # ---------------------------------------------------------
    # BY LEAVE TYPE DONUT CHART (FR-064)
    # ---------------------------------------------------------

    @api.model
    def _get_leave_type_distribution(self, emp_ids):
        if not emp_ids:
            return []
        groups = self.read_group(
            domain=[("employee_id", "in", emp_ids)],
            fields=["id"],
            groupby=["holiday_status_id"],
        )
        total = sum(g["holiday_status_id_count"] for g in groups) or 1
        result = []
        for g in groups:
            if not g["holiday_status_id"]:
                continue
            count = g["holiday_status_id_count"]
            result.append({
                "name": g["holiday_status_id"][1],
                "count": count,
                "percent": round((count / total) * 100),
            })
        result.sort(key=lambda r: r["count"], reverse=True)
        return result

    # ---------------------------------------------------------
    # LEAVE BALANCE BY TYPE (FR-065)
    # ---------------------------------------------------------

    @api.model
    def _get_leave_balance_by_type(self, emp_ids):
        if not emp_ids:
            return []
        LeaveType = self.env["hr.leave.type"]
        types = LeaveType.search([])
        result = []
        for lt in types:
            allocated = sum(self.env["hr.leave.allocation"].search([
                ("employee_id", "in", emp_ids),
                ("holiday_status_id", "=", lt.id),
                ("state", "=", "validate"),
            ]).mapped("number_of_days"))
            used = sum(self.search([
                ("employee_id", "in", emp_ids),
                ("holiday_status_id", "=", lt.id),
                ("state", "=", "validate"),
            ]).mapped("number_of_days"))
            if not allocated and not used:
                continue

            percent = round((used / allocated) * 100) if allocated else 0

            # FR-065: Threshold colour-coding: green (<60%), amber (60-79%), red (>=80%)
            if percent < 60:
                bar_color = "#10b981"  # green
            elif percent < 80:
                bar_color = "#f59e0b"  # amber
            else:
                bar_color = "#ef4444"  # red

            result.append({
                "name": lt.name,
                "type_color": lt.cleon_color_hex or "#64748B",
                "bar_color": bar_color,
                "used": round(used, 1),
                "allocated": round(allocated, 1),
                "percent": min(100, max(0, percent)),
            })
        return result

    # ---------------------------------------------------------
    # APPROVAL OVERVIEW (FR-066)
    # ---------------------------------------------------------

    @api.model
    def _get_approval_overview(self, emp_ids):
        if not emp_ids:
            return {"approved": 0, "pending": 0, "rejected": 0, "approval_rate": 0}
        approved = self.search_count([("employee_id", "in", emp_ids), ("state", "=", "validate")])
        pending = self.search_count([("employee_id", "in", emp_ids), ("state", "in", ("confirm", "validate1"))])
        rejected = self.search_count([("employee_id", "in", emp_ids), ("state", "=", "refuse")])
        total = approved + pending + rejected
        rate = round((approved / total) * 100) if total else 0
        return {
            "approved": approved,
            "pending": pending,
            "rejected": rejected,
            "approval_rate": rate,
        }

    # ---------------------------------------------------------
    # DEPARTMENT COVERAGE HEATMAP (FR-067)
    # ---------------------------------------------------------

    @api.model
    def _get_department_coverage(self, emp_ids):
        if not emp_ids:
            return {"rows": [], "alert_count": 0}

        company = self.env.company
        today = fields.Date.context_today(self)

        monday = today - relativedelta(days=today.weekday())
        work_days = [monday + relativedelta(days=i) for i in range(5)]

        employees = self.env["hr.employee"].browse(emp_ids).filtered(lambda e: e.department_id)
        departments = employees.mapped("department_id")

        approved_leaves = self.search([
            ("employee_id", "in", emp_ids),
            ("state", "=", "validate"),
            ("request_date_from", "<=", work_days[-1]),
            ("request_date_to", ">=", work_days[0]),
        ])

        away_by_day = {}
        for day in work_days:
            away_by_day[day] = set(
                approved_leaves.filtered(
                    lambda l: l.request_date_from and l.request_date_to and l.request_date_from <= day <= l.request_date_to
                ).mapped("employee_id").ids
            )

        rows = []
        alert_count = 0

        for department in departments.sorted("name"):
            dept_emp_ids = set(
                employees.filtered(lambda e: e.department_id == department).ids
            )
            total = len(dept_emp_ids)
            values = []

            for day in work_days:
                away = len(dept_emp_ids & away_by_day[day])
                coverage = (
                    round(((total - away) / total) * 100)
                    if total else 100
                )
                values.append(coverage)

            if any(val < 70 for val in values):
                alert_count += 1

            # Weekend columns (Sat, Sun) show None
            values.extend([None, None])

            rows.append({
                "department": department.name,
                "values": values,
            })

        return {
            "rows": rows,
            "alert_count": alert_count,
        }

    # ---------------------------------------------------------
    # RECENT REQUESTS (FR-068)
    # ---------------------------------------------------------

    @api.model
    def _get_recent_requests(self, emp_ids):
        if not emp_ids:
            return []

        leaves = self.search(
            [
                ("employee_id", "in", emp_ids),
                ("state", "!=", "draft"),
            ],
            order="create_date desc",
            limit=8,
        )

        state_map = {
            "confirm": "pending",
            "validate1": "pending",
            "validate": "approved",
            "refuse": "rejected",
        }

        result = []
        for leave in leaves:
            create_dt = leave.create_date
            submitted = (
                fields.Datetime.context_timestamp(self, create_dt).strftime("%d %b")
                if create_dt else ""
            )
            result.append({
                "id": leave.id,
                "employee": leave.employee_id.name or "",
                "leave_type": leave.holiday_status_id.name or "",
                "duration": round(leave.number_of_days, 1),
                "status": state_map.get(leave.state, "pending"),
                "submitted_date": submitted,
            })

        return result

    # ═════════════════════════════════════════════════════════
    # SCREEN 9: LEAVE REQUESTS PAGE BACKEND METHODS (FR-073 to FR-113)
    # ═════════════════════════════════════════════════════════

    @api.model
    def _get_leave_approver_label(self, leave):
        if leave.state == "confirm":
            if hasattr(leave, "validation_type") and leave.validation_type in ("manager", "both"):
                return leave.employee_id.leave_manager_id.name or _("Line Manager")
            if hasattr(leave, "holiday_status_id") and leave.holiday_status_id.responsible_ids:
                resp = leave.holiday_status_id.responsible_ids.mapped("name")
                return ", ".join(resp) or _("Time Off Officer")
            return _("Line Manager")

        if leave.state == "validate1":
            if hasattr(leave, "holiday_status_id") and leave.holiday_status_id.responsible_ids:
                resp = leave.holiday_status_id.responsible_ids.mapped("name")
                return ", ".join(resp) or _("Time Off Officer")
            return _("Time Off Officer")

        approver = (
            getattr(leave, "second_approver_id", False)
            or getattr(leave, "first_approver_id", False)
            or getattr(leave, "user_id", False)
        )
        return approver.name if approver else ""

    def _get_cleon_leave_status(self):
        self.ensure_one()
        if self.is_cancelled:
            return "cancelled"
        return {
            "draft": "draft",
            "confirm": "pending",
            "validate1": "pending",
            "validate": "approved",
            "refuse": "rejected",
        }.get(self.state, "pending")

    def _serialize_leave_request(self, leave=None):
        rec = leave or self
        rec.ensure_one()
        status = rec._get_cleon_leave_status()
        return {
            "id": rec.id,
            "request_ref": rec.request_ref or f"LR-{rec.id:06d}",
            "employee": {
                "id": rec.employee_id.id,
                "name": rec.employee_id.name or "",
                "employee_number": getattr(rec.employee_id, "employee_number", False) or f"EMP-{rec.employee_id.id:03d}",
                "department": rec.department_id.name or "No Department",
                "job_title": rec.employee_id.job_title or (rec.employee_id.job_id.name if hasattr(rec.employee_id, "job_id") and rec.employee_id.job_id else "") or "Employee",
                "email": rec.employee_id.work_email or f"{rec.employee_id.name.lower().replace(' ', '.')}@cleonhr.com",
            },
            "leave_type": {
                "id": rec.holiday_status_id.id,
                "name": rec.holiday_status_id.name or "",
                "color": getattr(rec.holiday_status_id, "color", 0),
                "color_hex": rec.holiday_status_id.cleon_color_hex or "#64748B",
            },
            "date_from": fields.Date.to_string(rec.request_date_from) if rec.request_date_from else "",
            "date_to": fields.Date.to_string(rec.request_date_to) if rec.request_date_to else "",
            "duration": round(rec.number_of_days or 0.0, 1),
            "half_day": bool(rec.request_unit_half),
            "half_day_period": rec.request_date_from_period if rec.request_unit_half else False,
            "status": status,
            "approver": self._get_leave_approver_label(rec),
            "submitted": fields.Date.to_string(rec.create_date.date()) if rec.create_date else "",
            "submitted_at": fields.Datetime.to_string(rec.create_date) if rec.create_date else "",
            "admin_created": rec.admin_created,
            "admin_created_by": rec.admin_created_by_id.name if rec.admin_created else "",
            "admin_created_at": fields.Date.to_string(rec.admin_created_at.date()) if rec.admin_created_at else "",
            "can_review": status == "pending" and not rec.is_cancelled,
            "escalated": bool(rec.escalated),
            "escalation_note": rec.escalation_note or "",
            "rejection_reason": rec.rejection_reason or "",
            "notes": rec.notes or rec.admin_creation_note or "",
        }

    @api.model
    def get_leave_requests_page(
        self,
        search_term="",
        status="all",
        leave_type_id=False,
        department_id=False,
        page=1,
        page_size=10,
    ):
        self._check_leave_dashboard_access()
        emp_ids = self._get_company_employee_ids()
        if not emp_ids:
            return {
                "rows": [],
                "counts": {"all": 0, "pending": 0, "approved": 0, "rejected": 0},
                "pagination": {"page": 1, "page_size": 10, "total": 0, "page_count": 1, "from": 0, "to": 0},
                "leave_types": [],
                "departments": [],
            }

        page = max(int(page or 1), 1)
        allowed_sizes = (5, 10, 25, 50, 100)
        page_size = int(page_size or 10)
        if page_size not in allowed_sizes:
            page_size = 10

        base_domain = [("employee_id", "in", emp_ids)]
        if search_term and search_term.strip():
            st = search_term.strip()
            base_domain = expression.AND([
                base_domain,
                expression.OR([
                    [("employee_id.name", "ilike", st)],
                    [("holiday_status_id.name", "ilike", st)],
                    [("name", "ilike", st)],
                    [("notes", "ilike", st)],
                    [("request_ref", "ilike", st)],
                ])
            ])

        if leave_type_id:
            base_domain.append(("holiday_status_id", "=", int(leave_type_id)))
        if department_id:
            base_domain.append(("department_id", "=", int(department_id)))

        counts = {
            "all": self.search_count(base_domain + [("state", "!=", "draft")]),
            "pending": self.search_count(base_domain + [("state", "in", ("confirm", "validate1"))]),
            "approved": self.search_count(base_domain + [("state", "=", "validate")]),
            "rejected": self.search_count(base_domain + [("state", "=", "refuse")]),
        }

        domain = list(base_domain)
        if status == "pending":
            domain.append(("state", "in", ("confirm", "validate1")))
        elif status == "approved":
            domain.append(("state", "=", "validate"))
        elif status == "rejected":
            domain.append(("state", "=", "refuse"))
        else:
            domain.append(("state", "!=", "draft"))

        total = self.search_count(domain)
        page_count = max(math.ceil(total / page_size), 1)
        if page > page_count:
            page = page_count

        offset = (page - 1) * page_size
        leaves = self.search(domain, offset=offset, limit=page_size, order="create_date desc, id desc")
        rows = [self._serialize_leave_request(leave) for leave in leaves]

        leave_types = self.env["hr.leave.type"].search([
            ("active", "=", True),
            "|", ("company_id", "=", False), ("company_id", "=", self.env.company.id),
        ])
        departments = self.env["hr.department"].search(
            [("company_id", "=", self.env.company.id)],
            order="name",
        )

        return {
            "rows": rows,
            "counts": counts,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "page_count": page_count,
                "from": offset + 1 if total else 0,
                "to": min(offset + page_size, total),
            },
            "leave_types": [{
                "id": lt.id,
                "name": lt.name,
                "color": lt.color or 0,
                "color_hex": lt.cleon_color_hex or "#64748B",
            } for lt in leave_types],
            "departments": [{"id": dept.id, "name": dept.name} for dept in departments],
        }

    # ---------------------------------------------------------
    # BULK & INDIVIDUAL ACTION METHODS (FR-089, FR-097 to FR-100)
    # ---------------------------------------------------------

    @api.model
    def bulk_approve_leave_requests(self, leave_ids):
        self._check_leave_dashboard_access()
        emp_ids = self._get_company_employee_ids()
        leaves = self.browse(leave_ids).exists().filtered(
            lambda l: l.employee_id.id in emp_ids and l.state in ("confirm", "validate1")
        )
        processed = 0
        for leave in leaves:
            if leave._has_active_disciplinary_suspension():
                leave._create_audit_record(
                    "failed",
                    note=_("Bulk approval blocked: employee is under an active disciplinary suspension."),
                )
                continue
            if leave.holiday_status_id.approval_workflow == "multi" and leave.approval_line_ids:
                stage_result = leave._approve_configured_stage()
                action_name = "final_approval" if stage_result == "final" else "first_approval"
            elif leave.state == "confirm":
                leave.action_approve()
                action_name = "first_approval" if leave.state == "validate1" else "final_approval"
            elif leave.state == "validate1":
                leave.action_validate()
                action_name = "final_approval"
            else:
                action_name = "approve"

            # Immutable Audit Log Entry (FR-111)
            leave._create_audit_record(action_name)
            leave._post_configured_leave_update(
                _("Leave request approved by %s.", self.env.user.name)
            )
            processed += 1
        return {"processed": processed}

    @api.model
    def bulk_reject_leave_requests(self, leave_ids, reason=""):
        self._check_leave_dashboard_access()
        reason = (reason or "").strip()
        if len(reason) < 3:
            raise ValidationError(_("A rejection reason is required (at least 3 characters)."))
        emp_ids = self._get_company_employee_ids()
        leaves = self.browse(leave_ids).exists().filtered(
            lambda l: l.employee_id.id in emp_ids and l.state in ("confirm", "validate1")
        )
        for leave in leaves:
            # Post rejection reason to chatter without destroying original leave.notes.
            body = _("Leave request rejected by %(user)s.<br/><strong>Reason:</strong> %(reason)s",
                     user=self.env.user.name, reason=reason)
            leave._post_configured_leave_update(body)
            leave._reject_configured_stages(reason)
            leave.sudo().write({"rejection_reason": reason})
            leave.action_refuse()
            # Immutable Audit Log Entry (FR-111)
            leave._create_audit_record("reject", note=reason)
        return {"processed": len(leaves)}

    def _create_audit_record(
        self,
        action,
        note="",
        actor_label=None,
        actor_role=None,
        is_system=False,
    ):
        self.ensure_one()
        ip_addr = "127.0.0.1"
        sess_ref = ""
        try:
            from odoo.http import request
            if request and hasattr(request, "httprequest") and request.httprequest:
                ip_addr = getattr(request.httprequest, "remote_addr", "127.0.0.1") or "127.0.0.1"
            if request and hasattr(request, "session") and request.session:
                sess_ref = getattr(request.session, "sid", "") or ""
        except Exception:
            pass

        user = False if is_system else self.env.user

        self.env["hr.leave.audit.log"].sudo().create({
            "leave_id": self.id,
            "action": action,
            "actor_id": user.id if user else False,
            "actor_label": actor_label or ("System" if is_system else (user.name if user else "System")),
            "actor_role": actor_role or ("" if is_system else ("Super Admin" if user and user.has_group("base.group_system") else "Leave Manager")),
            "is_system": is_system,
            "employee_id": self.employee_id.id,
            "leave_type_id": self.holiday_status_id.id,
            "date_from": self.request_date_from,
            "date_to": self.request_date_to,
            "duration": self.number_of_days,
            "note": note or "",
            "after_values": {
                "status": "Cancelled" if self.is_cancelled else self.state,
                "startDate": fields.Date.to_string(self.request_date_from),
                "endDate": fields.Date.to_string(self.request_date_to),
                "duration": self.number_of_days,
                "leaveType": self.holiday_status_id.name,
                "employee": self.employee_id.name,
            },
            "occurred_at": fields.Datetime.now(),
            "ip_address": ip_addr,
            "session_ref": sess_ref,
        })

    def _get_leave_balance_impact(self, leave):
        employee = leave.employee_id
        leave_type = leave.holiday_status_id

        allocations = self.env["hr.leave.allocation"].search([
            ("employee_id", "=", employee.id),
            ("holiday_status_id", "=", leave_type.id),
            ("state", "=", "validate"),
        ])
        allocated = sum(allocations.mapped("number_of_days"))

        other_used = sum(
            self.search([
                ("id", "!=", leave.id),
                ("employee_id", "=", employee.id),
                ("holiday_status_id", "=", leave_type.id),
                ("state", "=", "validate"),
                ("is_cancelled", "=", False),
            ]).mapped("number_of_days")
        )

        current_balance = round(allocated - other_used, 1)
        used = round(leave.number_of_days or 0.0, 1) if not leave.is_cancelled and leave.state != "refuse" else 0.0
        remaining = round(current_balance - used, 1)

        return {
            "current": current_balance,
            "used": used,
            "remaining": remaining,
            "has_allocation": bool(allocations),
        }

    def _get_leave_coverage_impact(self, leave):
        dept = leave.employee_id.department_id
        if not dept:
            return {
                "percentage": 100,
                "level": "good",
                "other_on_leave": 0,
                "department": "Company",
            }

        dept_employees = self.env["hr.employee"].search([
            ("department_id", "=", dept.id),
            ("company_id", "=", self.env.company.id),
            ("active", "=", True),
        ])
        total_dept = len(dept_employees) or 1

        start_date = leave.request_date_from
        end_date = leave.request_date_to
        if not start_date or not end_date:
            return {
                "percentage": 100,
                "level": "good",
                "other_on_leave": 0,
                "department": dept.name,
            }

        overlapping_leaves = self.search([
            ("id", "!=", leave.id),
            ("employee_id.department_id", "=", dept.id),
            ("state", "in", ("confirm", "validate1", "validate")),
            ("is_cancelled", "=", False),
            ("request_date_from", "<=", end_date),
            ("request_date_to", ">=", start_date),
        ])

        other_emp_ids = set(overlapping_leaves.mapped("employee_id.id"))
        other_count = len(other_emp_ids)

        # Day-by-day availability calculation
        curr = start_date
        lowest_available_pct = 100.0
        while curr <= end_date:
            absent_today = len(set(
                overlapping_leaves.filtered(
                    lambda l: l.request_date_from <= curr <= l.request_date_to
                ).mapped("employee_id.id")
            )) + 1  # Include current request employee
            avail_pct = max(0.0, min(100.0, round(((total_dept - absent_today) / total_dept) * 100)))
            if avail_pct < lowest_available_pct:
                lowest_available_pct = avail_pct
            curr += relativedelta(days=1)

        available_pct = int(lowest_available_pct)
        if available_pct >= 85:
            level = "good"
        elif available_pct >= 70:
            level = "medium"
        else:
            level = "low"

        return {
            "percentage": available_pct,
            "level": level,
            "other_on_leave": other_count,
            "department": dept.name,
        }

    @api.model
    def get_leave_request_detail(self, leave_id):
        is_admin = self.env.user.has_group("hr_holidays.group_hr_holidays_manager") or self.env.user.has_group("base.group_system")
        leave = self.sudo().browse(int(leave_id)).exists()
        if not leave or leave.employee_id.company_id != self.env.company:
            raise ValidationError(_("Invalid leave request."))
        if not is_admin and leave.employee_id.user_id != self.env.user:
            raise AccessError(_("You can only view your own leave requests."))

        res = self._serialize_leave_request(leave)
        status = leave._get_cleon_leave_status()

        # Attachments (FR-124)
        attachments = self.env["ir.attachment"].sudo().search([
            ("res_model", "=", "hr.leave"),
            ("res_id", "=", leave.id),
        ])
        attachment_list = [{
            "id": att.id,
            "name": att.name,
            "mimetype": att.mimetype or "application/octet-stream",
        } for att in attachments]

        # Balance & Coverage Impacts (FR-125 to FR-128)
        balance_impact = self._get_leave_balance_impact(leave)
        coverage_impact = self._get_leave_coverage_impact(leave)

        # Fetch Audit Logs for history and timeline (FR-129 to FR-132)
        audit_logs = self.env["hr.leave.audit.log"].sudo().search(
            [("leave_id", "=", leave.id)], order="occurred_at asc"
        )

        workflow = []
        if leave.approval_line_ids:
            workflow = [{
                "key": "approval_stage_%d" % line.id,
                "label": "%s · Level %d" % (line.stage_id.approver_type.replace("_", " ").title(), line.level),
                "actor": line.approver_id.name or _("Unassigned"),
                "role": dict(line._fields["status"].selection).get(line.status, line.status),
                "timestamp": fields.Datetime.to_string(line.actioned_at) if line.actioned_at else False,
                "state": line.status,
                "system": False,
                "comments": line.comments or "",
                "escalated": bool(line.escalated),
            } for line in leave.approval_line_ids.sorted(lambda item: (item.sequence, item.id))]
        for log in audit_logs:
            if log.action in ("submitted", "admin_create"):
                workflow.append({
                    "key": "submitted",
                    "label": "Request Submitted" if log.action == "submitted" else "Admin Created Request",
                    "actor": log.actor_label or (log.actor_id.name if log.actor_id else "Employee"),
                    "role": log.actor_role or ("Administrator" if log.action == "admin_create" else "Employee"),
                    "timestamp": fields.Datetime.to_string(log.occurred_at),
                    "state": "done",
                    "system": log.is_system,
                })
            elif log.action == "forwarded":
                workflow.append({
                    "key": "forwarded",
                    "label": "Forwarded to Manager",
                    "actor": log.actor_label or "System",
                    "role": log.actor_role or "Automated",
                    "timestamp": fields.Datetime.to_string(log.occurred_at),
                    "state": "done",
                    "system": True,
                })
            elif log.action in ("first_approval", "final_approval", "approve"):
                workflow.append({
                    "key": log.action,
                    "label": "Approved by Manager" if log.action in ("final_approval", "approve") else "First Approval Passed",
                    "actor": log.actor_label or (log.actor_id.name if log.actor_id else "Manager"),
                    "role": log.actor_role or "Line Manager",
                    "timestamp": fields.Datetime.to_string(log.occurred_at),
                    "state": "done",
                    "system": False,
                })
            elif log.action == "reject":
                workflow.append({
                    "key": "reject",
                    "label": "Rejected by Manager",
                    "actor": log.actor_label or (log.actor_id.name if log.actor_id else "Manager"),
                    "role": log.actor_role or "Line Manager",
                    "timestamp": fields.Datetime.to_string(log.occurred_at),
                    "state": "rejected",
                    "system": False,
                })
            elif log.action == "cancelled":
                workflow.append({
                    "key": "cancelled",
                    "label": "Leave Cancelled",
                    "actor": log.actor_label or (log.actor_id.name if log.actor_id else "Manager"),
                    "role": log.actor_role or "Manager",
                    "timestamp": fields.Datetime.to_string(log.occurred_at),
                    "state": "cancelled",
                    "system": False,
                })
            elif log.action == "escalated":
                workflow.append({
                    "key": "escalated",
                    "label": "Request Escalated",
                    "actor": log.actor_label or (log.actor_id.name if log.actor_id else "System"),
                    "role": log.actor_role or "Employee",
                    "timestamp": fields.Datetime.to_string(log.occurred_at),
                    "state": "escalated",
                    "system": log.is_system,
                    "comments": log.note or "",
                })

        if not workflow:
            submitted_by = leave.admin_created_by_id.name if leave.admin_created else leave.employee_id.name
            submitted_role = "Administrator" if leave.admin_created else "Employee"
            workflow.append({
                "key": "submitted",
                "label": "Request Submitted" if not leave.admin_created else "Admin Created Request",
                "actor": submitted_by,
                "role": submitted_role,
                "timestamp": fields.Datetime.to_string(leave.admin_created_at or leave.create_date),
                "state": "done",
                "system": False,
            })

        if status == "pending":
            workflow.append({
                "key": "pending_approval",
                "label": "Line Manager — Manager · Level 1",
                "actor": "Line Manager",
                "role": "Pending",
                "timestamp": False,
                "state": "pending",
                "system": False,
            })

        # Single Canonical Request History Log (FR-132, no duplicate entries)
        history = []
        for log in audit_logs:
            actor = "System" if log.is_system else (log.actor_label or (log.actor_id.name if log.actor_id else "User"))
            role = f" ({log.actor_role})" if log.actor_role and not log.is_system else ""

            if log.action == "admin_create":
                title = f"Request created by {actor} on behalf of {leave.employee_id.name}"
            elif log.action == "submitted":
                title = f"Request submitted by {leave.employee_id.name}"
            else:
                action_label = {
                    "forwarded": "Forwarded to Manager",
                    "first_approval": "First Approval",
                    "final_approval": "Final Approval",
                    "approve": "Approved",
                    "reject": "Rejected",
                    "cancelled": "Cancelled",
                    "escalated": "Escalated",
                    "override_conflict": "Conflict Overridden",
                }.get(log.action, log.action)
                title = f"{action_label} by {actor}{role}"

            history.append({
                "title": title,
                "timestamp": fields.Datetime.to_string(log.occurred_at),
                "type": log.action,
                "note": log.note or "",
            })

        actions = {
            "can_approve": is_admin and status == "pending" and not leave.is_cancelled,
            "can_reject": is_admin and status == "pending" and not leave.is_cancelled,
            "can_cancel": is_admin and status == "approved" and not leave.is_cancelled,
        }

        res.update({
            "attachments": attachment_list,
            "balance_impact": balance_impact,
            "coverage_impact": coverage_impact,
            "workflow": workflow,
            "history": history,
            "actions": actions,
            "cancellation_reason": leave.cancellation_reason or "",
            "escalated": bool(leave.escalated),
            "escalation_note": leave.escalation_note or "",
            "rejection_reason": leave.rejection_reason or "",
            "cancelled_by": leave.cancelled_by_id.name if leave.cancelled_by_id else "",
            "cancelled_at": fields.Datetime.to_string(leave.cancelled_at) if leave.cancelled_at else "",
        })
        return res

    @api.model
    def approve_leave_request(self, leave_id):
        self._check_leave_dashboard_access()
        leave = self.browse(int(leave_id)).exists()
        if not leave or leave.employee_id.company_id != self.env.company:
            raise ValidationError(_("Invalid leave request."))
        if leave.state not in ("confirm", "validate1") or leave.is_cancelled:
            raise ValidationError(_("This leave request is not awaiting approval."))

        if leave._has_active_disciplinary_suspension():
            self.env["hr.leave.audit.log"].sudo().create({
                "leave_id": leave.id, "action": "failed", "event_status": "failed",
                "employee_id": leave.employee_id.id, "leave_type_id": leave.holiday_status_id.id,
                "actor_id": self.env.user.id, "actor_label": self.env.user.name,
                "note": _("Approval blocked: employee is under an active disciplinary suspension."),
            })
            return {"ok": False, "message": _("This request cannot be approved while the employee is under an active disciplinary suspension.")}
        if leave.holiday_status_id.approval_workflow == "multi" and leave.approval_line_ids:
            stage_result = leave._approve_configured_stage()
            event = "final_approval" if stage_result == "final" else "first_approval"
        elif leave.state == "confirm":
            leave.action_approve()
            event = "first_approval" if leave.state == "validate1" else "final_approval"
        elif leave.state == "validate1":
            leave.action_validate()
            event = "final_approval"
        else:
            event = "approve"

        leave._create_audit_record(event)

        leave._post_configured_leave_update(
            _("Leave request approved by %s.", self.env.user.name)
        )
        return self.get_leave_request_detail(leave.id)

    @api.model
    def reject_leave_request(self, leave_id, reason=""):
        self._check_leave_dashboard_access()
        reason = (reason or "").strip()
        if len(reason) < 3:
            raise ValidationError(_("A rejection reason is required (at least 3 characters)."))
        leave = self.browse(int(leave_id)).exists()
        if not leave or leave.employee_id.company_id != self.env.company:
            raise ValidationError(_("Invalid leave request."))
        if leave.state not in ("confirm", "validate1") or leave.is_cancelled:
            raise ValidationError(_("Only a pending leave request can be rejected."))

        body = _("Leave request rejected by %(user)s.<br/><strong>Reason:</strong> %(reason)s",
                 user=self.env.user.name, reason=reason)
        leave._post_configured_leave_update(body)
        leave._reject_configured_stages(reason)
        leave.sudo().write({"rejection_reason": reason})
        leave.action_refuse()
        leave._create_audit_record("reject", note=reason)
        return self.get_leave_request_detail(leave.id)

    @api.model
    def cancel_approved_leave(self, leave_id, reason=""):
        self._check_leave_dashboard_access()
        reason = (reason or "").strip()
        if len(reason) < 3:
            raise ValidationError(_("A cancellation reason is required (at least 3 characters)."))
        leave = self.browse(int(leave_id)).exists()
        if not leave or leave.employee_id.company_id != self.env.company:
            raise ValidationError(_("Invalid leave request."))

        if leave.state != "validate" or leave.is_cancelled:
            raise ValidationError(_("Only active approved leave requests can be cancelled."))

        leave.action_refuse()
        leave.write({
            "is_cancelled": True,
            "cancelled_by_id": self.env.user.id,
            "cancelled_at": fields.Datetime.now(),
            "cancellation_reason": reason,
        })

        leave._create_audit_record("cancelled", note=reason)

        body = _("Approved leave cancelled by %(user)s.<br/><strong>Reason:</strong> %(reason)s",
                 user=self.env.user.name, reason=reason)
        leave._post_configured_leave_update(body)
        return self.get_leave_request_detail(leave.id)

    @api.model
    def approve_single_request(self, leave_id):
        return self.bulk_approve_leave_requests([leave_id])

    @api.model
    def reject_single_request(self, leave_id, reason=""):
        return self.bulk_reject_leave_requests([leave_id], reason)

    # ---------------------------------------------------------
    # ADMIN CREATE LEAVE REQUEST METHODS (FR-101 to FR-112)
    # ---------------------------------------------------------

    @api.model
    def get_admin_create_options(self):
        self._check_leave_dashboard_access()
        emp_ids = self._get_company_employee_ids()
        employees = self.env["hr.employee"].browse(emp_ids).filtered("active")
        return {
            "employees": [{
                "id": emp.id,
                "name": emp.name,
                "department": emp.department_id.name or "No Department",
                "job_title": emp.job_title or (emp.job_id.name if hasattr(emp, "job_id") and emp.job_id else "") or "Employee",
                "label": f"{emp.name} ({emp.department_id.name or 'No Department'} - {emp.job_title or (emp.job_id.name if hasattr(emp, 'job_id') and emp.job_id else '') or 'Employee'})",
            } for emp in employees],
        }

    @api.model
    def get_admin_leave_types_for_employee(self, employee_id):
        self._check_leave_dashboard_access()
        employee = self.env["hr.employee"].browse(int(employee_id)).exists()
        if not employee or employee.company_id != self.env.company:
            raise ValidationError(_("Invalid employee."))

        LeaveType = self.env["hr.leave.type"].with_context(
            employee_id=employee.id,
            default_employee_id=employee.id,
        )
        leave_types = LeaveType.search([
            ("active", "=", True),
            "|", ("company_id", "=", False), ("company_id", "=", self.env.company.id),
        ])

        return [{
            "id": lt.id,
            "name": lt.name,
            "balance": getattr(lt, "virtual_remaining_leaves", 0),
            "requires_allocation": getattr(lt, "requires_allocation", "no"),
            "allows_negative": getattr(lt, "allows_negative", False),
            "max_allowed_negative": getattr(lt, "max_allowed_negative", 0) if getattr(lt, "allows_negative", False) else 0,
            "request_unit": getattr(lt, "request_unit", "day"),
        } for lt in leave_types]

    @api.model
    def preview_admin_leave_request(self, employee_id, leave_type_id, date_from, date_to, half_day=False, period="am"):
        self._check_leave_dashboard_access()
        employee = self.env["hr.employee"].browse(int(employee_id)).exists()
        leave_type = self.env["hr.leave.type"].browse(int(leave_type_id)).exists()
        if not employee or not leave_type:
            raise ValidationError(_("Invalid leave request data."))

        vals = {
            "employee_id": employee.id,
            "holiday_status_id": leave_type.id,
            "request_date_from": date_from,
            "request_date_to": date_to,
            "request_unit_half": bool(half_day),
            "request_date_from_period": period,
        }
        preview = self.new(vals)
        if hasattr(preview, "_compute_department_id"):
            preview._compute_department_id()
        if hasattr(preview, "_compute_resource_calendar_id"):
            preview._compute_resource_calendar_id()
        if hasattr(preview, "_compute_date_from_to"):
            preview._compute_date_from_to()

        days = preview.number_of_days or 0.0

        # Check overlapping existing leave requests for FR-107.
        conflicts = self.search([
            ("employee_id", "=", employee.id),
            ("state", "in", ("confirm", "validate1", "validate")),
            ("request_date_from", "<=", date_to),
            ("request_date_to", ">=", date_from),
        ])

        return {
            "duration": round(days, 1),
            "conflicts": [{
                "id": c.id,
                "leave_type": c.holiday_status_id.name or "",
                "date_from": fields.Date.to_string(c.request_date_from),
                "date_to": fields.Date.to_string(c.request_date_to),
                "state": c.state,
            } for c in conflicts],
        }

    @api.model
    def create_admin_leave_request(
        self,
        employee_id,
        leave_type_id,
        date_from,
        date_to,
        admin_note,
        half_day=False,
        period="am",
        override_conflict=False,
    ):
        self._check_leave_dashboard_access()
        admin_note = (admin_note or "").strip()
        if len(admin_note) < 10:
            raise ValidationError(_("Admin Note / Reason must contain at least 10 characters."))

        employee = self.env["hr.employee"].browse(int(employee_id)).exists()
        leave_type = self.env["hr.leave.type"].browse(int(leave_type_id)).exists()
        if not employee or employee.company_id != self.env.company or not leave_type:
            raise ValidationError(_("Invalid request data."))
        if self._employee_has_active_disciplinary_suspension(employee):
            self.env["hr.leave.audit.log"].sudo().create({
                "action": "failed", "event_status": "failed",
                "employee_id": employee.id, "leave_type_id": leave_type.id,
                "actor_id": self.env.user.id, "actor_label": self.env.user.name,
                "note": _("Admin submission blocked: employee is under an active disciplinary suspension."),
            })
            return {
                "created": False,
                "message": _("A leave request cannot be created while this employee is under an active disciplinary suspension."),
            }

        preview = self.preview_admin_leave_request(
            employee.id, leave_type.id, date_from, date_to, half_day, period
        )

        if preview["conflicts"] and not override_conflict:
            return {
                "created": False,
                "conflict": True,
                "conflicts": preview["conflicts"],
            }

        vals = {
            "employee_id": employee.id,
            "holiday_status_id": leave_type.id,
            "request_date_from": date_from,
            "request_date_to": date_to,
            "notes": admin_note,
            "request_unit_half": bool(half_day),
            "request_date_from_period": period,
            "admin_created": True,
            "admin_created_by_id": self.env.user.id,
            "admin_created_at": fields.Datetime.now(),
            "admin_creation_note": admin_note,
            "admin_overlap_override": bool(override_conflict),
        }

        LeaveObj = self
        if override_conflict:
            LeaveObj = LeaveObj.with_context(leave_skip_date_check=True)

        leave = LeaveObj.create(vals)
        if leave.state == "draft":
            leave.action_confirm()

        # Notify employee via chatter (FR-110)
        leave._post_configured_leave_update(
            _(
                "%(admin)s created a %(leave_type)s request on your behalf from %(start)s to %(end)s (%(duration)s days).",
                admin=self.env.user.name,
                leave_type=leave_type.name,
                start=leave.request_date_from,
                end=leave.request_date_to,
                duration=leave.number_of_days,
            )
        )

        # Create Immutable Audit Log (FR-111)
        action_type = "override_conflict" if override_conflict else "admin_create"
        leave._create_audit_record(action_type, note=admin_note)

        return {"created": True, "id": leave.id}

    # ---------------------------------------------------------
    # SCREEN 11: LEAVE CALENDAR BACKEND API (FR-138 to FR-177)
    # ---------------------------------------------------------

    @api.model
    def _employee_calendar_visibility_domain(self, employee_view):
        """Employee calendar = own requests plus approved absences in their team.

        Pending, rejected, cancelled and explanatory notes belonging to colleagues
        are deliberately not exposed.
        """
        if not employee_view:
            return [], False
        employee = self._employee_for_current_user()
        own = [("employee_id", "=", employee.id)]
        if not employee.department_id:
            return own, employee
        team_approved = [
            ("employee_id.department_id", "=", employee.department_id.id),
            ("state", "=", "validate"),
            ("is_cancelled", "=", False),
        ]
        return expression.OR([own, team_approved]), employee

    @api.model
    def get_leave_calendar_data(
        self,
        date_from,
        date_to,
        department_ids=None,
        leave_type_ids=None,
        statuses=None,
        employee_ids=None,
        employee_view=False,
    ):
        self._check_leave_dashboard_access(employee_scope=employee_view)

        department_ids = [int(x) for x in (department_ids or []) if x]
        leave_type_ids = [int(x) for x in (leave_type_ids or []) if x]
        statuses = [str(s) for s in (statuses or []) if s]
        employee_ids = [int(x) for x in (employee_ids or []) if x]

        domain = [
            ("employee_id.company_id", "=", self.env.company.id),
            ("request_date_from", "<=", date_to),
            ("request_date_to", ">=", date_from),
        ]

        visibility_domain, curr_emp = self._employee_calendar_visibility_domain(employee_view)
        if visibility_domain:
            domain = expression.AND([domain, visibility_domain])
        elif employee_ids:
            domain.append(("employee_id", "in", employee_ids))

        if department_ids:
            domain.append(("employee_id.department_id", "in", department_ids))

        if leave_type_ids:
            domain.append(("holiday_status_id", "in", leave_type_ids))

        if statuses:
            state_conditions = []
            if "approved" in statuses:
                state_conditions.append(("state", "=", "validate"))
            if "pending" in statuses:
                state_conditions.append(("state", "in", ("confirm", "validate1")))
            if "cancelled" in statuses:
                state_conditions.append(("is_cancelled", "=", True))

            if state_conditions:
                or_domain = []
                for idx, cond in enumerate(state_conditions):
                    if idx > 0:
                        or_domain = ["|"] + or_domain
                    or_domain.append(cond)
                domain.extend(or_domain)
        else:
            domain.extend([
                ("state", "in", ("confirm", "validate1", "validate")),
                ("is_cancelled", "=", False),
            ])

        # Employee record rules normally hide colleagues' leave.  The sudo is
        # safe here because the server-built visibility domain above permits
        # only the employee's own records and approved records in their team.
        CalendarLeave = self.sudo() if employee_view else self
        leaves = CalendarLeave.search(domain, order="request_date_from asc")

        leave_list = []
        for l in leaves:
            status = l._get_cleon_leave_status()
            is_own = bool(curr_emp and l.employee_id == curr_emp)
            leave_list.append({
                "id": l.id,
                "request_ref": l.request_ref or f"LR-{l.id:06d}",
                "employee_id": l.employee_id.id,
                "employee_name": l.employee_id.name or "",
                "department_id": l.employee_id.department_id.id if l.employee_id.department_id else False,
                "department_name": l.employee_id.department_id.name or "No Department",
                "leave_type_id": l.holiday_status_id.id,
                "leave_type_name": l.holiday_status_id.name or "",
                "color": getattr(l.holiday_status_id, "color", 0),
                "color_hex": l.holiday_status_id.cleon_color_hex or "#64748B",
                "date_from": fields.Date.to_string(l.request_date_from),
                "date_to": fields.Date.to_string(l.request_date_to),
                "duration": round(l.number_of_days or 0.0, 1),
                "status": status,
                "half_day": bool(l.request_unit_half),
                "half_day_period": l.request_date_from_period if l.request_unit_half else False,
                "notes": (l.notes or l.admin_creation_note or "") if (not employee_view or is_own) else "",
                "is_own": is_own,
                "can_open_detail": not employee_view or is_own,
            })

        leave_types = self.env["hr.leave.type"].sudo().search([
            ("active", "=", True),
            ("company_id", "in", [False, self.env.company.id]),
        ])
        if employee_view:
            departments = curr_emp.department_id
            company_employees = self.env["hr.employee"].sudo().search([
                ("company_id", "=", self.env.company.id),
                ("department_id", "=", curr_emp.department_id.id),
                ("active", "=", True),
            ]) if curr_emp.department_id else curr_emp
        else:
            departments = self.env["hr.department"].search([
                ("company_id", "=", self.env.company.id),
            ])
            company_employees = self.env["hr.employee"].search([
                ("company_id", "=", self.env.company.id),
                ("active", "=", True),
            ])

        public_holidays = self.env["resource.calendar.leaves"].sudo().search([
            ("company_id", "in", [False, self.env.company.id]),
            ("resource_id", "=", False),
            ("date_from", "<=", date_to + " 23:59:59"),
            ("date_to", ">=", date_from + " 00:00:00"),
        ], order="date_from asc")

        return {
            "leaves": leave_list,
            "leave_types": [{
                "id": lt.id,
                "name": lt.name,
                "color": getattr(lt, "color", 0),
                "color_hex": lt.cleon_color_hex or "#64748B",
            } for lt in leave_types],
            "departments": [{
                "id": dept.id,
                "name": dept.name,
            } for dept in departments],
            "employees": [{
                "id": emp.id,
                "name": emp.name,
                "department": emp.department_id.name or "No Department",
            } for emp in company_employees],
            "total_active_employees": len(company_employees) or 1,
            "holidays": [{
                "id": holiday.id,
                "name": holiday.name or _("Public Holiday"),
                "date_from": fields.Date.to_string(holiday.date_from.date()),
                "date_to": fields.Date.to_string(holiday.date_to.date()),
            } for holiday in public_holidays],
        }

    @api.model
    def get_leave_calendar_year_summary(
        self,
        year,
        department_ids=None,
        leave_type_ids=None,
        statuses=None,
        employee_ids=None,
        employee_view=False,
        country_id=None,
    ):
        self._check_leave_dashboard_access(employee_scope=employee_view)
        year = int(year)
        date_from = f"{year}-01-01"
        date_to = f"{year}-12-31"

        department_ids = [int(x) for x in (department_ids or []) if x]
        leave_type_ids = [int(x) for x in (leave_type_ids or []) if x]
        statuses = [str(s) for s in (statuses or []) if s]
        employee_ids = [int(x) for x in (employee_ids or []) if x]

        domain = [
            ("employee_id.company_id", "=", self.env.company.id),
            ("request_date_from", "<=", date_to),
            ("request_date_to", ">=", date_from),
        ]

        visibility_domain, _curr_emp = self._employee_calendar_visibility_domain(employee_view)
        if visibility_domain:
            domain = expression.AND([domain, visibility_domain])
        elif employee_ids:
            domain.append(("employee_id", "in", employee_ids))

        if department_ids:
            domain.append(("employee_id.department_id", "in", department_ids))

        if leave_type_ids:
            domain.append(("holiday_status_id", "in", leave_type_ids))

        if statuses:
            state_conditions = []
            if "approved" in statuses:
                state_conditions.append(("state", "=", "validate"))
            if "pending" in statuses:
                state_conditions.append(("state", "in", ("confirm", "validate1")))
            if "cancelled" in statuses:
                state_conditions.append(("is_cancelled", "=", True))

            if state_conditions:
                or_domain = []
                for idx, cond in enumerate(state_conditions):
                    if idx > 0:
                        or_domain = ["|"] + or_domain
                    or_domain.append(cond)
                domain.extend(or_domain)
        else:
            domain.extend([
                ("state", "in", ("confirm", "validate1", "validate")),
                ("is_cancelled", "=", False),
            ])

        CalendarLeave = self.sudo() if employee_view else self
        leaves = CalendarLeave.search(domain)

        month_summary = {m: {"approved": 0, "pending": 0, "holidays": 0} for m in range(1, 13)}
        day_occupancy = {}

        for l in leaves:
            status = l._get_cleon_leave_status()

            # FR-164: Count each request ONCE per month it spans
            req_start_m = l.request_date_from.month if l.request_date_from else 1
            req_end_m = l.request_date_to.month if l.request_date_to else 12
            for m in range(req_start_m, req_end_m + 1):
                if 1 <= m <= 12:
                    if status == "approved":
                        month_summary[m]["approved"] += 1
                    elif status == "pending":
                        month_summary[m]["pending"] += 1

            # Day occupancy counts daily occupied days
            curr = max(l.request_date_from, fields.Date.from_string(date_from))
            end_d = min(l.request_date_to, fields.Date.from_string(date_to))
            while curr <= end_d:
                d_str = fields.Date.to_string(curr)
                if d_str not in day_occupancy:
                    day_occupancy[d_str] = {"approved": 0, "pending": 0, "total": 0}

                if status == "approved":
                    day_occupancy[d_str]["approved"] += 1
                elif status == "pending":
                    day_occupancy[d_str]["pending"] += 1
                day_occupancy[d_str]["total"] += 1

                curr += relativedelta(days=1)

        # Dynamic Public Holidays (Feedback 6 & 7 - No hardcoded fallback)
        public_leaves = self.env["resource.calendar.leaves"].search([
            ("company_id", "in", [False, self.env.company.id]),
            ("resource_id", "=", False),
            ("date_from", "<=", f"{year}-12-31 23:59:59"),
            ("date_to", ">=", f"{year}-01-01 00:00:00"),
        ])

        holidays_data = []
        for pl in public_leaves:
            h_date = fields.Date.to_string(pl.date_from.date())
            m = pl.date_from.date().month
            holidays_data.append({
                "date": h_date,
                "name": pl.name or "Public Holiday",
                "month": m,
            })

        for h in holidays_data:
            m = h["month"]
            if m in month_summary:
                month_summary[m]["holidays"] += 1

        selected_country = None
        if country_id:
            selected_country = self.env["res.country"].browse(int(country_id))
        if not selected_country or not selected_country.exists():
            selected_country = self.env.company.country_id
        if not selected_country:
            selected_country = self.env["res.country"].search([], limit=1)

        country_dict = {
            "id": selected_country.id if selected_country else 0,
            "name": selected_country.name if selected_country else "Default Region",
            "code": selected_country.code if selected_country else "DEF",
        }

        all_countries = [
            {"id": c.id, "name": c.name, "code": c.code}
            for c in self.env["res.country"].search([], order="name asc", limit=250)
        ]

        return {
            "year": year,
            "month_summary": month_summary,
            "day_occupancy": day_occupancy,
            "holidays": holidays_data,
            "country": country_dict,
            "all_countries": all_countries,
        }
