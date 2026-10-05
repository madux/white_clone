import { ORG_SECTION4_GROUPS } from "./orgRolePermissionGroups";
import type { DmsPermissionsMap } from "./types";

export type DmsPermissionAreaId =
  | "workspace"
  | "employee"
  | "organization"
  | "compliance"
  | "templates"
  | "platform";

export type DmsPermissionCatalogItem = {
  key: keyof DmsPermissionsMap & string;
  label: string;
  description: string;
};

export type DmsPermissionCatalogGroup = {
  title: string;
  items: DmsPermissionCatalogItem[];
};

export type DmsPermissionArea = {
  id: DmsPermissionAreaId;
  title: string;
  description: string;
  groups: DmsPermissionCatalogGroup[];
};

const workspaceArea: DmsPermissionArea = {
  id: "workspace",
  title: "Workspace",
  description: "Controls which product areas appear in navigation and activity views.",
  groups: [
    {
      title: "Application areas",
      items: [
        {
          key: "access_dms_module",
          label: "Document management",
          description: "Sign in to the document management application.",
        },
        {
          key: "view_employee_files",
          label: "Employee files",
          description: "HR library, employee profiles, and related admin workflows.",
        },
        {
          key: "view_org_files",
          label: "Organisational files",
          description: "Company folders, policies, and shared records.",
        },
        {
          key: "view_compliance",
          label: "Compliance",
          description: "Policies, evaluation runs, and compliance reporting.",
        },
        {
          key: "view_templates_forms",
          label: "Templates and forms",
          description: "Template library and form assignments.",
        },
        {
          key: "view_workspace_activity",
          label: "Activity and dashboards",
          description: "Cross-workspace activity beyond personal My Workspace items.",
        },
      ],
    },
  ],
};

const employeeArea: DmsPermissionArea = {
  id: "employee",
  title: "Employee files",
  description:
    "What this role can do on employee records. Effective reach is limited by the role’s employee scope (own team, department, or all employees).",
  groups: [
    {
      title: "Documents",
      items: [
        {
          key: "ef_view",
          label: "View documents",
          description: "Open folders and preview files within scope.",
        },
        {
          key: "ef_upload",
          label: "Upload and replace",
          description: "Add new files or replace existing versions.",
        },
        {
          key: "ef_download",
          label: "Download",
          description: "Download copies of files within scope.",
        },
        {
          key: "ef_approve",
          label: "Approve submissions",
          description: "Review and approve employee uploads.",
        },
        {
          key: "ef_archive",
          label: "Archive",
          description: "Move documents to archived state.",
        },
        {
          key: "ef_delete",
          label: "Delete",
          description: "Send documents to recycle bin or remove permanently where allowed.",
        },
        {
          key: "ef_export",
          label: "Export",
          description: "Bulk export employee file packages.",
        },
      ],
    },
    {
      title: "Configuration",
      items: [
        {
          key: "ef_manage_ef_settings",
          label: "Employee files settings",
          description: "Tenant options on the Employee files panel in Settings.",
        },
      ],
    },
  ],
};

function organizationArea(): DmsPermissionArea {
  const groups: DmsPermissionCatalogGroup[] = ORG_SECTION4_GROUPS.map((group) => ({
    title: group.title,
    items: group.columns
      .filter((column) => column.key !== "is_super_admin")
      .map((column) => ({
        key: column.key,
        label: column.label,
        description:
          column.hint ||
          orgFallbackDescription(column.key as string) ||
          "Organisational files capability.",
      })),
  })).filter((group) => group.items.length > 0);

  return {
    id: "organization",
    title: "Organisational files",
    description:
      "Permissions for shared folders, policies, approvals, and records management. Submit vs. no-approval pairs reflect whether changes enter the approval queue.",
    groups,
  };
}

function orgFallbackDescription(key: string): string {
  const map: Record<string, string> = {
    edit_without_approval: "Edit metadata without submitting for approval.",
    lock_unlock: "Lock or unlock folders and documents.",
    add_policy: "Create organisational policy folders.",
    activate_archive_policy: "Change policy lifecycle state.",
    assign_policy_ack_sign: "Assign policies for acknowledgement or signature.",
    view_hr_only_policies: "View policies marked HR-only.",
    acknowledge_sign_assigned_policy: "Complete assigned policy acknowledgements.",
    approve_reject_requests: "Act on organisational change requests.",
    automate: "Configure folder automation rules.",
    view_audit_activity: "View audit and activity history.",
  };
  return map[key] || "";
}

