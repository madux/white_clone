from odoo import SUPERUSER_ID, api


def migrate(cr, version):
    env = api.Environment(cr, SUPERUSER_ID, {})
    from odoo.addons.cleon_document_management.hooks import _sync_document_user_groups

    _sync_document_user_groups(env)
