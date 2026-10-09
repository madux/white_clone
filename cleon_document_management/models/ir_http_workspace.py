# -*- coding: utf-8 -*-
import json

from odoo import models
from odoo.http import request


class IrHttp(models.AbstractModel):
    _inherit = "ir.http"

    @classmethod
    def _pre_dispatch(cls, rule, args):
        super()._pre_dispatch(rule, args)
        if not request or not getattr(request, "env", None):
            return
        if request.env.uid is None:
            return
        path = request.httprequest.path if request.httprequest else ""
        if not path.startswith("/api/"):
            return
        if path.startswith("/api/workspace-access"):
            return
        grant_id = cls._workspace_grant_id_from_request()
        if not grant_id:
            return
        try:
            grant_id = int(grant_id)
        except (TypeError, ValueError):
            return
        ctx = request.env["doc.workspace.access"].validate_grant(
            grant_id, request.env.user, http_path=path
        )
        request.workspace_delegation_ctx = ctx
        # Act as the owner for this request only; the module registry above limits
        # which routes are reachable, and the delegate stays recorded in context.
        request.update_env(
            user=ctx.owner.id,
            context=dict(request.env.context, workspace_delegate_uid=ctx.actor.id),
        )

    @classmethod
    def _workspace_grant_id_from_request(cls):
        httprequest = request.httprequest
        if not httprequest:
            return None
        if httprequest.args.get("workspace_grant_id"):
            return httprequest.args.get("workspace_grant_id")
        if httprequest.form:
            grant = httprequest.form.get("workspace_grant_id")
            if grant:
                return grant
        if httprequest.data:
            try:
                raw = httprequest.get_data(cache=True, as_text=True)
                if raw:
                    payload = json.loads(raw)
                    if isinstance(payload, dict):
                        params = payload.get("params")
                        if isinstance(params, dict) and params.get("workspace_grant_id"):
                            return params.get("workspace_grant_id")
            except (json.JSONDecodeError, TypeError, ValueError):
                pass
        return None
