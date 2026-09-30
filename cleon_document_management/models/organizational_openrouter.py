# -*- coding: utf-8 -*-
import json
import logging
import os
import re
import ssl
import urllib.error
import urllib.request

_logger = logging.getLogger(__name__)

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
PARAM_KEY = "document_management.openrouter_api_key"
PARAM_MODEL = "document_management.openrouter_model"
DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"
DESCRIPTION_LIMIT = 500
SUMMARY_LIMIT = 1800
DOCUMENT_TEXT_LIMIT = 14000
MIN_DOCUMENT_CHARS = 40
REQUEST_TIMEOUT = 90

_THINK_RE = re.compile(r"<think>.*?</think>", flags=re.S | re.I)


def _dotenv_paths():
    here = os.path.dirname(os.path.abspath(__file__))
    addon = os.path.abspath(os.path.join(here, ".."))
    repo = os.path.abspath(os.path.join(addon, ".."))
    return (os.path.join(repo, ".env"), os.path.join(addon, ".env"))


def _read_dotenv_value(name):
    for path in _dotenv_paths():
        try:
            with open(path, encoding="utf-8") as handle:
                for raw in handle:
                    line = raw.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, value = line.split("=", 1)
                    if key.strip() != name:
                        continue
                    return value.strip().strip("'").strip('"')
        except OSError:
            continue
    return ""


def openrouter_api_key(env=None):
    key = (os.environ.get("OPENROUTER_API_KEY") or "").strip()
    if key:
        return key
    key = _read_dotenv_value("OPENROUTER_API_KEY")
    if key:
        return key
    if env is None:
        return ""
    return (env["ir.config_parameter"].sudo().get_param(PARAM_KEY) or "").strip()


def openrouter_model(env=None):
    model = (os.environ.get("OPENROUTER_MODEL") or "").strip()
    if not model:
        model = _read_dotenv_value("OPENROUTER_MODEL")
    if not model and env is not None:
        model = (
            env["ir.config_parameter"].sudo().get_param(PARAM_MODEL) or ""
        ).strip()
    return model or DEFAULT_MODEL


def _ssl_context():
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def _headers(api_key):
    return {
        "Authorization": "Bearer %s" % api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
        "HTTP-Referer": "https://cleonhr.com",
        "X-Title": "Cleon Document Management",
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
    }


def _read_http_error_body(error):
    try:
        return error.read().decode("utf-8", errors="replace")
    except Exception:
        return ""


def sanitize_description(text, limit=DESCRIPTION_LIMIT):
    text = _THINK_RE.sub("", text or "")
    text = text.replace("```", " ").strip()
    text = text.strip("\"'` \n\r\t")
    text = re.sub(r"[*_#]+", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    truncated = text[:limit].rsplit(" ", 1)[0].rstrip(".,;:")
    return truncated or text[:limit]


def _message_text(message):
    content = (message or {}).get("content") or ""
    if isinstance(content, list):
        content = "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )
    return str(content or "").strip()


def sanitize_summary(text, limit=SUMMARY_LIMIT):
    text = _THINK_RE.sub("", text or "")
    text = text.replace("```", "").strip()
    text = re.sub(r"^#{1,6}\s*", "", text, flags=re.M)
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"^[-*]\s+", "• ", text, flags=re.M)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip().strip('"')
    if len(text) <= limit:
        return text
    truncated = text[:limit].rsplit(" ", 1)[0].rstrip(".,;:")
    return truncated or text[:limit]


