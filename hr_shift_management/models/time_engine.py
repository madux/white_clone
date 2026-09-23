from odoo import api, fields, models


class ShiftTimeEngine(models.AbstractModel):
    _inherit = "cleon.time.engine"

    @api.model
    def _prepare_schedule_cache(self, employees, start_date, end_date):
        cache = super()._prepare_schedule_cache(employees, start_date, end_date)
        assignments = self.env["cleon.hr.shift.assignment"].sudo().search([
            ("company_id", "in", employees.mapped("company_id").ids),
            "|", ("employee_id", "in", employees.ids),
                 ("department_id", "in", employees.mapped("department_id").ids),
            ("date_from", "<=", end_date),
            "|", ("date_to", "=", False), ("date_to", ">=", start_date),
        ])
        swaps = self.env["cleon.shift.swap.request"].sudo().search([
            ("company_id", "in", employees.mapped("company_id").ids), ("state", "=", "approved"),
            ("swap_date", ">=", start_date), ("swap_date", "<=", end_date),
            "|", ("requester_id", "in", employees.ids), ("target_employee_id", "in", employees.ids),
        ])
        assignment_index, swap_index = {}, {}
        for assignment in assignments:
            key = (assignment.assignment_type, bool(assignment.employee_id),
                   assignment.employee_id.id or assignment.department_id.id)
            assignment_index.setdefault(key, []).append(assignment)
        for swap in swaps:
            for employee_id in (swap.requester_id.id, swap.target_employee_id.id):
                swap_index.setdefault((employee_id, swap.swap_date), []).append(swap)
        cache["schedule"] = {"assignments": assignment_index, "swaps": swap_index, "policies": {}}
        cache["schedule_range"] = (fields.Date.to_date(start_date), fields.Date.to_date(end_date))
        return cache

    @api.model
    def _expected_schedule(self, employee, target_date, cache=None):
        target_date = fields.Date.to_date(target_date)
        key = (employee.id, target_date)
        if cache is not None and key in cache.setdefault("expected", {}):
            return cache["expected"][key]
        batch = cache.get("schedule") if cache is not None else None
        if batch is not None:
            start, end = cache["schedule_range"]
            if not start <= target_date <= end:
                batch = None
        result = self.env["cleon.hr.shift"]._get_expected_working_hours_internal(employee.id, target_date, batch)
        if result.get("shift_id"):
            shift = self.env["cleon.hr.shift"].sudo().browse(result["shift_id"])
            result = dict(result, schedule_source="shift_assignment", timezone=shift.resource_calendar_id.tz)
        if cache is not None:
            cache["expected"][key] = result
        return result
