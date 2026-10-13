import type { DmsPermissionsMap } from "./types";

export const WITHOUT_APPROVAL_PARENT: Partial<
  Record<keyof DmsPermissionsMap & string, keyof DmsPermissionsMap & string>
> = {
  create_folder_without_approval: "create_folder",
  upload_without_approval: "upload_link_import_scan",
  edit_without_approval: "edit_rename_description_colour",
  replace_version_without_approval: "replace_version",
  move_without_approval: "move",
  delete_without_approval: "delete",
  ef_upload_without_approval: "ef_upload",
};

export const MODULE_VIEW_KEY: Partial<
  Record<keyof DmsPermissionsMap & string, keyof DmsPermissionsMap & string>
> = {
  ef_view: "view_employee_files",
  ef_upload: "view_employee_files",
  ef_upload_without_approval: "view_employee_files",
  ef_approve: "view_employee_files",
  ef_download: "view_employee_files",
  ef_archive: "view_employee_files",
  ef_delete: "view_employee_files",
  ef_export: "view_employee_files",
  ef_manage_ef_settings: "view_employee_files",
  ef_automate: "view_employee_files",
};

const EF_CHILD_KEYS = (
  [
    "ef_upload",
    "ef_upload_without_approval",
    "ef_approve",
    "ef_download",
    "ef_archive",
    "ef_delete",
    "ef_export",
    "ef_manage_ef_settings",
    "ef_automate",
  ] as const
) satisfies readonly (keyof DmsPermissionsMap & string)[];

export type PermissionToggleResult = {
  permissions: Partial<DmsPermissionsMap>;
  message?: string;
};

export function clearEfChildren(
  permissions: Partial<DmsPermissionsMap>,
): Partial<DmsPermissionsMap> {
  const next = { ...permissions };
  for (const key of EF_CHILD_KEYS) {
    next[key] = false;
  }
  return next;
}

export function efChildLabels(
  permissions: Partial<DmsPermissionsMap>,
): string[] {
  return EF_CHILD_KEYS.filter((key) => permissions[key]).map((key) =>
    key.replace(/^ef_/, "").replace(/_/g, " "),
  );
}

export function toggleDmsPermission(
  permissions: Partial<DmsPermissionsMap>,
  key: keyof DmsPermissionsMap & string,
  enabled: boolean,
): PermissionToggleResult {
  const next = { ...permissions, [key]: enabled };
  let message: string | undefined;

  if (enabled) {
    const moduleView = MODULE_VIEW_KEY[key];
    if (moduleView === "view_employee_files" && !next.view_employee_files) {
      next.view_employee_files = true;
    }
    if (key === "ef_delete" && !next.ef_upload) {
      next.ef_upload = true;
      message = "View and Edit (upload) added because Delete needs them.";
    }
    if (key === "ef_delete" && !next.ef_view) {
      next.ef_view = true;
    }
    if (
      (key === "ef_upload" || key === "ef_approve" || key === "ef_download") &&
      !next.ef_view
    ) {
      next.ef_view = true;
      const label = key.replace(/^ef_/, "").replace(/_/g, " ");
      message = `View added because ${label} needs it.`;
    }
    const parent = WITHOUT_APPROVAL_PARENT[key];
    if (parent && !next[parent]) {
      next[parent] = true;
      message = `${String(parent).replace(/_/g, " ")} enabled because this action needs it.`;
    }
  }

  if (!enabled && key === "ef_view") {
    Object.assign(next, clearEfChildren(next));
    next.ef_view = false;
  }

  if (!enabled && key === "view_employee_files") {
    Object.assign(next, clearEfChildren(next));
    next.ef_view = false;
    next.view_employee_files = false;
  }

  if (!enabled) {
    for (const [child, parent] of Object.entries(WITHOUT_APPROVAL_PARENT)) {
      if (parent === key) {
        next[child as keyof DmsPermissionsMap] = false;
      }
    }
  }

  return { permissions: next, message };
}

export function diffPermissionKeys(
  before: Partial<DmsPermissionsMap>,
  after: Partial<DmsPermissionsMap>,
): { added: string[]; removed: string[] } {
  const keys = new Set([
    ...Object.keys(before || {}),
    ...Object.keys(after || {}),
  ]);
  const added: string[] = [];
  const removed: string[] = [];
  for (const key of keys) {
    const was = Boolean(before?.[key as keyof DmsPermissionsMap]);
    const now = Boolean(after?.[key as keyof DmsPermissionsMap]);
    if (!was && now) added.push(key);
    if (was && !now) removed.push(key);
  }
  return { added, removed };
}
