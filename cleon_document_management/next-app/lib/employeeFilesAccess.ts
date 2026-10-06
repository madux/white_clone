import { userHasDmsPermission, userIsSuperAdmin } from "./dmsAccess";
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
    userHasDmsPermission(user, "view_employee_files") ||
    user.is_document_manager === true ||
    userIsSuperAdmin(user)
  );
}

export function canApproveEmployeeDocuments(user?: User | null): boolean {
  if (!user) return false;
  const perms = user.employee_files_permissions;
  return (
    perms?.can_approve === true ||
    userHasDmsPermission(user, "ef_approve") ||
    user.is_document_manager === true ||
    userIsSuperAdmin(user)
  );
}

export function canArchiveEmployeeDocuments(user?: User | null): boolean {
  if (!user) return false;
  const perms = user.employee_files_permissions;
  return (
    perms?.actions_any_category?.archive === true ||
    userHasDmsPermission(user, "ef_archive") ||
    userIsSuperAdmin(user) ||
    user.is_document_manager === true
  );
}

export function canAutomateEmployeeDocuments(user?: User | null): boolean {
  if (!user) return false;
  const perms = user.employee_files_permissions;
  return (
    perms?.can_automate === true ||
    userHasDmsPermission(user, "ef_automate") ||
    user.is_document_manager === true ||
    userIsSuperAdmin(user)
  );
}

export function canDeleteEmployeeDocuments(user?: User | null): boolean {
  if (!user) return false;
  const perms = user.employee_files_permissions;
  return (
    perms?.actions_any_category?.delete === true ||
    userHasDmsPermission(user, "ef_delete") ||
    userIsSuperAdmin(user) ||
    user.is_document_manager === true
  );
}
