# -*- coding: utf-8 -*-
import urllib.parse

from odoo import http
from odoo.exceptions import AccessError, UserError
from odoo.http import request


class OrganizationalOauthController(http.Controller):
    @staticmethod
    def _service():
        return request.env["doc.organizational.cloud.import"]

    @staticmethod
    def _perm():
        return request.env["doc.organizational.files.permission"]

    @http.route(
        "/api/organizational/oauth/start",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def oauth_start(self, provider=None, folder_id=None, return_path=None, **kwargs):
        self._perm().require_upload_org(request.env.user)
        if not provider:
            return {"success": False, "message": "Provider is required."}
        path = (return_path or "").strip() or "/document-management/pages/organization"
        if folder_id:
            path = (
                f"/document-management/pages/organization/folder?folder={int(folder_id)}"
            )
        try:
            url = self._service().build_authorize_url(
                request.env.user,
                provider,
                int(folder_id or 0),
                path,
            )
        except (UserError, AccessError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": {"auth_url": url}}

    @http.route(
        "/api/organizational/oauth/callback",
        type="http",
        auth="user",
        methods=["GET"],
        csrf=False,
    )
    def oauth_callback(self, code=None, state=None, error=None, **kwargs):
        base_path = "/document-management/pages/organization"
        if error:
            query = urllib.parse.urlencode({"cloud_oauth_error": error})
            return request.redirect(f"{base_path}?{query}")
        if not code or not state:
            query = urllib.parse.urlencode({"cloud_oauth_error": "missing_code"})
            return request.redirect(f"{base_path}?{query}")
        try:
            oauth_state = self._service().exchange_oauth_code(state, code)
            return_path = oauth_state.return_path or base_path
            separator = "&" if "?" in return_path else "?"
            query = urllib.parse.urlencode(
                {"cloud_oauth": oauth_state.provider, "cloud_oauth_ok": "1"}
            )
            return request.redirect(f"{return_path}{separator}{query}")
        except (UserError, AccessError) as err:
            query = urllib.parse.urlencode({"cloud_oauth_error": str(err)})
            return request.redirect(f"{base_path}?{query}")

    @http.route(
        "/api/organizational/oauth/status",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def oauth_status(self, **kwargs):
        user = request.env.user
        service = self._service()
        Auth = request.env["doc.organizational.connector.auth"]
        items = []
        for provider in ("google_drive", "onedrive", "sharepoint", "dropbox"):
            auth = Auth.for_user_provider(user, provider)
            connector = request.env["doc.organizational.connector"].search(
                [
                    ("company_id", "=", user.company_id.id),
                    ("provider", "=", provider),
                ],
                limit=1,
            )
            items.append(
                {
                    "provider": provider,
                    "configured": service.provider_configured(provider),
                    "company_enabled": bool(connector.connected) if connector else False,
                    "user_connected": bool(auth),
                    "account_label": auth.account_label if auth else "",
                }
            )
        return {"success": True, "data": {"items": items}}

    @http.route(
        "/api/organizational/oauth/disconnect",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def oauth_disconnect(self, provider=None, **kwargs):
        if not provider:
            return {"success": False, "message": "Provider is required."}
        auth = request.env["doc.organizational.connector.auth"].for_user_provider(
            request.env.user, provider
        )
        if auth:
            auth.unlink()
        return {"success": True}

    @http.route(
        "/api/organizational/cloud-files/list",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def cloud_files_list(
        self, provider=None, parent_id=None, page_token=None, **kwargs
    ):
        self._perm().require_upload_org(request.env.user)
        if not provider:
            return {"success": False, "message": "Provider is required."}
        try:
            data = self._service().list_files(
                request.env.user,
                provider,
                parent_id=parent_id or None,
                page_token=page_token or None,
            )
        except (UserError, AccessError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": data}
