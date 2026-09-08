import hashlib
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


def coerce_int_ids(values):
    if values in (None, False, ""):
        return []
    if isinstance(values, dict):
        values = list(values.values())
    if isinstance(values, (int, float, str)):
        values = [values]
    ids = []
    for value in values:
        if value in (None, False, ""):
            continue
        if isinstance(value, dict):
            value = value.get("id") or value.get("document_id")
        try:
            doc_id = int(value)
        except (TypeError, ValueError):
            continue
        if doc_id and doc_id not in ids:
            ids.append(doc_id)
    return ids


class IntelligenceConversation(models.Model):
    _name = "doc.intelligence.conversation"
    _description = "Ask Cleon AI Conversation"
    _order = "write_date desc, id desc"

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
                    "preview_url": source.preview_path(),
                }
                for source in self.source_ids
            ],
        }
        if with_messages:
            payload["messages"] = [message.to_api() for message in self.message_ids]
        return payload

    def _index_source(self, source):
        self.env["doc.intelligence.ask.chunk"].index_source(source)

    def _ensure_sources_indexed(self):
        self.ensure_one()
        for source in self.source_ids:
            if source.chunk_ids:
                continue
            self._index_source(source)

    def _source_context(self, question):
        self.ensure_one()
        if not self.source_ids:
            return ""
        self._ensure_sources_indexed()
        chunks = self.env["doc.intelligence.ask.chunk"].search_similar(
            question, self.id, limit=8
        )
        parts = []
        for chunk in chunks:
            parts.append(
                "PRIMARY ATTACHED DOCUMENT (%s).\n%s"
                % (chunk.source_id.name, chunk.content)
            )
        if parts:
            return "\n\n".join(parts)
        names = ", ".join(self.source_ids.mapped("name"))
        return (
            "PRIMARY ATTACHED DOCUMENT(S): %s. No matching excerpts were retrieved "
            "for this question."
            % names
        )

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
            extra_context=self._source_context(question),
            history=history,
            dataset_id=self.dataset_id.id or None,
            has_attachments=bool(self.source_ids),
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
            extra_context=self._source_context(question),
            history=history,
            dataset_id=self.dataset_id.id or None,
            has_attachments=bool(self.source_ids),
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

    def _already_attached_message(self, names):
        names = [name for name in names if name]
        if len(names) == 1:
            return "%s is already attached to this chat." % names[0]
        return "These files are already attached to this chat: %s." % ", ".join(names)

    def _source_fingerprints(self):
        self.ensure_one()
        names = set()
        checksums = set()
        document_ids = set()
        urls = set()
        for source in self.source_ids:
            names.add((source.name or "").strip().lower())
            if source.document_id:
                document_ids.add(source.document_id.id)
            if source.url:
                urls.add((source.url or "").strip().rstrip("/").lower())
            attachment = source.attachment_id
            if not attachment and source.document_id:
                attachment = source.document_id.attachment_id
            if attachment and attachment.checksum:
                checksums.add(attachment.checksum)
        return names, checksums, document_ids, urls

    def action_attach_document(self, document_id=None, document_ids=None):
        ids = coerce_int_ids(document_ids) or coerce_int_ids(document_id)
        return self.action_attach_documents(ids)

    def action_attach_documents(self, document_ids):
        self.ensure_one()
        self._ensure_owner()
        ids = coerce_int_ids(document_ids)
        if not ids:
            raise UserError("Select at least one document.")
        documents = self.env["doc.document"].browse(ids).exists()
        if not documents:
            raise UserError("Document not found or you do not have access.")
        attached = 0
        skipped = []
        names, checksums, document_ids, _urls = self._source_fingerprints()
        for document in documents:
            digest = document.checksum or (
                document.attachment_id.checksum if document.attachment_id else ""
            )
            name_key = (document.name or "").strip().lower()
            if (
                document.id in document_ids
                or (name_key and name_key in names)
                or (digest and digest in checksums)
            ):
                skipped.append(document.name)
                continue
            if not document.attachment_id:
                raise UserError("%s has no file to ask about." % document.name)
            text, _source, _pages = extract_document_text(
                document.attachment_id, ocr_fallback=True, env=self.env
            )
            if not (text or "").strip():
                _logger.warning(
                    "Ask attach extracted no text from library document %s (%s)",
                    document.id,
                    document.name,
                )
            source = self.env["doc.intelligence.ask.source"].create(
                {
                    "conversation_id": self.id,
                    "kind": "library",
                    "name": document.name,
                    "document_id": document.id,
                    "extracted_text": text or "",
                }
            )
            self._index_source(source)
            attached += 1
            document_ids.add(document.id)
            if name_key:
                names.add(name_key)
            if digest:
                checksums.add(digest)
        if self._untitled() and documents:
            if len(documents) == 1:
                self.name = "Ask · %s" % ((documents[0].name or "document")[:72])
            else:
                self.name = "Ask · %s documents" % len(documents)
        if not attached:
            if skipped:
                raise UserError(self._already_attached_message(skipped))
            raise UserError("Those documents could not be attached.")
        return self.to_api(with_messages=True)

    def action_attach_url(self, url):
        self.ensure_one()
        self._ensure_owner()
        cleaned = (url or "").strip()
        key = cleaned.rstrip("/").lower()
        _names, _checksums, _document_ids, urls = self._source_fingerprints()
        if key and key in urls:
            raise UserError("That URL is already attached to this chat.")
        text = _fetch_url_text(cleaned)
        source = self.env["doc.intelligence.ask.source"].create(
            {
                "conversation_id": self.id,
                "kind": "url",
                "name": cleaned[:120],
                "url": cleaned,
                "extracted_text": text,
            }
        )
        self._index_source(source)
        return self.to_api(with_messages=True)

    def action_attach_upload(self, name, mimetype, data):
        return self.action_attach_uploads(
            [{"name": name, "mimetype": mimetype, "data": data}]
        )

    def action_attach_uploads(self, files):
        self.ensure_one()
        self._ensure_owner()
        import base64

        rows = files or []
        if not rows:
            raise UserError("Select at least one file.")
        if len(rows) > 10:
            raise UserError("You can attach up to 10 files at once.")
        attached = 0
        skipped = []
        first_name = ""
        names, checksums, _document_ids, _urls = self._source_fingerprints()
        for item in rows:
            name = (item.get("name") if isinstance(item, dict) else "") or "upload"
            mimetype = (
                item.get("mimetype") if isinstance(item, dict) else ""
            ) or "application/octet-stream"
            data = item.get("data") if isinstance(item, dict) else ""
            raw = base64.b64decode(data or "")
            if len(raw) > 5 * 1024 * 1024:
                raise UserError("%s must be 5 MB or smaller." % name)
            name_key = name.strip().lower()
            digest = hashlib.sha1(raw).hexdigest() if raw else ""
            if (name_key and name_key in names) or (digest and digest in checksums):
                skipped.append(name)
                continue
            attachment = self.env["ir.attachment"].create(
                {
                    "name": name,
                    "type": "binary",
                    "mimetype": mimetype,
                    "raw": raw,
                }
            )
            text, _source, _pages = extract_document_text(
                attachment, ocr_fallback=True, env=self.env
            )
            if not (text or "").strip():
                _logger.warning(
                    "Ask attach extracted no text from upload %s (%s)",
                    name,
                    _source,
                )
            source = self.env["doc.intelligence.ask.source"].create(
                {
                    "conversation_id": self.id,
                    "kind": "upload",
                    "name": name,
                    "attachment_id": attachment.id,
                    "extracted_text": text or "",
                }
            )
            self._index_source(source)
            attached += 1
            if name_key:
                names.add(name_key)
            if digest:
                checksums.add(digest)
            if not first_name:
                first_name = name
        if not attached:
            raise UserError(
                self._already_attached_message(skipped)
                if skipped
                else "The files could not be attached."
            )
        if self._untitled() and attached:
            if attached == 1:
                self.name = "Ask · %s" % (first_name[:72] or "upload")
            else:
                self.name = "Ask · %s files" % attached
        return self.to_api(with_messages=True)

    def action_remove_sources(self, source_ids=None):
        self.ensure_one()
        self._ensure_owner()
        ids = coerce_int_ids(source_ids)
        if not ids:
            raise UserError("Select at least one attached file.")
        sources = self.source_ids.filtered(lambda source: source.id in ids)
        if not sources:
            raise UserError("Those files are not attached to this chat.")
        uploads = sources.filtered(lambda source: source.kind == "upload").mapped(
            "attachment_id"
        )
        sources.unlink()
        uploads.unlink()
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

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        conversations = records.mapped("conversation_id")
        if conversations:
            self.env.cr.execute(
                """
                UPDATE doc_intelligence_conversation
                   SET write_date = (now() AT TIME ZONE 'UTC')
                 WHERE id IN %s
                """,
                [tuple(conversations.ids)],
            )
            conversations.invalidate_recordset(["write_date"])
        return records

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
    attachment_id = fields.Many2one("ir.attachment", ondelete="set null")
    extracted_text = fields.Text()
    chunk_ids = fields.One2many(
        "doc.intelligence.ask.chunk",
        "source_id",
        string="Index chunks",
    )

    def preview_path(self):
        self.ensure_one()
        if self.document_id:
            return "/document-management/document/%s/preview" % self.document_id.id
        if self.attachment_id:
            return "/document-management/intelligence/ask-source/%s/preview" % self.id
        return self.url or ""


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
