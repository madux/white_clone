import json
import logging
import os

from odoo import http
from odoo.http import request
from odoo.tools.misc import file_path

_logger = logging.getLogger(__name__)

MODULE = "cleon_company_documentary"
NEXTAPP_STATIC_DIR = "static/src/nextapp"


class CompanyDocumentaryNextAppController(http.Controller):
    """Serve the exported Company Documentary Next.js application."""

    @staticmethod
    def _read_html(relative_path):
        try:
            absolute_path = file_path(f"{MODULE}/{NEXTAPP_STATIC_DIR}/{relative_path}")
        except FileNotFoundError:
            return None
        if absolute_path and os.path.isfile(absolute_path):
            with open(absolute_path, "r", encoding="utf-8") as stream:
                return stream.read()
        return None

    @staticmethod
    def _user_is_documentary_manager(user):
        return (
            user.has_group("base.group_system")
            or user.has_group("cleon_company_documentary.group_company_documentary_manager")
        )

    @staticmethod
    def _user_is_documentary_admin(user):
        return (
            user.has_group("base.group_system")
            or user.has_group("cleon_company_documentary.group_company_documentary_admin")
        )

    @staticmethod
    def _user_script(user):
        user_data = json.dumps({
            "user_id": user.id,
            "user_name": user.name or "",
            "user_email": user.email or user.login or "",
            "company_name": user.company_id.name if user.company_id else "",
            "is_admin": user.has_group("base.group_system"),
            "is_documentary_manager": CompanyDocumentaryNextAppController._user_is_documentary_manager(user),
            "is_documentary_admin": CompanyDocumentaryNextAppController._user_is_documentary_admin(user),
        })
        return f"<script>window.__ODOO_USER__={user_data}</script>"

    def _inject_user(self, html, user):
        script = self._user_script(user)
        if "</head>" in html:
            return html.replace("</head>", f"{script}</head>", 1)
        return html.replace("</body>", f"{script}</body>", 1)

    @http.route(
        ["/company-documentary", "/company-documentary/<path:subpath>"],
        type="http",
        auth="user",
        sitemap=False,
    )
    def serve_nextapp(self, subpath="", **kwargs):
        user = request.env.user
        is_next_metadata = subpath.endswith(".txt")
        html_path = subpath if is_next_metadata else (
            f"{subpath}/index.html" if subpath else "index.html"
        )
        html = self._read_html(html_path)

        if html is None:
            html = self._read_html("index.html")
            is_next_metadata = False
            if html is None:
                return request.make_response(
                    "Next.js build not found. Run "
                    + "`cd cleon_company_documentary/next-app && npm run deploy`.",
                    headers=[("Content-Type", "text/html; charset=utf-8")],
                    status=404,
                )

        injected = html if is_next_metadata else self._inject_user(html, user)
        content_type = (
            "text/plain; charset=utf-8"
            if is_next_metadata
            else "text/html; charset=utf-8"
        )
        return request.make_response(injected, headers=[("Content-Type", content_type)])

    @http.route(
        "/api/company-documentary/me",
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
                    "company_name": user.company_id.name if user.company_id else "",
                    "is_admin": user.has_group("base.group_system"),
                    "is_documentary_manager": self._user_is_documentary_manager(user),
                    "is_documentary_admin": self._user_is_documentary_admin(user),
                },
            }
        except Exception as error:
            _logger.exception("Error in Company Documentary /api/me: %s", error)
            return {"success": False, "message": str(error)}
