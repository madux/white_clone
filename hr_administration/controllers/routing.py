# controllers/main.py

from odoo import http
from odoo.http import request


class OpenActionController(http.Controller):

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
   
    @http.route('/app/employees', type='http', auth='user')
    def open_employees(self, **kwargs):
        main_action = request.env.ref('hr.open_view_employee_list_my').sudo().read()[0]
        new_action = request.env.ref('hr_employee.action_view_employee_kanban_custom').sudo().read()[0]
        action = new_action or main_action
        return self.redirect_to_page(action, 'kanban', 'kanban')

    @http.route('/app/leave', type='http', auth='user')
    def open_leave(self, **kwargs):
        action = False
        # http://whiteclone.localhost:8072/web#action=1070
        # try:
        old_action = request.env.ref('hr_holidays.hr_leave_action_new_request').sudo().read()[0]
        new_action = request.env.ref('hr_leave_dashboard.action_hr_leave_dashboard').sudo().read()[0]
    
        if new_action:
            return request.redirect(
                '/web#action=%s' % (new_action.get('id'))
            )
        else:
            return self.redirect_to_page(old_action,'calendar', 'calendar')
        # except Exception as e:
        #     pass 

    @http.route('/app/calendar', type='http', auth='user')
    def open_calendar(self, **kwargs):
        action = request.env.ref('calendar.action_calendar_event').sudo().read()[0]
        return self.redirect_to_page(action,'kanban', 'kanban')

    @http.route('/app/recruitment', type='http', auth='user')
    def open_recruitment(self, **kwargs):
        action = request.env.ref('hr_cleon_recruitment.action_hr_applicant_recruitment').sudo().read()[0]
        return self.redirect_to_page(action,'tree', 'tree')
    
    @http.route('/app/insurance', type='http', auth='user')
    def open_hmo_insurance_dashboard(self, **kwargs):
        action = request.env['hr.insurance'].sudo().get_dashboard()
        return request.redirect(
            '/web#id=%s&model=%s&view_type=form'
            % (
                action['res_id'],
                action['res_model']
            )
        )

    @http.route('/app/disciplinary', type='http', auth='user')
    def open_disciplinary_dashboard(self, **kwargs):
        action = request.env.ref('hr_warning.action_hr_warning').sudo().read()[0]
        return self.redirect_to_page(action,'tree', 'tree')

    @http.route('/app/maintenance', type='http', auth='user')
    def open_maintenance(self, **kwargs):
        return request.redirect(
            '/hr-employee-admin' 
        )

    @http.route('/app/payslips', type='http', auth='user')
    def open_payslips(self, **kwargs):
        return request.redirect(
            '/hr-employee-admin' 
        )

    @http.route('/app/settings', type='http', auth='user')
    def open_settings(self, **kwargs):
        return request.redirect(
            '/hr-employee-admin' 
        )

    # @http.route('/app/settings', type='http', auth='user')
    # def open_settings(self, **kwargs):
    #     return request.redirect(
    #         '/hr-employee-admin' 
    #     )


# class OpenActionController(http.Controller):

#     @http.route('/open/record/<int:record_id>', type='http', auth='user')
#     def open_record(self, record_id, **kwargs):

#         return request.redirect(
#             '/web#id=%s&model=my.model&view_type=form'
#             % record_id
#         )