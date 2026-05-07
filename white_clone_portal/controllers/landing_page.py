# -*- coding: utf-8 -*-
import json
import logging
from odoo import http
from odoo import fields
from odoo.http import request
from odoo.tools import file_path
from odoo.modules.module import get_resource_path

_logger = logging.getLogger(__name__)


class CrmPortalController(http.Controller):

    # ─────────────────────────────────────────────────────────────
    # HTML PAGE ROUTES
    # ─────────────────────────────────────────────────────────────
    @http.route('/landing', type='http', auth='user')
    def show_html_page(self, **kw):
        # Get actual file path inside the module
        # html_path = '/white_clone_portal/static/html/landing_page.html'
        file_path = get_resource_path(
            'white_clone_portal',  # your module name
            'static/html',          # folder path inside module
            'landing_page.html'          # file name
        )
        if not file_path:
            return "HTML file not found."

        # Read HTML file content
        with open(file_path, 'r', encoding='utf-8') as f:
            html = f.read()
        user = request.env.user
        data = {
            'user_id':   user.id,
            'user_name': user.name,
            'user_email': user.email or '',
        }
        # Return raw HTML content
        return request.make_response(
            html,
            headers=[('Content-Type', 'text/html'),('defaultData', json.dumps(data))],
            
        )