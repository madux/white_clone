# -*- coding: utf-8 -*-
from datetime import datetime, time, timedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class ResourceCalendarLeavesOfficialHoliday(models.Model):
    _inherit = "resource.calendar.leaves"

    cleon_official_holiday_id = fields.Many2one("hr.leave.official.holiday", ondelete="cascade", index=True)


class HrLeaveOfficialHoliday(models.Model):
    _name = "hr.leave.official.holiday"
    _description = "Official Holiday"
    _order = "date_from, name"

    name = fields.Char(required=True)
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)
    holiday_type = fields.Selection([
        ("public", "Public Holiday"), ("religious", "Religious Holiday"),
        ("regional", "Regional Holiday"), ("observance", "Observance"),
    ], required=True, default="public")
    date_from = fields.Date(required=True, index=True)
    date_to = fields.Date(required=True, index=True)
    applies_to = fields.Selection([("all", "All Employees"), ("locations", "Specific Locations")], default="all", required=True)
    location_ids = fields.Many2many("hr.work.location", string="Locations")
    repeats = fields.Selection([("once", "One-off"), ("annually", "Annually")], default="once", required=True)
    country_id = fields.Many2one("res.country", string="Country", index=True)
    state_id = fields.Many2one("res.country.state", string="Region / State", index=True,
                               domain="[('country_id', '=', country_id)]")
    # Kept for backwards compatibility with holidays created before the
    # country/state selectors were introduced.
    country_region = fields.Char()
    description = fields.Char(size=255)
    active = fields.Boolean(default=True)
    calendar_leave_ids = fields.One2many("resource.calendar.leaves", "cleon_official_holiday_id", readonly=True)

    @api.constrains("date_from", "date_to", "applies_to", "location_ids", "description")
    def _check_values(self):
        for record in self:
            if record.date_to < record.date_from:
                raise ValidationError(_("Holiday end date cannot precede its start date."))
            if record.applies_to == "locations" and not record.location_ids:
                raise ValidationError(_("Select at least one location."))
            if len(record.description or "") > 255:
                raise ValidationError(_("Description cannot exceed 255 characters."))

    def _check_configure(self):
        if not self.env.user.has_group("hr_leave_dashboard.group_leave_permission_configuration"):
            raise AccessError(_("You do not have permission to manage official holidays."))

    def _sync_calendar_leaves(self):
        for holiday in self:
            holiday.calendar_leave_ids.sudo().unlink()
            if not holiday.active:
                continue
            calendars = self.env["resource.calendar"].sudo().search([("company_id", "=", holiday.company_id.id)])
            if holiday.applies_to == "locations":
                employee_calendars = self.env["hr.employee"].sudo().search([
                    ("company_id", "=", holiday.company_id.id), ("work_location_id", "in", holiday.location_ids.ids),
                ]).mapped("resource_calendar_id")
                calendars &= employee_calendars
            occurrences = [(holiday.date_from, holiday.date_to)]
            if holiday.repeats == "annually":
                current_year = fields.Date.context_today(holiday).year
                occurrences = []
                for year in range(current_year - 1, current_year + 6):
                    try:
                        start = holiday.date_from.replace(year=year)
                        end = start + (holiday.date_to - holiday.date_from)
                    except ValueError:
                        continue
                    occurrences.append((start, end))
            values = []
            for start, end in occurrences:
                for calendar in calendars:
                    values.append({"name": holiday.name, "company_id": holiday.company_id.id,
                        "calendar_id": calendar.id, "resource_id": False,
                        "date_from": datetime.combine(start, time.min),
                        "date_to": datetime.combine(end + timedelta(days=1), time.min),
                        "cleon_official_holiday_id": holiday.id})
            if values:
                self.env["resource.calendar.leaves"].sudo().create(values)

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        records._sync_calendar_leaves()
        return records

    def write(self, vals):
        result = super().write(vals)
        if {"name", "date_from", "date_to", "applies_to", "location_ids", "repeats", "active"}.intersection(vals):
            self._sync_calendar_leaves()
        return result

    @api.model
    def get_holiday_page_data(self):
        self._check_configure()
        records = self.with_context(active_test=False).search([("company_id", "in", self.env.companies.ids)])
        countries = self.env["res.country"].sudo().search([], order="name")
        states = self.env["res.country.state"].sudo().search([], order="country_id, name")
        return {"rows": [{"id": r.id, "name": r.name, "type": r.holiday_type, "date_from": fields.Date.to_string(r.date_from),
            "date_to": fields.Date.to_string(r.date_to), "applies_to": r.applies_to, "location_ids": r.location_ids.ids,
            "locations": ", ".join(r.location_ids.mapped("name")) or _("All Employees"), "repeats": r.repeats,
            "country_region": r.state_id.name or r.country_id.name or r.country_region or "",
            "country_id": r.country_id.id or False, "state_id": r.state_id.id or False,
            "description": r.description or "", "active": r.active,
            "created_by": r.create_uid.name, "last_updated": fields.Datetime.to_string(r.write_date)} for r in records],
            "locations": [{"id": item.id, "name": item.name} for item in self.env["hr.work.location"].search([], order="name")],
            "countries": [{"id": item.id, "name": item.name} for item in countries],
            "states": [{"id": item.id, "name": item.name, "country_id": item.country_id.id} for item in states]}

    @api.model
    def save_holiday(self, values):
        self._check_configure()
        record = self.with_context(active_test=False).browse(int(values.get("id") or 0)).exists()
        date_from = values.get("date_from")
        date_to = values.get("date_to") or date_from
        country = self.env["res.country"].sudo().browse(int(values.get("country_id") or 0)).exists()
        state = self.env["res.country.state"].sudo().browse(int(values.get("state_id") or 0)).exists()
        if state and country and state.country_id != country:
            raise ValidationError(_("The selected region does not belong to the selected country."))
        vals = {"name": (values.get("name") or "").strip(), "holiday_type": values.get("type", "public"),
            "date_from": date_from, "date_to": date_to, "applies_to": values.get("applies_to", "all"),
            "location_ids": [(6, 0, [int(item) for item in values.get("location_ids", [])])],
            "repeats": values.get("repeats", "once"), "country_id": country.id or False,
            "state_id": state.id or False, "country_region": values.get("country_region") or "",
            "description": values.get("description") or "", "active": values.get("active", True) in (True, "true", 1, "1"), "company_id": self.env.company.id}
        if not vals["name"]:
            raise ValidationError(_("Holiday Name is required."))
        if record:
            record.write(vals)
        else:
            record = self.create(vals)
        self.env["hr.leave.audit.log"].sudo().create({"action": "calendar_change", "module_area": "calendar", "entity_type": "holiday", "entity_name": record.name,
            "actor_id": self.env.user.id, "actor_label": self.env.user.name, "note": _("Saved official holiday %s.") % record.name})
        return {"id": record.id}

    @api.model
    def duplicate_holiday(self, record_id):
        self._check_configure()
        record = self.browse(int(record_id)).exists()
        duplicate = record.copy({"name": _("%s (Copy)") % record.name, "active": False})
        self.env["hr.leave.audit.log"].sudo().create({
            "action": "calendar_change", "module_area": "calendar", "entity_type": "holiday",
            "entity_name": duplicate.name, "actor_id": self.env.user.id, "actor_label": self.env.user.name,
            "note": _("Duplicated official holiday %s.") % record.name,
        })
        return {"id": duplicate.id}

    @api.model
    def set_holiday_active(self, record_id, active):
        self._check_configure()
        record = self.with_context(active_test=False).browse(int(record_id)).exists()
        record.write({"active": bool(active)})
        self.env["hr.leave.audit.log"].sudo().create({
            "action": "calendar_change", "module_area": "calendar", "entity_type": "holiday",
            "entity_name": record.name, "actor_id": self.env.user.id, "actor_label": self.env.user.name,
            "note": _("%s official holiday %s.") % (_("Activated") if active else _("Deactivated"), record.name),
        })
        return True

    @api.model
    def delete_holiday(self, record_id):
        self._check_configure()
        record = self.with_context(active_test=False).browse(int(record_id)).exists()
        now = fields.Datetime.now()
        historical_occurrences = record.calendar_leave_ids.filtered(lambda occurrence: occurrence.date_to <= now)
        if historical_occurrences:
            raise ValidationError(_(
                "This holiday has historical calendar occurrences and cannot be deleted. "
                "Deactivate it instead to preserve its history."
            ))
        name = record.name
        record.unlink()
        self.env["hr.leave.audit.log"].sudo().create({
            "action": "calendar_change", "module_area": "calendar", "entity_type": "holiday",
            "entity_name": name, "actor_id": self.env.user.id, "actor_label": self.env.user.name,
            "note": _("Deleted official holiday %s.") % name,
        })
        return True


