import json
import logging

from odoo import http
from odoo.http import request
from odoo.modules.module import get_resource_path

_logger = logging.getLogger(__name__)


class CrmPortalController(http.Controller):

    # ─────────────────────────────────────────────────────────────
    # HTML PAGE ROUTE
    # ─────────────────────────────────────────────────────────────
    @http.route('/landing', type='http', auth='user')
    def show_html_page(self, **kw):
        file_path = get_resource_path(
            'white_clone_portal',
            'static/html',
            'landing_page.html'
        )
        if not file_path:
            return "HTML file not found."

        with open(file_path, 'r', encoding='utf-8') as f:
            html = f.read()

        user = request.env.user
        data = {
            'user_id': user.id if user else False,
            'user_name': user.name if user else False,
            'user_email': user.email if user else False or '',
        }
        return request.make_response(
            html,
            headers=[('Content-Type', 'text/html'), ('defaultData', json.dumps(data))],
        )

    # ─────────────────────────────────────────────────────────────
    # INTERNAL HELPERS
    # ─────────────────────────────────────────────────────────────
    def _resolve_action_url(self, action_xmlid):
        """'module.action_xml_id' -> '/web#action=<id>' or None."""
        if not action_xmlid or action_xmlid == 'xxxxxxxxxx':
            return None
        try:
            action = request.env.ref(action_xmlid, raise_if_not_found=False)
        except ValueError:
            action = False
        if not action:
            return None
        return '/web#action=%s' % action.id

    # ─────────────────────────────────────────────────────────────
    # INIT: STATE + ACTION URL FOR EVERY CARD IN ONE ROUND TRIP
    # ─────────────────────────────────────────────────────────────
    @http.route('/landing/modules/init', type='json', auth='user')
    def get_modules_init(self, modules=None, **kw):
        """
        modules: [{ id, technical_name, action }, ...]
        returns: { <card id>: { installed, state, action_url } }
        """
        modules = modules or []
        technical_names = list({m['technical_name'] for m in modules if m.get('technical_name')})

        IrModule = request.env['ir.module.module'].sudo()
        found = IrModule.search_read(
            [('name', 'in', technical_names)],
            ['name', 'state']
        )
        state_by_name = {m['name']: m['state'] for m in found}

        result = {}
        for card in modules:
            name = card.get('technical_name')
            state = state_by_name.get(name, 'uninstalled')
            installed = state == 'installed'
            result[card['id']] = {
                'state': state,
                'installed': installed,
                'action_url': self._resolve_action_url(card.get('action')) if installed else None,
            }
        return result

    # ─────────────────────────────────────────────────────────────
    # INSTALL A MODULE, THEN RESOLVE ITS ACTION
    # ─────────────────────────────────────────────────────────────
    @http.route('/landing/module/install', type='json', auth='user')
    def install_module(self, technical_name=None, action_xmlid=None, **kw):
        if not technical_name:
            return {'success': False, 'error': 'No module technical name provided.'}

        if not request.env.user.has_group('base.group_system'):
            return {'success': False, 'error': 'You do not have the rights to install modules.'}

        IrModule = request.env['ir.module.module'].sudo()
        module = IrModule.search([('name', '=', technical_name)], limit=1)

        if not module:
            return {'success': False, 'error': 'Module "%s" not found.' % technical_name}

        if module.state == 'installed':
            return {
                'success': True,
                'already_installed': True,
                'action_url': self._resolve_action_url(action_xmlid),
            }

        try:
            module.button_immediate_install()
        except Exception as e:
            _logger.exception('Failed installing module %s', technical_name)
            return {'success': False, 'error': str(e)}

        module = IrModule.search([('name', '=', technical_name)], limit=1)  # refresh
        return {
            'success': True,
            'state': module.state,
            'action_url': self._resolve_action_url(action_xmlid),
        }