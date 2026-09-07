import base64
import json
import logging
import os
import urllib.error
import urllib.request

_logger = logging.getLogger(__name__)

GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions"
GROQ_EMBED_URL = "https://api.groq.com/openai/v1/embeddings"
LLM_MODEL = "openai/gpt-oss-120b"
VISION_MODEL = "qwen/qwen3.6-27b"
EMBED_MODEL = "nomic-embed-text-v1_5"
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


def _request(url, payload, api_key, timeout=90):
    body = json.dumps(payload).encode()
    # Cloudflare in front of api.groq.com returns 403 / 1010 for Python's
    # default urllib User-Agent. A normal browser UA is enough for Groq.
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Authorization": "Bearer %s" % api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/122.0.0.0 Safari/537.36"
            ),
        },
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
    if not images:
        return ""
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
    for mime, raw in images[:4]:
        if not raw:
            continue
        encoded = base64.b64encode(raw).decode()
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": "data:%s;base64,%s" % (mime or "image/png", encoded)},
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
    )
    return (
        ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    ).strip()


def embed_texts(texts, env=None):
    api_key = groq_api_key(env)
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set.")
    clean = [text.strip() for text in texts if (text or "").strip()]
    if not clean:
        return []
    data = _request(
        GROQ_EMBED_URL,
        {"model": EMBED_MODEL, "input": clean, "encoding_format": "float"},
        api_key,
        timeout=60,
    )
    rows = sorted(data.get("data") or [], key=lambda item: item.get("index", 0))
    return [row.get("embedding") or [] for row in rows]


def answer_with_context(question, context, env=None):
    api_key = groq_api_key(env)
    if not api_key:
        raise RuntimeError("GROQ_API_KEY is not set.")
    system = (
        "You answer HR document questions using only the supplied evidence. "
        "Cite document names and pages. If the evidence is missing, say so. "
        "Do not invent employees, dates, or amounts."
    )
    data = _request(
        GROQ_CHAT_URL,
        {
            "model": LLM_MODEL,
            "temperature": 0,
            "max_completion_tokens": 800,
            "messages": [
                {"role": "system", "content": system},
                {
                    "role": "user",
                    "content": "Evidence:\n%s\n\nQuestion: %s" % (context, question),
                },
            ],
        },
        api_key,
    )
    return (
        ((data.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    ).strip()
