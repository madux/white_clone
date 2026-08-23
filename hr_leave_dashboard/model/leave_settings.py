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

    @api.constrains(
        "leave_default_minimum_notice_days",
        "leave_default_max_balance_cap",
        "leave_default_team_overlap_percent",
    )
    def _check_leave_settings_values(self):
        for company in self:
            if company.leave_default_minimum_notice_days < 0:
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
        if not (
            self.env.user.has_group("hr_holidays.group_hr_holidays_manager")
            or self.env.user.has_group("base.group_system")
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

        role_refs = [
            ("base.group_system", _("System Administrator"), _("All system and Leave Management configuration")),
            ("hr_holidays.group_hr_holidays_manager", _("Time Off Administrator"), _("Policies, balances, requests, reports and audit")),
            ("hr_holidays.group_hr_holidays_user", _("Time Off Officer"), _("Operational request and allocation processing")),
            ("base.group_user", _("Employee"), _("Personal leave requests and balances according to record rules")),
        ]
        roles = []
        for xmlid, label, description in role_refs:
            group = self.env.ref(xmlid, raise_if_not_found=False)
            roles.append({
                "xmlid": xmlid,
                "name": label,
                "description": description,
                "users": len(group.sudo().users) if group else 0,
            })

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
            },
            "countries": [
                {"id": country.id, "name": country.name, "code": country.code or ""}
                for country in self.env["res.country"].sudo().search([], order="name")
            ],
            "calendars": [
                {
                    "id": item.id,
                    "name": item.name,
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
        }
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
