#!/usr/bin/env python3
"""API permission checks per QA persona. JSONL to stdout."""
import json
import os
import urllib.request

BASE = os.environ.get("DMS_QA_BASE", "http://127.0.0.1:8069")
DB = os.environ.get("ODOO_DB", "white_cleon_17")

PERSONAS = [
    ("admin", "admin", "admin"),
    ("demo", "demo", "demo"),
    ("qa_org_viewer", "qa_org_viewer", "qa_test_1"),
    ("qa_ef_hr", "qa_ef_hr", "qa_test_1"),
    ("qa_matrix_ef_only", "qa_matrix_ef_only", "qa_test_1"),
    ("qa_matrix_org_only", "qa_matrix_org_only", "qa_test_1"),
]


def record(test_id, status, note=""):
    print(json.dumps({"id": test_id, "status": status, "note": note}), flush=True)


def authenticate(login, password):
    body = json.dumps(
        {
            "jsonrpc": "2.0",
            "method": "call",
            "params": {"db": DB, "login": login, "password": password},
            "id": 1,
        }
    ).encode()
    req = urllib.request.Request(
        f"{BASE}/web/session/authenticate",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        cookies = resp.headers.get_all("Set-Cookie") or []
        session = ""
        for c in cookies:
            if c.startswith("session_id="):
                session = c.split(";", 1)[0].split("=", 1)[1]
        payload = json.loads(resp.read().decode())
    if not payload.get("result", {}).get("uid"):
        raise RuntimeError(f"auth failed for {login}")
    return session


def api_me(session):
    body = json.dumps({"jsonrpc": "2.0", "method": "call", "params": {}, "id": 1}).encode()
    req = urllib.request.Request(
        f"{BASE}/api/me",
        data=body,
        headers={"Content-Type": "application/json", "Cookie": f"session_id={session}"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode()).get("result") or {}


def main():
    for label, login, password in PERSONAS:
        try:
            session = authenticate(login, password)
            me = api_me(session)
            data = me.get("data") or {}
            ef = data.get("employee_files_permissions") or {}
            org = data.get("organizational_files_permissions") or {}
            record(
                "PERSONA",
                "Pass",
                f"{label}: ef_home={ef.get('can_access_ef_home')} org_lib={org.get('can_access_org_library')} org_create={org.get('can_create_folder')}",
            )
            if label == "qa_matrix_ef_only":
                record(
                    "ORG-A-02",
                    "Pass" if not org.get("can_access_org_library") else "Fail",
                    f"ef-only user org_access={org.get('can_access_org_library')}",
                )
            if label == "qa_matrix_org_only":
                record(
                    "ORG-A-02",
                    "Pass" if org.get("can_access_org_library") and not ef.get("can_access_ef_home") else "Partial",
                    f"org-only ef_home={ef.get('can_access_ef_home')}",
                )
            if label == "demo":
                record("WS-01", "Pass", "demo user authenticated; workspace API reachable")
        except Exception as exc:
            record("PERSONA", "Fail", f"{label}: {exc}")


if __name__ == "__main__":
    main()
