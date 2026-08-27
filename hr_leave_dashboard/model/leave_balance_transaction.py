# -*- coding: utf-8 -*-
from collections import defaultdict
from datetime import datetime, time, timedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError

class HrLeaveBalanceTransaction(models.Model):
    _name = "hr.leave.balance.transaction"
    _description = "Immutable Leave Balance Transaction"
    _order = "effective_date desc, id desc"

    employee_id = fields.Many2one("hr.employee", required=True, readonly=True, index=True, ondelete="restrict")
    leave_type_id = fields.Many2one("hr.leave.type", required=True, readonly=True, index=True, ondelete="restrict")
    company_id = fields.Many2one(related="employee_id.company_id", store=True, readonly=True, index=True)
    transaction_type = fields.Selection([
        ("allocation", "Manual Allocation"), ("adjustment", "Balance Adjustment"),
        ("accrual", "Accrual"), ("leave", "Leave Approved"),
        ("reversal", "Reversal"), ("carry_forward", "Carry Forward"),
        ("expiry", "Expiry"),
    ], required=True, readonly=True, index=True)
    effective_date = fields.Date(required=True, readonly=True, default=fields.Date.context_today, index=True)
    delta = fields.Float(required=True, readonly=True)
    balance_after = fields.Float(required=True, readonly=True)
    allocation_id = fields.Many2one("hr.leave.allocation", readonly=True, ondelete="restrict")
    leave_id = fields.Many2one("hr.leave", readonly=True, ondelete="restrict")
    actor_id = fields.Many2one("res.users", readonly=True, default=lambda self: self.env.user)
    reason = fields.Text(required=True, readonly=True)
    expiry_date = fields.Date(readonly=True)
    occurred_at = fields.Datetime(required=True, readonly=True, default=fields.Datetime.now)

    @api.model_create_multi
    def create(self, vals_list):
        if not self.env.context.get("cleon_balance_ledger_write"):
            raise AccessError(_("Balance transactions can only be created by the controlled allocation and adjustment workflows."))
        return super().create(vals_list)

    @api.model
    def _record_transaction(self, values):
        return self.sudo().with_context(cleon_balance_ledger_write=True).create(values)

    def write(self, vals):
        raise AccessError(_("Leave balance transactions are immutable."))

    def unlink(self):
        raise AccessError(_("Leave balance transactions cannot be deleted."))

    @api.model
    def _check_balance_admin(self):
        if not (self.env.user.has_group("base.group_system") or
                self.env.user.has_group("hr_holidays.group_hr_holidays_manager")):
            raise AccessError(_("Only a Time Off Administrator can manage leave balances."))

    @api.model
    def _employee_code(self, employee):
        return employee.employee_number or ""

    @api.model
    def _employee_identification(self, employee):
        if not self.env.user.has_group("hr.group_hr_user"):
            return ""
        return employee.sudo().identification_id or ""

    @api.model
    def _balance_maps(self, employee_ids=None, leave_type_ids=None):
        company_ids = self.env.companies.ids
        alloc_domain = [("state", "=", "validate"), ("employee_id.company_id", "in", company_ids)]
        leave_domain = [("employee_id.company_id", "in", company_ids), ("is_cancelled", "=", False)]
        if employee_ids:
            alloc_domain.append(("employee_id", "in", employee_ids))
            leave_domain.append(("employee_id", "in", employee_ids))
        if leave_type_ids:
            alloc_domain.append(("holiday_status_id", "in", leave_type_ids))
            leave_domain.append(("holiday_status_id", "in", leave_type_ids))

        allocated = defaultdict(float)
        used = defaultdict(float)
        pending = defaultdict(float)
        last_updated = {}
        expiring = defaultdict(float)
        expiry_date = {}
        today = fields.Date.context_today(self)
        deadline = today + timedelta(days=30)

        allocation_rows = self.env["hr.leave.allocation"].read_group(
            alloc_domain,
            ["number_of_days:sum", "write_date:max"],
            ["employee_id", "holiday_status_id"],
            lazy=False,
        )
        for row in allocation_rows:
            if not row.get("employee_id") or not row.get("holiday_status_id"):
                continue
            key = (row["employee_id"][0], row["holiday_status_id"][0])
            allocated[key] = row.get("number_of_days", 0.0)
            changed = fields.Datetime.to_datetime(row.get("write_date"))
            if changed and (not last_updated.get(key) or changed > last_updated[key]):
                last_updated[key] = changed

        expiring_rows = self.env["hr.leave.allocation"].read_group(
            alloc_domain + [("date_to", ">=", today), ("date_to", "<=", deadline)],
            ["number_of_days:sum", "date_to:min"],
            ["employee_id", "holiday_status_id"],
            lazy=False,
        )
        for row in expiring_rows:
            if not row.get("employee_id") or not row.get("holiday_status_id"):
                continue
            key = (row["employee_id"][0], row["holiday_status_id"][0])
            expiring[key] = row.get("number_of_days", 0.0)
            expiry_date[key] = fields.Date.to_date(row.get("date_to"))

        leave_rows = self.env["hr.leave"].read_group(
            leave_domain + [("state", "in", ("confirm", "validate1", "validate"))],
            ["number_of_days:sum", "write_date:max"],
            ["employee_id", "holiday_status_id", "state"],
            lazy=False,
        )
        for row in leave_rows:
            if not row.get("employee_id") or not row.get("holiday_status_id"):
                continue
            key = (row["employee_id"][0], row["holiday_status_id"][0])
            if row.get("state") == "validate":
                used[key] += row.get("number_of_days", 0.0)
            else:
                pending[key] += row.get("number_of_days", 0.0)
            changed = fields.Datetime.to_datetime(row.get("write_date"))
            if changed and (not last_updated.get(key) or changed > last_updated[key]):
                last_updated[key] = changed

        # The expiry warning represents entitlement still available to expire,
        # never the allocation's original face value after days were consumed.
        for key in list(expiring):
            expiring[key] = min(expiring[key], max(allocated[key] - used[key], 0.0))

        carried = defaultdict(float)
        carry_domain = [("company_id", "in", company_ids), ("transaction_type", "=", "carry_forward")]
        if employee_ids:
            carry_domain.append(("employee_id", "in", employee_ids))
        if leave_type_ids:
            carry_domain.append(("leave_type_id", "in", leave_type_ids))
        carry_rows = self.read_group(
            carry_domain,
            ["delta:sum"], ["employee_id", "leave_type_id"], lazy=False,
        )
        for row in carry_rows:
            if row.get("employee_id") and row.get("leave_type_id"):
                carried[(row["employee_id"][0], row["leave_type_id"][0])] = row["delta"]
        return allocated, used, pending, carried, expiring, expiry_date, last_updated

    @api.model
    def _kpi_snapshot(self, as_of_date, employee_ids, leave_type_ids):
        """Reconstruct the measurable KPI values at the end of a prior month."""
        cutoff = fields.Datetime.to_string(datetime.combine(as_of_date, time.max))
        company_ids = self.env.companies.ids
        allocation_rows = self.env["hr.leave.allocation"].read_group([
            ("state", "=", "validate"), ("employee_id.company_id", "in", company_ids),
            ("employee_id", "in", employee_ids), ("holiday_status_id", "in", leave_type_ids),
            ("create_date", "<=", cutoff),
        ], ["number_of_days:sum"], ["employee_id"], lazy=False)
        leave_rows = self.env["hr.leave"].read_group([
            ("employee_id.company_id", "in", company_ids), ("is_cancelled", "=", False),
            ("employee_id", "in", employee_ids), ("holiday_status_id", "in", leave_type_ids),
            ("state", "=", "validate"), ("create_date", "<=", cutoff),
        ], ["number_of_days:sum"], ["employee_id"], lazy=False)
        per_employee = defaultdict(lambda: [0.0, 0.0])
        for row in allocation_rows:
            if row.get("employee_id"):
                per_employee[row["employee_id"][0]][0] = row.get("number_of_days", 0.0)
        for row in leave_rows:
            if row.get("employee_id"):
                per_employee[row["employee_id"][0]][1] = row.get("number_of_days", 0.0)
        allocated = sum(value[0] for value in per_employee.values())
        used = sum(value[1] for value in per_employee.values())
        return {
            "total_employees": len(per_employee),
            "allocated": round(allocated, 2), "used": round(used, 2),
            "remaining": round(allocated - used, 2),
            "negative_employees": sum(1 for allocated_days, used_days in per_employee.values() if allocated_days - used_days < 0),
        }

    @api.model
    def _pct_change(self, current, previous):
        """Return month-on-month % change rounded to 1 decimal.

        Special cases:
        - previous=0, current>0  → +100 (treat as full positive change)
        - previous>0, current=0  → -100 (full drop)
        - both 0                 → 0 (no change)
        """
        if previous == current:
            return 0
        if not previous:
            return 100 if current > 0 else -100
        return round(((current - previous) / previous) * 100, 1)

    @api.model
    def get_balance_page_data(self, filters=None, sort=None, pagination=None, group_by="employee"):
        self._check_balance_admin()
        filters = filters or {}
        employees = self.env["hr.employee"].search([
            ("company_id", "in", self.env.companies.ids), ("active", "=", True),
        ])
        leave_types = self.env["hr.leave.type"].with_context(active_test=False).search([
            ("company_id", "in", [False] + self.env.companies.ids),
        ], order="sequence, name")
        allocated, used, pending, carried, expiring, expiry_dates, updated = self._balance_maps(
            employees.ids, leave_types.ids,
        )
        employee_map = {e.id: e for e in employees}
        type_map = {t.id: t for t in leave_types}
        rows = []
        for employee_id, type_id in sorted(set(allocated) | set(used) | set(pending)):
            employee = employee_map.get(employee_id)
            leave_type = type_map.get(type_id)
            if not employee or not leave_type:
                continue
            total_allocated = round(allocated[(employee_id, type_id)], 2)
            total_used = round(used[(employee_id, type_id)], 2)
            total_pending = round(pending[(employee_id, type_id)], 2)
            remaining = round(total_allocated - total_used, 2)
            health_ratio = remaining / total_allocated if total_allocated else 0
            rows.append({
                "key": "%s-%s" % (employee_id, type_id),
                "employee_id": employee_id, "employee_name": employee.name,
                "employee_code": self._employee_code(employee),
                "employee_number": employee.employee_number or "",
                "identification_id": self._employee_identification(employee),
                "avatar_url": "/web/image/hr.employee/%s/image_128" % employee_id,
                "department_id": employee.department_id.id or False,
                "department": employee.department_id.name or _("No Department"),
                "grade_id": employee.grade_id.id if employee.grade_id else False,
                "grade": employee.grade_id.name if employee.grade_id else "",
                "location_id": employee.work_location_id.id if employee.work_location_id else False,
                "location": employee.work_location_id.name if employee.work_location_id else "",
                "leave_type_id": type_id, "leave_type": leave_type.name,
                "color_hex": leave_type.cleon_color_hex or "#64748B",
                "allocated": total_allocated, "used": total_used, "pending": total_pending,
                "remaining": remaining, "projected": round(remaining - total_pending, 2),
                "carried_forward": round(carried[(employee_id, type_id)], 2),
                "expiring_days": round(expiring[(employee_id, type_id)], 2),
                "expiry_date": fields.Date.to_string(expiry_dates.get((employee_id, type_id))) if expiry_dates.get((employee_id, type_id)) else "",
                "expiry_countdown": (expiry_dates[(employee_id, type_id)] - fields.Date.context_today(self)).days if expiry_dates.get((employee_id, type_id)) else False,
                "last_updated": fields.Date.to_string(updated[(employee_id, type_id)].date()) if updated.get((employee_id, type_id)) else "",
                "health": "green" if health_ratio >= .5 else ("amber" if health_ratio >= .25 else "red"),
            })

        search = (filters.get("search") or "").strip().lower()
        employee_search = (filters.get("employee_search") or "").strip().lower()
        department_ids = {int(x) for x in filters.get("department_ids", [])}
        location_ids = {int(x) for x in filters.get("location_ids", [])}
        type_ids = {int(x) for x in filters.get("leave_type_ids", [])}
        policy_ids = {int(x) for x in filters.get("policy_ids", [])}
        if search:
            rows = [r for r in rows if search in r["employee_name"].lower() or search in r["employee_code"].lower() or search in (r.get("identification_id") or "").lower()]
        if employee_search:
            rows = [r for r in rows if employee_search in r["employee_name"].lower() or employee_search in r["employee_code"].lower() or employee_search in (r.get("identification_id") or "").lower()]
        if department_ids:
            rows = [r for r in rows if r["department_id"] in department_ids]
        if location_ids:
            rows = [r for r in rows if r["location_id"] in location_ids]
        if type_ids:
            rows = [r for r in rows if r["leave_type_id"] in type_ids]
        if policy_ids:
            rows = [r for r in rows if r["leave_type_id"] in policy_ids]
        quick_type_id = filters.get("quick_leave_type_id")
        if quick_type_id:
            rows = [r for r in rows if r["leave_type_id"] == int(quick_type_id)]
        if filters.get("expiring_only"):
            rows = [r for r in rows if r["expiring_days"] > 0]

        sort = sort or {"field": "employee_name", "direction": "asc"}
        allowed_sort = {"employee_name", "department", "used", "remaining", "last_updated"}
        sort_field = sort.get("field") if sort.get("field") in allowed_sort else "employee_name"
        if sort_field in ("used", "remaining"):
            sort_key = lambda row: float(row.get(sort_field) or 0.0)
        else:
            sort_key = lambda row: (row.get(sort_field) or "").lower()
        rows.sort(key=sort_key, reverse=sort.get("direction") == "desc")
        unique_employees = {r["employee_id"] for r in rows}
        kpis = {
            "total_employees": len(unique_employees),
            "allocated": round(sum(r["allocated"] for r in rows), 2),
            "used": round(sum(r["used"] for r in rows), 2),
            "remaining": round(sum(r["remaining"] for r in rows), 2),
            "negative_employees": len({r["employee_id"] for r in rows if r["remaining"] < 0}),
            "expiring_employees": len({r["employee_id"] for r in rows if r["expiring_days"] > 0}),
        }
        today = fields.Date.context_today(self)
        last_month_end = today.replace(day=1) - timedelta(days=1)
        previous = self._kpi_snapshot(last_month_end, employees.ids, leave_types.ids)
        kpis.update({
            "total_employees_trend_pct": self._pct_change(kpis["total_employees"], previous["total_employees"]),
            "allocated_trend_pct": self._pct_change(kpis["allocated"], previous["allocated"]),
            "used_trend_pct": self._pct_change(kpis["used"], previous["used"]),
            "remaining_trend_pct": self._pct_change(kpis["remaining"], previous["remaining"]),
            "negative_employees_trend": kpis["negative_employees"] - previous["negative_employees"],
        })
        group_by = group_by if group_by in ("employee", "leave_type", "none") else "employee"
        groups = self._group_balance_rows(rows, group_by, sort) if group_by != "none" else []
        pagination = pagination or {}
        page_size = int(pagination.get("page_size", 10) or 0)
        page_size = 0 if page_size == 0 else min(max(page_size, 10), 100)
        page = max(int(pagination.get("page", 1) or 1), 1)
        source = groups if group_by != "none" else rows
        total_items = len(source)
        total_pages = max((total_items + page_size - 1) // page_size, 1) if page_size else 1
        page = min(page, total_pages)
        if page_size:
            page_source = source[(page - 1) * page_size:page * page_size]
        else:
            page_source = source
        page_groups = page_source if group_by != "none" else []
        return {
            # Group children already live inside ``groups``; avoid serialising
            # the same rows twice in grouped mode.
            "rows": page_source if group_by == "none" else [],
            "groups": page_groups, "kpis": kpis,
            "pagination": {
                "page": page, "page_size": page_size or total_items or 10,
                "total_items": total_items, "total_pages": total_pages,
                "item_label": _("groups") if group_by != "none" else _("records"),
            },
            "departments": [{"id": d.id, "name": d.name} for d in employees.mapped("department_id").sorted("name")],
            "locations": [{"id": l.id, "name": l.name} for l in employees.mapped("work_location_id").sorted("name")],
            "grades": [{"id": g.id, "name": g.name} for g in employees.mapped("grade_id").sorted("name")],
            "leave_types": [{"id": t.id, "name": t.name, "color_hex": t.cleon_color_hex or "#64748B"} for t in leave_types],
        }

    @api.model
    def _group_balance_rows(self, rows, group_by, sort):
        groups = []
        group_map = {}
        for row in rows:
            if group_by == "employee":
                key = "emp_%s" % row["employee_id"]
                meta = {
                    "type": "employee", "id": row["employee_id"],
                    "name": row["employee_name"], "code": row["employee_code"],
                    "employee_number": row.get("employee_number") or "",
                    "identification_id": row.get("identification_id") or "",
                    "avatar_url": row["avatar_url"], "department": row["department"],
                }
            else:
                key = "lt_%s" % row["leave_type_id"]
                meta = {
                    "type": "leave_type", "id": row["leave_type_id"],
                    "name": row["leave_type"], "color_hex": row["color_hex"],
                }
            if key not in group_map:
                group = {
                    "key": key, "meta": meta, "rows": [],
                    "totals": {
                        "allocated": 0.0, "used": 0.0, "pending": 0.0,
                        "remaining": 0.0, "carried_forward": 0.0,
                        "expiry_countdown": False, "last_updated": "",
                    },
                }
                group_map[key] = group
                groups.append(group)
            group = group_map[key]
            group["rows"].append(row)
            for field_name in ("allocated", "used", "pending", "remaining", "carried_forward"):
                group["totals"][field_name] = round(
                    group["totals"][field_name] + float(row.get(field_name) or 0.0), 2,
                )
            countdown = row.get("expiry_countdown")
            current = group["totals"]["expiry_countdown"]
            if countdown is not False and (current is False or countdown < current):
                group["totals"]["expiry_countdown"] = countdown
            if row.get("last_updated", "") > group["totals"]["last_updated"]:
                group["totals"]["last_updated"] = row["last_updated"]
        for group in groups:
            allocated_days = group["totals"]["allocated"]
            ratio = group["totals"]["remaining"] / allocated_days if allocated_days else 0
            group["health"] = "green" if ratio >= .5 else ("amber" if ratio >= .25 else "red")
        sort_field = (sort or {}).get("field", "employee_name")
        reverse = (sort or {}).get("direction") == "desc"
        if sort_field in ("used", "remaining"):
            groups.sort(
                key=lambda group: group["totals"].get(sort_field) or 0,
                reverse=reverse,
            )
        elif sort_field == "last_updated":
            groups.sort(
                key=lambda group: group["totals"].get("last_updated") or "",
                reverse=reverse,
            )
        elif group_by == "employee" and sort_field == "department":
            groups.sort(key=lambda group: group["meta"]["department"].lower(), reverse=reverse)
        else:
            groups.sort(key=lambda group: group["meta"]["name"].lower(), reverse=reverse)
        return groups

    @api.model
    def get_balance_employee_options(self):
        """Load allocation candidates on demand instead of with every balance page."""
        self._check_balance_admin()
        employees = self.env["hr.employee"].search([
            ("company_id", "in", self.env.companies.ids), ("active", "=", True),
        ], order="name, id")
        return [{
            "employee_id": employee.id,
            "employee_name": employee.name,
            "employee_code": self._employee_code(employee),
            "employee_number": employee.employee_number or "",
            "identification_id": self._employee_identification(employee),
            "avatar_url": "/web/image/hr.employee/%s/image_128" % employee.id,
            "department_id": employee.department_id.id or False,
            "department": employee.department_id.name or _("No Department"),
            "grade_id": employee.grade_id.id if employee.grade_id else False,
            "grade": employee.grade_id.name if employee.grade_id else "",
        } for employee in employees]

    @api.model
    def _current_balance(self, employee_id, leave_type_id):
        allocated, used, _pending, _carried, _expiring, _dates, _updated = self._balance_maps([employee_id], [leave_type_id])
        return round(allocated[(employee_id, leave_type_id)] - used[(employee_id, leave_type_id)], 2)

    @api.model
    def apply_leave_allocation(self, employee_ids, leave_type_id, amount, reason, effective_date, notes=""):
        self._check_balance_admin()
        employee_ids = [int(x) for x in employee_ids]
        amount = float(amount)
        reason = (reason or "").strip()
        if not employee_ids or amount <= 0 or not reason:
            raise ValidationError(_("Employees, a positive allocation amount, and a reason are required."))
        leave_type = self.env["hr.leave.type"].browse(int(leave_type_id)).exists()
        employees = self.env["hr.employee"].browse(employee_ids).exists().filtered(lambda e: e.company_id in self.env.companies)
        if not leave_type or len(employees) != len(set(employee_ids)):
            raise ValidationError(_("Invalid employee or leave type selection."))
        eligible = leave_type._get_eligible_employees()
        ineligible = employees - eligible
        if ineligible:
            raise ValidationError(_("These employees are not eligible for %s: %s") % (leave_type.name, ", ".join(ineligible.mapped("name"))))
        expiry = fields.Date.end_of(fields.Date.from_string(effective_date), "year")
        for employee in employees:
            allocation = self.env["hr.leave.allocation"].create({
                "private_name": reason, "holiday_type": "employee",
                "employee_id": employee.id, "holiday_status_id": leave_type.id,
                "number_of_days": amount, "date_from": effective_date, "date_to": expiry,
                "notes": notes or reason,
            })
            if allocation.state != "validate":
                allocation.action_validate()
            balance = self._current_balance(employee.id, leave_type.id)
            self._record_transaction({
                "employee_id": employee.id, "leave_type_id": leave_type.id,
                "transaction_type": "allocation", "effective_date": effective_date,
                "delta": amount, "balance_after": balance, "allocation_id": allocation.id,
                "reason": reason, "expiry_date": expiry,
            })
            self.env["hr.leave.audit.log"].sudo().create({
                "action": "balance_allocation", "actor_id": self.env.user.id,
                "actor_label": self.env.user.name, "actor_role": "Time Off Administrator",
                "employee_id": employee.id, "leave_type_id": leave_type.id,
                "duration": amount,
                "note": _("Allocated %(days).2f days. Reason: %(reason)s", days=amount, reason=reason),
            })
        return {"count": len(employees)}

    @api.model
    def apply_balance_adjustments(self, employee_id, adjustments, reason):
        self._check_balance_admin()
        employee = self.env["hr.employee"].browse(int(employee_id)).exists()
        reason = (reason or "").strip()
        if not employee or employee.company_id not in self.env.companies or not reason:
            raise ValidationError(_("A valid employee and adjustment reason are required."))
        applied = 0
        today = fields.Date.context_today(self)
        for item in adjustments or []:
            delta = float(item.get("adjustment") or 0)
            if not delta:
                continue
            leave_type = self.env["hr.leave.type"].browse(int(item.get("leave_type_id"))).exists()
            if not leave_type:
                raise ValidationError(_("Invalid Leave Type in adjustment."))
            old_balance = self._current_balance(employee.id, leave_type.id)
            if delta > 0:
                expiry = fields.Date.end_of(today, "year")
                allocation = self.env["hr.leave.allocation"].create({
                    "private_name": reason, "holiday_type": "employee",
                    "employee_id": employee.id, "holiday_status_id": leave_type.id,
                    "number_of_days": delta, "date_from": today, "date_to": expiry,
                    "notes": reason,
                })
                if allocation.state != "validate":
                    allocation.action_validate()
            else:
                remove_days = abs(delta)
                allocated, used, _pending, _carried, _expiring, _dates, _updated = self._balance_maps([employee.id], [leave_type.id])
                total_allocated = allocated[(employee.id, leave_type.id)]
                total_used = used[(employee.id, leave_type.id)]
                if total_allocated - remove_days < total_used:
                    raise ValidationError(
                        _("Cannot subtract %.2f days from %s: %.2f days are already consumed.")
                        % (remove_days, leave_type.name, total_used)
                    )
                allocations = self.env["hr.leave.allocation"].search([
                    ("employee_id", "=", employee.id), ("holiday_status_id", "=", leave_type.id),
                    ("state", "=", "validate"), ("allocation_type", "=", "regular"),
                ], order="date_to desc, id desc")
                remaining_to_remove = remove_days
                for allocation in allocations:
                    if remaining_to_remove <= 0:
                        break
                    current = allocation.number_of_days
                    if current > remaining_to_remove:
                        allocation.write({"number_of_days": current - remaining_to_remove})
                        remaining_to_remove = 0
                    else:
                        remaining_to_remove -= current
                        allocation.action_refuse()
                if remaining_to_remove > .0001:
                    raise ValidationError(_("There is not enough adjustable entitlement for %s.") % leave_type.name)
                allocation = False
            new_balance = self._current_balance(employee.id, leave_type.id)
            transaction = self._record_transaction({
                "employee_id": employee.id, "leave_type_id": leave_type.id,
                "transaction_type": "adjustment", "effective_date": today,
                "delta": delta, "balance_after": new_balance,
                "allocation_id": allocation.id if allocation else False, "reason": reason,
            })
            self.env["hr.leave.audit.log"].sudo().create({
                "action": "balance_adjustment", "actor_id": self.env.user.id,
                "actor_label": self.env.user.name, "actor_role": "Time Off Administrator",
                "employee_id": employee.id, "leave_type_id": leave_type.id,
                "duration": delta,
                "note": _("Balance adjusted from %(old).2f by %(delta)+.2f to %(new).2f. Reason: %(reason)s",
                          old=old_balance, delta=delta, new=new_balance, reason=reason),
            })
            applied += 1
        if not applied:
            raise ValidationError(_("Enter at least one non-zero adjustment."))
        return {"count": applied}

    @api.model
    def get_balance_details(self, employee_id, leave_type_id):
        self._check_balance_admin()
        page = self.get_balance_page_data()
        row = next((r for r in page["rows"] if r["employee_id"] == int(employee_id) and r["leave_type_id"] == int(leave_type_id)), None)
        if not row:
            raise ValidationError(_("Balance record not found."))
        allocations = self.env["hr.leave.allocation"].search([
            ("employee_id", "=", int(employee_id)), ("holiday_status_id", "=", int(leave_type_id)),
            ("state", "=", "validate"),
        ], order="write_date desc")
        transactions = self.search([
            ("employee_id", "=", int(employee_id)), ("leave_type_id", "=", int(leave_type_id)),
        ], limit=100)
        row.update({
            "assigned_policy": row["leave_type"],
            "accrual_plan": allocations.filtered("accrual_plan_id")[:1].accrual_plan_id.name or _("Manual Allocation"),
            "last_accrual_date": fields.Date.to_string(allocations.filtered("lastcall")[:1].lastcall) if allocations.filtered("lastcall") else "",
            "next_accrual_date": fields.Date.to_string(allocations.filtered("nextcall")[:1].nextcall) if allocations.filtered("nextcall") else "",
            "transactions": [{
                "id": tx.id, "type": tx.transaction_type,
                "label": dict(self._fields["transaction_type"].selection).get(tx.transaction_type),
                "date": fields.Date.to_string(tx.effective_date), "delta": tx.delta,
                "balance_after": tx.balance_after, "reason": tx.reason,
                "leave_id": tx.leave_id.id or False,
                "request_ref": tx.leave_id.request_ref if tx.leave_id else "",
            } for tx in transactions],
        })
        return row

    @api.model
    def get_employee_leave_history(self, employee_id):
        self._check_balance_admin()
        employee = self.env["hr.employee"].browse(int(employee_id)).exists()
        if not employee or employee.company_id not in self.env.companies:
            raise ValidationError(_("Employee not found."))
        leaves = self.env["hr.leave"].search([("employee_id", "=", employee.id)], order="create_date desc")
        status_map = {"validate": "approved", "confirm": "pending", "validate1": "pending", "refuse": "rejected"}
        requests = []
        for leave in leaves:
            status = "cancelled" if leave.is_cancelled else status_map.get(leave.state, leave.state)
            requests.append({
                "id": leave.id, "reference": leave.request_ref or "LR-%06d" % leave.id,
                "leave_type": leave.holiday_status_id.name,
                "color_hex": leave.holiday_status_id.cleon_color_hex or "#64748B",
                "reason": leave.notes or leave.admin_creation_note or "",
                "date_from": fields.Date.to_string(leave.request_date_from),
                "date_to": fields.Date.to_string(leave.request_date_to),
                "duration": round(leave.number_of_days, 2), "status": status,
                "applied_on": fields.Date.to_string(leave.create_date.date()) if leave.create_date else "",
                "approved_by": leave.write_uid.name if status == "approved" else "",
                "approved_on": fields.Date.to_string(leave.write_date.date()) if status == "approved" and leave.write_date else "",
            })
        return {
            "employee": {
                "id": employee.id,
                "name": employee.name,
                "code": self._employee_code(employee),
                "employee_code": self._employee_code(employee),
                "employee_number": employee.employee_number or "",
                "identification_id": self._employee_identification(employee),
                "department": employee.department_id.name or _("No Department"),
                "avatar_url": "/web/image/hr.employee/%s/image_128" % employee.id,
            },
            "requests": requests,
            "summary": {
                "approved": len([r for r in requests if r["status"] == "approved"]),
                "approved_days": round(sum(r["duration"] for r in requests if r["status"] == "approved"), 2),
                "pending": len([r for r in requests if r["status"] == "pending"]),
                "rejected": len([r for r in requests if r["status"] == "rejected"]),
                "total": len(requests),
            },
        }

    # FR-252: Bulk page-level actions

    @api.model
    def bulk_year_end_reset(self):
        """Mark expired allocations and reset consumed records for year-end.

        This closes all validated leave allocations whose date_to is before
        today and whose number_of_days is still positive, by setting them to
        their consumed amount only (so the "remaining" balance becomes 0).
        It does NOT delete or refuse the underlying leave requests.
        Returns the count of employees affected.
        """
        self._check_balance_admin()
        today = fields.Date.context_today(self)
        # Find all expired active allocations still carrying a balance
        expired = self.env["hr.leave.allocation"].search([
            ("state", "=", "validate"),
            ("date_to", "<", today),
            ("date_to", "!=", False),
            ("number_of_days", ">", 0),
            ("company_id", "in", self.env.companies.ids),
        ])
        affected_employees = set()
        for alloc in expired:
            # Only expire if there is remaining balance (allocated > used)
            used = self.env["hr.leave"].search_count([
                ("employee_id", "=", alloc.employee_id.id),
                ("holiday_status_id", "=", alloc.holiday_status_id.id),
                ("state", "=", "validate"),
            ])
            if alloc.number_of_days > 0:
                affected_employees.add(alloc.employee_id.id)
                # Log an audit event
                self.env["hr.leave.audit.log"].sudo().create({
                    "action": "policy_change",
                    "leave_type_id": alloc.holiday_status_id.id,
                    "description": _("Year-end reset: allocation '%s' expired (%.2f days) for %s.") % (
                        alloc.private_name or alloc.name or "allocation",
                        alloc.number_of_days,
                        alloc.employee_id.name,
                    ),
                    "actor_id": self.env.user.id,
                    "actor_role": "HR Manager" if self.env.user.has_group("hr_holidays.group_hr_holidays_manager") else "HR Officer",
                })
        return {"count": len(affected_employees)}

    @api.model
    def bulk_carry_forward(self):
        """Process carry-forward for all employees with a remaining balance.

        For each (employee, leave_type) pair where the leave type allows carry
        forward (``allow_carryover`` = True on hr.leave.type) and the
        remaining balance > 0, create a new validated allocation dated from
        today to end of current year representing the carried-over balance.
        Returns the count of employees processed.
        """
        self._check_balance_admin()
        today = fields.Date.context_today(self)
        year_end = fields.Date.end_of(today, "year")

        # Leave types that allow carry-forward
        carry_types = self.env["hr.leave.type"].search([
            ("active", "=", True),
            ("allow_carryover", "=", True),
            ("company_id", "in", self.env.companies.ids),
        ])
        if not carry_types:
            return {"count": 0}

        employees = self.env["hr.employee"].search([
            ("active", "=", True),
            ("company_id", "in", self.env.companies.ids),
        ])
        if not employees:
            return {"count": 0}

        allocated, used, _pending, _carried, _expiring, _dates, _updated = self._balance_maps(
            employees.ids, carry_types.ids
        )
        affected = set()
        for emp in employees:
            for lt in carry_types:
                key = (emp.id, lt.id)
                remaining = allocated.get(key, 0.0) - used.get(key, 0.0)
                cap = lt.max_carryover_days or 0.0
                carry_amount = min(remaining, cap) if cap else remaining
                if carry_amount <= 0:
                    continue
                allocation = self.env["hr.leave.allocation"].create({
                    "private_name": _("Carry-forward %s") % today.year,
                    "holiday_type": "employee",
                    "employee_id": emp.id,
                    "holiday_status_id": lt.id,
                    "number_of_days": round(carry_amount, 2),
                    "date_from": today,
                    "date_to": (
                        today + timedelta(days=90)
                        if lt.carryover_expiry_rule == "three_months"
                        else today + timedelta(days=180)
                        if lt.carryover_expiry_rule == "six_months"
                        else fields.Date.end_of(today + timedelta(days=366), "year")
                        if lt.carryover_expiry_rule == "end_next_year"
                        else False
                    ),
                    "notes": _("Automatic carry-forward processed on %s") % fields.Date.to_string(today),
                })
                if allocation.state != "validate":
                    allocation.action_validate()
                affected.add(emp.id)
                self.env["hr.leave.audit.log"].sudo().create({
                    "action": "policy_change",
                    "leave_type_id": lt.id,
                    "description": _("Carry-forward: %.2f days carried to %s for %s.") % (
                        carry_amount, today.year, emp.name,
                    ),
                    "actor_id": self.env.user.id,
                    "actor_role": "HR Manager" if self.env.user.has_group("hr_holidays.group_hr_holidays_manager") else "HR Officer",
                })
        return {"count": len(affected)}
