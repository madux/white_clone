# -*- coding: utf-8 -*-
from datetime import datetime, timedelta, time
import pytz

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError


class CleonAttendanceRegularization(models.Model):
    _name = "cleon.attendance.regularization"
    _description = "CleonHR Attendance Regularization Request"
    _order = "create_date desc, id desc"

    employee_id = fields.Many2one("hr.employee", required=True, index=True)
    company_id = fields.Many2one("res.company", related="employee_id.company_id", store=True, index=True)
    attendance_date = fields.Date(required=True, index=True)
    issue_type = fields.Selection([
        ("forgot_in", "Forgot Check-In"),
        ("forgot_out", "Forgot Check-Out"),
        ("forgot_check_in", "Forgot Check-In"),
        ("forgot_check_out", "Forgot Check-Out"),
        ("system_glitch", "System Glitch"),
        ("other", "Other"),
    ], default="other", required=True)
    requested_check_in = fields.Datetime(required=True)
    requested_check_out = fields.Datetime()
    reason = fields.Text(required=True)
    state = fields.Selection([
        ("draft", "Draft"),
        ("submitted", "Submitted"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
    ], default="draft", required=True, index=True)
    approver_id = fields.Many2one("res.users", readonly=True)
    decision_date = fields.Datetime(readonly=True)
    manager_comment = fields.Text(readonly=True)
    attendance_id = fields.Many2one("hr.attendance", readonly=True, ondelete="set null")
    attachment_ids = fields.Many2many("ir.attachment", string="Supporting Documents")

    _sql_constraints = [
        ("employee_date_unique", "unique(employee_id, attendance_date)", "A regularization request already exists for this employee on this date."),
    ]

    def _approval_fallback_config(self):
        self.ensure_one()
        c_id = self._approval_company().id
        policy = self.env["cleon.time.policy"].sudo().search([("company_id", "=", c_id)], limit=1)
        require_approval = policy.regularization_require_approval if policy else True
        fallback_type = policy.regularization_fallback_approver if policy else "direct_manager"

        fallback_users = self.env["res.users"]
        employee = self._approval_employee()
        if fallback_type in ("direct_manager", "manager"):
            parent_user = employee.sudo().parent_id.sudo().user_id
            if parent_user and parent_user.active:
                fallback_users = parent_user
        elif fallback_type in ("department_head", "dept"):
            dept_user = employee.sudo().department_id.sudo().manager_id.sudo().user_id
            if dept_user and dept_user.active:
                fallback_users = dept_user

        if not fallback_users:
            group = self.env.ref("hr_time_management.group_time_management_hr_manager", raise_if_not_found=False)
            if group:
                fallback_users = group.users.filtered(lambda u: u.active and c_id in u.sudo().company_ids.ids)

        return {
            "require_approval": require_approval,
            "fallback_users": fallback_users,
        }

    def _approval_workflow_code(self):
        return "time_regularization"

    def _approval_employee(self):
        self.ensure_one()
        return self.employee_id

    def _approval_company(self):
        self.ensure_one()
        return self.company_id or self.employee_id.sudo().company_id or self.env.company

    def _approval_period(self):
        self.ensure_one()
        return self.attendance_date, self.attendance_date

    def _approval_validate_decision(self, decision, automated=False, comment=False):
        self.ensure_one()
        c_id = self._approval_company()
        self.env["cleon.time.period.lock"].check_period_lock(c_id, self.attendance_date, _("Attendance Regularization Decision"), override_reason=comment, allow_override=not automated)
        if decision == "approve" and self.requested_check_out and self.requested_check_out <= self.requested_check_in:
            raise ValidationError(_("Requested check-out must be after check-in."))
        return True

    def _approval_finalize_approve(self):
        for request in self:
            user = self.env.user
            attendance = request.attendance_id
            if not attendance:
                attendance = self.env["hr.attendance"].sudo().search([
                    ("employee_id", "=", request.employee_id.id),
                    ("check_in", ">=", datetime.combine(request.attendance_date, time.min)),
                    ("check_in", "<=", datetime.combine(request.attendance_date, time.max)),
                ], limit=1)
            before = {}
            if attendance:
                before = {
                    "check_in": fields.Datetime.to_string(attendance.check_in),
                    "check_out": fields.Datetime.to_string(attendance.check_out) if attendance.check_out else False,
                }
                attendance.sudo().write({
                    "check_in": request.requested_check_in,
                    "check_out": request.requested_check_out or attendance.check_out,
                })
            else:
                attendance = self.env["hr.attendance"].sudo().create({
                    "employee_id": request.employee_id.id,
                    "check_in": request.requested_check_in,
                    "check_out": request.requested_check_out,
                })
            after = {
                "check_in": fields.Datetime.to_string(request.requested_check_in),
                "check_out": fields.Datetime.to_string(request.requested_check_out) if request.requested_check_out else False,
            }
            request.sudo().write({
                "state": "approved",
                "attendance_id": attendance.id,
                "approver_id": user.id,
                "decision_date": fields.Datetime.now(),
            })
            request._audit("approved", "Attendance regularization approved.", before=before, after=after)

    def _approval_finalize_reject(self, comment):
        for request in self:
            user = self.env.user
            request.sudo().write({
                "state": "rejected",
                "approver_id": user.id,
                "decision_date": fields.Datetime.now(),
                "manager_comment": comment or False,
            })
            request._audit("rejected", comment or "Attendance regularization rejected.")

    @api.constrains("reason")
    def _check_reason(self):
        for record in self:
            reason = (record.reason or "").strip()
            if len(reason) < 20 or len(reason) > 500:
                raise ValidationError(_("The reason for attendance regularization must be between 20 and 500 characters."))

    def _is_manager(self):
        Policy = self.env["cleon.time.policy"]
        role = Policy._tm_role()
        return role in ("line_manager", "hr_manager", "hr_admin", "system_admin")

    def _serialize(self):
        self.ensure_one()
        return {
            "id": self.id,
            "employee": self.employee_id.sudo().name,
            "attendance_date": fields.Date.to_string(self.attendance_date),
            "issue_type": self.issue_type,
            "issue_label": dict(self._fields["issue_type"].selection).get(self.issue_type),
            "requested_check_in": fields.Datetime.to_string(self.requested_check_in),
            "requested_check_out": fields.Datetime.to_string(self.requested_check_out),
            "reason": self.reason,
            "state": self.state,
            "submitted_on": fields.Datetime.to_string(self.create_date),
            "approver": self.approver_id.name or False,
            "decision_date": fields.Datetime.to_string(self.decision_date) if self.decision_date else False,
            "manager_comment": self.manager_comment or "",
            "attachment_count": len(self.attachment_ids),
        }

    @api.model
    def get_my_requests(self):
        employee = self.env.user.employee_id
        if not employee:
            raise UserError(_("Your user account is not linked to an employee record."))
        requests = self.search([("employee_id", "=", employee.id)], order="create_date desc")
        return [request._serialize() for request in requests]

    @api.model
    def get_manager_requests(self):
        if not self._is_manager():
            raise AccessError(_("Only Time Management managers can review attendance corrections."))
        requests = self.search([("company_id", "in", self.env.companies.ids)], order="create_date asc")
        return [request._serialize() for request in requests]

    @api.model
    def submit_request(self, values):
        employee = self.env.user.employee_id
        if not employee:
            raise UserError(_("Your user account is not linked to an employee record."))
        attendance_date = fields.Date.to_date(values.get("attendance_date"))
        if not attendance_date:
            raise ValidationError(_("Attendance date is required."))
        timezone = pytz.timezone(self.env.user.tz or "UTC")

        def to_utc(value, required=False):
            if not value:
                if required:
                    raise ValidationError(_("Requested clock-in time is required."))
                return False
            parsed = fields.Datetime.to_datetime(value)
            localized = timezone.localize(parsed).astimezone(pytz.UTC).replace(tzinfo=None)
            return localized

        requested_in = to_utc(values.get("requested_check_in"), required=True)
        requested_out = to_utc(values.get("requested_check_out"))
        day_start = timezone.localize(datetime.combine(attendance_date, time.min)).astimezone(pytz.UTC).replace(tzinfo=None)
        day_end = day_start + timedelta(days=1)
        if not (day_start <= requested_in < day_end) or (requested_out and not day_start <= requested_out < day_end):
            raise ValidationError(_("Requested times must fall on the selected attendance date."))
        if requested_out and requested_out <= requested_in:
            raise ValidationError(_("Requested check-out must be after check-in."))

        att = self.env["hr.attendance"].sudo().search([
            ("employee_id", "=", employee.id),
            ("check_in", ">=", day_start),
            ("check_in", "<", day_end),
        ], limit=1)

        request = self.create({
            "employee_id": employee.id,
            "attendance_date": attendance_date,
            "issue_type": values.get("issue_type") or "other",
            "requested_check_in": requested_in,
            "requested_check_out": requested_out,
            "reason": (values.get("reason") or "").strip(),
            "attendance_id": att.id if att else False,
        })
        request.action_submit()
        return request._serialize()

    @api.model
    def manager_decide(self, request_id, decision, comment=False):
        request = self.browse(request_id).exists()
        if not request:
            raise UserError(_("The regularization request no longer exists."))
        if not self._is_manager():
            raise AccessError(_("Only Time Management managers can review attendance corrections."))
        if decision == "approve":
            request.action_approve()
        elif decision == "reject":
            request.action_reject(comment=comment)
        else:
            raise ValidationError(_("Unknown manager decision."))
        return request._serialize()

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            self._check_workflow_protection(vals)
            if vals.get("attendance_date"):
                emp = self.env["hr.employee"].browse(vals.get("employee_id")).exists()
                c_id = emp.sudo().company_id if emp else self.env.company
                self.env["cleon.time.period.lock"].check_period_lock(c_id, vals["attendance_date"], _("Attendance Regularization"))
        return super().create(vals_list)

    def write(self, vals):
        self._check_workflow_protection(vals)
        if not self.env.su and not self.env.user.has_group("base.group_system"):
            for rec in self:
                c_id = rec.company_id or rec.employee_id.sudo().company_id
                target_date = vals.get("attendance_date") or rec.attendance_date
                if target_date:
                    self.env["cleon.time.period.lock"].check_period_lock(c_id, target_date, _("Attendance Regularization"), vals.get("manager_comment"))
        return super().write(vals)

    def unlink(self):
        if not self.env.su and not self.env.user.has_group("base.group_system"):
            for rec in self:
                c_id = rec.company_id or rec.employee_id.sudo().company_id
                if rec.attendance_date:
                    self.env["cleon.time.period.lock"].check_period_lock(c_id, rec.attendance_date, _("Attendance Regularization"))
        return super().unlink()

    def _check_workflow_protection(self, vals):
        if self.env.su or self.env.user.has_group("base.group_system"):
            return
        if "state" in vals:
            raise AccessError(_("Direct workflow state mutation is prohibited. Use approval/action methods instead."))
        protected_fields = {"manager_comment", "approver_id", "decision_date"}
        if protected_fields.intersection(vals.keys()):
            raise AccessError(_("Direct decision field mutation is prohibited. Use approval/action methods instead."))

    def action_submit(self):
        self._check_reason()
        for record in self.filtered(lambda r: r.state == "draft"):
            c_id = record.company_id or record.employee_id.sudo().company_id
            self.env["cleon.time.period.lock"].check_period_lock(c_id, record.attendance_date, _("Attendance Regularization Submit"))
            policy = self.env["cleon.time.policy"].sudo().get_runtime_policy()
            cutoff_days = policy.get("regularization_window_days") or 7
            cutoff_date = fields.Date.context_today(self) - timedelta(days=cutoff_days)
            if record.attendance_date < cutoff_date:
                raise ValidationError(_("Submission blocked: Attendance date %s exceeds the cutoff window of %s days.") % (record.attendance_date, cutoff_days))
            record.sudo().write({"state": "submitted"})
            instance = self.env["cleon.approval.instance"].action_start(record)

    def action_withdraw(self):
        for record in self:
            user = self.env.user
            is_owner = (record.employee_id.sudo().user_id == user)
            Policy = self.env["cleon.time.policy"]
            role = Policy._tm_role(user)
            is_authorized_admin = role in ("system_admin", "hr_admin") or user.has_group("base.group_system")
            if not (is_owner or is_authorized_admin or self.env.su):
                raise AccessError(_("You are not authorized to withdraw this regularization request. Only the requesting employee or an HR/System Administrator can withdraw."))
            c_id = record.company_id or record.employee_id.sudo().company_id
            self.env["cleon.time.period.lock"].check_period_lock(c_id, record.attendance_date, _("Attendance Regularization Withdraw"))
            if record.state not in ("submitted", "draft"):
                raise UserError(_("Only submitted or draft regularizations can be withdrawn."))
            self.env["cleon.approval.instance"].action_cancel_for_target(record, reason=_("Withdrawn by employee."))
            record.sudo().write({"state": "draft"})

    def action_approve(self):
        for request in self:
            instance = self.env["cleon.approval.instance"].sudo().search([
                ("res_model", "=", request._name),
                ("res_id", "=", request.id),
                ("state", "=", "pending"),
            ], limit=1)
            if instance:
                instance.with_user(self.env.user).action_decide("approve")
            else:
                if request.state != "submitted":
                    raise UserError(_("Only submitted regularization requests can be approved."))
                if not self.env["cleon.time.policy"]._tm_can_approve(request, self.env.user):
                    raise AccessError(_("You are not authorized to approve this attendance regularization request."))
                request._approval_validate_decision("approve")
                request._approval_finalize_approve()

    def action_reject(self, comment=False):
        for request in self:
            instance = self.env["cleon.approval.instance"].sudo().search([
                ("res_model", "=", request._name),
                ("res_id", "=", request.id),
                ("state", "=", "pending"),
            ], limit=1)
            if instance:
                instance.with_user(self.env.user).action_decide("reject", comment=comment)
            else:
                if request.state != "submitted":
                    raise UserError(_("Only submitted regularization requests can be rejected."))
                if not self.env["cleon.time.policy"]._tm_can_approve(request, self.env.user):
                    raise AccessError(_("You are not authorized to reject this attendance regularization request."))
                request._approval_validate_decision("reject", comment=comment)
                request._approval_finalize_reject(comment)

    def _audit(self, action, details, before=None, after=None):
        valid_action = action if action in ("created", "modified", "regularized", "approved", "rejected", "submitted", "withdrawn", "correction", "accepted") else "modified"
        self.env["cleon.time.audit.log"].sudo().create({
            "employee_id": self.employee_id.id,
            "action": valid_action,
            "module_area": "regularization",
            "entity_type": self._name,
            "entity_id": self.id,
            "details": details,
        })
