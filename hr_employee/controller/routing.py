# controllers/main.py

from odoo import http
from odoo.http import request


class OpenActionWarningController(http.Controller):

    def redirect_to_page(self, action, view_type='list', view_mode='list'):
        return request.redirect(
            '/web#action=%s&model=%s&view_type=%s&view_mode=%s'
            % (
                action['id'],
                action.get('res_model'),
                view_type,
                view_mode,
            )
        )

    @http.route('/app/announcement', type='http', auth='user')
    def open_announcement(self, **kwargs):
        action = request.env.ref('hr_employee.action_hr_core_announcement').sudo().read()[0]
        return self.redirect_to_page(action,'kanban', 'kanban')

    # @http.route('/app/disciplinary/measure', type='http', auth='user')
    # def open_disciplinary_measure_dashboard(self, **kwargs):
    #     action = request.env.ref('hr_warning.action_hr_warning_interim_measure').sudo().read()[0]
    #     return self.redirect_to_page(action,'tree', 'tree')


    # @http.route('/app/disciplinary', type='http', auth='user')
    # def open_disciplinary_dashboard(self, **kwargs):
    #     action = request.env.ref('hr_warning.action_hr_warning').sudo().read()[0]
    #     return self.redirect_to_page(action,'tree', 'tree')

    # @http.route('/app/disciplinary/hearing', type='http', auth='user')
    # def open_disciplinary_hearing_dashboard(self, **kwargs):
    #     action = request.env.ref('hr_warning.action_hr_warning_investigations').sudo().read()[0]
    #     return self.redirect_to_page(action,'tree', 'tree')

    # @http.route('/app/disciplinary/casetype', type='http', auth='user')
    # def open_disciplinary_casetype_dashboard(self, **kwargs):
    #     action = request.env.ref('hr_warning.action_hr_warning_case_type').sudo().read()[0]
    #     return self.redirect_to_page(action,'tree', 'tree')

    # @http.route('/incident-reporting', type='http', auth='user')
    # def open_report_analytics(self, **kwargs):
    #     return request.redirect(
    #         '/incident-reporting' 
    #     )

     