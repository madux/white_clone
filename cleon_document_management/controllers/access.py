# -*- coding: utf-8 -*-
from odoo import _
from odoo.exceptions import AccessError
from odoo.http import request

GROUP_DOCUMENT_MANAGER = "cleon_document_management.group_document_manager"
GROUP_DOCUMENT_ADMIN = "cleon_document_management.group_document_admin"
GROUP_SYSTEM = "base.group_system"


def _permission(env=None):
    env = env or request.env
    return env["doc.employee.files.permission"]


def _dms(env=None):
    env = env or request.env
    return env["doc.dms.permission"]


def user_is_document_admin(user):
    env = getattr(user, "env", None) or request.env
    return _dms(env).user_is_platform_admin(user)


def user_is_document_manager(user, env=None):
    """Operational DMS access (legacy API name)."""
    env = env or getattr(user, "env", None) or request.env
    dms = _dms(env)
    if dms.user_is_odoo_break_glass_admin(user):
        return True
    if user.has_group(GROUP_DOCUMENT_MANAGER):
        return True
    return (
        dms.user_has_dms_permission(user, "view_employee_files")
        or dms.user_has_dms_permission(user, "view_org_files")
        or _permission(env).user_can_access_ef_home(user)
    )


def user_employee_files_permissions(user, env=None):
    env = env or getattr(user, "env", None) or request.env
    return _permission(env).serialize_user_permissions(user)


def _org_permission(env=None):
    env = env or request.env
    return env["doc.organizational.files.permission"]


def user_organizational_files_permissions(user, env=None):
    env = env or getattr(user, "env", None) or request.env
    return _org_permission(env).serialize_user_permissions(user)


def user_can_access_org_library(user, env=None):
    env = env or getattr(user, "env", None) or request.env
    return _org_permission(env).user_can_access_org_library(user)


def user_can_access_workspace_activity(user, env=None):
    env = env or getattr(user, "env", None) or request.env
    return user_is_document_manager(user, env) or user_can_access_org_library(
        user, env
    )


def require_document_manager():
    if not user_is_document_manager(request.env.user):
        raise AccessError(_("Employee Files access is required."))


def require_document_admin():
    _dms().require_super_admin(request.env.user)


def require_manage_document_types():
    user = request.env.user
    if not (
        _dms().user_has_dms_permission(user, "manage_document_types")
        or _dms().user_is_odoo_break_glass_admin(user)
    ):
        raise AccessError(_("Super Admin access is required to manage document types."))


def require_manage_retention_lifecycle():
    user = request.env.user
    if not (
        _dms().user_has_dms_permission(user, "manage_retention_lifecycle")
        or _dms().user_is_odoo_break_glass_admin(user)
    ):
        raise AccessError(_("Super Admin access is required to manage retention settings."))


def require_manage_ef_tenant_config():
    user = request.env.user
    if not (
        _dms().user_has_dms_permission(user, "manage_ef_tenant_config")
        or _dms().user_is_odoo_break_glass_admin(user)
    ):
        raise AccessError(_("Super Admin access is required for Employee Files settings."))


def require_manage_org_tenant_config():
    user = request.env.user
    if not (
        _dms().user_has_dms_permission(user, "manage_org_tenant_config")
        or _dms().user_is_odoo_break_glass_admin(user)
    ):
        raise AccessError(_("Super Admin access is required for Organisational Files settings."))


_SETTINGS_PANEL_KEYS = (
    "manage_document_types",
    "manage_retention_lifecycle",
    "manage_ef_tenant_config",
    "manage_org_tenant_config",
    "assign_dms_roles",
    "is_super_admin",
)


def user_can_access_settings_panel(user):
    if _dms().user_is_odoo_break_glass_admin(user):
        return True
    return any(
        _dms().user_has_dms_permission(user, key) for key in _SETTINGS_PANEL_KEYS
    )


def settings_panel_access_message():
    if user_can_access_settings_panel(request.env.user):
        return None
    return _("Super Admin access is required.")


def require_compliance_manage():
    user = request.env.user
    if not (
        _dms().user_has_dms_permission(user, "compliance_manage_policies")
        or _dms().user_is_odoo_break_glass_admin(user)
    ):
        raise AccessError(_("Compliance policy management is required."))


def require_compliance_view():
    user = request.env.user
    if not (
        _dms().user_has_dms_permission(user, "compliance_view")
        or _dms().user_is_odoo_break_glass_admin(user)
    ):
        raise AccessError(_("Compliance access is required."))


def require_compliance_export():
    user = request.env.user
    if not (
        _dms().user_has_dms_permission(user, "compliance_export")
        or _dms().user_is_odoo_break_glass_admin(user)
    ):
        raise AccessError(_("Compliance export access is required."))


def require_compliance_run():
    user = request.env.user
    if not (
        _dms().user_has_dms_permission(user, "compliance_run_evaluations")
        or _dms().user_is_odoo_break_glass_admin(user)
    ):
        raise AccessError(_("Compliance evaluation access is required."))


def require_ef_action_on_document(document, action_key):
    _permission().require_document_action(request.env.user, document, action_key)


def require_ef_action_on_employee(employee, action_key):
    _permission().require_employee_action(request.env.user, employee, action_key)
