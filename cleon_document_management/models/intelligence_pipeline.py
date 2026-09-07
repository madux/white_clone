import base64
import logging
import re

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


def extract_document_text(attachment, ocr_fallback=True):
    """Return (text, used_ocr, page_count). Never raises."""
    raw = attachment_bytes(attachment)
    mime = (attachment.mimetype or "").lower()
    name = (attachment.name or "").lower()
    if not raw:
        return "", False, 0

    if mime.startswith("text/") or name.endswith(".txt"):
        try:
            return raw.decode("utf-8", errors="replace"), False, 1
        except Exception:
            return "", False, 0

    text = ""
    pages = 0
    try:
        import fitz

        pdf = fitz.open(stream=raw, filetype="pdf")
        pages = pdf.page_count
        text = "\n".join(page.get_text() or "" for page in pdf)
        pdf.close()
        if text.strip():
            return text, False, pages
    except Exception as error:
        _logger.debug("pymupdf extract failed: %s", error)

    try:
        from pypdf import PdfReader
        from io import BytesIO

        reader = PdfReader(BytesIO(raw))
        pages = len(reader.pages)
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
        if text.strip():
            return text, False, pages
    except Exception as error:
        _logger.debug("pypdf extract failed: %s", error)

    if ocr_fallback:
        try:
            from pdf2image import convert_from_bytes
            import pytesseract

            images = convert_from_bytes(raw, first_page=1, last_page=3)
            ocr_text = "\n".join(pytesseract.image_to_string(image) for image in images)
            if ocr_text.strip():
                return ocr_text, True, len(images)
        except Exception as error:
            _logger.debug("ocr fallback failed: %s", error)

    return text.strip(), False, pages


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

    if not value and document.name and key in ("employee_name", "name"):
        value = document.name
        source = "filename"
    confidence = 0.9 if value and source == "document_text" else 0.8 if value else 0.25
    if source == "filename":
        confidence = 0.55
    citation = f"page {page}" if value else ""
    return {
        "value": value,
        "normalized_value": value,
        "confidence": confidence,
        "source": source,
        "page": page,
        "citation": citation,
    }


def classify_document(document, dataset):
    if not dataset.auto_classify:
        if document.document_type_id in dataset.document_type_ids:
            return document.document_type_id, 0.95, []
        return document.document_type_id, 0.4, []
    haystack = " ".join(
        [
            document.name or "",
            document.document_type_id.name or "",
            (document.extracted_text or "")[:500],
        ]
    ).lower()
    scored = []
    for document_type in dataset.document_type_ids or document.env["doc.document.type"].search(
        [("active", "=", True)]
    ):
        labels = (document_type.classification_labels or document_type.name or "").lower()
        hits = sum(1 for token in labels.split(",") if token.strip() and token.strip() in haystack)
        score = 0.5 + min(hits, 3) * 0.15
        if document.document_type_id == document_type:
            score = max(score, 0.7)
        scored.append((score, document_type))
    scored.sort(key=lambda item: item[0], reverse=True)
    if not scored:
        return document.document_type_id, 0.4, []
    best = scored[0]
    alternatives = [item[1].id for item in scored[1:4]]
    return best[1], best[0], alternatives
