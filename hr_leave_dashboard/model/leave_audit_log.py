# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import AccessError, ValidationError


class HrLeaveAuditLog(models.Model):
    _name = "hr.leave.audit.log"
    _description = "Leave Audit Log"
    _order = "occurred_at desc, id desc"

    leave_id = fields.Many2one(
        "hr.leave",
        string="Leave Request",
        required=False,
        readonly=True,
        ondelete="restrict",
    )
    action = fields.Selection([
        ("submitted", "Request Submitted"),
        ("admin_create", "Leave Request Created by Admin"),
        ("forwarded", "Forwarded to Manager"),
        ("approve", "Approved"),
        ("first_approval", "First Approval"),
        ("final_approval", "Final Approval"),
        ("reject", "Rejected"),
        ("cancelled", "Cancelled"),
        ("override_conflict", "Conflict Override"),
        ("edit", "Request Edited"),
        ("comment", "Comment Added"),
        ("policy_change", "Policy Configuration Changed"),
    ], string="Action", required=True, readonly=True)

    actor_id = fields.Many2one("res.users", string="Actor", required=False, readonly=True)
    actor_label = fields.Char(string="Actor Name", readonly=True)
    actor_role = fields.Char(string="Actor Role", readonly=True)
    is_system = fields.Boolean(string="Is System Action", readonly=True)

    employee_id = fields.Many2one("hr.employee", string="Employee", required=False, readonly=True)
    leave_type_id = fields.Many2one("hr.leave.type", string="Leave Type", required=False, readonly=True)

    date_from = fields.Date(string="Start Date", readonly=True)
    date_to = fields.Date(string="End Date", readonly=True)
    duration = fields.Float(string="Duration (Days)", readonly=True)

    note = fields.Text(string="Reason / Note", readonly=True)
    occurred_at = fields.Datetime(string="Timestamp", default=fields.Datetime.now, required=True, readonly=True)

    ip_address = fields.Char(string="IP Address", readonly=True)
    session_ref = fields.Char(string="Session Reference", readonly=True)

    @api.constrains("action", "leave_id", "employee_id", "leave_type_id")
    def _check_audit_references(self):
        for log in self:
            if log.action == "policy_change":
                if not log.leave_type_id:
                    raise ValidationError(_("Policy change audit logs require a valid Leave Type reference."))
            else:
                if not log.leave_id or not log.employee_id or not log.leave_type_id:
                    raise ValidationError(_("Leave audit logs require valid Leave Request, Employee, and Leave Type references."))

    def write(self, vals):
        raise AccessError(_("Leave audit records are immutable and cannot be modified."))

    def unlink(self):
        raise AccessError(_("Leave audit records cannot be deleted."))
