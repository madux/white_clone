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

        can_summarize = self.env["hr.leave"].is_ai_capability_enabled("calendar_summary")
        # Calendar tools: strictly scoped to Leave Calendar screen
        if has_calendar_access and screen == "leave.calendar":
            if can_summarize:
                tools.append({
                    "name": "leave.calendar.summarize",
                    "mode": "read",
                    "available": True,
                    "implemented": True,
                    "requires_confirmation": False,
                    "description": "Summarize the currently visible calendar period.",
                })
            tools.append({
                "name": "leave.calendar.day_roster",
                "mode": "read",
                "available": True,
                "implemented": True,
                "requires_confirmation": False,
                "description": "List visible absences for one date using active filters.",
            })

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
            if not self.env["hr.leave"].is_ai_capability_enabled("calendar_summary"):
                raise AccessError(_("AI Calendar & Availability Summary is disabled by organisation governance."))
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

        if not self.env["hr.leave"].is_ai_capability_enabled("assistant"):
            raise AccessError(_("The CleonAI Assistant is disabled by organisation governance."))

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
        # Department absence breakdown
        dept_counts = {}
        for leave in leaves:
            d_name = leave.get("department_name") or _("Unassigned")
            dept_counts[d_name] = dept_counts.get(d_name, 0) + 1
        top_dept_item = max(dept_counts.items(), key=lambda x: x[1]) if dept_counts else None

        bullets = [
            _("%(count)s employee(s) are on leave in this period.", count=unique_employees),
        ]
        if top_dept_item:
            bullets.append(_("%(dept)s has the highest number of absences (%(count)d employees).", dept=top_dept_item[0], count=top_dept_item[1]))

        if peak_date:
            try:
                from datetime import datetime
                d_obj = datetime.strptime(peak_date, "%Y-%m-%d")
                day_name = d_obj.strftime("%A")
            except Exception:
                day_name = peak_date
            bullets.append(_("%(day)s (%(date)s) has the lowest workforce availability (%(pct)d%% available).", day=day_name, date=peak_date, pct=peak_available))

        public_holidays = data.get("public_holidays", [])
        if public_holidays:
            holiday_names = [h.get("name") for h in public_holidays[:2] if h.get("name")]
            if holiday_names:
                bullets.append(_("Public holiday: %(name)s.", name=", ".join(holiday_names)))

        # Conflict detection: threshold > 40% overlap (i.e. < 60% availability)
        if peak_available < 60:
            bullets.append(_("Staffing coverage risk detected on %(date)s (availability below 60%%).", date=peak_date))
        else:
            bullets.append(_("No staffing conflicts detected."))

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
    def transcribe_leave_request_audio(self, audio_data, mimetype="audio/webm"):
        if not self.env["hr.leave"].is_ai_capability_enabled("nl_request"):
            raise AccessError(_("AI Natural Language Leave Request Submission is disabled by organisation governance."))
        self.env["hr.leave"]._employee_for_current_user()
        return self.env["cleon.ai.gateway"].transcribe_audio(audio_data, mimetype)

    @api.model
    def get_calendar_assistant_state(self, screen_context=None):
        context = dict(screen_context or {}, screen="leave.calendar")
        return self.env["cleon.ai.gateway"].get_assistant_state(context)

    @api.model
    def get_approval_insights(self, leave_id):
        """Build advisory facts from existing ledgers; never make a decision."""
        if not self.env["hr.leave"].is_ai_capability_enabled("approval_support"):
            return {
                "enabled": False,
                "message": _("AI Approval Decision Support is disabled by organisation governance."),
            }
        leave = self.env["hr.leave"].sudo().browse(int(leave_id)).exists()
        if not leave or not leave._leave_can_review(self.env.user):
            raise AccessError(_("Only the assigned approver can view approval insights."))
        detail = self.env["hr.leave"].get_leave_request_detail(leave.id)

        # Similar history: prior decided requests of the same leave type if available, else general
        all_prior = self.env["hr.leave"].sudo().search([
            ("employee_id", "=", leave.employee_id.id), ("id", "!=", leave.id),
            ("state", "in", ("validate", "refuse")),
        ])
        same_type_prior = all_prior.filtered(lambda item: item.holiday_status_id == leave.holiday_status_id)
        prior = same_type_prior or all_prior
        approved = len(prior.filtered(lambda item: item.state == "validate"))
        approval_rate = round(approved * 100 / len(prior)) if prior else False

        coverage = detail["coverage_impact"]
        balance = detail["balance_impact"]

        # Configurable conflict threshold: default >40% overlap (meaning <60% availability)
        threshold_pct = float(self.env.company.leave_default_team_overlap_percent or 40.0)
        min_avail_pct = max(0.0, 100.0 - threshold_pct)
        conflict = float(coverage.get("percentage") or 100.0) < min_avail_pct

        factors = [
            _("Balance: %(status)s (%(rem)s days remaining)",
              status=_("Sufficient") if balance["remaining"] >= 0 else _("Insufficient"),
              rem=balance["remaining"]),
            _("Coverage: %(pct)s%% projected %(dept)s availability",
              pct=coverage["percentage"], dept=coverage["department"]),
            _("Conflicts: %(cnt)s other employee(s) overlapping",
              cnt=coverage["other_on_leave"]),
            _("Similar History: %(app)s of %(tot)s comparable request(s) approved",
              app=approved, tot=len(prior)) if prior else _("Similar History: No prior comparable history"),
        ]

        return {
            "enabled": True,
            "generated_at": fields.Datetime.to_string(fields.Datetime.now()),
            "advisory_only": True,
            "conflict": conflict,
            "conflict_message": _("Staffing coverage is projected below %d%% (team absence exceeds %d%%). Verify the coverage details before deciding.") % (int(min_avail_pct), int(threshold_pct)),
            "factors": factors,
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
                    "text": _("This employee has %(count)s previous decided leave request(s).", count=len(all_prior)),
                    "source": _("Employee leave history"),
                },
                {
                    "key": "history",
                    "title": _("Historical Approval Insight"),
                    "icon": "fa-history",
                    "text": _("No comparable decision history is available.") if approval_rate is False else _("%(rate)s%% of comparable requests (%(app)s/%(tot)s) were approved.", rate=approval_rate, app=approved, tot=len(prior)),
                    "source": _("Approval history"),
                },
            ],
            "recommendation": _("This request appears eligible, but review balance, policy compliance, supporting documents, and team coverage before deciding. Final approval/rejection remains entirely with the approver."),
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

    @api.model
    def _provider_parse_nl_request(self, text, available_types, today):
        """Extract structured leave fields with the configured provider.

        Responses are validated against real Odoo leave types and dates. Any
        provider or parsing failure returns ``None`` for deterministic fallback.
        """
        import json
        import re
        gateway = self.env["cleon.ai.gateway"]
        state = gateway._provider_state()
        if not state.get("configured") or not state.get("live_calls_enabled"):
            return None
        catalog = [{"id": item.id, "name": item.name} for item in available_types]
        prompt = _(
            "Extract a leave request into JSON only. Today is %(today)s. Choose leave_type_id only from this Odoo catalog: %(catalog)s. "
            "Understand synonyms such as a checkup or medical appointment suggesting sick leave, but never invent a type. "
            "Return exactly: leave_type_id (integer or null), date_from (YYYY-MM-DD or null), date_to (YYYY-MM-DD or null), "
            "duration_days (number or null), half_day (boolean), period (am or pm), reason (string). Leave uncertain values null.\n\nRequest: %(text)s",
            today=fields.Date.to_string(today), catalog=json.dumps(catalog), text=text,
        )
        try:
            raw = gateway.complete_text(prompt).strip()
            raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.IGNORECASE)
            data = json.loads(raw)
            if not isinstance(data, dict):
                return None
            valid_ids = {item.id for item in available_types}
            leave_type_id = int(data["leave_type_id"]) if data.get("leave_type_id") else False
            if leave_type_id and leave_type_id not in valid_ids:
                leave_type_id = False
            date_from, date_to = data.get("date_from") or False, data.get("date_to") or False
            for value in (date_from, date_to):
                if value and (not re.match(r"^\d{4}-\d{2}-\d{2}$", str(value)) or not fields.Date.to_date(value)):
                    return None
            if date_from and date_to and fields.Date.to_date(date_to) < fields.Date.to_date(date_from):
                return None
            duration = data.get("duration_days")
            return {"leave_type_id": leave_type_id, "date_from": date_from, "date_to": date_to,
                    "duration_days": float(duration) if duration not in (None, "") else False,
                    "half_day": bool(data.get("half_day")),
                    "period": data.get("period") if data.get("period") in ("am", "pm") else "am",
                    "reason": str(data.get("reason") or "")[:500]}
        except (AccessError, ValidationError, TypeError, ValueError, KeyError, json.JSONDecodeError):
            return None

    @api.model
    def parse_nl_leave_request(self, text):
        """Parse natural-language leave description into structured fields (LM-039)."""
        if not self.env["hr.leave"].is_ai_capability_enabled("nl_request"):
            raise AccessError(_("AI Natural Language Leave Request Submission is disabled by organisation governance."))

        text = (text or "").strip()
        if not text:
            return {"ok": False, "error": _("Please describe the leave you need.")}

        import re
        from datetime import date, timedelta
        today = fields.Date.context_today(self)

        result = {
            "ok": True,
            "ai_assisted": True,
            "leave_type_id": False,
            "leave_type_name": False,
            "date_from": False,
            "date_to": False,
            "duration_days": False,
            "half_day": False,
            "period": "am",
            "reason": "",
            "suggested_fields": [],
            "summary": "",
            "ambiguous": False,
            "clarification_needed": None,
        }

        lower = text.lower()

        # 1. Leave Type matching against hr.leave.type
        employee = self.env["hr.leave"]._employee_for_current_user(required=False)
        type_domain = [("active", "=", True), ("visible_to_employees", "=", True)]
        if employee:
            type_domain += ["|", ("company_id", "=", False), ("company_id", "=", employee.company_id.id)]
        else:
            type_domain += ["|", ("company_id", "=", False), ("company_id", "=", self.env.company.id)]
        available_types = self.env["hr.leave.type"].sudo().search(type_domain, order="sequence")
        if employee:
            available_types = available_types.filtered(lambda leave_type: employee in leave_type._get_eligible_employees())
        provider_data = self._provider_parse_nl_request(text, available_types, today)
        if provider_data:
            result["half_day"] = provider_data.get("half_day", False)
            result["period"] = provider_data.get("period", "am")
            if result["half_day"]:
                result["suggested_fields"].extend(["half_day", "period"])

        matched_type = None
        if provider_data and provider_data.get("leave_type_id"):
            matched_type = available_types.filtered(lambda item: item.id == provider_data["leave_type_id"])
            matched_type = matched_type[:1] if matched_type else None
        for lt in available_types:
            lt_name = lt.name.lower()
            if not provider_data and lt_name in lower:
                matched_type = lt
                break

        if not matched_type and not provider_data:
            synonyms = {
                ("annual", "vacation", "holiday", "time off", "pto"): "annual",
                ("sick", "ill", "doctor", "medical", "hospital", "unwell", "flu", "health", "checkup", "check-up", "medical appointment"): "sick",
                ("casual", "personal"): "casual",
                ("unpaid", "without pay", "lwop"): "unpaid",
                ("maternity", "paternity", "parental"): "maternity",
                ("bereavement", "compassionate", "funeral"): "compassionate",
            }
            for syn_tuple in synonyms:
                if any(syn in lower for syn in syn_tuple):
                    for lt in available_types:
                        if any(s in lt.name.lower() for s in syn_tuple):
                            matched_type = lt
                            break
                if matched_type:
                    break

        if matched_type:
            result["leave_type_id"] = matched_type.id
            result["leave_type_name"] = matched_type.name
            result["suggested_fields"].append("leave_type_id")

        # 2. Duration extraction
        word_numbers = {
            "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        }
        duration = provider_data.get("duration_days") if provider_data else False
        m_num_days = re.search(r'(\d+)\s*(?:working\s*)?days?', lower)
        if m_num_days:
            duration = int(m_num_days.group(1))
        if not provider_data and not duration:
            m_word_days = re.search(r'\b(one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:working\s*)?days?\b', lower)
            if m_word_days:
                duration = word_numbers.get(m_word_days.group(1))

        if not provider_data and not duration:
            m_weeks = re.search(r'(\d+)\s*weeks?', lower)
            if m_weeks:
                duration = int(m_weeks.group(1)) * 5
            elif re.search(r'\b(a|one)\s*week\b', lower):
                duration = 5
            elif re.search(r'\btwo\s*weeks\b', lower):
                duration = 10

        if not provider_data and not duration and ("half day" in lower or "half-day" in lower):
            duration = 0.5
            result["half_day"] = True
            result["suggested_fields"].append("half_day")
            if "afternoon" in lower or "pm" in lower:
                result["period"] = "pm"
            else:
                result["period"] = "am"
            result["suggested_fields"].append("period")

        if duration:
            result["duration_days"] = duration
            result["suggested_fields"].append("duration_days")

        # 3. Date extraction
        iso_dates = re.findall(r'\b\d{4}-\d{2}-\d{2}\b', text)
        slash_dates = re.findall(r'\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b', text)
        month_names = "jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december"
        text_dates = re.findall(rf'\b(\d{{1,2}})(?:st|nd|rd|th)?\s+({month_names})(?:\s*(\d{{4}}))?\b', lower)
        text_dates_rev = re.findall(rf'\b({month_names})\s+(\d{{1,2}})(?:st|nd|rd|th)?(?:\s*,?\s*(\d{{4}}))?\b', lower)

        month_numbers = {
            "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
            "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6, "jul": 7,
            "july": 7, "aug": 8, "august": 8, "sep": 9, "sept": 9,
            "september": 9, "oct": 10, "october": 10, "nov": 11,
            "november": 11, "dec": 12, "december": 12,
        }

        def parse_named_date(day, month, year=None, fallback_year=None):
            parsed = date(int(year or fallback_year or today.year), month_numbers[month], int(day))
            if not year and parsed < today:
                parsed = parsed.replace(year=today.year + 1)
            return parsed

        date_from = provider_data.get("date_from") if provider_data else False
        date_to = provider_data.get("date_to") if provider_data else False

        # Parse an explicit range first, including ranges where the month is
        # repeated or abbreviated: "between 7th September to 9th Sept".
        named_range = re.search(
            rf'\b(?:from|between)\s+(\d{{1,2}})(?:st|nd|rd|th)?\s+({month_names})'
            rf'(?:\s*(\d{{4}}))?\s+(?:to|through|until)\s+'
            rf'(\d{{1,2}})(?:st|nd|rd|th)?(?:\s+({month_names}))?(?:\s*(\d{{4}}))?\b',
            lower,
        )
        if named_range:
            try:
                start = parse_named_date(named_range.group(1), named_range.group(2), named_range.group(3))
                end = parse_named_date(named_range.group(4), named_range.group(5) or named_range.group(2), named_range.group(6), start.year)
                date_from = fields.Date.to_string(start)
                date_to = fields.Date.to_string(end)
            except (KeyError, TypeError, ValueError):
                date_from = date_to = False

        if not date_from and iso_dates:
            date_from = iso_dates[0]
            if len(iso_dates) > 1:
                date_to = iso_dates[1]
        elif not date_from and slash_dates:
            try:
                p = re.split(r'[/-]', slash_dates[0])
                date_from = f"{p[2]}-{p[1].zfill(2)}-{p[0].zfill(2)}"
                if len(slash_dates) > 1:
                    p2 = re.split(r'[/-]', slash_dates[1])
                    date_to = f"{p2[2]}-{p2[1].zfill(2)}-{p2[0].zfill(2)}"
            except Exception:
                pass
        elif not date_from and text_dates:
            try:
                dt = parse_named_date(text_dates[0][0], text_dates[0][1], text_dates[0][2])
                date_from = fields.Date.to_string(dt)
                if len(text_dates) > 1:
                    dt2 = parse_named_date(text_dates[1][0], text_dates[1][1], text_dates[1][2], dt.year)
                    date_to = fields.Date.to_string(dt2)
            except Exception:
                pass
        elif not date_from and text_dates_rev:
            try:
                dt = parse_named_date(text_dates_rev[0][1], text_dates_rev[0][0], text_dates_rev[0][2])
                date_from = fields.Date.to_string(dt)
                if len(text_dates_rev) > 1:
                    dt2 = parse_named_date(text_dates_rev[1][1], text_dates_rev[1][0], text_dates_rev[1][2], dt.year)
                    date_to = fields.Date.to_string(dt2)
            except Exception:
                pass

        # Natural date ranges often name the month only once (for example,
        # "from 7th Sep to 9th"). Infer the second date from the first date's
        # month instead of leaving the end date blank.
        if date_from and not date_to and text_dates:
            range_end = re.search(r'\b(?:to|through|until)\s+(\d{1,2})(?:st|nd|rd|th)?\b', lower)
            if range_end:
                try:
                    start_dt = fields.Date.to_date(date_from)
                    end_dt = start_dt.replace(day=int(range_end.group(1)))
                    if end_dt < start_dt:
                        end_dt = end_dt.replace(year=end_dt.year + 1)
                    date_to = fields.Date.to_string(end_dt)
                except (TypeError, ValueError):
                    pass

        # Relative dates
        weekday_map = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3, "friday": 4, "saturday": 5, "sunday": 6}
        if not provider_data and not date_from:
            if "day after tomorrow" in lower:
                date_from = fields.Date.to_string(today + timedelta(days=2))
            elif "tomorrow" in lower:
                date_from = fields.Date.to_string(today + timedelta(days=1))
            elif "next week" in lower:
                days_until_monday = (7 - today.weekday()) % 7 or 7
                date_from = fields.Date.to_string(today + timedelta(days=days_until_monday))
                result["ambiguous"] = True
            elif "next month" in lower:
                if today.month == 12:
                    next_month_start = today.replace(year=today.year + 1, month=1, day=1)
                else:
                    next_month_start = today.replace(month=today.month + 1, day=1)
                date_from = fields.Date.to_string(next_month_start)
                result["ambiguous"] = True
            else:
                for day_name, day_idx in weekday_map.items():
                    if f"next {day_name}" in lower:
                        delta = ((day_idx - today.weekday()) % 7) or 7
                        date_from = fields.Date.to_string(today + timedelta(days=delta))
                        break
                    elif f"this {day_name}" in lower or f"on {day_name}" in lower:
                        delta = (day_idx - today.weekday()) % 7
                        if delta <= 0:
                            delta += 7
                        date_from = fields.Date.to_string(today + timedelta(days=delta))
                        result["ambiguous"] = True
                        break

        # Calculate date_to if date_from and duration are known
        if date_from and duration and not date_to:
            try:
                cur = fields.Date.to_date(date_from)
                if duration == 0.5 or duration == 1:
                    date_to = date_from
                else:
                    work_days_count = 1
                    while work_days_count < int(duration):
                        cur += timedelta(days=1)
                        if cur.weekday() < 5:
                            work_days_count += 1
                    date_to = fields.Date.to_string(cur)
            except Exception:
                date_to = date_from

        if date_from:
            result["date_from"] = date_from
            result["suggested_fields"].append("date_from")
        if date_to:
            result["date_to"] = date_to
            result["suggested_fields"].append("date_to")

        if date_from and date_to and not duration:
            try:
                duration = (fields.Date.to_date(date_to) - fields.Date.to_date(date_from)).days + 1
                result["duration_days"] = duration
                result["suggested_fields"].append("duration_days")
            except (TypeError, ValueError):
                pass

        # 4. Reason extraction
        reason = (provider_data.get("reason") if provider_data else "") or text
        for_matches = list(re.finditer(r'\bfor\s+([^,\.]+)', text, re.IGNORECASE))
        m_for = for_matches[-1] if for_matches else None
        m_because = re.search(r'\bbecause\s+of\s+([^,\.]+)', text, re.IGNORECASE)
        m_to = re.search(r'\bto\s+attend\s+([^,\.]+)', text, re.IGNORECASE)
        if provider_data and provider_data.get("reason"):
            pass
        elif m_for:
            reason = m_for.group(1).strip()
        elif m_because:
            reason = m_because.group(1).strip()
        elif m_to:
            reason = ("Attend " + m_to.group(1).strip())

        result["reason"] = reason[:500]
        if reason:
            result["suggested_fields"].append("reason")

        # 5. Clarification check (AC7)
        if not matched_type:
            result["clarification_needed"] = _("Which leave type should I use (for example, Annual or Sick Leave)?")
            result["ambiguous"] = True
        elif not date_from and not duration:
            result["clarification_needed"] = _("Could you specify when you need the leave and for how long?")
            result["ambiguous"] = True

        # 6. Plain-language confirmation summary (AC4)
        type_str = matched_type.name if matched_type else _("Unspecified Leave Type")
        dur_str = f"{duration} day(s)" if duration else _("unspecified duration")
        dates_str = f"from {date_from} to {date_to}" if date_from and date_to else (f"starting {date_from}" if date_from else "")
        reason_str = f" for '{reason}'" if reason and reason != text else ""
        result["summary"] = _("AI understood %(dur)s of %(type)s %(dates)s%(reason)s. Please review and confirm.") % {
            "dur": dur_str,
            "type": type_str,
            "dates": dates_str,
            "reason": reason_str,
        }

        return result

    @api.model
    def suggest_leave_dates(self, leave_type_id=None, duration=5, prioritize_holidays=False, prioritize_coverage=False):
        """Analyze holidays, overlap, blackout dates, and balance to recommend optimal leave dates (LM-040)."""
        if not self.env["hr.leave"].is_ai_capability_enabled("date_recommendations"):
            raise AccessError(_("Smart Leave Date Recommendations are disabled by organisation governance."))

        employee = self.env["hr.leave"]._employee_for_current_user(required=False)
        today = fields.Date.today()
        duration = max(1, min(30, int(duration or 5)))

        # Find leave type
        leave_type = False
        if leave_type_id:
            leave_type = self.env["hr.leave.type"].sudo().browse(int(leave_type_id)).exists()
        if not leave_type:
            types = self.env["hr.leave.type"].sudo().search([("active", "=", True)], limit=1)
            leave_type = types[0] if types else False

        # Scan next 90 days
        from datetime import timedelta
        end_scan = today + timedelta(days=90)
        dept = employee.department_id if employee else False
        total_dept = len(self.env["hr.employee"].search([("department_id", "=", dept.id), ("active", "=", True)])) if dept else 5
        total_dept = max(1, total_dept)

        # Policy & blackout resolution
        policy_line = False
        blackout_dates = set()
        min_notice = 2
        if employee and leave_type:
            try:
                policy_line = leave_type._active_policy_line(employee, today)
            except Exception:
                policy_line = False

        if policy_line:
            if hasattr(policy_line, "minimum_notice_days") and policy_line.minimum_notice_days:
                min_notice = max(min_notice, policy_line.minimum_notice_days)
            # Collect blackout date ranges from policy line
            if hasattr(policy_line, "blackout_period_ids"):
                for bp in policy_line.blackout_period_ids:
                    if bp.date_from and bp.date_to:
                        d_cur = bp.date_from
                        while d_cur <= bp.date_to:
                            blackout_dates.add(fields.Date.to_string(d_cur))
                            d_cur += timedelta(days=1)

        # Company-wide blackout periods
        company_blackouts = self.env["hr.leave.blackout.period"].sudo().search([
            ("company_id", "in", [False, self.env.company.id]),
            ("active", "=", True),
            ("date_from", "<=", fields.Date.to_string(end_scan)),
            ("date_to", ">=", fields.Date.to_string(today)),
        ])
        for bp in company_blackouts:
            if bp.date_from and bp.date_to:
                d_cur = max(today, bp.date_from)
                while d_cur <= min(end_scan, bp.date_to):
                    blackout_dates.add(fields.Date.to_string(d_cur))
                    d_cur += timedelta(days=1)

        # Real employee balance check
        current_balance = 0.0
        has_allocation = False
        allows_negative_balance = bool(policy_line and getattr(policy_line, "allow_negative_balance", False))
        if employee and leave_type:
            allocs = self.env["hr.leave.allocation"].sudo().search([
                ("employee_id", "=", employee.id),
                ("holiday_status_id", "=", leave_type.id),
                ("state", "=", "validate"),
            ])
            has_allocation = bool(allocs)
            allocated = sum(allocs.mapped("number_of_days"))
            used = sum(self.env["hr.leave"].sudo().search([
                ("employee_id", "=", employee.id),
                ("holiday_status_id", "=", leave_type.id),
                ("state", "=", "validate"),
                ("is_cancelled", "=", False),
            ]).mapped("number_of_days"))
            current_balance = round(allocated - used, 1)

        if has_allocation and current_balance < duration and not allows_negative_balance:
            return {
                "ok": True,
                "suggestions": [],
                "no_suitable_dates": True,
                "note": _("No dates were recommended because the requested duration exceeds the available balance under the governing policy."),
            }

        # Public holidays in the window
        admin_user = self.env.ref("base.user_admin", raise_if_not_found=False) or self.env.ref("base.user_root")
        holidays_data = self.env["hr.leave"].with_user(admin_user).get_leave_calendar_data(
            date_from=fields.Date.to_string(today),
            date_to=fields.Date.to_string(end_scan),
            calendar_scope="organisation",
        ).get("public_holidays", [])
        holiday_dates = {h["date"] for h in holidays_data}

        # Existing leaves in window
        leaves = self.env["hr.leave"].sudo().search([
            ("state", "in", ("confirm", "validate1", "validate")),
            ("is_cancelled", "=", False),
            ("request_date_from", "<=", fields.Date.to_string(end_scan)),
            ("request_date_to", ">=", fields.Date.to_string(today)),
            ("employee_id.department_id", "=", dept.id if dept else False),
        ])

        candidates = []
        cur = today + timedelta(days=min_notice)  # Policy-driven notice
        while cur <= end_scan - timedelta(days=duration):
            # Skip if starting on weekend
            if cur.weekday() >= 5:
                cur += timedelta(days=1)
                continue

            # Calculate window of `duration` working days
            win_start = cur
            win_end = cur
            work_days = 1
            w_cur = cur
            has_blackout = fields.Date.to_string(w_cur) in blackout_dates
            while work_days < duration:
                w_cur += timedelta(days=1)
                w_str = fields.Date.to_string(w_cur)
                if w_str in blackout_dates:
                    has_blackout = True
                if w_cur.weekday() < 5 and w_str not in holiday_dates:
                    work_days += 1
            win_end = w_cur

            # Avoid windows that collide with blackout periods
            if has_blackout:
                cur += timedelta(days=1)
                continue

            start_str = fields.Date.to_string(win_start)
            end_str = fields.Date.to_string(win_end)

            # Check overlap during this window
            overlaps = leaves.filtered(lambda l: l.request_date_from <= fields.Date.to_date(end_str) and l.request_date_to >= fields.Date.to_date(start_str))
            overlapping_employees = len({l.employee_id.id for l in overlaps if not employee or l.employee_id.id != employee.id})
            avail_pct = max(0, min(100, round(((total_dept - overlapping_employees - 1) / total_dept) * 100)))

            # Check holiday adjacency / long weekend
            has_adjacent_holiday = False
            prev_day = fields.Date.to_string(win_start - timedelta(days=1))
            next_day = fields.Date.to_string(win_end + timedelta(days=1))
            if prev_day in holiday_dates or next_day in holiday_dates:
                has_adjacent_holiday = True

            creates_long_weekend = win_start.weekday() == 0 or win_end.weekday() == 4 or has_adjacent_holiday
            long_weekend_str = "Yes (4-day)" if creates_long_weekend and (has_adjacent_holiday or duration <= 3) else ("Yes (5-day)" if creates_long_weekend else "No")

            # Scoring
            score = avail_pct
            rationale_parts = []
            if has_adjacent_holiday:
                score += 35 if prioritize_holidays else 15
                rationale_parts.append(_("Adjacent to public holiday"))
            if creates_long_weekend:
                score += 15
            if avail_pct >= 85:
                score += 30 if prioritize_coverage else 15
                rationale_parts.append(_("low team overlap"))
            elif avail_pct >= 70:
                rationale_parts.append(_("balanced coverage"))
            else:
                score -= 40
                rationale_parts.append(_("high overlap risk"))

            # Balance impact formatting
            if has_allocation:
                remaining = round(current_balance - duration, 1)
                balance_impact_str = f"{current_balance}d → {remaining}d"
                if remaining < 0:
                    score -= 30
                    rationale_parts.append(_("exceeds current balance"))
            else:
                balance_impact_str = f"-{duration} days"

            rationale = ", ".join(rationale_parts) if rationale_parts else _("Available period with standard coverage")

            candidates.append({
                "date_from": start_str,
                "date_to": end_str,
                "label": f"{win_start.strftime('%d %b')} – {win_end.strftime('%d %b %Y')}",
                "rationale": rationale,
                "coverage_pct": avail_pct,
                "team_coverage": f"{avail_pct}% available",
                "long_weekend": long_weekend_str,
                "balance_impact": balance_impact_str,
                "duration": duration,
                "leave_type_id": leave_type.id if leave_type else False,
                "leave_type_name": leave_type.name if leave_type else "Leave",
                "score": score,
            })

            # Advance by at least 3 days to get distinct options
            cur += timedelta(days=3)

        # Sort candidates by score descending
        candidates.sort(key=lambda c: c["score"], reverse=True)

        # Pick top 4 distinct suggestions
        selected = []
        for c in candidates:
            if len(selected) >= 4:
                break
            # Avoid direct overlap with already selected
            overlap_prev = any(
                c["date_from"] <= s["date_to"] and c["date_to"] >= s["date_from"]
                for s in selected
            )
            if not overlap_prev or len(selected) == 0:
                selected.append(c)

        for idx, item in enumerate(selected):
            item["rank"] = idx + 1

        return {
            "ok": True,
            "suggestions": selected,
            "no_suitable_dates": len(selected) == 0,
            "note": _("All recommendations are advisory only. Final requests pass through standard policy and approval.")
        }

    @api.model
    def get_leave_anomalies(self, severity=None, department_id=None, pattern_type=None, status=None):
        """Analyze leave records for pattern anomalies (LM-043) - Admin/HR only."""
        if not self.env["hr.leave"].is_ai_capability_enabled("anomaly_detection"):
            raise AccessError(_("Fraud & Anomaly Detection is disabled by organisation governance."))

        # AI Insights may view findings; only HR/Admin can mutate review state.
        if not (self.env.user.has_group("hr.group_hr_user") or self.env.user.has_group("base.group_system") or self.env["hr.leave"]._leave_is_administrator() or self.env.user.has_group("hr_leave_dashboard.group_leave_permission_ai_insights")):
            raise AccessError(_("Employees never see anomaly flags. This feature is Admin/HR-only."))

        from datetime import timedelta
        today = fields.Date.today()
        start_period = today - timedelta(days=180)

        domain = [
            ("state", "in", ("confirm", "validate1", "validate")),
            ("is_cancelled", "=", False),
            ("request_date_from", ">=", fields.Date.to_string(start_period)),
            ("company_id", "=", self.env.company.id),
        ]
        if department_id:
            domain.append(("employee_id.department_id", "=", int(department_id)))

        leaves = self.env["hr.leave"].sudo().search(domain, order="request_date_from desc")

        # Group leaves by employee
        emp_leaves = {}
        for l in leaves:
            emp_leaves.setdefault(l.employee_id, []).append(l)

        # Public holidays in the 180-day period
        admin_user = self.env.ref("base.user_admin", raise_if_not_found=False) or self.env.ref("base.user_root")
        holidays_data = self.env["hr.leave"].with_user(admin_user).get_leave_calendar_data(
            date_from=fields.Date.to_string(start_period),
            date_to=fields.Date.to_string(today),
            calendar_scope="organisation",
        ).get("public_holidays", [])
        holiday_dates = {h["date"] for h in holidays_data}

        anomaly_model = self.env["hr.leave.anomaly"]

        for emp, records in emp_leaves.items():
            # Exclude employees with pre-approved recurring arrangements (AC6).
            # We check for a flex/compressed work schedule via resource.calendar
            # rather than a placeholder attribute that may not exist.
            calendar = emp.resource_calendar_id or self.env.company.resource_calendar_id
            is_fixed_schedule = not getattr(calendar, "flexible_hours", False)

            # Pattern 1: Frequent Monday/Friday single-day leave
            mon_fri_leaves = [
                l for l in records
                if (l.request_date_from == l.request_date_to or l.number_of_days <= 1)
                and l.request_date_from and fields.Date.to_date(l.request_date_from).weekday() in (0, 4)
            ]
            if is_fixed_schedule and len(mon_fri_leaves) >= 3:
                sev = "high" if len(mon_fri_leaves) >= 5 else "medium"
                anomaly_model.upsert_anomaly(
                    employee_id=emp.id,
                    company_id=self.env.company.id,
                    pattern_type="mon_fri_cluster",
                    severity=sev,
                    occurrence_count=len(mon_fri_leaves),
                    supporting_data=_(
                        "%(cnt)d single-day leaves booked on Mondays or Fridays across past 6 months.",
                        cnt=len(mon_fri_leaves),
                    ),
                )

            # Pattern 2: Short-notice sick leave adjacent to public holidays
            sick_holiday_leaves = []
            for l in records:
                if l.holiday_status_id and "sick" in l.holiday_status_id.name.lower():
                    d_from = fields.Date.to_date(l.request_date_from)
                    submitted_on = fields.Datetime.to_datetime(getattr(l, "submitted_at", False) or l.create_date)
                    notice_days = (d_from - submitted_on.date()).days if submitted_on else 999
                    prev_d = fields.Date.to_string(d_from - timedelta(days=1))
                    next_d = fields.Date.to_string(d_from + timedelta(days=1))
                    if notice_days <= 2 and (prev_d in holiday_dates or next_d in holiday_dates):
                        sick_holiday_leaves.append(l)

            if len(sick_holiday_leaves) >= 2:
                sev = "high" if len(sick_holiday_leaves) >= 3 else "medium"
                anomaly_model.upsert_anomaly(
                    employee_id=emp.id,
                    company_id=self.env.company.id,
                    pattern_type="adjacent_to_holiday",
                    severity=sev,
                    occurrence_count=len(sick_holiday_leaves),
                    supporting_data=_(
                        "%(cnt)d short-notice sick leave instance(s) submitted within two days and immediately adjacent to public holidays.",
                        cnt=len(sick_holiday_leaves),
                    ),
                )

            # Pattern 3: High frequency of short absences within rolling period
            short_absences = [l for l in records if l.number_of_days <= 2]
            if len(short_absences) >= 5:
                anomaly_model.upsert_anomaly(
                    employee_id=emp.id,
                    company_id=self.env.company.id,
                    pattern_type="high_short_absence",
                    severity="medium" if len(short_absences) > 6 else "low",
                    occurrence_count=len(short_absences),
                    supporting_data=_(
                        "%(cnt)d short absences (< 3 days) recorded within rolling 180-day window.",
                        cnt=len(short_absences),
                    ),
                )

        # Fetch persisted anomalies for this company, applying requested filters.
        domain = [("company_id", "=", self.env.company.id)]
        if department_id:
            domain.append(("employee_id.department_id", "=", int(department_id)))
        if severity and severity != "all":
            domain.append(("severity", "=", severity.lower()))
        if pattern_type and pattern_type != "all":
            domain.append(("pattern_type", "=", pattern_type))
        if status and status != "all":
            domain.append(("status", "=", status.lower()))

        records_out = anomaly_model.sudo().search(domain, order="severity desc, last_detected_at desc")
        anomalies = [r.to_dict() for r in records_out]

        return {"ok": True, "anomalies": anomalies, "total": len(anomalies)}

    @api.model
    def review_leave_anomaly(self, anomaly_id, action="review", note=""):
        """Mark anomaly reviewed or escalate to HR (LM-043 AC3).

        ``anomaly_id`` must be a real integer ID of an ``hr.leave.anomaly``
        record.  State changes are persisted to the ORM so they survive
        page reloads.
        """
        valid_actions = ("review", "escalate")
        if action not in valid_actions:
            raise ValidationError(_("Action must be 'review' or 'escalate'."))

        if not (
            self.env.user.has_group("hr.group_hr_user")
            or self.env.user.has_group("base.group_system")
            or self.env["hr.leave"]._leave_is_administrator()
        ):
            raise AccessError(_("Only authorised HR users can review leave anomalies."))

        try:
            anomaly_id = int(anomaly_id)
        except (TypeError, ValueError):
            raise ValidationError(_("Invalid anomaly ID."))

        anomaly = self.env["hr.leave.anomaly"].sudo().browse(anomaly_id)
        if not anomaly.exists():
            raise ValidationError(_("Anomaly record not found."))

        if action == "review":
            anomaly.action_review(note=note)
            new_status = "reviewed"
            action_label = _("Anomaly marked as reviewed")
        else:
            anomaly.action_escalate(note=note)
            new_status = "escalated"
            action_label = _("Anomaly escalated to HR")

        # Audit trail
        self.env["hr.leave.audit.log"].sudo().create({
            "action": "anomaly_review",
            "actor_id": self.env.user.id,
            "actor_label": self.env.user.name,
            "actor_role": "HR Administrator",
            "module_area": "reports",
            "entity_type": "leave_anomaly",
            "company_id": self.env.company.id,
            "note": f"[{action_label}] anomaly #{anomaly_id}: {note}".strip(),
            "occurred_at": fields.Datetime.now(),
        })

        return {
            "ok": True,
            "anomaly_id": anomaly_id,
            "status": new_status,
            "message": _("Anomaly status updated and recorded in audit log."),
        }

    @api.model
    def get_executive_workforce_brief(self, month=None, department_id=None):
        """Generate Executive Workforce & Leave Analytics Brief (LM-045)."""
        if not self.env["hr.leave"].is_ai_capability_enabled("executive_brief"):
            raise AccessError(_("Executive Workforce Brief is disabled by organisation governance."))

        if not (self.env.user.has_group("base.group_system") or self.env.user.has_group("hr_leave_dashboard.group_leave_permission_executive_analytics") or self.env["hr.leave"]._leave_is_administrator()):
            raise AccessError(_("Executive Analytics permissions required."))

        from datetime import date, timedelta
        today = fields.Date.today()
        # Selected month or current month
        if not month:
            month = today.strftime("%Y-%m")

        try:
            year, m = map(int, month.split("-"))
            date_from = date(year, m, 1)
            next_m = date(year + 1, 1, 1) if m == 12 else date(year, m + 1, 1)
            date_to = next_m - timedelta(days=1)
        except Exception:
            date_from = today.replace(day=1)
            date_to = today

        domain = [
            ("company_id", "=", self.env.company.id),
            ("request_date_from", "<=", fields.Date.to_string(date_to)),
            ("request_date_to", ">=", fields.Date.to_string(date_from)),
        ]
        if department_id:
            domain.append(("employee_id.department_id", "=", int(department_id)))

        all_leaves = self.env["hr.leave"].sudo().search(domain)
        approved = all_leaves.filtered(lambda l: l.state == "validate" and not l.is_cancelled)
        pending = all_leaves.filtered(lambda l: l.state in ("confirm", "validate1") and not l.is_cancelled)

        total_approved = len(approved)
        total_pending = len(pending)

        # ---- Approval SLA: time from submission to the immutable approval event ----
        # Use 3 working days as the nominal SLA target.
        _sla_days = 3
        sla_total = 0
        sla_met = 0
        total_approval_days = 0.0
        approval_logs = self.env["hr.leave.audit.log"].sudo().search([
            ("leave_id", "in", approved.ids),
            ("action", "in", ("approve", "final_approval")),
            ("event_status", "=", "success"),
        ], order="occurred_at asc, id asc")
        approved_at_by_leave = {}
        for log in approval_logs:
            approved_at_by_leave.setdefault(log.leave_id.id, log.occurred_at)
        for lv in approved:
            submitted = getattr(lv, "submitted_at", None) or getattr(lv, "create_date", None)
            validated = approved_at_by_leave.get(lv.id)
            if submitted and validated:
                sla_total += 1
                delta_days = (validated - submitted).total_seconds() / 86400.0
                total_approval_days += delta_days
                if delta_days <= _sla_days:
                    sla_met += 1

        sla_achieved_pct = round(sla_met / sla_total * 100, 1) if sla_total else None
        avg_days_to_approve = round(total_approval_days / sla_total, 1) if sla_total else None

        # ---- Concentration by department ----
        dept_counts = {}
        for lv in approved:
            dept_name = lv.employee_id.department_id.name
            if dept_name:
                dept_counts[dept_name] = dept_counts.get(dept_name, 0) + 1

        top_dept = max(dept_counts.items(), key=lambda x: x[1])[0] if dept_counts else None

        # ---- Zero-leave employees in past 6 months ----
        six_months_ago = fields.Date.to_string(today - timedelta(days=180))
        employee_domain = [("company_id", "=", self.env.company.id), ("active", "=", True)]
        if department_id:
            employee_domain.append(("department_id", "=", int(department_id)))
        scoped_employees = self.env["hr.employee"].sudo().search(employee_domain)
        recent_leave_emp_ids = set(
            self.env["hr.leave"].sudo().search([
                ("company_id", "=", self.env.company.id),
                ("employee_id", "in", scoped_employees.ids),
                ("state", "=", "validate"),
                ("is_cancelled", "=", False),
                ("request_date_from", ">=", six_months_ago),
            ]).mapped("employee_id.id")
        )
        all_emp_count = len(scoped_employees)
        zero_leave_count = max(0, all_emp_count - len(recent_leave_emp_ids))

        month_title = date_from.strftime("%B %Y")

        # ---- Factual insights (no hallucinated numbers) ----
        key_insights = []
        if top_dept:
            key_insights.append(
                _("%(dept)s has the highest leave concentration this period (%(cnt)d approved requests).",
                  dept=top_dept, cnt=dept_counts[top_dept])
            )
        if zero_leave_count > 0:
            key_insights.append(
                _("%(cnt)d active employee(s) have taken no approved leave in the past 6 months (potential burnout risk indicator).",
                  cnt=zero_leave_count)
            )
        if not key_insights:
            key_insights.append(_("No significant leave concentration detected for this period."))

        recommendations = []
        if total_pending:
            recommendations.append(_("Review the %(count)d pending request(s), prioritising those nearest their configured SLA deadline.", count=total_pending))
        if sla_achieved_pct is not None and sla_achieved_pct < 90:
            recommendations.append(_("Review approval-route bottlenecks: %(pct)s%% of measured requests met the three-day approval target.", pct=sla_achieved_pct))
        if top_dept:
            recommendations.append(_("Validate staffing coverage in %(dept)s before approving additional overlapping leave.", dept=top_dept))
        if zero_leave_count:
            recommendations.append(_("Ask managers to check wellbeing and leave planning with the %(count)d employee(s) who recorded no approved leave in six months.", count=zero_leave_count))
        if not recommendations:
            recommendations.append(_("Continue monitoring approval SLAs and department coverage; no immediate exception is evident in this period."))

        return {
            "ok": True,
            "period": month,
            "period_title": month_title,
            "kpis": {
                "requests_approved": total_approved,
                "pending_approvals": total_pending,
                # None means "not calculable" — never use a hardcoded fallback.
                "sla_achieved_percent": sla_achieved_pct,
                "avg_days_to_approve": avg_days_to_approve,
                "sla_sample_size": sla_total,
            },
            "key_insights": key_insights,
            "ai_recommendations": recommendations,
            "advisory_notice": _("Recommendations are advisory and must be reviewed by an authorised HR manager before action."),
            "generated_at": fields.Datetime.to_string(fields.Datetime.now()),
        }
