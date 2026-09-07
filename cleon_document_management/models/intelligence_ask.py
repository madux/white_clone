import re
from datetime import datetime, timedelta

from odoo import fields


DATE_KEYS = (
    "end_date",
    "expiry_date",
    "contract_end",
    "valid_until",
    "expiration_date",
)
DAYS_RE = re.compile(r"(\d+)\s*(?:day|days)", re.I)


def parse_intent(question):
    lowered = (question or "").strip().lower()
    days_match = DAYS_RE.search(lowered)
    days = int(days_match.group(1)) if days_match else 60
    if "month" in lowered and not days_match:
        days = 30
    if any(
        word in lowered
        for word in ("salary", "salaries", "pay band", "compensation band")
    ):
        return {
            "kind": "unsupported",
            "label": "salary_band",
            "reason": (
                "Salary-band questions are not supported yet because no pay-band "
                "settings exist in Document Intelligence."
            ),
        }
    if any(
        word in lowered
        for word in ("expir", "end date", "ending soon", "valid until")
    ):
        return {"kind": "expiring", "label": "expiring_contracts", "days": days}
    if "probation" in lowered:
        return {"kind": "probation", "label": "probation"}
    if "notice" in lowered and any(
        word in lowered for word in ("no ", "without", "missing", "blank", "empty")
    ):
        return {
            "kind": "missing_field",
            "label": "missing_notice",
            "keys": ("notice_period",),
        }
    if "training" in lowered and any(
        word in lowered
        for word in ("missing", "without", "mandatory", "no training")
    ):
        return {
            "kind": "missing_type",
            "label": "missing_training",
            "needles": ("training",),
        }
    return {"kind": "semantic", "label": "document_search"}


