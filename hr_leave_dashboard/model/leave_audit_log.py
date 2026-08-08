# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import AccessError


class HrLeaveAuditLog(models.Model):
    _name = "hr.leave.audit.log"
    _description = "Leave Audit Log"
    _order = "occurred_at desc, id desc"

    leave_id = fields.Many2one(
        "hr.leave",
        string="Leave Request",
        required=True,
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
    ], string="Action", required=True, readonly=True)

    actor_id = fields.Many2one("res.users", string="Actor", required=False, readonly=True)
    actor_label = fields.Char(string="Actor Name", readonly=True)
    actor_role = fields.Char(string="Actor Role", readonly=True)
    is_system = fields.Boolean(string="Is System Action", readonly=True)

    employee_id = fields.Many2one("hr.employee", string="Employee", required=True, readonly=True)
    leave_type_id = fields.Many2one("hr.leave.type", string="Leave Type", required=True, readonly=True)

    date_from = fields.Date(string="Start Date", readonly=True)
    date_to = fields.Date(string="End Date", readonly=True)
    duration = fields.Float(string="Duration (Days)", readonly=True)

    note = fields.Text(string="Reason / Note", readonly=True)
    occurred_at = fields.Datetime(string="Timestamp", default=fields.Datetime.now, required=True, readonly=True)

    ip_address = fields.Char(string="IP Address", readonly=True)
    session_ref = fields.Char(string="Session Reference", readonly=True)

    def write(self, vals):
        raise AccessError(_("Leave audit records are immutable and cannot be modified."))

    def unlink(self):
        raise AccessError(_("Leave audit records cannot be deleted."))
