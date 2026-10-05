from datetime import timedelta
from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError


class TimePolicy(models.Model):
    _inherit = "cleon.time.policy"

    regularization_window_days = fields.Integer(default=30, required=True)

    @api.model
    def _installed_time_features(self):
        return dict(super()._installed_time_features(), attendance=True)


class AttendanceAudit(models.Model):
    _inherit = "cleon.time.audit.log"

    attendance_id = fields.Many2one("hr.attendance", ondelete="set null", index=True)