class HrLeaveTypeApprovalStage(models.Model):
    _name = "hr.leave.type.approval.stage"
    _description = "Leave Type Approval Stage"
    _order = "sequence, id"

    leave_type_id = fields.Many2one(
        "hr.leave.type", required=True, ondelete="cascade", index=True,
    )
    sequence = fields.Integer(required=True, default=10)
    approver_type = fields.Selection([
        ("direct_manager", "Direct Manager"),
        ("department_head", "Department Head"),
        ("hr_manager", "HR Manager"),
        ("hr_director", "HR Director"),
        ("finance_director", "Finance Director"),
        ("ceo", "CEO / Managing Director"),
    ], required=True, default="direct_manager")
    escalation_value = fields.Integer(string="Escalate After", default=2)
    escalation_unit = fields.Selection(
        [("hours", "Hours"), ("days", "Days")], required=True, default="days",
    )

    @api.constrains("escalation_value")
    def _check_escalation_value(self):
        if any(stage.escalation_value < 0 for stage in self):
            raise ValidationError(_("Escalation time cannot be negative."))

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        records.mapped("leave_type_id")._sync_cleon_approval_chain()
        return records

    def write(self, vals):
        res = super().write(vals)
        self.mapped("leave_type_id")._sync_cleon_approval_chain()
        return res

    def unlink(self):
        leave_types = self.mapped("leave_type_id")
        res = super().unlink()
        leave_types._sync_cleon_approval_chain()
        return res


