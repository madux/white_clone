# -*- coding: utf-8 -*-
"""Backward-compatible re-exports; canonical catalog is dms_permission_catalog."""

from .dms_permission_catalog import (
    CANONICAL_ORG_ROLE_TEMPLATE_KEYS,
    DMS_PERMISSION_KEYS,
    DMS_ROLE_TEMPLATE_DEFAULTS,
    LEGACY_FIELD_TO_API,
    LEGACY_ORG_ACTION_MAP,
    ORG_ACTION_API_KEYS,
    ORG_FIELD_NAMES,
    ORG_PERMISSION_KEYS,
    ORG_ROLE_TEMPLATE_DEFAULTS,
    ORG_TEMPLATE_DISPLAY_NAMES,
    ROLE_TEMPLATE_KEYS,
    empty_org_permissions,
    permissions_from_legacy_booleans,
    sync_legacy_fields_from_permissions,
)

# Legacy helper used by older code paths
def _t(**kwargs):
    base = empty_org_permissions()
    for key, value in kwargs.items():
        if key in base:
            base[key] = bool(value)
    return base
