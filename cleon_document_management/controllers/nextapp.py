import json
import logging
import mimetypes
import os
from odoo import http, fields
from odoo.http import request
from odoo.tools.misc import file_path

_logger = logging.getLogger(__name__)

MODULE = "cleon_document_management"
NEXTAPP_STATIC_DIR = "static/src/nextapp"
NEXTAPP_ASSET_EXT = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
    ".ttf",
}


class NextAppController(http.Controller):
    """
    Serves Next.js frontend mounted at /document-management.

    Serves the static exported HTML from static/src/nextapp and injects the
    authenticated Odoo user before the page hydrates.
    """

    @staticmethod
    def _read_html(relative_path):
        """Read a pre-built HTML file; return None if missing."""
        try:
            abs_path = file_path(f"{MODULE}/{NEXTAPP_STATIC_DIR}/{relative_path}")
        except FileNotFoundError:
            return None
        if abs_path and os.path.isfile(abs_path):
            with open(abs_path, "r", encoding="utf-8") as f:
                return f.read()
        return None

    def _serve_public_asset(self, subpath):
        """Serve Next public files (png/svg/ico) from the exported nextapp folder."""
        if not subpath or ".." in subpath or subpath.startswith("/"):
            return None
        ext = os.path.splitext(subpath)[1].lower()
        if ext not in NEXTAPP_ASSET_EXT:
            return None
        try:
            abs_path = file_path(f"{MODULE}/{NEXTAPP_STATIC_DIR}/{subpath}")
        except FileNotFoundError:
            return None
        if not abs_path or not os.path.isfile(abs_path):
            return None
        mime, _ = mimetypes.guess_type(abs_path)
        with open(abs_path, "rb") as handle:
            data = handle.read()
        return request.make_response(
            data,
            headers=[
                ("Content-Type", mime or "application/octet-stream"),
                ("Cache-Control", "public, max-age=86400"),
            ],
        )

    def _get_user_script(self, user):
        """Generates window.__ODOO_USER__ injection script."""
        user_data = json.dumps(
            {
                "user_id": user.id,
                "user_name": user.name,
                "user_email": user.email or "",
                "company_id": user.company_id.id,
                "company_name": user.company_id.name,
                "tz": user.tz or "",
                "is_admin": user.has_group("base.group_system"),
                "is_document_manager": user.has_group(
                    "cleon_document_management.group_document_manager"
                ),
            }
        )
        return f"<script>window.__ODOO_USER__={user_data}</script>"

    def _inject_user(self, html, user):
        """Expose the authenticated user before Next.js hydration starts."""
        script = self._get_user_script(user)
        if "</head>" in html:
            return html.replace("</head>", f"{script}</head>", 1)
        return html.replace("</body>", f"{script}</body>", 1)

    @http.route(
        ["/document-management", "/document-management/<path:subpath>"],
        type="http",
        auth="user",
        sitemap=False,
    )
    def serve_nextapp(self, subpath="", **kw):
        user = request.env.user

        asset = self._serve_public_asset(subpath)
        if asset is not None:
            return asset

        is_next_metadata = subpath.endswith(".txt")
        html_path = subpath if is_next_metadata else (f"{subpath}/index.html" if subpath else "index.html")
        html = self._read_html(html_path)

        if html is None:
            html = self._read_html("index.html")
            is_next_metadata = False
            if html is None:
                return request.make_response(
                    "Next.js build not found. Run "
                    + "`cd cleon_document_management/next-app && npm run deploy`.",
                    headers=[("Content-Type", "text/html; charset=utf-8")],
                    status=404,
                )

        # Only HTML documents can receive the browser user bootstrap script.
        injected = html if is_next_metadata else self._inject_user(html, user)
        content_type = "text/plain; charset=utf-8" if is_next_metadata else "text/html; charset=utf-8"

        return request.make_response(
            injected,
            headers=[("Content-Type", content_type)],
        )

    @http.route(
        "/api/me",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def api_me(self, **kwargs):
        try:
            user = request.env.user
            return {
                "success": True,
                "data": {
                    "id": user.id,
                    "name": user.name or "",
                    "email": user.email or user.login or "",
                    "company_id": user.company_id.id if user.company_id else False,
                    "company_name": user.company_id.name if user.company_id else "",
                    "tz": user.tz or "",
                    "is_admin": user.has_group("base.group_system"),
                    "is_document_manager": user.has_group(
                        "cleon_document_management.group_document_manager"
                    ),
                    "groups": user.groups_id.mapped("name"),
                },
            }
        except Exception as e:
            _logger.exception("Error in /api/me: %s", e)
            return {"success": False, "message": str(e)}

    @http.route("/api/admin-attention", type="json", auth="user", methods=["POST"], csrf=False)
    def api_admin_attention(self, **kwargs):
        """In-app attention items for managers; separate from Odoo's chatter UI."""
        user = request.env.user
        if not user.has_group("cleon_document_management.group_document_manager"):
            return {"success": True, "data": {"count": 0, "notifications": []}}
        approvals = request.env["doc.document.approval"].search(
            [("state", "in", ["pending", "waiting"]), "|", ("approver_id", "=", user.id), ("document_id.folder_id.require_upload_approval", "=", True)],
            order="create_date desc",
        )
        items = []
        for approval in approvals:
            document = approval.document_id
            employee = document.employee_id.name if document.employee_id else "an employee"
            message = f"Hello {user.name}, your attention is required to approve or reject {employee} file they just uploaded."
            items.append({"id": approval.id, "document_id": document.id, "employee_id": document.employee_id.id or 0, "document": document.name, "employee": employee, "message": message, "created_at": approval.create_date})
        return {"success": True, "data": {"count": len(items), "notifications": items}}

    @http.route(
        "/api/admin-approval-inbox",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def api_admin_approval_inbox(self, **kwargs):
        """Return approval tasks that are ready for the current manager's decision."""
        user = request.env.user
        if not user.has_group("cleon_document_management.group_document_manager"):
            return {"success": True, "data": {"count": 0, "items": []}}

        approvals = request.env["doc.document.approval"].search(
            [
                ("approver_id", "=", user.id),
                ("state", "=", "pending"),
                ("document_id.active", "=", True),
                ("document_id.deleted_at", "=", False),
            ],
            order="create_date desc, sequence asc",
        )
        items = []
        for approval in approvals:
            document = approval.document_id
            if not document.exists():
                continue
            employee = document.employee_id.name if document.employee_id else "Organization"
            items.append(
                {
                    "id": approval.id,
                    "approval_id": approval.id,
                    "document_id": document.id,
                    "employee_id": document.employee_id.id if document.employee_id else 0,
                    "document": document.name,
                    "document_type": document.document_type_id.name,
                    "employee": employee,
                    "folder_id": document.folder_id.id,
                    "folder_type": document.folder_id.folder_type,
                    "sequence": approval.sequence,
                    "state": approval.state,
                    "message": f"{employee} submitted {document.name} for your approval.",
                    "created_at": approval.create_date,
                }
            )
        return {"success": True, "data": {"count": len(items), "items": items}}

    @http.route(
        "/api/dashboard-stats", type="json", auth="user", methods=["POST"], csrf=False
    )
    def api_dashboard_stats(self, **kwargs):
        env = request.env
        data = {
            "total_documents": env["doc.document"].search_count([]),
            "total_folders": env["doc.folder"].search_count(
                [("active", "=", True), ("folder_type", "=", "organizational")]
            ),
            "total_policies": env["doc.compliance.policy"].search_count(
                [("active", "=", True)]
            ),
            "total_exceptions": env["doc.compliance.exception"].search_count([]),
            "expiring_documents": env["doc.document"].search_count(
                [
                    ("has_expiry", "=", True),
                    (
                        "expiry_date",
                        "<=",
                        fields.Date.add(fields.Date.context_today(env.user), days=30),
                    ),
                    ("state", "=", "approved"),
                ]
            ),
            "pending_approvals": env["doc.document.approval"].search_count(
                [
                    ("state", "=", "pending"),
                    ("approver_id", "=", env.user.id),
                ]
            ),
        }
        return {"success": True, "data": data}