class HrLeaveApprovalLine(models.Model):
    _name = "hr.leave.approval.line"
    _description = "Leave Request Approval Timeline"
    _order = "sequence, id"

    leave_id = fields.Many2one("hr.leave", required=True, ondelete="cascade", index=True)
    sequence = fields.Integer(required=True, default=10)
    level = fields.Integer(required=True, default=1)
    approver_type = fields.Selection(
        related="stage_id.approver_type", store=True, readonly=True,
    )
    stage_id = fields.Many2one(
        "hr.leave.type.approval.stage", required=True, ondelete="restrict",
    )
    approver_id = fields.Many2one("res.users", readonly=True)
    status = fields.Selection([
        ("waiting", "Waiting"),
        ("pending", "Pending"),
        ("approved", "Approved"),
        ("rejected", "Rejected"),
        ("skipped", "Skipped"),
    ], required=True, default="waiting", readonly=True, index=True)
    deadline = fields.Datetime(readonly=True)
    actioned_at = fields.Datetime(readonly=True)
    actioned_by_id = fields.Many2one("res.users", readonly=True)
    comments = fields.Text(readonly=True)
    escalated = fields.Boolean(readonly=True, copy=False)
    escalated_at = fields.Datetime(readonly=True, copy=False)

    def _deadline_from_stage(self, start=None):
        self.ensure_one()
        start = start or fields.Datetime.now()
        value = max(self.stage_id.escalation_value, 0)
        delta = timedelta(hours=value) if self.stage_id.escalation_unit == "hours" else timedelta(days=value)
        return start + delta if value else False


