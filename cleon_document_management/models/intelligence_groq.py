import base64
import json
import logging
import os
import re
import urllib.error
import urllib.request

_logger = logging.getLogger(__name__)

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_EMBED_URL = "https://api.groq.com/openai/v1/embeddings"
LLM_MODEL = "openai/gpt-oss-120b"
VISION_MODEL = "qwen/qwen3.6-27b"
EMBED_MODEL = "nomic-embed-text-v1_5"
EMBED_MODELS = ("nomic-embed-text-v1_5", "nomic-embed-text-v1.5")
EMBED_DIM = 768
PARAM_KEY = "cleon_document_management.groq_api_key"


def groq_api_key(env=None):
    key = (os.environ.get("GROQ_API_KEY") or "").strip()
    if key:
        return key
    if env is None:
        return ""
    return (env["ir.config_parameter"].sudo().get_param(PARAM_KEY) or "").strip()


def groq_configured(env=None):
    return bool(groq_api_key(env))


def _groq_headers(api_key):
    # Cloudflare in front of api.groq.com returns 403 / 1010 for Python's
    # default urllib User-Agent. A normal browser UA is enough for Groq.
    return {
        "Authorization": "Bearer %s" % api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
    }


def _strip_think(text):
    text = re.sub(r"<think>.*?</think>", "", text or "", flags=re.S)
    return text.strip()


def _message_text(message):
    if not message:
        return ""
    content = message.get("content")
    if isinstance(content, list):
        parts = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                parts.append(item.get("text") or item.get("content") or "")
        content = "".join(parts)
    return _strip_think(content or "")


def _choice_text(data):
    choice = (data.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    return _message_text(message) or _strip_think(choice.get("text") or "")


def strip_reference_sections(text):
    """Drop trailing source/citation blocks from model answers."""
    cleaned = re.split(
        r"\n\s*(?:\*\*)?(?:references?|sources?|citations?|footnotes?)(?:\*\*)?\s*:?\s*\n",
        text or "",
        maxsplit=1,
        flags=re.I,
    )[0]
    cleaned = re.sub(r"\s*\[[0-9]+\]\s*$", "", cleaned.strip())
    return cleaned.strip()


def _request(url, payload, api_key, timeout=90):
    body = json.dumps(payload).encode()
    request = urllib.request.Request(
        url,
        data=body,
        headers=_groq_headers(api_key),
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")[:800]
        if error.code == 403 and "1010" in detail:
            raise RuntimeError(
                "Groq blocked this server as a bot (Cloudflare 1010). "
                "Restart Odoo after updating Document Intelligence, and keep "
                "GROQ_API_KEY set on the Odoo process."
            ) from error
        raise RuntimeError("Groq HTTP %s: %s" % (error.code, detail)) from error


def transcribe_images(images, env=None):
    """Read visible text from images with Qwen vision. images: list of (mime, bytes)."""
    api_key = groq_api_key(env)
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set.")
    usable = [(mime, raw) for mime, raw in images or [] if raw]
    if not usable:
        return ""
    parts = []
    for start in range(0, len(usable), 4):
        batch = usable[start : start + 4]
        content = [
            {
                "type": "text",
                "text": (
                    "Extract all readable text from these document pages exactly as written. "
                    "Preserve labels, names, dates, and numbers. Do not summarize. "
                    "Do not describe the layout. Return only the text."
                ),
            }
        ]
        for mime, raw in batch:
            encoded = base64.b64encode(raw).decode()
            content.append(
                {
                    "type": "image_url",
                    "image_url": {
                        "url": "data:%s;base64,%s" % (mime or "image/png", encoded)
                    },
                }
            )
        data = _request(
            GROQ_CHAT_URL,
            {
                "model": VISION_MODEL,
                "temperature": 0,
                "max_completion_tokens": 4096,
                "messages": [{"role": "user", "content": content}],
            },
            api_key,
            timeout=120,
        )
        text = _choice_text(data)
        if text:
            parts.append(text)
    return "\n".join(parts).strip()


def embed_texts(texts, env=None):
    api_key = groq_api_key(env)
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set.")
    clean = [text.strip() for text in texts if (text or "").strip()]
    if not clean:
        return []
    last_error = None
    for model in EMBED_MODELS:
        try:
            vectors = []
            for start in range(0, len(clean), 32):
                batch = clean[start : start + 32]
                data = _request(
                    GROQ_EMBED_URL,
                    {
                        "model": model,
                        "input": batch,
                        "encoding_format": "float",
                    },
                    api_key,
                    timeout=60,
                )
                rows = sorted(
                    data.get("data") or [], key=lambda item: item.get("index", 0)
                )
                vectors.extend(row.get("embedding") or [] for row in rows)
            return vectors
        except Exception as error:
            last_error = error
            _logger.warning("Embedding model %s failed: %s", model, error)
    raise last_error or RuntimeError("Embedding failed.")


def _answer_messages(question, context, history=None):
    system = (
        "You are Cleon AI, the brain and AI agent of the Cleon HR app. "
        "You are not ChatGPT, Claude, Gemini, or any other third-party assistant. "
        "Speak as Cleon AI: helpful, clear, and professional for HR and people operations. "
        "Answer using the supplied evidence and the conversation so far. "
        "If PRIMARY ATTACHED DOCUMENT excerpts are present, treat them as the "
        "main source and use DATASET EXCERPT items only as extra context. "
        "Use markdown when it helps: headings (##), tables, **bold**, lists, "
        "and `code`. Keep tables compact: one markdown row per table row, every "
        "cell on that same line. If a table has a heading column and a details "
        "column, put every bullet only in the details column — never start a new "
        "row with a bullet in the first column. Never use HTML tags such as <br> "
        "or <p>; use markdown line breaks and lists instead. "
        "Do not add a references, sources, or citations section. "
        "If the evidence is missing, say so. Do not invent employees, dates, or amounts."
    )
    messages = [{"role": "system", "content": system}]
    for item in (history or [])[-8:]:
        role = item.get("role") if isinstance(item, dict) else None
        content = item.get("content") if isinstance(item, dict) else None
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content[:2000]})
    messages.append(
        {
            "role": "user",
            "content": "Evidence:\n%s\n\nQuestion: %s" % (context, question),
        }
    )
    return messages


