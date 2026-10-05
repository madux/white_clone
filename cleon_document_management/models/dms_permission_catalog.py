# -*- coding: utf-8 -*-
"""Unified DMS permission catalog for the six canonical module roles."""

MODULE_ACCESS_KEYS = (
    "access_dms_module",
    "view_employee_files",
    "view_compliance",
    "view_templates_forms",
    "view_workspace_activity",
)

EF_PERMISSION_KEYS = (
    "ef_view",
    "ef_upload",
    "ef_approve",
    "ef_download",
    "ef_archive",
    "ef_delete",
    "ef_export",
    "ef_manage_ef_settings",
)

COMPLIANCE_PERMISSION_KEYS = (
    "compliance_view",
    "compliance_manage_policies",
    "compliance_run_evaluations",
    "compliance_manage_exceptions",
    "compliance_export",
)

TEMPLATES_PERMISSION_KEYS = (
    "templates_view",
    "templates_create_edit",
    "templates_assign",
    "templates_export",
)

SETTINGS_PERMISSION_KEYS = (
    "manage_document_types",
    "manage_retention_lifecycle",
    "manage_ef_tenant_config",
    "manage_org_tenant_config",
    "assign_dms_roles",
)

ORG_PERMISSION_KEYS = (
    "view_org_files",
    "create_folder",
    "create_folder_without_approval",
    "create_collection",
    "upload_link_import_scan",
    "upload_without_approval",
    "edit_rename_description_colour",
    "edit_without_approval",
    "replace_version",
    "replace_version_without_approval",
    "move",
    "move_without_approval",
    "approve_reject_requests",
    "share_manage_access",
    "assign_document",
    "lock_unlock",
    "archive_restore",
    "delete",
    "delete_without_approval",
    "permanent_delete",
    "delete_protected_override",
    "place_release_legal_hold",
    "external_share_password_watermark",
    "add_policy",
    "activate_archive_policy",
    "assign_policy_ack_sign",
    "view_hr_only_policies",
    "acknowledge_sign_assigned_policy",
    "automate",
    "view_audit_activity",
    "is_super_admin",
)

DMS_PERMISSION_KEYS = (
    *MODULE_ACCESS_KEYS,
    *EF_PERMISSION_KEYS,
    *COMPLIANCE_PERMISSION_KEYS,
    *TEMPLATES_PERMISSION_KEYS,
    *SETTINGS_PERMISSION_KEYS,
    *ORG_PERMISSION_KEYS,
)

ROLE_TEMPLATE_KEYS = (
    "super_admin",
    "hr_admin",
    "folder_policy_manager",
    "department_user",
    "employee",
    "auditor",
    "custom",
)

CANONICAL_ORG_ROLE_TEMPLATE_KEYS = (
    "super_admin",
    "hr_admin",
    "folder_policy_manager",
    "department_user",
    "employee",
    "auditor",
)

EF_FIELD_TO_DMS_KEY = {
    "action_view": "ef_view",
    "action_upload": "ef_upload",
    "action_approve": "ef_approve",
    "action_download": "ef_download",
    "action_archive": "ef_archive",
    "action_delete": "ef_delete",
    "action_export": "ef_export",
    "action_manage_settings": "ef_manage_ef_settings",
}

LEGACY_ORG_ACTION_MAP = {
    "access_library": ("view_org_files",),
    "create_folder": ("create_folder", "create_folder_without_approval"),
    "manage_folders": (
        "edit_rename_description_colour",
        "edit_without_approval",
        "lock_unlock",
    ),
    "share_manage_access": ("share_manage_access",),
    "folder_archive": ("archive_restore",),
    "folder_delete": ("delete", "delete_without_approval"),
    "upload": ("upload_link_import_scan", "upload_without_approval"),
    "document_manage": (
        "edit_rename_description_colour",
        "move",
        "replace_version",
        "automate",
        "add_policy",
        "assign_policy_ack_sign",
    ),
    "document_manage_access": ("share_manage_access", "assign_document"),
    "document_delete": ("delete", "delete_without_approval"),
}

ORG_ACTION_API_KEYS = {
    "org_access_library": "access_library",
    "org_create_folder": "create_folder",
    "org_manage_folders": "manage_folders",
    "org_share_manage_access": "share_manage_access",
    "org_folder_archive": "folder_archive",
    "org_folder_delete": "folder_delete",
    "org_upload": "upload",
    "org_document_manage": "document_manage",
    "org_document_manage_access": "document_manage_access",
    "org_document_delete": "document_delete",
}

