# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class LeaveAiGateway(models.AbstractModel):
    _inherit = "cleon.ai.gateway"

    @api.model
    def _collect_ai_tools(self, profile=None, screen_context=None):
        tools = super()._collect_ai_tools(profile=profile, screen_context=screen_context)
        context = screen_context or {}
        screen = (context.get("screen") or "").strip()

        # An unattached gateway or non-leave screen receives no leave tools
        leave_screens = (
            "leave.calendar", "leave.requests", "leave.requests.admin",
            "leave.balances", "leave.audit", "leave.configuration",
            "leave.dashboard", "leave.employee_dashboard", "leave.reports",
        )
        if not screen or screen not in leave_screens:
            return tools

        leave_profile = profile or self.env["hr.leave"].get_leave_access_profile()
        has_calendar_access = leave_profile.get("has_personal_scope") or leave_profile.get("show_organisation_dashboard")

        # Calendar tools: strictly scoped to Leave Calendar screen
        if has_calendar_access and screen == "leave.calendar":
            tools.extend([
                {
                    "name": "leave.calendar.summarize",
                    "mode": "read",
                    "available": True,
                    "implemented": True,
                    "requires_confirmation": False,
                    "description": "Summarize the currently visible calendar period.",
                },
                {
                    "name": "leave.calendar.day_roster",
                    "mode": "read",
                    "available": True,
                    "implemented": True,
                    "requires_confirmation": False,
                    "description": "List visible absences for one date using active filters.",
                },
            ])

        # Request preparation tool: available on Calendar, Requests, or Dashboards
        if leave_profile.get("has_personal_scope") and screen in (
            "leave.calendar", "leave.requests", "leave.dashboard", "leave.employee_dashboard"
        ):
            tools.append({
                "name": "leave.prepare_request",
                "mode": "prepare",
                "available": True,
                "implemented": True,
                "requires_confirmation": True,
                "description": "Prepare, but never silently submit, the current employee's leave request.",
            })

        # Admin booking tool: available for operators on Admin Requests, Calendar, or Balances
        if leave_profile.get("can_operate") and screen in (
            "leave.calendar", "leave.requests.admin", "leave.dashboard", "leave.balances"
        ):
            tools.append({
                "name": "leave.prepare_admin_booking",
                "mode": "prepare",
                "available": True,
                "implemented": True,
                "requires_confirmation": True,
                "description": "Prepare an administrator booking for explicit review and confirmation.",
            })

        # Approval navigation tool: available for approvers on Requests or Dashboard
        if leave_profile.get("can_approve") and screen in (
            "leave.requests", "leave.requests.admin", "leave.dashboard"
        ):
            tools.append({
                "name": "leave.open_approval_queue",
                "mode": "navigate",
                "available": True,
                "implemented": True,
                "requires_confirmation": False,
                "description": "Open requests assigned to the current approver.",
            })

        return tools

    @api.model
    def _dispatch_tool_execution(self, tool_name, params, screen_context=None):
        """Execute Leave AI tools with strict execution-time RBAC validation."""
        profile = self.env["hr.leave"].get_leave_access_profile()
        context = screen_context or {}

        if tool_name == "leave.calendar.summarize":
            if not (profile.get("has_personal_scope") or profile.get("show_organisation_dashboard")):
                raise AccessError(_("You do not have permission to view leave calendar data."))
            state = self._build_calendar_ai_context(context, profile)
            return {"ok": True, "bullets": state.get("bullets", [])}

        if tool_name == "leave.calendar.day_roster":
            if not (profile.get("has_personal_scope") or profile.get("show_organisation_dashboard")):
                raise AccessError(_("You do not have permission to view leave calendar data."))

            requested_scope = context.get("perspective")
            if not requested_scope:
                if profile.get("has_personal_scope"):
                    requested_scope = "personal"
                elif profile.get("can_operate") or profile.get("can_view_audit"):
                    requested_scope = "organisation"
                elif profile.get("has_team_scope"):
                    requested_scope = "team"
                else:
                    requested_scope = "personal"

            can_see_organisation = profile.get("can_operate") or profile.get("can_view_audit")
            if requested_scope == "organisation" and not can_see_organisation:
                requested_scope = "team" if profile.get("has_team_scope") else "personal"
            if requested_scope == "team" and not profile.get("has_team_scope"):
                requested_scope = "personal"
            employee_view = requested_scope != "organisation"

            date_str = params.get("date") or fields.Date.to_string(fields.Date.today())
            filters = context.get("filters") or {}
            calendar_data = self.env["hr.leave"].get_leave_calendar_data(
                date_from=date_str,
                date_to=date_str,
                department_ids=filters.get("department_ids"),
                leave_type_ids=filters.get("leave_type_ids"),
                statuses=filters.get("statuses"),
                employee_ids=filters.get("employee_ids"),
                employee_view=employee_view,
                calendar_scope=requested_scope,
            )
            roster = [
                {
                    "id": l["id"],
                    "employee_id": l["employee_id"],
                    "employee_name": l["employee_name"],
                    "leave_type": l.get("leave_type_name") or l.get("leave_type", ""),
                    "status": l.get("status", ""),
                    "duration": l.get("duration", 0),
                }
                for l in calendar_data.get("leaves", [])
            ]
            return {
                "ok": True,
                "date": date_str,
                "scope": requested_scope,
                "count": len(roster),
                "roster": roster,
                "public_holidays": calendar_data.get("public_holidays", []),
            }

        if tool_name == "leave.prepare_request":
            if not profile.get("has_personal_scope"):
                raise AccessError(_("You do not have permission to submit leave requests."))
            return {
                "ok": True,
                "action": "open_request_modal",
                "prepared_values": {
                    "leave_type_id": params.get("leave_type_id"),
                    "date_from": params.get("date_from"),
                    "date_to": params.get("date_to"),
                    "reason": params.get("reason", ""),
                },
            }

        if tool_name == "leave.prepare_admin_booking":
            if not profile.get("can_operate"):
                raise AccessError(_("You do not have permission to book time off for employees."))
            return {
                "ok": True,
                "action": "open_admin_booking_modal",
                "prepared_values": {
                    "employee_id": params.get("employee_id"),
                    "leave_type_id": params.get("leave_type_id"),
                    "date_from": params.get("date_from"),
                    "date_to": params.get("date_to"),
                    "reason": params.get("reason", ""),
                },
            }

        if tool_name == "leave.open_approval_queue":
            if not profile.get("can_approve"):
                raise AccessError(_("You do not have approval permissions."))
            return {"ok": True, "action": "open_approvals_view"}

        return super()._dispatch_tool_execution(tool_name, params, screen_context=screen_context)

    @api.model
    def _get_screen_ai_context(self, screen, screen_context):
        """Handle Leave workspace screens in the generic CleonAI gateway."""
        leave_screens = (
            "leave.calendar", "leave.requests", "leave.requests.admin",
            "leave.balances", "leave.audit", "leave.configuration",
            "leave.dashboard", "leave.employee_dashboard", "leave.reports",
        )
        if screen not in leave_screens:
            return super()._get_screen_ai_context(screen, screen_context)

        profile = self.env["hr.leave"].get_leave_access_profile()
        context = screen_context or {}

        if screen == "leave.calendar":
            return self._build_calendar_ai_context(context, profile)

        provider = self._provider_state()
        tools = self.get_tool_catalog(context)
        result = {
            "screen": screen,
            "scope": "personal",
            "heading": _("Current screen summary"),
            "bullets": [],
            "provider": provider,
            "tools": tools,
            "suggestions": [],
        }

        if screen in ("leave.requests", "leave.requests.admin"):
            status = context.get("status") or "all"
            own = self.env["hr.leave"].get_my_leave_requests(
                status=status if status in ("all", "pending", "approved", "rejected", "changes_requested", "cancelled") else "all",
                search=context.get("search") or "",
                leave_type_id=context.get("leave_type_id") or False,
            )
            approvals = self.env["hr.leave"].get_pending_my_leave_approvals() if profile["can_approve"] else {"count": 0}
            visible_count = len(own.get("rows", []))
            if screen == "leave.requests.admin" and profile["can_operate"]:
                admin_data = self.env["hr.leave"].get_leave_requests_page(
                    search_term=context.get("search") or "",
                    status=status,
                    leave_type_id=context.get("leave_type_id") or False,
                    department_id=context.get("department_id") or False,
                    page=1,
                    page_size=5,
                )
                visible_count = admin_data["pagination"]["total"]
            result.update({
                "scope": "organisation" if screen == "leave.requests.admin" and profile["can_operate"] else "personal and assigned approvals",
                "heading": _("Leave requests and approvals"),
                "bullets": [
                    _("%(count)s request(s) match the current screen filters.", count=visible_count),
                    _("%(count)s request(s) currently await your decision.", count=approvals.get("count", 0)),
                    _("Approved, rejected, cancelled, and changes-requested outcomes remain governed by the configured workflow."),
                ],
                "suggestions": [
                    _("What is awaiting my approval?"),
                    _("Summarize my pending requests."),
                    _("Which requests need attention?"),
                ],
            })
        elif screen == "leave.balances":
            if not profile["can_operate"]:
                raise AccessError(_("You do not have access to Leave Balance assistance."))
            result.update({
                "scope": "organisation",
                "heading": _("Leave balance management"),
                "bullets": [
                    _("Balance information is read from the live entitlement ledger."),
                    _("Allocations and adjustments require explicit review and confirmation."),
                    _("Every committed balance change is recorded in the Audit Log."),
                ],
                "suggestions": [
                    _("Explain the balance formula."),
                    _("What should I verify before allocating?"),
                    _("How are pending days treated?"),
                ],
            })
        elif screen == "leave.audit":
            if not profile["can_view_audit"]:
                raise AccessError(_("You do not have access to Audit assistance."))
            result.update({
                "scope": "allowed companies",
                "heading": _("Leave audit log"),
                "bullets": [
                    _("Audit records are immutable and permission-scoped."),
                    _("Use the screen filters to narrow actions, actors, dates, and affected employees."),
                    _("The assistant cannot alter or delete audit evidence."),
                ],
                "suggestions": [
                    _("Explain the current audit filters."),
                    _("What actions are audited?"),
                    _("How should failed events be investigated?"),
                ],
            })
        elif screen == "leave.configuration":
            if not profile["can_configure"]:
                raise AccessError(_("You do not have access to Configuration assistance."))
            result.update({
                "scope": "organisation configuration",
                "heading": _("Leave configuration"),
                "bullets": [
                    _("Configuration controls policy and general settings; it does not grant operational approval rights."),
                    _("Policy changes affect subsequent validation and are audited."),
                    _("AI automation remains disabled until an administrator explicitly enables a provider."),
                ],
                "suggestions": [
                    _("Explain policy precedence."),
                    _("Which settings affect validation?"),
                    _("Is live AI enabled?"),
                ],
            })
        elif screen in ("leave.dashboard", "leave.employee_dashboard", "leave.reports"):
            result.update({
                "scope": "permission-based",
                "heading": _("Leave workspace"),
                "bullets": [
                    _("This summary is scoped to the capabilities of the signed-in user."),
                    _("Open Calendar, Requests, Balances, Reports, or Audit for screen-specific assistance."),
                ],
                "suggestions": [
                    _("What can I do from this screen?"),
                    _("Where do I review requests?"),
                ],
            })
        return result

    @api.model
    def _build_calendar_ai_context(self, context, profile):
        if not (profile["has_personal_scope"] or profile["show_organisation_dashboard"]):
            raise AccessError(_("You do not have access to Leave Calendar assistance."))

        # Scope resolution: prioritizes safer 'personal' scope when the user is an employee,
        # falling back to 'organisation' only if an operator has no personal employee profile,
        # or 'team' for line managers without organisation-wide access.
        requested_scope = context.get("perspective")
        if not requested_scope:
            if profile.get("has_personal_scope"):
                requested_scope = "personal"
            elif profile.get("can_operate") or profile.get("can_view_audit"):
                requested_scope = "organisation"
            elif profile.get("has_team_scope"):
                requested_scope = "team"
            else:
                requested_scope = "personal"

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

        return {
            "screen": "leave.calendar",
            "scope": requested_scope,
            "heading": _("Current calendar summary"),
            "date_from": date_from,
            "date_to": date_to,
            "bullets": bullets,
            "provider": self._provider_state(),
            "tools": self.get_tool_catalog(context),
            "suggestions": [
                _("Who is on leave this week?"),
                _("Which day has the lowest availability?"),
                _("How many requests are pending?"),
            ],
        }


