import type { DmsPermissionAreaId } from "./dmsRolePermissionCatalog";

export type RoleEditorTabId =
  | "general"
  | "employee_files"
  | "org_files"
  | "templates"
  | "compliance"
  | "signatures"
  | "intelligence"
  | "reports_audit"
  | "settings";

export type RoleEditorTab = {
  id: RoleEditorTabId;
  label: string;
  areaId?: DmsPermissionAreaId;
  /** Settings → Modules payload key; row greyed when false */
  moduleKey?: string;
};

export const ROLE_EDITOR_TABS: RoleEditorTab[] = [
  { id: "general", label: "General" },
  {
    id: "employee_files",
    label: "Employee Files",
    areaId: "employee",
    moduleKey: "employee_files",
  },
  {
    id: "org_files",
    label: "Org Files",
    areaId: "organization",
    moduleKey: "organizational_files",
  },
  {
    id: "templates",
    label: "Templates & Forms",
    areaId: "templates",
    moduleKey: "organizational_files",
  },
  {
    id: "compliance",
    label: "Compliance",
    areaId: "compliance",
    moduleKey: "compliance",
  },
  {
    id: "signatures",
    label: "Signatures",
    areaId: "organization",
    moduleKey: "organizational_files",
  },
  {
    id: "intelligence",
    label: "Intelligence",
    areaId: "workspace",
    moduleKey: "document_intelligence",
  },
  {
    id: "reports_audit",
    label: "Reports & Audit",
    areaId: "organization",
    moduleKey: "organizational_files",
  },
  {
    id: "settings",
    label: "Settings",
    areaId: "platform",
  },
];

export const EF_FIXED_CATEGORY_ROWS = [
  { group: "identity", label: "Identity" },
  { group: "employment", label: "Employment" },
  { group: "finance", label: "Payroll" },
  { group: "medical", label: "Medical" },
] as const;