class HrLeaveBlackoutPeriod(models.Model):
    _name = "hr.leave.blackout.period"
    _description = "Leave Request Blackout Period"
    _order = "date_from, id"

    name = fields.Char(required=True)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company,
        ondelete="cascade", index=True,
    )
    date_from = fields.Date(required=True, index=True)
    date_to = fields.Date(required=True, index=True)
    leave_type_ids = fields.Many2many("hr.leave.type", string="Leave Types")
    department_ids = fields.Many2many("hr.department", string="Departments")
    policy_ids = fields.Many2many("hr.leave.policy", string="Leave Policies")
    group_ids = fields.Many2many("hr.leave.allocation.group", string="Custom Groups")
    applies_to = fields.Selection([
        ("all", "All Employees"), ("departments", "Specific Departments"),
        ("policies", "Specific Leave Policies"), ("groups", "Specific Groups"),
    ], default="all", required=True)
    state = fields.Selection([("draft", "Draft"), ("scheduled", "Scheduled"), ("active", "Active")], default="draft", required=True, index=True)
    active = fields.Boolean(default=True)
    reason = fields.Text()
    exception_mode = fields.Selection([
        ("hard_block", "No Exceptions"), ("approval", "Exception Approval Permitted"),
    ], default="hard_block", required=True)
    exception_chain_id = fields.Many2one("cleon.approval.chain", ondelete="restrict", check_company=True,
        string="Exception Approval Flow")

    @api.constrains("date_from", "date_to")
    def _check_dates(self):
        for period in self:
            if period.date_to < period.date_from:
                raise ValidationError(_("A blackout period must end on or after its start date."))

    @api.constrains("applies_to", "department_ids", "policy_ids", "group_ids", "exception_mode", "exception_chain_id")
    def _check_audience(self):
        for record in self:
            if record.applies_to == "departments" and not record.department_ids:
                raise ValidationError(_("Select at least one department."))
            if record.applies_to == "policies" and not record.policy_ids:
                raise ValidationError(_("Select at least one Leave Policy."))
            if record.applies_to == "groups" and not record.group_ids:
                raise ValidationError(_("Select at least one custom group."))
            if record.exception_mode == "approval" and not record.exception_chain_id:
                raise ValidationError(_("Select an Approval Flow for blackout exceptions."))

    @api.model_create_multi
    def create(self, vals_list):
        return super().create(vals_list)

    def write(self, vals):
        return super().write(vals)

    def _check_configure(self):
        if not self.env.user.has_group("hr_leave_dashboard.group_leave_permission_configuration"):
            raise AccessError(_("You do not have permission to manage blackout windows."))

    @api.model
    def _cron_activate_scheduled(self):
        """Promote approved windows when their effective date is reached."""
        today = fields.Date.context_today(self)
        windows = self.sudo().with_context(active_test=False).search([("state", "=", "scheduled"), ("date_from", "<=", today)])
        if windows:
            windows.write({"state": "active"})
            for window in windows:
                self.env["hr.leave.audit.log"].sudo().create({
                    "action": "policy_change", "module_area": "policies", "entity_type": "blackout",
                    "entity_name": window.name, "actor_id": self.env.user.id, "actor_label": self.env.user.name,
                    "note": _("Scheduled blackout window %s became active on %s.") % (window.name, today),
                })
        return len(windows)

    @api.model
    def get_blackout_page_data(self):
        self._check_configure()
        rows = self.with_context(active_test=False).search([("company_id", "in", self.env.companies.ids)], order="date_from, name")
        return {"rows": [{"id": r.id, "name": r.name, "date_from": fields.Date.to_string(r.date_from), "date_to": fields.Date.to_string(r.date_to),
            "duration": (r.date_to - r.date_from).days + 1, "applies_to": r.applies_to, "department_ids": r.department_ids.ids,
            "departments": ", ".join(r.department_ids.mapped("name")) or _("All Employees"), "reason": r.reason or "", "state": r.state,
            "policy_ids": r.policy_ids.ids, "group_ids": r.group_ids.ids, "exception_mode": r.exception_mode,
            "exception_chain_id": r.exception_chain_id.id or False,
            "created_by": r.create_uid.name, "last_updated": fields.Datetime.to_string(r.write_date)} for r in rows],
            "departments": [{"id": d.id, "name": d.name} for d in self.env["hr.department"].search([("company_id", "in", self.env.companies.ids)], order="name")],
            "policies": [{"id": p.id, "name": p.name} for p in self.env["hr.leave.policy"].search([("company_id", "in", self.env.companies.ids)], order="name")],
            "groups": [{"id": g.id, "name": g.name} for g in self.env["hr.leave.allocation.group"].search([("company_id", "in", self.env.companies.ids), ("active", "=", True)], order="name")],
            "chains": [{"id": c.id, "name": c.name} for c in self.env["cleon.approval.chain"].search([("company_id", "in", self.env.companies.ids), ("active", "=", True)], order="name")]}

    @api.model
    def save_blackout(self, values):
        self._check_configure()
        record = self.with_context(active_test=False).browse(int(values.get("id") or 0)).exists()
        vals = {"name": (values.get("name") or "").strip(), "date_from": values.get("date_from"), "date_to": values.get("date_to"),
            "applies_to": values.get("applies_to", "all"), "department_ids": [(6, 0, [int(item) for item in values.get("department_ids", [])])],
            "policy_ids": [(6, 0, [int(item) for item in values.get("policy_ids", [])])],
            "group_ids": [(6, 0, [int(item) for item in values.get("group_ids", [])])],
            "exception_mode": values.get("exception_mode", "hard_block"),
            "exception_chain_id": int(values.get("exception_chain_id") or 0) or False,
            "reason": (values.get("reason") or "")[:255], "state": values.get("state", "draft"), "company_id": self.env.company.id}
        if not vals["name"]:
            raise ValidationError(_("Window Name is required."))
        if record: record.write(vals)
        else: record = self.create(vals)
        self.env["hr.leave.audit.log"].sudo().create({"action": "policy_change", "module_area": "policies", "entity_type": "blackout", "entity_name": record.name,
            "actor_id": self.env.user.id, "actor_label": self.env.user.name, "note": _("Saved blackout window %s with status %s.") % (record.name, record.state)})
        return {"id": record.id}

    @api.model
    def import_blackouts(self, rows):
        """Create blackout windows from normalized CSV rows.

        The client parses CSV syntax; this endpoint owns validation and
        relation resolution so imports cannot bypass the same audience/date
        constraints as the drawer form. Invalid rows are reported separately
        while valid rows are committed.
        """
        self._check_configure()
        if not isinstance(rows, list) or not rows:
            raise ValidationError(_("The import contains no blackout rows."))
        company = self.env.company
        errors, imported_ids = [], []

        def relation_ids(model_name, value, label):
            tokens = [token.strip() for token in str(value or "").split(";") if token.strip()]
            if not tokens:
                return []
            model = self.env[model_name].sudo()
            found = model.browse()
            for token in tokens:
                record = model.browse(int(token)).exists() if token.isdigit() else model.search([
                    ("name", "=ilike", token), ("company_id", "in", [False, company.id]),
                ], limit=1)
                if not record:
                    raise ValidationError(_("Unknown %s '%s'.") % (label, token))
                found |= record
            return found.ids

        for row_number, raw in enumerate(rows, start=2):
            row = {str(key).strip().lower(): value for key, value in (raw or {}).items()}
            try:
                name = (row.get("name") or row.get("window_name") or "").strip()
                date_from = (row.get("date_from") or row.get("start_date") or "").strip()
                date_to = (row.get("date_to") or row.get("end_date") or date_from).strip()
                if not name or not date_from:
                    raise ValidationError(_("name and date_from are required."))
                # Fail early with a clear row-level error rather than relying
                # on a database cast exception for malformed dates.
                fields.Date.to_date(date_from)
                fields.Date.to_date(date_to)
                applies_to = (row.get("applies_to") or row.get("scope") or "all").strip().lower().replace(" ", "_")
                applies_to = {"company_wide": "all", "all_employees": "all", "department_based": "departments", "policy_based": "policies", "group_based": "groups"}.get(applies_to, applies_to)
                if applies_to not in ("all", "departments", "policies", "groups"):
                    raise ValidationError(_("applies_to must be all, departments, policies, or groups."))
                state = (row.get("state") or "draft").strip().lower()
                if state not in ("draft", "scheduled", "active"):
                    raise ValidationError(_("state must be draft, scheduled, or active."))
                exception_mode = (row.get("exception_mode") or "hard_block").strip().lower()
                if exception_mode not in ("hard_block", "approval"):
                    raise ValidationError(_("exception_mode must be hard_block or approval."))
                values = {
                    "name": name, "date_from": date_from, "date_to": date_to,
                    "applies_to": applies_to, "state": state,
                    "department_ids": [(6, 0, relation_ids("hr.department", row.get("department_ids") or row.get("departments"), "department"))],
                    "policy_ids": [(6, 0, relation_ids("hr.leave.policy", row.get("policy_ids") or row.get("policies"), "leave policy"))],
                    "group_ids": [(6, 0, relation_ids("hr.leave.allocation.group", row.get("group_ids") or row.get("groups"), "custom group"))],
                    "exception_mode": exception_mode,
                    "exception_chain_id": int(row.get("exception_chain_id") or 0) or False,
                    "reason": (row.get("reason") or "")[:255],
                    "company_id": company.id,
                }
                if row.get("exception_chain") and not values["exception_chain_id"]:
                    chain = self.env["cleon.approval.chain"].sudo().search([
                        ("name", "=ilike", row["exception_chain"]), ("company_id", "in", [False, company.id]),
                    ], limit=1)
                    if not chain:
                        raise ValidationError(_("Unknown approval flow '%s'.") % row["exception_chain"])
                    values["exception_chain_id"] = chain.id
                # Keep a malformed row from aborting the whole import
                # transaction; valid rows can still be committed and the
                # caller receives the rejected row numbers.
                with self.env.cr.savepoint():
                    record = self.create(values)
                imported_ids.append(record.id)
            except Exception as error:
                errors.append({"row": row_number, "reason": str(error)})
        return {"imported": len(imported_ids), "ids": imported_ids, "errors": errors}

    @api.model
    def duplicate_blackout(self, record_id):
        self._check_configure(); record = self.with_context(active_test=False).browse(int(record_id)).exists(); duplicate = record.copy({"name": _("%s (Copy)") % record.name, "state": "draft", "active": True}); return {"id": duplicate.id}

    @api.model
    def set_blackout_state(self, record_id, state):
        self._check_configure()
        if state not in ("draft", "scheduled", "active"): raise ValidationError(_("Invalid blackout status."))
        self.with_context(active_test=False).browse(int(record_id)).write({"state": state}); return True

    @api.model
    def delete_blackout(self, record_id):
        self._check_configure(); self.with_context(active_test=False).browse(int(record_id)).unlink(); return True


