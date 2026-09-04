import uuid
from markupsafe import escape

from odoo import fields, http
from odoo.http import request


class DocumentFolderActions(http.Controller):
    @staticmethod
    def _folder(folder):
        return {
            "id": folder.id,
            "folder_name": folder.folder_name,
            "description": folder.description or "",
            "favorite": request.env.user in folder.favorite_user_ids,
            "pinned": request.env.user in folder.pinned_user_ids,
            "locked": folder.is_locked,
            "active": folder.active,
        }

    @http.route("/api/folder-action", type="json", auth="user", methods=["POST"], csrf=False)
    def folder_action(self, id=None, action=None, **kwargs):
        folder = request.env["doc.folder"].browse(int(id or 0)).exists()
        if not folder:
            return {"success": False, "message": "Folder not found."}
        folder.check_access_rule("read")

        if action == "favorite":
            folder.action_toggle_favorite()
        elif action == "pin":
            folder.action_toggle_pin()
        elif action == "lock":
            folder.action_lock()
        elif action == "unlock":
            folder.action_unlock()
        elif action == "archive":
            folder.action_archive()
        elif action == "restore":
            folder.action_restore()
        elif action == "duplicate":
            folder = folder.action_duplicate()
        elif action == "share":
            permission = kwargs.get("permission", "viewer")
            expiry_option = kwargs.get("expiry_option", "7_days")
            share = request.env["doc.folder.share.link"].create({
                "folder_id": folder.id,
                "token": str(uuid.uuid4()),
                "permission": permission if permission in ("viewer", "editor") else "viewer",
                "expiry_option": expiry_option,
                "allow_download": bool(kwargs.get("allow_download", False)),
                "allow_printing": bool(kwargs.get("allow_printing", False)),
            })
            return {"success": True, "data": {"token": share.token, "url": f"/document-management/shared/folder/{share.token}"}}
        else:
            return {"success": False, "message": "Unsupported folder action."}

        return {"success": True, "data": self._folder(folder)}

    @http.route(
        "/document-management/shared/folder/<string:token>",
        type="http",
        auth="public",
        methods=["GET"],
        csrf=False,
    )
    def shared_folder(self, token):
        share = request.env["doc.folder.share.link"].sudo().search(
            [("token", "=", token), ("active", "=", True)], limit=1
        )
        if not share or share.get_expiry_date() < fields.Datetime.now():
            return request.not_found()
        folder = share.folder_id.sudo()
        documents = request.env["doc.document"].sudo().search(
            [("folder_id", "=", folder.id), ("active", "=", True)], order="name"
        )
        items = "".join(
            f"<li><strong>{escape(document.name)}</strong>"
            f"<span>{escape(document.document_type_id.name)}</span></li>"
            for document in documents
        )
        html = f"""<!doctype html><html><head><meta charset='utf-8'>
        <meta name='viewport' content='width=device-width,initial-scale=1'>
        <title>{escape(folder.folder_name)} | CleonHR</title>
        <style>body{{font-family:Arial,sans-serif;background:#f8fafc;color:#1e293b;padding:40px}}main{{max-width:720px;margin:auto;background:white;border:1px solid #e2e8f0;border-radius:20px;padding:28px;box-shadow:0 16px 40px #e2e8f044}}h1{{margin:0 0 8px}}p{{color:#64748b}}ul{{list-style:none;padding:0;border-top:1px solid #e2e8f0}}li{{display:flex;justify-content:space-between;gap:20px;padding:16px 0;border-bottom:1px solid #e2e8f0}}li span{{color:#be1463;font-size:13px}}</style>
        </head><body><main><p>Shared CleonHR folder</p><h1>{escape(folder.folder_name)}</h1>
        <p>{escape(folder.description or '')}</p><ul>{items or '<li>No documents available.</li>'}</ul></main></body></html>"""
        share.sudo().write({"access_count": share.access_count + 1})
        return request.make_response(html, headers=[("Content-Type", "text/html; charset=utf-8")])
