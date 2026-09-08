# -*- coding: utf-8 -*-
from odoo import fields, models


class CleonPayslipWorkedDays(models.Model):
    _name = "cleon.payslip.worked.days"
    _description = "Cleon Payslip Worked Days"
    _order = "payslip_id, sequence"

    payslip_id = fields.Many2one(
        "cleon.payslip", string="Payslip", required=True, ondelete="cascade")
    name = fields.Char(required=True)
    code = fields.Char(required=True, help="Referenced in formulas as worked_days.CODE")
    sequence = fields.Integer(default=10)
    number_of_days = fields.Float(default=0.0)
    number_of_hours = fields.Float(default=0.0)
    work_overtime_hours = fields.Float(default=0.0)
