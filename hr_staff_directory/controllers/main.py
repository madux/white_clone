# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request


class StaffDirectoryController(http.Controller):

    @http.route('/hr_staff_directory/data', type='json', auth='user')
    def get_staff_directory_data(self, **kwargs):
        return request.env['hr.employee'].sudo().get_staff_directory_dashboard_data()

    @http.route('/hr_staff_directory/people', type='json', auth='user')
    def get_staff_directory_people(self, **kwargs):
        return request.env['hr.employee'].sudo().get_staff_directory_people_data()

    @http.route('/hr_staff_directory/toggle_pin', type='json', auth='user')
    def toggle_pin(self, employee_id, **kwargs):
        return request.env['hr.employee'].sudo().toggle_employee_pin(employee_id)
