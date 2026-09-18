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


def user_is_document_admin(user):
    return user.has_group(GROUP_SYSTEM) or user.has_group(GROUP_DOCUMENT_ADMIN)


def user_is_document_manager(user, env=None):
    """EF operational access (legacy name retained for API compatibility)."""
    if user.has_group(GROUP_SYSTEM) or user.has_group(GROUP_DOCUMENT_ADMIN):
        return True
    if user.has_group(GROUP_DOCUMENT_MANAGER):
        return True
    env = env or getattr(user, "env", None) or request.env
    return _permission(env).user_can_access_ef_home(user)


def user_employee_files_permissions(user, env=None):
    env = env or getattr(user, "env", None) or request.env
    return _permission(env).serialize_user_permissions(user)


def require_document_manager():
    if not user_is_document_manager(request.env.user):
        raise AccessError(_("Employee Files access is required."))


def require_document_admin():
    if not user_is_document_admin(request.env.user):
        raise AccessError(_("Document administrator access is required."))


def require_ef_action_on_document(document, action_key):
    _permission().require_document_action(request.env.user, document, action_key)


def require_ef_action_on_employee(employee, action_key):
    _permission().require_employee_action(request.env.user, employee, action_key)
