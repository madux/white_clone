# -*- coding: utf-8 -*-
from odoo import _, api, models
from odoo.exceptions import AccessError

from .employee_files_role import DEPENDENT_ACTION_FIELDS, EF_ACTION_FIELDS

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
    def _user_employee(self, user):
        return user.sudo().employee_id

    @api.model
    def user_is_platform_admin(self, user):
        return user.has_group("base.group_system") or user.has_group(
            "cleon_document_management.group_document_admin"
        )

    @api.model
    def user_has_legacy_manager(self, user):
        return user.has_group("cleon_document_management.group_document_manager")

    @api.model
    def user_assigned_roles(self, user):
        return user.sudo().employee_files_role_ids.filtered(lambda role: role.active)

    @api.model
    def user_has_ef_roles(self, user):
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
            return True
        return bool(self.user_assigned_roles(user))

    @api.model
    def user_can_access_ef_home(self, user):
        """Browse Employee Files admin surfaces (any scope beyond pure self-service)."""
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
            return True
        return bool(self.user_assigned_roles(user))

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
    def _line_matches_document(self, line, document):
        doc_type = document.document_type_id
        if line.applies_all_categories:
            return True
        if line.document_type_id and doc_type and line.document_type_id == doc_type:
            return True
        if line.category_group and doc_type and line.category_group == doc_type.category:
            return True
        return False

    @api.model
    def _line_allows_action(self, line, action_field):
        if action_field not in EF_ACTION_FIELDS:
            return False
        if not line.action_view:
            return False
        return bool(line[action_field])

    @api.model
    def user_owns_employee_file(self, user, employee):
        actor = self._user_employee(user)
        return bool(actor and employee and actor.id == employee.id)

    @api.model
    def user_can_on_employee(self, user, employee, action_field):
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
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
            for line in role.line_ids:
                if line.action_view and line[action_field]:
                    if action_field == "action_view":
                        return True
                    if line.applies_all_categories or line.document_type_id or line.category_group:
                        return True
        return False

    @api.model
    def user_can_on_document(self, user, document, action_field):
        if not document:
            return False
        employee = document.employee_id
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
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
            for line in role.line_ids:
                if not self._line_matches_document(line, document):
                    continue
                if self._line_allows_action(line, action_field):
                    return True
        return False

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
        if not self.user_is_platform_admin(user):
            raise AccessError(
                _("Document administrator access is required to manage Employee Files roles.")
            )

    @api.model
    def serialize_user_permissions(self, user):
        roles = self.user_assigned_roles(user)
        scopes = sorted({role.employee_scope for role in roles})
        action_union = {api_key: False for api_key in ACTION_API_KEYS.values()}
        for role in roles:
            for line in role.line_ids:
                for field_name, api_key in ACTION_API_KEYS.items():
                    if self._line_allows_action(line, field_name):
                        action_union[api_key] = True
        return {
            "can_access_ef_home": self.user_can_access_ef_home(user),
            "is_platform_admin": self.user_is_platform_admin(user),
            "has_legacy_manager": self.user_has_legacy_manager(user),
            "assigned_role_ids": roles.ids,
            "assigned_role_names": roles.mapped("name"),
            "employee_scopes": scopes,
            "actions_any_category": action_union,
            "can_approve": action_union["approve"]
            or self.user_is_platform_admin(user)
            or self.user_has_legacy_manager(user),
            "can_manage_ef_settings": action_union["manage_settings"]
            or self.user_is_platform_admin(user),
        }
