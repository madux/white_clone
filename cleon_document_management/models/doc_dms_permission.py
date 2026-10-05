# -*- coding: utf-8 -*-
from odoo import _, api, models
from odoo.exceptions import AccessError

from .dms_permission_catalog import (
    DMS_PERMISSION_KEYS,
    DMS_ROLE_TEMPLATE_DEFAULTS,
    EF_FIELD_TO_DMS_KEY,
    ORG_ACTION_API_KEYS,
    ORG_FIELD_NAMES,
    ORG_PERMISSION_KEYS,
    SETTINGS_PERMISSION_KEYS,
)


class DocDmsPermission(models.AbstractModel):
    _name = "doc.dms.permission"
    _description = "Unified DMS permission resolver"

    @api.model
    def _ef_permission(self):
        return self.env["doc.employee.files.permission"]

    @api.model
    def user_assigned_roles(self, user):
        return self._ef_permission().user_assigned_roles(user)

    @api.model
    def user_is_odoo_break_glass_admin(self, user):
        return user.has_group("base.group_system") or user.has_group(
            "cleon_document_management.group_document_admin"
        )

    @api.model
    def effective_permissions(self, user):
        if self.user_is_odoo_break_glass_admin(user):
            return {key: True for key in DMS_PERMISSION_KEYS}
        merged = {key: False for key in DMS_PERMISSION_KEYS}
        for role in self.user_assigned_roles(user):
            role_perms = role.get_dms_permissions_dict()
            for key in DMS_PERMISSION_KEYS:
                if role_perms.get(key):
                    merged[key] = True
        return merged

    @api.model
    def user_has_dms_permission(self, user, permission_key):
        if permission_key not in DMS_PERMISSION_KEYS:
            return False
        if self.user_is_odoo_break_glass_admin(user):
            return True
        return bool(self.effective_permissions(user).get(permission_key))

    @api.model
    def user_is_super_admin(self, user):
        if self.user_is_odoo_break_glass_admin(user):
            return True
        return self.user_has_dms_permission(user, "is_super_admin")

    @api.model
    def user_is_platform_admin(self, user):
        """Tenant platform settings: Super Admin role or Odoo document admin break-glass."""
        return self.user_is_super_admin(user)

    @api.model
    def user_has_legacy_manager(self, user):
        return user.has_group("cleon_document_management.group_document_manager")

    @api.model
    def require_super_admin(self, user):
        if not self.user_is_platform_admin(user):
            raise AccessError(_("Super Admin access is required."))

    @api.model
    def require_assign_dms_roles(self, user):
        if not (
            self.user_has_dms_permission(user, "assign_dms_roles")
            or self.user_is_odoo_break_glass_admin(user)
        ):
            raise AccessError(_("You cannot assign module roles."))

    @api.model
    def require_compliance_permission(self, user, key):
        if not self.user_has_dms_permission(user, key):
            raise AccessError(_("Compliance access is required."))

    @api.model
    def require_templates_permission(self, user, key):
        if not self.user_has_dms_permission(user, key):
            raise AccessError(_("Templates access is required."))

    @api.model
    def serialize_user_permissions(self, user):
        perms = self.effective_permissions(user)
        org_perm = self.env["doc.organizational.files.permission"]
        ef_perm = self.env["doc.employee.files.permission"]
        return {
            "dms_permissions": perms,
            "is_super_admin": self.user_is_super_admin(user),
            "can_assign_dms_roles": self.user_has_dms_permission(user, "assign_dms_roles")
            or self.user_is_odoo_break_glass_admin(user),
            "employee_files_permissions": ef_perm.serialize_user_permissions(user),
            "organizational_files_permissions": org_perm.serialize_user_permissions(user),
        }
