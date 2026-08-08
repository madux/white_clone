# -*- coding: utf-8 -*-
from collections import OrderedDict
from dateutil.relativedelta import relativedelta
from odoo import models, fields, api, _
from odoo.exceptions import AccessError
import logging

_logger = logging.getLogger(__name__)


class HrLeave(models.Model):
    _inherit = "hr.leave"

    @api.model
    def _check_leave_dashboard_access(self):
        if not (
            self.env.user.has_group("base.group_system")
            or self.env.user.has_group("hr_holidays.group_hr_holidays_manager")
        ):
            raise AccessError(_("Only a Time Off Administrator can access this dashboard."))

    @api.model
    def _get_company_employee_ids(self):
        return self.env["hr.employee"].search([
            ("active", "=", True),
            ("company_id", "=", self.env.company.id),
        ]).ids

    @api.model
    def get_dashboard_data(self, months=6):
        self._check_leave_dashboard_access()

        months = int(months) if months in (6, 12) else 6
        emp_ids = self._get_company_employee_ids()
        coverage = self._get_department_coverage(emp_ids)

        return {
            "kpis": self._get_kpis(emp_ids, coverage_alerts=coverage["alert_count"]),
            "trends": self._get_leave_trends(emp_ids, months),
            "by_type": self._get_leave_type_distribution(emp_ids),
            "balance": self._get_leave_balance_by_type(emp_ids),
            "approval_overview": self._get_approval_overview(emp_ids),
            "department_coverage": coverage["rows"],
            "recent_requests": self._get_recent_requests(emp_ids),
        }

    # ---------------------------------------------------------
    # KPI CARDS — FR-055 to FR-060
    # ---------------------------------------------------------

    @api.model
    def _get_kpis(self, emp_ids, coverage_alerts=0):
        today = fields.Date.context_today(self)

        total_employees = len(emp_ids)

        on_leave_today = self.search_count([
            ("employee_id", "in", emp_ids),
            ("state", "=", "validate"),
            ("request_date_from", "<=", today),
            ("request_date_to", ">=", today),
        ]) if emp_ids else 0

        pending_approvals = self.search_count([
            ("employee_id", "in", emp_ids),
            ("state", "in", ("confirm", "validate1")),
        ]) if emp_ids else 0

        upcoming_7_days = self.search_count([
            ("employee_id", "in", emp_ids),
            ("state", "=", "validate"),
            ("request_date_from", ">", today),
            ("request_date_from", "<=", today + relativedelta(days=7)),
        ]) if emp_ids else 0

        allocations = self.env["hr.leave.allocation"].search([
            ("employee_id", "in", emp_ids),
            ("state", "=", "validate"),
        ]) if emp_ids else self.env["hr.leave.allocation"]

        allocated_days = sum(allocations.mapped("number_of_days"))

        approved_leaves = self.search([
            ("employee_id", "in", emp_ids),
            ("state", "=", "validate"),
        ]) if emp_ids else self.env["hr.leave"]

        used_days = sum(approved_leaves.mapped("number_of_days"))

        utilisation_rate = (
            round((used_days / allocated_days) * 100, 1)
            if allocated_days else 0
        )

        on_leave_pct = (
            round((on_leave_today / total_employees) * 100, 1)
            if total_employees else 0
        )

        return {
            "total_employees": total_employees,
            "on_leave_today": on_leave_today,
            "on_leave_pct": on_leave_pct,
            "pending_approvals": pending_approvals,
            "upcoming_7_days": upcoming_7_days,
            "utilisation_rate": utilisation_rate,
            "coverage_alerts": coverage_alerts,
        }

    # ---------------------------------------------------------
    # LEAVE TRENDS AREA CHART — FR-061 to FR-063
    # ---------------------------------------------------------

    @api.model
    def _get_leave_trends(self, emp_ids, months=6):
        months = int(months) if months in (6, 12) else 6
        today = fields.Date.context_today(self)
        range_start = today.replace(day=1) - relativedelta(months=months - 1)

        buckets = OrderedDict()
        cursor = range_start
        for _ in range(months):
            buckets[cursor.strftime("%Y-%m")] = {
                "label": cursor.strftime("%b"),
                "total": 0, "approved": 0, "pending": 0, "rejected": 0,
            }
            cursor += relativedelta(months=1)

        leaves = self.search([
            ("employee_id", "in", emp_ids),
            ("request_date_from", ">=", range_start),
            ("request_date_from", "<=", today.replace(day=1) + relativedelta(months=1, days=-1)),
        ]) if emp_ids else self.env["hr.leave"]

        for leave in leaves:
            if not leave.request_date_from:
                continue
            key = leave.request_date_from.strftime("%Y-%m")
            if key not in buckets:
                continue
            b = buckets[key]
            b["total"] += 1
            if leave.state == "validate":
                b["approved"] += 1
            elif leave.state in ("confirm", "validate1"):
                b["pending"] += 1
            elif leave.state == "refuse":
                b["rejected"] += 1

        return {
            "labels": [b["label"] for b in buckets.values()],
            "total": [b["total"] for b in buckets.values()],
            "approved": [b["approved"] for b in buckets.values()],
            "pending": [b["pending"] for b in buckets.values()],
            "rejected": [b["rejected"] for b in buckets.values()],
            "summary": {
                "total": sum(b["total"] for b in buckets.values()),
                "approved": sum(b["approved"] for b in buckets.values()),
                "pending": sum(b["pending"] for b in buckets.values()),
                "rejected": sum(b["rejected"] for b in buckets.values()),
            },
        }

    # ---------------------------------------------------------
    # BY LEAVE TYPE DONUT CHART — FR-064
    # ---------------------------------------------------------

    @api.model
    def _get_leave_type_distribution(self, emp_ids):
        if not emp_ids:
            return []
        groups = self.read_group(
            domain=[("employee_id", "in", emp_ids)],
            fields=["id"],
            groupby=["holiday_status_id"],
        )
        total = sum(g["holiday_status_id_count"] for g in groups) or 1
        result = []
        for g in groups:
            if not g["holiday_status_id"]:
                continue
            count = g["holiday_status_id_count"]
            result.append({
                "name": g["holiday_status_id"][1],
                "count": count,
                "percent": round((count / total) * 100),
            })
        result.sort(key=lambda r: r["count"], reverse=True)
        return result

    # ---------------------------------------------------------
    # LEAVE BALANCE BY TYPE — FR-065
    # ---------------------------------------------------------

    @api.model
    def _get_leave_balance_by_type(self, emp_ids):
        if not emp_ids:
            return []
        LeaveType = self.env["hr.leave.type"]
        types = LeaveType.search([])
        result = []
        palette = ["#4e73df", "#e74a3b", "#e91e8c", "#f6a623", "#1cc88a", "#36b9cc", "#6f42c1", "#858796"]
        for index, lt in enumerate(types):
            allocated = sum(self.env["hr.leave.allocation"].search([
                ("employee_id", "in", emp_ids),
                ("holiday_status_id", "=", lt.id),
                ("state", "=", "validate"),
            ]).mapped("number_of_days"))
            used = sum(self.search([
                ("employee_id", "in", emp_ids),
                ("holiday_status_id", "=", lt.id),
                ("state", "=", "validate"),
            ]).mapped("number_of_days"))
            if not allocated and not used:
                continue

            percent = round((used / allocated) * 100) if allocated else 0

            # FR-065 Threshold colour-coding: green (<60%), amber (60-79%), red (>=80%)
            if percent < 60:
                bar_color = "#10b981"  # green
            elif percent < 80:
                bar_color = "#f59e0b"  # amber
            else:
                bar_color = "#ef4444"  # red

            result.append({
                "name": lt.name,
                "type_color": palette[index % len(palette)],
                "bar_color": bar_color,
                "used": round(used, 1),
                "allocated": round(allocated, 1),
                "percent": min(100, max(0, percent)),
            })
        return result

    # ---------------------------------------------------------
    # APPROVAL OVERVIEW — FR-066
    # ---------------------------------------------------------

    @api.model
    def _get_approval_overview(self, emp_ids):
        if not emp_ids:
            return {"approved": 0, "pending": 0, "rejected": 0, "approval_rate": 0}
        approved = self.search_count([("employee_id", "in", emp_ids), ("state", "=", "validate")])
        pending = self.search_count([("employee_id", "in", emp_ids), ("state", "in", ("confirm", "validate1"))])
        rejected = self.search_count([("employee_id", "in", emp_ids), ("state", "=", "refuse")])
        total = approved + pending + rejected
        rate = round((approved / total) * 100) if total else 0
        return {
            "approved": approved,
            "pending": pending,
            "rejected": rejected,
            "approval_rate": rate,
        }

    # ---------------------------------------------------------
    # DEPARTMENT COVERAGE HEATMAP — FR-067
    # ---------------------------------------------------------

    @api.model
    def _get_department_coverage(self, emp_ids):
        if not emp_ids:
            return {"rows": [], "alert_count": 0}

        company = self.env.company
        today = fields.Date.context_today(self)

        monday = today - relativedelta(days=today.weekday())
        work_days = [monday + relativedelta(days=i) for i in range(5)]

        employees = self.env["hr.employee"].browse(emp_ids).filtered(lambda e: e.department_id)
        departments = employees.mapped("department_id")

        approved_leaves = self.search([
            ("employee_id", "in", emp_ids),
            ("state", "=", "validate"),
            ("request_date_from", "<=", work_days[-1]),
            ("request_date_to", ">=", work_days[0]),
        ])

        away_by_day = {}
        for day in work_days:
            away_by_day[day] = set(
                approved_leaves.filtered(
                    lambda l: l.request_date_from and l.request_date_to and l.request_date_from <= day <= l.request_date_to
                ).mapped("employee_id").ids
            )

        rows = []
        alert_count = 0

        for department in departments.sorted("name"):
            dept_emp_ids = set(
                employees.filtered(lambda e: e.department_id == department).ids
            )
            total = len(dept_emp_ids)
            values = []

            for day in work_days:
                away = len(dept_emp_ids & away_by_day[day])
                coverage = (
                    round(((total - away) / total) * 100)
                    if total else 100
                )
                values.append(coverage)

            if any(val < 70 for val in values):
                alert_count += 1

            # Weekend columns (Sat, Sun) show None
            values.extend([None, None])

            rows.append({
                "department": department.name,
                "values": values,
            })

        return {
            "rows": rows,
            "alert_count": alert_count,
        }

    # ---------------------------------------------------------
    # RECENT REQUESTS — FR-068
    # ---------------------------------------------------------

    @api.model
    def _get_recent_requests(self, emp_ids):
        if not emp_ids:
            return []

        leaves = self.search(
            [
                ("employee_id", "in", emp_ids),
                ("state", "!=", "draft"),
            ],
            order="create_date desc",
            limit=8,
        )

        state_map = {
            "confirm": "pending",
            "validate1": "pending",
            "validate": "approved",
            "refuse": "rejected",
        }

        result = []
        for leave in leaves:
            create_dt = leave.create_date
            submitted = (
                fields.Datetime.context_timestamp(self, create_dt).strftime("%d %b")
                if create_dt else ""
            )
            result.append({
                "id": leave.id,
                "employee": leave.employee_id.name or "",
                "leave_type": leave.holiday_status_id.name or "",
                "duration": round(leave.number_of_days, 1),
                "status": state_map.get(leave.state, "pending"),
                "submitted_date": submitted,
            })

        return result
