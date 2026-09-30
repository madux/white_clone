# -*- coding: utf-8 -*-
from odoo import _, api, models
from odoo.exceptions import AccessError

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


class DocOrganizationalFilesPermission(models.AbstractModel):
    _name = "doc.organizational.files.permission"
    _description = "Organizational Files permission resolver"

    @api.model
    def _ef_permission(self):
        return self.env["doc.employee.files.permission"]

    @api.model
    def user_is_platform_admin(self, user):
        return self._ef_permission().user_is_platform_admin(user)

    @api.model
    def user_has_legacy_manager(self, user):
        return self._ef_permission().user_has_legacy_manager(user)

    @api.model
    def user_assigned_roles(self, user):
        return self._ef_permission().user_assigned_roles(user)

    @api.model
    def user_has_dms_access(self, user):
        return user.has_group("cleon_document_management.group_document_user")

    @api.model
    def _role_grants(self, user, field_name):
        if field_name not in ORG_FIELD_NAMES:
            return False
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
            return True
        for role in self.user_assigned_roles(user):
            if role[field_name]:
                return True
        return False

    @api.model
    def user_can_access_org_library(self, user):
        if not self.user_has_dms_access(user):
            return False
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
            return True
        return self._role_grants(user, "org_access_library")

    @api.model
    def user_can_create_folder(self, user):
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
            return True
        return self._role_grants(user, "org_create_folder")

    @api.model
    def user_can_manage_folders(self, user):
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
            return True
        return self._role_grants(user, "org_manage_folders")

    @api.model
    def user_can_suggest_folder_description(self, user):
        return self.user_can_create_folder(user) or self.user_can_manage_folders(user)

    @api.model
    def user_can_share_manage_access(self, user):
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
            return True
        return self._role_grants(user, "org_share_manage_access")

    @api.model
    def user_can_folder_archive(self, user):
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
            return True
        return self._role_grants(user, "org_folder_archive")

    @api.model
    def user_can_folder_delete(self, user):
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
            return True
        return self._role_grants(user, "org_folder_delete")

    @api.model
    def user_can_upload_org(self, user):
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
            return True
        return self._role_grants(user, "org_upload")

    @api.model
    def user_can_manage_org_document(self, user):
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
            return True
        return self._role_grants(user, "org_document_manage")

    @api.model
    def user_can_manage_org_document_access(self, user):
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
            return True
        return self._role_grants(user, "org_document_manage_access")

    @api.model
    def user_can_delete_org_document(self, user):
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
            return True
        return self._role_grants(user, "org_document_delete")

    @api.model
    def require_org_library(self, user):
        if not self.user_can_access_org_library(user):
            raise AccessError(_("Organizational Files access is required."))

    @api.model
    def require_create_folder(self, user):
        if not self.user_can_create_folder(user):
            raise AccessError(_("You do not have permission to create folders."))

    @api.model
    def require_upload_org(self, user):
        if not self.user_can_upload_org(user):
            raise AccessError(
                _("You do not have permission to upload into organizational folders.")
            )

    @api.model
    def serialize_user_permissions(self, user):
        actions = {
            api_key: self._role_grants(user, field_name)
            for field_name, api_key in ORG_ACTION_API_KEYS.items()
        }
        if self.user_is_platform_admin(user) or self.user_has_legacy_manager(user):
            for key in actions:
                actions[key] = True
        return {
            "can_access_org_library": self.user_can_access_org_library(user),
            "can_create_folder": self.user_can_create_folder(user),
            "can_manage_folders": self.user_can_manage_folders(user),
            "can_share_manage_access": self.user_can_share_manage_access(user),
            "can_folder_archive": self.user_can_folder_archive(user),
            "can_folder_delete": self.user_can_folder_delete(user),
            "can_upload": self.user_can_upload_org(user),
            "can_document_manage": self.user_can_manage_org_document(user),
            "can_document_manage_access": self.user_can_manage_org_document_access(
                user
            ),
            "can_document_delete": self.user_can_delete_org_document(user),
            "actions": actions,
        }
