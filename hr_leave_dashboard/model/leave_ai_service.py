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
            "heading": _("Current calendar summary"),
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
    def get_assistant_state(self, screen_context=None):
        """Return a server-authorised summary for the currently visible screen."""
        context = screen_context or {}
        screen = context.get("screen") or ""
        if screen == "leave_calendar":
            return self.get_calendar_assistant_state(context)

        profile = self.env["hr.leave"].get_leave_access_profile()
        provider = self._provider_state()
        result = {
            "screen": screen,
            "scope": "personal",
            "heading": _("Current screen summary"),
            "bullets": [],
            "provider": provider,
            "tools": self._tool_catalog(profile),
            "suggestions": [],
        }
        if screen in ("leave_requests", "leave_requests_admin"):
            status = context.get("status") or "all"
            own = self.env["hr.leave"].get_my_leave_requests(
                status=status if status in ("all", "pending", "approved", "rejected", "changes_requested", "cancelled") else "all",
                search=context.get("search") or "",
                leave_type_id=context.get("leave_type_id") or False,
            )
            approvals = self.env["hr.leave"].get_pending_my_leave_approvals() if profile["can_approve"] else {"count": 0}
            visible_count = len(own.get("rows", []))
            if screen == "leave_requests_admin" and profile["can_operate"]:
                admin_data = self.env["hr.leave"].get_leave_requests_page(
                    search_term=context.get("search") or "", status=status,
                    leave_type_id=context.get("leave_type_id") or False,
                    department_id=context.get("department_id") or False,
                    page=1, page_size=5,
                )
                visible_count = admin_data["pagination"]["total"]
            result.update({
                "scope": "organisation" if screen == "leave_requests_admin" and profile["can_operate"] else "personal and assigned approvals",
                "heading": _("Leave requests and approvals"),
                "bullets": [
                    _("%(count)s request(s) match the current screen filters.", count=visible_count),
                    _("%(count)s request(s) currently await your decision.", count=approvals.get("count", 0)),
                    _("Approved, rejected, cancelled, and changes-requested outcomes remain governed by the configured workflow."),
                ],
                "suggestions": [_("What is awaiting my approval?"), _("Summarize my pending requests."), _("Which requests need attention?")],
            })
        elif screen == "leave_balances":
            if not profile["can_operate"]:
                raise AccessError(_("You do not have access to Leave Balance assistance."))
            result.update({"scope": "organisation", "heading": _("Leave balance management"), "bullets": [_("Balance information is read from the live entitlement ledger."), _("Allocations and adjustments require explicit review and confirmation."), _("Every committed balance change is recorded in the Audit Log.")], "suggestions": [_("Explain the balance formula."), _("What should I verify before allocating?"), _("How are pending days treated?")]})
        elif screen == "leave_audit":
            if not profile["can_view_audit"]:
                raise AccessError(_("You do not have access to Audit assistance."))
            result.update({"scope": "allowed companies", "heading": _("Leave audit log"), "bullets": [_("Audit records are immutable and permission-scoped."), _("Use the screen filters to narrow actions, actors, dates, and affected employees."), _("The assistant cannot alter or delete audit evidence.")], "suggestions": [_("Explain the current audit filters."), _("What actions are audited?"), _("How should failed events be investigated?")]})
        elif screen == "leave_configuration":
            if not profile["can_configure"]:
                raise AccessError(_("You do not have access to Configuration assistance."))
            result.update({"scope": "organisation configuration", "heading": _("Leave configuration"), "bullets": [_("Configuration controls policy and general settings; it does not grant operational approval rights."), _("Policy changes affect subsequent validation and are audited."), _("AI automation remains disabled until an administrator explicitly enables a provider.")], "suggestions": [_("Explain policy precedence."), _("Which settings affect validation?"), _("Is live AI enabled?")]})
        elif screen in ("leave_dashboard", "employee_dashboard", "leave_reports"):
            result.update({"scope": "permission-based", "heading": _("Leave workspace"), "bullets": [_("This summary is scoped to the capabilities of the signed-in user."), _("Open Calendar, Requests, Balances, Reports, or Audit for screen-specific assistance.")], "suggestions": [_("What can I do from this screen?"), _("Where do I review requests?")]})
        else:
            raise AccessError(_("This screen has not published an approved Leave assistant context."))
        return result

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

    @api.model
    def ask_assistant(self, question, screen_context=None):
        state = self.get_assistant_state(screen_context)
        provider = state["provider"]
        if not provider["configured"] or not provider["live_calls_enabled"]:
            return {"answered": False, "message": _("The permission-aware assistant foundation is ready for %(screen)s, but no live AI provider has been enabled.", screen=state["heading"]), "provider": provider}
        return {"answered": False, "message": _("The selected provider is configured, but its adapter has not been enabled in this build."), "provider": provider}

    @api.model
    def get_approval_insights(self, leave_id):
        """Build advisory facts from existing ledgers; never make a decision."""
        leave = self.env["hr.leave"].sudo().browse(int(leave_id)).exists()
        if not leave or not leave._leave_can_review(self.env.user):
            raise AccessError(_("Only the assigned approver can view approval insights."))
        detail = self.env["hr.leave"].get_leave_request_detail(leave.id)
        prior = self.env["hr.leave"].sudo().search([
            ("employee_id", "=", leave.employee_id.id), ("id", "!=", leave.id),
            ("state", "in", ("validate", "refuse")),
        ])
        approved = len(prior.filtered(lambda item: item.state == "validate"))
        approval_rate = round(approved * 100 / len(prior)) if prior else False
        coverage = detail["coverage_impact"]
        balance = detail["balance_impact"]
        conflict = coverage["percentage"] < 70
        return {
            "generated_at": fields.Datetime.to_string(fields.Datetime.now()),
            "advisory_only": True,
            "conflict": conflict,
            "insights": [
                {"key": "balance", "title": _("Balance Impact"), "icon": "fa-balance-scale", "text": _("Available before this request: %(before)s days; projected after approval: %(after)s days.", before=balance["current"], after=balance["remaining"]), "source": _("Live leave balance ledger")},
                {"key": "coverage", "title": _("Team Coverage Impact"), "icon": "fa-users", "text": _("Lowest projected %(department)s availability is %(percentage)s%%; %(other)s other employee(s) overlap.", department=coverage["department"], percentage=coverage["percentage"], other=coverage["other_on_leave"]), "source": _("Calendar and coverage data")},
                {"key": "pattern", "title": _("Leave Pattern"), "icon": "fa-calendar-check-o", "text": _("This employee has %(count)s previous decided leave request(s).", count=len(prior)), "source": _("Employee leave history")},
                {"key": "history", "title": _("Historical Approval Insight"), "icon": "fa-history", "text": _("No comparable decision history is available.") if approval_rate is False else _("%(rate)s%% of this employee's previous decided requests were approved.", rate=approval_rate), "source": _("Approval history")},
            ],
            "recommendation": _("Review balance, policy validation, supporting documents, and team coverage before deciding. The final decision remains entirely with the approver."),
        }

    @api.model
    def record_approval_insight_feedback(self, leave_id, helpful):
        leave = self.env["hr.leave"].sudo().browse(int(leave_id)).exists()
        if not leave or not leave._leave_can_review(self.env.user):
            raise AccessError(_("Only the assigned approver can rate this insight."))
        leave._create_audit_record(
            "insight_feedback",
            note=_("Approval insight marked %(rating)s.", rating=_("helpful") if helpful else _("not helpful")),
        )
        return {"ok": True}
