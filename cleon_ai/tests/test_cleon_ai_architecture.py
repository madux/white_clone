# -*- coding: utf-8 -*-
from odoo.exceptions import AccessError, ValidationError
from odoo.tests.common import TransactionCase


class TestCleonAiArchitecture(TransactionCase):

    def setUp(self):
        super().setUp()
        self.gateway = self.env["cleon.ai.gateway"]

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
