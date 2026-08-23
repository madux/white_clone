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
    def get_apps(self, employee_mode=False):
        """
        Return menus tagged with a CleonHR category, grouped the same
        way /maacherp/landing groups them: a list of categories, each
        with a colour and its app_items (including children/features).
        """
        access = None
        if 'cleon.time.policy' in request.env:
            try:
                access = request.env['cleon.time.policy'].get_cleon_access()
            except Exception:
                _logger.exception("Could not resolve CleonHR employee launcher access")

        use_employee_launcher = bool(employee_mode) or bool(access and not access.get('is_manager'))
        if use_employee_launcher and access:
            return self._employee_apps(access)

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

    def _employee_apps(self, access):
        """Return the same launcher structure with employee-safe destinations."""
        env = request.env
        items = []

        portal_menu = env.ref('white_clone_portal.menu_white_clone_portal_root', raise_if_not_found=False)
        portal_action = env.ref('white_clone_portal.action_employee_portal_home', raise_if_not_found=False)
        if access.get('portal_enabled') and portal_menu and portal_action:
            items.append({
                "id": portal_menu.id,
                "name": portal_menu.name,
                "description": "Employee self-service home",
                "icon": "/home_menu/get_icon/%s" % portal_menu.id if portal_menu.web_icon_data else False,
                "icon_class": portal_menu.icon_class or "fa fa-user-circle-o",
                "icon_color": portal_menu.icon_color or "#EC4899",
                "url": "/web#action=%s" % portal_action.id,
                "children": [],
            })

        portal_modules = access.get('portalModules') or {}
        if portal_modules.get('leave'):
            leave_action = env.ref('hr_leave_dashboard.action_hr_leave_employee_dashboard', raise_if_not_found=False)
            if leave_action:
                items.append({
                    "id": "employee-leave",
                    "name": "Leave Management",
                    "description": "Leave requests, balances, and calendar",
                    "icon": False,
                    "icon_class": "fa fa-calendar",
                    "icon_color": "#F97316",
                    "url": "/web#action=%s" % leave_action.id,
                    "children": [],
                })

        if portal_modules.get('time'):
            time_action = env.ref('hr_time_management.action_employee_time_management', raise_if_not_found=False)
            if time_action:
                enabled = [name.replace('_app_available', '').replace('_', ' ').title()
                           for name, enabled in (access.get('featureAccess') or {}).items()
                           if enabled and name in ('attendance', 'shift', 'tracking', 'overtime')]
                items.append({
                    "id": "employee-time",
                    "name": "Time Management",
                    "description": ", ".join(enabled) or "Time and attendance",
                    "icon": False,
                    "icon_class": "fa fa-clock-o",
                    "icon_color": "#8B5CF6",
                    "url": "/web#action=%s" % time_action.id,
                    "children": [],
                })

        return {
            "categories": [{
                "name": "Employee Apps",
                "color": ICON_PALETTE[0],
                "app_items": items,
            }],
            "total_modules": len(items),
            "total_features": len(items),
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
