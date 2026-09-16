# -*- coding: utf-8 -*-
from odoo import api, fields, models


class CleonLocation(models.Model):
    _name = "cleon.location"
    _description = "Cleon Company Location"
    _inherit = ["mail.thread"]
    _order = "name"

    name = fields.Char(required=True, tracking=True)
    code = fields.Char(required=True, tracking=True)
    company_id = fields.Many2one(
        "res.company", string="Company",
        default=lambda self: self.env.company, required=True, tracking=True)
    address = fields.Text()
    city = fields.Char()
    state_id = fields.Many2one("res.country.state", string="State")
    country_id = fields.Many2one("res.country", string="Country")
    manager_id = fields.Many2one("hr.employee", string="Location Manager")
    employee_ids = fields.One2many(
        "hr.employee", "cleon_location_id", string="Employees")
    employee_count = fields.Integer(
        compute="_compute_employee_count", string="Employees")
    active = fields.Boolean(default=True)

    _sql_constraints = [
        ("code_company_uniq", "unique(code, company_id)",
         "Location code must be unique per company."),
    ]

    @api.depends("employee_ids")
    def _compute_employee_count(self):
        for rec in self:
            rec.employee_count = len(rec.employee_ids)
