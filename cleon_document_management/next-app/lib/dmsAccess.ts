import type { DmsPermissionsMap, User } from "./types";

export function dmsPermissions(
  user?: User | null,
): Partial<DmsPermissionsMap> | undefined {
  return user?.dms_permissions;
}

export function userIsSuperAdmin(user?: User | null): boolean {
  if (!user) return false;
  return (
    user.is_super_admin === true ||
    user.is_document_admin === true ||
    user.is_admin === true
  );
}

export function userHasDmsPermission(
  user?: User | null,
  key?: keyof DmsPermissionsMap | string,
): boolean {
  if (!user || !key) return false;
  if (userIsSuperAdmin(user)) return true;
  const perms = user.dms_permissions as Record<string, boolean> | undefined;
  return perms?.[key as string] === true;
}

export function canAccessDmsSettings(user?: User | null): boolean {
  return (
    userHasDmsPermission(user, "manage_document_types") ||
    userHasDmsPermission(user, "manage_retention_lifecycle") ||
    userHasDmsPermission(user, "manage_ef_tenant_config") ||
    userHasDmsPermission(user, "manage_org_tenant_config") ||
    userHasDmsPermission(user, "assign_dms_roles")
  );
}

export function canViewComplianceModule(user?: User | null): boolean {
  return (
    userHasDmsPermission(user, "view_compliance") ||
    userHasDmsPermission(user, "compliance_view")
  );
}

export function canViewTemplatesModule(user?: User | null): boolean {
  return (
    userHasDmsPermission(user, "view_templates_forms") ||
    userHasDmsPermission(user, "templates_view")
  );
}
