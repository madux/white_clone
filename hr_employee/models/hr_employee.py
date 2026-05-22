from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)
 
class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    employee_number = fields.Char(string="Staff Number")
    
    # hr_warning_ids = fields.One2many("hr.warning", 'employee_id', string="Disciplinary Actions")

    def action_view_profile(self):
        form_view_id = self.env.ref(
                'hr.view_employee_form'
            ).id
        return {
            'type': 'ir.actions.act_window',
            'name': _('Employee profile'),
            'res_model': self._name,
            'res_id': self.id,
            'view_mode': 'tree',
            'views': [
                    (form_view_id, 'form')
                ], 
            'target': 'new',
            # 'domain': [('id', 'in', rec_ids)]
        }