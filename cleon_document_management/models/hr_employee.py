from odoo import api, models


class HrEmployee(models.Model):
    _inherit = "hr.employee"

    @api.model_create_multi
    def create(self, vals_list):
        employees = super().create(vals_list)
        for employee in employees:
            self.env["doc.folder"].link_employee_to_department_folder(employee)
        return employees

    def write(self, vals):
        result = super().write(vals)
        if "department_id" in vals:
            for employee in self:
                self.env["doc.folder"].link_employee_to_department_folder(employee)
        return result
