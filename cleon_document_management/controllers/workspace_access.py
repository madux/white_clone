# -*- coding: utf-8 -*-
import logging

from odoo import _, fields, http
from odoo.exceptions import AccessError, UserError
from odoo.http import request

_logger = logging.getLogger(__name__)


class WorkspaceAccessController(http.Controller):
    def _service(self):
        return request.env["doc.workspace.access"]

    def _ok(self, data=None):
        return {"success": True, "data": data or {}}

    def _fail(self, error):
        if isinstance(error, AccessError):
            return {"success": False, "message": str(error)}
        if isinstance(error, UserError):
            return {"success": False, "message": str(error)}
        _logger.exception("Workspace access error: %s", error)
        return {"success": False, "message": str(error)}

    @http.route(
        "/api/workspace-access/modules/catalog",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def modules_catalog(self, **kwargs):
        try:
            modules = request.env["doc.workspace.module"].search(
                [("active", "=", True)], order="group, sequence, name"
            )
            return self._ok(
                {
                    "modules": [
                        self._service()._serialize_module(m) for m in modules
                    ]
                }
            )
        except Exception as e:
            return self._fail(e)

    @http.route(
        "/api/workspace-access/modules/eligible",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def modules_eligible(self, **kwargs):
        try:
            self._service().assert_not_delegated(kwargs)
            owner = request.env.user
            eligible = self._service().eligible_modules_for_owner(owner)
            return self._ok(
                {
                    "modules": [
                        self._service()._serialize_module(m) for m in eligible
                    ]
                }
            )
        except Exception as e:
            return self._fail(e)

    @http.route(
        "/api/workspace-access/invites/create",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def invites_create(self, **kwargs):
        try:
            self._service().assert_not_delegated(kwargs)
            valid_until = kwargs.get("valid_until")
            if not valid_until:
                raise UserError(_("Valid until is required."))
            until_dt = fields.Datetime.from_string(valid_until)
            grant = self._service().create_invite(
                request.env.user,
                kwargs.get("module_keys") or [],
                until_dt,
                delegate_id=kwargs.get("delegate_id"),
                note=kwargs.get("note"),
                generate_code=bool(kwargs.get("generate_code")),
            )
            return self._ok(grant)
        except Exception as e:
            return self._fail(e)

    @http.route(
        "/api/workspace-access/invites/incoming",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def invites_incoming(self, **kwargs):
        try:
            self._service().assert_not_delegated(kwargs)
            items = self._service().list_incoming(request.env.user)
            return self._ok({"items": items})
        except Exception as e:
            return self._fail(e)

    @http.route(
        "/api/workspace-access/invites/outgoing",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def invites_outgoing(self, **kwargs):
        try:
            self._service().assert_not_delegated(kwargs)
            items = self._service().list_outgoing(request.env.user)
            return self._ok({"items": items})
        except Exception as e:
            return self._fail(e)

    @http.route(
        "/api/workspace-access/invites/accept",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def invites_accept(self, grant_id=None, **kwargs):
        try:
            self._service().assert_not_delegated(kwargs)
            grant_id = grant_id or kwargs.get("grant_id")
            if not grant_id:
                raise UserError(_("Grant id is required."))
            grant = self._service().accept(int(grant_id), request.env.user)
            return self._ok(grant)
        except Exception as e:
            return self._fail(e)

    @http.route(
        "/api/workspace-access/invites/accept-code",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def invites_accept_code(self, code=None, **kwargs):
        try:
            self._service().assert_not_delegated(kwargs)
            code = code or kwargs.get("code")
            grant = self._service().accept_code(code, request.env.user)
            return self._ok(grant)
        except Exception as e:
            return self._fail(e)

    @http.route(
        "/api/workspace-access/invites/decline",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def invites_decline(self, grant_id=None, **kwargs):
        try:
            self._service().assert_not_delegated(kwargs)
            grant_id = grant_id or kwargs.get("grant_id")
            result = self._service().decline(int(grant_id), request.env.user)
            return self._ok(result)
        except Exception as e:
            return self._fail(e)

    @http.route(
        "/api/workspace-access/grants/revoke",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def grants_revoke(self, grant_id=None, **kwargs):
        try:
            self._service().assert_not_delegated(kwargs)
            grant_id = grant_id or kwargs.get("grant_id")
            grant = self._service().revoke(int(grant_id), request.env.user)
            return self._ok(grant)
        except Exception as e:
            return self._fail(e)

    @http.route(
        "/api/workspace-access/grants/cancel",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def grants_cancel(self, grant_id=None, **kwargs):
        try:
            self._service().assert_not_delegated(kwargs)
            grant_id = grant_id or kwargs.get("grant_id")
            grant = self._service().cancel(int(grant_id), request.env.user)
            return self._ok(grant)
        except Exception as e:
            return self._fail(e)

    @http.route(
        "/api/workspace-access/grants/deactivate",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def grants_deactivate(self, grant_id=None, **kwargs):
        try:
            self._service().assert_not_delegated(kwargs)
            grant_id = grant_id or kwargs.get("grant_id")
            grant = self._service().deactivate(int(grant_id), request.env.user)
            return self._ok(grant)
        except Exception as e:
            return self._fail(e)

    @http.route(
        "/api/workspace-access/grants/update",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def grants_update(self, grant_id=None, **kwargs):
        try:
            self._service().assert_not_delegated(kwargs)
            grant_id = grant_id or kwargs.get("grant_id")
            if not grant_id:
                raise UserError(_("Grant id is required."))
            grant = self._service().update_grant(
                int(grant_id),
                request.env.user,
                module_keys=kwargs.get("module_keys"),
                valid_until=kwargs.get("valid_until"),
            )
            return self._ok(grant)
        except Exception as e:
            return self._fail(e)

    @http.route(
        "/api/workspace-access/session",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def session_get(self, **kwargs):
        try:
            self._service().assert_not_delegated(kwargs)
            grant_id = kwargs.get("grant_id")
            summary = self._service().session_summary(
                request.env.user, grant_id=grant_id
            )
            return self._ok({"grant": summary})
        except Exception as e:
            return self._fail(e)

    @http.route(
        "/api/workspace-access/session/clear",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def session_clear(self, **kwargs):
        try:
            self._service().assert_not_delegated(kwargs)
            result = self._service().clear_session(
                request.env.user, grant_id=kwargs.get("grant_id")
            )
            return self._ok(result)
        except Exception as e:
            return self._fail(e)

    @http.route(
        "/api/workspace-access/users/search",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def users_search(self, query=None, limit=20, **kwargs):
        """Search active users in the same company for delegate picker."""
        try:
            self._service().assert_not_delegated(kwargs)
            query = (query or kwargs.get("query") or "").strip()
            limit = min(int(kwargs.get("limit") or limit or 20), 50)
            user = request.env.user
            domain = [
                ("active", "=", True),
                ("id", "!=", user.id),
                ("share", "=", False),
            ]
            if user.company_id:
                domain.append(("company_id", "=", user.company_id.id))
            if query:
                domain += [
                    "|",
                    "|",
                    ("name", "ilike", query),
                    ("login", "ilike", query),
                    ("email", "ilike", query),
                ]
            users = request.env["res.users"].search(domain, limit=limit)
            return self._ok(
                {
                    "items": [
                        {
                            "id": u.id,
                            "name": u.name or "",
                            "email": u.email or u.login or "",
                        }
                        for u in users
                    ]
                }
            )
        except Exception as e:
            return self._fail(e)