def _parse_date(value):
    text = (value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %B %Y", "%d %b %Y"):
        try:
            return datetime.strptime(text[:32], fmt).date()
        except ValueError:
            continue
    if len(text) >= 10:
        try:
            return datetime.strptime(text[:10], "%Y-%m-%d").date()
        except ValueError:
            return None
    return None


def _permitted_records(env, dataset_id=None):
    domain = [("review_status", "in", ["approved", "overridden"])]
    user = env.user
    is_admin = user.has_group("base.group_system") or user.has_group(
        "cleon_document_management.group_document_admin"
    )
    if not is_admin:
        employee = user.employee_id
        domain.append(("employee_id", "=", employee.id if employee else 0))
    if dataset_id:
        domain.append(("dataset_id", "=", int(dataset_id)))
    return env["doc.intelligence.record"].search(domain)


def _citation(record, snippet, field_name="", page=0):
    document = record.document_id
    return {
        "document_id": document.id,
        "document": document.name,
        "employee": record.employee_id.name or "",
        "page": page or record.page_count or 1,
        "field": field_name,
        "snippet": snippet[:280],
    }


def _fact_answer(title, lines, citations):
    body = "\n".join("- %s" % line for line in lines) if lines else ""
    answer = title
    if body:
        answer = "%s\n\n%s" % (title, body)
    return {
        "answer": answer,
        "insufficient_evidence": not lines,
        "citations": [],
        "fact_based": True,
    }


def _query_expiring(env, days, dataset_id=None):
    today = fields.Date.context_today(env["doc.intelligence.record"])
    horizon = today + timedelta(days=int(days or 60))
    records = _permitted_records(env, dataset_id)
    lines = []
    citations = []
    for record in records:
        for item in record.field_ids.filtered(lambda field: field.key in DATE_KEYS):
            parsed = _parse_date(item.normalized_value or item.value)
            if parsed and today <= parsed <= horizon:
                employee = record.employee_id.name or "No employee"
                line = "%s · %s · %s %s" % (
                    record.document_id.name,
                    employee,
                    item.name,
                    parsed,
                )
                lines.append(line)
                citations.append(
                    _citation(
                        record,
                        "%s: %s" % (item.name, item.value or parsed),
                        field_name=item.name,
                        page=item.page,
                    )
                )
    title = "Approved contracts with an end/expiry date in the next %s days:" % days
    if not lines:
        title = (
            "No approved records have an end or expiry date in the next %s days."
            % days
        )
    return _fact_answer(title, lines, citations)


def _query_missing_field(env, keys, dataset_id=None):
    records = _permitted_records(env, dataset_id)
    lines = []
    citations = []
    for record in records:
        fields = record.field_ids.filtered(lambda item: item.key in keys)
        if not fields:
            continue
        empty = fields.filtered(lambda item: not (item.value or "").strip())
        if not empty:
            continue
        employee = record.employee_id.name or "No employee"
        names = ", ".join(empty.mapped("name"))
        lines.append("%s · %s · missing %s" % (record.document_id.name, employee, names))
        citations.append(
            _citation(record, "Missing %s" % names, field_name=names)
        )
    title = "Approved records missing %s:" % ", ".join(keys)
    if not lines:
        title = "No approved records are missing %s." % ", ".join(keys)
    return _fact_answer(title, lines, citations)


def _query_probation(env, dataset_id=None):
    today = fields.Date.context_today(env["doc.intelligence.record"])
    records = _permitted_records(env, dataset_id)
    lines = []
    citations = []
    for record in records:
        fields = record.field_ids.filtered(
            lambda item: "probation" in (item.key or "") or "probation" in (item.name or "").lower()
        )
        for item in fields:
            parsed = _parse_date(item.normalized_value or item.value)
            if parsed and parsed < today:
                continue
            employee = record.employee_id.name or "No employee"
            extra = str(parsed) if parsed else (item.value or "")
            lines.append(
                "%s · %s · %s %s"
                % (record.document_id.name, employee, item.name, extra)
            )
            citations.append(
                _citation(
                    record,
                    "%s: %s" % (item.name, item.value or extra),
                    field_name=item.name,
                    page=item.page,
                )
            )
    title = "Approved records with a probation field still in effect:"
    if not lines:
        title = (
            "No approved probation fields were found. "
            "Add a probation field to a profile and approve extracted values first."
        )
    return _fact_answer(title, lines, citations)


def _query_missing_type(env, needles, dataset_id=None):
    records = _permitted_records(env, dataset_id)
    employees = records.mapped("employee_id").filtered(lambda employee: employee)
    lines = []
    citations = []
    for employee in employees:
        owned = records.filtered(lambda record: record.employee_id == employee)
        has_type = owned.filtered(
            lambda record: any(
                needle in (record.document_type_id.name or "").lower()
                for needle in needles
            )
        )
        if has_type:
            continue
        sample = owned[:1]
        lines.append(
            "%s has approved files, but none whose document type name contains %s."
            % (employee.name, ", ".join(needles))
        )
        if sample:
            citations.append(
                _citation(
                    sample,
                    "No approved %s document type for this employee."
                    % ", ".join(needles),
                )
            )
    title = "Employees in approved Intelligence records missing a matching document type:"
    if not lines:
        title = (
            "No matching gap was found among employees who already have approved "
            "extracted records."
        )
    return _fact_answer(title, lines, citations)


def answer_structured(env, question, dataset_id=None):
    intent = parse_intent(question)
    if intent["kind"] == "unsupported":
        return {
            "intent": intent,
            "answer": intent["reason"],
            "insufficient_evidence": True,
            "citations": [],
            "fact_based": True,
        }
    if intent["kind"] == "expiring":
        payload = _query_expiring(env, intent["days"], dataset_id)
    elif intent["kind"] == "missing_field":
        payload = _query_missing_field(env, intent["keys"], dataset_id)
    elif intent["kind"] == "probation":
        payload = _query_probation(env, dataset_id)
    elif intent["kind"] == "missing_type":
        payload = _query_missing_type(env, intent["needles"], dataset_id)
    else:
        return {
            "intent": intent,
            "fact_based": False,
        }
    payload["intent"] = intent
    return payload


def start_answer(env, question, extra_context="", history=None, dataset_id=None):
    from .intelligence_groq import LLM_MODEL, groq_configured, _answer_messages

    structured = answer_structured(env, question, dataset_id=dataset_id)
    if structured.get("fact_based"):
        intent = structured.get("intent") or {}
        return {
            "mode": "ready",
            "result": {
                "answer": structured["answer"],
                "insufficient_evidence": structured.get("insufficient_evidence", True),
                "citations": [],
                "fact_based": True,
                "intent": intent.get("label") or intent.get("kind") or "",
                "model": "structured-fields",
            },
        }
    chunks = env["doc.intelligence.chunk"].search_similar(
        question, dataset_id=dataset_id
    )
    evidence = []
    if extra_context:
        evidence.append(extra_context)
    for chunk in chunks:
        document = chunk.document_id
        evidence.append(
            "Document: %s | Employee: %s | Page: %s\n%s"
            % (
                document.name,
                chunk.employee_id.name or "n/a",
                chunk.page,
                chunk.content,
            )
        )
    if not evidence:
        return {
            "mode": "ready",
            "result": {
                "answer": (
                    "There is not enough approved, indexed evidence to answer. "
                    "Run a dataset, review records, and approve them first."
                ),
                "insufficient_evidence": True,
                "citations": [],
                "fact_based": False,
                "intent": "document_search",
                "model": LLM_MODEL,
            },
        }
    if not groq_configured(env):
        return {
            "mode": "ready",
            "result": {
                "answer": (
                    "Matching approved excerpts were found, but GROQ_API_KEY is not "
                    "set so the language model cannot compose an answer."
                ),
                "insufficient_evidence": True,
                "citations": [],
                "fact_based": False,
                "intent": "document_search",
                "model": LLM_MODEL,
            },
        }
    context = "\n\n".join(evidence[:8])
    return {
        "mode": "stream",
        "messages": _answer_messages(question, context, history),
        "context": context,
        "result_meta": {
            "insufficient_evidence": False,
            "citations": [],
            "fact_based": False,
            "intent": "document_search",
            "model": LLM_MODEL,
        },
    }


def answer_question(env, question, extra_context="", history=None, dataset_id=None):
    from .intelligence_groq import answer_with_context, strip_reference_sections

    started = start_answer(
        env,
        question,
        extra_context=extra_context,
        history=history,
        dataset_id=dataset_id,
    )
    if started["mode"] == "ready":
        return started["result"]
    answer = strip_reference_sections(
        answer_with_context(
            question,
            started["context"],
            env=env,
            history=history,
        )
    )
    return {"answer": answer, **started["result_meta"]}
