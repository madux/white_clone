# -*- coding: utf-8 -*-
import json
import logging
import os
import re

_logger = logging.getLogger(__name__)

DEFAULT_MODEL = "llava"
DEFAULT_HOST = "http://127.0.0.1:11434"
PARAM_MODEL = "social_gallery.ollama_model"
PARAM_HOST = "social_gallery.ollama_host"

MODERATION_PROMPT = (
    "You are a corporate social gallery content moderator. "
    "Review this image for workplace appropriateness. "
    "Flag explicit, violent, hateful, or clearly non-workplace content. "
    'Respond with JSON only: {"flags": ["short_flag"], "note": "brief reason"}. '
    "Use an empty flags array when content is appropriate."
)


def ollama_host(env=None):
    host = (os.environ.get("OLLAMA_HOST") or "").strip()
    if host:
        return host
    if env is None:
        return DEFAULT_HOST
    return (
        env["ir.config_parameter"].sudo().get_param(PARAM_HOST) or DEFAULT_HOST
    ).strip()


def ollama_model(env=None):
    model = (os.environ.get("OLLAMA_MODEL") or "").strip()
    if model:
        return model
    if env is None:
        return DEFAULT_MODEL
    return (
        env["ir.config_parameter"].sudo().get_param(PARAM_MODEL) or DEFAULT_MODEL
    ).strip()


def ollama_disabled():
    return (os.environ.get("SOCIAL_GALLERY_OLLAMA_DISABLED") or "").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def ollama_configured(env=None):
    return not ollama_disabled()


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


def moderate_media(env, media, image_bytes=None, image_mime="image/jpeg"):
    """Return (flags, note) from a local Ollama vision model."""
    if not ollama_configured(env):
        return [], ""

    if media.media_type == "video":
        return ["video_review_required"], "Video content requires manual moderation."

    if not image_bytes:
        return [], ""

    try:
        import ollama
    except ImportError:
        _logger.warning("Ollama Python package is not installed for media %s", media.id)
        return ["moderation_unavailable"], "Automated moderation could not complete."

    model = ollama_model(env)
    host = ollama_host(env)
    try:
        client = ollama.Client(host=host)
        response = client.chat(
            model=model,
            messages=[{
                "role": "user",
                "content": MODERATION_PROMPT,
                "images": [image_bytes],
            }],
            format="json",
            options={"temperature": 0, "num_predict": 300},
        )
    except Exception as error:
        _logger.warning(
            "Ollama moderation failed for media %s (model=%s, host=%s): %s",
            media.id,
            model,
            host,
            error,
        )
        return ["moderation_unavailable"], "Automated moderation could not complete."

    content = ""
    if isinstance(response, dict):
        content = (response.get("message") or {}).get("content") or ""
    else:
        message = getattr(response, "message", None)
        content = getattr(message, "content", "") if message else ""

    parsed = _extract_json(content)
    flags = [str(flag).strip() for flag in (parsed.get("flags") or []) if str(flag).strip()]
    note = str(parsed.get("note") or "").strip()
    return flags, note
