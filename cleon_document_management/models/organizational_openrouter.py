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


def _chat_completion(
    env,
    messages,
    temperature=0.3,
    max_tokens=400,
    error_context="request",
    json_mode=False,
):
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
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
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


def _strip_json_wrapper(text):
    raw = _THINK_RE.sub("", text or "").strip()
    raw = re.sub(
        r"^(?:here(?:'s| is)[^\n]*\n+)+",
        "",
        raw,
        flags=re.I,
    )
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.I)
        raw = re.sub(r"\s*```\s*$", "", raw)
    return raw.strip()


def _json_minor_repair(text):
    repaired = text.replace("\u201c", '"').replace("\u201d", '"')
    repaired = re.sub(r",\s*([}\]])", r"\1", repaired)
    return repaired


def _json_object_candidates(text):
    cleaned = _strip_json_wrapper(text)
    if not cleaned:
        return []
    candidates = [cleaned]
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        candidates.append(cleaned[start : end + 1])
    for index, char in enumerate(cleaned):
        if char != "{":
            continue
        depth = 0
        for offset in range(index, len(cleaned)):
            piece = cleaned[offset]
            if piece == "{":
                depth += 1
            elif piece == "}":
                depth -= 1
            if depth == 0:
                candidates.append(cleaned[index : offset + 1])
                break
    unique = []
    seen = set()
    for candidate in candidates:
        key = candidate.strip()
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(key)
    return unique


def _parse_json_object(text):
    for candidate in _json_object_candidates(text):
        for attempt in (candidate, _json_minor_repair(candidate)):
            try:
                parsed = json.loads(attempt)
            except json.JSONDecodeError:
                continue
            if isinstance(parsed, dict):
                return parsed
    return None


def _extract_json_object(text):
    payload = _parse_json_object(text)
    if payload is not None:
        return payload
    raise ValueError("The model did not return valid JSON.")


def _extract_json_object_lenient(text):
    payload = _parse_json_object(text)
    if payload is not None:
        return payload
    snippet = _strip_json_wrapper(text)[:500]
    _logger.warning("Failed to parse policy JSON. Snippet: %s", snippet)
    return None


def _policy_type_catalog(env):
    PolicyType = env["doc.compliance.policy.type"]
    types = PolicyType.search([("active", "=", True)])
    return [
        {"code": row.code or "", "name": row.name or "", "id": row.id}
        for row in types
    ]


def _document_type_catalog(env):
    DocumentType = env["doc.document.type"]
    rows = DocumentType.search([])
    return [{"id": row.id, "name": row.name or ""} for row in rows]


def _resolve_document_type_names(env, names):
    catalog = _document_type_catalog(env)
    by_lower = {row["name"].lower(): row["id"] for row in catalog if row["name"]}
    resolved = []
    unknown = []
    for name in names or []:
        clean = (name or "").strip()
        if not clean:
            continue
        match = by_lower.get(clean.lower())
        if match:
            if match not in resolved:
                resolved.append(match)
        else:
            unknown.append(clean)
    return resolved, unknown


_VALID_EVENT_TRIGGERS = frozenset(
    {"onboarding", "promotion", "department_transfer", "location_change"}
)
_VALID_AUDIT_FREQUENCIES = frozenset(
    {"monthly", "quarterly", "semi_annually", "annually"}
)
_EVENT_TRIGGER_PHRASES = (
    ("onboarding", ("onboarding", "new starter", "new hire", "joining")),
    ("promotion", ("promotion", "promoted")),
    ("department_transfer", ("department transfer", "moved department", "transfer")),
    ("location_change", ("location change", "changed work location", "relocated")),
)


def _coerce_choice(raw, allowed, fallback, phrase_groups=()):
    text = (raw or "").strip()
    if not text:
        return fallback
    token = re.sub(r"[\s-]+", "_", text.lower())
    if token in allowed:
        return token
    lowered = text.lower()
    for code in allowed:
        if code.replace("_", " ") in lowered or code in lowered:
            return code
    for code, phrases in phrase_groups:
        for phrase in phrases:
            if phrase in lowered:
                return code
    return fallback


