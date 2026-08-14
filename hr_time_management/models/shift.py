from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class CleonHrShift(models.Model):
    _name = "cleon.hr.shift"
    _description = "CleonHR Work Shift"
    _order = "name"

    name = fields.Char(required=True)
    code = fields.Char(required=True)
    active = fields.Boolean(default=True)
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company)
    start_hour = fields.Float(required=True, default=9.0)
    end_hour = fields.Float(required=True, default=17.0)
    break_minutes = fields.Integer(default=60)
    grace_minutes = fields.Integer(default=0)
    active_days = fields.Char(default="0,1,2,3,4", help="Comma-separated weekday numbers, Monday=0.")
    recurrence = fields.Selection([
        ("daily", "Daily"), ("weekly", "Weekly"),
        ("biweekly", "Bi-weekly"), ("monthly", "Monthly"),
        ("rotating", "Rotating"),
    ], default="weekly", required=True)
    shift_type = fields.Selection([
        ("fixed", "Fixed"), ("rotating", "Rotating"),
        ("night", "Night"), ("split", "Split"),
    ], default="fixed", required=True)
    employee_ids = fields.Many2many("hr.employee", string="Assigned Employees")

    _sql_constraints = [
        ("shift_code_company_unique", "unique(code, company_id)", "Shift code must be unique per company."),
    ]

    @api.constrains("name", "company_id")
    def _check_unique_name(self):
        """Keep new shift names unique without breaking upgrades over legacy duplicates."""
        for record in self.filtered("name"):
            duplicate = self.search_count([
                ("id", "!=", record.id),
                ("company_id", "=", record.company_id.id),
                ("name", "=ilike", record.name.strip()),
            ])
            if duplicate:
                raise ValidationError(_("Shift name must be unique per company."))

    @api.constrains("break_minutes", "grace_minutes")
    def _check_non_negative_minutes(self):
        if any(not 0 <= record.break_minutes <= 120 or not 0 <= record.grace_minutes <= 60 for record in self):
            raise ValidationError(_("Break must be between 0 and 120 minutes and grace period between 0 and 60 minutes."))

    @api.constrains("start_hour", "end_hour", "shift_type")
    def _check_hours(self):
        for record in self:
            if not 0 <= record.start_hour < 24 or not 0 <= record.end_hour < 24:
                raise ValidationError(_("Shift start and end time must fall within a 24-hour day."))
            if record.start_hour == record.end_hour:
                raise ValidationError(_("Shift start and end time cannot be the same."))
            if record.end_hour < record.start_hour and record.shift_type != "night":
                raise ValidationError(_("Only a Night shift may end on the following day."))

    @api.model
    def _assert_shift_manager(self):
        if not (self.env.user.has_group("hr_time_management.group_time_management_manager") or
                self.env.user.has_group("base.group_system")):
            raise AccessError(_("Only a Time Management manager can configure shifts."))

    @api.model
    def _hour_label(self, value):
        minutes = round((value or 0) * 60)
        hour, minute = divmod(minutes, 60)
        suffix = "PM" if hour >= 12 else "AM"
        return "%s:%02d %s" % (hour % 12 or 12, minute, suffix)

    @api.model
    def get_shift_management_data(self):
        company = self.env.company
        shifts = self.search([("company_id", "=", company.id)], order="active desc, name")
        assignments = self.env["cleon.hr.shift.assignment"].search([
            ("company_id", "=", company.id),
        ], order="date_from desc, id desc")
        today = fields.Date.context_today(self)
        effective = assignments.filtered(lambda row: row.date_from <= today and (not row.date_to or row.date_to >= today))
        employee_ids = set(effective.mapped("employee_id").ids)
        for row in effective.filtered("department_id"):
            employee_ids.update(self.env["hr.employee"].search([
                ("company_id", "=", company.id), ("department_id", "=", row.department_id.id), ("active", "=", True),
            ]).ids)
        total_employees = self.env["hr.employee"].search_count([("company_id", "=", company.id), ("active", "=", True)])
        serialize_shift = lambda shift: {
            "id": shift.id, "name": shift.name, "code": shift.code, "active": shift.active,
            "start_hour": shift.start_hour, "end_hour": shift.end_hour,
            "start": self._hour_label(shift.start_hour), "end": self._hour_label(shift.end_hour),
            "break_minutes": shift.break_minutes, "grace_minutes": shift.grace_minutes,
            "shift_type": shift.shift_type, "recurrence": shift.recurrence,
            "active_days": [int(day) for day in (shift.active_days or "").split(",") if day.isdigit()],
            "assigned": len(set(assignments.filtered(lambda row: row.shift_id == shift).mapped("employee_id").ids)),
        }
        return {
            "shifts": [serialize_shift(shift) for shift in shifts],
            "assignments": [{
                "id": row.id, "shift_id": row.shift_id.id, "shift": row.shift_id.name,
                "employee_id": row.employee_id.id, "employee": row.employee_id.name or row.department_id.name,
                "employee_code": row.employee_id.identification_id or "", "department": row.employee_id.department_id.name or row.department_id.name or "—",
                "date_from": fields.Date.to_string(row.date_from), "date_to": fields.Date.to_string(row.date_to) if row.date_to else False,
                "assignment_type": row.assignment_type, "note": row.note or "",
                "time": "%s - %s" % (self._hour_label(row.shift_id.start_hour), self._hour_label(row.shift_id.end_hour)),
            } for row in assignments],
            "employees": self.env["hr.employee"].search_read(
                [("company_id", "=", company.id), ("active", "=", True)], ["name", "identification_id", "department_id"], order="name"
            ),
            "departments": self.env["hr.department"].search_read([], ["name"], order="name"),
            "kpis": {
                "total_shifts": len(shifts), "active_employees": len(employee_ids),
                "coverage_rate": round(len(employee_ids) * 100 / total_employees) if total_employees else 0,
                "pending_swaps": 0,
            },
        }

    @api.model
    def save_shift(self, values):
        self._assert_shift_manager()
        values = dict(values)
        shift_id = values.pop("id", False)
        days = values.pop("active_days", [0, 1, 2, 3, 4])
        allowed = {"name", "code", "active", "start_hour", "end_hour", "break_minutes", "grace_minutes", "recurrence", "shift_type"}
        vals = {key: values[key] for key in allowed if key in values}
        vals["active_days"] = ",".join(str(int(day)) for day in days)
        vals["company_id"] = self.env.company.id
        vals["code"] = (vals.get("code") or vals.get("name") or "SHIFT").strip().upper().replace(" ", "-")[:30]
        if shift_id:
            shift = self.search([("id", "=", int(shift_id)), ("company_id", "=", self.env.company.id)])
            if not shift:
                raise ValidationError(_("The shift no longer exists."))
            before = {key: shift[key] for key in vals if key in shift._fields}
            shift.write(vals)
            action, reason = "modified", _("Shift updated: %s") % shift.name
        else:
            shift = self.create(vals)
            before = {}
            action, reason = "created", _("Shift created: %s") % shift.name
        self.env["cleon.time.audit.log"].sudo().create({
            "user_id": self.env.user.id, "action": action, "reason": reason,
            "before_values": before, "after_values": vals, "company_id": self.env.company.id,
        })
        return shift.id


