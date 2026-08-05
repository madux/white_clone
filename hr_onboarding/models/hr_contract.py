# -*- coding: utf-8 -*-
from odoo import models, fields


class HrContract(models.Model):
    """hr.contract already provides trial_date_start / trial_date_end,
    which is exactly what "Probation Tracking" needs — reused as-is.
    Only the PIP flag has no existing equivalent.
    """
    _inherit = "hr.contract"

    on_pip = fields.Boolean(
        string="On PIP",
        help="Performance Improvement Plan flag. No equivalent field "
             "exists in core hr.contract.",
    )
