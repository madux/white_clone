import type { EmployeeFilesPermissions, User } from "./types";

export function employeeFilesPermissions(
  user?: User | null,
): EmployeeFilesPermissions | undefined {
  return user?.employee_files_permissions;
}

export function canAccessEmployeeFilesAdmin(user?: User | null): boolean {
  if (!user) return false;
  return (
    user.employee_files_permissions?.can_access_ef_home === true ||
    user.is_document_manager === true ||
    user.is_document_admin === true
  );
}

export function canApproveEmployeeDocuments(user?: User | null): boolean {
  if (!user) return false;
  const perms = user.employee_files_permissions;
  return (
    perms?.can_approve === true ||
    user.is_document_manager === true ||
    user.is_document_admin === true
  );
}

export function canArchiveEmployeeDocuments(user?: User | null): boolean {
  if (!user) return false;
  const perms = user.employee_files_permissions;
  return (
    perms?.actions_any_category?.archive === true ||
    user.is_document_admin === true ||
    user.is_document_manager === true
  );
}

export function canDeleteEmployeeDocuments(user?: User | null): boolean {
  if (!user) return false;
  const perms = user.employee_files_permissions;
  return (
    perms?.actions_any_category?.delete === true ||
    user.is_document_admin === true ||
    user.is_document_manager === true
  );
}
