# -*- coding: utf-8 -*-
import base64
import json
import logging
import os
import re
import ssl
import urllib.error
import urllib.request

from .gallery_ollama import MODERATION_PROMPT

_logger = logging.getLogger(__name__)

HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions"
PARAM_TOKEN = "social_gallery.huggingface_token"
PARAM_MODEL = "social_gallery.huggingface_model"
DEFAULT_MODEL = "deepseek-ai/DeepSeek-V4.1-Flash:novita"


def huggingface_token(env=None):
    token = (os.environ.get("HF_TOKEN") or "").strip()
    if token:
        return token
    if env is None:
        return ""
    return (env["ir.config_parameter"].sudo().get_param(PARAM_TOKEN) or "").strip()


def huggingface_model(env=None):
    model = (os.environ.get("HF_MODEL") or "").strip()
    if model:
        return model
    if env is None:
        return DEFAULT_MODEL
    return (
        env["ir.config_parameter"].sudo().get_param(PARAM_MODEL) or DEFAULT_MODEL
    ).strip()


def huggingface_configured(env=None):
    return bool(huggingface_token(env))


def _ssl_context():
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


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


def _message_content(message):
    content = message.get("content") or ""
    if isinstance(content, list):
        return "".join(
            part.get("text", "") if isinstance(part, dict) else str(part)
            for part in content
        )
    return str(content)


def moderate_media(env, media, image_bytes=None, image_mime="image/jpeg"):
    """Return (flags, note) from Hugging Face router vision screening."""
    token = huggingface_token(env)
    if not token:
        return [], ""

    if media.media_type == "video":
        return ["video_review_required"], "Video content requires manual moderation."

    if not image_bytes:
        return [], ""

    encoded = base64.b64encode(image_bytes).decode("ascii")
    data_url = "data:%s;base64,%s" % (image_mime or "image/jpeg", encoded)
    payload = {
        "model": huggingface_model(env),
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": MODERATION_PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "temperature": 0,
        "max_tokens": 300,
    }
    request = urllib.request.Request(
        HF_CHAT_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": "Bearer %s" % token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60, context=_ssl_context()) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = _read_http_error_body(error)
        _logger.warning(
            "Hugging Face moderation failed for media %s: HTTP %s %s",
            media.id,
            error.code,
            detail or error.reason,
        )
        return ["moderation_unavailable"], "Automated moderation could not complete."
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        _logger.warning("Hugging Face moderation failed for media %s: %s", media.id, error)
        return ["moderation_unavailable"], "Automated moderation could not complete."

    choice = (body.get("choices") or [{}])[0]
    message = choice.get("message") or {}
    parsed = _extract_json(_message_content(message))
    flags = [str(flag).strip() for flag in (parsed.get("flags") or []) if str(flag).strip()]
    note = str(parsed.get("note") or "").strip()
    return flags, note
