# -*- coding: utf-8 -*-
from odoo import fields, models


class CleonLookupTable(models.Model):
    """Level 5: e.g. CAR_GRADE_TABLE (grade -> amount)."""
    _name = "cleon.payroll.lookup.table"
    _description = "Cleon Payroll Lookup Table"

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    company_id = fields.Many2one("res.company", default=lambda s: s.env.company)
    row_ids = fields.One2many("cleon.payroll.lookup.row", "table_id", copy=True)
    _sql_constraints = [("code_company_uniq", "unique(code, company_id)",
                         "Lookup table code must be unique per company.")]

    def lookup(self, key):
        self.ensure_one()
        k = key.strip().lower() if isinstance(key, str) else key
        for row in self.row_ids:
            if (row.key or "").strip().lower() == k:
                return row.value
        return None


class CleonLookupRow(models.Model):
    _name = "cleon.payroll.lookup.row"
    _description = "Cleon Payroll Lookup Row"
    _order = "table_id, sequence, id"

    table_id = fields.Many2one("cleon.payroll.lookup.table", required=True, ondelete="cascade")
    sequence = fields.Integer(default=10)
    key = fields.Char(required=True)
    value = fields.Float(digits=(16, 2), required=True)
