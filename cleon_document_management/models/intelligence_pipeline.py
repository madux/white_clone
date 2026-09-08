import base64
import json
import logging
import re
from io import BytesIO

_logger = logging.getLogger(__name__)

DATE_RE = re.compile(
    r"\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|"
    r"(?:January|February|March|April|May|June|July|August|September|October|November|December)"
    r"\s+\d{1,2},?\s+\d{4})\b",
    re.I,
)
EMAIL_RE = re.compile(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", re.I)
PHONE_RE = re.compile(r"\+?\d[\d\s().-]{7,}\d")
NOTICE_RE = re.compile(r"notice(?:\s+period)?[:\s]+([^\n.]{2,40})", re.I)
NAME_RE = re.compile(r"(?:employee(?:\s+name)?|name)[:\s]+([A-Za-z][A-Za-z' -]{1,80})", re.I)

IMAGE_EXT = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".tif", ".tiff", ".bmp")
SCAN_CHARS_PER_PAGE = 40
MAX_VISION_PAGES = 8


def attachment_bytes(attachment):
    raw = attachment.raw
    if raw:
        return raw if isinstance(raw, (bytes, bytearray)) else str(raw).encode()
    data = attachment.datas
    if not data:
        return b""
    if isinstance(data, bytes):
        return base64.b64decode(data)
    return base64.b64decode(data.encode())


def _suffix(attachment):
    name = (attachment.name or "").lower()
    if "." in name:
        return "." + name.rsplit(".", 1)[-1]
    return ""


def _is_image(attachment):
    mime = (attachment.mimetype or "").lower()
    return mime.startswith("image/") or _suffix(attachment) in IMAGE_EXT


def _decode_text(raw):
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            return raw.decode(encoding)
        except Exception:
            continue
    return raw.decode("utf-8", errors="replace")


