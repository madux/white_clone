# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class CleonAiGateway(models.AbstractModel):
    _name = "cleon.ai.gateway"
    _description = "Permission-aware Cleon AI Gateway"

    @api.model
    def _provider_state(self):
        """Return provider configuration state from system parameters."""
        params = self.env["ir.config_parameter"].sudo()
        provider = params.get_param("cleon_ai.provider", "none")
        return {
            "provider": provider,
            "model": params.get_param("cleon_ai.model", ""),
            "configured": provider not in ("", "none"),
            "live_calls_enabled": params.get_param("cleon_ai.live_calls_enabled", "False") == "True",
        }

    @api.model
    def _get_screen_ai_context(self, screen, screen_context):
        """Extension hook for business modules to provide assistant context.
        Returns dict of assistant state if screen is recognized, or None.
        """
        return None

    @api.model
    def _collect_ai_tools(self, profile=None, screen_context=None):
        """Extension hook for business modules to register available tools.
        Returns a list of tool definition dictionaries.
        """
        return []

    @api.model
    def get_tool_catalog(self, screen_context=None):
        """Return the consolidated tool catalogue accessible to the current user on the active screen.

        Enforces platform invariant: no explicit active screen -> no business tools.
        """
        context = screen_context or {}
        if not (context.get("screen") or "").strip():
            return []
        return self._collect_ai_tools(screen_context=context)

    @api.model
    def get_assistant_state(self, screen_context=None):
        """Return a server-authorized assistant state for the currently visible screen."""
        context = screen_context or {}
        screen = (context.get("screen") or "").strip()

        if not screen:
            return {
                "screen": "",
                "scope": "unattached",
                "heading": _("CleonAI Assistant"),
                "bullets": [_("Open a supported Cleon workspace for screen-aware assistance.")],
                "provider": self._provider_state(),
                "tools": [],
                "suggestions": [],
            }

        result = self._get_screen_ai_context(screen, context)
        if isinstance(result, dict):
            if "provider" not in result:
                result["provider"] = self._provider_state()
            if "tools" not in result:
                result["tools"] = self.get_tool_catalog(context)
            return result

        raise AccessError(_("This screen has not published an approved assistant context."))

    @api.model
    def ask_assistant(self, question, screen_context=None):
        """Permission-aware Q&A entry point. Checks provider state and live call boundaries."""
        question = (question or "").strip()
        if not question:
            return {
                "answered": False,
                "message": _("Please enter a question."),
                "provider": self._provider_state(),
            }

        state = self.get_assistant_state(screen_context)
        provider = state.get("provider") or self._provider_state()

        if not provider["configured"] or not provider["live_calls_enabled"]:
            return {
                "answered": False,
                "message": _(
                    "The permission-aware assistant foundation is ready for %(heading)s, but no live AI provider has been enabled.",
                    heading=state.get("heading", _("this screen")),
                ),
                "provider": provider,
            }

        return {
            "answered": False,
            "message": _("The selected provider is configured, but its adapter has not been enabled in this build."),
            "provider": provider,
        }

    @api.model
    def execute_tool(self, tool_name, params=None, screen_context=None):
        """Execute an allowlisted tool with explicit confirmation and screen boundaries.

        NOTE on confirmation boundaries:
        params.get("confirmed") is used exclusively for non-mutating preparation and
        navigation tools (e.g. pre-filling a modal or navigating to a queue).
        Future write-capable tools (e.g. mutating records, approving leaves, modifying
        balances) must never rely on a client-supplied parameter and require an explicit
        server-bound human confirmation workflow.
        """
        params = params or {}
        context = screen_context or {}
        catalog = {t["name"]: t for t in self.get_tool_catalog(screen_context=context)}
        tool = catalog.get(tool_name)
        if not tool:
            raise ValidationError(_("Tool '%s' is not registered or not permitted on this screen.") % tool_name)

        if not tool.get("implemented", True) or not tool.get("available", True):
            raise ValidationError(_("Tool '%s' is registered as foundation-only and is not yet executable.") % tool_name)

        if tool.get("requires_confirmation") and not params.get("confirmed"):
            raise ValidationError(_("Tool '%s' requires explicit user confirmation before execution.") % tool_name)

        return self._dispatch_tool_execution(tool_name, params, screen_context=context)

    @api.model
    def _dispatch_tool_execution(self, tool_name, params, screen_context=None):
        """Override in business modules to handle tool execution with execution-time permission checks."""
        raise ValidationError(_("Tool '%s' handler is not implemented.") % tool_name)
