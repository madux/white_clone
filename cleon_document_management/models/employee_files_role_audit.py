# -*- coding: utf-8 -*-
from odoo import fields, models


class DocEmployeeFilesRoleAssignmentAudit(models.Model):
    _name = "doc.employee.files.role.assignment.audit"
    _description = "Employee Files role assignment audit"
    _order = "create_date desc, id desc"

    user_id = fields.Many2one("res.users", required=True, ondelete="cascade")
    role_id = fields.Many2one("doc.employee.files.role", ondelete="set null")
    action = fields.Selection(
        [("grant", "Granted"), ("revoke", "Revoked")],
        required=True,
    )
    actor_id = fields.Many2one("res.users", required=True, ondelete="restrict")
