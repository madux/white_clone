import json
import logging
import re
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from odoo import api, fields, models
from odoo.exceptions import AccessError, UserError

from .intelligence_ask import answer_question, start_answer
from .intelligence_groq import (
    fallback_conversation_title,
    iter_chat_deltas,
    strip_reference_sections,
    suggest_conversation_title,
)
from .intelligence_pipeline import extract_document_text

_logger = logging.getLogger(__name__)


class IntelligenceConversation(models.Model):
    _name = "doc.intelligence.conversation"
    _description = "Ask Cleon AI Conversation"
    _order = "write_date desc"

    name = fields.Char(default="New chat")
    user_id = fields.Many2one(
        "res.users",
        default=lambda self: self.env.user,
        required=True,
        index=True,
    )
    company_id = fields.Many2one(
        "res.company",
        default=lambda self: self.env.company,
        required=True,
    )
    saved = fields.Boolean(default=False, index=True)
    dataset_id = fields.Many2one("doc.intelligence.dataset", ondelete="set null")
    message_ids = fields.One2many(
        "doc.intelligence.message",
        "conversation_id",
        string="Messages",
    )
    source_ids = fields.One2many(
        "doc.intelligence.ask.source",
        "conversation_id",
        string="Attached sources",
    )

    def _ensure_owner(self):
        self.ensure_one()
        user = self.env.user
        is_admin = user.has_group("base.group_system") or user.has_group(
            "cleon_document_management.group_document_admin"
        )
        if not is_admin and self.user_id != user:
            raise AccessError("You can only open your own conversations.")

    def to_api(self, with_messages=False):
        self.ensure_one()
        payload = {
            "id": self.id,
            "name": self.name or "New chat",
            "saved": self.saved,
            "dataset_id": self.dataset_id.id or False,
            "dataset": self.dataset_id.name or "",
            "write_date": str(self.write_date or ""),
            "preview": (self.message_ids[-1:].content or "")[:120],
            "sources": [
                {
                    "id": source.id,
                    "kind": source.kind,
                    "name": source.name,
                    "url": source.url or "",
                    "document_id": source.document_id.id or 0,
                }
                for source in self.source_ids
            ],
        }
        if with_messages:
            payload["messages"] = [message.to_api() for message in self.message_ids]
        return payload

    def _source_context(self):
        parts = []
        for source in self.source_ids:
            text = (source.extracted_text or "").strip()
            if not text:
                continue
            parts.append("Attached %s (%s):\n%s" % (source.kind, source.name, text[:4000]))
        return "\n\n".join(parts)

    def _untitled(self):
        name = (self.name or "").strip()
        return name in ("", "New conversation", "New chat")

    def _store_assistant(self, result):
        self.env["doc.intelligence.message"].create(
            {
                "conversation_id": self.id,
                "role": "assistant",
                "content": result["answer"],
                "citations_json": "[]",
                "intent": result.get("intent") or "",
                "fact_based": bool(result.get("fact_based")),
                "model": result.get("model") or "",
                "insufficient_evidence": bool(result.get("insufficient_evidence")),
            }
        )
        self.env["doc.intelligence.audit.event"].log_event(
            "query",
            "asked",
            target=self,
            detail=(self.message_ids.filtered(lambda item: item.role == "user")[-1:].content or "")[:500],
            after=(result.get("answer") or "")[:2000],
        )

    def action_ask(self, question):
        self.ensure_one()
        self._ensure_owner()
        question = (question or "").strip()
        if not question:
            raise UserError("Enter a question.")
        self.env["doc.intelligence.message"].create(
            {
                "conversation_id": self.id,
                "role": "user",
                "content": question,
            }
        )
        user_turns = self.message_ids.filtered(lambda item: item.role == "user")
        if len(user_turns) == 1 or self._untitled():
            self.name = suggest_conversation_title(question, env=self.env)
        history = [
            {"role": message.role, "content": message.content}
            for message in self.message_ids.sorted("id")[:-1]
        ]
        result = answer_question(
            self.env,
            question,
            extra_context=self._source_context(),
            history=history,
            dataset_id=self.dataset_id.id or None,
        )
        self._store_assistant(result)
        return self.to_api(with_messages=True)

    def iter_ask_events(self, question):
        self.ensure_one()
        self._ensure_owner()
        question = (question or "").strip()
        if not question:
            raise UserError("Enter a question.")
        user_message = self.env["doc.intelligence.message"].create(
            {
                "conversation_id": self.id,
                "role": "user",
                "content": question,
            }
        )
        user_turns = self.message_ids.filtered(lambda item: item.role == "user")
        needs_title = len(user_turns) == 1 or self._untitled()
        if needs_title:
            self.name = fallback_conversation_title(question)
        yield {
            "event": "meta",
            "id": self.id,
            "name": self.name,
            "user_message": user_message.to_api(),
        }
        yield {"event": "thinking"}
        if needs_title:
            self.name = suggest_conversation_title(question, env=self.env)
            yield {"event": "rename", "name": self.name}
        history = [
            {"role": message.role, "content": message.content}
            for message in self.message_ids.sorted("id")[:-1]
        ]
        started = start_answer(
            self.env,
            question,
            extra_context=self._source_context(),
            history=history,
            dataset_id=self.dataset_id.id or None,
        )
        if started["mode"] == "ready":
            result = started["result"]
            chunks = re.findall(r"\S+\s*", result.get("answer") or "") or [
                result.get("answer") or ""
            ]
            for piece in chunks:
                yield {"event": "delta", "text": piece}
            self._store_assistant(result)
            yield {"event": "done", "conversation": self.to_api(with_messages=True)}
            return
        pieces = []
        for piece in iter_chat_deltas(started["messages"], env=self.env):
            pieces.append(piece)
            yield {"event": "delta", "text": piece}
        answer = strip_reference_sections("".join(pieces))
        if not answer:
            from .intelligence_groq import answer_with_context

            answer = answer_with_context(
                question,
                started["context"],
                env=self.env,
                history=history,
            )
            for piece in re.findall(r"\S+\s*", answer) or [answer]:
                yield {"event": "delta", "text": piece}
        result = {
            **started["result_meta"],
            "answer": answer,
        }
        self._store_assistant(result)
        yield {"event": "done", "conversation": self.to_api(with_messages=True)}

    def action_delete(self):
        self.ensure_one()
        self._ensure_owner()
        self.unlink()
        return True

    def action_attach_document(self, document_id):
        self.ensure_one()
        self._ensure_owner()
        document = self.env["doc.document"].browse(int(document_id)).exists()
        if not document:
            raise UserError("Document not found or you do not have access.")
        text, _source, _pages = extract_document_text(
            document.attachment_id, ocr_fallback=True, env=self.env
        )
        self.env["doc.intelligence.ask.source"].create(
            {
                "conversation_id": self.id,
                "kind": "library",
                "name": document.name,
                "document_id": document.id,
                "extracted_text": text or "",
            }
        )
        return self.to_api(with_messages=True)

    def action_attach_url(self, url):
        self.ensure_one()
        self._ensure_owner()
        text = _fetch_url_text(url)
        self.env["doc.intelligence.ask.source"].create(
            {
                "conversation_id": self.id,
                "kind": "url",
                "name": url[:120],
                "url": url,
                "extracted_text": text,
            }
        )
        return self.to_api(with_messages=True)

    def action_attach_upload(self, name, mimetype, data):
        self.ensure_one()
        self._ensure_owner()
        import base64

        raw = base64.b64decode(data or "")
        if len(raw) > 5 * 1024 * 1024:
            raise UserError("Attached files must be 5 MB or smaller.")
        attachment = self.env["ir.attachment"].create(
            {
                "name": name or "upload",
                "type": "binary",
                "mimetype": mimetype or "application/octet-stream",
                "raw": raw,
            }
        )
        text, _source, _pages = extract_document_text(
            attachment, ocr_fallback=True, env=self.env
        )
        self.env["doc.intelligence.ask.source"].create(
            {
                "conversation_id": self.id,
                "kind": "upload",
                "name": name or "Uploaded file",
                "extracted_text": text or "",
            }
        )
        return self.to_api(with_messages=True)