const complianceArea: DmsPermissionArea = {
  id: "compliance",
  title: "Compliance",
  description: "Employee compliance programmes—separate from organisational policy folders.",
  groups: [
    {
      title: "Programme access",
      items: [
        {
          key: "compliance_view",
          label: "View compliance data",
          description: "Policies, runs, evaluations, and status dashboards.",
        },
        {
          key: "compliance_export",
          label: "Export reports",
          description: "Download compliance run and summary exports.",
        },
      ],
    },
    {
      title: "Management",
      items: [
        {
          key: "compliance_manage_policies",
          label: "Manage policies",
          description: "Create, edit, and retire compliance policies and linked documents.",
        },
        {
          key: "compliance_run_evaluations",
          label: "Run evaluations",
          description: "Start runs, send requests, and update evaluation results.",
        },
        {
          key: "compliance_manage_exceptions",
          label: "Exceptions and waivers",
          description: "Record exemptions and override waiver restrictions where permitted.",
        },
      ],
    },
  ],
};

const templatesArea: DmsPermissionArea = {
  id: "templates",
  title: "Templates and forms",
  description: "Shared template library used across HR and organisational workflows.",
  groups: [
    {
      title: "Library",
      items: [
        {
          key: "templates_view",
          label: "Browse templates",
          description: "View categories, templates, and published forms.",
        },
        {
          key: "templates_create_edit",
          label: "Create and edit",
          description: "Upload templates, edit content, and manage revisions.",
        },
        {
          key: "templates_assign",
          label: "Assign to employees",
          description: "Distribute templates and forms to staff.",
        },
        {
          key: "templates_export",
          label: "Export",
          description: "Download template packages and exports.",
        },
      ],
    },
  ],
};

const platformArea: DmsPermissionArea = {
  id: "platform",
  title: "Platform administration",
  description: "Tenant-wide configuration. Typically reserved for the Super Admin role.",
  groups: [
    {
      title: "Settings",
      items: [
        {
          key: "manage_document_types",
          label: "Document types",
          description: "Define document types, categories, and approval defaults.",
        },
        {
          key: "manage_retention_lifecycle",
          label: "Retention and lifecycle",
          description: "Recycle bin, retention periods, and lifecycle defaults.",
        },
        {
          key: "manage_ef_tenant_config",
          label: "Employee files configuration",
          description: "Company defaults for employee file uploads and approvals.",
        },
        {
          key: "manage_org_tenant_config",
          label: "Organisational files configuration",
          description: "Default visibility, company-owned admins, and org library defaults.",
        },
        {
          key: "assign_dms_roles",
          label: "Role assignment",
          description: "Assign the six module roles to users.",
        },
      ],
    },
    {
      title: "Elevated access",
      items: [
        {
          key: "is_super_admin",
          label: "Super Admin",
          description:
            "Private organisational folders, protected deletes, and full platform settings.",
        },
      ],
    },
  ],
};

export const DMS_PERMISSION_AREAS: DmsPermissionArea[] = [
  workspaceArea,
  employeeArea,
  organizationArea(),
  complianceArea,
  templatesArea,
  platformArea,
];

export function allCatalogKeys(): string[] {
  const keys = new Set<string>();
  for (const area of DMS_PERMISSION_AREAS) {
    for (const group of area.groups) {
      for (const item of group.items) {
        keys.add(item.key);
      }
    }
  }
  return Array.from(keys);
}

export function countEnabledInArea(
  permissions: Partial<DmsPermissionsMap> | undefined,
  areaId: DmsPermissionAreaId,
): { enabled: number; total: number } {
  const area = DMS_PERMISSION_AREAS.find((item) => item.id === areaId);
  if (!area) return { enabled: 0, total: 0 };
  let total = 0;
  let enabled = 0;
  for (const group of area.groups) {
    for (const item of group.items) {
      total += 1;
      if (permissions?.[item.key]) enabled += 1;
    }
  }
  return { enabled, total };
}

export const EMPLOYEE_SCOPE_LABELS: Record<
  "own_team" | "department" | "all",
  string
> = {
  own_team: "Own team",
  department: "Department",
  all: "All employees",
};