def _html_text(raw):
    text = _decode_text(raw)
    text = re.sub(r"(?is)<script.*?>.*?</script>", " ", text)
    text = re.sub(r"(?is)<style.*?>.*?</style>", " ", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _docx_text(raw):
    from docx import Document

    document = Document(BytesIO(raw))
    parts = [paragraph.text for paragraph in document.paragraphs if paragraph.text]
    for table in document.tables:
        for row in table.rows:
            parts.append(" | ".join(cell.text.strip() for cell in row.cells))
    return "\n".join(parts).strip()


def _xlsx_text(raw):
    from openpyxl import load_workbook

    book = load_workbook(BytesIO(raw), data_only=True, read_only=True)
    lines = []
    for sheet in book.worksheets:
        lines.append("Sheet: %s" % sheet.title)
        for row in sheet.iter_rows(values_only=True):
            values = [str(cell) for cell in row if cell not in (None, "")]
            if values:
                lines.append(" | ".join(values))
    return "\n".join(lines).strip()


def _pptx_text(raw):
    from pptx import Presentation

    deck = Presentation(BytesIO(raw))
    lines = []
    for index, slide in enumerate(deck.slides, start=1):
        lines.append("Slide %s" % index)
        for shape in slide.shapes:
            if getattr(shape, "has_text_frame", False):
                text = shape.text_frame.text.strip()
                if text:
                    lines.append(text)
    return "\n".join(lines).strip()


def _pdf_native(raw):
    try:
        import fitz

        pdf = fitz.open(stream=raw, filetype="pdf")
        pages = pdf.page_count
        text = "\n".join((page.get_text() or "") for page in pdf)
        pdf.close()
        return text.strip(), pages
    except Exception as error:
        _logger.debug("pymupdf extract failed: %s", error)
    try:
        from pypdf import PdfReader

        reader = PdfReader(BytesIO(raw))
        pages = len(reader.pages)
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
        return text.strip(), pages
    except Exception as error:
        _logger.debug("pypdf extract failed: %s", error)
        return "", 0


def _pdf_page_images(raw, limit=MAX_VISION_PAGES):
    import fitz

    pdf = fitz.open(stream=raw, filetype="pdf")
    images = []
    for page in list(pdf)[:limit]:
        pixmap = page.get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        images.append(("image/png", pixmap.tobytes("png")))
    pages = pdf.page_count
    pdf.close()
    return images, pages


def _image_png(raw, mime="image/png"):
    try:
        import fitz

        pixmap = fitz.Pixmap(raw)
        if pixmap.n > 4:
            pixmap = fitz.Pixmap(fitz.csRGB, pixmap)
        return [("image/png", pixmap.tobytes("png"))]
    except Exception:
        return [(mime or "image/jpeg", raw)]


def _vision_text(images, env):
    from .intelligence_groq import transcribe_images

    return transcribe_images(images, env=env)


def _tesseract_images(images):
    import pytesseract
    from PIL import Image

    parts = []
    for _mime, raw in images:
        image = Image.open(BytesIO(raw))
        parts.append(pytesseract.image_to_string(image) or "")
    return "\n".join(parts).strip()


def extract_document_text(attachment, ocr_fallback=True, env=None):
    """Return (text, source, page_count). source: native|groq_vision|tesseract|empty."""
    raw = attachment_bytes(attachment)
    mime = (attachment.mimetype or "").lower()
    suffix = _suffix(attachment)
    if not raw:
        return "", "empty", 0

    if mime.startswith("text/") or suffix in (".txt", ".csv", ".md", ".json", ".log"):
        return _decode_text(raw).strip(), "native", 1
    if mime in ("text/html", "application/xhtml+xml") or suffix in (".html", ".htm"):
        return _html_text(raw), "native", 1
    if suffix in (".docx",) or "wordprocessingml" in mime:
        try:
            return _docx_text(raw), "native", 1
        except Exception as error:
            _logger.warning("docx extract failed: %s", error)
    if suffix in (".xlsx", ".xlsm") or "spreadsheetml" in mime:
        try:
            return _xlsx_text(raw), "native", 1
        except Exception as error:
            _logger.warning("xlsx extract failed: %s", error)
    if suffix == ".pptx" or "presentationml" in mime:
        try:
            return _pptx_text(raw), "native", 1
        except Exception as error:
            _logger.warning("pptx extract failed: %s", error)
    if suffix == ".doc" or mime == "application/msword":
        return "", "empty", 0

    if mime == "application/pdf" or suffix == ".pdf":
        text, pages = _pdf_native(raw)
        pages = pages or 1
        if len(text) >= max(80, pages * SCAN_CHARS_PER_PAGE):
            return text, "native", pages
        if ocr_fallback:
            try:
                images, pages = _pdf_page_images(raw)
                try:
                    vision = _vision_text(images, env)
                    if vision:
                        return vision, "groq_vision", pages
                except Exception as error:
                    _logger.warning("Groq vision failed: %s", error)
                ocr = _tesseract_images(images)
                if ocr:
                    return ocr, "tesseract", pages
            except Exception as error:
                _logger.warning("scanned pdf fallback failed: %s", error)
        return text, "native" if text else "empty", pages

    if _is_image(attachment):
        images = _image_png(raw, mime or "image/jpeg")
        if ocr_fallback:
            try:
                vision = _vision_text(images, env)
                if vision:
                    return vision, "groq_vision", 1
            except Exception as error:
                _logger.warning("Groq vision failed: %s", error)
            try:
                ocr = _tesseract_images(images)
                if ocr:
                    return ocr, "tesseract", 1
            except Exception as error:
                _logger.warning("image ocr failed: %s", error)
        return "", "empty", 1

    # Unknown binary: try PDF/image openers, then utf-8.
    text, pages = _pdf_native(raw)
    if text:
        return text, "native", pages or 1
    try:
        decoded = _decode_text(raw).strip()
        if decoded and sum(32 <= ord(char) < 127 or char in "\n\r\t" for char in decoded[:400]) > 200:
            return decoded, "native", 1
    except Exception:
        pass
    return "", "empty", 0


def _line_after(label, text):
    pattern = re.compile(re.escape(label) + r"[:\s]+([^\n]{1,120})", re.I)
    match = pattern.search(text or "")
    return match.group(1).strip() if match else ""


def extract_field_value(field, text, document):
    key = (field.key or "").lower()
    field_type = field.field_type
    source = "document_text"
    page = 1
    value = ""

    if key in ("employee_name", "name") or field_type == "employee_reference":
        match = NAME_RE.search(text or "")
        if match:
            value = match.group(1).strip()
        elif document.employee_id:
            value = document.employee_id.name
            source = "employee_record"
    elif "start" in key or key in ("effective_date", "commencement"):
        labeled = _line_after("start date", text) or _line_after("effective date", text)
        match = DATE_RE.search(labeled or text or "")
        value = labeled or (match.group(1) if match else "")
    elif "end" in key or "expir" in key:
        labeled = _line_after("end date", text) or _line_after("expiry", text)
        match = DATE_RE.search(labeled or text or "")
        value = labeled or (match.group(1) if match else "")
    elif "notice" in key:
        match = NOTICE_RE.search(text or "")
        value = match.group(1).strip() if match else _line_after("notice period", text)
    elif field_type == "email":
        match = EMAIL_RE.search(text or "")
        value = match.group(0) if match else ""
    elif field_type == "phone":
        match = PHONE_RE.search(text or "")
        value = match.group(0).strip() if match else ""
    elif field_type in ("integer", "decimal", "currency"):
        match = re.search(r"[-+]?\d[\d,]*(?:\.\d+)?", text or "")
        value = match.group(0) if match else ""
    else:
        value = _line_after(field.name, text) or _line_after(key.replace("_", " "), text)

    confidence = 0.9 if value and source == "document_text" else 0.8 if value else 0.25
    citation = f"page {page}" if value else ""
    return {
        "value": value,
        "normalized_value": value,
        "confidence": confidence,
        "source": source,
        "page": page,
        "citation": citation,
    }


def value_supported_by_text(value, text):
    needle = re.sub(r"\s+", " ", (value or "")).strip().lower()
    if not needle:
        return True
    hay = re.sub(r"\s+", " ", text or "").lower()
    if needle in hay:
        return True
    digits = re.sub(r"\D", "", needle)
    if len(digits) >= 6 and digits in re.sub(r"\D", "", text or ""):
        return True
    compact = re.sub(r"[\s().-]", "", needle)
    hay_compact = re.sub(r"[\s().-]", "", hay)
    if len(compact) >= 7 and compact in hay_compact:
        return True
    parts = [part for part in needle.split() if len(part) > 2]
    return len(parts) >= 2 and all(part in hay for part in parts)


def _candidate_types(dataset):
    Type = dataset.env["doc.document.type"]
    if dataset.auto_classify:
        types = Type.search([("active", "=", True)])
        if dataset.source == "upload":
            return types
        scope = (
            "organization"
            if dataset.source == "organizational"
            else "employee"
        )
        scoped = types.filtered(
            lambda item: (item.intelligence_scope or "employee") == scope
        )
        return scoped or types
    return dataset.document_type_ids


def _keyword_classify(document, types, text):
    haystack = " ".join(
        [document.name or "", (text or "")[:4000]]
    ).lower()
    scored = []
    for document_type in types:
        labels = "%s %s" % (
            document_type.name or "",
            document_type.classification_labels or "",
        )
        tokens = [
            token.strip().lower()
            for token in re.split(r"[,;/]", labels)
            if token.strip()
        ]
        if document_type.name:
            tokens.append(document_type.name.lower())
        hits = sum(1 for token in set(tokens) if token and token in haystack)
        if hits:
            scored.append((0.4 + min(hits, 4) * 0.12, document_type))
    scored.sort(key=lambda item: item[0], reverse=True)
    if not scored:
        return types.browse(), 0.2, []
    best = scored[0]
    return best[1], min(best[0], 0.82), [item[1].id for item in scored[1:4]]


def classify_document(document, dataset, text=""):
    types = _candidate_types(dataset)
    if not dataset.auto_classify:
        if document.document_type_id in types:
            return document.document_type_id, 0.95, []
        if len(types) == 1:
            return types[0], 0.55, []
        return document.document_type_id, 0.4, []

    fallback_type, fallback_conf, alternatives = _keyword_classify(
        document, types, text
    )
    from .intelligence_groq import complete_chat, groq_configured, parse_json_object

    if not types or not groq_configured(document.env):
        return fallback_type, fallback_conf, alternatives

    catalog = [
        {
            "id": document_type.id,
            "name": document_type.name,
            "description": (document_type.description or "")[:240],
            "labels": document_type.classification_labels or "",
        }
        for document_type in types
    ]
    try:
        raw = complete_chat(
            [
                {
                    "role": "system",
                    "content": (
                        "You classify HR documents for Cleon AI. "
                        "Pick the single best matching document_type_id from the catalog. "
                        "If none fit, return document_type_id null. "
                        "Do not force a type because it was selected in a wizard or "
                        "because of the file name. Use the document content. "
                        "Reply with JSON only: "
                        '{"document_type_id": number|null, "confidence": 0-1, "reason": string}.'
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "file_name": document.name or "",
                            "current_type": document.document_type_id.name or "",
                            "types": catalog,
                            "text": (text or "")[:8000],
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            env=document.env,
            max_completion_tokens=800,
        )
        payload = parse_json_object(raw)
        type_id = payload.get("document_type_id")
        try:
            type_id = int(type_id) if type_id not in (None, "", False) else 0
        except (TypeError, ValueError):
            type_id = 0
        chosen = types.filtered(lambda item: item.id == type_id)[:1]
        confidence = float(payload.get("confidence") or 0)
        confidence = max(0.0, min(confidence, 1.0))
        if chosen:
            return chosen[0], confidence or 0.7, alternatives
        return types.browse(), min(confidence or 0.25, 0.4), alternatives
    except Exception as error:
        _logger.warning("LLM classification failed: %s", error)
        return fallback_type, fallback_conf, alternatives


def extract_fields_with_llm(definitions, text, document):
    results = {}
    for field in definitions:
        results[field.key] = extract_field_value(field, text, document)

    from .intelligence_groq import complete_chat, groq_configured, parse_json_object

    if not groq_configured(document.env) or not definitions or not (text or "").strip():
        for field in definitions:
            extracted = results[field.key]
            if extracted.get("source") == "filename" or (
                extracted.get("value")
                and extracted.get("source") == "document_text"
                and not value_supported_by_text(extracted["value"], text)
            ):
                extracted["value"] = ""
                extracted["normalized_value"] = ""
                extracted["confidence"] = 0.2
                extracted["source"] = "document_text"
        return results

    spec = [
        {
            "key": field.key,
            "name": field.name,
            "type": field.field_type,
            "required": bool(field.required),
            "description": field.description or "",
        }
        for field in definitions
    ]
    try:
        raw = complete_chat(
            [
                {
                    "role": "system",
                    "content": (
                        "You extract fields from one HR document for Cleon AI. "
                        "Use only evidence in the document text. "
                        "If a field is not clearly present, return an empty value. "
                        "Never use the file name as a person's name. "
                        "Never invent dates, emails, or IDs. "
                        "Reply with JSON only: "
                        '{"fields": {"key": {"value": string, "confidence": 0-1, "citation": string}}}.'
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "file_name": document.name or "",
                            "fields": spec,
                            "text": (text or "")[:12000],
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            env=document.env,
            max_completion_tokens=1200,
        )
        payload = parse_json_object(raw)
        by_key = payload.get("fields")
        if not isinstance(by_key, dict):
            by_key = payload if isinstance(payload, dict) else {}
        for field in definitions:
            item = by_key.get(field.key)
            if item is None:
                continue
            if not isinstance(item, dict):
                item = {"value": item}
            value = str(item.get("value") or "").strip()
            if value.lower() in ("null", "none", "n/a", "unknown"):
                value = ""
            if value and not value_supported_by_text(value, text):
                value = ""
            confidence = float(item.get("confidence") or 0)
            if not value:
                fallback = results[field.key]
                if (
                    fallback.get("value")
                    and fallback.get("source") != "filename"
                    and (
                        fallback.get("source") == "employee_record"
                        or value_supported_by_text(fallback.get("value"), text)
                    )
                ):
                    continue
                results[field.key] = {
                    "value": "",
                    "normalized_value": "",
                    "confidence": 0.2,
                    "source": "llm",
                    "page": 1,
                    "citation": "",
                }
                continue
            results[field.key] = {
                "value": value,
                "normalized_value": value,
                "confidence": max(0.2, min(confidence or 0.75, 0.98)),
                "source": "llm",
                "page": 1,
                "citation": str(item.get("citation") or "")[:120],
            }
    except Exception as error:
        _logger.warning("LLM field extraction failed: %s", error)
    return results
