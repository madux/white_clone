# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class ResCompany(models.Model):
    _inherit = "res.company"

    leave_notify_in_app = fields.Boolean(
        string="Post Leave Updates in Odoo",
        default=True,
    )
    leave_notify_email = fields.Boolean(
        string="Notify Employees on Leave Updates",
        default=True,
    )
    leave_default_approval_workflow = fields.Selection(
        [
            ("none", "No Approval Required"),
            ("single", "Single Approver"),
            ("multi", "Multi-level Approval"),
        ],
        string="Default Approval Workflow",
        default="single",
        required=True,
    )
    leave_default_supporting_document_policy = fields.Selection(
        [
            ("always", "Always Required"),
            ("conditional", "Conditional (>3 days)"),
            ("never", "Never Required"),
        ],
        string="Default Supporting Document Policy",
        default="never",
        required=True,
    )
    leave_default_minimum_notice_days = fields.Integer(
        string="Default Minimum Notice (days)",
        default=0,
    )
    leave_default_allow_half_day = fields.Boolean(
        string="Allow Half-day by Default",
        default=True,
    )
    leave_default_allow_carryover = fields.Boolean(
        string="Allow Carry-over by Default",
        default=True,
    )
    leave_default_max_balance_cap = fields.Float(
        string="Default Maximum Balance Cap",
        default=0.0,
    )
    leave_default_allow_negative_balance = fields.Boolean(
        string="Allow Negative Balance by Default",
        default=False,
    )
    leave_default_team_overlap_percent = fields.Float(
        string="Default Team Overlap Limit (%)",
        default=0.0,
    )
    leave_default_block_overlap_threshold = fields.Boolean(
        string="Block Requests Above Overlap Limit by Default",
        default=False,
    )
    leave_year_basis = fields.Selection([("calendar", "Calendar Year"), ("financial", "Financial Year"), ("anniversary", "Employee Anniversary")], default="calendar", required=True)
    leave_default_unit = fields.Selection([("days", "Days"), ("hours", "Hours")], default="days", required=True)
    leave_default_balance_enforcement = fields.Selection([("strict", "Strict"), ("negative", "Allow Negative")], default="strict", required=True)
    leave_calendar_privacy = fields.Selection([("full", "Full"), ("limited", "Limited"), ("anonymous", "Anonymous")], default="limited", required=True)
    leave_default_calendar_view = fields.Selection([("month", "Month"), ("week", "Week"), ("team", "Team"), ("organisation", "Organisation")], default="month", required=True)
    leave_calendar_future_months = fields.Integer(string="Calendar Future Visibility (Months)", default=24)
    leave_show_rejected = fields.Boolean(default=False)
    leave_show_cancelled = fields.Boolean(default=False)
    leave_ending_soon_days = fields.Integer(default=1)
    leave_notify_manager_ending = fields.Boolean(default=True)
    leave_return_reminder = fields.Boolean(default=True)
    leave_overdue_reminder_days = fields.Integer(default=0)
    leave_require_return_confirmation = fields.Boolean(default=False)
    leave_employee_access_during_leave = fields.Selection([("normal", "Normal Access"), ("limited", "Limited Access"), ("self_service", "Leave Self-Service Only"), ("custom", "Custom")], default="normal", required=True)
    leave_return_handling = fields.Selection([("attendance", "Attendance Clock-In"), ("employee", "Employee Confirmation"), ("manager", "Manager Confirmation"), ("hr", "HR Recorded"), ("hybrid", "Hybrid")], default="attendance", required=True)
    leave_return_grace_days = fields.Integer(default=0)
    leave_extensions_allowed = fields.Boolean(default=True)
    leave_max_extension_days = fields.Integer(default=0)
    leave_clock_integration = fields.Boolean(default=False)
    leave_payroll_integration = fields.Boolean(default=False)
    leave_directory_integration = fields.Boolean(default=False)
    leave_calendar_integration = fields.Boolean(default=False)
    leave_ai_enabled = fields.Boolean(default=True)
    leave_ai_audit_logging = fields.Boolean(default=True)

    # LM-046 AI Capabilities Configuration & Governance
    leave_ai_assistant_enabled = fields.Boolean(
        string="AI Leave Assistant", default=True,
        help="LM-038: Persistent interactive chat assistant.",
    )
    leave_ai_nl_request_enabled = fields.Boolean(
        string="Natural Language Leave Request", default=True,
        help="LM-039: Free-text request submission and auto-fill.",
    )
    leave_ai_date_recommendations_enabled = fields.Boolean(
        string="Smart Leave Date Recommendations", default=True,
        help="LM-040: Intelligent date window suggestions.",
    )
    leave_ai_conflict_coverage_enabled = fields.Boolean(
        string="AI Conflict & Coverage Detection", default=True,
        help="LM-041: Automatic staffing overlap detection and risk warnings.",
    )
    leave_ai_approval_support_enabled = fields.Boolean(
        string="AI Approval Decision Support", default=True,
        help="LM-042: Advisory insight panel for approvers.",
    )
    leave_ai_anomaly_detection_enabled = fields.Boolean(
        string="Fraud & Anomaly Detection", default=True,
        help="LM-043: Pattern analysis and HR anomaly alerts.",
    )
    leave_ai_calendar_summary_enabled = fields.Boolean(
        string="AI Calendar & Availability Summary", default=True,
        help="LM-044: On-demand calendar and availability summaries.",
    )
    leave_ai_executive_brief_enabled = fields.Boolean(
        string="Executive Workforce Brief", default=True,
        help="LM-045: High-level analytics and executive workforce briefs.",
    )
    leave_ai_conversation_retention_days = fields.Integer(
        string="AI Conversation Retention (Days)", default=90,
        help="Retention period in days for logged AI conversations.",
    )

    @api.constrains(
        "leave_default_minimum_notice_days",
        "leave_default_max_balance_cap",
        "leave_default_team_overlap_percent",
        "leave_ending_soon_days", "leave_overdue_reminder_days",
        "leave_return_grace_days", "leave_max_extension_days",
    )
    def _check_leave_settings_values(self):
        for company in self:
            if min(company.leave_default_minimum_notice_days, company.leave_ending_soon_days,
                   company.leave_overdue_reminder_days, company.leave_return_grace_days,
                   company.leave_max_extension_days, company.leave_calendar_future_months) < 0:
                raise ValidationError(_("Minimum notice cannot be negative."))
            if company.leave_default_max_balance_cap < 0:
                raise ValidationError(_("Maximum balance cap cannot be negative."))
            if not 0 <= company.leave_default_team_overlap_percent <= 100:
                raise ValidationError(_("Team overlap percentage must be between 0 and 100."))


