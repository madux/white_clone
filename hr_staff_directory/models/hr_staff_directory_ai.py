# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


DIRECTORY_SCREENS = (
    "staff_directory.people",
    "staff_directory.org",
    "staff_directory.profile",
    "staff_directory.segment",
)


class StaffDirectoryAiGateway(models.AbstractModel):
    """Staff Directory screens and read-only tools on the shared CleonAI gateway."""
    _inherit = "cleon.ai.gateway"

    # ─── Tools ───────────────────────────────────────────────────────────────

    @api.model
    def _collect_ai_tools(self, profile=None, screen_context=None):
        tools = super()._collect_ai_tools(profile=profile, screen_context=screen_context)
        context = screen_context or {}
        screen = (context.get("screen") or "").strip()
        if screen not in DIRECTORY_SCREENS:
            return tools

        tools.append({
            "name": "staff_directory.summarize_roster",
            "mode": "read",
            "available": True,
            "implemented": True,
            "requires_confirmation": False,
            "description": "Summarize the current Staff Directory roster (counts by department and lifecycle).",
        })
        if screen in ("staff_directory.profile", "staff_directory.segment") or context.get("employee_id"):
            tools.append({
                "name": "staff_directory.summarize_person",
                "mode": "read",
                "available": True,
                "implemented": True,
                "requires_confirmation": False,
                "description": "Summarize one employee currently in focus (role, dept, leave snapshot).",
            })
        if screen == "staff_directory.org":
            tools.append({
                "name": "staff_directory.open_org_chart",
                "mode": "navigate",
                "available": True,
                "implemented": True,
                "requires_confirmation": False,
                "description": "Switch the Org Structure view to the org chart.",
            })
        return tools

    @api.model
    def _dispatch_tool_execution(self, tool_name, params, screen_context=None):
        context = screen_context or {}
        screen = (context.get("screen") or "").strip()

        if tool_name == "staff_directory.summarize_roster":
            if screen not in DIRECTORY_SCREENS:
                raise AccessError(_("This tool is only available inside Staff Directory."))
            return {"ok": True, **self._roster_summary_from_context(context)}

        if tool_name == "staff_directory.summarize_person":
            if screen not in DIRECTORY_SCREENS:
                raise AccessError(_("This tool is only available inside Staff Directory."))
            person = self._person_summary(context, params)
            return {"ok": True, "person": person}

        if tool_name == "staff_directory.open_org_chart":
            if screen != "staff_directory.org":
                raise AccessError(_("Org chart navigation is only available on the Org Structure screen."))
            return {"ok": True, "action": "set_org_view", "view": "org"}

        return super()._dispatch_tool_execution(tool_name, params, screen_context=screen_context)

    # ─── Screen context ──────────────────────────────────────────────────────

    @api.model
    def _get_screen_ai_context(self, screen, screen_context):
        if screen not in DIRECTORY_SCREENS:
            return super()._get_screen_ai_context(screen, screen_context)

        context = screen_context or {}
        provider = self._provider_state()
        tools = self.get_tool_catalog(context)
        headings = {
            "staff_directory.people": _("Staff Directory — People"),
            "staff_directory.org": _("Staff Directory — Organizational Structure"),
            "staff_directory.profile": _("Staff Directory — Employee Profile"),
            "staff_directory.segment": _("Staff Directory — Saved Segment"),
        }
        bullets = self._directory_bullets(screen, context)
        suggestions = self._directory_suggestions(screen, context)

        return {
            "screen": screen,
            "scope": "directory",
            "heading": headings.get(screen, _("Staff Directory")),
            "bullets": bullets,
            "provider": provider,
            "tools": tools,
            "suggestions": suggestions,
        }

    @api.model
    def _dispatch_provider_text(self, prompt, screen_context=None):
        """Inject a compact, server-built brief for directory screens (no full PII dump)."""
        context = screen_context or {}
        screen = (context.get("screen") or "").strip()
        if screen in DIRECTORY_SCREENS:
            brief = self._directory_context_brief(screen, context)
            if brief:
                prompt = _(
                    "%(prompt)s\n\nAuthorized Staff Directory context (use only this; do not invent people):\n%(brief)s",
                    prompt=prompt,
                    brief=brief,
                )
        return super()._dispatch_provider_text(prompt, screen_context)

    # ─── Helpers ─────────────────────────────────────────────────────────────

    @api.model
    def _directory_bullets(self, screen, context):
        bullets = []
        title = (context.get("title") or "").strip()
        if title:
            bullets.append(title)

        kpis = context.get("kpis") or {}
        if kpis:
            bullets.append(_(
                "Roster in view: %(total)s people · %(active)s active · %(on_leave)s on leave",
                total=kpis.get("total", 0),
                active=kpis.get("active", 0),
                on_leave=kpis.get("onLeave", kpis.get("on_leave", 0)),
            ))
            if kpis.get("remote") is not None:
                bullets.append(_("Remote / hybrid-capable workers in view: %(n)s", n=kpis.get("remote", 0)))

        depts = context.get("top_departments") or []
        if depts:
            top = depts[0]
            bullets.append(_(
                "Largest department in view: %(name)s (%(count)s)",
                name=top.get("name") or _("Unknown"),
                count=top.get("count", 0),
            ))

        if screen == "staff_directory.profile":
            name = context.get("employee_name") or _("this employee")
            dept = context.get("department") or _("—")
            role = context.get("job_title") or _("—")
            bullets.append(_("%(name)s · %(role)s · %(dept)s", name=name, role=role, dept=dept))
            lifecycle = context.get("lifecycle") or ""
            if lifecycle:
                bullets.append(_("Lifecycle: %(state)s", state=lifecycle))

        if screen == "staff_directory.segment":
            seg = context.get("segment_name") or _("Saved segment")
            count = context.get("segment_count")
            if count is not None:
                bullets.append(_("%(name)s · %(count)s members", name=seg, count=count))
            else:
                bullets.append(seg)

        filters = context.get("filters") or {}
        if isinstance(filters, dict) and filters:
            chips = []
            for key, vals in list(filters.items())[:4]:
                if isinstance(vals, (list, tuple)):
                    chips.append("%s=%s" % (key, ", ".join(str(v) for v in vals[:3])))
                elif vals:
                    chips.append("%s=%s" % (key, vals))
            if chips:
                bullets.append(_("Active filters: %(chips)s", chips="; ".join(chips)))

        if not bullets:
            bullets.append(_("Staff Directory is open. Ask about people, teams, or org structure in the current view."))
        return bullets[:8]

    @api.model
    def _directory_suggestions(self, screen, context):
        if screen == "staff_directory.profile":
            first = (context.get("employee_name") or _("this person")).split(" ")[0]
            return [
                _("Summarize %(name)s's profile", name=first),
                _("What is %(name)s's leave balance snapshot?", name=first),
                _("Who does %(name)s report to?", name=first),
            ]
        if screen == "staff_directory.segment":
            return [
                _("Summarize this segment"),
                _("Which departments are most represented?"),
                _("How many people are on leave in this segment?"),
            ]
        if screen == "staff_directory.org":
            return [
                _("Summarize the current filtered roster"),
                _("Which department is largest in this view?"),
                _("How many people are on leave right now?"),
            ]
        return [
            _("Summarize the people currently in view"),
            _("Break down the roster by department"),
            _("Who is on leave in this list?"),
        ]

    @api.model
    def _directory_context_brief(self, screen, context):
        lines = self._directory_bullets(screen, context)
        if screen == "staff_directory.profile" and context.get("employee_id"):
            try:
                person = self._person_summary(context, {})
                for key in ("manager_name", "work_location", "work_mode", "grade", "leave_summary"):
                    if person.get(key):
                        lines.append("%s: %s" % (key, person[key]))
            except (AccessError, ValidationError):
                pass
        return "\n".join("• %s" % line for line in lines[:12])

    @api.model
    def _roster_summary_from_context(self, context):
        kpis = context.get("kpis") or {}
        depts = context.get("top_departments") or []
        return {
            "total": kpis.get("total", 0),
            "active": kpis.get("active", 0),
            "on_leave": kpis.get("onLeave", kpis.get("on_leave", 0)),
            "remote": kpis.get("remote", 0),
            "top_departments": depts[:8],
            "bullets": self._directory_bullets(
                (context.get("screen") or "staff_directory.people").strip(),
                context,
            ),
        }

    @api.model
    def _person_summary(self, context, params):
        """Load a minimal authorized snapshot for one employee id from context/params."""
        raw_id = params.get("employee_id") or context.get("employee_id")
        try:
            employee_id = int(raw_id)
        except (TypeError, ValueError):
            raise ValidationError(_("Select an employee before asking for a person summary."))

        # Respect HR record rules — no sudo.
        employee = self.env["hr.employee"].browse(employee_id).exists()
        if not employee:
            raise AccessError(_("You do not have access to that employee."))

        leave_summary = ""
        if isinstance(context.get("leave_summary"), str) and context.get("leave_summary"):
            leave_summary = context["leave_summary"]
        else:
            today = fields.Date.context_today(self)
            upcoming = self.env["hr.leave"].search_count([
                ("employee_id", "=", employee.id),
                ("state", "=", "validate"),
                ("date_to", ">=", today),
            ])
            leave_summary = _("%(n)s validated leave period(s) ending today or later", n=upcoming)

        return {
            "id": employee.id,
            "name": employee.name,
            "job_title": employee.job_title or "",
            "department": employee.department_id.name if employee.department_id else "",
            "manager_name": employee.parent_id.name if employee.parent_id else "",
            "work_location": employee.work_location_id.name if employee.work_location_id else "",
            "work_mode": getattr(employee, "work_mode", "") or "",
            "grade": (
                employee.grade_id.name if getattr(employee, "grade_id", False) else
                (getattr(employee, "sdir_grade", "") or "")
            ),
            "lifecycle": getattr(employee, "sdir_lifecycle_status", "") or "",
            "leave_summary": leave_summary,
        }
