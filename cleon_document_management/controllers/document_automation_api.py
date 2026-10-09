# -*- coding: utf-8 -*-
import json

LIBRARY_ORGANIZATIONAL = "organizational"
LIBRARY_EMPLOYEE = "employee"

AUTOMATION_READ_OPS = frozenset(
    {"list", "get", "get_by_id", "runs", "runs_by_rule_id"}
)


def _as_int_ids(value):
    if value in (None, False, ""):
        return []
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError):
            value = [value]
    if isinstance(value, int):
        return [value]
    if isinstance(value, (list, tuple)):
        return [int(item) for item in value if str(item).isdigit()]
    return []


def _org_perm(env):
    return env["doc.organizational.files.permission"]


def _ef_perm(env):
    return env["doc.employee.files.permission"]


def _can_manage_automation(env, user, library):
    if library == LIBRARY_ORGANIZATIONAL:
        return _org_perm(env).user_can_manage_org_document(user)
    return _ef_perm(env).user_can_automate_ef_document(user)


def _can_view_automation(env, user, library):
    if library == LIBRARY_ORGANIZATIONAL:
        return _org_perm(env).user_can_access_org_library(user)
    return _ef_perm(env).user_can_access_ef_home(user)


def _automation_access_denied(op):
    if op in AUTOMATION_READ_OPS:
        return {"success": False, "message": "You do not have permission to view automations."}
    return {"success": False, "message": "You do not have permission to manage automations."}


def _resolve_document(env, user, library, document_id):
    document = env["doc.document"].browse(int(document_id or 0)).exists()
    if not document or document.folder_id.folder_type != library:
        return None
    document.check_access_rule("read")
    if library == LIBRARY_ORGANIZATIONAL:
        if not document._organizational_user_can_access(user):
            return None
    elif not _ef_perm(env).user_can_on_document(user, document, "action_view"):
        return None
    return document


def _rule_in_library(rule, library):
    return rule.document_id.folder_id.folder_type == library


def _user_can_access_rule_document(env, user, library, document):
    if library == LIBRARY_ORGANIZATIONAL:
        return document._organizational_user_can_access(user)
    return _ef_perm(env).user_can_on_document(user, document, "action_view")


