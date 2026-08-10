from odoo import fields, models


class CleonHrShift(models.Model):
    _name = "cleon.hr.shift"
    _description = "CleonHR Work Shift"
    _order = "name"

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    active = fields.Boolean(default=True)
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company)
    start_hour = fields.Float(required=True, default=9.0)
    end_hour = fields.Float(required=True, default=17.0)
    break_minutes = fields.Integer(default=60)
    grace_minutes = fields.Integer(default=0)
    employee_ids = fields.Many2many("hr.employee", string="Assigned Employees")

    _sql_constraints = [
        ("shift_code_company_unique", "unique(code, company_id)", "Shift code must be unique per company."),
    ]
