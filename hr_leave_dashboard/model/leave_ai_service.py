# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import AccessError


class LeaveAiService(models.AbstractModel):
    _name = "hr.leave.ai.service"
    _description = "Permission-aware Leave AI Gateway"

    @api.model
    def _provider_state(self):
        params = self.env["ir.config_parameter"].sudo()
        provider = params.get_param("cleon_ai.provider", "none")
        return {
            "provider": provider,
            "model": params.get_param("cleon_ai.model", ""),
            "configured": provider not in ("", "none"),
            "live_calls_enabled": params.get_param("cleon_ai.live_calls_enabled", "False") == "True",
        }

    @api.model
    def _tool_catalog(self, profile):
        tools = [
            {"name": "calendar.summarize", "mode": "read", "description": "Summarize the currently visible calendar period."},
            {"name": "calendar.day_roster", "mode": "read", "description": "List visible absences for one date."},
        ]
        if profile["has_personal_scope"]:
            tools.append({"name": "leave.prepare_request", "mode": "prepare", "requires_confirmation": True, "description": "Prepare, but never silently submit, the current employee's leave request."})
        if profile["can_operate"]:
            tools.append({"name": "leave.prepare_admin_booking", "mode": "prepare", "requires_confirmation": True, "description": "Prepare an administrator booking for explicit review and confirmation."})
        if profile["can_approve"]:
            tools.append({"name": "leave.open_approval_queue", "mode": "navigate", "description": "Open requests assigned to the current approver."})
        return tools

    @api.model
    def get_calendar_assistant_state(self, screen_context=None):
        context = screen_context or {}
        profile = self.env["hr.leave"].get_leave_access_profile()
        if not (profile["has_personal_scope"] or profile["show_organisation_dashboard"]):
            raise AccessError(_("You do not have access to Leave Calendar assistance."))

        requested_scope = context.get("perspective") or "personal"
        can_see_organisation = profile["can_operate"] or profile["can_view_audit"]
        if requested_scope == "organisation" and not can_see_organisation:
            requested_scope = "team" if profile["has_team_scope"] else "personal"
        if requested_scope == "team" and not profile["has_team_scope"]:
            requested_scope = "personal"
        employee_view = requested_scope != "organisation"
        today = fields.Date.context_today(self)
        date_from = context.get("date_from") or fields.Date.to_string(fields.Date.start_of(today, "month"))
        date_to = context.get("date_to") or fields.Date.to_string(fields.Date.end_of(today, "month"))
        filters = context.get("filters") or {}
        data = self.env["hr.leave"].get_leave_calendar_data(
            date_from=date_from,
            date_to=date_to,
            department_ids=filters.get("department_ids"),
            leave_type_ids=filters.get("leave_type_ids"),
            statuses=filters.get("statuses"),
            employee_ids=filters.get("employee_ids"),
            employee_view=employee_view,
            calendar_scope=requested_scope,
        )
        leaves = data["leaves"]
        approved = [leave for leave in leaves if leave["status"] == "approved"]
        pending = [leave for leave in leaves if leave["status"] == "pending"]
        occupancy = {}
        for leave in leaves:
            current = fields.Date.to_date(leave["date_from"])
            end = fields.Date.to_date(leave["date_to"])
            while current <= end:
                if date_from <= fields.Date.to_string(current) <= date_to:
                    occupancy.setdefault(fields.Date.to_string(current), set()).add(leave["employee_id"])
                current = fields.Date.add(current, days=1)
        peak_date, peak_employees = max(
            occupancy.items(), key=lambda item: len(item[1])
        ) if occupancy else (False, set())
        peak_count = len(peak_employees)
        unique_employees = len({leave["employee_id"] for leave in leaves})
        total = max(data["total_active_employees"], 1)
        peak_available = round(max(0, total - peak_count) * 100 / total)
        bullets = [
            _("%(count)s employee(s) have visible leave in this period.", count=unique_employees),
            _("%(approved)s approved and %(pending)s pending request(s) are visible.", approved=len(approved), pending=len(pending)),
        ]
        if peak_date:
            bullets.append(_("The busiest visible date is %(date)s with %(count)s employee(s) away.", date=peak_date, count=peak_count))
            bullets.append(_("Estimated organisation/team availability on that date is %(percentage)s%%.", percentage=peak_available))
        else:
            bullets.append(_("No leave is visible for the selected period and filters."))
        provider = self._provider_state()
        return {
            "screen": "leave_calendar",
            "scope": requested_scope,
            "date_from": date_from,
            "date_to": date_to,
            "bullets": bullets,
            "provider": provider,
            "tools": self._tool_catalog(profile),
            "suggestions": [
                _("Who is on leave this week?"),
                _("Which day has the lowest availability?"),
                _("How many requests are pending?"),
            ],
        }

    @api.model
    def ask_calendar_assistant(self, question, screen_context=None):
        state = self.get_calendar_assistant_state(screen_context)
        provider = state["provider"]
        if not provider["configured"] or not provider["live_calls_enabled"]:
            return {
                "answered": False,
                "message": _("The permission-aware assistant foundation is ready, but no live AI provider has been enabled."),
                "provider": provider,
            }
        return {
            "answered": False,
            "message": _("The selected provider is configured, but its adapter has not been enabled in this build."),
            "provider": provider,
        }