class HrLeaveSettings(models.Model):
    _inherit = "hr.leave"

    def _post_configured_leave_update(self, body, subject=None):
        """Post and/or address an employee update using company preferences."""
        self.ensure_one()
        company = self.employee_id.company_id or self.env.company
        in_app = company.leave_notify_in_app
        email = company.leave_notify_email
        if not in_app and not email:
            return self.env["mail.message"]
        partner = self.employee_id.user_id.partner_id if self.employee_id.user_id else False
        partner_ids = partner.ids if email and partner else []
        if in_app:
            return self.message_post(body=body, subject=subject, partner_ids=partner_ids)
        if partner_ids:
            return self.message_notify(body=body, subject=subject, partner_ids=partner_ids)
        return self.env["mail.message"]

    @api.model
    def _check_leave_settings_access(self):
        if not self.env.user.has_group(
            "hr_leave_dashboard.group_leave_permission_configuration"
        ):
            raise AccessError(_("Only a Time Off Administrator can manage Leave settings."))

    @api.model
    def _leave_settings_payload(self):
        company = self.env.company
        calendar = company.resource_calendar_id
        today = fields.Date.context_today(self)
        holiday_domain = [
            ("company_id", "in", [False, company.id]),
            ("resource_id", "=", False),
            ("date_to", ">=", fields.Datetime.to_string(today)),
        ]
        if calendar:
            holiday_domain += ["|", ("calendar_id", "=", False), ("calendar_id", "=", calendar.id)]
        holidays = self.env["resource.calendar.leaves"].sudo().search(
            holiday_domain, order="date_from asc", limit=8
        )
        working_days = []
        if calendar:
            day_labels = dict(calendar.attendance_ids._fields["dayofweek"].selection)
            working_days = [
                {"key": key, "label": day_labels.get(key, key)}
                for key in sorted(set(calendar.attendance_ids.filtered(lambda row: not row.display_type).mapped("dayofweek")))
            ]

        leave_types = self.env["hr.leave.type"].sudo().search([
            ("active", "=", True),
            "|", ("company_id", "=", False), ("company_id", "=", company.id),
        ])
        workflow_counts = {"none": 0, "single": 0, "multi": 0}
        for leave_type in leave_types:
            workflow_counts[leave_type.approval_workflow or "single"] += 1

        role_category = self.env.ref(
            "hr_leave_dashboard.module_category_leave_management"
        )
        role_groups = self.env["res.groups"].sudo().search([
            ("category_id", "=", role_category.id),
        ], order="name")
        external_ids = role_groups.get_external_id()
        roles = [{
            "id": group.id,
            "xmlid": external_ids.get(group.id) or "res.groups,%d" % group.id,
            "name": group.name,
            "description": group.comment or _("Configurable Leave Management role"),
            "users": len(group.users),
        } for group in role_groups]

        return {
            "company": {"id": company.id, "name": company.name},
            "form": {
                "country_id": company.country_id.id or False,
                "resource_calendar_id": calendar.id or False,
                "notify_in_app": bool(company.leave_notify_in_app),
                "notify_email": bool(company.leave_notify_email),
                "default_approval_workflow": company.leave_default_approval_workflow,
                "default_supporting_document_policy": company.leave_default_supporting_document_policy,
                "default_minimum_notice_days": company.leave_default_minimum_notice_days,
                "default_allow_half_day": bool(company.leave_default_allow_half_day),
                "default_allow_carryover": bool(company.leave_default_allow_carryover),
                "default_max_balance_cap": company.leave_default_max_balance_cap,
                "default_allow_negative_balance": bool(company.leave_default_allow_negative_balance),
                "default_team_overlap_percent": company.leave_default_team_overlap_percent,
                "default_block_overlap_threshold": bool(company.leave_default_block_overlap_threshold),
                "year_basis": company.leave_year_basis, "default_unit": company.leave_default_unit,
                "default_balance_enforcement": company.leave_default_balance_enforcement,
                "calendar_privacy": company.leave_calendar_privacy, "default_calendar_view": company.leave_default_calendar_view,
                "calendar_future_months": company.leave_calendar_future_months,
                "show_rejected": company.leave_show_rejected, "show_cancelled": company.leave_show_cancelled,
                "ending_soon_days": company.leave_ending_soon_days, "notify_manager_ending": company.leave_notify_manager_ending,
                "return_reminder": company.leave_return_reminder, "overdue_reminder_days": company.leave_overdue_reminder_days,
                "require_return_confirmation": company.leave_require_return_confirmation,
                "employee_access_during_leave": company.leave_employee_access_during_leave,
                "return_handling": company.leave_return_handling, "return_grace_days": company.leave_return_grace_days,
                "extensions_allowed": company.leave_extensions_allowed, "max_extension_days": company.leave_max_extension_days,
                "clock_integration": company.leave_clock_integration, "payroll_integration": company.leave_payroll_integration,
                "directory_integration": company.leave_directory_integration, "calendar_integration": company.leave_calendar_integration,
                "ai_enabled": company.leave_ai_enabled, "ai_audit_logging": company.leave_ai_audit_logging,
                "ai_assistant_enabled": company.leave_ai_assistant_enabled,
                "ai_nl_request_enabled": company.leave_ai_nl_request_enabled,
                "ai_date_recommendations_enabled": company.leave_ai_date_recommendations_enabled,
                "ai_conflict_coverage_enabled": company.leave_ai_conflict_coverage_enabled,
                "ai_approval_support_enabled": company.leave_ai_approval_support_enabled,
                "ai_anomaly_detection_enabled": company.leave_ai_anomaly_detection_enabled,
                "ai_calendar_summary_enabled": company.leave_ai_calendar_summary_enabled,
                "ai_executive_brief_enabled": company.leave_ai_executive_brief_enabled,
                "ai_conversation_retention_days": company.leave_ai_conversation_retention_days or 90,
            },
            "countries": [
                {"id": country.id, "name": country.name, "code": country.code or ""}
                for country in self.env["res.country"].sudo().search([], order="name")
            ],
            "calendars": [
                {
                    "id": item.id,
                    "name": item.name,
                    "timezone": item.tz or "UTC",
                    "hours_per_week": round(
                        sum(
                            row.hour_to - row.hour_from
                            for row in item.attendance_ids.filtered(lambda row: not row.display_type)
                        ) / (2 if item.two_weeks_calendar else 1),
                        2,
                    ),
                    "working_days": [
                        dict(item.attendance_ids._fields["dayofweek"].selection).get(key, key)
                        for key in sorted(set(item.attendance_ids.filtered(lambda row: not row.display_type).mapped("dayofweek")))
                    ],
                }
                for item in self.env["resource.calendar"].sudo().search([
                    "|", ("company_id", "=", False), ("company_id", "=", company.id)
                ], order="name")
            ],
            "working_days": working_days,
            "holidays": [
                {
                    "id": holiday.id,
                    "name": holiday.name,
                    "date": fields.Date.to_string(holiday.date_from.date()),
                }
                for holiday in holidays
            ],
            "policy_summary": {
                "leave_type_count": len(leave_types),
                "carryover_count": len(leave_types.filtered("allow_carryover")),
                "document_count": len(leave_types.filtered(lambda item: item.supporting_document_policy != "never")),
                "workflow_counts": workflow_counts,
            },
            "roles": roles,
        }

    @api.model
    def get_leave_settings(self):
        self._check_leave_settings_access()
        return self._leave_settings_payload()

    @api.model
    def save_leave_settings(self, values):
        self._check_leave_settings_access()
        company = self.env.company
        before = self._leave_settings_payload()["form"]

        # AI & Automation fields require the dedicated AI-Config permission.
        _ai_fields = {
            "ai_enabled", "ai_assistant_enabled", "ai_nl_request_enabled",
            "ai_date_recommendations_enabled", "ai_conflict_coverage_enabled",
            "ai_approval_support_enabled", "ai_anomaly_detection_enabled",
            "ai_calendar_summary_enabled", "ai_executive_brief_enabled",
            "ai_conversation_retention_days",
        }
        caller_has_ai_config = self.env.user.has_group(
            "hr_leave_dashboard.group_leave_permission_ai_config"
        )
        ai_values_changed = {
            key for key in _ai_fields
            if key in values and values.get(key) != before.get(key)
        }
        if ai_values_changed and not caller_has_ai_config:
            raise AccessError(
                _("Only a user with the 'AI Configuration' permission can change AI & Automation settings.")
            )

        country = self.env["res.country"].sudo().browse(int(values.get("country_id") or 0)).exists()
        calendar = self.env["resource.calendar"].sudo().browse(int(values.get("resource_calendar_id") or 0)).exists()
        if not calendar or (calendar.company_id and calendar.company_id != company):
            raise ValidationError(_("Select a working schedule available to this company."))
        vals = {
            "country_id": country.id or False,
            "resource_calendar_id": calendar.id,
            "leave_notify_in_app": bool(values.get("notify_in_app")),
            "leave_notify_email": bool(values.get("notify_email")),
            "leave_default_approval_workflow": values.get("default_approval_workflow") or "single",
            "leave_default_supporting_document_policy": values.get("default_supporting_document_policy") or "never",
            "leave_default_minimum_notice_days": int(values.get("default_minimum_notice_days") or 0),
            "leave_default_allow_half_day": bool(values.get("default_allow_half_day")),
            "leave_default_allow_carryover": bool(values.get("default_allow_carryover")),
            "leave_default_max_balance_cap": float(values.get("default_max_balance_cap") or 0),
            "leave_default_allow_negative_balance": bool(values.get("default_allow_negative_balance")),
            "leave_default_team_overlap_percent": float(values.get("default_team_overlap_percent") or 0),
            "leave_default_block_overlap_threshold": bool(values.get("default_block_overlap_threshold")),
            "leave_year_basis": values.get("year_basis") or "calendar", "leave_default_unit": values.get("default_unit") or "days",
            "leave_default_balance_enforcement": values.get("default_balance_enforcement") or "strict",
            "leave_calendar_privacy": values.get("calendar_privacy") or "limited", "leave_default_calendar_view": values.get("default_calendar_view") or "month",
            "leave_calendar_future_months": int(values.get("calendar_future_months") or 24),
            "leave_show_rejected": bool(values.get("show_rejected")), "leave_show_cancelled": bool(values.get("show_cancelled")),
            "leave_ending_soon_days": int(values.get("ending_soon_days") or 0), "leave_notify_manager_ending": bool(values.get("notify_manager_ending")),
            "leave_return_reminder": bool(values.get("return_reminder")), "leave_overdue_reminder_days": int(values.get("overdue_reminder_days") or 0),
            "leave_require_return_confirmation": bool(values.get("require_return_confirmation")),
            "leave_employee_access_during_leave": values.get("employee_access_during_leave") or "normal",
            "leave_return_handling": values.get("return_handling") or "attendance", "leave_return_grace_days": int(values.get("return_grace_days") or 0),
            "leave_extensions_allowed": bool(values.get("extensions_allowed")), "leave_max_extension_days": int(values.get("max_extension_days") or 0),
            "leave_clock_integration": bool(values.get("clock_integration")), "leave_payroll_integration": bool(values.get("payroll_integration")),
            "leave_directory_integration": bool(values.get("directory_integration")), "leave_calendar_integration": bool(values.get("calendar_integration")),
        }
        # Only apply AI fields when the caller has the AI-Config permission.
        if caller_has_ai_config:
            vals.update({
                "leave_ai_enabled": bool(values.get("ai_enabled")),
                "leave_ai_audit_logging": True,
                "leave_ai_assistant_enabled": bool(values.get("ai_assistant_enabled", True)),
                "leave_ai_nl_request_enabled": bool(values.get("ai_nl_request_enabled", True)),
                "leave_ai_date_recommendations_enabled": bool(values.get("ai_date_recommendations_enabled", True)),
                "leave_ai_conflict_coverage_enabled": bool(values.get("ai_conflict_coverage_enabled", True)),
                "leave_ai_approval_support_enabled": bool(values.get("ai_approval_support_enabled", True)),
                "leave_ai_anomaly_detection_enabled": bool(values.get("ai_anomaly_detection_enabled", True)),
                "leave_ai_calendar_summary_enabled": bool(values.get("ai_calendar_summary_enabled", True)),
                "leave_ai_executive_brief_enabled": bool(values.get("ai_executive_brief_enabled", True)),
                "leave_ai_conversation_retention_days": max(1, int(values.get("ai_conversation_retention_days") or 90)),
            })
        company.sudo().write(vals)
        after = self._leave_settings_payload()["form"]
        self.env["hr.leave.audit.log"].sudo().create({
            "action": "settings_change",
            "company_id": company.id,
            "actor_id": self.env.user.id,
            "actor_label": self.env.user.name,
            "actor_role": "System Administrator" if self.env.user.has_group("base.group_system") else "Time Off Administrator",
            "entity_name": _("Leave Management Settings"),
            "entity_reference": company.name,
            "before_values": before,
            "after_values": after,
            "description": _("Updated company-wide Leave Management settings."),
        })
        return self._leave_settings_payload()

    @api.model
    def reset_leave_policy_defaults(self):
        self._check_leave_settings_access()
        values = self._leave_settings_payload()["form"]
        values.update({
            "notify_in_app": True,
            "notify_email": True,
            "default_approval_workflow": "single",
            "default_supporting_document_policy": "never",
            "default_minimum_notice_days": 0,
            "default_allow_half_day": True,
            "default_allow_carryover": True,
            "default_max_balance_cap": 0,
            "default_allow_negative_balance": False,
            "default_team_overlap_percent": 0,
            "default_block_overlap_threshold": False,
        })
        return self.save_leave_settings(values)


