# -*- coding: utf-8 -*-
from collections import defaultdict
from datetime import timedelta

from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError


class HrLeaveReportService(models.AbstractModel):
    _name = "hr.leave.report.service"
    _description = "CleonHR Leave Reports Service"

    @api.model
    def _check_access(self):
        if not (self.env.user.has_group("base.group_system") or self.env.user.has_group("hr_holidays.group_hr_holidays_manager")):
            raise AccessError(_("Only a Time Off Administrator can access leave reports."))

    @api.model
    def _date_range(self, preset, start_date=None, end_date=None):
        today = fields.Date.context_today(self)
        if preset == "today":
            start, end = today, today
        elif preset == "this_week":
            start, end = today - timedelta(days=today.weekday()), today + timedelta(days=6 - today.weekday())
        elif preset == "this_month":
            start, end = today.replace(day=1), today + relativedelta(months=1, day=1, days=-1)
        elif preset == "last_month":
            end = today.replace(day=1) - timedelta(days=1); start = end.replace(day=1)
        elif preset == "this_quarter":
            start = today.replace(month=((today.month - 1) // 3) * 3 + 1, day=1); end = start + relativedelta(months=3, days=-1)
        elif preset == "custom" and start_date and end_date:
            start, end = fields.Date.from_string(start_date), fields.Date.from_string(end_date)
        else:
            start, end = today.replace(month=1, day=1), today.replace(month=12, day=31)
        return start, end

    @api.model
    def get_report_data(self, filters=None):
        self._check_access()
        filters = filters or {}
        start, end = self._date_range(filters.get("date_range", "this_year"), filters.get("start_date"), filters.get("end_date"))
        domain = [
            ("employee_id.company_id", "in", self.env.companies.ids),
            ("request_date_from", "<=", end), ("request_date_to", ">=", start),
        ]
        if filters.get("department_id"):
            domain.append(("employee_id.department_id", "=", int(filters["department_id"])))
        if filters.get("leave_type_id"):
            domain.append(("holiday_status_id", "=", int(filters["leave_type_id"])))
        leaves = self.env["hr.leave"].search(domain, order="request_date_from, id")
        status = lambda leave: "cancelled" if leave.is_cancelled else ("approved" if leave.state == "validate" else "pending" if leave.state in ("confirm", "validate1") else "rejected" if leave.state == "refuse" else "cancelled")
        counts = defaultdict(int); days = defaultdict(float); by_type = defaultdict(float); by_department = defaultdict(lambda: defaultdict(float)); by_employee = defaultdict(lambda: defaultdict(float))
        month_cursor = start.replace(day=1); months = []
        while month_cursor <= end:
            months.append(month_cursor); month_cursor += relativedelta(months=1)
        monthly = {month: defaultdict(int) for month in months}
        for leave in leaves:
            state = status(leave); duration = leave.number_of_days or 0
            counts[state] += 1; days[state] += duration
            by_type[leave.holiday_status_id] += duration
            by_department[leave.employee_id.department_id][state] += 1
            by_department[leave.employee_id.department_id]["days"] += duration
            by_employee[leave.employee_id][state] += duration
            by_employee[leave.employee_id][state + "_requests"] += 1
            month = (leave.request_date_from or start).replace(day=1)
            if month in monthly:
                monthly[month][state] += 1
        total = len(leaves); total_days = round(sum(leaves.mapped("number_of_days")), 2)
        types = self.env["hr.leave.type"].with_context(active_test=False).search([("company_id", "in", [False] + self.env.companies.ids)], order="name")
        if filters.get("leave_type_id"):
            types = types.filtered(lambda leave_type: leave_type.id == int(filters["leave_type_id"]))
        departments = self.env["hr.department"].search([("company_id", "in", self.env.companies.ids)], order="name")
        palette = ["#3b82f6", "#ef4444", "#ec4899", "#14b8a6", "#f59e0b", "#10b981", "#8b5cf6", "#64748b"]
        type_usage = []
        category_labels = dict(self.env["hr.leave.type"]._fields["cleon_category"].selection)
        scoped_employee_ids = set(self.env["hr.employee"].search([
            ("active", "=", True), ("company_id", "in", self.env.companies.ids),
            *(([("department_id", "=", int(filters["department_id"]))]) if filters.get("department_id") else []),
        ]).ids)
        for index, leave_type in enumerate(types):
            type_leaves = leaves.filtered(lambda leave, selected_type=leave_type: leave.holiday_status_id == selected_type)
            type_counts = defaultdict(int)
            for leave in type_leaves:
                type_counts[status(leave)] += 1
            approved_leaves = type_leaves.filtered(lambda leave: status(leave) == "approved")
            days_taken = round(sum(approved_leaves.mapped("number_of_days")), 2)
            eligible_ids = set(leave_type._get_eligible_employees().ids) & scoped_employee_ids
            type_usage.append({
                "id": leave_type.id, "rank": 0, "name": leave_type.name,
                "color": leave_type.cleon_color_hex or palette[index % len(palette)],
                "category": leave_type.cleon_category or "paid",
                "category_label": category_labels.get(leave_type.cleon_category, _("Paid")),
                "entitlement": _("Unlimited") if leave_type.unlimited_entitlement else _("%s days") % ("%g" % leave_type.max_entitlement),
                "employees": len(eligible_ids), "requests": len(type_leaves),
                "approved": type_counts["approved"], "pending": type_counts["pending"],
                "rejected": type_counts["rejected"], "cancelled": type_counts["cancelled"],
                "days_taken": days_taken,
                "average_days": round(days_taken / len(approved_leaves), 1) if approved_leaves else 0,
            })
        type_usage.sort(key=lambda row: (-row["days_taken"], row["name"]))
        total_approved_days = sum(row["days_taken"] for row in type_usage)
        for rank, row in enumerate(type_usage, 1):
            row["rank"] = rank
            row["share"] = round(row["days_taken"] * 100 / total_approved_days, 1) if total_approved_days else 0
        type_totals = {
            key: round(sum(row[key] for row in type_usage), 2)
            for key in ("employees", "requests", "approved", "pending", "rejected", "cancelled", "days_taken")
        }
        most_used = type_usage[0] if type_usage and type_usage[0]["days_taken"] else False
        allocation_domain = [
            ("state", "=", "validate"), ("employee_id.company_id", "in", self.env.companies.ids),
            ("date_from", "<=", end), "|", ("date_to", "=", False), ("date_to", ">=", start),
        ]
        if filters.get("department_id"):
            allocation_domain.append(("employee_id.department_id", "=", int(filters["department_id"])))
        if filters.get("leave_type_id"):
            allocation_domain.append(("holiday_status_id", "=", int(filters["leave_type_id"])))
        allocated_days = round(sum(self.env["hr.leave.allocation"].search(allocation_domain).mapped("number_of_days")), 2)
        used_days = round(days["approved"], 2); pending_days = round(days["pending"], 2)
        remaining_days = round(allocated_days - used_days, 2)
        balance_values = {"allocated": allocated_days, "used": used_days, "pending": pending_days, "remaining": remaining_days}
        balance_rows = []
        for key, label, color in (("allocated", _("Total Allocated"), "#172033"), ("used", _("Used"), "#3b82f6"), ("pending", _("Pending"), "#f59e0b"), ("remaining", _("Remaining"), "#10b981")):
            value = balance_values[key]
            balance_rows.append({"key": key, "label": label, "days": value, "percentage": round(value * 100 / allocated_days, 1) if allocated_days else 0, "color": color})
        return {
            "period": {"start": fields.Date.to_string(start), "end": fields.Date.to_string(end)},
            "kpis": {"total": total, "approved": counts["approved"], "pending": counts["pending"], "total_days": total_days, "approval_rate": round(counts["approved"] * 100 / total, 1) if total else 0, "average_days": round(total_days / total, 1) if total else 0},
            "status": {key: counts[key] for key in ("approved", "pending", "rejected", "cancelled")},
            "by_type": [{"id": leave_type.id, "name": leave_type.name, "days": round(by_type[leave_type], 2), "color": leave_type.cleon_color_hex or palette[index % len(palette)]} for index, leave_type in enumerate(types) if by_type[leave_type]],
            "monthly": {"labels": [month.strftime("%b %Y") for month in months], **{key: [monthly[month][key] for month in months] for key in ("approved", "pending", "rejected")}},
            "leave_type_summary": [{"name": leave_type.name, "requests": len(leaves.filtered(lambda leave, lt=leave_type: leave.holiday_status_id == lt)), "days": round(by_type[leave_type], 2), "color": leave_type.cleon_color_hex or palette[index % len(palette)]} for index, leave_type in enumerate(types) if by_type[leave_type]],
            "type_usage": type_usage, "type_totals": type_totals,
            "type_kpis": {"active_types": len(types.filtered("active")), "total_requests": len(leaves), "days_taken": round(total_approved_days, 2), "most_used_name": most_used["name"] if most_used else _("None"), "most_used_days": most_used["days_taken"] if most_used else 0, "most_used_employees": most_used["employees"] if most_used else 0},
            "department_summary": [{"id": department.id, "name": department.name, "total": int(by_department[department]["approved"] + by_department[department]["pending"] + by_department[department]["rejected"] + by_department[department]["cancelled"]), "days": round(by_department[department]["days"], 2), "average_days": round(by_department[department]["days"] / (by_department[department]["approved"] + by_department[department]["pending"] + by_department[department]["rejected"] + by_department[department]["cancelled"]), 1) if (by_department[department]["approved"] + by_department[department]["pending"] + by_department[department]["rejected"] + by_department[department]["cancelled"]) else 0, "approved": int(by_department[department]["approved"]), "pending": int(by_department[department]["pending"]), "rejected": int(by_department[department]["rejected"])} for department in departments if by_department[department]],
            "balance": {**balance_values, "utilisation": round(used_days * 100 / allocated_days, 1) if allocated_days else 0, "rows": balance_rows},
            "employee_summary": self._employee_summary_rows(by_employee),
            "departments": [{"id": department.id, "name": department.name} for department in departments],
            "leave_types": [{"id": leave_type.id, "name": leave_type.name} for leave_type in types],
        }

    @api.model
    def _employee_summary_rows(self, by_employee):
        rows = []
        for employee, values in by_employee.items():
            approved_days = round(values["approved"], 2)
            approved_requests = int(values["approved_requests"])
            if not approved_days:
                continue
            rows.append({
                "id": employee.id, "name": employee.name,
                "code": employee.employee_number or "EMP-%03d" % employee.id,
                "department": employee.department_id.name or _("No Department"),
                "avatar_url": "/web/image/hr.employee/%s/image_128" % employee.id,
                "total_days": approved_days, "requests": approved_requests,
                "average_days": round(approved_days / approved_requests, 1) if approved_requests else 0,
            })
        rows.sort(key=lambda row: (-row["total_days"], -row["requests"], row["name"]))
        top_rows = rows[:10]
        maximum = top_rows[0]["total_days"] if top_rows else 0
        for rank, row in enumerate(top_rows, 1):
            row["rank"] = rank
            ratio = row["total_days"] / maximum if maximum else 0
            row["volume"] = "high" if ratio >= .67 else ("medium" if ratio >= .34 else "low")
        return top_rows
