import type { DmsPermissionsMap, EmployeeFilesRole } from "./types";
import { EF_FIXED_CATEGORY_ROWS } from "./roleModuleTabs";
import { ensureFixedCategoryLines, updateCategoryLine } from "./roleCategoryLines";
import { toggleDmsPermission } from "./rolePermissionRules";

export type MatrixColumnId =
  | "view"
  | "upload"
  | "edit"
  | "approve"
  | "delete"
  | "share"
  | "download";

export type MatrixScopeMode =
  | "employee"
  | "static"
  | "none";

export type RoleMatrixModuleId =
  | "employee_files"
  | "organizational_files"
  | "compliance"
  | "templates_forms"
  | "document_intelligence"
  | "signatures"
  | "reports_analytics"
  | "settings";

export type RoleMatrixModuleRow = {
  id: RoleMatrixModuleId;
  label: string;
  moduleKey?: string;
  scopeMode: MatrixScopeMode;
  staticScopeLabel?: string;
  columns: Partial<
    Record<
      MatrixColumnId,
      | { keys: (keyof DmsPermissionsMap & string)[]; gate?: keyof DmsPermissionsMap & string }
      | "na"
      | "locked"
    >
  >;
};

export const MATRIX_COLUMNS: { id: MatrixColumnId; label: string }[] = [
  { id: "view", label: "View" },
  { id: "upload", label: "Upload" },
  { id: "edit", label: "Edit" },
  { id: "approve", label: "Approve" },
  { id: "delete", label: "Delete" },
  { id: "share", label: "Share" },
  { id: "download", label: "Download" },
];

export const ROLE_MATRIX_MODULES: RoleMatrixModuleRow[] = [
  {
    id: "employee_files",
    label: "Employee Files",
    moduleKey: "employee_files",
    scopeMode: "employee",
    columns: {
      view: { keys: ["ef_view"], gate: "view_employee_files" },
      upload: { keys: ["ef_upload"] },
      edit: { keys: ["ef_upload_without_approval"] },
      approve: { keys: ["ef_approve"] },
      delete: { keys: ["ef_delete"] },
      share: "na",
      download: { keys: ["ef_download"] },
    },
  },
  {
    id: "organizational_files",
    label: "Organisational Files",
    moduleKey: "organizational_files",
    scopeMode: "static",
    staticScopeLabel: "All",
    columns: {
      view: { keys: ["view_org_files"] },
      upload: { keys: ["upload_link_import_scan"] },
      edit: { keys: ["edit_rename_description_colour"] },
      approve: { keys: ["approve_reject_requests"] },
      delete: { keys: ["delete"] },
      share: { keys: ["share_manage_access"] },
      download: { keys: ["view_org_files"] },
    },
  },
  {
    id: "compliance",
    label: "Compliance",
    moduleKey: "compliance",
    scopeMode: "static",
    staticScopeLabel: "—",
    columns: {
      view: { keys: ["compliance_view"], gate: "view_compliance" },
      upload: "na",
      edit: { keys: ["compliance_manage_policies"] },
      approve: { keys: ["compliance_approve_exception"] },
      delete: "na",
      share: "na",
      download: { keys: ["compliance_export"] },
    },
  },
  {
    id: "templates_forms",
    label: "Templates & Forms",
    moduleKey: "organizational_files",
    scopeMode: "static",
    staticScopeLabel: "All",
    columns: {
      view: { keys: ["templates_view"], gate: "view_templates_forms" },
      upload: { keys: ["templates_create_edit"] },
      edit: { keys: ["templates_create_edit"] },
      approve: "na",
      delete: "na",
      share: { keys: ["templates_assign"] },
      download: { keys: ["templates_export"] },
    },
  },
  {
    id: "document_intelligence",
    label: "Document Intelligence",
    moduleKey: "document_intelligence",
    scopeMode: "static",
    staticScopeLabel: "—",
    columns: {
      view: { keys: ["view_workspace_activity"] },
      upload: "na",
      edit: "na",
      approve: "na",
      delete: "na",
      share: "na",
      download: "na",
    },
  },
  {
    id: "signatures",
    label: "Signature Requests",
    moduleKey: "organizational_files",
    scopeMode: "static",
    staticScopeLabel: "Own sent",
    columns: {
      view: { keys: ["acknowledge_sign_assigned_policy"] },
      upload: "na",
      edit: "na",
      approve: "na",
      delete: "na",
      share: "na",
      download: "na",
    },
  },
  {
    id: "reports_analytics",
    label: "Reports & Analytics",
    moduleKey: "organizational_files",
    scopeMode: "static",
    staticScopeLabel: "All",
    columns: {
      view: { keys: ["view_audit_activity"] },
      upload: "na",
      edit: "na",
      approve: "na",
      delete: "na",
      share: "na",
      download: "na",
    },
  },
  {
    id: "settings",
    label: "Settings",
    moduleKey: "platform",
    scopeMode: "static",
    staticScopeLabel: "—",
    columns: {
      view: { keys: ["assign_dms_roles"] },
      upload: "na",
      edit: { keys: ["manage_document_types", "manage_ef_tenant_config", "manage_org_tenant_config"] },
      approve: "na",
      delete: "na",
      share: "na",
      download: { keys: ["manage_retention_lifecycle"] },
    },
  },
];