class HrLeaveTypeSettingsDefaults(models.Model):
    _inherit = "hr.leave.type"

    @api.model_create_multi
    def create(self, vals_list):
        for values in vals_list:
            company = self.env["res.company"].browse(values.get("company_id")) if values.get("company_id") else self.env.company
            workflow = company.leave_default_approval_workflow or "single"
            values.setdefault("approval_workflow", workflow)
            values.setdefault("leave_validation_type", {"none": "no_validation", "single": "hr", "multi": "both"}[workflow])
            document_policy = company.leave_default_supporting_document_policy or "never"
            values.setdefault("supporting_document_policy", document_policy)
            values.setdefault("support_document", document_policy != "never")
            values.setdefault("minimum_notice_days", company.leave_default_minimum_notice_days)
            values.setdefault("allow_half_day", company.leave_default_allow_half_day)
            values.setdefault("allow_carryover", company.leave_default_allow_carryover)
            values.setdefault("max_balance_cap", company.leave_default_max_balance_cap)
            values.setdefault("allow_negative_balance", company.leave_default_allow_negative_balance)
            values.setdefault("team_overlap_percent", company.leave_default_team_overlap_percent)
            values.setdefault("block_overlap_threshold", company.leave_default_block_overlap_threshold)
        return super().create(vals_list)
