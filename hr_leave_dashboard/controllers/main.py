# -*- coding: utf-8 -*-
from odoo import http
from odoo.exceptions import AccessError
from odoo.http import request
from werkzeug.utils import redirect

class HrLeaveDashboardController(http.Controller):

    @http.route('/hr_leave_dashboard/data', type='json', auth='user')
    def get_dashboard_data(self, months=6, **kwargs):
        Leave = request.env['hr.leave']
        data = Leave.get_dashboard_data(int(months))
        return data

    @http.route('/leave/setup-guide', type='http', auth='user')
    def open_setup_guide(self, **kwargs):
        if not request.env.user.has_group('hr_leave_dashboard.group_leave_permission_configuration'):
            raise AccessError('You do not have permission to open Leave configuration.')
        action = request.env.ref('hr_leave_dashboard.action_hr_leave_dashboard')
        return redirect('/web?leave_setup=1#action=%s' % action.id)