def _coerce_effective_date(raw):
    text = (raw or "").strip()
    if not text:
        return ""
    match = re.search(r"(\d{4}-\d{2}-\d{2})", text)
    return match.group(1) if match else ""


def _normalize_proposal(env, payload, default_name=""):
    PolicyType = env["doc.compliance.policy.type"]
    policy_types = _policy_type_catalog(env)
    code = (payload.get("policy_type_code") or "").strip()
    policy_type = PolicyType.search([("code", "=", code)], limit=1)
    if not policy_type and policy_types:
        policy_type = PolicyType.browse(policy_types[0]["id"])
    doc_names = payload.get("document_type_names") or []
    if isinstance(doc_names, str):
        doc_names = [doc_names]
    doc_ids_raw = payload.get("document_type_ids") or []
    doc_ids = [int(x) for x in doc_ids_raw if x]
    extra_unknown = []
    if doc_names:
        resolved, unknown = _resolve_document_type_names(env, doc_names)
        for doc_id in resolved:
            if doc_id not in doc_ids:
                doc_ids.append(doc_id)
        extra_unknown = unknown
    applies_to = _coerce_choice(
        payload.get("applies_to"),
        frozenset({"all", "department", "grade", "employee"}),
        "all",
    )
    valid_schedules = frozenset(
        {
            "one_time",
            "daily",
            "weekly",
            "monthly",
            "quarterly",
            "semi_annually",
            "annually",
            "custom",
            "manual",
        }
    )
    schedule = _coerce_choice(
        payload.get("schedule") or "monthly",
        valid_schedules,
        "monthly",
    )
    return {
        "name": sanitize_description(
            payload.get("name") or default_name, limit=200
        )
        or default_name,
        "description": sanitize_description(
            payload.get("description") or "", limit=DESCRIPTION_LIMIT
        ),
        "policy_type_id": policy_type.id if policy_type else False,
        "policy_type_code": policy_type.code if policy_type else code,
        "document_type_ids": doc_ids,
        "unknown_document_type_names": list(
            dict.fromkeys((payload.get("unknown_document_type_names") or []) + extra_unknown)
        ),
        "applies_to": applies_to,
        "schedule": schedule if schedule != "manual" else False,
        "custom_schedule_days": int(payload.get("custom_schedule_days") or 30),
        "minimum_documents": int(payload.get("minimum_documents") or 1),
        "grace_period_days": int(payload.get("grace_period_days") or 0),
        "effective_date": _coerce_effective_date(payload.get("effective_date")),
        "event_trigger": _coerce_choice(
            payload.get("event_trigger"),
            _VALID_EVENT_TRIGGERS,
            "onboarding",
            _EVENT_TRIGGER_PHRASES,
        ),
        "due_days": int(payload.get("due_days") or 14),
        "reminder_frequency_days": int(payload.get("reminder_frequency_days") or 3),
        "audit_frequency": _coerce_choice(
            payload.get("audit_frequency"),
            _VALID_AUDIT_FREQUENCIES,
            "quarterly",
            (
                ("monthly", ("monthly", "every month")),
                ("quarterly", ("quarterly", "every 3 months", "three months")),
                ("semi_annually", ("semi annually", "every 6 months", "six months")),
                ("annually", ("annually", "every year", "once a year")),
            ),
        ),
        "sample_pct": int(payload.get("sample_pct") or 100),
        "field_notes": [
            str(note).strip()
            for note in (payload.get("field_notes") or [])
            if str(note).strip()
        ],
    }


