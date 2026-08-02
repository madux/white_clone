# -*- coding: utf-8 -*-
from odoo import models


class HrEmployeeStaffDirectory(models.Model):
    """Extends hr.employee for Staff Directory — no new fields.
    All data aggregation is handled in the controller layer
    to follow the Pattern A (standalone HTML) convention used
    by hr_administration and hr_warning."""
    _inherit = 'hr.employee'