ORG_FIELD_NAMES = tuple(ORG_ACTION_API_KEYS.keys())

LEGACY_FIELD_TO_API = {
    "org_access_library": "access_library",
    "org_create_folder": "create_folder",
    "org_manage_folders": "manage_folders",
    "org_share_manage_access": "share_manage_access",
    "org_folder_archive": "folder_archive",
    "org_folder_delete": "folder_delete",
    "org_upload": "upload",
    "org_document_manage": "document_manage",
    "org_document_delete": "document_delete",
    "org_document_manage_access": "document_manage_access",
}

ORG_TEMPLATE_DISPLAY_NAMES = {
    "super_admin": "Super Admin",
    "hr_admin": "HR Admin",
    "folder_policy_manager": "Folder / Policy Manager",
    "department_user": "Department User",
    "employee": "Employee",
    "auditor": "Auditor",
}

TEMPLATE_EMPLOYEE_SCOPE = {
    "super_admin": "all",
    "hr_admin": "all",
    "folder_policy_manager": "all",
    "department_user": "department",
    "employee": "own_team",
    "auditor": "all",
}


def empty_dms_permissions():
    return {key: False for key in DMS_PERMISSION_KEYS}


def dms_permissions_from_api_payload(raw):
    """Normalize a partial permissions dict from the API into a full DMS map."""
    merged = empty_dms_permissions()
    if not raw:
        return merged
    for key in DMS_PERMISSION_KEYS:
        if key in raw:
            merged[key] = bool(raw.get(key))
    return merged


def empty_org_permissions():
    return {key: False for key in ORG_PERMISSION_KEYS}


def _merge(**kwargs):
    base = empty_dms_permissions()
    for key, value in kwargs.items():
        if key in base:
            base[key] = bool(value)
    return base


_ALL_EF = {
    "ef_view": True,
    "ef_upload": True,
    "ef_approve": True,
    "ef_download": True,
    "ef_archive": True,
    "ef_delete": True,
    "ef_export": True,
    "ef_manage_ef_settings": True,
}
_ALL_COMPLIANCE = {k: True for k in COMPLIANCE_PERMISSION_KEYS}
_ALL_TEMPLATES = {k: True for k in TEMPLATES_PERMISSION_KEYS}
_ALL_SETTINGS = {k: True for k in SETTINGS_PERMISSION_KEYS}

