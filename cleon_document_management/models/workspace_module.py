# -*- coding: utf-8 -*-
from odoo import fields, models


class DocWorkspaceModule(models.Model):
    _name = "doc.workspace.module"
    _description = "Delegatable workspace module catalog"
    _order = "group, sequence, name"

    key = fields.Char(required=True, index=True)
    name = fields.Char(required=True)
    group = fields.Char(string="Nav group", default="workspace")
    sequence = fields.Integer(default=10)
    sensitive = fields.Boolean(default=False)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ("workspace_module_key_unique", "unique(key)", "Module key must be unique."),
    ]
