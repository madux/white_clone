# -*- coding: utf-8 -*-
import base64
import csv
import io
from collections import defaultdict
from datetime import datetime, time, timedelta
from pytz import UTC

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class ResCompanyLeaveAnalytics(models.Model):
    _inherit = "res.company"

    leave_bradford_enabled = fields.Boolean(default=True)
    leave_bradford_window_weeks = fields.Integer(default=52)
    leave_bradford_min_spell_days = fields.Integer(default=1)
    leave_bradford_caution = fields.Integer(default=51)
    leave_bradford_concern = fields.Integer(default=101)
    leave_bradford_serious = fields.Integer(default=201)
    leave_bradford_critical = fields.Integer(default=401)


class HrLeaveTypeAbsenceRisk(models.Model):
    _inherit = "hr.leave.type"

    bradford_count_mode = fields.Selection([
        ("exclude", "Excluded"),
        ("short_notice", "Short-notice absences only"),
        ("all", "All approved absences"),
    ], default="exclude", required=True, string="Bradford Factor Treatment")
    bradford_treatment_configured = fields.Boolean(default=False, copy=False)
    bradford_protected = fields.Boolean(string="Protected parental / long-term leave", default=False)

    @api.model_create_multi
    def create(self, vals_list):
        for values in vals_list:
            if "bradford_count_mode" not in values:
                classification = values.get("policy_classification")
                values["bradford_count_mode"] = "short_notice" if classification == "sick" else "exclude"
            name = values.get("name") or ""
            if isinstance(name, dict):
                name = next(iter(name.values()), "")
            code = values.get("leave_code") or ""
            label = ("%s %s" % (name, code)).lower()
            if any(word in label for word in ("maternity", "paternity", "parental")):
                values.setdefault("bradford_protected", True)
        return super().create(vals_list)

    @api.model
    def _bradford_label(self, name, code=""):
        if isinstance(name, dict):
            name = next(iter(name.values()), "")
        return "%s %s" % (name or "", code or "")

    @api.model
    def _bradford_is_protected(self, label, classification=None):
        if classification in ("annual", "family"):
            return True
        value = (label or "").lower()
        return any(token in value for token in ("annual", "vacation", "maternity", "paternity", "parental"))

    @api.model
    def _bradford_is_sickness(self, label):
        value = (label or "").lower()
        return any(token in value for token in ("sick", "illness", "medical")) and not self._bradford_is_protected(value)

    def _effective_bradford_mode(self):
        self.ensure_one()
        if self.bradford_protected or self.policy_classification == "annual":
            return "exclude"
        if not self.bradford_treatment_configured and self.policy_classification == "sick":
            return "short_notice"
        return self.bradford_count_mode

    def write(self, values):
        if "bradford_count_mode" in values:
            for leave_type in self:
                classification = values.get("policy_classification", leave_type.policy_classification)
                if (values.get("bradford_protected", leave_type.bradford_protected) or classification == "annual") and values["bradford_count_mode"] != "exclude":
                    raise ValidationError(_("Annual and parental Leave Types are always excluded from Bradford scoring."))
            values.setdefault("bradford_treatment_configured", True)
        result = super().write(values)
        if "bradford_count_mode" in values and not self.env.context.get("skip_bradford_refresh"):
            companies = self.mapped("company_id") | self.env.company
            for company in companies.filtered("leave_bradford_enabled"):
                self.env["hr.leave.report.service"].sudo()._refresh_risk_snapshots(company)
        return result


class HrLeaveAbsenceRisk(models.Model):
    _name = "hr.leave.absence.risk"
    _description = "Current Bradford Factor Absence Risk"
    _order = "score desc, employee_id"

    company_id = fields.Many2one("res.company", required=True, index=True, ondelete="cascade")
    employee_id = fields.Many2one("hr.employee", required=True, index=True, ondelete="cascade")
    score = fields.Integer(readonly=True)
    band = fields.Selection([
        ("low", "Low"), ("caution", "Caution"), ("concern", "Concern"),
        ("serious", "Serious"), ("critical", "Critical"),
    ], default="low", required=True, readonly=True, index=True)
    spell_count = fields.Integer(readonly=True)
    day_count = fields.Integer(readonly=True)
    window_start = fields.Date(readonly=True)
    window_end = fields.Date(readonly=True)
    calculated_at = fields.Datetime(readonly=True)

    _sql_constraints = [
        ("employee_company_unique", "unique(employee_id, company_id)", "Only one current absence-risk score is allowed per employee and company."),
    ]

    @api.model
    def _cron_recalculate(self):
        companies = self.env["res.company"].sudo().search([("leave_bradford_enabled", "=", True)])
        for company in companies:
            self.env["hr.leave.report.service"].sudo()._refresh_risk_snapshots(company)
        return True


class HrLeaveReportFields(models.Model):
    _inherit = "hr.leave"

    bradford_excluded = fields.Boolean(readonly=True, copy=False)
    bradford_exclusion_reason = fields.Text(readonly=True, copy=False)

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        records._refresh_changed_absence_risk()
        return records

    def write(self, values):
        monitored = {
            "employee_id", "holiday_status_id", "state", "is_cancelled",
            "request_date_from", "request_date_to", "bradford_excluded",
        }
        employees = self.mapped("employee_id") if monitored.intersection(values) else self.env["hr.employee"]
        result = super().write(values)
        if employees or monitored.intersection(values):
            (employees | self.mapped("employee_id"))._refresh_leave_absence_risk()
        return result

    def _refresh_changed_absence_risk(self):
        self.filtered(lambda leave: leave.state == "validate").mapped("employee_id")._refresh_leave_absence_risk()


class HrEmployeeAbsenceRiskRefresh(models.Model):
    _inherit = "hr.employee"

    def _refresh_leave_absence_risk(self):
        for company in self.mapped("company_id").filtered("leave_bradford_enabled"):
            employees = self.filtered(lambda employee, company=company: employee.company_id == company)
            self.env["hr.leave.report.service"].sudo()._refresh_risk_snapshots(company, employees)
        return True