def _propose_policy_json(env, user_prompt, default_name=""):
    catalog = _policy_type_catalog(env)
    doc_types = _document_type_catalog(env)
    system = (
        "You configure HR compliance policies. Reply with a single JSON object only. "
        "Use policy_type_code from: %s. "
        "document_type_names must match existing types when possible: %s. "
        "Put unmapped type names in unknown_document_type_names. "
        "Keys: name, description, policy_type_code, document_type_names, "
        "unknown_document_type_names, applies_to, schedule, custom_schedule_days, "
        "minimum_documents, grace_period_days, effective_date (YYYY-MM-DD), "
        "event_trigger (exactly one of: onboarding, promotion, department_transfer, location_change), "
        "due_days, reminder_frequency_days, "
        "audit_frequency (exactly one of: monthly, quarterly, semi_annually, annually), "
        "sample_pct, field_notes (array of short strings for uncertain fields). "
        "Never use prose for enum fields; use only the allowed codes."
    ) % (
        json.dumps([row["code"] for row in catalog]),
        json.dumps([row["name"] for row in doc_types[:40]]),
    )
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user_prompt},
    ]
    raw = None
    for json_mode in (True, False):
        try:
            raw = _chat_completion(
                env,
                messages,
                temperature=0.2,
                max_tokens=2000,
                error_context="policy proposal",
                json_mode=json_mode,
            )
            break
        except RuntimeError as error:
            if json_mode:
                _logger.info(
                    "Policy proposal json_mode request failed (%s); retrying plain.",
                    error,
                )
                continue
            raise
    if raw is None:
        raise RuntimeError("The AI service could not complete the request.")
    payload = _extract_json_object_lenient(raw)
    if payload is None:
        repair_messages = messages + [
            {"role": "assistant", "content": (raw or "")[:6000]},
            {
                "role": "user",
                "content": (
                    "Your previous reply was not valid JSON. Reply with ONE JSON object only. "
                    "No markdown fences, no explanation, no keys outside the schema."
                ),
            },
        ]
        try:
            repaired_raw = _chat_completion(
                env,
                repair_messages,
                temperature=0.0,
                max_tokens=2000,
                error_context="policy proposal repair",
                json_mode=True,
            )
        except RuntimeError:
            repaired_raw = _chat_completion(
                env,
                repair_messages,
                temperature=0.0,
                max_tokens=2000,
                error_context="policy proposal repair",
                json_mode=False,
            )
        payload = _extract_json_object_lenient(repaired_raw)
    if payload is None:
        raise ValueError(
            "The model did not return valid JSON. Try again, or use a shorter document."
        )
    return _normalize_proposal(env, payload, default_name=default_name)


def propose_policy_from_brief(env, name, brief=None, policy_type_id=None, document_type_ids=None):
    """Structured policy proposal from a title and optional author brief (no DB write)."""
    title = (name or "").strip()
    if not title:
        raise ValueError("Policy name is required.")
    lines = [
        "Propose compliance policy fields for this new policy.",
        "Policy name: %s" % title,
    ]
    if (brief or "").strip():
        lines.append("Author brief: %s" % brief.strip())
    if policy_type_id:
        policy_type = env["doc.compliance.policy.type"].browse(int(policy_type_id)).exists()
        if policy_type:
            lines.append("Preferred policy type code: %s" % policy_type.code)
    if document_type_ids:
        doc_types = env["doc.document.type"].browse(
            [int(x) for x in document_type_ids if x]
        ).exists()
        if doc_types:
            lines.append(
                "Preferred required document types: %s"
                % ", ".join(doc_types.mapped("name"))
            )
    proposal = _propose_policy_json(env, "\n".join(lines), default_name=title)
    if not proposal.get("description"):
        proposal["description"] = draft_policy_description(env, title, brief)
    if document_type_ids and not proposal.get("document_type_ids"):
        proposal["document_type_ids"] = [
            int(x) for x in document_type_ids if int(x or 0)
        ]
    return proposal


def propose_policy_from_document_text(
    env, document_name, body, document_type_name=None
):
    """Structured policy proposal from extracted document text (no DB write)."""
    excerpt = re.sub(r"\s+", " ", (body or "")).strip()
    if len(excerpt) < MIN_DOCUMENT_CHARS:
        raise ValueError(
            "This file does not contain enough readable text to analyze."
        )
    if len(excerpt) > DOCUMENT_TEXT_LIMIT:
        excerpt = excerpt[:DOCUMENT_TEXT_LIMIT]
    lines = [
        "Analyze this organizational document and propose compliance policy fields.",
        "File name: %s" % (document_name or "").strip(),
    ]
    if (document_type_name or "").strip():
        lines.append("Library document type label: %s" % document_type_name.strip())
    lines.extend(["", "Document text:", excerpt])
    default_name = (document_name or "Imported policy").rsplit(".", 1)[0]
    return _propose_policy_json(env, "\n".join(lines), default_name=default_name)