class CleonHrShiftAssignment(models.Model):
    _name = "cleon.hr.shift.assignment"
    _description = "CleonHR Dated Shift Assignment"
    _order = "date_from desc, id desc"

    shift_id = fields.Many2one("cleon.hr.shift", required=True, ondelete="cascade", index=True)
    employee_id = fields.Many2one("hr.employee", index=True)
    department_id = fields.Many2one("hr.department", index=True)
    date_from = fields.Date(required=True, default=fields.Date.context_today, index=True)
    date_to = fields.Date(index=True)
    assignment_type = fields.Selection([
        ("standard", "Standard"), ("temporary", "Temporary Override"),
    ], default="standard", required=True)
    note = fields.Text()
    company_id = fields.Many2one(related="shift_id.company_id", store=True, index=True)

    @api.constrains("employee_id", "department_id")
    def _check_scope(self):
        if any(bool(record.employee_id) == bool(record.department_id) for record in self):
            raise ValidationError(_("Assign a shift to either one employee or one department."))

    @api.constrains("date_from", "date_to")
    def _check_dates(self):
        if any(record.date_to and record.date_to < record.date_from for record in self):
            raise ValidationError(_("Shift assignment end date cannot be before its start date."))

    @api.constrains("employee_id", "department_id", "date_from", "date_to")
    def _check_overlap(self):
        for record in self:
            domain = [("id", "!=", record.id), ("company_id", "=", record.company_id.id),
                      ("date_from", "<=", record.date_to or fields.Date.to_date("9999-12-31")),
                      "|", ("date_to", "=", False), ("date_to", ">=", record.date_from)]
            domain.append(("employee_id", "=", record.employee_id.id)) if record.employee_id else domain.append(("department_id", "=", record.department_id.id))
            if self.search_count(domain):
                raise ValidationError(_("This employee or department already has an overlapping shift assignment."))

    @api.model
    def create_shift_assignment(self, values):
        self.env["cleon.hr.shift"]._assert_shift_manager()
        vals = {
            "shift_id": int(values["shift_id"]),
            "employee_id": int(values["employee_id"]) if values.get("employee_id") else False,
            "department_id": int(values["department_id"]) if values.get("department_id") else False,
            "date_from": values.get("date_from"), "date_to": values.get("date_to") or False,
            "assignment_type": "temporary" if values.get("date_to") else "standard",
            "note": values.get("note") or "",
        }
        assignment = self.create(vals)
        if assignment.employee_id:
            assignment.shift_id.employee_ids = [(4, assignment.employee_id.id)]
        self.env["cleon.time.audit.log"].sudo().create({
            "employee_id": assignment.employee_id.id, "user_id": self.env.user.id,
            "action": "created", "reason": _("Shift assigned: %s") % assignment.shift_id.name,
            "after_values": {"shift": assignment.shift_id.name, "date_from": values.get("date_from"), "date_to": values.get("date_to")},
            "company_id": assignment.company_id.id,
        })
        return assignment.id
