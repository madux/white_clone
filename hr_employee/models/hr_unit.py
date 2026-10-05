# -*- coding: utf-8 -*-
from odoo import fields, models


class HrUnit(models.Model):
    _name = "hr.unit"
    _description = "Organisation Unit"
    _order = "name, id"

    name = fields.Char(required=True, index=True)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ("hr_unit_name_unique", "unique(name)", "An organisation unit with this name already exists."),
    ]
