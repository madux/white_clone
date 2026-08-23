# -*- coding: utf-8 -*-
import base64
from odoo import http
from odoo.http import request

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
    def get_apps(self, employee_mode=False):
        """
        Return the current user's visible CleonHR application menus.

        Employee/admin interface mode controls how an application renders;
        it must never replace the global launcher or grant/revoke menu access.
        Odoo menu groups remain the single source of truth for visibility.

        ``employee_mode`` is accepted temporarily for compatibility with a
        browser that still has the previous asset bundle cached, but ignored.
        """
        menu_model = request.env['ir.ui.menu']
        visible_menu_ids = menu_model._visible_menu_ids()
        menus = menu_model.sudo().search([
            ('id', 'in', list(visible_menu_ids)),
            ('action', '!=', False),
            ('category_name', 'ilike', 'CleonHR'),
        ], order='sequence, id')

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
                if child.action and child.id in visible_menu_ids
            ]

            total_modules += 1
            total_features += len(children) if children else 1

            categories[category_name].append({
                "id": menu.id,
                "name": menu.name,
                "description": getattr(menu, 'description', False) or (
                    "%s tools and workflows" % menu.name
                ),
                "icon": "/home_menu/get_icon/%s" % menu.id if menu.web_icon_data else False,
                "icon_class": getattr(menu, 'icon_class', False) or "fa fa-th-large",
                "icon_color": getattr(menu, 'icon_color', False) or "#64748B",
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
