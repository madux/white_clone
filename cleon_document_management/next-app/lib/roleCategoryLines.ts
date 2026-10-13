import { EF_FIXED_CATEGORY_ROWS } from "./roleModuleTabs";
import type { EmployeeFilesRole, EmployeeFilesRoleLine } from "./types";

const emptyActions = (): EmployeeFilesRoleLine["actions"] => ({
  view: false,
  upload: false,
  approve: false,
  download: false,
  archive: false,
  delete: false,
  export: false,
  manage_settings: false,
});

export function ensureFixedCategoryLines(
  role: EmployeeFilesRole,
): EmployeeFilesRoleLine[] {
  const lines = [...(role.lines || [])];
  return EF_FIXED_CATEGORY_ROWS.map(({ group }) => {
    const existing = lines.find(
      (line) =>
        !line.applies_all_categories &&
        line.category_group === group &&
        !line.document_type_id,
    );
    if (existing) {
      return {
        ...existing,
        actions: { ...emptyActions(), ...existing.actions },
      };
    }
    return {
      applies_all_categories: false,
      category_group: group,
      document_type_id: false,
      actions: emptyActions(),
    };
  });
}

export function updateCategoryLine(
  lines: EmployeeFilesRoleLine[],
  group: string,
  patch: Partial<EmployeeFilesRoleLine> & {
    actions?: Partial<EmployeeFilesRoleLine["actions"]>;
  },
): EmployeeFilesRoleLine[] {
  return lines.map((line) => {
    if (line.category_group !== group || line.applies_all_categories) return line;
    return {
      ...line,
      ...patch,
      actions: patch.actions ? { ...line.actions, ...patch.actions } : line.actions,
    };
  });
}
