# -*- coding: utf-8 -*-
import logging
import re
from datetime import datetime, date
from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError

_logger = logging.getLogger(__name__)

class HrLeaveType(models.Model):
    _inherit = "hr.leave.type"

    description = fields.Text(string="Description")
    leave_code = fields.Char(string="Code / Abbreviation", size=10, required=True, default="LT")
    cleon_category = fields.Selection(
        [
            ("paid", "Paid"),
            ("unpaid", "Unpaid"),
            ("partially_paid", "Partially Paid"),
        ],
        string="Type Category",
        default="paid",
        required=True,
    )
    cleon_color_hex = fields.Char(string="Color Hex", default="#3B82F6")
    is_system_leave_type = fields.Boolean(string="System Leave Type", default=False)

    max_entitlement = fields.Float(string="Maximum Entitlement (Days/Year)", default=20.0)
    unlimited_entitlement = fields.Boolean(string="Unlimited Entitlement", default=False)
    applicable_gender = fields.Selection(
        [
            ("all", "All Genders"),
            ("male", "Male Only"),
            ("female", "Female Only"),
        ],
        string="Applicable Gender",
        default="all",
        required=True,
    )

    allow_carryover = fields.Boolean(string="Allow Carryover", default=True)
    allow_encashment = fields.Boolean(string="Allow Encashment", default=False)
    max_balance_cap = fields.Float(string="Maximum Balance Cap", default=0.0)

    eligibility_scope = fields.Selection(
        [
            ("all", "All Employees"),
            ("departments", "Specific Departments"),
            ("units", "Specific Units"),
            ("grades", "Grade Levels"),
            ("employees", "Named Employees"),
        ],
        string="Eligibility Scope",
        default="all",
        required=True,
    )
    eligible_department_ids = fields.Many2many("hr.department", string="Eligible Departments")
    eligible_unit_ids = fields.Many2many("hr.unit", string="Eligible Units")
    eligible_grade_ids = fields.Many2many("hr.grade", string="Eligible Grade Levels")
    eligible_employee_ids = fields.Many2many("hr.employee", string="Eligible Employees")
    employee_type_ids = fields.Many2many("hr.core_employment_type", string="Applicable Employee Types")
    location_ids = fields.Many2many("hr.work.location", string="Applicable Locations")
    minimum_service_months = fields.Integer(string="Minimum Service Period (months)", default=0)

    accrual_method = fields.Selection(
        [
            ("year_start", "Full Allocation at Year Start"),
            ("monthly", "Monthly Accrual"),
            ("hire_anniversary", "Hire-Date Anniversary"),
            ("first_year_prorated", "Pro-rated (First Year)"),
            ("manual", "None — Manual Allocation"),
        ],
        string="Accrual Method",
        default="year_start",
        required=True,
    )
    tenure_based_accrual = fields.Boolean(string="Tenure-based Accrual Scaling", default=False)
    tenure_tier_ids = fields.One2many("hr.leave.type.tenure.tier", "leave_type_id", string="Tenure Scaling Tiers")

    suspension_unpaid_leave = fields.Boolean(string="Unpaid Leave", default=False)
    suspension_disciplinary = fields.Boolean(string="Disciplinary Suspension", default=False)
    suspension_extended_sick = fields.Boolean(string="Extended Sick Leave (>30 days)", default=False)
    suspension_probation = fields.Boolean(string="Probation Period", default=False)
    suspension_unauthorized_absence = fields.Boolean(string="Unauthorized Absence", default=False)

    approval_workflow = fields.Selection(
        [
            ("none", "No Approval Required"),
            ("single", "Single Approver"),
            ("multi", "Multi-level Approval"),
        ],
        string="Approval Workflow",
        default="single",
        required=True,
    )
    supporting_document_policy = fields.Selection(
        [
            ("always", "Always Required"),
            ("conditional", "Conditional (>3 days)"),
            ("never", "Never Required"),
        ],
        string="Require Supporting Document",
        default="never",
        required=True,
    )
    minimum_notice_days = fields.Integer(string="Minimum Notice Period (days)", default=0)
    allow_half_day = fields.Boolean(string="Allow Half-Day Requests", default=True)

    max_consecutive_days = fields.Integer(string="Maximum Consecutive Days", default=0)
    allow_negative_balance = fields.Boolean(string="Allow Negative Balance", default=False)
    team_overlap_percent = fields.Float(string="Max % of Team on Leave Simultaneously", default=0.0)
    block_overlap_threshold = fields.Boolean(string="Block if Threshold Exceeded", default=False)

    visible_to_employees = fields.Boolean(string="Visible to Employees", default=True)

    @api.constrains(
        "minimum_service_months", "minimum_notice_days", "max_consecutive_days",
        "team_overlap_percent", "leave_code", "cleon_color_hex", "company_id",
    )
    def _check_policy_constraints(self):
        for rec in self:
            if not rec.leave_code or not rec.leave_code.strip():
                raise ValidationError(_("Code / Abbreviation is required."))
            duplicate = self.with_context(active_test=False).search_count([
                ("id", "!=", rec.id),
                ("company_id", "=", rec.company_id.id or False),
                ("leave_code", "=ilike", rec.leave_code.strip()),
            ])
            if duplicate:
                raise ValidationError(
                    _("Leave Type code '%s' is already in use for this company.")
                    % rec.leave_code.strip().upper()
                )
            if not re.fullmatch(r"#[0-9A-Fa-f]{6}", rec.cleon_color_hex or ""):
                raise ValidationError(_("Colour must be a valid six-digit hex value, for example #3B82F6."))
            if rec.minimum_service_months < 0:
                raise ValidationError(_("Minimum service period cannot be negative."))
            if rec.minimum_notice_days < 0:
                raise ValidationError(_("Minimum notice period cannot be negative."))
            if rec.max_consecutive_days < 0:
                raise ValidationError(_("Maximum consecutive days cannot be negative."))
            if rec.team_overlap_percent < 0 or rec.team_overlap_percent > 100:
                raise ValidationError(_("Team overlap percentage must be between 0 and 100."))

    def unlink(self):
        for rec in self:
            if rec.is_system_leave_type or rec.name in ("Annual Leave", "Sick Leave", "Paid Time Off"):
                raise UserError(_("System leave types ('%s') cannot be deleted.") % rec.name)
        return super().unlink()

    def _get_eligible_employees(self):
        self.ensure_one()
        emps = self.env["hr.employee"].search([
            ("company_id", "in", [False, self.env.company.id]),
            ("active", "=", True),
        ])

        # 1. Scope filter
        if self.eligibility_scope == "departments":
            if self.eligible_department_ids:
                emps = emps.filtered(lambda e: e.department_id.id in self.eligible_department_ids.ids)
            else:
                emps = emps.browse()
        elif self.eligibility_scope == "units":
            if self.eligible_unit_ids:
                emps = emps.filtered(lambda e: hasattr(e, "unit_id") and e.unit_id.id in self.eligible_unit_ids.ids)
            else:
                emps = emps.browse()
        elif self.eligibility_scope == "grades":
            if self.eligible_grade_ids:
                emps = emps.filtered(lambda e: hasattr(e, "grade_id") and e.grade_id.id in self.eligible_grade_ids.ids)
            else:
                emps = emps.browse()
        elif self.eligibility_scope == "employees":
            if self.eligible_employee_ids:
                emps = emps.filtered(lambda e: e.id in self.eligible_employee_ids.ids and e.active)
            else:
                emps = emps.browse()

        # 2. Employment type filter
        if self.employee_type_ids:
            emps = emps.filtered(lambda e: hasattr(e, "contract_type_id") and e.contract_type_id.id in self.employee_type_ids.ids)

        # 3. Location filter
        if self.location_ids:
            emps = emps.filtered(lambda e: hasattr(e, "work_location_id") and e.work_location_id.id in self.location_ids.ids)

        # 4. Gender filter
        if self.applicable_gender == "male":
            emps = emps.filtered(lambda e: getattr(e, "gender", False) == "male")
        elif self.applicable_gender == "female":
            emps = emps.filtered(lambda e: getattr(e, "gender", False) == "female")

        return emps

    @api.model
    def get_leave_types_list_data(self):
        self.env["hr.leave"]._check_leave_dashboard_access()
        leave_types = self.with_context(active_test=False).search([("company_id", "in", [False, self.env.company.id])], order="sequence asc, id asc")

        # Grouped query for aggregate total days used across approved leaves
        leaves_data = self.env["hr.leave"].read_group(
            domain=[
                ("holiday_status_id", "in", leave_types.ids),
                ("state", "=", "validate"),
                ("is_cancelled", "=", False),
            ],
            fields=["number_of_days:sum"],
            groupby=["holiday_status_id"],
        )
        used_days_map = {row["holiday_status_id"][0]: row["number_of_days"] for row in leaves_data if row["holiday_status_id"]}

        # Grouped query for active request count per leave type
        active_req_data = self.env["hr.leave"].read_group(
            domain=[
                ("holiday_status_id", "in", leave_types.ids),
                ("state", "in", ("confirm", "validate1", "validate")),
                ("is_cancelled", "=", False),
            ],
            fields=["id:count"],
            groupby=["holiday_status_id"],
        )
        active_req_map = {row["holiday_status_id"][0]: row["holiday_status_id_count"] for row in active_req_data if row["holiday_status_id"]}

        res_list = []
        for lt in leave_types:
            eligible_emps = lt._get_eligible_employees()
            res_list.append({
                "id": lt.id,
                "name": lt.name,
                "code": lt.leave_code or (lt.name[:3].upper() if lt.name else "LT"),
                "category": lt.cleon_category or "paid",
                "color_hex": lt.cleon_color_hex or "#3B82F6",
                "is_system": lt.is_system_leave_type or lt.name in ("Annual Leave", "Sick Leave", "Paid Time Off"),
                "max_entitlement": lt.max_entitlement if lt.max_entitlement is not None else 20.0,
                "unlimited_entitlement": bool(lt.unlimited_entitlement),
                "applicable_gender": lt.applicable_gender or "all",
                "allow_carryover": bool(lt.allow_carryover),
                "assigned_count": len(eligible_emps),
                "total_days_used": round(used_days_map.get(lt.id, 0.0), 1),
                "active": bool(lt.active),
                "sequence": lt.sequence or 100,
                "active_request_count": active_req_map.get(lt.id, 0),
                "description": getattr(lt, "description", "") or "",
                "eligibility_scope": lt.eligibility_scope or "all",
                "minimum_service_months": lt.minimum_service_months or 0,
                "accrual_method": lt.accrual_method or "year_start",
                "allow_carry_forward": bool(lt.allow_carryover),
                "allow_encashment": bool(lt.allow_encashment),
                "max_balance_cap": lt.max_balance_cap or 0.0,
                "tenure_based_accrual": bool(lt.tenure_based_accrual),
                "approval_workflow": lt.approval_workflow or "single",
                "supporting_document_policy": lt.supporting_document_policy or "never",
                "minimum_notice_days": lt.minimum_notice_days or 0,
                "allow_half_day": bool(lt.allow_half_day),
                "max_consecutive_days": lt.max_consecutive_days or 0,
                "allow_negative_balance": bool(lt.allow_negative_balance),
                "team_overlap_percent": lt.team_overlap_percent or 0.0,
                "block_overlap_threshold": bool(lt.block_overlap_threshold),
                "visible_to_employees": bool(lt.visible_to_employees),
                "department_ids": lt.eligible_department_ids.ids if "hr.department" in self.env else [],
                "unit_ids": lt.eligible_unit_ids.ids if "hr.unit" in self.env and hasattr(lt, "eligible_unit_ids") else [],
                "grade_ids": lt.eligible_grade_ids.ids if "hr.grade" in self.env and hasattr(lt, "eligible_grade_ids") else [],
                "employee_ids": lt.eligible_employee_ids.ids if "hr.employee" in self.env else [],
                "employee_type_ids": lt.employee_type_ids.ids if "hr.core_employment_type" in self.env and hasattr(lt, "employee_type_ids") else [],
                "location_ids": lt.location_ids.ids if "hr.work.location" in self.env and hasattr(lt, "location_ids") else [],
                "tenure_tiers": [
                    {"id": t.id, "year_from": t.year_from, "year_to": t.year_to or 0, "days_per_year": t.days_per_year}
                    for t in lt.tenure_tier_ids
                ],
            })
        return res_list

    @api.model
    def get_deactivation_impact(self, leave_type_id):
        lt = self.browse(int(leave_type_id))
        if not lt.exists():
            return {"assigned_employee_count": 0, "active_request_count": 0, "has_active_balances": False}

        assigned_count = len(lt._get_eligible_employees())
        active_req_count = self.env["hr.leave"].search_count([
            ("holiday_status_id", "=", lt.id),
            ("state", "in", ("confirm", "validate1", "validate")),
            ("is_cancelled", "=", False),
        ])
        alloc_count = self.env["hr.leave.allocation"].search_count([
            ("holiday_status_id", "=", lt.id),
            ("state", "=", "validate"),
        ])

        return {
            "assigned_employee_count": assigned_count,
            "active_request_count": active_req_count,
            "has_active_balances": alloc_count > 0,
        }

    @api.model
    def save_leave_type_configuration(self, vals):
        self.env["hr.leave"]._check_leave_dashboard_access()
        record_id = vals.get("id")
        tenure_tiers_data = vals.pop("tenure_tiers", None)

        # Build clean write/create dictionary
        values = {
            "name": vals.get("name", "").strip(),
            "leave_code": (vals.get("code") or vals.get("name") or "LT").strip().upper()[:10],
            "description": vals.get("description", ""),
            "cleon_color_hex": vals.get("colorHex", "#3B82F6"),
            "cleon_category": vals.get("category", "paid"),
            "max_entitlement": float(vals.get("maxEntitlement", 20.0)),
            "unlimited_entitlement": bool(vals.get("unlimitedEntitlement")),
            "applicable_gender": vals.get("applicableGender", "all"),

            "eligibility_scope": vals.get("eligibilityScope", "all"),
            "minimum_service_months": int(vals.get("minimumServiceMonths", 0)),

            "accrual_method": vals.get("accrualMethod", "year_start"),
            "tenure_based_accrual": bool(vals.get("tenureBasedAccrual")),
            "suspension_unpaid_leave": bool(vals.get("suspensionUnpaidLeave")),
            "suspension_disciplinary": bool(vals.get("suspensionDisciplinary")),
            "suspension_extended_sick": bool(vals.get("suspensionExtendedSick")),
            "suspension_probation": bool(vals.get("suspensionProbation")),
            "suspension_unauthorized_absence": bool(vals.get("suspensionUnauthorizedAbsence")),

            "allow_carryover": bool(vals.get("allowCarryForward")),
            "allow_encashment": bool(vals.get("allowEncashment")) if vals.get("allowCarryForward") else False,
            "max_balance_cap": float(vals.get("maxBalanceCap", 0.0)) if vals.get("allowCarryForward") else 0.0,

            "approval_workflow": vals.get("approvalWorkflow", "single"),
            "leave_validation_type": {
                "none": "no_validation",
                "single": "hr",
                "multi": "both",
            }.get(vals.get("approvalWorkflow", "single"), "hr"),
            "supporting_document_policy": vals.get("supportingDocumentPolicy", "never"),
            "support_document": vals.get("supportingDocumentPolicy", "never") != "never",
            "minimum_notice_days": int(vals.get("minimumNoticeDays", 0)),
            "allow_half_day": bool(vals.get("allowHalfDay")),

            "max_consecutive_days": int(vals.get("maxConsecutiveDays", 0)),
            "allow_negative_balance": bool(vals.get("allowNegativeBalance")),
            "team_overlap_percent": float(vals.get("teamOverlapPercent", 0.0)),
            "block_overlap_threshold": bool(vals.get("blockOverlapThreshold")),

            "active": bool(vals.get("active", True)),
            "visible_to_employees": bool(vals.get("visibleToEmployees", True)),
        }

        if "hr.department" in self.env:
            values["eligible_department_ids"] = [(6, 0, vals.get("departmentIds", []))]
        if "hr.unit" in self.env:
            values["eligible_unit_ids"] = [(6, 0, vals.get("unitIds", []))]
        if "hr.grade" in self.env:
            values["eligible_grade_ids"] = [(6, 0, vals.get("gradeIds", []))]
        if "hr.employee" in self.env:
            values["eligible_employee_ids"] = [(6, 0, vals.get("employeeIds", []))]
        if "hr.core_employment_type" in self.env:
            values["employee_type_ids"] = [(6, 0, vals.get("employeeTypeIds", []))]
        if "hr.work.location" in self.env:
            values["location_ids"] = [(6, 0, vals.get("locationIds", []))]

        # Tenure tier O2M commands
        if vals.get("tenureBasedAccrual") and tenure_tiers_data:
            tier_cmds = [(5, 0, 0)]
            for t in tenure_tiers_data:
                tier_cmds.append((0, 0, {
                    "year_from": int(t.get("year_from", 1)),
                    "year_to": int(t.get("year_to", 0)) or False,
                    "days_per_year": float(t.get("days_per_year", 20.0)),
                }))
            values["tenure_tier_ids"] = tier_cmds
        else:
            values["tenure_tier_ids"] = [(5, 0, 0)]

        if record_id:
            lt = self.browse(int(record_id))
            lt.write(values)
            action_desc = "Updated Leave Type configuration"
        else:
            lt = self.create(values)
            action_desc = "Created Leave Type configuration"

        # Log Activity to hr.leave.audit.log
        if "hr.leave.audit.log" in self.env:
            try:
                actor_role = "HR Manager" if self.env.user.has_group("hr_holidays.group_hr_holidays_manager") else "HR Officer"
                self.env["hr.leave.audit.log"].sudo().create({
                    "leave_id": False,
                    "action": "policy_change",
                    "actor_id": self.env.user.id,
                    "actor_label": self.env.user.name,
                    "actor_role": actor_role,
                    "leave_type_id": lt.id,
                    "note": f"{action_desc}: '{lt.name}' (Code: {lt.leave_code}, Color: {lt.cleon_color_hex}, Category: {lt.cleon_category})",
                })
            except Exception as e:
                _logger.warning("Could not create audit log entry: %s", e)

        return {"id": lt.id, "name": lt.name}

    @api.model
    def get_leave_type_employee_data(self, leave_type_id):
        self.env["hr.leave"]._check_leave_dashboard_access()
        lt = self.browse(int(leave_type_id))
        if not lt.exists():
            return []

        eligible_emps = lt._get_eligible_employees()
        if not eligible_emps:
            return []

        allocs = self.env["hr.leave.allocation"].search([
            ("holiday_status_id", "=", lt.id),
            ("employee_id", "in", eligible_emps.ids),
            ("state", "=", "validate"),
        ])
        alloc_map = {}
        for a in allocs:
            alloc_map[a.employee_id.id] = alloc_map.get(a.employee_id.id, 0.0) + a.number_of_days

        leaves = self.env["hr.leave"].search([
            ("holiday_status_id", "=", lt.id),
            ("employee_id", "in", eligible_emps.ids),
            ("state", "=", "validate"),
            ("is_cancelled", "=", False),
        ])
        used_map = {}
        for l in leaves:
            used_map[l.employee_id.id] = used_map.get(l.employee_id.id, 0.0) + l.number_of_days

        res = []
        default_ent = lt.max_entitlement if lt.max_entitlement is not None else 20.0
        for emp in eligible_emps:
            allocated = alloc_map.get(emp.id, default_ent)
            used = round(used_map.get(emp.id, 0.0), 1)
            remaining = round(allocated - used, 1)
            res.append({
                "id": emp.id,
                "name": emp.name,
                "department": emp.department_id.name if emp.department_id else "—",
                "allocated": round(allocated, 1),
                "used": used,
                "remaining": remaining,
            })
        return res

    @api.model
    def update_leave_types_sequence(self, reordered_ids):
        self.env["hr.leave"]._check_leave_dashboard_access()
        for index, type_id in enumerate(reordered_ids, start=1):
            lt = self.browse(int(type_id))
            if lt.exists():
                lt.write({"sequence": index * 10})

        if "hr.leave.audit.log" in self.env:
            try:
                actor_role = "HR Manager" if self.env.user.has_group("hr_holidays.group_hr_holidays_manager") else "HR Officer"
                self.env["hr.leave.audit.log"].sudo().create({
                    "leave_id": False,
                    "action": "policy_change",
                    "actor_id": self.env.user.id,
                    "actor_label": self.env.user.name,
                    "actor_role": actor_role,
                    "leave_type_id": False,
                    "note": f"Reordered leave type sequence for {len(reordered_ids)} leave types.",
                })
            except Exception:
                pass
        return True

    @api.model
    def evaluate_leave_request_policy(self, employee_id, leave_type_id, date_from, date_to, requested_days=1.0, half_day=False):
        lt = self.browse(int(leave_type_id))
        emp = self.env["hr.employee"].browse(int(employee_id))
        res = {
            "eligible": True,
            "balance_ok": True,
            "notice_ok": True,
            "max_consecutive_ok": True,
            "document_required": False,
            "team_overlap": {"percentage": 0.0, "threshold": lt.team_overlap_percent, "exceeded": False, "blocking": False},
            "warnings": [],
            "errors": [],
        }

        if not lt.exists() or not emp.exists():
            res["eligible"] = False
            res["errors"].append(_("Invalid leave type or employee selection."))
            return res

        # 1. Full Eligibility Rule Check
        eligible_emps = lt._get_eligible_employees()
        if emp.id not in eligible_emps.ids:
            res["eligible"] = False
            res["errors"].append(_("Employee %s is not eligible for %s under its policy rules.") % (emp.name, lt.name))

        # 2. Minimum Service Period Check (using hire/contract date)
        if lt.minimum_service_months > 0:
            hire_date = getattr(emp, "first_contract_date", None) or getattr(emp, "employment_date", None) or (emp.create_date.date() if emp.create_date else fields.Date.today())
            service_days = (fields.Date.today() - hire_date).days
            required_days = lt.minimum_service_months * 30
            if service_days < required_days:
                res["eligible"] = False
                res["errors"].append(_("Minimum service period of %d months required. (Current service: %d days).") % (lt.minimum_service_months, service_days))

        # 3. Minimum Notice Period Check
        if lt.minimum_notice_days > 0 and date_from:
            try:
                start_dt = fields.Date.from_string(date_from)
                notice_given = (start_dt - fields.Date.today()).days
                if notice_given < lt.minimum_notice_days:
                    res["notice_ok"] = False
                    res["warnings"].append(_("Notice period of %d days required. (Given: %d days).") % (lt.minimum_notice_days, max(0, notice_given)))
            except Exception:
                pass

        # 4. Supporting Document Policy
        if lt.supporting_document_policy == "always":
            res["document_required"] = True
        elif lt.supporting_document_policy == "conditional" and requested_days > 3:
            res["document_required"] = True

        # 5. Consecutive Days Restriction
        if lt.max_consecutive_days > 0 and requested_days > lt.max_consecutive_days:
            res["max_consecutive_ok"] = False
            res["errors"].append(_("Request length (%.1f days) exceeds maximum consecutive days limit (%d days).") % (requested_days, lt.max_consecutive_days))

        # 6. Half Day Request Restriction
        if half_day and not lt.allow_half_day:
            res["errors"].append(_("Half-day requests are not permitted for %s.") % lt.name)

        # 7. Balance & Allow Negative Balance Check
        if not lt.unlimited_entitlement:
            allocs = self.env["hr.leave.allocation"].search([
                ("holiday_status_id", "=", lt.id),
                ("employee_id", "=", emp.id),
                ("state", "=", "validate"),
            ])
            total_alloc = sum(allocs.mapped("number_of_days")) or (lt.max_entitlement if lt.max_entitlement is not None else 20.0)

            used_leaves = self.env["hr.leave"].search([
                ("holiday_status_id", "=", lt.id),
                ("employee_id", "=", emp.id),
                ("state", "=", "validate"),
                ("is_cancelled", "=", False),
            ])
            total_used = sum(used_leaves.mapped("number_of_days"))
            remaining_balance = total_alloc - total_used

            if requested_days > remaining_balance:
                if not lt.allow_negative_balance:
                    res["balance_ok"] = False
                    res["eligible"] = False
                    res["errors"].append(
                        _("Insufficient leave balance (%.1f days remaining, %.1f requested). Negative balance is not permitted for %s.")
                        % (remaining_balance, requested_days, lt.name)
                    )
                else:
                    res["warnings"].append(
                        _("Request exceeds current balance by %.1f days. Negative balance will be applied.")
                        % (requested_days - remaining_balance)
                    )

        # 8. Team Overlap Calculation & Block Threshold Check
        if lt.team_overlap_percent > 0 and emp.department_id and date_from and date_to:
            dept_emps = self.env["hr.employee"].search([
                ("department_id", "=", emp.department_id.id),
                ("active", "=", True),
            ])
            dept_count = max(1, len(dept_emps))

            overlapping_leaves = self.env["hr.leave"].search([
                ("department_id", "=", emp.department_id.id),
                ("state", "in", ("confirm", "validate1", "validate")),
                ("is_cancelled", "=", False),
                ("date_from", "<=", date_to),
                ("date_to", ">=", date_from),
            ])
            on_leave_emp_ids = set(overlapping_leaves.mapped("employee_id.id"))
            on_leave_emp_ids.add(emp.id)

            overlap_pct = round((len(on_leave_emp_ids) / dept_count) * 100.0, 1)
            res["team_overlap"]["percentage"] = overlap_pct

            if overlap_pct > lt.team_overlap_percent:
                res["team_overlap"]["exceeded"] = True
                if lt.block_overlap_threshold:
                    res["team_overlap"]["blocking"] = True
                    res["eligible"] = False
                    res["errors"].append(
                        _("Team leave overlap threshold (%.1f%%) exceeded (%.1f%% of department on leave). Request blocked under policy.")
                        % (lt.team_overlap_percent, overlap_pct)
                    )
                else:
                    res["warnings"].append(
                        _("Team leave overlap threshold (%.1f%%) exceeded (%.1f%% of department on leave).")
                        % (lt.team_overlap_percent, overlap_pct)
                    )

        return res
