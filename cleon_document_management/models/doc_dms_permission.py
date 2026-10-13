# -*- coding: utf-8 -*-
from odoo import _, api, models
from odoo.exceptions import AccessError

from .dms_permission_catalog import (
    COMPLIANCE_PERMISSION_KEYS,
    DMS_PERMISSION_KEYS,
    DMS_ROLE_TEMPLATE_DEFAULTS,
    EF_FIELD_TO_DMS_KEY,
    EF_PERMISSION_KEYS,
    ORG_ACTION_API_KEYS,
    ORG_FIELD_NAMES,
    ORG_PERMISSION_KEYS,
    SETTINGS_PERMISSION_KEYS,
    TEMPLATES_PERMISSION_KEYS,
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
    def _permission_label(self, key):
        return key.replace("_", " ").title()

    @api.model
    def effective_permissions_detail(self, user_id):
        from odoo import _

        user = self.env["res.users"].sudo().browse(int(user_id))
        if not user or not user.active:
            raise AccessError(_("User not found."))
        if user.company_id and user.company_id != self.env.company:
            raise AccessError(_("You can only view users in your company."))

        roles = self.user_assigned_roles(user)
        grants = []
        unreachable = []

        module_slices = [
            (_("Employee files"), "view_employee_files", EF_PERMISSION_KEYS),
            (_("Organisational files"), "view_org_files", ORG_PERMISSION_KEYS),
            (_("Compliance"), "view_compliance", COMPLIANCE_PERMISSION_KEYS),
            (
                _("Templates and forms"),
                "view_templates_forms",
                TEMPLATES_PERMISSION_KEYS,
            ),
            (_("Settings"), None, SETTINGS_PERMISSION_KEYS),
        ]

        for module_label, view_key, keys in module_slices:
            for role in roles:
                perms = role.get_dms_permissions_dict()
                if view_key and not perms.get(view_key):
                    continue
                enabled = [key for key in keys if perms.get(key)]
                if not enabled:
                    continue
                action_labels = ", ".join(self._permission_label(key) for key in enabled)
                grants.append(
                    {
                        "module": module_label,
                        "summary": action_labels,
                        "scope": role.employee_scope,
                        "role_name": role.name,
                        "role_id": role.id,
                    }
                )

        ef_category_groups = [
            ("identity", _("Identity")),
            ("employment", _("Employment")),
            ("finance", _("Payroll")),
            ("medical", _("Medical")),
        ]
        for group_key, label in ef_category_groups:
            has_view = False
            for role in roles:
                for line in role.line_ids:
                    if line.action_view and (
                        line.applies_all_categories
                        or line.category_group == group_key
                    ):
                        has_view = True
                        break
                if has_view:
                    break
            if not has_view:
                ef_global = any(
                    role.get_dms_permissions_dict().get("ef_view") for role in roles
                )
                if not ef_global:
                    unreachable.append(
                        {
                            "label": label,
                            "reason": _("No View in any role"),
                        }
                    )

        if not roles:
            unreachable.append(
                {
                    "label": _("Document management"),
                    "reason": _("No roles assigned"),
                }
            )

        return {
            "user_id": user.id,
            "user_name": user.name,
            "grants": grants,
            "unreachable": unreachable,
        }

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
