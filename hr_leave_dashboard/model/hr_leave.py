# -*- coding: utf-8 -*-
from collections import OrderedDict
from dateutil.relativedelta import relativedelta
from odoo import models, fields, api, _
from odoo.exceptions import AccessError, ValidationError, UserError
from odoo.osv import expression
import logging
import math

_logger = logging.getLogger(__name__)


class HrLeave(models.Model):
    _inherit = "hr.leave"

    # Admin Creation & Attribution Fields (FR-108 to FR-109)
    admin_created = fields.Boolean(
        string="Created by Administrator",
        readonly=True,
        copy=False,
        index=True,
    )
    admin_created_by_id = fields.Many2one(
        "res.users",
        string="Created By Administrator",
        readonly=True,
        copy=False,
    )
    admin_created_at = fields.Datetime(
        string="Created At",
        readonly=True,
        copy=False,
    )
    admin_creation_note = fields.Text(
        string="Admin Note / Reason",
        readonly=True,
        copy=False,
    )
    admin_overlap_override = fields.Boolean(
        string="Overlap Overridden",
        readonly=True,
        copy=False,
    )

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

    # ═════════════════════════════════════════════════════════
    # SCREEN 9 — LEAVE REQUESTS PAGE BACKEND METHODS (FR-073 to FR-113)
    # ═════════════════════════════════════════════════════════

    @api.model
    def _get_leave_approver_label(self, leave):
        if leave.state == "confirm":
            if hasattr(leave, "validation_type") and leave.validation_type in ("manager", "both"):
                return leave.employee_id.leave_manager_id.name or _("Line Manager")
            if hasattr(leave, "holiday_status_id") and leave.holiday_status_id.responsible_ids:
                resp = leave.holiday_status_id.responsible_ids.mapped("name")
                return ", ".join(resp) or _("Time Off Officer")
            return _("Line Manager")

        if leave.state == "validate1":
            if hasattr(leave, "holiday_status_id") and leave.holiday_status_id.responsible_ids:
                resp = leave.holiday_status_id.responsible_ids.mapped("name")
                return ", ".join(resp) or _("Time Off Officer")
            return _("Time Off Officer")

        approver = (
            getattr(leave, "second_approver_id", False)
            or getattr(leave, "first_approver_id", False)
            or getattr(leave, "user_id", False)
        )
        return approver.name if approver else ""

    def _serialize_leave_request(self, leave=None):
        rec = leave or self
        rec.ensure_one()
        state_map = {
            "draft": "pending",
            "confirm": "pending",
            "validate1": "pending",
            "validate": "approved",
            "refuse": "rejected",
        }
        status = state_map.get(rec.state, "pending")
        return {
            "id": rec.id,
            "employee": {
                "id": rec.employee_id.id,
                "name": rec.employee_id.name or "",
                "department": rec.department_id.name or "",
            },
            "leave_type": {
                "id": rec.holiday_status_id.id,
                "name": rec.holiday_status_id.name or "",
                "color": rec.holiday_status_id.color or 0,
            },
            "date_from": fields.Date.to_string(rec.request_date_from) if rec.request_date_from else "",
            "date_to": fields.Date.to_string(rec.request_date_to) if rec.request_date_to else "",
            "duration": round(rec.number_of_days, 1),
            "status": status,
            "approver": self._get_leave_approver_label(rec),
            "submitted": fields.Date.to_string(rec.create_date.date()) if rec.create_date else "",
            "admin_created": rec.admin_created,
            "can_review": rec.state in ("confirm", "validate1"),
            "notes": rec.notes or rec.admin_creation_note or "",
        }

    @api.model
    def get_leave_requests_page(
        self,
        search_term="",
        status="all",
        leave_type_id=False,
        department_id=False,
        page=1,
        page_size=10,
    ):
        self._check_leave_dashboard_access()
        emp_ids = self._get_company_employee_ids()
        if not emp_ids:
            return {
                "rows": [],
                "counts": {"all": 0, "pending": 0, "approved": 0, "rejected": 0},
                "pagination": {"page": 1, "page_size": 10, "total": 0, "page_count": 1, "from": 0, "to": 0},
                "leave_types": [],
                "departments": [],
            }

        page = max(int(page or 1), 1)
        allowed_sizes = (10, 25, 50, 100)
        page_size = int(page_size or 10)
        if page_size not in allowed_sizes:
            page_size = 10

        base_domain = [("employee_id", "in", emp_ids)]
        if search_term and search_term.strip():
            st = search_term.strip()
            base_domain = expression.AND([
                base_domain,
                expression.OR([
                    [("employee_id.name", "ilike", st)],
                    [("holiday_status_id.name", "ilike", st)],
                    [("name", "ilike", st)],
                ])
            ])

        if leave_type_id:
            base_domain.append(("holiday_status_id", "=", int(leave_type_id)))
        if department_id:
            base_domain.append(("department_id", "=", int(department_id)))

        counts = {
            "all": self.search_count(base_domain + [("state", "!=", "draft")]),
            "pending": self.search_count(base_domain + [("state", "in", ("confirm", "validate1"))]),
            "approved": self.search_count(base_domain + [("state", "=", "validate")]),
            "rejected": self.search_count(base_domain + [("state", "=", "refuse")]),
        }

        domain = list(base_domain)
        if status == "pending":
            domain.append(("state", "in", ("confirm", "validate1")))
        elif status == "approved":
            domain.append(("state", "=", "validate"))
        elif status == "rejected":
            domain.append(("state", "=", "refuse"))
        else:
            domain.append(("state", "!=", "draft"))

        total = self.search_count(domain)
        page_count = max(math.ceil(total / page_size), 1)
        if page > page_count:
            page = page_count

        offset = (page - 1) * page_size
        leaves = self.search(domain, offset=offset, limit=page_size, order="create_date desc, id desc")
        rows = [self._serialize_leave_request(leave) for leave in leaves]

        leave_types = self.env["hr.leave.type"].search([
            ("active", "=", True),
            "|", ("company_id", "=", False), ("company_id", "=", self.env.company.id),
        ])
        departments = self.env["hr.department"].search(
            [("company_id", "=", self.env.company.id)],
            order="name",
        )

        return {
            "rows": rows,
            "counts": counts,
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "page_count": page_count,
                "from": offset + 1 if total else 0,
                "to": min(offset + page_size, total),
            },
            "leave_types": [{"id": lt.id, "name": lt.name, "color": lt.color or 0} for lt in leave_types],
            "departments": [{"id": dept.id, "name": dept.name} for dept in departments],
        }

    # ---------------------------------------------------------
    # BULK & INDIVIDUAL ACTION METHODS (FR-089, FR-097 to FR-100)
    # ---------------------------------------------------------

    @api.model
    def bulk_approve_leave_requests(self, leave_ids):
        self._check_leave_dashboard_access()
        emp_ids = self._get_company_employee_ids()
        leaves = self.browse(leave_ids).exists().filtered(
            lambda l: l.employee_id.id in emp_ids and l.state in ("confirm", "validate1")
        )
        processed = 0
        for leave in leaves:
            if leave.state == "confirm":
                leave.action_approve()
                action_name = "first_approval" if leave.state == "validate1" else "final_approval"
            elif leave.state == "validate1":
                leave.action_validate()
                action_name = "final_approval"
            else:
                action_name = "approve"
            
            # Immutable Audit Log Entry (FR-111)
            self._create_audit_record(leave, action_name)
            processed += 1
        return {"processed": processed}

    @api.model
    def bulk_reject_leave_requests(self, leave_ids, reason=""):
        self._check_leave_dashboard_access()
        reason = (reason or "").strip()
        if len(reason) < 3:
            raise ValidationError(_("A rejection reason is required (at least 3 characters)."))
        emp_ids = self._get_company_employee_ids()
        leaves = self.browse(leave_ids).exists().filtered(
            lambda l: l.employee_id.id in emp_ids and l.state in ("confirm", "validate1")
        )
        for leave in leaves:
            # Post rejection reason to chatter without destroying original leave.notes (LLM Review)
            body = _("Leave request rejected by %(user)s.<br/><strong>Reason:</strong> %(reason)s",
                     user=self.env.user.name, reason=reason)
            leave.message_post(body=body)
            leave.action_refuse()
            # Immutable Audit Log Entry (FR-111)
            self._create_audit_record(leave, "reject", note=reason)
        return {"processed": len(leaves)}

    @api.model
    def get_leave_request_detail(self, leave_id):
        self._check_leave_dashboard_access()
        leave = self.browse(int(leave_id)).exists()
        if not leave or leave.employee_id.company_id != self.env.company:
            raise ValidationError(_("Invalid leave request."))
        res = self._serialize_leave_request(leave)

        # Build timeline history for FR-113
        history = []
        if leave.admin_created:
            history.append({
                "title": f"Request created by {leave.admin_created_by_id.name or 'Admin'} on behalf of {leave.employee_id.name}",
                "timestamp": fields.Datetime.to_string(leave.admin_created_at or leave.create_date),
                "type": "creation",
                "note": leave.admin_creation_note or "",
            })
        else:
            history.append({
                "title": f"Self-submitted by {leave.employee_id.name}",
                "timestamp": fields.Datetime.to_string(leave.create_date),
                "type": "creation",
                "note": leave.notes or "",
            })

        audit_logs = self.env["hr.leave.audit.log"].sudo().search([("leave_id", "=", leave.id)], order="occurred_at asc")
        for log in audit_logs:
            action_label = {
                "admin_create": "Admin Creation",
                "override_conflict": "Conflict Overridden & Created",
                "first_approval": "First Approval",
                "final_approval": "Final Approval",
                "approve": "Approved",
                "reject": "Rejected",
            }.get(log.action, log.action)
            history.append({
                "title": f"{action_label} by {log.actor_id.name} ({log.actor_role})",
                "timestamp": fields.Datetime.to_string(log.occurred_at),
                "type": log.action,
                "note": log.note or "",
            })

        res.update({
            "notes": leave.notes or leave.admin_creation_note or "",
            "admin_created_by": leave.admin_created_by_id.name if leave.admin_created else "",
            "admin_created_at": fields.Date.to_string(leave.admin_created_at.date()) if leave.admin_created_at else "",
            "history": history,
        })
        return res

    @api.model
    def approve_single_request(self, leave_id):
        return self.bulk_approve_leave_requests([leave_id])

    @api.model
    def reject_single_request(self, leave_id, reason=""):
        return self.bulk_reject_leave_requests([leave_id], reason)

    # ---------------------------------------------------------
    # ADMIN CREATE LEAVE REQUEST METHODS (FR-101 to FR-112)
    # ---------------------------------------------------------

    @api.model
    def get_admin_create_options(self):
        self._check_leave_dashboard_access()
        emp_ids = self._get_company_employee_ids()
        employees = self.env["hr.employee"].browse(emp_ids).filtered("active")
        return {
            "employees": [{
                "id": emp.id,
                "name": emp.name,
                "department": emp.department_id.name or "No Department",
                "job_title": emp.job_title or (emp.job_id.name if hasattr(emp, "job_id") and emp.job_id else "") or "Employee",
                "label": f"{emp.name} ({emp.department_id.name or 'No Department'} - {emp.job_title or (emp.job_id.name if hasattr(emp, 'job_id') and emp.job_id else '') or 'Employee'})",
            } for emp in employees],
        }

    @api.model
    def get_admin_leave_types_for_employee(self, employee_id):
        self._check_leave_dashboard_access()
        employee = self.env["hr.employee"].browse(int(employee_id)).exists()
        if not employee or employee.company_id != self.env.company:
            raise ValidationError(_("Invalid employee."))

        LeaveType = self.env["hr.leave.type"].with_context(
            employee_id=employee.id,
            default_employee_id=employee.id,
        )
        leave_types = LeaveType.search([
            ("active", "=", True),
            "|", ("company_id", "=", False), ("company_id", "=", self.env.company.id),
        ])

        return [{
            "id": lt.id,
            "name": lt.name,
            "balance": getattr(lt, "virtual_remaining_leaves", 0),
            "requires_allocation": getattr(lt, "requires_allocation", "no"),
            "allows_negative": getattr(lt, "allows_negative", False),
            "max_allowed_negative": getattr(lt, "max_allowed_negative", 0) if getattr(lt, "allows_negative", False) else 0,
            "request_unit": getattr(lt, "request_unit", "day"),
        } for lt in leave_types]

    @api.model
    def preview_admin_leave_request(self, employee_id, leave_type_id, date_from, date_to, half_day=False, period="am"):
        self._check_leave_dashboard_access()
        employee = self.env["hr.employee"].browse(int(employee_id)).exists()
        leave_type = self.env["hr.leave.type"].browse(int(leave_type_id)).exists()
        if not employee or not leave_type:
            raise ValidationError(_("Invalid leave request data."))

        vals = {
            "employee_id": employee.id,
            "holiday_status_id": leave_type.id,
            "request_date_from": date_from,
            "request_date_to": date_to,
            "request_unit_half": bool(half_day),
            "request_date_from_period": period,
        }
        preview = self.new(vals)
        if hasattr(preview, "_compute_department_id"):
            preview._compute_department_id()
        if hasattr(preview, "_compute_resource_calendar_id"):
            preview._compute_resource_calendar_id()
        if hasattr(preview, "_compute_date_from_to"):
            preview._compute_date_from_to()

        days = preview.number_of_days or 0.0

        # Check overlapping existing leave requests for FR-107 (Approved or Pending only per LLM review)
        conflicts = self.search([
            ("employee_id", "=", employee.id),
            ("state", "in", ("confirm", "validate1", "validate")),
            ("request_date_from", "<=", date_to),
            ("request_date_to", ">=", date_from),
        ])

        return {
            "duration": round(days, 1),
            "conflicts": [{
                "id": c.id,
                "leave_type": c.holiday_status_id.name or "",
                "date_from": fields.Date.to_string(c.request_date_from),
                "date_to": fields.Date.to_string(c.request_date_to),
                "state": c.state,
            } for c in conflicts],
        }

    @api.model
    def create_admin_leave_request(
        self,
        employee_id,
        leave_type_id,
        date_from,
        date_to,
        admin_note,
        half_day=False,
        period="am",
        override_conflict=False,
    ):
        self._check_leave_dashboard_access()
        admin_note = (admin_note or "").strip()
        if len(admin_note) < 10:
            raise ValidationError(_("Admin Note / Reason must contain at least 10 characters."))

        employee = self.env["hr.employee"].browse(int(employee_id)).exists()
        leave_type = self.env["hr.leave.type"].browse(int(leave_type_id)).exists()
        if not employee or employee.company_id != self.env.company or not leave_type:
            raise ValidationError(_("Invalid request data."))

        preview = self.preview_admin_leave_request(
            employee.id, leave_type.id, date_from, date_to, half_day, period
        )

        if preview["conflicts"] and not override_conflict:
            return {
                "created": False,
                "conflict": True,
                "conflicts": preview["conflicts"],
            }

        vals = {
            "employee_id": employee.id,
            "holiday_status_id": leave_type.id,
            "request_date_from": date_from,
            "request_date_to": date_to,
            "notes": admin_note,
            "request_unit_half": bool(half_day),
            "request_date_from_period": period,
            "admin_created": True,
            "admin_created_by_id": self.env.user.id,
            "admin_created_at": fields.Datetime.now(),
            "admin_creation_note": admin_note,
            "admin_overlap_override": bool(override_conflict),
        }

        LeaveObj = self
        if override_conflict:
            LeaveObj = LeaveObj.with_context(leave_skip_date_check=True)

        leave = LeaveObj.create(vals)

        # Notify employee via chatter (FR-110)
        partner = employee.user_id.partner_id if employee.user_id else False
        if partner:
            leave.message_post(
                body=_(
                    "%(admin)s created a %(leave_type)s request on your behalf from %(start)s to %(end)s (%(duration)s days).",
                    admin=self.env.user.name,
                    leave_type=leave_type.name,
                    start=leave.request_date_from,
                    end=leave.request_date_to,
                    duration=leave.number_of_days,
                ),
                partner_ids=partner.ids,
            )

        # Create Immutable Audit Log (FR-111)
        action_type = "override_conflict" if override_conflict else "admin_create"
        self._create_audit_record(leave, action_type, note=admin_note)

        return {"created": True, "id": leave.id}

    @api.model
    def _create_audit_record(self, leave, action, note=""):
        ip_addr = "127.0.0.1"
        sess_ref = ""
        try:
            from odoo.http import request
            if request and hasattr(request, "httprequest") and request.httprequest:
                ip_addr = getattr(request.httprequest, "remote_addr", "127.0.0.1") or "127.0.0.1"
            if request and hasattr(request, "session") and request.session:
                sess_ref = getattr(request.session, "sid", "") or ""
        except Exception:
            pass

        self.env["hr.leave.audit.log"].sudo().create({
            "leave_id": leave.id,
            "action": action,
            "actor_id": self.env.user.id,
            "actor_role": "Super Admin" if self.env.user.has_group("base.group_system") else "Leave Manager",
            "employee_id": leave.employee_id.id,
            "leave_type_id": leave.holiday_status_id.id,
            "date_from": leave.request_date_from,
            "date_to": leave.request_date_to,
            "duration": leave.number_of_days,
            "note": note or leave.notes or "",
            "occurred_at": fields.Datetime.now(),
            "ip_address": ip_addr,
            "session_ref": sess_ref,
        })
