# -*- coding: utf-8 -*-
from odoo import _
from odoo.exceptions import AccessError
from odoo.http import request

GROUP_DOCUMENT_MANAGER = "cleon_document_management.group_document_manager"
GROUP_DOCUMENT_ADMIN = "cleon_document_management.group_document_admin"
GROUP_SYSTEM = "base.group_system"


def user_is_document_manager(user):
    return user.has_group(GROUP_SYSTEM) or user.has_group(GROUP_DOCUMENT_MANAGER)


def user_is_document_admin(user):
    return user.has_group(GROUP_SYSTEM) or user.has_group(GROUP_DOCUMENT_ADMIN)


def require_document_manager():
    if not user_is_document_manager(request.env.user):
        raise AccessError(_("Document manager access is required."))


def require_document_admin():
    if not user_is_document_admin(request.env.user):
        raise AccessError(_("Document administrator access is required."))
