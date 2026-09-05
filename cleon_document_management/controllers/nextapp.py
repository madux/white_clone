import json
import os
import logging
import urllib.request
import urllib.error
from odoo import http, fields
from odoo.http import request
from odoo.tools.misc import file_path

_logger = logging.getLogger(__name__)

MODULE = "cleon_document_management"
NEXTAPP_STATIC_DIR = "static/src/nextapp"
NEXT_DEV_SERVER = "http://localhost:3030"


class NextAppController(http.Controller):
    """
    Serves Next.js frontend mounted at /document-management.

    - In Dev Mode (NEXTAPP_DEV environment variable set):
      Proxies requests live to Next.js dev server at http://localhost:3030 for HMR.
    - In Production Mode:
      Serves static exported HTML from static/src/nextapp.
    """

    @staticmethod
    def _read_html(relative_path):
        """Read a pre-built HTML file; return None if missing."""
        abs_path = file_path(f"{MODULE}/{NEXTAPP_STATIC_DIR}/{relative_path}")
        if abs_path and os.path.isfile(abs_path):
            with open(abs_path, "r", encoding="utf-8") as f:
                return f.read()
        return None

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

        if os.getenv("NEXTAPP_DEV"):
            target_url = f"{NEXT_DEV_SERVER}/document-management/{subpath}".rstrip("/")
            if not subpath:
                target_url = f"{NEXT_DEV_SERVER}/document-management"

            # Forward cookies to preserve session
            headers = {"Cookie": request.httprequest.headers.get("Cookie", "")}
            req = urllib.request.Request(target_url, headers=headers)

            try:
                with urllib.request.urlopen(req, timeout=5) as resp:
                    content_type = resp.headers.get("Content-Type", "text/html")
                    content = resp.read()

                    # Inject __ODOO_USER__ into HTML pages in Dev Mode
                    if "text/html" in content_type:
                        html_str = content.decode("utf-8", errors="ignore")
                        html_str = self._inject_user(html_str, user)
                        content = html_str.encode("utf-8")

                    return request.make_response(
                        content,
                        headers=[("Content-Type", content_type)],
                    )
            except Exception as e:
                _logger.warning("Next.js dev server error: %s", e)
                return request.make_response(
                    f"<h2>Next.js Dev Server not reachable at {NEXT_DEV_SERVER}</h2>"
                    f"<p>Run <code>npm run dev</code> inside <code>next-app</code> folder.</p>",
                    headers=[("Content-Type", "text/html; charset=utf-8")],
                    status=502,
                )

        html_path = f"{subpath}/index.html" if subpath else "index.html"
        html = self._read_html(html_path)

        if html is None:
            html = self._read_html("index.html")
            if html is None:
                return request.make_response(
                    "Next.js build not found. Run "
                    + "`cd cleon_document_management/next-app && npm run deploy`.",
                    headers=[("Content-Type", "text/html; charset=utf-8")],
                    status=404,
                )

        # Inject __ODOO_USER__ into static HTML
        injected = self._inject_user(html, user)

        return request.make_response(
            injected,
            headers=[("Content-Type", "text/html; charset=utf-8")],
        )

    @http.route(
        "/api/me",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
        cors="http://localhost:3030",
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
            return {"success": True, "data": {"count": 0, "notifications": [], "mailbox": []}}
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
        return {"success": True, "data": {"count": len(items), "notifications": items, "mailbox": items}}

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
                        fields.Date.add(fields.Date.context_today(env), days=30),
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
