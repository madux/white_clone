# -*- coding: utf-8 -*-
from odoo import models, fields, api


class HrEmployee(models.Model):
    """Extends the core hr.employee model.

    Deliberately minimal: every field on the "Add New Employee" mock that
    already has a home in core Odoo (department_id, job_id, job_title,
    gender, country_id for nationality, work_location_id, parent_id for
    "Reports To", employee_type, emergency_contact/emergency_phone,
    address_home_id, bank_account_id, etc.) is reused as-is. Only fields
    with genuinely no equivalent are added here.
    """
    _inherit = "hr.employee"

    employee_number = fields.Char(
        string="Employee ID",
        copy=False,
        readonly=True,
        default=lambda self: "New",
        help="Human-readable employee code, e.g. EMP-2026-0042. "
             "Auto-generated from a sequence; core Odoo's 'barcode' field "
             "serves a different purpose (badge/PIN scanning) so isn't "
             "reused here.",
    )
    grade_level = fields.Selection(
        [
            ("l1", "L1"),
            ("l2", "L2"),
            ("l3", "L3"),
            ("l4", "L4"),
            ("l5", "L5"),
        ],
        string="Grade Level",
        help="No equivalent field exists in core hr.employee.",
    )
    pension_pin = fields.Char(
        string="Pension PIN",
        help="Regulatory pension identifier (e.g. Nigerian PenCom PIN). "
             "No equivalent field exists in core Odoo.",
    )
    work_experience_ids = fields.Many2many('hr.work_experience', 'hr_employee_experience_rel', 'emp_id', 'experience_id',  string="Work experiences")
    work_education_ids = fields.Many2many('hr.work_education',  'hr_employee_education_rel', 'emp_id', 'education_id',  string="Work education")
    work_skill_ids = fields.Many2many('hr.work_skills', string="Work Skills")
    
    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("employee_number", "New") == "New":
                vals["employee_number"] = (
                    self.env["ir.sequence"].next_by_code("hr.employee.code")
                    or "New"
                )
        return super().create(vals_list)
