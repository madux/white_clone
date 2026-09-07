# -*- coding: utf-8 -*-
from odoo.exceptions import AccessError, ValidationError
from odoo.tests.common import TransactionCase
from unittest.mock import patch
import base64


class TestCleonAiArchitecture(TransactionCase):

    def setUp(self):
        super().setUp()
        self.gateway = self.env["cleon.ai.gateway"]
        # Tests must not inherit live credentials/configuration from the
        # developer database they happen to run against.
        params = self.env["ir.config_parameter"].sudo()
        params.set_param("cleon_ai.provider", "none")
        params.set_param("cleon_ai.live_calls_enabled", "False")

    def test_01_gateway_standalone_unattached_state(self):
        """Gateway returns a safe unattached default state when no screen context is passed."""
        state = self.gateway.get_assistant_state()
        self.assertEqual(state["scope"], "unattached")
        self.assertIn("provider", state)
        self.assertEqual(state["tools"], [])
        self.assertFalse(state["provider"]["configured"])

    def test_02_gateway_unknown_screen_fails_closed(self):
        """Unknown or unregistered business screens fail closed with AccessError."""
        with self.assertRaises(AccessError):
            self.gateway.get_assistant_state({"screen": "unregistered.custom.screen.xyz"})

    def test_03_provider_state_defaults(self):
        """Provider state reads from system parameters safely with unconfigured defaults."""
        provider = self.gateway._provider_state()
        self.assertIn("provider", provider)
        self.assertIn("model", provider)
        self.assertIn("configured", provider)
        self.assertIn("live_calls_enabled", provider)
        self.assertFalse(provider["live_calls_enabled"])

    def test_04_ask_assistant_returns_governed_status(self):
        """Asking a question returns a governed response noting live provider is deferred."""
        res = self.gateway.ask_assistant("How many employees are on leave?")
        self.assertFalse(res["answered"])
        self.assertIn("no live AI provider has been enabled", res["message"])
        self.assertTrue(res["interaction_id"])

    def test_08_assistant_feedback_is_persisted_for_its_owner(self):
        result = self.gateway.ask_assistant("Explain this screen")
        self.assertTrue(self.gateway.record_interaction_feedback(result["interaction_id"], True)["ok"])
        interaction = self.env["cleon.ai.interaction"].sudo().browse(result["interaction_id"])
        self.assertTrue(interaction.helpful)
        self.assertTrue(interaction.feedback_at)

    def test_05_unregistered_tool_execution_blocked(self):
        """Executing an unregistered tool raises ValidationError."""
        with self.assertRaises(ValidationError):
            self.gateway.execute_tool("nonexistent.tool")

    def test_06_unattached_tool_catalog_is_empty(self):
        """When no screen is published, the tool catalog is strictly empty."""
        self.assertEqual(self.gateway.get_tool_catalog(), [])
        self.assertEqual(self.gateway.get_tool_catalog({"screen": ""}), [])

    def test_07_execute_tool_without_screen_context_fails(self):
        """Attempting to execute tools without an explicit published screen context fails."""
        with self.assertRaises(ValidationError):
            self.gateway.execute_tool("leave.calendar.summarize", screen_context=None)

    def test_09_openai_provider_dispatches_to_compatible_adapter(self):
        """OpenAI must not fall through to the unsupported-provider response."""
        params = self.env["ir.config_parameter"].sudo()
        previous = {
            key: params.get_param(key, default=False)
            for key in ("cleon_ai.provider", "cleon_ai.live_calls_enabled", "cleon_ai.openai_api_key")
        }
        try:
            params.set_param("cleon_ai.provider", "openai")
            params.set_param("cleon_ai.live_calls_enabled", "True")
            params.set_param("cleon_ai.openai_api_key", "test-key")
            with patch.object(type(self.gateway), "_call_openai_compatible", return_value="OpenAI response") as adapter:
                result = self.gateway.ask_assistant("Hello")
            self.assertTrue(result["answered"])
            self.assertEqual(result["message"], "OpenAI response")
            adapter.assert_called_once()
            self.assertEqual(adapter.call_args.kwargs["provider"], "openai")
        finally:
            for key, value in previous.items():
                params.set_param(key, value or "")

    def test_10_gemini_audio_dispatch_is_transient_and_validated(self):
        params = self.env["ir.config_parameter"].sudo()
        previous = {
            key: params.get_param(key, default=False)
            for key in ("cleon_ai.provider", "cleon_ai.live_calls_enabled", "cleon_ai.gemini_api_key")
        }
        try:
            params.set_param("cleon_ai.provider", "gemini")
            params.set_param("cleon_ai.live_calls_enabled", "True")
            params.set_param("cleon_ai.gemini_api_key", "test-key")
            encoded = base64.b64encode(b"short-test-audio").decode()
            with patch.object(type(self.gateway), "_call_gemini_audio_transcription", return_value="Book sick leave tomorrow") as adapter:
                result = self.gateway.transcribe_audio(encoded, "audio/webm;codecs=opus")
            self.assertEqual(result, {"ok": True, "text": "Book sick leave tomorrow"})
            adapter.assert_called_once_with(encoded, "audio/webm")
            with self.assertRaises(ValidationError):
                self.gateway.transcribe_audio("not-base64", "audio/webm")
        finally:
            for key, value in previous.items():
                params.set_param(key, value or "")
