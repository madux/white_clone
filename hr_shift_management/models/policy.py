from datetime import timedelta
from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError


class TimePolicy(models.Model):
    _inherit = "cleon.time.policy"

    selected_shift_id = fields.Many2one(
        "cleon.hr.shift", string="Default Shift Template", check_company=True
    )

    default_shift_id = fields.Many2one("cleon.hr.shift", string="Default Company Shift")

    @api.model
    def _installed_time_features(self):
        return dict(super()._installed_time_features(), shift=True)
