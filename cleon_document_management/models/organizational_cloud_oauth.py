# -*- coding: utf-8 -*-
import base64
import json
import logging
import os
import secrets
import urllib.error
import urllib.parse
import urllib.request
from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import UserError, ValidationError

from odoo.addons.cleon_document_management.models.organizational_library import CONNECTORS

_logger = logging.getLogger(__name__)

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_DRIVE_FILES = "https://www.googleapis.com/drive/v3/files"

DROPBOX_AUTH_URL = "https://www.dropbox.com/oauth2/authorize"
DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token"
DROPBOX_API = "https://api.dropboxapi.com/2"
DROPBOX_CONTENT = "https://content.dropboxapi.com/2"

MS_AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
MS_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
MS_GRAPH = "https://graph.microsoft.com/v1.0"

GOOGLE_EXPORT = {
    "application/vnd.google-apps.document": (
        "application/pdf",
        ".pdf",
    ),
    "application/vnd.google-apps.spreadsheet": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".xlsx",
    ),
    "application/vnd.google-apps.presentation": (
        "application/pdf",
        ".pdf",
    ),
}


def _http_json(url, data=None, headers=None, method=None):
    payload = None
    req_headers = dict(headers or {})
    if data is not None and isinstance(data, dict):
        payload = json.dumps(data).encode("utf-8")
        req_headers.setdefault("Content-Type", "application/json")
    elif data is not None and isinstance(data, bytes):
        payload = data
    request = urllib.request.Request(
        url,
        data=payload,
        headers=req_headers,
        method=method or ("POST" if payload is not None else "GET"),
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            body = response.read()
            if not body:
                return {}
            return json.loads(body.decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        _logger.warning("Cloud API HTTP error %s: %s", error.code, detail[:500])
        raise UserError(_("Cloud provider request failed (%s).") % error.code) from error


def _http_bytes(url, headers=None):
    request = urllib.request.Request(url, headers=dict(headers or {}), method="GET")
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        _logger.warning("Cloud download HTTP error %s: %s", error.code, detail[:500])
        raise UserError(_("Unable to download the selected file.")) from error


def _oauth_client_credentials(env, provider):
    prefix = provider.upper()
    client_id = (
        os.environ.get(f"ORG_{prefix}_CLIENT_ID")
        or env["ir.config_parameter"]
        .sudo()
        .get_param(f"cleon_document_management.{provider}_client_id")
        or ""
    ).strip()
    client_secret = (
        os.environ.get(f"ORG_{prefix}_CLIENT_SECRET")
        or env["ir.config_parameter"]
        .sudo()
        .get_param(f"cleon_document_management.{provider}_client_secret")
        or ""
    ).strip()
    return client_id, client_secret


def _redirect_uri(env):
    base = (
        env["ir.config_parameter"].sudo().get_param("web.base.url") or ""
    ).rstrip("/")
    return f"{base}/api/organizational/oauth/callback"


class DocOrganizationalOauthState(models.Model):
    _name = "doc.organizational.oauth.state"
    _description = "Organizational cloud OAuth state"
    _order = "id desc"

    token = fields.Char(required=True, index=True)
    user_id = fields.Many2one("res.users", required=True, ondelete="cascade")
    provider = fields.Selection(
        [
            ("google_drive", "Google Drive"),
            ("onedrive", "OneDrive"),
            ("sharepoint", "SharePoint"),
            ("dropbox", "Dropbox"),
        ],
        required=True,
    )
    folder_id = fields.Integer()
    return_path = fields.Char(required=True)
    used = fields.Boolean(default=False, index=True)
    expires_at = fields.Datetime(required=True, index=True)

    @api.model
    def _cleanup_expired(self):
        expired = self.search([("expires_at", "<", fields.Datetime.now())])
        expired.unlink()

    @api.model
    def create_state(self, user, provider, folder_id, return_path):
        self._cleanup_expired()
        token = secrets.token_urlsafe(32)
        return self.create(
            {
                "token": token,
                "user_id": user.id,
                "provider": provider,
                "folder_id": int(folder_id or 0),
                "return_path": return_path,
                "expires_at": fields.Datetime.now() + timedelta(minutes=15),
            }
        )


class DocOrganizationalConnectorAuth(models.Model):
    _name = "doc.organizational.connector.auth"
    _description = "Per-user organizational cloud OAuth tokens"
    _rec_name = "provider"

    user_id = fields.Many2one("res.users", required=True, ondelete="cascade", index=True)
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    provider = fields.Selection(
        [
            ("google_drive", "Google Drive"),
            ("onedrive", "OneDrive"),
            ("sharepoint", "SharePoint"),
            ("dropbox", "Dropbox"),
        ],
        required=True,
        index=True,
    )
    access_token = fields.Char(required=True)
    refresh_token = fields.Char()
    token_expiry = fields.Datetime()
    account_label = fields.Char()

    _sql_constraints = [
        (
            "user_provider_company_uniq",
            "unique(user_id, company_id, provider)",
            "Each user can only connect a provider once per company.",
        )
    ]

    def _ensure_fresh_token(self):
        self.ensure_one()
        if (
            self.token_expiry
            and self.token_expiry > fields.Datetime.now() + timedelta(minutes=2)
        ):
            return self.access_token
        if not self.refresh_token:
            raise UserError(_("Your %s session expired. Connect again.") % self.provider)
        client_id, client_secret = _oauth_client_credentials(self.env, self.provider)
        if self.provider == "google_drive":
            body = urllib.parse.urlencode(
                {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": self.refresh_token,
                    "grant_type": "refresh_token",
                }
            ).encode("utf-8")
            data = _http_json(
                GOOGLE_TOKEN_URL,
                data=body,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        elif self.provider == "dropbox":
            body = urllib.parse.urlencode(
                {
                    "refresh_token": self.refresh_token,
                    "grant_type": "refresh_token",
                    "client_id": client_id,
                    "client_secret": client_secret,
                }
            ).encode("utf-8")
            data = _http_json(
                DROPBOX_TOKEN_URL,
                data=body,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        elif self.provider in ("onedrive", "sharepoint"):
            body = urllib.parse.urlencode(
                {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "refresh_token": self.refresh_token,
                    "grant_type": "refresh_token",
                    "scope": "offline_access Files.Read",
                }
            ).encode("utf-8")
            data = _http_json(
                MS_TOKEN_URL,
                data=body,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
        else:
            raise UserError(_("Unsupported provider."))
        access = data.get("access_token")
        if not access:
            raise UserError(_("Unable to refresh cloud access."))
        expiry = fields.Datetime.now() + timedelta(seconds=int(data.get("expires_in", 3600)))
        self.write(
            {
                "access_token": access,
                "token_expiry": expiry,
                "refresh_token": data.get("refresh_token") or self.refresh_token,
            }
        )
        return access

    @api.model
    def for_user_provider(self, user, provider):
        return self.search(
            [
                ("user_id", "=", user.id),
                ("company_id", "=", user.company_id.id),
                ("provider", "=", provider),
            ],
            limit=1,
        )

    @api.model
    def save_tokens(self, user, provider, token_payload, account_label=""):
        expiry = fields.Datetime.now() + timedelta(
            seconds=int(token_payload.get("expires_in", 3600))
        )
        record = self.for_user_provider(user, provider)
        values = {
            "access_token": token_payload.get("access_token") or "",
            "refresh_token": token_payload.get("refresh_token") or "",
            "token_expiry": expiry,
            "account_label": account_label or "",
        }
        if record:
            record.write(values)
        else:
            record = self.create(
                {
                    "user_id": user.id,
                    "company_id": user.company_id.id,
                    "provider": provider,
                    **values,
                }
            )
        connector = self.env["doc.organizational.connector"].search(
            [
                ("company_id", "=", user.company_id.id),
                ("provider", "=", provider),
            ],
            limit=1,
        )
        if connector:
            connector.write(
                {"connected": True, "connected_at": fields.Datetime.now()}
            )
        else:
            self.env["doc.organizational.connector"].create(
                {
                    "company_id": user.company_id.id,
                    "provider": provider,
                    "connected": True,
                    "connected_at": fields.Datetime.now(),
                }
            )
        return record


class DocOrganizationalCloudImport(models.AbstractModel):
    _name = "doc.organizational.cloud.import"
    _description = "Organizational cloud import service"

    @api.model
    def provider_configured(self, provider):
        client_id, _secret = _oauth_client_credentials(self.env, provider)
        return bool(client_id)

    @api.model
    def oauth_scopes(self, provider):
        if provider == "google_drive":
            return "https://www.googleapis.com/auth/drive.readonly"
        if provider == "dropbox":
            return "account_info.read files.metadata.read files.content.read"
        if provider in ("onedrive", "sharepoint"):
            return "offline_access Files.Read"
        return ""

    @api.model
    def build_authorize_url(self, user, provider, folder_id, return_path):
        if provider not in CONNECTORS:
            raise UserError(_("Unknown cloud provider."))
        client_id, _secret = _oauth_client_credentials(self.env, provider)
        if not client_id:
            raise UserError(
                _(
                    "OAuth is not configured for %(provider)s. "
                    "Ask an administrator to set client credentials.",
                    provider=provider,
                )
            )
        state = self.env["doc.organizational.oauth.state"].create_state(
            user, provider, folder_id, return_path
        )
        if provider == "google_drive":
            params = {
                "client_id": client_id,
                "redirect_uri": _redirect_uri(self.env),
                "response_type": "code",
                "scope": self.oauth_scopes(provider),
                "access_type": "offline",
                "prompt": "consent",
                "state": state.token,
            }
            return f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}"
        if provider == "dropbox":
            params = {
                "client_id": client_id,
                "redirect_uri": _redirect_uri(self.env),
                "response_type": "code",
                "token_access_type": "offline",
                "state": state.token,
            }
            return f"{DROPBOX_AUTH_URL}?{urllib.parse.urlencode(params)}"
        if provider in ("onedrive", "sharepoint"):
            params = {
                "client_id": client_id,
                "redirect_uri": _redirect_uri(self.env),
                "response_type": "code",
                "scope": self.oauth_scopes(provider),
                "state": state.token,
            }
            return f"{MS_AUTH_URL}?{urllib.parse.urlencode(params)}"
        raise UserError(_("Unsupported provider."))

    @api.model
    def exchange_oauth_code(self, state_token, code):
        state = self.env["doc.organizational.oauth.state"].sudo().search(
            [("token", "=", state_token), ("used", "=", False)],
            limit=1,
        )
        if not state or state.expires_at < fields.Datetime.now():
            raise UserError(_("OAuth session expired. Try connecting again."))
        provider = state.provider
        user = state.user_id
        client_id, client_secret = _oauth_client_credentials(self.env, provider)
        redirect = _redirect_uri(self.env)
        if provider == "google_drive":
            body = urllib.parse.urlencode(
                {
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect,
                    "grant_type": "authorization_code",
                }
            ).encode("utf-8")
            token_payload = _http_json(
                GOOGLE_TOKEN_URL,
                data=body,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            account_label = ""
            try:
                profile = _http_json(
                    "https://www.googleapis.com/oauth2/v2/userinfo",
                    headers={"Authorization": f"Bearer {token_payload.get('access_token')}"},
                )
                account_label = profile.get("email") or profile.get("name") or ""
            except Exception:  # noqa: BLE001
                pass
        elif provider == "dropbox":
            body = urllib.parse.urlencode(
                {
                    "code": code,
                    "grant_type": "authorization_code",
                    "redirect_uri": redirect,
                    "client_id": client_id,
                    "client_secret": client_secret,
                }
            ).encode("utf-8")
            token_payload = _http_json(
                DROPBOX_TOKEN_URL,
                data=body,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            account_label = ""
            try:
                profile = _http_json(
                    DROPBOX_API + "/users/get_current_account",
                    data={},
                    headers={
                        "Authorization": f"Bearer {token_payload.get('access_token')}",
                        "Content-Type": "application/json",
                    },
                )
                account_label = profile.get("email") or profile.get("name", {}).get(
                    "display_name", ""
                )
            except Exception:  # noqa: BLE001
                pass
        elif provider in ("onedrive", "sharepoint"):
            body = urllib.parse.urlencode(
                {
                    "code": code,
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect,
                    "grant_type": "authorization_code",
                    "scope": self.oauth_scopes(provider),
                }
            ).encode("utf-8")
            token_payload = _http_json(
                MS_TOKEN_URL,
                data=body,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            account_label = ""
            try:
                profile = _http_json(
                    MS_GRAPH + "/me",
                    headers={"Authorization": f"Bearer {token_payload.get('access_token')}"},
                )
                account_label = profile.get("mail") or profile.get("userPrincipalName") or ""
            except Exception:  # noqa: BLE001
                pass
        else:
            raise UserError(_("Unsupported provider."))
        self.env["doc.organizational.connector.auth"].save_tokens(
            user, provider, token_payload, account_label=account_label
        )
        state.write({"used": True})
        return state

    @api.model
    def _auth(self, user, provider):
        auth = self.env["doc.organizational.connector.auth"].for_user_provider(
            user, provider
        )
        if not auth:
            raise UserError(
                _("Connect %(provider)s before importing files.") % {"provider": provider}
            )
        token = auth._ensure_fresh_token()
        return auth, token

    @api.model
    def list_files(self, user, provider, parent_id=None, page_token=None):
        _, token = self._auth(user, provider)
        if provider == "google_drive":
            q_parts = ["trashed = false"]
            if parent_id:
                q_parts.append(f"'{parent_id}' in parents")
            else:
                q_parts.append("'root' in parents")
            params = {
                "q": " and ".join(q_parts),
                "fields": "nextPageToken,files(id,name,mimeType,size,modifiedTime,iconLink)",
                "pageSize": "50",
                "orderBy": "folder,name",
            }
            if page_token:
                params["pageToken"] = page_token
            url = f"{GOOGLE_DRIVE_FILES}?{urllib.parse.urlencode(params)}"
            data = _http_json(url, headers={"Authorization": f"Bearer {token}"})
            items = []
            for row in data.get("files", []):
                mime = row.get("mimeType") or ""
                is_folder = mime == "application/vnd.google-apps.folder"
                items.append(
                    {
                        "id": row.get("id"),
                        "name": row.get("name") or "Untitled",
                        "mime_type": mime,
                        "is_folder": is_folder,
                        "size": int(row.get("size") or 0),
                        "modified_at": row.get("modifiedTime") or "",
                    }
                )
            return {"items": items, "next_page_token": data.get("nextPageToken") or ""}

        if provider == "dropbox":
            path = parent_id or ""
            data = _http_json(
                DROPBOX_API + "/files/list_folder",
                data={"path": path, "limit": 50},
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
            items = []
            for entry in data.get("entries", []):
                tag = entry.get(".tag")
                is_folder = tag == "folder"
                items.append(
                    {
                        "id": entry.get("path_lower") or entry.get("id") or entry.get("name"),
                        "name": entry.get("name") or "Untitled",
                        "mime_type": "application/octet-stream",
                        "is_folder": is_folder,
                        "size": int((entry.get("size") or 0)),
                        "modified_at": entry.get("client_modified") or "",
                    }
                )
            return {"items": items, "next_page_token": ""}

        if provider in ("onedrive", "sharepoint"):
            if parent_id:
                url = MS_GRAPH + f"/me/drive/items/{parent_id}/children"
            else:
                url = MS_GRAPH + "/me/drive/root/children"
            data = _http_json(url, headers={"Authorization": f"Bearer {token}"})
            items = []
            for row in data.get("value", []):
                is_folder = "folder" in row
                items.append(
                    {
                        "id": row.get("id"),
                        "name": row.get("name") or "Untitled",
                        "mime_type": (row.get("file") or {}).get("mimeType")
                        or "application/octet-stream",
                        "is_folder": is_folder,
                        "size": int((row.get("size") or 0)),
                        "modified_at": row.get("lastModifiedDateTime") or "",
                    }
                )
            next_link = (data.get("@odata.nextLink") or "").split("skipToken=")
            return {
                "items": items,
                "next_page_token": next_link[-1] if len(next_link) > 1 else "",
            }

        raise UserError(_("Unsupported provider."))

    @api.model
    def download_file(self, user, provider, file_id, suggested_name=""):
        _, token = self._auth(user, provider)
        filename = suggested_name or "imported-file"
        mimetype = "application/octet-stream"

        if provider == "google_drive":
            meta = _http_json(
                f"{GOOGLE_DRIVE_FILES}/{file_id}?fields=name,mimeType,size",
                headers={"Authorization": f"Bearer {token}"},
            )
            mime = meta.get("mimeType") or mimetype
            filename = meta.get("name") or filename
            if mime in GOOGLE_EXPORT:
                export_mime, suffix = GOOGLE_EXPORT[mime]
                if not filename.lower().endswith(suffix):
                    filename = f"{filename}{suffix}"
                raw = _http_bytes(
                    f"{GOOGLE_DRIVE_FILES}/{file_id}/export?mimeType={urllib.parse.quote(export_mime)}",
                    headers={"Authorization": f"Bearer {token}"},
                )
                mimetype = export_mime
            else:
                raw = _http_bytes(
                    f"{GOOGLE_DRIVE_FILES}/{file_id}?alt=media",
                    headers={"Authorization": f"Bearer {token}"},
                )
                mimetype = mime
            return filename, mimetype, raw

        if provider == "dropbox":
            request = urllib.request.Request(
                DROPBOX_CONTENT + "/files/download",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Dropbox-API-Arg": json.dumps({"path": file_id}),
                },
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=120) as response:
                meta = json.loads(response.headers.get("Dropbox-API-Result", "{}"))
                filename = meta.get("name") or filename
                mimetype = meta.get("content_hash") and mimetype or mimetype
                raw = response.read()
            return filename, mimetype, raw

        if provider in ("onedrive", "sharepoint"):
            meta = _http_json(
                MS_GRAPH + f"/me/drive/items/{file_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            filename = meta.get("name") or filename
            mimetype = (meta.get("file") or {}).get("mimeType") or mimetype
            raw = _http_bytes(
                MS_GRAPH + f"/me/drive/items/{file_id}/content",
                headers={"Authorization": f"Bearer {token}"},
            )
            return filename, mimetype, raw

        raise UserError(_("Unsupported provider."))

    @api.model
    def import_file_copy(
        self,
        user,
        folder,
        provider,
        file_id,
        document_type,
        display_name="",
        description="",
    ):
        self.env["doc.organizational.files.permission"].require_upload_org(user)
        folder.assert_unlocked(for_upload=True)
        filename, mimetype, raw = self.download_file(
            user, provider, file_id, suggested_name=display_name
        )
        if not raw:
            raise UserError(_("The selected file is empty."))
        attachment = self.env["ir.attachment"].sudo().create(
            {
                "name": filename,
                "datas": base64.b64encode(raw),
                "mimetype": mimetype,
            }
        )
        document = self.env["doc.document"].create(
            {
                "name": display_name or filename,
                "folder_id": folder.id,
                "document_type_id": document_type.id,
                "attachment_id": attachment.id,
                "description": description or _("Imported from %s") % provider,
                "imported_from": provider,
                "source_url": False,
                "link_status": "none",
            }
        )
        attachment.write({"res_model": "doc.document", "res_id": document.id})
        self.env["doc.object.audit"].log(
            document,
            "import",
            _("Copied from %(provider)s") % {"provider": provider},
            details=json.dumps({"external_file_id": file_id}),
        )
        return document
