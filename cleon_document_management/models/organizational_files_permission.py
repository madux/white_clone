# -*- coding: utf-8 -*-
from odoo import _, api, models
from odoo.exceptions import AccessError

from .organizational_permission_catalog import (
    ORG_ACTION_API_KEYS,
    ORG_FIELD_NAMES,
    ORG_PERMISSION_KEYS,
    ORG_ROLE_TEMPLATE_DEFAULTS,
)


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
    def _dms(self):
        return self.env["doc.dms.permission"]

    @api.model
    def effective_org_permissions(self, user):
        eff = self._dms().effective_permissions(user)
        return {key: bool(eff.get(key)) for key in ORG_PERMISSION_KEYS}

    @api.model
    def user_has_org_permission(self, user, permission_key):
        if permission_key not in ORG_PERMISSION_KEYS:
            return False
        return self._dms().user_has_dms_permission(user, permission_key)

    @api.model
    def user_is_org_super_admin(self, user):
        if self.user_is_platform_admin(user):
            return True
        return self.user_has_org_permission(user, "is_super_admin")

    @api.model
    def _role_grants(self, user, field_name):
        if field_name not in ORG_FIELD_NAMES:
            return False
        api_key = ORG_ACTION_API_KEYS[field_name]
        legacy_map = {
            "access_library": "view_org_files",
            "create_folder": ("create_folder", "create_folder_without_approval"),
            "manage_folders": (
                "edit_rename_description_colour",
                "edit_without_approval",
                "lock_unlock",
            ),
            "share_manage_access": ("share_manage_access", "assign_document"),
            "folder_archive": ("archive_restore",),
            "folder_delete": ("delete", "delete_without_approval"),
            "upload": ("upload_link_import_scan", "upload_without_approval"),
            "document_manage": (
                "edit_rename_description_colour",
                "move",
                "replace_version",
                "automate",
                "add_policy",
            ),
            "document_manage_access": ("share_manage_access", "assign_document"),
            "document_delete": ("delete", "delete_without_approval"),
        }
        keys = legacy_map.get(api_key, ())
        return any(self.user_has_org_permission(user, key) for key in keys)

    @api.model
    def user_can_access_org_library(self, user):
        if not self.user_has_dms_access(user):
            return False
        return self.user_has_org_permission(user, "view_org_files")

    @api.model
    def user_can_create_folder(self, user):
        return self.user_has_org_permission(user, "create_folder") or self.user_has_org_permission(
            user, "create_folder_without_approval"
        )

    @api.model
    def user_can_create_folder_without_approval(self, user):
        return self.user_has_org_permission(user, "create_folder_without_approval")

    @api.model
    def user_can_manage_folders(self, user):
        return (
            self.user_has_org_permission(user, "edit_rename_description_colour")
            or self.user_has_org_permission(user, "edit_without_approval")
            or self.user_has_org_permission(user, "lock_unlock")
        )

    @api.model
    def user_can_suggest_folder_description(self, user):
        return self.user_can_create_folder(user) or self.user_can_manage_folders(user)

    @api.model
    def user_can_share_manage_access(self, user):
        return self.user_has_org_permission(user, "share_manage_access")

    @api.model
    def user_can_folder_archive(self, user):
        return self.user_has_org_permission(user, "archive_restore")

    @api.model
    def user_can_folder_delete(self, user):
        return self.user_has_org_permission(user, "delete") or self.user_has_org_permission(
            user, "delete_without_approval"
        )

    @api.model
    def user_can_upload_org(self, user):
        return self.user_has_org_permission(
            user, "upload_link_import_scan"
        ) or self.user_has_org_permission(user, "upload_without_approval")

    @api.model
    def user_can_upload_org_without_approval(self, user):
        return self.user_has_org_permission(user, "upload_without_approval")

    @api.model
    def user_can_manage_org_document(self, user):
        return any(
            self.user_has_org_permission(user, key)
            for key in (
                "edit_rename_description_colour",
                "edit_without_approval",
                "move",
                "move_without_approval",
                "replace_version",
                "replace_version_without_approval",
                "automate",
                "add_policy",
            )
        )

    @api.model
    def user_can_manage_org_document_access(self, user):
        return self.user_has_org_permission(
            user, "share_manage_access"
        ) or self.user_has_org_permission(user, "assign_document")

    @api.model
    def user_can_delete_org_document(self, user):
        return self.user_has_org_permission(user, "delete") or self.user_has_org_permission(
            user, "delete_without_approval"
        )

    @api.model
    def user_can_external_share(self, user):
        return self.user_has_org_permission(user, "external_share_password_watermark")

    @api.model
    def user_can_legal_hold(self, user):
        return self.user_has_org_permission(user, "place_release_legal_hold")

    @api.model
    def user_can_approve_org_requests(self, user):
        return self.user_has_org_permission(user, "approve_reject_requests")

    @api.model
    def user_can_view_org_audit(self, user):
        return self.user_has_org_permission(user, "view_audit_activity")

    @api.model
    def user_is_org_auditor_readonly(self, user):
        perms = self.effective_org_permissions(user)
        if not perms.get("view_org_files"):
            return False
        mutating = any(
            perms.get(key)
            for key in ORG_PERMISSION_KEYS
            if key
            not in (
                "view_org_files",
                "view_hr_only_policies",
                "view_audit_activity",
                "acknowledge_sign_assigned_policy",
            )
        )
        return not mutating and (
            perms.get("view_audit_activity") or perms.get("view_hr_only_policies")
        )

    @api.model
    def user_can_manage_org_policy_lifecycle(self, user):
        return (
            self.user_has_org_permission(user, "add_policy")
            or self.user_has_org_permission(user, "activate_archive_policy")
        )

    @api.model
    def user_can_view_hr_only_org_policy(self, user):
        return self.user_has_org_permission(user, "view_hr_only_policies")

    @api.model
    def user_can_open_private_folder(self, user, folder):
        if not folder or folder.folder_type != "organizational":
            return True
        if folder.access_scope == "private":
            if self.user_is_org_super_admin(user):
                return True
            if folder.create_uid and folder.create_uid.id == user.id:
                return True
            return False
        return True

    @api.model
    def resolve_org_access(self, user, folder=None, document=None, action_key=None):
        """Five-step access chain; returns (allowed, reason_code)."""
        if not self.user_has_dms_access(user):
            return False, "no_dms"
        if action_key in (None, "view_org_files"):
            if not self.user_can_access_org_library(user):
                return False, "no_org_library"
        if folder and folder.folder_type == "organizational":
            if not self.user_can_open_private_folder(user, folder):
                return False, "private_folder"
            if not folder._user_can_access(user):
                return False, "folder_scope"
        if document and document.folder_id.folder_type == "organizational":
            if document.processing_status == "quarantined":
                return False, "quarantined"
            if not document._organizational_user_can_access(user):
                return False, "document_scope"
            if document.legal_hold_active:
                if action_key in ("delete", "delete_without_approval", "permanent_delete"):
                    if not self.user_has_org_permission(user, "delete_protected_override"):
                        return False, "legal_hold"
        if action_key and action_key in ORG_PERMISSION_KEYS:
            if not self.user_has_org_permission(user, action_key):
                return False, "rbac"
        return True, "ok"

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
        perms = self.effective_org_permissions(user)
        actions = {
            api_key: self._role_grants(user, field_name)
            for field_name, api_key in ORG_ACTION_API_KEYS.items()
        }
        return {
            "can_access_org_library": self.user_can_access_org_library(user),
            "can_create_folder": self.user_can_create_folder(user),
            "can_manage_folders": self.user_can_manage_folders(user),
            "can_share_manage_access": self.user_can_share_manage_access(user),
            "can_folder_archive": self.user_can_folder_archive(user),
            "can_folder_delete": self.user_can_folder_delete(user),
            "can_upload": self.user_can_upload_org(user),
            "can_document_manage": self.user_can_manage_org_document(user),
            "can_document_manage_access": self.user_can_manage_org_document_access(user),
            "can_document_delete": self.user_can_delete_org_document(user),
            "is_org_super_admin": self.user_is_org_super_admin(user),
            "is_org_auditor_readonly": self.user_is_org_auditor_readonly(user),
            "can_external_share": self.user_can_external_share(user),
            "can_legal_hold": self.user_can_legal_hold(user),
            "can_approve_org_requests": self.user_can_approve_org_requests(user),
            "can_view_org_audit": self.user_can_view_org_audit(user),
            "can_manage_org_policy_lifecycle": self.user_can_manage_org_policy_lifecycle(
                user
            ),
            "can_view_hr_only_org_policy": self.user_can_view_hr_only_org_policy(user),
            "org_permissions": perms,
            "actions": actions,
        }
