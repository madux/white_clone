# -*- coding: utf-8 -*-
from odoo import http
from odoo.http import request


def workspace_ctx(kwargs=None):
    """Return validated delegation context (from ir.http hook or kwargs)."""
    existing = getattr(request, "workspace_delegation_ctx", None)
    if existing is not None:
        return existing
    grant_id = (kwargs or {}).get("workspace_grant_id")
    if not grant_id:
        return None
    path = request.httprequest.path if request.httprequest else None
    ctx = request.env["doc.workspace.access"].validate_grant(
        int(grant_id), request.env.user, http_path=path
    )
    request.workspace_delegation_ctx = ctx
    return ctx


def effective_user(ctx):
    return ctx.owner if ctx else request.env.user


def effective_employee(ctx):
    if ctx:
        return ctx.owner_employee
    return request.env.user.employee_id
