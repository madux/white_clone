from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)
class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    def action_view_profile(self):
        pass
        # form_view_id = self.env.ref(
        #         'hr_employee.hr_employee_profile_form_view'
        #     ).id
        # return {
        #     'type': 'ir.actions.act_window',
        #     'name': _('Employee profile'),
        #     'res_model': self._name,
        #     'res_id': self.id,
        #     'view_mode': 'tree',
        #     'views': [
        #             (form_view_id, 'form')
        #         ], 
        #     'target': 'current',
        #     # 'domain': [('id', 'in', rec_ids)]
        # }