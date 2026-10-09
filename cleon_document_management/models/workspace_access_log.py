# -*- coding: utf-8 -*-
from odoo import fields, models


class DocWorkspaceAccessLog(models.Model):
    _name = "doc.workspace.access.log"
    _description = "Workspace delegation audit log"
    _order = "create_date desc"

    grant_id = fields.Many2one("doc.workspace.grant", ondelete="set null", index=True)
    actor_id = fields.Many2one("res.users", required=True, index=True)
    owner_id = fields.Many2one("res.users", required=True, index=True)
    event = fields.Char(required=True, index=True)
    module_key = fields.Char()
    detail = fields.Json()
