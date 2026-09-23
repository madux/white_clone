from odoo import fields, models


class AttendanceShift(models.Model):
    _inherit = "hr.attendance"

    cleon_shift_id = fields.Many2one("cleon.hr.shift", string="Shift")
