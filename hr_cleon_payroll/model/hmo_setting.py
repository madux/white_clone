from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)

class HMOsetting(models.Model):
    _name = 'hmo.setting'
    _description = 'CLEONHR HMO ELIGIBILTY & Settings'
    _rec_name = 'name'

    name = fields.Char(
        string='Name',
        required=True,
        copy=True,
        index=True,
        default=lambda self: _('New'),
    )

    description = fields.Char(
        string='Description',
        required=True,
        copy=True,
    )
    sequence = fields.Integer(
        string='Sequence',
        default=1,
    )
    active = fields.Boolean(
        string='active',
        default=True,
    )
    # model_id = fields.Many2one('ir.model', string="App")

    eligibilty_ids = fields.Many2many(
        'hr.grade',
        string='Grade Eligible',
    )
    hmo_ids = fields.Many2many(
        'hmo.marketplace',
        string='Applicable HMO providers',
    )

 