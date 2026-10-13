from odoo import SUPERUSER_ID, api


def migrate(cr, version):
    env = api.Environment(cr, SUPERUSER_ID, {})
    catalog = env.get("doc.document.catalog.service")
    if not catalog:
        return
    catalog.migrate_legacy_global_catalog_to_companies()
    catalog.ensure_all_companies()