DMS_ROLE_TEMPLATE_DEFAULTS = {
    "super_admin": _merge(
        access_dms_module=True,
        view_employee_files=True,
        view_compliance=True,
        view_templates_forms=True,
        view_workspace_activity=True,
        **_ALL_EF,
        **_ALL_COMPLIANCE,
        **_ALL_TEMPLATES,
        **_ALL_SETTINGS,
        view_org_files=True,
        create_folder=True,
        create_folder_without_approval=True,
        create_collection=True,
        upload_link_import_scan=True,
        upload_without_approval=True,
        edit_rename_description_colour=True,
        edit_without_approval=True,
        replace_version=True,
        replace_version_without_approval=True,
        move=True,
        move_without_approval=True,
        approve_reject_requests=True,
        share_manage_access=True,
        assign_document=True,
        lock_unlock=True,
        archive_restore=True,
        delete=True,
        delete_without_approval=True,
        permanent_delete=True,
        delete_protected_override=True,
        place_release_legal_hold=True,
        external_share_password_watermark=True,
        add_policy=True,
        activate_archive_policy=True,
        assign_policy_ack_sign=True,
        view_hr_only_policies=True,
        automate=True,
        view_audit_activity=True,
        is_super_admin=True,
    ),
    "hr_admin": _merge(
        access_dms_module=True,
        view_employee_files=True,
        view_compliance=True,
        view_templates_forms=True,
        view_workspace_activity=True,
        **_ALL_EF,
        compliance_view=True,
        compliance_manage_policies=True,
        compliance_run_evaluations=True,
        compliance_manage_exceptions=True,
        compliance_export=True,
        templates_view=True,
        templates_assign=True,
        templates_export=True,
        view_org_files=True,
        create_folder=True,
        create_folder_without_approval=True,
        create_collection=True,
        upload_link_import_scan=True,
        upload_without_approval=True,
        edit_rename_description_colour=True,
        edit_without_approval=True,
        replace_version=True,
        replace_version_without_approval=True,
        move=True,
        move_without_approval=True,
        approve_reject_requests=True,
        share_manage_access=True,
        assign_document=True,
        lock_unlock=True,
        archive_restore=True,
        delete=True,
        delete_without_approval=True,
        place_release_legal_hold=True,
        external_share_password_watermark=True,
        add_policy=True,
        activate_archive_policy=True,
        assign_policy_ack_sign=True,
        view_hr_only_policies=True,
        automate=True,
        view_audit_activity=True,
    ),
    "folder_policy_manager": _merge(
        access_dms_module=True,
        view_employee_files=True,
        view_compliance=True,
        view_templates_forms=True,
        view_workspace_activity=True,
        ef_view=True,
        ef_download=True,
        compliance_view=True,
        templates_view=True,
        templates_create_edit=True,
        view_org_files=True,
        create_folder=True,
        upload_link_import_scan=True,
        upload_without_approval=True,
        edit_rename_description_colour=True,
        replace_version=True,
        move=True,
        share_manage_access=True,
        assign_document=True,
        lock_unlock=True,
        archive_restore=True,
        delete=True,
        add_policy=True,
        assign_policy_ack_sign=True,
        view_hr_only_policies=True,
        automate=True,
        view_audit_activity=True,
    ),
    "department_user": _merge(
        access_dms_module=True,
        view_employee_files=True,
        view_compliance=True,
        view_workspace_activity=True,
        ef_view=True,
        ef_upload=True,
        ef_download=True,
        ef_approve=True,
        compliance_view=True,
        view_org_files=True,
        upload_link_import_scan=True,
        approve_reject_requests=True,
    ),
    "employee": _merge(
        access_dms_module=True,
        ef_view=True,
        ef_upload=True,
        ef_download=True,
        acknowledge_sign_assigned_policy=True,
    ),
    "auditor": _merge(
        access_dms_module=True,
        view_employee_files=True,
        view_compliance=True,
        view_templates_forms=True,
        view_workspace_activity=True,
        ef_view=True,
        ef_download=True,
        compliance_view=True,
        templates_view=True,
        view_org_files=True,
        view_hr_only_policies=True,
        view_audit_activity=True,
    ),
}

# Backward-compatible alias
ORG_ROLE_TEMPLATE_DEFAULTS = {
    key: {k: v for k, v in perms.items() if k in ORG_PERMISSION_KEYS}
    for key, perms in DMS_ROLE_TEMPLATE_DEFAULTS.items()
}


def dms_permissions_from_role_record(role):
    """Build full DMS map from role (dms_permissions, org_permissions, lines, legacy)."""
    stored = role.dms_permissions or {}
    if not stored:
        stored = role.org_permissions or {}
    if stored:
        merged = empty_dms_permissions()
        for key in DMS_PERMISSION_KEYS:
            if key in stored:
                merged[key] = bool(stored.get(key))
        if any(merged.values()):
            return merged
    perms = empty_dms_permissions()
    org_legacy = permissions_from_legacy_booleans(role)
    for key, val in org_legacy.items():
        perms[key] = val
    for line in role.line_ids:
        for field_name, dms_key in EF_FIELD_TO_DMS_KEY.items():
            if line.action_view and line[field_name]:
                perms[dms_key] = True
    return perms


def permissions_from_legacy_booleans(role):
    perms = empty_org_permissions()
    for field_name, api_key in LEGACY_FIELD_TO_API.items():
        if not role[field_name]:
            continue
        for perm_key in LEGACY_ORG_ACTION_MAP.get(api_key, ()):
            perms[perm_key] = True
    return perms


def sync_legacy_fields_from_permissions(role, perms):
    def any_of(*keys):
        return any(perms.get(k) for k in keys)

    role.org_access_library = any_of("view_org_files")
    role.org_create_folder = any_of("create_folder", "create_folder_without_approval")
    role.org_manage_folders = any_of(
        "edit_rename_description_colour",
        "edit_without_approval",
        "lock_unlock",
    )
    role.org_share_manage_access = any_of("share_manage_access", "assign_document")
    role.org_folder_archive = any_of("archive_restore")
    role.org_folder_delete = any_of("delete", "delete_without_approval")
    role.org_upload = any_of("upload_link_import_scan", "upload_without_approval")
    role.org_document_manage = any_of(
        "edit_rename_description_colour",
        "move",
        "replace_version",
        "automate",
        "add_policy",
    )
    role.org_document_manage_access = any_of("share_manage_access", "assign_document")
    role.org_document_delete = any_of("delete", "delete_without_approval")