class LeaveAiService(models.AbstractModel):
    """Leave-specific AI service for approval insights and backward compatibility."""
    _name = "hr.leave.ai.service"
    _description = "Leave AI Service & Approval Decision Support"

    @api.model
    def get_assistant_state(self, screen_context=None):
        return self.env["cleon.ai.gateway"].get_assistant_state(screen_context)

    @api.model
    def ask_assistant(self, question, screen_context=None):
        return self.env["cleon.ai.gateway"].ask_assistant(question, screen_context)

    @api.model
    def get_calendar_assistant_state(self, screen_context=None):
        context = dict(screen_context or {}, screen="leave.calendar")
        return self.env["cleon.ai.gateway"].get_assistant_state(context)

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
                {
                    "key": "balance",
                    "title": _("Balance Impact"),
                    "icon": "fa-balance-scale",
                    "text": _("Available before this request: %(before)s days; projected after approval: %(after)s days.", before=balance["current"], after=balance["remaining"]),
                    "source": _("Live leave balance ledger"),
                },
                {
                    "key": "coverage",
                    "title": _("Team Coverage Impact"),
                    "icon": "fa-users",
                    "text": _("Lowest projected %(department)s availability is %(percentage)s%%; %(other)s other employee(s) overlap.", department=coverage["department"], percentage=coverage["percentage"], other=coverage["other_on_leave"]),
                    "source": _("Calendar and coverage data"),
                },
                {
                    "key": "pattern",
                    "title": _("Leave Pattern"),
                    "icon": "fa-calendar-check-o",
                    "text": _("This employee has %(count)s previous decided leave request(s).", count=len(prior)),
                    "source": _("Employee leave history"),
                },
                {
                    "key": "history",
                    "title": _("Historical Approval Insight"),
                    "icon": "fa-history",
                    "text": _("No comparable decision history is available.") if approval_rate is False else _("%(rate)s%% of this employee's previous decided requests were approved.", rate=approval_rate),
                    "source": _("Approval history"),
                },
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