const EMPLOYEE_SCOPE_OPTIONS = [
  { value: "own_team", label: "Own team" },
  { value: "department", label: "Own departments" },
  { value: "all", label: "All" },
] as const;

export function employeeScopeOptions() {
  return EMPLOYEE_SCOPE_OPTIONS;
}

function columnCell(
  perms: Partial<DmsPermissionsMap>,
  spec: RoleMatrixModuleRow["columns"][MatrixColumnId],
): "on" | "off" | "na" | "locked" {
  if (!spec || spec === "na") return "na";
  if (spec === "locked") return "locked";
  const { keys, gate } = spec;
  if (gate && !perms[gate]) return "off";
  return keys.some((key) => perms[key]) ? "on" : "off";
}

export function matrixColumnState(
  perms: Partial<DmsPermissionsMap>,
  row: RoleMatrixModuleRow,
  column: MatrixColumnId,
): "on" | "off" | "na" | "locked" {
  return columnCell(perms, row.columns[column]);
}

export function moduleRowEnabled(
  perms: Partial<DmsPermissionsMap>,
  row: RoleMatrixModuleRow,
): boolean {
  for (const col of MATRIX_COLUMNS) {
    const state = matrixColumnState(perms, row, col.id);
    if (state === "on") return true;
  }
  return false;
}

function syncEfCategoryLines(
  role: EmployeeFilesRole,
  perms: Partial<DmsPermissionsMap>,
): EmployeeFilesRole["lines"] {
  const efRow = ROLE_MATRIX_MODULES.find((row) => row.id === "employee_files")!;
  let lines = ensureFixedCategoryLines(role);
  for (const { group } of EF_FIXED_CATEGORY_ROWS) {
    const existing = lines.find((item) => item.category_group === group)!;
    lines = updateCategoryLine(lines, group, {
      actions: {
        view: matrixColumnState(perms, efRow, "view") === "on",
        upload:
          matrixColumnState(perms, efRow, "upload") === "on" ||
          matrixColumnState(perms, efRow, "edit") === "on",
        approve: matrixColumnState(perms, efRow, "approve") === "on",
        download: matrixColumnState(perms, efRow, "download") === "on",
        delete: matrixColumnState(perms, efRow, "delete") === "on",
        archive: existing.actions.archive,
        export: existing.actions.export,
        manage_settings: existing.actions.manage_settings,
      },
    });
  }
  return lines;
}

export function applyMatrixColumnToggle(
  role: EmployeeFilesRole,
  row: RoleMatrixModuleRow,
  column: MatrixColumnId,
  enabled: boolean,
): { role: EmployeeFilesRole; message?: string } {
  const spec = row.columns[column];
  if (!spec || spec === "na" || spec === "locked") {
    return { role };
  }

  let perms = { ...(role.dms_permissions || {}) };
  let message: string | undefined;

  if (column === "view") {
    if (enabled && spec.gate) {
      const gateResult = toggleDmsPermission(perms, spec.gate, true);
      perms = gateResult.permissions;
      message = gateResult.message;
    }
    for (const key of spec.keys) {
      const result = toggleDmsPermission(perms, key, enabled);
      perms = result.permissions;
      message = message || result.message;
    }
    if (!enabled && spec.gate) {
      const result = toggleDmsPermission(perms, spec.gate, false);
      perms = result.permissions;
    }
  } else {
    for (const key of spec.keys) {
      const result = toggleDmsPermission(perms, key, enabled);
      perms = result.permissions;
      message = message || result.message;
    }
  }

  let nextRole: EmployeeFilesRole = { ...role, dms_permissions: perms };
  if (row.id === "employee_files") {
    nextRole = {
      ...nextRole,
      lines: syncEfCategoryLines(nextRole, perms),
    };
  }
  return { role: nextRole, message };
}

export function applyEmployeeScope(
  role: EmployeeFilesRole,
  scope: EmployeeFilesRole["employee_scope"],
): EmployeeFilesRole {
  return { ...role, employee_scope: scope };
}

/** Settings row: edit column is multi-key — show on if any settings edit key is on */
export function matrixColumnChecked(
  perms: Partial<DmsPermissionsMap>,
  row: RoleMatrixModuleRow,
  column: MatrixColumnId,
): boolean {
  const state = matrixColumnState(perms, row, column);
  return state === "on";
}
