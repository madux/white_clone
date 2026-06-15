from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)
 
class HrApplicant(models.Model):
    _inherit = 'hr.applicant'

    match_rating = fields.Selection([('poor', 'poor'),
                                     ('average', 'average'),
                                     ('high', 'High'),
                                     ('excellent', 'Excellent'),
                                     ], string="Match rating", default="")
    
    applied_date = fields.Date("Applied Date")

    