# -*- coding: utf-8 -*-
from odoo import SUPERUSER_ID, api


def migrate(cr, version):
    """Repair policy/native approval mismatches for future submissions."""
    env = api.Environment(cr, SUPERUSER_ID, {})
    env["hr.leave.type"].with_context(active_test=False).search([])._sync_native_validation_from_policies()
