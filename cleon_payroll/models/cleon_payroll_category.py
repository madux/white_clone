# -*- coding: utf-8 -*-
from odoo import fields, models


class CleonPayrollCategory(models.Model):
    _name = "cleon.payroll.category"
    _description = "Cleon Payroll Rule Category"
    _order = "sequence, name"

    name = fields.Char(required=True)
    code = fields.Char(required=True, help="Used in formulas as categories.CODE")
    sequence = fields.Integer(default=10)
    parent_id = fields.Many2one("cleon.payroll.category", string="Parent")
    note = fields.Text()

    _sql_constraints = [
        ("code_uniq", "unique(code)", "Category code must be unique."),
    ]

    def open_record(self):
        ref = 'cleon_payroll.view_cleon_payroll_category_form'
        view_id = self.env.ref(ref).id
        ret = {
            'name': "HMO Plan",
            'view_mode': 'form',
            'view_id': view_id,
            'view_type': 'form',
            'res_model': self._name,
            'res_id': self.id,
            'type': 'ir.actions.act_window',
            'domain': [],
            'target': 'new'
            }
        return ret