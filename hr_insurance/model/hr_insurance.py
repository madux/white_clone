from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)


class HrInsurance(models.Model):
    _name = 'hr.insurance'
    _description = 'HrInsurance'
    # _inherit = ['mail.thread', 'mail.activity.mixin']
    # _order = 'booking_date desc, booking_start_time'
    _rec_name = 'name

    # ── Identification ──────────────────────────────────────────────────────
    name = fields.Char(
        string='Serial No.',
        required=True,
        copy=False,
        readonly=True,
        index=True,
        default=lambda self: _('New'),
    )