def iter_chat_deltas(messages, env=None, max_completion_tokens=1200):
    """Yield visible answer tokens from Groq (skips model reasoning)."""
    api_key = groq_api_key(env)
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set.")
    payload = {
        "model": LLM_MODEL,
        "temperature": 0,
        "max_completion_tokens": max_completion_tokens,
        "stream": True,
        "messages": messages,
    }
    request = urllib.request.Request(
        GROQ_CHAT_URL,
        data=json.dumps(payload).encode(),
        headers=_groq_headers(api_key),
        method="POST",
    )
    buffer = b""
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            while True:
                chunk = response.read(256)
                if not chunk:
                    break
                buffer += chunk
                while b"\n" in buffer:
                    line, buffer = buffer.split(b"\n", 1)
                    line = line.strip()
                    if not line.startswith(b"data:"):
                        continue
                    data = line[5:].strip()
                    if data == b"[DONE]":
                        return
                    try:
                        payload = json.loads(data.decode())
                    except json.JSONDecodeError:
                        continue
                    delta = ((payload.get("choices") or [{}])[0].get("delta") or {})
                    piece = delta.get("content")
                    if isinstance(piece, list):
                        piece = "".join(
                            (
                                item.get("text") or ""
                                if isinstance(item, dict)
                                else (item or "")
                            )
                            for item in piece
                        )
                    if piece:
                        yield piece
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")[:800]
        raise RuntimeError("Groq HTTP %s: %s" % (error.code, detail)) from error


def parse_json_object(text):
    cleaned = _strip_think(text or "").strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.I)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start < 0 or end <= start:
        return {}
    try:
        payload = json.loads(cleaned[start : end + 1])
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def complete_chat(messages, env=None, max_completion_tokens=1200, timeout=90):
    api_key = groq_api_key(env)
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set.")
    data = _request(
        GROQ_CHAT_URL,
        {
            "model": LLM_MODEL,
            "temperature": 0,
            "max_completion_tokens": max_completion_tokens,
            "messages": messages,
        },
        api_key,
        timeout=timeout,
    )
    return _choice_text(data)


def answer_with_context(question, context, env=None, history=None):
    api_key = groq_api_key(env)
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set.")
    data = _request(
        GROQ_CHAT_URL,
        {
            "model": LLM_MODEL,
            "temperature": 0,
            "max_completion_tokens": 1200,
            "messages": _answer_messages(question, context, history),
        },
        api_key,
    )
    return strip_reference_sections(_choice_text(data))


_TITLE_STOP = {
    "a",
    "an",
    "and",
    "are",
    "can",
    "do",
    "does",
    "for",
    "how",
    "i",
    "in",
    "is",
    "me",
    "next",
    "of",
    "or",
    "please",
    "show",
    "the",
    "to",
    "we",
    "what",
    "which",
    "who",
    "with",
}


def fallback_conversation_title(question):
    """Short title when Groq is unavailable. Never use the full question."""
    words = [
        word
        for word in re.findall(r"[A-Za-z][A-Za-z']*", question or "")
        if word.lower() not in _TITLE_STOP
    ]
    if not words:
        words = re.findall(r"[A-Za-z][A-Za-z']*", question or "")[:4]
    if not words:
        return "New chat"
    title = " ".join(words[:4])
    return title[:1].upper() + title[1:]


def sanitize_conversation_title(raw, question):
    text = _strip_think(raw or "").splitlines()[0] if raw else ""
    text = text.strip(" \"'`“”‘’")
    text = re.sub(r"[*_`#]+", "", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"[.?!]+$", "", text).strip()
    if len(text) > 42:
        text = text[:42].rsplit(" ", 1)[0].strip()
    if len(text) < 3:
        return ""
    compact = re.sub(r"\W+", "", text).lower()
    source = re.sub(r"\W+", "", question or "").lower()
    if source and compact == source:
        return ""
    if len(text) > 28 and source.startswith(compact):
        return ""
    return text


def suggest_conversation_title(question, env=None):
    """Short sidebar name from the first user message."""
    fallback = fallback_conversation_title(question)
    api_key = groq_api_key(env)
    if not api_key:
        return fallback
    try:
        data = _request(
            GROQ_CHAT_URL,
            {
                "model": LLM_MODEL,
                "temperature": 0.2,
                "max_completion_tokens": 400,
                "messages": [
                    {
                        "role": "system",
                        "content": (
                            "You are Cleon AI naming a chat in the Cleon HR app. "
                            "Create a short sidebar title. Output only the title. "
                            "2 to 5 words. No quotes. No question. "
                            "Do not repeat the user message."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (question or "")[:500],
                    },
                ],
            },
            api_key,
            timeout=45,
        )
        return sanitize_conversation_title(_choice_text(data), question) or fallback
    except Exception as error:
        _logger.warning("Conversation title could not be generated: %s", error)
        return fallback