class HrLeaveAccrualRun(models.Model):
    _name = "hr.leave.accrual.run"
    _description = "Processed Leave Accrual Period"
    _order = "effective_date desc, id desc"

    employee_id = fields.Many2one("hr.employee", required=True, ondelete="restrict", index=True)
    leave_type_id = fields.Many2one("hr.leave.type", required=True, ondelete="restrict", index=True)
    period_key = fields.Char(required=True, index=True)
    effective_date = fields.Date(required=True, index=True)
    amount = fields.Float(required=True)
    allocation_id = fields.Many2one("hr.leave.allocation", ondelete="restrict")
    reason = fields.Char(required=True)

    _sql_constraints = [(
        "employee_type_period_unique",
        "unique(employee_id, leave_type_id, period_key)",
        "This employee's leave accrual has already been processed for the period.",
    )]


class HrLeaveApprovalTemplate(models.Model):
    """Reusable blueprint, deliberately distinct from a runtime workflow.

    The linked chain owns the executable approval levels.  The template owns
    reuse/availability, so one blueprint can be offered globally or only to a
    controlled set of policies without conflating it with approval instances.
    """
    _name = "hr.leave.approval.template"
    _description = "Leave Approval Template"
    _order = "name, id"

    name = fields.Char(required=True, index=True)
    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True)
    description = fields.Text()
    template_type = fields.Selection([
        ("global", "Global Template"), ("assigned", "Assigned to Policies"),
    ], required=True, default="global", index=True)
    policy_ids = fields.Many2many("hr.leave.policy", string="Assigned Policies")
    chain_id = fields.Many2one("cleon.approval.chain", required=True, ondelete="restrict", check_company=True,
        string="Approval Flow")
    active = fields.Boolean(default=True, index=True)
    level_count = fields.Integer(compute="_compute_level_count", string="Levels")

    @api.depends("chain_id.step_ids")
    def _compute_level_count(self):
        for template in self:
            template.level_count = len(template.chain_id.step_ids)

    @api.constrains("template_type", "policy_ids", "chain_id", "company_id")
    def _check_template(self):
        for template in self:
            if template.template_type == "assigned" and not template.policy_ids:
                raise ValidationError(_("Assign at least one Leave Policy to an Assigned template."))
            if template.chain_id.company_id != template.company_id:
                raise ValidationError(_("The template and Approval Flow must belong to the same company."))

    def action_duplicate_template(self):
        self.ensure_one()
        return self.copy({"name": _("%s (Copy)") % self.name, "active": False}).id

    @api.model
    def get_approval_templates_page(self, search="", status="all", applies_to="all", page=1, page_size=10):
        """Small, server-side list API for Leave Configuration's approval table."""
        page, page_size = max(int(page or 1), 1), min(max(int(page_size or 10), 1), 100)
        domain = [("company_id", "in", self.env.companies.ids)]
        if search:
            domain += ["|", ("name", "ilike", search), ("description", "ilike", search)]
        if status in ("active", "inactive"):
            domain.append(("active", "=", status == "active"))
        if applies_to in ("all", "departments", "teams", "employees") and applies_to != "all":
            domain.append(("chain_id.applies_to", "=", applies_to))
        total = self.search_count(domain)
        templates = self.search(domain, order="name, id", limit=page_size, offset=(page - 1) * page_size)
        approver_labels = {
            "line_manager": _("Manager"), "managers_manager": _("Manager's Manager"),
            "department_head": _("Department Head"), "job": _("Position"),
            "group": _("Role"), "specific_user": _("Named approver"),
            "specific_users": _("Named approvers"), "target_resolver": _("Dynamic resolver"),
        }
        scope_labels = {"all": _("All Employees"), "departments": _("Department Based"),
                        "teams": _("Project Teams"), "employees": _("Selected Employees")}
        rows = []
        for template in templates:
            chain = template.chain_id
            steps = chain.step_ids.sorted("sequence")
            labels = [approver_labels.get(step.approver_type, step.approver_type) for step in steps]
            compact = labels[:2]
            rows.append({
                "id": template.id, "name": template.name, "description": template.description or "",
                "levels": len(steps), "approvers": compact, "additional_approvers": max(len(labels) - len(compact), 0),
                "backups": len(chain.backup_approver_ids), "escalation_days": chain.escalation_days or False,
                "auto_approve_days": chain.auto_approve_days or False, "applies_to": chain.applies_to,
                "applies_to_label": scope_labels.get(chain.applies_to, chain.applies_to),
                "coverage_count": len(chain._covered_employees()), "active": template.active,
                "updated": fields.Datetime.to_string(template.write_date), "created_by": template.create_uid.name,
                "chain_code": chain.code or "", "chain_id": chain.id,
            })
        return {"rows": rows, "page": page, "page_size": page_size, "total": total,
                "pages": max((total + page_size - 1) // page_size, 1)}

    def unlink(self):
        if any(template.policy_ids or self.env["hr.leave.policy"].sudo().search_count([
            ("approval_template_id", "=", template.id),
        ]) for template in self):
            raise ValidationError(_("A referenced approval template cannot be deleted; deactivate it instead."))
        return super().unlink()


class CleonApprovalChainLeaveSettings(models.Model):
    _inherit = "cleon.approval.chain"

    description = fields.Text()
    applies_to = fields.Selection([
        ("all", "All Employees"), ("departments", "Department Based"),
        ("teams", "Project Teams"), ("employees", "Selected Employees"),
    ], default="all", required=True)
    department_ids = fields.Many2many("hr.department", string="Covered Departments")
    employee_ids = fields.Many2many("hr.employee", string="Covered Employees")
    backup_approver_ids = fields.Many2many("res.users", string="Backup Approvers")
    escalation_days = fields.Integer(default=0)
    auto_approve_days = fields.Integer(default=0)

    @api.constrains("escalation_days", "auto_approve_days", "applies_to", "department_ids", "employee_ids")
    def _check_leave_workflow_settings(self):
        for chain in self:
            if min(chain.escalation_days, chain.auto_approve_days) < 0:
                raise ValidationError(_("Approval timers cannot be negative."))
            if chain.escalation_days and chain.auto_approve_days and chain.auto_approve_days <= chain.escalation_days:
                raise ValidationError(_("Auto Approve (Days) must be longer than Escalation Days."))
            if chain.applies_to == "departments" and not chain.department_ids:
                raise ValidationError(_("Select at least one covered department."))
            if chain.applies_to == "employees" and not chain.employee_ids:
                raise ValidationError(_("Select at least one covered employee."))

    def _covered_employees(self):
        self.ensure_one()
        employees = self.env["hr.employee"].sudo().search([("company_id", "=", self.company_id.id), ("active", "=", True)])
        if self.applies_to == "departments": return employees.filtered(lambda e: e.department_id in self.department_ids)
        if self.applies_to == "employees": return self.employee_ids.filtered("active")
        return employees

    def action_duplicate_leave_workflow(self):
        return self.action_duplicate_workflow()


class CleonApprovalInstanceLeaveTimers(models.Model):
    _inherit = "cleon.approval.instance"

    @api.model
    def _cron_process_approval_escalations(self):
        result = super()._cron_process_approval_escalations()
        now = fields.Datetime.now()
        instances = self.sudo().search([("state", "=", "pending"), ("source_chain_id.auto_approve_days", ">", 0)])
        for instance in instances:
            threshold = instance.create_date + timedelta(days=instance.source_chain_id.auto_approve_days)
            if threshold <= now:
                instance.action_decide("approve", comment=_("Auto-approved after the workflow's configured %d-day threshold.") % instance.source_chain_id.auto_approve_days, automated=True)
        return result
