# -*- coding: utf-8 -*-
import json
from unittest.mock import patch

from odoo.tests import tagged
from odoo.tests.common import TransactionCase

from odoo.addons.cleon_document_management.models import organizational_openrouter as helper


class FakeResponse:
    def __init__(self, payload):
        self._payload = json.dumps(payload).encode()

    def read(self):
        return self._payload

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


@tagged("post_install", "-at_install")
class TestOrganizationalOpenRouter(TransactionCase):
    def test_sanitize_strips_markdown_and_caps_length(self):
        text = helper.sanitize_description('**"' + ("Policies " * 80) + '"**')
        self.assertLessEqual(len(text), 500)
        self.assertFalse(text.startswith('"'))
        self.assertNotIn("**", text)

    def test_sanitize_drops_think_blocks(self):
        text = helper.sanitize_description(
            "<think>hidden</think>Company policies and staff handbooks."
        )
        self.assertEqual(text, "Company policies and staff handbooks.")

    def test_suggest_folder_description_uses_model_content(self):
        payload = {
            "choices": [
                {
                    "message": {
                        "content": "Company policies, handbooks, and related HR guidance."
                    }
                }
            ]
        }
        with patch.object(helper, "openrouter_api_key", return_value="test-key"):
            with patch.object(helper.urllib.request, "urlopen", return_value=FakeResponse(payload)):
                text = helper.suggest_folder_description(self.env, "Company Policies")
        self.assertEqual(
            text, "Company policies, handbooks, and related HR guidance."
        )

    def test_sanitize_summary_keeps_bullets(self):
        text = helper.sanitize_summary(
            "<think>x</think>## Heading\n**Overview line.**\n- First point\n- Second point"
        )
        self.assertNotIn("##", text)
        self.assertIn("• First point", text)
        self.assertIn("Overview line.", text)

    def test_summarize_document_text_requires_content(self):
        with self.assertRaises(ValueError):
            helper.summarize_document_text(self.env, "Empty", "   ")

    def test_summarize_document_text_uses_model_content(self):
        payload = {
            "choices": [
                {
                    "message": {
                        "content": (
                            "This policy sets workplace conduct.\n"
                            "• Applies to all staff\n"
                            "Review annually."
                        )
                    }
                }
            ]
        }
        with patch.object(helper, "openrouter_api_key", return_value="test-key"):
            with patch.object(
                helper.urllib.request, "urlopen", return_value=FakeResponse(payload)
            ):
                text = helper.summarize_document_text(
                    self.env,
                    "Code of Conduct",
                    "All employees must follow the code of conduct and report issues.",
                )
        self.assertIn("workplace conduct", text)
        self.assertIn("• Applies to all staff", text)

    def test_policy_prompt_asks_for_a_briefing(self):
        prompt = helper._build_policy_prompt("Remote Work", "Cover hybrid days")
        self.assertIn("Remote Work", prompt)
        self.assertIn("hybrid days", prompt)
        self.assertIn("policy briefing", prompt.lower())

    def test_draft_policy_description_returns_plain_text(self):
        payload = {
            "choices": [
                {
                    "message": {
                        "content": '**"Staff must follow the remote work policy."**'
                    }
                }
            ]
        }
        with patch.object(helper, "openrouter_api_key", return_value="test-key"):
            with patch.object(
                helper.urllib.request, "urlopen", return_value=FakeResponse(payload)
            ):
                text = helper.draft_policy_description(
                    self.env, "Remote Work", "Cover hybrid days"
                )
        self.assertEqual(text, "Staff must follow the remote work policy.")
