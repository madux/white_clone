# -*- coding: utf-8 -*-
from odoo import _, api, models
from odoo.exceptions import AccessError

from .dms_permission_catalog import EF_FIELD_TO_DMS_KEY

ACTION_API_KEYS = {
    "action_view": "view",
    "action_upload": "upload",
    "action_approve": "approve",
    "action_download": "download",
    "action_archive": "archive",
    "action_delete": "delete",
    "action_export": "export",
    "action_manage_settings": "manage_settings",
}


class DocEmployeeFilesPermission(models.AbstractModel):
    _name = "doc.employee.files.permission"
    _description = "Employee Files permission resolver"

    @api.model
    def _dms(self):
        return self.env["doc.dms.permission"]

    @api.model
    def _user_employee(self, user):
        return user.sudo().employee_id

    @api.model
    def user_is_platform_admin(self, user):
        return self._dms().user_is_platform_admin(user)

    @api.model
    def user_has_legacy_manager(self, user):
        return user.has_group("cleon_document_management.group_document_manager")

    @api.model
    def user_assigned_roles(self, user):
        return user.sudo().employee_files_role_ids.filtered(lambda role: role.active)

    @api.model
    def user_has_ef_roles(self, user):
        if self.user_is_platform_admin(user):
            return True
        return self.user_can_access_ef_home(user)

    @api.model
    def user_can_access_ef_home(self, user):
        return self._dms().user_has_dms_permission(user, "view_employee_files")

    @api.model
    def _employee_in_scope(self, user, target_employee, role):
        if not target_employee:
            return False
        actor_employee = self._user_employee(user)
        if role.employee_scope == "all":
            return target_employee.company_id in (False, user.company_id)
        if not actor_employee:
            return False
        if target_employee.id == actor_employee.id:
            return True
        if role.employee_scope == "department":
            return (
                actor_employee.department_id
                and target_employee.department_id
                and actor_employee.department_id == target_employee.department_id
            )
        if role.employee_scope == "own_team":
            return target_employee.parent_id == actor_employee
        return False

    @api.model
    def _role_has_ef_action(self, role, action_field):
        dms_key = EF_FIELD_TO_DMS_KEY.get(action_field)
        if not dms_key:
            return False
        return bool(role.get_dms_permissions_dict().get(dms_key))

    @api.model
    def user_owns_employee_file(self, user, employee):
        actor = self._user_employee(user)
        return bool(actor and employee and actor.id == employee.id)

    @api.model
    def user_can_on_employee(self, user, employee, action_field):
        if self._dms().user_is_odoo_break_glass_admin(user):
            return True
        if self.user_owns_employee_file(user, employee):
            if action_field in (
                "action_view",
                "action_upload",
                "action_download",
            ):
                return True
            return False
        if not employee:
            return False
        for role in self.user_assigned_roles(user):
            if not self._employee_in_scope(user, employee, role):
                continue
            if self._role_has_ef_action(role, action_field):
                return True
        return False

    @api.model
    def user_can_on_document(self, user, document, action_field):
        if not document:
            return False
        employee = document.employee_id
        return self.user_can_on_employee(user, employee, action_field)

    @api.model
    def require_employee_action(self, user, employee, action_key):
        field_name = next(
            (key for key, api_key in ACTION_API_KEYS.items() if api_key == action_key),
            None,
        )
        if not field_name:
            raise AccessError(_("Unknown Employee Files action."))
        if not self.user_can_on_employee(user, employee, field_name):
            raise AccessError(_("You do not have permission for this employee file."))

    @api.model
    def require_document_action(self, user, document, action_key):
        field_name = next(
            (key for key, api_key in ACTION_API_KEYS.items() if api_key == action_key),
            None,
        )
        if not field_name:
            raise AccessError(_("Unknown Employee Files action."))
        if not self.user_can_on_document(user, document, field_name):
            raise AccessError(_("You do not have permission for this document."))

    @api.model
    def require_ef_home_access(self, user):
        if not self.user_can_access_ef_home(user):
            raise AccessError(_("Employee Files access is required."))

    @api.model
    def require_role_authoring(self, user):
        self._dms().require_assign_dms_roles(user)

    @api.model
    def serialize_user_permissions(self, user):
        dms = self._dms()
        perms = dms.effective_permissions(user)
        roles = self.user_assigned_roles(user)
        scopes = sorted({role.employee_scope for role in roles})
        action_union = {api_key: False for api_key in ACTION_API_KEYS.values()}
        for field_name, api_key in ACTION_API_KEYS.items():
            dms_key = EF_FIELD_TO_DMS_KEY.get(field_name)
            if dms_key and perms.get(dms_key):
                action_union[api_key] = True
        return {
            "can_access_ef_home": self.user_can_access_ef_home(user),
            "is_platform_admin": self.user_is_platform_admin(user),
            "has_legacy_manager": self.user_has_legacy_manager(user),
            "assigned_role_ids": roles.ids,
            "assigned_role_names": roles.mapped("name"),
            "employee_scopes": scopes,
            "actions_any_category": action_union,
            "can_approve": action_union["approve"] or self.user_is_platform_admin(user),
            "can_manage_ef_settings": perms.get("ef_manage_ef_settings")
            or perms.get("manage_ef_tenant_config")
            or self.user_is_platform_admin(user),
        }