class HrLeaveReportService(models.AbstractModel):
    _name = "hr.leave.report.service"
    _description = "CleonHR Leave Reports Service"

    REPORT_KEYS = {
        "utilisation", "balances", "request_volume", "turnaround", "trends",
        "frequency", "policy_usage", "absence_risk", "anomalies", "executive_brief",
    }

    @api.model
    def _has_group(self, xmlid):
        return self.env.user.has_group(xmlid)

    @api.model
    def _risk_actor_role(self):
        return _("HR Director") if self._has_group("hr_leave_dashboard.group_role_hr_director") else _("HR Administrator")

    @api.model
    def _access(self):
        operational = self._has_group("hr_leave_dashboard.group_leave_permission_operational_reports")
        strategic = self._has_group("hr_leave_dashboard.group_leave_permission_strategic_reports")
        team = self._has_group("hr_leave_dashboard.group_leave_permission_team")
        if not (operational or strategic or team):
            raise AccessError(_("You do not have Leave reporting access."))

        Employee = self.env["hr.employee"].sudo()
        if operational or strategic:
            employees = Employee.search([
                ("active", "=", True), ("company_id", "=", self.env.company.id),
            ])
            scope = "organisation"
        else:
            employees = Employee.search([
                ("active", "=", True), ("company_id", "=", self.env.company.id),
                "|", ("leave_manager_id", "=", self.env.user.id),
                     ("parent_id.user_id", "=", self.env.user.id),
            ])
            scope = "team"
            if not employees:
                raise AccessError(_("You do not have an assigned reporting team."))

        risk_detail = self._has_group("hr_leave_dashboard.group_leave_administrator") or self._has_group(
            "hr_leave_dashboard.group_role_hr_director"
        )
        risk_configure = risk_detail and (
            self._has_group("hr_leave_dashboard.group_leave_permission_configuration")
            or self._has_group("hr_leave_dashboard.group_role_hr_director")
        )
        return {
            "scope": scope,
            "employees": employees,
            "operational": operational,
            "strategic": strategic,
            "risk_detail": risk_detail,
            "risk_configure": risk_configure,
        }

    @api.model
    def _date_range(self, preset, start_date=None, end_date=None):
        today = fields.Date.context_today(self)
        if preset == "today":
            start = end = today
        elif preset == "this_week":
            start, end = today - timedelta(days=today.weekday()), today + timedelta(days=6 - today.weekday())
        elif preset == "this_month":
            start, end = today.replace(day=1), today + relativedelta(months=1, day=1, days=-1)
        elif preset == "last_month":
            end = today.replace(day=1) - timedelta(days=1)
            start = end.replace(day=1)
        elif preset == "this_quarter":
            start = today.replace(month=((today.month - 1) // 3) * 3 + 1, day=1)
            end = start + relativedelta(months=3, days=-1)
        elif preset == "last_quarter":
            current = today.replace(month=((today.month - 1) // 3) * 3 + 1, day=1)
            end = current - timedelta(days=1)
            start = current - relativedelta(months=3)
        elif preset == "custom":
            if not start_date or not end_date:
                raise ValidationError(_("Select both dates for a custom report range."))
            start, end = fields.Date.to_date(start_date), fields.Date.to_date(end_date)
        else:
            start, end = today.replace(month=1, day=1), today.replace(month=12, day=31)
        if not start or not end or start > end:
            raise ValidationError(_("The report start date must be on or before the end date."))
        return start, end

    @api.model
    def _filter_ids(self, filters, plural, singular=None):
        values = filters.get(plural) or []
        if not values and singular and filters.get(singular):
            values = [filters[singular]]
        if not isinstance(values, (list, tuple)):
            values = [values]
        result = []
        for value in values:
            try:
                value = int(value)
            except (TypeError, ValueError):
                continue
            if value and value not in result:
                result.append(value)
        return result

    @api.model
    def _scope(self, filters):
        access = self._access()
        employees = access["employees"]
        dimensions = {
            "department_ids": "department_id",
            "location_ids": "work_location_id",
            "unit_ids": "unit_id",
            "employee_ids": "id",
        }
        for key, field_name in dimensions.items():
            singular = {"department_ids": "department_id", "location_ids": "location_id", "unit_ids": "unit_id", "employee_ids": "employee_id"}[key]
            selected = set(self._filter_ids(filters, key, singular))
            if selected:
                employees = employees.filtered(lambda employee, field_name=field_name, selected=selected: (
                    employee.id if field_name == "id" else employee[field_name].id
                ) in selected)
        return access, employees

    @api.model
    def _status(self, leave):
        if leave.is_cancelled:
            return "cancelled"
        if leave.changes_requested:
            return "changes_requested"
        return {
            "validate": "approved", "confirm": "pending", "validate1": "pending",
            "refuse": "rejected", "draft": "draft",
        }.get(leave.state, leave.state)

    @api.model
    def _base_data(self, filters, report_key=None):
        filters = filters or {}
        access, employees = self._scope(filters)
        snapshot = report_key in ("utilisation", "balances", "absence_risk", "anomalies", "executive_brief")
        range_key = "this_year" if snapshot else filters.get("date_range", "this_year")
        start, end = self._date_range(range_key, None if snapshot else filters.get("start_date"), None if snapshot else filters.get("end_date"))
        type_ids = self._filter_ids(filters, "leave_type_ids", "leave_type_id")
        leave_domain = [
            ("employee_id", "in", employees.ids), ("request_date_from", "<=", end),
            ("request_date_to", ">=", start), ("state", "!=", "draft"),
        ]
        submitted_domain = [
            ("employee_id", "in", employees.ids),
            ("submitted_at", ">=", datetime.combine(start, time.min)),
            ("submitted_at", "<=", datetime.combine(end, time.max)),
            ("state", "!=", "draft"),
        ]
        if type_ids:
            leave_domain.append(("holiday_status_id", "in", type_ids))
            submitted_domain.append(("holiday_status_id", "in", type_ids))
        Leave = self.env["hr.leave"].sudo()
        leave_types = self.env["hr.leave.type"].sudo().with_context(active_test=False).search([
            ("company_id", "in", [False, self.env.company.id]),
            *(([("id", "in", type_ids)]) if type_ids else []),
        ], order="sequence, name")
        return {
            "filters": filters, "access": access, "employees": employees,
            "start": start, "end": end, "types": leave_types,
            "leaves": Leave.search(leave_domain, order="request_date_from, id"),
            "submitted": Leave.search(submitted_domain, order="submitted_at, id"),
        }

    @api.model
    def _options(self, scoped_employees, leave_types):
        def rows(records):
            return [{"id": record.id, "name": record.name} for record in records if record]
        return {
            "departments": rows(scoped_employees.mapped("department_id").sorted("name")),
            "locations": rows(scoped_employees.mapped("work_location_id").sorted("name")),
            "units": rows(scoped_employees.mapped("unit_id").sorted("name")),
            "employees": [{
                "id": employee.id, "name": employee.name,
                "department": employee.department_id.name or _("No Department"),
            } for employee in scoped_employees.sorted("name")],
            "leave_types": [{
                "id": leave_type.id, "name": leave_type.name,
                "bradford_count_mode": leave_type.bradford_count_mode,
            } for leave_type in leave_types],
        }

    @api.model
    def _utilisation(self, data):
        components = self.env["hr.leave.balance.transaction"].sudo()._balance_components(
            data["employees"].ids, data["types"].ids,
        )
        employee_map = {employee.id: employee for employee in data["employees"]}
        type_map = {leave_type.id: leave_type for leave_type in data["types"]}
        employee_totals = defaultdict(lambda: defaultdict(float))
        type_totals = defaultdict(lambda: defaultdict(float))
        for (employee_id, type_id), values in components.items():
            for key in ("total_entitlement", "used", "pending", "available"):
                employee_totals[employee_id][key] += values.get(key, 0.0)
                type_totals[type_id][key] += values.get(key, 0.0)
        def row(record, values):
            allocated, used = values["total_entitlement"], values["used"]
            return {
                "id": record.id, "name": record.name,
                "allocated": round(allocated, 2), "used": round(used, 2),
                "pending": round(values["pending"], 2), "available": round(values["available"], 2),
                "utilisation": round(used * 100 / allocated, 1) if allocated else 0,
            }
        by_type = [row(type_map[key], values) for key, values in type_totals.items() if key in type_map]
        by_employee = [
            {**row(employee_map[key], values), "department": employee_map[key].department_id.name or _("No Department")}
            for key, values in employee_totals.items() if key in employee_map
        ]
        by_type.sort(key=lambda item: (-item["utilisation"], item["name"]))
        by_employee.sort(key=lambda item: (-item["utilisation"], item["name"]))
        return {"by_type": by_type, "by_employee": by_employee}

    @api.model
    def _balances(self, data):
        components = self.env["hr.leave.balance.transaction"].sudo()._balance_components(
            data["employees"].ids, data["types"].ids,
        )
        employee_map = {employee.id: employee for employee in data["employees"]}
        type_map = {leave_type.id: leave_type for leave_type in data["types"]}
        rows = []
        totals = defaultdict(float)
        for (employee_id, type_id), values in components.items():
            if employee_id not in employee_map or type_id not in type_map:
                continue
            row = {
                "employee_id": employee_id, "employee": employee_map[employee_id].name,
                "department": employee_map[employee_id].department_id.name or _("No Department"),
                "leave_type_id": type_id, "leave_type": type_map[type_id].name,
                "available": values.get("available", 0.0), "used": values.get("used", 0.0),
                "pending": values.get("pending", 0.0), "carried_forward": values.get("carried_forward", 0.0),
                "expiring": values.get("expiring", 0.0),
                "expiry_date": fields.Date.to_string(values.get("expiry_date")) if values.get("expiry_date") else "",
            }
            rows.append(row)
            for key in ("available", "used", "pending", "carried_forward", "expiring"):
                totals[key] += row[key]
        rows.sort(key=lambda item: (item["employee"], item["leave_type"]))
        return {"rows": rows, "totals": {key: round(value, 2) for key, value in totals.items()}}

    @api.model
    def _request_volume(self, data):
        counts = defaultdict(int)
        month = data["start"].replace(day=1)
        months = []
        while month <= data["end"]:
            months.append(month)
            month += relativedelta(months=1)
        monthly = {value: defaultdict(int) for value in months}
        for leave in data["submitted"]:
            status = self._status(leave)
            counts[status] += 1
            bucket = leave.submitted_at.date().replace(day=1)
            if bucket in monthly:
                monthly[bucket][status] += 1
        keys = ("approved", "pending", "rejected", "cancelled", "changes_requested")
        rows = [{"month": value.strftime("%b %Y"), **{key: monthly[value][key] for key in keys}} for value in months]
        for row in rows:
            row["submitted"] = sum(row[key] for key in keys)
        current_total = len(data["submitted"])
        previous_start = data["start"] - (data["end"] - data["start"] + timedelta(days=1))
        previous_end = data["start"] - timedelta(days=1)
        previous_domain = [
            ("employee_id", "in", data["employees"].ids),
            ("submitted_at", ">=", datetime.combine(previous_start, time.min)),
            ("submitted_at", "<=", datetime.combine(previous_end, time.max)),
            ("state", "!=", "draft"),
        ]
        type_ids = self._filter_ids(data["filters"], "leave_type_ids", "leave_type_id")
        if type_ids:
            previous_domain.append(("holiday_status_id", "in", type_ids))
        previous_total = self.env["hr.leave"].sudo().search_count(previous_domain)
        comparison = 0 if current_total == previous_total else (100 if not previous_total else round((current_total - previous_total) * 100 / previous_total, 1))
        return {
            "counts": {key: counts[key] for key in keys},
            "total": current_total, "previous_total": previous_total, "change_percent": comparison, "monthly": rows,
        }

    @api.model
    def _turnaround(self, data):
        leaves = data["submitted"]
        instances = self.env["cleon.approval.instance"].sudo().search([
            ("res_model", "=", "hr.leave"), ("res_id", "in", leaves.ids),
            ("state", "in", ("approved", "rejected")),
        ], order="create_date, id")
        leave_by_id = {leave.id: leave for leave in leaves}
        by_approver = defaultdict(list)
        by_type = defaultdict(list)
        samples = []
        for instance in instances:
            leave = leave_by_id.get(instance.res_id)
            decided_steps = instance.step_ids.filtered(lambda step: step.decision_at)
            if not leave or not decided_steps or not instance.create_date:
                continue
            for step in decided_steps.sorted(key=lambda step: (step.decision_at, step.id)):
                # Each decision row is created when its step is activated,
                # including concurrent approvers. Never invent a combined user.
                decisions = step.decision_ids.filtered(lambda decision: decision.decision_at and decision.state in ("approved", "rejected"))
                for decision in decisions:
                    step_hours = max((decision.decision_at - decision.create_date).total_seconds() / 3600, 0)
                    by_approver[decision.user_id.name].append(step_hours)
                if not decisions and step.decision_user_id:
                    # Legacy steps without per-user decision history cannot
                    # supply an authoritative activation duration.
                    continue
            total_hours = max((max(decided_steps.mapped("decision_at")) - instance.create_date).total_seconds() / 3600, 0)
            by_type[leave.holiday_status_id.name].append(total_hours)
            samples.append(total_hours)
        def grouped(mapping):
            rows = [{"name": name, "decisions": len(values), "average_hours": round(sum(values) / len(values), 1), "longest_hours": round(max(values), 1)} for name, values in mapping.items()]
            return sorted(rows, key=lambda item: (-item["average_hours"], item["name"]))
        return {
            "average_hours": round(sum(samples) / len(samples), 1) if samples else 0,
            "longest_hours": round(max(samples), 1) if samples else 0,
            "decisions": len(samples), "by_approver": grouped(by_approver), "by_type": grouped(by_type),
            "changes_request_treatment": _("Each resubmission starts a new approval instance; employee revision time is outside turnaround."),
        }

    @api.model
    def _clipped_leave_days(self, leave, start, end):
        """Return one authoritative calendar-aware duration for a report slice."""
        clipped_start = max(leave.request_date_from, start)
        clipped_end = min(leave.request_date_to, end)
        if clipped_start > clipped_end:
            return 0.0
        if clipped_start == leave.request_date_from and clipped_end == leave.request_date_to:
            return leave.number_of_days or 0.0
        calendar = leave.employee_id.resource_calendar_id
        resource = leave.employee_id.resource_id
        if not calendar or not resource:
            span = max((leave.request_date_to - leave.request_date_from).days + 1, 1)
            return (leave.number_of_days or 0.0) * ((clipped_end - clipped_start).days + 1) / span
        def hours(date_from, date_to):
            start_dt = datetime.combine(date_from, time.min).replace(tzinfo=UTC)
            end_dt = datetime.combine(date_to + timedelta(days=1), time.min).replace(tzinfo=UTC)
            intervals = calendar._work_intervals_batch(
                start_dt, end_dt, resources=resource,
                domain=["|", ("holiday_id", "=", False), ("holiday_id", "!=", leave.id)],
            )[resource.id]
            return sum((stop - begin).total_seconds() for begin, stop, _meta in intervals) / 3600
        full_hours = hours(leave.request_date_from, leave.request_date_to)
        clipped_hours = hours(clipped_start, clipped_end)
        return (leave.number_of_days or 0.0) * clipped_hours / full_hours if full_hours else 0.0

    @api.model
    def _trends(self, data):
        approved = data["leaves"].filtered(lambda leave: self._status(leave) == "approved")
        month = data["start"].replace(day=1)
        buckets = []
        while month <= data["end"]:
            buckets.append(month)
            month += relativedelta(months=1)
        values = {bucket: {"requests": 0, "days": 0.0} for bucket in buckets}
        for leave in approved:
            clipped_start = max(leave.request_date_from, data["start"])
            clipped_end = min(leave.request_date_to, data["end"])
            touched = set()
            day = clipped_start
            while day <= clipped_end:
                bucket = day.replace(day=1)
                if bucket in values:
                    month_end = (bucket + relativedelta(months=1)) - timedelta(days=1)
                    values[bucket]["days"] += self._clipped_leave_days(leave, max(day, bucket), min(clipped_end, month_end))
                    touched.add(bucket)
                day = (bucket + relativedelta(months=1))
            for bucket in touched:
                values[bucket]["requests"] += 1
        holiday_dates = set()
        calendars = data["employees"].mapped("resource_calendar_id")
        holidays = self.env["resource.calendar.leaves"].sudo().search([
            ("calendar_id", "in", calendars.ids),
            ("date_from", "<=", datetime.combine(data["end"], time.max)),
            ("date_to", ">=", datetime.combine(data["start"], time.min)),
        ]) if calendars else self.env["resource.calendar.leaves"]
        for holiday in holidays:
            holiday_dates.add(holiday.date_from.date())
        adjacent = sum(1 for leave in approved if any(abs((leave.request_date_from - day).days) <= 1 or abs((leave.request_date_to - day).days) <= 1 for day in holiday_dates))
        return {
            "monthly": [{"month": bucket.strftime("%b %Y"), "requests": values[bucket]["requests"], "days": round(values[bucket]["days"], 2)} for bucket in buckets],
            "holiday_adjacent_requests": adjacent,
        }

    @api.model
    def _frequency(self, data):
        result = {}
        for key, field_name, empty_label in (
            ("department", "department_id", _("No Department")),
            ("location", "work_location_id", _("No Location")),
            ("unit", "unit_id", _("No Unit")),
        ):
            groups = {}
            for employee in data["employees"]:
                record = employee[field_name]
                group_key = record.id or 0
                groups.setdefault(group_key, {"id": group_key, "name": record.name if record else empty_label, "headcount": 0, "requests": 0, "days": 0.0})
                groups[group_key]["headcount"] += 1
            for leave in data["leaves"]:
                record = leave.employee_id[field_name]
                row = groups.get(record.id or 0)
                if not row:
                    continue
                row["requests"] += 1
                if self._status(leave) == "approved":
                    row["days"] += self._clipped_leave_days(leave, data["start"], data["end"])
            rows = list(groups.values())
            for row in rows:
                row["days"] = round(row["days"], 2)
                row["requests_per_employee"] = round(row["requests"] / row["headcount"], 2) if row["headcount"] else 0
            rows.sort(key=lambda item: (-item["requests"], -item["requests_per_employee"], item["name"]))
            for rank, row in enumerate(rows, 1):
                row["rank"] = rank
            result[key] = rows
        return result

    @api.model
    def _policy_usage(self, data):
        rows = []
        policies = self.env["hr.leave.policy"].sudo().with_context(active_test=False).search([
            ("company_id", "=", self.env.company.id),
        ], order="name")
        selected_type_ids = set(data["types"].ids)
        for policy in policies:
            lines = policy.line_ids.filtered(lambda line: line.active and line.leave_type_id.id in selected_type_ids)
            if not lines:
                continue
            type_leaves = data["leaves"].filtered(lambda leave: leave.governing_policy_id.id == policy.id and leave.holiday_status_id.id in selected_type_ids)
            eligible = policy._eligible_employees() & data["employees"]
            notice_values = [max((leave.request_date_from - leave.submitted_at.date()).days, 0) for leave in type_leaves if leave.submitted_at and leave.request_date_from]
            longest = max(type_leaves.mapped("number_of_days") or [0])
            notice_limit = max(lines.mapped("minimum_notice_days") or [0])
            consecutive_limit = max(lines.mapped("maximum_duration") or [0])
            average_notice = sum(notice_values) / len(notice_values) if notice_values else 0
            rows.append({
                "id": policy.id, "name": policy.name,
                "employees": len(eligible), "requests": len(type_leaves),
                "average_notice": round(average_notice, 1), "notice_limit": notice_limit,
                "notice_usage": round(notice_limit * 100 / average_notice, 1) if notice_limit and average_notice else 0,
                "longest_request": round(longest, 1), "consecutive_limit": consecutive_limit,
                "consecutive_usage": round(longest * 100 / consecutive_limit, 1) if consecutive_limit else 0,
                "blackout_periods": self.env["hr.leave.blackout.period"].sudo().search_count([
                    ("company_id", "=", self.env.company.id), ("active", "=", True), ("state", "=", "active"),
                    "|", ("leave_type_ids", "=", False), ("leave_type_ids", "in", lines.leave_type_id.ids),
                ]),
            })
        rows.sort(key=lambda item: (-item["requests"], item["name"]))
        return rows

    @api.model
    def _band(self, company, score):
        if score >= company.leave_bradford_critical:
            return "critical"
        if score >= company.leave_bradford_serious:
            return "serious"
        if score >= company.leave_bradford_concern:
            return "concern"
        if score >= company.leave_bradford_caution:
            return "caution"
        return "low"

    @api.model
    def _employee_risk(self, employee, company, window_end=None):
        window_end = fields.Date.to_date(window_end) if window_end else fields.Date.context_today(self)
        window_start = window_end - timedelta(weeks=company.leave_bradford_window_weeks) + timedelta(days=1)
        leaves = self.env["hr.leave"].sudo().search([
            ("employee_id", "=", employee.id), ("state", "=", "validate"),
            ("is_cancelled", "=", False), ("bradford_excluded", "=", False),
            ("request_date_from", "<=", window_end), ("request_date_to", ">=", window_start),
        ], order="request_date_from, request_date_to, id")
        intervals = []
        for leave in leaves:
            mode = leave.holiday_status_id._effective_bradford_mode()
            if mode == "exclude":
                continue
            notice = (leave.request_date_from - leave.submitted_at.date()).days if leave.submitted_at else 0
            if mode == "short_notice" and notice >= leave.holiday_status_id.minimum_notice_days:
                continue
            start = max(leave.request_date_from, window_start)
            end = min(leave.request_date_to, window_end)
            intervals.append((start, end))
        spells = []
        for start, end in intervals:
            if spells and self._same_continuous_spell(employee, spells[-1][1], start):
                spells[-1] = (spells[-1][0], max(spells[-1][1], end))
            else:
                spells.append((start, end))
        spells = [spell for spell in spells if (spell[1] - spell[0]).days + 1 >= company.leave_bradford_min_spell_days]
        days = sum((end - start).days + 1 for start, end in spells)
        score = len(spells) ** 2 * days
        return {
            "employee_id": employee.id, "employee": employee.name,
            "department": employee.department_id.name or _("No Department"),
            "location": employee.work_location_id.name or _("No Location"),
            "score": score, "band": self._band(company, score),
            "spells": len(spells), "days": days,
            "window_start": fields.Date.to_string(window_start), "window_end": fields.Date.to_string(window_end),
        }

    @api.model
    def _same_continuous_spell(self, employee, previous_end, next_start):
        if next_start <= previous_end + timedelta(days=1):
            return True
        calendar, resource = employee.resource_calendar_id, employee.resource_id
        if not calendar or not resource:
            return next_start <= previous_end + timedelta(days=1)
        start_dt = datetime.combine(previous_end + timedelta(days=1), time.min).replace(tzinfo=UTC)
        end_dt = datetime.combine(next_start, time.min).replace(tzinfo=UTC)
        return not bool(calendar._work_intervals_batch(start_dt, end_dt, resources=resource)[resource.id])

    @api.model
    def _absence_risk(self, data):
        access = data["access"]
        company = self.env.company
        settings = {
            "enabled": company.leave_bradford_enabled,
            "window_weeks": company.leave_bradford_window_weeks,
            "minimum_spell_days": company.leave_bradford_min_spell_days,
            "thresholds": {
                "caution": company.leave_bradford_caution, "concern": company.leave_bradford_concern,
                "serious": company.leave_bradford_serious, "critical": company.leave_bradford_critical,
            },
            "leave_type_modes": [{
                "id": leave_type.id, "name": leave_type.name,
                "mode": leave_type._effective_bradford_mode(),
                "locked": leave_type.bradford_protected or leave_type.policy_classification == "annual",
            } for leave_type in self.env["hr.leave.type"].sudo().with_context(active_test=False).search([
                ("company_id", "in", [False, company.id]),
            ], order="sequence, name")],
        }
        if not company.leave_bradford_enabled:
            return {"mode": "disabled", "rows": [], "bands": {}, "settings": settings}
        Risk = self.env["hr.leave.absence.risk"].sudo()
        snapshots = Risk.search([("employee_id", "in", data["employees"].ids)])
        snapshot_by_employee = {snapshot.employee_id.id: snapshot for snapshot in snapshots}
        missing = data["employees"].filtered(lambda employee: employee.id not in snapshot_by_employee)
        for employee_company in missing.mapped("company_id"):
            company_employees = missing.filtered(lambda employee, employee_company=employee_company: employee.company_id == employee_company)
            self._refresh_risk_snapshots(employee_company, company_employees, notify_crossing=False)
        if missing:
            snapshots = Risk.search([("employee_id", "in", data["employees"].ids)])
            snapshot_by_employee = {snapshot.employee_id.id: snapshot for snapshot in snapshots}
        calculated = []
        for employee in data["employees"]:
            snapshot = snapshot_by_employee.get(employee.id)
            if not snapshot:
                continue
            calculated.append({
                "employee_id": employee.id, "employee": employee.name,
                "department": employee.department_id.name or _("No Department"),
                "location": employee.work_location_id.name or _("No Location"),
                "score": snapshot.score, "band": snapshot.band,
                "spells": snapshot.spell_count, "days": snapshot.day_count,
                "window_start": fields.Date.to_string(snapshot.window_start),
                "window_end": fields.Date.to_string(snapshot.window_end),
            })
        band_counts = defaultdict(int)
        for row in calculated:
            band_counts[row["band"]] += 1
        if access["risk_detail"]:
            rows = sorted(calculated, key=lambda item: (-item["score"], item["employee"]))
            mode = "detail"
        elif access["scope"] == "team":
            rows = [{
                "employee_id": row["employee_id"], "employee": row["employee"],
                "department": row["department"], "flag": "watch" if row["band"] != "low" else "low",
            } for row in calculated]
            mode = "team_flags"
            band_counts = {}
        else:
            rows = []
            mode = "aggregate"
        if not access["risk_configure"]:
            settings = {}
        return {"mode": mode, "rows": rows, "bands": dict(band_counts), "settings": settings}

    @api.model
    def _anomalies(self, data):
        filters = data.get("filters") or {}
        dept_ids = self._filter_ids(filters, "department_ids", "department_id")
        dept_id = dept_ids[0] if dept_ids else None
        res = self.env["hr.leave.ai.service"].get_leave_anomalies(
            severity=filters.get("severity"),
            department_id=dept_id,
            pattern_type=filters.get("pattern_type"),
            status=filters.get("status"),
        )
        return {"rows": res.get("anomalies", []), "total": res.get("total", 0)}

    @api.model
    def _executive_brief(self, data):
        filters = data.get("filters") or {}
        dept_ids = self._filter_ids(filters, "department_ids", "department_id")
        dept_id = dept_ids[0] if dept_ids else None
        month = filters.get("month")
        return self.env["hr.leave.ai.service"].get_executive_workforce_brief(
            month=month,
            department_id=dept_id,
        )

    @api.model
    def get_report_data(self, filters=None, report_key="request_volume"):
        if report_key not in self.REPORT_KEYS:
            raise ValidationError(_("Unsupported leave report."))
        data = self._base_data(filters or {}, report_key)
        all_types = self.env["hr.leave.type"].sudo().with_context(active_test=False).search([
            ("company_id", "in", [False, self.env.company.id])
        ], order="sequence, name")
        builders = {
            "utilisation": lambda: self._utilisation(data),
            "balances": lambda: self._balances(data),
            "request_volume": lambda: self._request_volume(data),
            "turnaround": lambda: self._turnaround(data),
            "trends": lambda: self._trends(data),
            "frequency": lambda: self._frequency(data),
            "policy_usage": lambda: self._policy_usage(data),
            "absence_risk": lambda: self._absence_risk(data),
            "anomalies": lambda: self._anomalies(data),
            "executive_brief": lambda: self._executive_brief(data),
        }
        metric_basis = {
            "utilisation": _("Current entitlement and balance snapshot"),
            "balances": _("Current balances as of today"),
            "absence_risk": _("Current rolling Bradford window ending today"),
            "anomalies": _("Rolling 180-day leave pattern and anomaly analysis"),
            "executive_brief": _("Monthly workforce KPI, trend, and recommendation brief"),
        }.get(report_key, "")
        options = self._options(data["access"]["employees"], all_types)
        if not data["access"]["risk_configure"]:
            for leave_type in options["leave_types"]:
                leave_type.pop("bradford_count_mode", None)
        can_view_anomalies = self.env["hr.leave"].is_ai_capability_enabled("anomaly_detection") and (
            self.env.user.has_group("hr.group_hr_user")
            or self.env.user.has_group("base.group_system")
            or self.env["hr.leave"]._leave_is_administrator()
            or self.env.user.has_group("hr_leave_dashboard.group_leave_permission_ai_insights")
        )
        can_view_executive_brief = self.env["hr.leave"].is_ai_capability_enabled("executive_brief") and (
            self.env.user.has_group("base.group_system")
            or self.env.user.has_group("hr_leave_dashboard.group_leave_permission_executive_analytics")
            or self.env["hr.leave"]._leave_is_administrator()
        )
        return {
            "meta": {
                "scope": data["access"]["scope"],
                "scope_label": _("My Team") if data["access"]["scope"] == "team" else _("Authorised Organisation"),
                "can_view_risk_details": data["access"]["risk_detail"],
                "can_configure_risk": data["access"]["risk_configure"],
                "can_view_anomalies": can_view_anomalies,
                "can_view_executive_brief": can_view_executive_brief,
                "period": {"start": fields.Date.to_string(data["start"]), "end": fields.Date.to_string(data["end"])},
                "generated_at": fields.Datetime.to_string(fields.Datetime.now()),
                "employee_count": len(data["employees"]),
                "metric_basis": metric_basis,
            },
            "options": options,
            "reports": {report_key: builders[report_key]()},
        }

    @api.model
    def get_report_drilldown(self, dimension, dimension_id, filters=None):
        if dimension not in ("department", "location", "unit"):
            raise ValidationError(_("Unsupported report drill-down."))
        data = self._base_data(filters or {})
        field_name = {"department": "department_id", "location": "work_location_id", "unit": "unit_id"}[dimension]
        dimension_id = int(dimension_id or 0)
        leaves = data["leaves"].filtered(lambda leave: (leave.employee_id[field_name].id or 0) == dimension_id)
        return {"rows": [{
            "id": leave.id, "reference": leave.request_ref or "LR-%06d" % leave.id,
            "employee": leave.employee_id.name, "leave_type": leave.holiday_status_id.name,
            "date_from": fields.Date.to_string(leave.request_date_from),
            "date_to": fields.Date.to_string(leave.request_date_to),
            "days": round(leave.number_of_days or 0.0, 2), "status": self._status(leave),
        } for leave in leaves]}

    @api.model
    def save_absence_risk_settings(self, values):
        access = self._access()
        if not access["risk_configure"]:
            raise AccessError(_("Only an HR Administrator or HR Director can configure absence-risk scoring."))
        values = values or {}
        thresholds = values.get("thresholds") or {}
        numbers = [int(thresholds.get(key, 0)) for key in ("caution", "concern", "serious", "critical")]
        window = int(values.get("window_weeks", 52))
        minimum = int(values.get("minimum_spell_days", 1))
        if window < 1 or minimum < 1 or any(value < 1 for value in numbers) or numbers != sorted(numbers) or len(set(numbers)) != 4:
            raise ValidationError(_("Use a positive window/minimum spell and four strictly increasing score thresholds."))
        company = self.env.company
        before = {
            "enabled": company.leave_bradford_enabled, "window_weeks": company.leave_bradford_window_weeks,
            "minimum_spell_days": company.leave_bradford_min_spell_days,
            "thresholds": [company.leave_bradford_caution, company.leave_bradford_concern, company.leave_bradford_serious, company.leave_bradford_critical],
        }
        company.sudo().write({
            "leave_bradford_enabled": bool(values.get("enabled")),
            "leave_bradford_window_weeks": window,
            "leave_bradford_min_spell_days": minimum,
            "leave_bradford_caution": numbers[0], "leave_bradford_concern": numbers[1],
            "leave_bradford_serious": numbers[2], "leave_bradford_critical": numbers[3],
        })
        leave_type_modes = values.get("leave_type_modes") or []
        allowed_modes = {"exclude", "short_notice", "all"}
        allowed_types = self.env["hr.leave.type"].sudo().with_context(active_test=False).search([
            ("company_id", "in", [False, company.id]),
        ])
        allowed_by_id = {leave_type.id: leave_type for leave_type in allowed_types}
        for item in leave_type_modes:
            leave_type = allowed_by_id.get(int(item.get("id") or 0))
            mode = item.get("mode")
            if not leave_type or mode not in allowed_modes:
                raise ValidationError(_("Invalid Leave Type absence-risk treatment."))
            if (leave_type.bradford_protected or leave_type.policy_classification == "annual") and mode != "exclude":
                raise ValidationError(_("Annual and parental Leave Types are always excluded from Bradford scoring."))
            leave_type.with_context(skip_bradford_refresh=True).write({
                "bradford_count_mode": mode, "bradford_treatment_configured": True,
            })
        self.env["hr.leave.audit.log"].sudo().create({
            "action": "risk_configuration_change", "company_id": company.id,
            "actor_id": self.env.user.id, "actor_label": self.env.user.name,
            "actor_role": self._risk_actor_role(), "entity_type": "absence_risk",
            "entity_name": _("Bradford Factor configuration"), "before_values": before,
            "after_values": values, "note": _("Absence-risk settings updated."),
        })
        self._refresh_risk_snapshots(company, notify_crossing=False)
        return True

    @api.model
    def set_bradford_exclusion(self, leave_id, excluded, reason=""):
        access = self._access()
        if not access["risk_detail"]:
            raise AccessError(_("Only an HR Administrator or HR Director can change absence-risk exclusions."))
        leave = self.env["hr.leave"].sudo().browse(int(leave_id)).exists()
        if not leave or leave.employee_id.company_id not in self.env.user.company_ids:
            raise AccessError(_("This leave record is outside your authorised companies."))
        reason = (reason or "").strip()
        if excluded and len(reason) < 3:
            raise ValidationError(_("An exclusion reason is required."))
        before = {"excluded": leave.bradford_excluded, "reason": leave.bradford_exclusion_reason or ""}
        leave.sudo().write({"bradford_excluded": bool(excluded), "bradford_exclusion_reason": reason if excluded else False})
        self.env["hr.leave.audit.log"].sudo().create({
            "action": "risk_exclusion_change", "company_id": leave.employee_id.company_id.id,
            "leave_id": leave.id, "employee_id": leave.employee_id.id,
            "leave_type_id": leave.holiday_status_id.id,
            "actor_id": self.env.user.id, "actor_label": self.env.user.name,
            "actor_role": self._risk_actor_role(), "entity_type": "absence_risk",
            "entity_name": leave.employee_id.name, "before_values": before,
            "after_values": {"excluded": bool(excluded), "reason": reason if excluded else ""},
            "note": reason or _("Absence-risk exclusion removed."),
        })
        return True

    @api.model
    def _refresh_risk_snapshots(self, company, employees=None, notify_crossing=True):
        employees = employees or self.env["hr.employee"].sudo().search([
            ("company_id", "=", company.id), ("active", "=", True),
        ])
        Risk = self.env["hr.leave.absence.risk"].sudo()
        band_order = {"low": 0, "caution": 1, "concern": 2, "serious": 3, "critical": 4}
        for employee in employees:
            result = self._employee_risk(employee, company)
            current = Risk.search([("company_id", "=", company.id), ("employee_id", "=", employee.id)], limit=1)
            old_band = current.band if current else "low"
            values = {
                "company_id": company.id, "employee_id": employee.id,
                "score": result["score"], "band": result["band"],
                "spell_count": result["spells"], "day_count": result["days"],
                "window_start": result["window_start"], "window_end": result["window_end"],
                "calculated_at": fields.Datetime.now(),
            }
            if current:
                current.write(values)
            else:
                Risk.create(values)
            if notify_crossing and band_order[result["band"]] > band_order.get(old_band, 0):
                self.env["hr.leave.audit.log"].sudo().create({
                    "action": "risk_band_crossing", "company_id": company.id,
                    "employee_id": employee.id, "entity_type": "absence_risk",
                    "entity_name": employee.name, "before_values": {"band": old_band},
                    "after_values": {"band": result["band"], "score": result["score"]},
                    "note": _("Absence risk moved from %(old)s to %(new)s.", old=old_band.title(), new=result["band"].title()),
                    "is_system": True,
                })
                self._notify_risk_band_crossing(company, employee, old_band, result)
        return True

    @api.model
    def _notify_risk_band_crossing(self, company, employee, old_band, result):
        groups = (
            self.env.ref("hr_leave_dashboard.group_leave_administrator", raise_if_not_found=False)
            | self.env.ref("hr_leave_dashboard.group_role_hr_director", raise_if_not_found=False)
        )
        users = groups.mapped("users").filtered(lambda user: company in user.company_ids and user.active)
        if users:
            users.mapped("partner_id").message_notify(
                subject=_("Absence risk band changed"),
                body=_(
                    "%(employee)s moved from %(old)s to %(new)s (score %(score)s). Review the attendance pattern; no automatic action has been taken.",
                    employee=employee.name, old=old_band.title(), new=result["band"].title(), score=result["score"],
                ),
            )

    @api.model
    def _export_rows(self, report_key, payload, filters):
        reports = payload["reports"]
        if report_key == "utilisation":
            return [["Leave Type", "Allocated", "Used", "Pending", "Available", "Utilisation %"]] + [[row["name"], row["allocated"], row["used"], row["pending"], row["available"], row["utilisation"]] for row in reports["utilisation"]["by_type"]]
        if report_key == "balances":
            return [["Employee", "Department", "Leave Type", "Available", "Used", "Pending", "Carried Forward", "Expiring", "Expiry Date"]] + [[row[key] for key in ("employee", "department", "leave_type", "available", "used", "pending", "carried_forward", "expiring", "expiry_date")] for row in reports["balances"]["rows"]]
        if report_key == "request_volume":
            return [["Month", "Submitted", "Approved", "Pending", "Rejected", "Cancelled"]] + [[row[key] for key in ("month", "submitted", "approved", "pending", "rejected", "cancelled")] for row in reports["request_volume"]["monthly"]]
        if report_key == "turnaround":
            return [["Approver", "Decisions", "Average Hours", "Longest Hours"]] + [[row[key] for key in ("name", "decisions", "average_hours", "longest_hours")] for row in reports["turnaround"]["by_approver"]]
        if report_key == "trends":
            return [["Month", "Approved Requests", "Approved Days"]] + [[row[key] for key in ("month", "requests", "days")] for row in reports["trends"]["monthly"]]
        if report_key == "frequency":
            dimension = (filters or {}).get("frequency_dimension", "department")
            return [[dimension.title(), "Requests", "Total Days", "Headcount", "Requests per Employee"]] + [[row[key] for key in ("name", "requests", "days", "headcount", "requests_per_employee")] for row in reports["frequency"].get(dimension, [])]
        if report_key == "policy_usage":
            return [["Policy / Leave Type", "Employees", "Requests", "Average Notice", "Notice Limit", "Longest Request", "Consecutive Limit", "Blackout Rules"]] + [[row[key] for key in ("name", "employees", "requests", "average_notice", "notice_limit", "longest_request", "consecutive_limit", "blackout_periods")] for row in reports["policy_usage"]]
        if report_key == "anomalies":
            return [["Employee", "Department", "Pattern Type", "Severity", "Last Detected", "Occurrences", "Status", "Supporting Data"]] + [
                [row[key] for key in ("employee", "department", "pattern_type_label", "severity_label", "last_detected", "occurrences", "status", "supporting_data")]
                for row in reports.get("anomalies", {}).get("rows", [])
            ]
        if report_key == "executive_brief":
            brief = reports.get("executive_brief", {})
            kpis = brief.get("kpis", {})
            return [
                ["Executive Workforce Brief", brief.get("period_title", "")],
                ["Requests Approved", str(kpis.get("requests_approved", 0))],
                ["Pending Approvals", str(kpis.get("pending_approvals", 0))],
                ["Approval SLA Achieved", f"{kpis.get('sla_achieved_percent', 0)}%"],
                ["Average Days to Approve", str(kpis.get("avg_days_to_approve", 0))],
                ["Key Insights", " | ".join(brief.get("key_insights", []))],
                ["AI Recommendations (Advisory)", " | ".join(brief.get("ai_recommendations", []))],
            ]
        risk = reports.get("absence_risk", {})
        if risk.get("mode") == "detail":
            return [["Employee", "Department", "Location", "Score", "Band", "Spells", "Days", "Window Start", "Window End"]] + [[row[key] for key in ("employee", "department", "location", "score", "band", "spells", "days", "window_start", "window_end")] for row in risk.get("rows", [])]
        if risk.get("mode") == "team_flags":
            return [["Employee", "Department", "Attendance Pattern"]] + [[row["employee"], row["department"], _("Attendance pattern under review") if row["flag"] == "watch" else _("Low")] for row in risk.get("rows", [])]
        if risk.get("mode") == "aggregate":
            return [["Band", "Employees"]] + [[band.title(), risk.get("bands", {}).get(band, 0)] for band in ("low", "caution", "concern", "serious", "critical")]
        return [["Report", "No data"]]

    @api.model
    def export_report(self, report_key, filters=None, file_format="csv"):
        if report_key not in self.REPORT_KEYS or file_format not in ("csv", "xlsx", "pdf"):
            raise ValidationError(_("Unsupported report export."))
        payload = self.get_report_data(filters or {}, report_key)
        rows = self._export_rows(report_key, payload, filters or {})
        filename = "leave_%s_%s" % (report_key, fields.Date.context_today(self))
        if file_format == "csv":
            stream = io.StringIO()
            writer = csv.writer(stream)
            writer.writerows(rows)
            content = stream.getvalue().encode("utf-8-sig")
            mimetype, extension = "text/csv;charset=utf-8", "csv"
        elif file_format == "xlsx":
            import xlsxwriter
            stream = io.BytesIO()
            workbook = xlsxwriter.Workbook(stream, {"in_memory": True})
            sheet = workbook.add_worksheet("Leave Report")
            header = workbook.add_format({"bold": True, "bg_color": "#D90868", "font_color": "#FFFFFF"})
            for row_index, row in enumerate(rows):
                sheet.write_row(row_index, 0, row, header if row_index == 0 else None)
            if rows:
                sheet.autofilter(0, 0, max(len(rows) - 1, 0), len(rows[0]) - 1)
                sheet.freeze_panes(1, 0)
                sheet.set_column(0, len(rows[0]) - 1, 18)
            workbook.close()
            content = stream.getvalue()
            mimetype, extension = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx"
        else:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4, landscape
            from reportlab.lib.styles import getSampleStyleSheet
            from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
            stream = io.BytesIO()
            document = SimpleDocTemplate(stream, pagesize=landscape(A4), leftMargin=24, rightMargin=24, topMargin=24, bottomMargin=24)
            styles = getSampleStyleSheet()
            story = [Paragraph("CleonHR Leave Report — %s" % report_key.replace("_", " ").title(), styles["Title"]), Spacer(1, 12)]
            table = Table([[str(value) for value in row] for row in rows], repeatRows=1)
            table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#D90868")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("GRID", (0, 0), (-1, -1), .4, colors.HexColor("#D9DEE8")),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F8FAFC")]),
            ]))
            story.append(table)
            document.build(story)
            content = stream.getvalue()
            mimetype, extension = "application/pdf", "pdf"
        if report_key == "absence_risk":
            self.env["hr.leave.audit.log"].sudo().create({
                "action": "risk_export", "company_id": self.env.company.id,
                "actor_id": self.env.user.id, "actor_label": self.env.user.name,
                "actor_role": self._risk_actor_role(), "entity_type": "absence_risk",
                "entity_name": _("Absence Risk export"), "note": _("Absence Risk report exported as %s.") % extension,
            })
        return {
            "filename": "%s.%s" % (filename, extension), "mimetype": mimetype,
            "data": base64.b64encode(content).decode("ascii"),
        }