def _chat_completion(env, messages, temperature=0.3, max_tokens=400, error_context="request"):
    api_key = openrouter_api_key(env)
    if not api_key:
        raise RuntimeError(
            "OpenRouter is not configured. Set OPENROUTER_API_KEY in the environment."
        )
    payload = {
        "model": openrouter_model(env),
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    request = urllib.request.Request(
        OPENROUTER_CHAT_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers=_headers(api_key),
        method="POST",
    )
    try:
        with urllib.request.urlopen(
            request, timeout=REQUEST_TIMEOUT, context=_ssl_context()
        ) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = _read_http_error_body(error)
        _logger.warning(
            "OpenRouter %s failed: HTTP %s %s",
            error_context,
            error.code,
            (detail or error.reason)[:300],
        )
        if error.code == 401:
            raise RuntimeError("OpenRouter rejected the API key.") from error
        if error.code == 404:
            raise RuntimeError("The configured OpenRouter model is not available.") from error
        if error.code == 429:
            raise RuntimeError("The AI service is busy. Try again in a moment.") from error
        raise RuntimeError("The AI service could not complete the request.") from error
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        _logger.warning("OpenRouter %s failed: %s", error_context, error)
        raise RuntimeError("The AI service could not complete the request.") from error

    choice = (body.get("choices") or [{}])[0]
    return _message_text(choice.get("message") or {})


def _build_prompt(name, visibility=None, description=None):
    lines = [
        "Write a short folder description for a corporate HR document library.",
        "Folder name: %s" % name.strip(),
    ]
    visibility = (visibility or "").strip()
    if visibility:
        lines.append("Visibility: %s" % visibility)
    draft = (description or "").strip()
    if draft:
        lines.append("Existing draft to refine: %s" % draft)
        lines.append("Improve the draft. Keep the meaning. Make it clearer.")
    else:
        lines.append("Describe what documents belong in this organizational folder.")
    lines.extend(
        [
            "Write 1 to 3 sentences in plain English.",
            "No markdown, no quotation marks, no title prefix.",
            "Maximum %s characters." % DESCRIPTION_LIMIT,
        ]
    )
    return "\n".join(lines)


def suggest_folder_description(env, name, visibility=None, description=None):
    """Return a sanitized folder description from OpenRouter."""
    folder_name = (name or "").strip()
    if not folder_name:
        raise ValueError("Folder name is required.")
    suggested = sanitize_description(
        _chat_completion(
            env,
            [
                {
                    "role": "system",
                    "content": (
                        "You write concise professional descriptions for organizational "
                        "HR document folders. Reply with the description only."
                    ),
                },
                {
                    "role": "user",
                    "content": _build_prompt(folder_name, visibility, description),
                },
            ],
            error_context="folder description",
        )
    )
    if not suggested:
        raise RuntimeError("The model did not return a description. Try again.")
    return suggested


def _build_policy_prompt(name, brief=None):
    lines = [
        "Draft a short organisational HR policy briefing.",
        "Policy name: %s" % name.strip(),
    ]
    notes = (brief or "").strip()
    if notes:
        lines.append("Author brief: %s" % notes)
        lines.append("Turn the brief into a professional policy description.")
    else:
        lines.append("Describe the purpose, who it applies to, and what it requires.")
    lines.extend(
        [
            "Write 2 to 4 sentences in plain English.",
            "No markdown, no quotation marks, no title prefix.",
            "Maximum %s characters." % DESCRIPTION_LIMIT,
        ]
    )
    return "\n".join(lines)


def draft_policy_description(env, name, brief=None):
    """Return a sanitized policy description from OpenRouter."""
    policy_name = (name or "").strip()
    if not policy_name:
        raise ValueError("Policy name is required.")
    suggested = sanitize_description(
        _chat_completion(
            env,
            [
                {
                    "role": "system",
                    "content": (
                        "You write concise professional HR policy briefings. "
                        "Reply with the policy description only."
                    ),
                },
                {
                    "role": "user",
                    "content": _build_policy_prompt(policy_name, brief),
                },
            ],
            temperature=0.3,
            max_tokens=500,
            error_context="policy draft",
        )
    )
    if not suggested:
        raise RuntimeError("The model did not return a policy draft. Try again.")
    return suggested


def _build_summary_prompt(name, body, document_type=None):
    lines = [
        "Summarize this organizational HR document for a professional reader.",
        "Document name: %s" % (name or "").strip(),
    ]
    document_type = (document_type or "").strip()
    if document_type:
        lines.append("Document type: %s" % document_type)
    lines.extend(
        [
            "",
            "Document text:",
            body.strip(),
            "",
            "Reply in this exact shape:",
            "A one-sentence overview.",
            "Then 3 to 6 key points, each on its own line starting with • ",
            "Then one short closing line on who it applies to or what to do next, if that is clear.",
            "Plain English. No markdown headings. No preamble.",
        ]
    )
    return "\n".join(lines)


def summarize_document_text(env, name, body, document_type=None):
    """Return a professional briefing for an organizational document."""
    excerpt = re.sub(r"\s+", " ", (body or "")).strip()
    if len(excerpt) < MIN_DOCUMENT_CHARS:
        raise ValueError(
            "This file does not contain enough readable text to summarize."
        )
    if len(excerpt) > DOCUMENT_TEXT_LIMIT:
        excerpt = excerpt[:DOCUMENT_TEXT_LIMIT]
    summary = sanitize_summary(
        _chat_completion(
            env,
            [
                {
                    "role": "system",
                    "content": (
                        "You write concise professional briefings of HR and policy "
                        "documents. Reply with the summary only."
                    ),
                },
                {
                    "role": "user",
                    "content": _build_summary_prompt(name, excerpt, document_type),
                },
            ],
            temperature=0.2,
            max_tokens=700,
            error_context="document summary",
        )
    )
    if not summary:
        raise RuntimeError("The model did not return a summary. Try again.")
    return summary
