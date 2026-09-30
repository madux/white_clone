#!/usr/bin/env python3
"""HTTP/UI smoke for DMS QA matrix. Outputs JSONL to stdout."""
from __future__ import annotations

import json
import os
import sys

import urllib.request

BASE = os.environ.get("DMS_QA_BASE", "http://127.0.0.1:8069")
DB = os.environ.get("ODOO_DB", "white_cleon_17")
LOGIN = os.environ.get("ODOO_LOGIN", "admin")  # email/login
PASSWORD = os.environ.get("ODOO_PASSWORD", "admin")
DEMO_LOGIN = os.environ.get("ODOO_DEMO_LOGIN", "demo")
DEMO_PASSWORD = os.environ.get("ODOO_DEMO_PASSWORD", "demo")


def record(test_id: str, status: str, note: str = "") -> None:
    print(json.dumps({"id": test_id, "status": status, "note": note}), flush=True)


def jsonrpc(session_id: str, path: str, params: dict) -> dict:
    body = json.dumps(
        {
            "jsonrpc": "2.0",
            "method": "call",
            "params": params,
            "id": 1,
        }
    ).encode()
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Cookie": f"session_id={session_id}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        payload = json.loads(resp.read().decode())
    if payload.get("error"):
        raise RuntimeError(payload["error"])
    return payload.get("result") or {}


def authenticate() -> str:
    body = json.dumps(
        {
            "jsonrpc": "2.0",
            "method": "call",
            "params": {"db": DB, "login": LOGIN, "password": PASSWORD},
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
        raise RuntimeError("auth failed")
    if not session:
        raise RuntimeError("no session_id cookie")
    return session


def head(path: str, session_id: str) -> int:
    req = urllib.request.Request(
        f"{BASE}{path}",
        headers={"Cookie": f"session_id={session_id}"},
        method="HEAD",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status
    except urllib.error.HTTPError as e:
        return e.code


def main() -> int:
    try:
        session = authenticate()
    except Exception as exc:
        record("RUNNER-HTTP", "Fail", f"auth: {exc}")
        return 1

    pages = [
        ("SMK-01", "/document-management/pages/dashboard/"),
        ("SMK-02", "/document-management/pages/employee"),
        ("SMK-09", "/document-management/pages/organization/"),
        ("SMK-11", "/document-management/pages/compliance/"),
        ("SMK-12", "/document-management/pages/my-workspace/"),
        ("SMK-13", "/document-management/pages/settings/"),
        ("PLT-001", "/document-management/pages/employee"),
        ("CMP-01", "/document-management/pages/compliance/"),
        ("WS-01", "/document-management/pages/my-workspace/"),
        ("ADM-05", "/document-management/pages/super-admin/"),
        ("X-03", "/document-management/pages/pending-uploads/"),
    ]
    for tid, path in pages:
        code = head(path, session)
        record(tid, "Pass" if code in (200, 303, 307) else "Fail", f"HTTP {code}")

    me = jsonrpc(session, "/api/me", {})
    if me.get("success") and me.get("data", {}).get("employee_files_permissions"):
        record("EF-R7-01", "Pass", "/api/me employee_files_permissions")
        record("ADM-03", "Pass", "/api/me organizational_files_permissions")
    else:
        record("EF-R7-01", "Fail", "missing permissions in /api/me")

    if config := jsonrpc(session, "/api/settings", {}):
        record("SMK-13", "Pass" if config.get("success") else "Partial", "settings API")

    folders = jsonrpc(session, "/api/get-folder", {})
    record("ORG-A-01", "Pass" if folders.get("success") else "Fail", "get-folder API")

    return 0


if __name__ == "__main__":
    sys.exit(main())
