# -*- coding: utf-8 -*-
from collections import OrderedDict
from dateutil.relativedelta import relativedelta
from odoo import models, fields, api
from odoo.fields import Date
import logging
_logger = logging.getLogger(__name__)  



class HrLeave(models.Model):
    _inherit = "hr.leave"

    @api.model
    def get_dashboard_data(self, months=6):
        dd = self._get_leave_trends(months)
        _logger.info(f'LIVEING ==> {dd}')
        return {
            "kpis": self._get_kpis(),
            "trends": self._get_leave_trends(months),
            "by_type": self._get_leave_type_distribution(),
            "balance": self._get_leave_balance_by_type(),
            "approval_overview": self._get_approval_overview(),
        }

    # ---------- KPI CARDS ----------
    @api.model
    def _get_kpis(self):
        Employee = self.env['hr.employee']
        today = Date.context_today(self)

        total_employees = Employee.search_count([])

        on_leave_today = self.search_count([
            ('state', '=', 'validate'),
            ('date_from', '<=', today),
            ('date_to', '>=', today),
        ])

        pending_approvals = self.search_count([('state', '=', 'confirm')])

        upcoming = self.search_count([
            ('state', '=', 'validate'),
            ('date_from', '>', today),
            ('date_from', '<=', today + relativedelta(days=7)),
        ])

        # Utilisation rate = used days / allocated days across all allocations
        allocations = self.env['hr.leave.allocation'].search([('state', '=', 'validate')])
        allocated_days = sum(allocations.mapped('number_of_days'))
        used_days = sum(self.search([('state', '=', 'validate')]).mapped('number_of_days'))
        utilisation_rate = round((used_days / allocated_days) * 100, 0) if allocated_days else 0

        return {
            "total_employees": total_employees,
            "on_leave_today": on_leave_today,
            "pending_approvals": pending_approvals,
            "upcoming_7_days": upcoming,
            "utilisation_rate": utilisation_rate,
            "coverage_alerts": 0,  # plug in your own coverage logic
        }

    # ---------- LEAVE TRENDS (line chart) ----------
    @api.model
    def _get_leave_trends(self, months=6):
        months = int(months) if months in (6, 12) else 6
        today = Date.context_today(self)
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
            ('date_from', '>=', range_start),
            ('date_from', '<=', today.replace(day=1) + relativedelta(months=1, days=-1)),
        ])

        for leave in leaves:
            key = leave.date_from.strftime("%Y-%m")
            if key not in buckets:
                continue
            b = buckets[key]
            b["total"] += 1
            if leave.state == "validate":
                b["approved"] += 1
            elif leave.state in ("confirm", "draft"):
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

    # ---------- BY LEAVE TYPE (donut) ----------
    @api.model
    def _get_leave_type_distribution(self):
        groups = self.read_group(
            domain=[],
            fields=['id'],
            groupby=['holiday_status_id'],
        )
        total = sum(g['holiday_status_id_count'] for g in groups) or 1
        result = []
        for g in groups:
            if not g['holiday_status_id']:
                continue
            count = g['holiday_status_id_count']
            result.append({
                "name": g['holiday_status_id'][1],
                "count": count,
                "percent": round((count / total) * 100),
            })
        result.sort(key=lambda r: r['count'], reverse=True)
        return result

    # ---------- LEAVE BALANCE BY TYPE (progress bars) ----------
    @api.model
    def _get_leave_balance_by_type(self):
        LeaveType = self.env['hr.leave.type']
        types = LeaveType.search([])
        result = []
        for lt in types:
            allocated = sum(self.env['hr.leave.allocation'].search([
                ('holiday_status_id', '=', lt.id), ('state', '=', 'validate'),
            ]).mapped('number_of_days'))
            used = sum(self.search([
                ('holiday_status_id', '=', lt.id), ('state', '=', 'validate'),
            ]).mapped('number_of_days'))
            if not allocated and not used:
                continue
            result.append({
                "name": lt.name,
                "color": lt.color or '#999',
                "used": round(used),
                "allocated": round(allocated),
                "percent": round((used / allocated) * 100) if allocated else 0,
            })
        return result

    # ---------- APPROVAL OVERVIEW (donut + counts) ----------
    @api.model
    def _get_approval_overview(self):
        approved = self.search_count([('state', '=', 'validate')])
        pending = self.search_count([('state', 'in', ('confirm', 'draft'))])
        rejected = self.search_count([('state', '=', 'refuse')])
        total = approved + pending + rejected
        rate = round((approved / total) * 100) if total else 0
        return {
            "approved": approved, "pending": pending, "rejected": rejected,
            "approval_rate": rate,
        }