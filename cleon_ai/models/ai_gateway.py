# -*- coding: utf-8 -*-
import json
import logging
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class CleonAiGateway(models.AbstractModel):
    _name = "cleon.ai.gateway"
    _description = "Permission-aware Cleon AI Gateway"

    _logger = logging.getLogger(__name__)

    @api.model
    def _provider_state(self):
        """Return provider configuration state from system parameters."""
        params = self.env["ir.config_parameter"].sudo()
        provider = (params.get_param("cleon_ai.provider", "none") or "none").strip().lower()
        # Be forgiving of the common transposition used while entering Gemini.
        if provider == "gemni":
            provider = "gemini"
        api_key = params.get_param("cleon_ai.gemini_api_key", "") or os.environ.get("GEMINI_API_KEY", "")
        openai_key = params.get_param("cleon_ai.openai_api_key", "") or os.environ.get("OPENAI_API_KEY", "")
        return {
            "provider": provider,
            "model": params.get_param("cleon_ai.model", ""),
            "configured": provider not in ("", "none") and (
                (provider == "gemini" and bool(api_key))
                or (provider == "openai" and bool(openai_key))
                or provider in ("ollama", "local")
            ),
            "live_calls_enabled": params.get_param("cleon_ai.live_calls_enabled", "False") == "True",
        }

    @api.model
    def _call_gemini(self, question, screen_context=None):
        """Call Gemini without storing the secret in application logs or responses."""
        params = self.env["ir.config_parameter"].sudo()
        api_key = params.get_param("cleon_ai.gemini_api_key", "") or os.environ.get("GEMINI_API_KEY", "")
        model = params.get_param("cleon_ai.model", "") or "gemini-2.5-flash"
        if not api_key:
            raise ValidationError(_("Gemini is selected, but no Gemini API key is configured."))
        context = screen_context or {}
        prompt = question
        if context.get("screen"):
            prompt = _(
                "You are assisting a user inside the CleonHR %(screen)s screen. "
                "Answer only with helpful, concise guidance and do not claim to perform actions.\n\nUser question: %(question)s",
                screen=context.get("screen"), question=question,
            )
        payload = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode("utf-8")
        request = Request(
            "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent" % model,
            data=payload,
            headers={"Content-Type": "application/json", "x-goog-api-key": api_key},
            method="POST",
        )
        try:
            with urlopen(request, timeout=30) as response:
                data = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            # Google returns useful status details (invalid model/key/quota),
            # but never include the request headers or secret in the message.
            try:
                detail = json.loads(error.read().decode("utf-8")).get("error", {}).get("message", "")
            except (ValueError, AttributeError):
                detail = ""
            self._logger.warning("Gemini request rejected with HTTP %s: %s", error.code, detail)
            suffix = (": " + detail[:240]) if detail else ""
            raise ValidationError(_("Gemini rejected the request (HTTP %(code)s)%(suffix)s") % {
                "code": error.code, "suffix": suffix,
            })
        except (URLError, TimeoutError, ValueError) as error:
            self._logger.warning("Gemini request failed: %s", error)
            raise ValidationError(_("Gemini could not reach the provider. Check the Odoo server's network access."))
        text = "".join(
            part.get("text", "")
            for candidate in data.get("candidates", [])
            for part in candidate.get("content", {}).get("parts", [])
        ).strip()
        if not text:
            raise ValidationError(_("Gemini returned no text for this request."))
        return text

    @api.model
    def _call_openai_compatible(self, question, screen_context=None, provider="openai"):
        """Call OpenAI or an OpenAI-compatible local server."""
        params = self.env["ir.config_parameter"].sudo()
        if provider == "openai":
            base_url = params.get_param("cleon_ai.openai_base_url", "https://api.openai.com/v1")
            api_key = params.get_param("cleon_ai.openai_api_key", "") or os.environ.get("OPENAI_API_KEY", "")
            model = params.get_param("cleon_ai.model", "") or "gpt-4o-mini"
        else:
            base_url = params.get_param("cleon_ai.local_base_url", "http://127.0.0.1:8080/v1")
            api_key = params.get_param("cleon_ai.local_api_key", "") or os.environ.get("LOCAL_LLM_API_KEY", "")
            model = params.get_param("cleon_ai.model", "") or "local-model"
        if provider == "openai" and not api_key:
            raise ValidationError(_("OpenAI is selected, but no OpenAI API key is configured."))
        context = screen_context or {}
        prompt = question
        if context.get("screen"):
            prompt = _(
                "You are assisting a user inside the CleonHR %(screen)s screen. "
                "Answer with concise guidance and do not claim to perform actions.\n\nUser question: %(question)s",
                screen=context.get("screen"), question=question,
            )
        payload = json.dumps({
            "model": model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0.2,
        }).encode("utf-8")
        endpoint = base_url.rstrip("/") + "/chat/completions"
        headers = {"Content-Type": "application/json"}
        if api_key:
            headers["Authorization"] = "Bearer " + api_key
        try:
            with urlopen(Request(endpoint, data=payload, headers=headers, method="POST"), timeout=45) as response:
                data = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            try:
                detail = json.loads(error.read().decode("utf-8")).get("error", {}).get("message", "")
            except (ValueError, AttributeError):
                detail = ""
            self._logger.warning("%s request rejected with HTTP %s: %s", provider, error.code, detail)
            suffix = (": " + detail[:240]) if detail else ""
            raise ValidationError(_("%(provider)s rejected the request (HTTP %(code)s)%(suffix)s") % {
                "provider": provider.title(), "code": error.code, "suffix": suffix,
            })
        except (URLError, TimeoutError, ValueError):
            raise ValidationError(_("Could not reach the %(provider)s server. Check its URL and network access.") % {
                "provider": provider.title(),
            })
        text = ((data.get("choices") or [{}])[0].get("message") or {}).get("content", "").strip()
        if not text:
            raise ValidationError(_("The %(provider)s server returned no text.") % {"provider": provider.title()})
        return text

    @api.model
    def _call_ollama(self, question, screen_context=None):
        params = self.env["ir.config_parameter"].sudo()
        base_url = params.get_param("cleon_ai.ollama_base_url", "http://127.0.0.1:11434")
        model = params.get_param("cleon_ai.model", "") or "llama3.1"
        context = screen_context or {}
        prompt = question
        if context.get("screen"):
            prompt = _("You are assisting on the CleonHR %(screen)s screen. Give concise guidance.\n\n%(question)s", screen=context.get("screen"), question=question)
        payload = json.dumps({"model": model, "messages": [{"role": "user", "content": prompt}], "stream": False}).encode("utf-8")
        try:
            with urlopen(Request(base_url.rstrip("/") + "/api/chat", data=payload, headers={"Content-Type": "application/json"}, method="POST"), timeout=60) as response:
                data = json.loads(response.read().decode("utf-8"))
        except HTTPError as error:
            raise ValidationError(_("Ollama rejected the request (HTTP %s). Check that the model is installed.") % error.code)
        except (URLError, TimeoutError, ValueError):
            raise ValidationError(_("Could not reach Ollama at the configured local URL."))
        text = ((data.get("message") or {}).get("content") or "").strip()
        if not text:
            raise ValidationError(_("Ollama returned no text."))
        return text

    @api.model
    def complete_text(self, prompt):
        """Return provider text for server-side structured extraction tasks.

        This deliberately does not create a chat interaction: callers must
        record only the user-facing interaction they actually perform.
        """
        provider = self._provider_state()
        if not provider["configured"] or not provider["live_calls_enabled"]:
            raise ValidationError(_("No live AI provider is enabled."))
        name = provider["provider"]
        if name == "gemini":
            return self._call_gemini(prompt)
        if name == "ollama":
            return self._call_ollama(prompt)
        if name in ("openai", "local"):
            return self._call_openai_compatible(prompt, provider=name)
        raise ValidationError(_("No adapter is available for the selected AI provider."))

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
            result = {
                "answered": False,
                "message": _(
                    "The permission-aware assistant foundation is ready for %(heading)s, but no live AI provider has been enabled.",
                    heading=state.get("heading", _("this screen")),
                ),
                "provider": provider,
            }
            return self._record_interaction(question, result, screen_context)

        try:
            if provider.get("provider") == "gemini":
                result = {"answered": True, "message": self._call_gemini(question, screen_context), "provider": provider}
            elif provider.get("provider") == "ollama":
                result = {"answered": True, "message": self._call_ollama(question, screen_context), "provider": provider}
            elif provider.get("provider") in ("openai", "local"):
                result = {"answered": True, "message": self._call_openai_compatible(question, screen_context, provider=provider["provider"]), "provider": provider}
            else:
                result = {
                    "answered": False,
                    "message": _("The selected provider is configured, but no adapter is available for it."),
                    "provider": provider,
                }
        except ValidationError as error:
            result = {"answered": False, "message": error.args[0], "provider": provider}
        return self._record_interaction(question, result, screen_context)

    @api.model
    def _record_interaction(self, question, result, screen_context=None):
        provider = result.get("provider") or {}
        interaction = self.env["cleon.ai.interaction"].sudo().create({
            "company_id": self.env.company.id,
            "user_id": self.env.user.id,
            "screen": (screen_context or {}).get("screen") or "",
            "question": question,
            "answer": result.get("message") or "",
            "answered": bool(result.get("answered")),
            "provider": provider.get("provider") or "none",
            "context_data": screen_context or {},
        })
        return {**result, "interaction_id": interaction.id}

    @api.model
    def record_interaction_feedback(self, interaction_id, helpful):
        try:
            interaction_id = int(interaction_id)
        except (TypeError, ValueError):
            raise ValidationError(_("Invalid AI interaction."))
        interaction = self.env["cleon.ai.interaction"].sudo().browse(interaction_id).exists()
        if not interaction or interaction.user_id != self.env.user or interaction.company_id not in self.env.companies:
            raise AccessError(_("You can only rate your own AI interactions."))
        interaction.write({"helpful": bool(helpful), "feedback_at": fields.Datetime.now()})
        return {"ok": True}

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
