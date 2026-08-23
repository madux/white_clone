"""Versioned contracts shared by the expense OWL application gateway.

The browser receives these definitions in the bootstrap payload.  Keeping action
field names here makes the Python gateway the source of truth instead of relying
on matching string literals in JavaScript and Python.
"""

from odoo import _
from odoo.exceptions import UserError


APP_CONTRACT_VERSION = 1


def _action(required=(), optional=(), defaults=None):
    fields = tuple(dict.fromkeys((*required, *optional)))
    return {
        "required": list(required),
        "fields": list(fields),
        "defaults": {field: (defaults or {}).get(field, "") for field in fields},
    }


APP_ACTION_CONTRACTS = {
    "configuration": {
        "claim_type": _action(
            ("name", "code", "category_id"),
            ("amount_type", "fixed_amount", "maximum_amount", "receipt_policy",
             "receipt_threshold", "approval_type", "description"),
            {"amount_type": "open", "receipt_policy": "optional", "approval_type": "single"},
        ),
        "claim_window": _action(
            ("name",),
            ("window_type", "duration_days", "start_date", "end_date", "description"),
            {"window_type": "submission", "duration_days": "30"},
        ),
        "request_type": _action(
            ("name", "code"),
            ("minimum_amount", "maximum_amount", "creates_advance", "retirement_days", "description"),
            {"creates_advance": False, "retirement_days": "30"},
        ),
        "approval_rule": _action(
            ("name",),
            ("target", "department_id", "minimum_amount", "maximum_amount", "description"),
            {"target": "claim"},
        ),
        "vendor_category": _action(
            ("name", "code"), ("tax_rate", "account_id", "description"),
        ),
        "payment_term": _action(
            ("name", "code"), ("due_days", "discount", "discount_days", "description"),
            {"due_days": "30"},
        ),
        "email": _action(
            ("name", "subject"), ("event", "body_html"), {"event": "submitted"},
        ),
        "integration": _action(
            ("name",), ("provider", "configuration_summary"), {"provider": "other"},
        ),
        "payment_method": _action(
            ("name", "code"), ("method_type", "supports_batch", "description"),
            {"method_type": "bank", "supports_batch": True},
        ),
    },
    "petty": {
        "fund": _action(
            ("name", "code", "location", "custodian_id", "maximum_amount"),
            ("minimum_threshold",),
        ),
        "transaction": _action(
            ("fund_id", "payee", "amount"),
            ("transaction_type", "date", "category", "description", "receipt_name",
             "receipt_mimetype", "receipt_data"),
            {"transaction_type": "expense"},
        ),
        "reconciliation": _action(
            ("fund_id", "physical_count"), ("period_start", "date", "notes"),
        ),
        "replenishment": _action(
            ("fund_id", "requested_amount", "justification"), ("urgent",), {"urgent": False},
        ),
        "custodian": _action(("fund_id", "custodian_id")),
    },
    "accounting": {
        "account": _action(("code", "name"), ("account_type",), {"account_type": "expense"}),
        "mapping": _action(
            ("name", "debit_account_id", "credit_account_id"),
            ("source_type", "category_id", "journal_id"), {"source_type": "claim"},
        ),
        "journal": _action(
            ("description", "amount", "debit_account_id", "credit_account_id"),
            ("date", "journal_id", "post"), {"post": False},
        ),
    },
    "budget": {
        "period": _action(
            ("name", "code", "date_start", "date_end"),
            ("submission_cutoff", "approval_cutoff", "payment_cutoff", "gl_cutoff"),
        ),
        "budget": _action(
            ("name", "code", "period_id", "department_id"), ("cost_center",),
        ),
        "line": _action(
            ("budget_id", "approved_amount"),
            ("category_id", "account_id", "forecast_amount", "warning_threshold"),
            {"warning_threshold": "80"},
        ),
    },
}


def public_action_contracts():
    """Return a JSON-safe copy so callers cannot mutate module constants."""
    return {
        scope: {
            kind: {
                "required": list(contract["required"]),
                "fields": list(contract["fields"]),
                "defaults": dict(contract["defaults"]),
            }
            for kind, contract in contracts.items()
        }
        for scope, contracts in APP_ACTION_CONTRACTS.items()
    }


def validate_action_values(scope, kind, values):
    """Validate an OWL action payload against its declared field contract."""
    contract = APP_ACTION_CONTRACTS.get(scope, {}).get(kind)
    if not contract:
        raise UserError(_("Unsupported %s record type: %s") % (scope, kind))
    values = values or {}
    unknown = sorted(set(values) - set(contract["fields"]))
    if unknown:
        raise UserError(_("Unsupported fields for %s: %s") % (kind, ", ".join(unknown)))
    missing = [field for field in contract["required"] if values.get(field) in (None, "", False)]
    if missing:
        raise UserError(_("Complete the required fields: %s") % ", ".join(missing))
    return {**contract["defaults"], **values}


def page_payload(module, page, payload=None):
    """Normalize every page response to the stable OWL page envelope."""
    result = dict(payload or {})
    result.setdefault("available", True)
    result.setdefault("records", [])
    result.setdefault("kpis", {})
    result.setdefault("charts", {})
    if not isinstance(result["records"], list):
        raise UserError(_("The %s/%s page returned an invalid records payload.") % (module, page))
    if not isinstance(result["kpis"], dict) or not isinstance(result["charts"], dict):
        raise UserError(_("The %s/%s page returned an invalid summary payload.") % (module, page))
    result["contract_version"] = APP_CONTRACT_VERSION
    result["module"] = module
    result["page"] = page
    return result


def serialize_records(records, schema):
    """Serialize recordsets from a small, reviewable field schema.

    Schema values may be a field/path string or a callable accepting one record.
    This removes repeated list-comprehension plumbing while keeping every exposed
    field explicit next to its page loader.
    """
    rows = []
    for record in records:
        row = {}
        for output, source in schema.items():
            if callable(source):
                row[output] = source(record)
                continue
            value = record
            for attribute in source.split("."):
                value = getattr(value, attribute, False)
                if value is False:
                    break
            row[output] = value
        rows.append(row)
    return rows