class IntelligenceMessage(models.Model):
    _name = "doc.intelligence.message"
    _description = "Ask Cleon AI Message"
    _order = "id"

    conversation_id = fields.Many2one(
        "doc.intelligence.conversation",
        required=True,
        ondelete="cascade",
        index=True,
    )
    role = fields.Selection(
        [("user", "User"), ("assistant", "Assistant")],
        required=True,
    )
    content = fields.Text(required=True)
    citations_json = fields.Text(default="[]")
    intent = fields.Char()
    fact_based = fields.Boolean()
    model = fields.Char()
    insufficient_evidence = fields.Boolean()

    def to_api(self):
        self.ensure_one()
        try:
            citations = json.loads(self.citations_json or "[]")
        except json.JSONDecodeError:
            citations = []
        return {
            "id": self.id,
            "role": self.role,
            "content": self.content,
            "citations": citations,
            "intent": self.intent or "",
            "fact_based": self.fact_based,
            "model": self.model or "",
            "insufficient_evidence": self.insufficient_evidence,
            "create_date": str(self.create_date or ""),
        }


class IntelligenceAskSource(models.Model):
    _name = "doc.intelligence.ask.source"
    _description = "Ask Cleon AI Attached Source"

    conversation_id = fields.Many2one(
        "doc.intelligence.conversation",
        required=True,
        ondelete="cascade",
        index=True,
    )
    kind = fields.Selection(
        [("upload", "Upload"), ("url", "URL"), ("library", "Library")],
        required=True,
    )
    name = fields.Char(required=True)
    url = fields.Char()
    document_id = fields.Many2one("doc.document", ondelete="set null")
    extracted_text = fields.Text()


def _fetch_url_text(url):
    parsed = urlparse((url or "").strip())
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise UserError("Paste a valid http or https URL.")
    host = (parsed.hostname or "").lower()
    if host in ("localhost", "127.0.0.1", "::1"):
        raise UserError("Local URLs cannot be fetched.")
    request = Request(
        parsed.geturl(),
        headers={"User-Agent": "CleonHR-DocumentIntelligence/1.0"},
        method="GET",
    )
    try:
        with urlopen(request, timeout=10) as response:
            raw = response.read(200000)
    except Exception as error:
        raise UserError("The URL could not be read: %s" % error) from error
    text = raw.decode("utf-8", errors="replace")
    text = re.sub(r"(?is)<script.*?>.*?</script>", " ", text)
    text = re.sub(r"(?is)<style.*?>.*?</style>", " ", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()[:8000]