def handle_document_automation(env, user, library, document_id, kwargs):
    op = kwargs.get("op") or "list"
    can_manage = _can_manage_automation(env, user, library)
    can_view = _can_view_automation(env, user, library)
    if can_manage:
        pass
    elif op in AUTOMATION_READ_OPS and can_view:
        pass
    else:
        return _automation_access_denied(op)
    Automation = env["doc.document.automation"]
    Run = env["doc.document.automation.run"]
    if op == "get_by_id":
        rule = Automation.browse(int(kwargs.get("id") or 0)).exists()
        if not rule or not _rule_in_library(rule, library):
            return {"success": False, "message": "Automation not found."}
        doc = rule.document_id
        if not _user_can_access_rule_document(env, user, library, doc):
            return {"success": False, "message": "Document not found."}
        payload = rule.serialize_for_api()
        payload["document_name"] = doc.name
        payload["folder_id"] = doc.folder_id.id
        payload["folder_name"] = doc.folder_id.folder_name
        if library == LIBRARY_EMPLOYEE and doc.employee_id:
            payload["employee_id"] = doc.employee_id.id
            payload["employee_name"] = doc.employee_id.name
        return {"success": True, "data": payload}
    if op in ("get", "runs"):
        document = _resolve_document(env, user, library, document_id)
        if not document:
            return {"success": False, "message": "Document not found."}
        rule = Automation.browse(int(kwargs.get("id") or 0)).exists()
        if not rule or rule.document_id != document:
            return {"success": False, "message": "Automation not found."}
        if op == "get":
            return {"success": True, "data": rule.serialize_for_api()}
        limit = min(int(kwargs.get("limit") or 50), 200)
        offset = max(int(kwargs.get("offset") or 0), 0)
        domain = [("automation_id", "=", rule.id)]
        total = Run.search_count(domain)
        runs = Run.search(domain, limit=limit, offset=offset)
        return {
            "success": True,
            "data": {
                "items": [row.serialize_for_api() for row in runs],
                "total": total,
            },
        }
    if op == "runs_by_rule_id":
        rule = Automation.browse(int(kwargs.get("id") or 0)).exists()
        if not rule or not _rule_in_library(rule, library):
            return {"success": False, "message": "Automation not found."}
        doc = rule.document_id
        if not _user_can_access_rule_document(env, user, library, doc):
            return {"success": False, "message": "Automation not found."}
        limit = min(int(kwargs.get("limit") or 50), 200)
        offset = max(int(kwargs.get("offset") or 0), 0)
        domain = [("automation_id", "=", rule.id)]
        total = Run.search_count(domain)
        runs = Run.search(domain, limit=limit, offset=offset)
        return {
            "success": True,
            "data": {
                "items": [row.serialize_for_api() for row in runs],
                "total": total,
            },
        }
    document = _resolve_document(env, user, library, document_id)
    if not document:
        return {"success": False, "message": "Document not found."}
    if op == "notify_candidates":
        users = document._automation_notify_candidate_users()
        return {
            "success": True,
            "data": {
                "users": [
                    {
                        "id": user_row.id,
                        "name": user_row.name,
                        "email": user_row.email or "",
                    }
                    for user_row in users
                ],
            },
        }
    if op == "create":
        required = (kwargs.get("name") or "").strip()
        if not required or not kwargs.get("trigger") or not kwargs.get("action"):
            return {"success": False, "message": "Name, trigger and action are required."}
        trigger = kwargs.get("trigger")
        action = kwargs.get("action")
        condition = Automation._normalize_condition_value(kwargs.get("condition") or "always")
        try:
            Automation._validate_condition_for_rule(trigger, action, condition)
        except Exception as error:  # noqa: BLE001
            return {"success": False, "message": str(error)}
        values = {
            "name": required,
            "document_id": document.id,
            "trigger": trigger,
            "condition": condition,
            "action": action,
            "status": kwargs.get("status") or "active",
        }
        notify_ids = _as_int_ids(kwargs.get("notify_user_ids"))
        if action == "notify_audience":
            if not notify_ids:
                return {"success": False, "message": "Select at least one user to notify."}
            values["notify_user_ids"] = [(6, 0, notify_ids)]
        try:
            rule = Automation.create(values)
        except Exception as error:  # noqa: BLE001
            return {"success": False, "message": str(error)}
        env["doc.object.audit"].log(document, "automation", f"Saved automation {rule.name}")
        return {"success": True, "data": rule.serialize_for_api()}
    if op == "update":
        rule = Automation.browse(int(kwargs.get("id") or 0)).exists()
        if not rule or rule.document_id != document:
            return {"success": False, "message": "Automation not found."}
        values = {}
        for field in ("name", "trigger", "action", "status"):
            if field in kwargs:
                values[field] = kwargs.get(field)
        if "condition" in kwargs:
            values["condition"] = Automation._normalize_condition_value(
                kwargs.get("condition") or "always"
            )
        trigger = values.get("trigger", rule.trigger)
        action = values.get("action", rule.action)
        condition = values.get("condition", rule.condition)
        if any(key in values for key in ("trigger", "action", "condition")):
            try:
                Automation._validate_condition_for_rule(trigger, action, condition)
            except Exception as error:  # noqa: BLE001
                return {"success": False, "message": str(error)}
        target_action = values.get("action", rule.action)
        if target_action == "notify_audience":
            if "notify_user_ids" in kwargs:
                notify_ids = _as_int_ids(kwargs.get("notify_user_ids"))
                if not notify_ids:
                    return {"success": False, "message": "Select at least one user to notify."}
                values["notify_user_ids"] = [(6, 0, notify_ids)]
            elif rule.action != "notify_audience":
                return {"success": False, "message": "Select at least one user to notify."}
        if values:
            try:
                rule.write(values)
            except Exception as error:  # noqa: BLE001
                return {"success": False, "message": str(error)}
        return {"success": True, "data": rule.serialize_for_api()}
    if op == "delete":
        rule = Automation.browse(int(kwargs.get("id") or 0)).exists()
        if rule and rule.document_id == document:
            rule.unlink()
        return {"success": True, "data": {"deleted": True}}
    rules = Automation.search([("document_id", "=", document.id)])
    return {"success": True, "data": {"items": [rule.serialize_for_api() for rule in rules]}}


def automation_hub_for_library(env, user, library):
    return {
        "success": False,
        "code": "AUTOMATION_HUB_REMOVED",
        "message": (
            "The automation rule hub was removed (global spec GL-05). "
            "Use per-document Lifecycle and Settings → Notification Rules."
        ),
    }
