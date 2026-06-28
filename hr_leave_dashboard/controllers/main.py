# -*- coding: utf-8 -*-
import json
from odoo import http
from odoo.http import request


class HrLeaveDashboardController(http.Controller):

    @http.route('/hr_leave_dashboard/data', type='json', auth='user')
    def get_dashboard_data(self, months=6, **kwargs):
        Leave = request.env['hr.leave']
        data = Leave.sudo().get_dashboard_data(int(months))
        return data