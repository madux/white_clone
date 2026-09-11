from odoo import api, models


class HrEmployee(models.Model):
    _inherit = "hr.employee"

    @api.model_create_multi
    def create(self, vals_list):
        employees = super().create(vals_list)
        for employee in employees:
            self.env["doc.folder"].link_employee_to_department_folder(employee)
        self.env["doc.compliance.policy"]._trigger_lifecycle_event(employees, "onboarding")
        return employees

    def write(self, vals):
        result = super().write(vals)
        if "department_id" in vals:
            for employee in self:
                self.env["doc.folder"].link_employee_to_department_folder(employee)
            self.env["doc.compliance.policy"]._trigger_lifecycle_event(self, "department_transfer")
        if "job_id" in vals:
            self.env["doc.compliance.policy"]._trigger_lifecycle_event(self, "promotion")
        if "address_id" in vals or "work_location_id" in vals:
            self.env["doc.compliance.policy"]._trigger_lifecycle_event(self, "location_change")
        if "marital" in vals:
            self.env["doc.compliance.policy"]._trigger_lifecycle_event(self, "marital_status_change")
        return result
