from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


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
    recurrence = fields.Selection([
        ("daily", "Daily"), ("weekly", "Weekly"),
        ("biweekly", "Bi-weekly"), ("monthly", "Monthly"),
        ("rotating", "Rotating"),
    ], default="weekly", required=True)
    shift_type = fields.Selection([
        ("fixed", "Fixed"), ("rotating", "Rotating"),
        ("night", "Night"), ("split", "Split"),
    ], default="fixed", required=True)
    employee_ids = fields.Many2many("hr.employee", string="Assigned Employees")

    _sql_constraints = [
        ("shift_code_company_unique", "unique(code, company_id)", "Shift code must be unique per company."),
    ]

    @api.constrains("break_minutes", "grace_minutes")
    def _check_non_negative_minutes(self):
        if any(record.break_minutes < 0 or record.grace_minutes < 0 for record in self):
            raise ValidationError(_("Break and grace periods cannot be negative."))


class CleonHrShiftAssignment(models.Model):
    _name = "cleon.hr.shift.assignment"
    _description = "CleonHR Dated Shift Assignment"
    _order = "date_from desc, id desc"

    shift_id = fields.Many2one("cleon.hr.shift", required=True, ondelete="cascade", index=True)
    employee_id = fields.Many2one("hr.employee", index=True)
    department_id = fields.Many2one("hr.department", index=True)
    date_from = fields.Date(required=True, default=fields.Date.context_today, index=True)
    date_to = fields.Date(index=True)
    assignment_type = fields.Selection([
        ("standard", "Standard"), ("temporary", "Temporary Override"),
    ], default="standard", required=True)
    note = fields.Text()
    company_id = fields.Many2one(related="shift_id.company_id", store=True, index=True)

    @api.constrains("employee_id", "department_id")
    def _check_scope(self):
        if any(bool(record.employee_id) == bool(record.department_id) for record in self):
            raise ValidationError(_("Assign a shift to either one employee or one department."))

    @api.constrains("date_from", "date_to")
    def _check_dates(self):
        if any(record.date_to and record.date_to < record.date_from for record in self):
            raise ValidationError(_("Shift assignment end date cannot be before its start date."))
