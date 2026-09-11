# -*- coding: utf-8 -*-
from odoo import fields, models


class DocumentaryRoleAssignmentAudit(models.Model):
    _name = "documentary.role.assignment.audit"
    _description = "Company Documentary role assignment audit log"
    _order = "create_date desc, id desc"

    user_id = fields.Many2one("res.users", required=True, ondelete="cascade", index=True)
    employee_id = fields.Many2one("hr.employee", ondelete="set null", index=True)
    group_id = fields.Many2one("res.groups", required=True, ondelete="restrict", index=True)
    role_key = fields.Char(index=True)
    action = fields.Selection(
        selection=[("grant", "Granted"), ("revoke", "Revoked")],
        required=True,
    )
    actor_id = fields.Many2one("res.users", required=True, ondelete="restrict", index=True)
    company_id = fields.Many2one(
        "res.company",
        default=lambda self: self.env.company,
        ondelete="restrict",
        index=True,
    )
