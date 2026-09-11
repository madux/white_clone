# -*- coding: utf-8 -*-
import base64
import json
import logging
import os
import re
import ssl
import urllib.error
import urllib.request

_logger = logging.getLogger(__name__)

OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions"
PARAM_KEY = "social_gallery.openrouter_api_key"
# Must support multimodal image input on OpenRouter.
DEFAULT_MODEL = "google/gemini-2.0-flash-001"


def openrouter_api_key(env=None):
    key = (os.environ.get("OPENROUTER_API_KEY") or "").strip()
    if key:
        return key
    if env is None:
        return ""
    return (env["ir.config_parameter"].sudo().get_param(PARAM_KEY) or "").strip()


def openrouter_configured(env=None):
    return bool(openrouter_api_key(env))


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
        "X-Title": "Cleon Social Gallery",
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/122.0.0.0 Safari/537.36"
        ),
    }


def _extract_json(text):
    text = (text or "").strip()
    if not text:
        return {}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, flags=re.S)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                return {}
    return {}


def _read_http_error_body(error):
    try:
        return error.read().decode("utf-8", errors="replace")
    except Exception:
        return ""


def moderate_media(env, media, image_bytes=None, image_mime="image/jpeg"):
    """Return (flags, note) from OpenRouter vision screening."""
    api_key = openrouter_api_key(env)
    if not api_key:
        return [], ""

    if media.media_type == "video":
        return ["video_review_required"], "Video content requires manual moderation."

    if not image_bytes:
        return [], ""

    encoded = base64.b64encode(image_bytes).decode("ascii")
    data_url = "data:%s;base64,%s" % (image_mime or "image/jpeg", encoded)
    prompt = (
        "You are a corporate social gallery content moderator. "
        "Review this image for workplace appropriateness. "
        "Flag explicit, violent, hateful, or clearly non-workplace content. "
        'Respond with JSON only: {"flags": ["short_flag"], "note": "brief reason"}. '
        "Use an empty flags array when content is appropriate."
    )
    payload = {
        "model": env["ir.config_parameter"].sudo().get_param(
            "social_gallery.openrouter_model", DEFAULT_MODEL
        ),
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "temperature": 0,
        "max_tokens": 300,
    }
    request = urllib.request.Request(
        OPENROUTER_CHAT_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers=_headers(api_key),
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45, context=_ssl_context()) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = _read_http_error_body(error)
        _logger.warning(
            "OpenRouter moderation failed for media %s: HTTP %s %s",
            media.id,
            error.code,
            detail or error.reason,
        )
        return ["moderation_unavailable"], "Automated moderation could not complete."
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        _logger.warning("OpenRouter moderation failed for media %s: %s", media.id, error)
        return ["moderation_unavailable"], "Automated moderation could not complete."

    choice = (body.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    content = message.get("content") or ""
    if isinstance(content, list):
        content = "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )
    parsed = _extract_json(content)
    flags = [str(flag).strip() for flag in (parsed.get("flags") or []) if str(flag).strip()]
    note = str(parsed.get("note") or "").strip()
    return flags, note
