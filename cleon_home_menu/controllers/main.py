# -*- coding: utf-8 -*-
import base64
from odoo import http
from odoo.http import request
import logging

_logger = logging.getLogger(__name__)

# Same palette used in landing.py, cycled per category so the overlay
# and the full landing page render identical colours for the same
# category names.
ICON_PALETTE = [
    "#EC4899",  # pink
    "#10B981",  # teal/green
    "#3B82F6",  # blue
    "#EF4444",  # red
    "#F97316",  # orange
    "#22C55E",  # green
    "#8B5CF6",  # purple
    "#06B6D4",  # cyan
]


class HomeMenuController(http.Controller):

    @http.route('/home_menu/get_apps', type='json', auth='user')
    def get_apps(self):
        """
        Return menus tagged with a CleonHR category, grouped the same
        way /maacherp/landing groups them: a list of categories, each
        with a colour and its app_items (including children/features).
        """
        menus = request.env['ir.ui.menu'].sudo().search([
            ('parent_id', '!=', False),
            ('category_name', 'ilike', 'CleonHR'),
        ])

        categories = {}
        order = []
        total_modules = 0
        total_features = 0

        for menu in menus:
            # category_name is expected as "CLEONHR-<Category>"; fall back
            # to the raw value if it doesn't contain a separator.
            if menu.category_name and '-' in menu.category_name:
                _, category_name = menu.category_name.split('-', 1)
                category_name = category_name.strip()
            else:
                category_name = menu.category_name or 'Apps'

            if category_name not in categories:
                categories[category_name] = []
                order.append(category_name)

            children = [
                {
                    "id": child.id,
                    "name": child.name,
                    "url": "/web#menu_id=%s" % child.id,
                }
                for child in menu.child_id
                if child.action
            ]

            total_modules += 1
            total_features += len(children) if children else 1

            categories[category_name].append({
                "id": menu.id,
                "name": menu.name,
                "description": getattr(menu, 'description', False) or (
                    "%s tools and workflows" % menu.name
                ),
                "icon": menu.web_icon or False,
                "url": "/web#menu_id=%s" % menu.id,
                "children": children,
            })

        apps = []
        for idx, name in enumerate(order):
            apps.append({
                "name": name,
                "color": ICON_PALETTE[idx % len(ICON_PALETTE)],
                "app_items": categories[name],
            })

        return {
            "categories": apps,
            "total_modules": total_modules,
            "total_features": total_features,
        }

    @http.route('/home_menu/get_icon/<int:menu_id>', type='http', auth='user')
    def get_icon(self, menu_id, **kwargs):
        """Serve the raw icon image for a menu if web_icon_data is set."""
        menu = request.env['ir.ui.menu'].sudo().browse(menu_id)
        if menu.exists() and menu.web_icon_data:
            try:
                image_data = base64.b64decode(menu.web_icon_data)
                return request.make_response(
                    image_data,
                    headers=[
                        ('Content-Type', 'image/png'),
                        ('Cache-Control', 'public, max-age=604800'),
                    ]
                )
            except Exception:
                pass
        return request.not_found()