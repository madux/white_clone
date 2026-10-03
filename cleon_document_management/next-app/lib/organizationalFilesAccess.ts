import type { OrganizationalFilesPermissions, User } from "./types";

export function orgPermissions(user?: User | null): OrganizationalFilesPermissions | undefined {
  return user?.organizational_files_permissions;
}

export function canAccessOrgLibrary(user?: User | null): boolean {
  if (!user) return false;
  return (
    user.is_document_admin === true ||
    user.organizational_files_permissions?.can_access_org_library === true
  );
}

export function canCreateOrgFolder(user?: User | null): boolean {
  if (!user) return false;
  return (
    user.is_document_admin === true ||
    user.organizational_files_permissions?.can_create_folder === true
  );
}

export function canManageOrgFolders(user?: User | null): boolean {
  if (!user) return false;
  return (
    user.is_document_admin === true ||
    user.organizational_files_permissions?.can_manage_folders === true
  );
}

export function canShareManageOrgAccess(user?: User | null): boolean {
  if (!user) return false;
  return (
    user.is_document_admin === true ||
    user.organizational_files_permissions?.can_share_manage_access === true
  );
}

export function canManageOrgDocuments(user?: User | null): boolean {
  if (!user) return false;
  return (
    user.is_document_admin === true ||
    user.organizational_files_permissions?.can_document_manage === true
  );
}

/** Create organizational policy folders (matches create-policy-folder API gates). */
export function canCreateOrgPolicy(user?: User | null): boolean {
  if (!user) return false;
  if (user.is_document_admin === true || user.is_document_manager === true) {
    return true;
  }
  return canCreateOrgFolder(user) && canManageOrgDocuments(user);
}

export function canManageOrgDocumentAccess(user?: User | null): boolean {
  if (!user) return false;
  return (
    user.is_document_admin === true ||
    user.organizational_files_permissions?.can_document_manage_access === true
  );
}

export function canUploadOrgDocuments(user?: User | null): boolean {
  if (!user) return false;
  return (
    user.is_document_admin === true ||
    user.organizational_files_permissions?.can_upload === true
  );
}

export function canArchiveOrgFolders(user?: User | null): boolean {
  if (!user) return false;
  return (
    user.is_document_admin === true ||
    user.organizational_files_permissions?.can_folder_archive === true
  );
}

export function canAccessOrgArchived(user?: User | null): boolean {
  return canArchiveOrgFolders(user) || canManageOrgDocuments(user);
}
