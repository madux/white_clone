import { userHasDmsPermission, userIsSuperAdmin } from "./dmsAccess";
import type { OrganizationalFilesPermissions, User } from "./types";

export function orgPermissions(user?: User | null): OrganizationalFilesPermissions | undefined {
  return user?.organizational_files_permissions;
}

export function canAccessOrgLibrary(user?: User | null): boolean {
  if (!user) return false;
  return (
    userHasDmsPermission(user, "view_org_files") ||
    userIsSuperAdmin(user) ||
    user.organizational_files_permissions?.can_access_org_library === true
  );
}

export function canCreateOrgFolder(user?: User | null): boolean {
  if (!user) return false;
  return (
    userIsSuperAdmin(user) ||
    user.organizational_files_permissions?.can_create_folder === true
  );
}

export function canManageOrgFolders(user?: User | null): boolean {
  if (!user) return false;
  return (
    userIsSuperAdmin(user) ||
    user.organizational_files_permissions?.can_manage_folders === true
  );
}

export function canShareManageOrgAccess(user?: User | null): boolean {
  if (!user) return false;
  return (
    userIsSuperAdmin(user) ||
    user.organizational_files_permissions?.can_share_manage_access === true
  );
}

export function canManageOrgDocuments(user?: User | null): boolean {
  if (!user) return false;
  return (
    userIsSuperAdmin(user) ||
    user.organizational_files_permissions?.can_document_manage === true
  );
}

/** Create organizational policy folders (matches create-policy-folder API gates). */
export function canCreateOrgPolicy(user?: User | null): boolean {
  if (!user) return false;
  if (userIsSuperAdmin(user) || user.is_document_manager === true) {
    return true;
  }
  return canCreateOrgFolder(user) && canManageOrgDocuments(user);
}

export function canManageOrgDocumentAccess(user?: User | null): boolean {
  if (!user) return false;
  return (
    userIsSuperAdmin(user) ||
    user.organizational_files_permissions?.can_document_manage_access === true
  );
}

export function canUploadOrgDocuments(user?: User | null): boolean {
  if (!user) return false;
  return (
    userIsSuperAdmin(user) ||
    user.organizational_files_permissions?.can_upload === true
  );
}

export function canArchiveOrgFolders(user?: User | null): boolean {
  if (!user) return false;
  return (
    userIsSuperAdmin(user) ||
    user.organizational_files_permissions?.can_folder_archive === true
  );
}

export function canAccessOrgArchived(user?: User | null): boolean {
  return canArchiveOrgFolders(user) || canManageOrgDocuments(user);
}

export function userHasOrgPermission(
  user?: User | null,
  key?: keyof NonNullable<OrganizationalFilesPermissions["org_permissions"]>,
): boolean {
  if (!user || !key) return false;
  if (userIsSuperAdmin(user)) return true;
  return user.organizational_files_permissions?.org_permissions?.[key] === true;
}

export function isOrgAuditorReadonly(user?: User | null): boolean {
  return user?.organizational_files_permissions?.is_org_auditor_readonly === true;
}

export function canExternalShareOrg(user?: User | null): boolean {
  if (!user) return false;
  return (
    userIsSuperAdmin(user) ||
    user.organizational_files_permissions?.can_external_share === true
  );
}

export function canApproveOrgRequests(user?: User | null): boolean {
  if (!user) return false;
  return (
    userIsSuperAdmin(user) ||
    user.organizational_files_permissions?.can_approve_org_requests === true
  );
}
