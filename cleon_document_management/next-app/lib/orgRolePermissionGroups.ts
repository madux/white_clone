import type { OrganizationalPermissionKey } from "./types";

export type OrgPermissionGroup = {
  title: string;
  columns: {
    key: OrganizationalPermissionKey;
    label: string;
    hint: string;
  }[];
};

export const ORG_SECTION4_GROUPS: OrgPermissionGroup[] = [
  {
    title: "Library",
    columns: [
      {
        key: "view_org_files",
        label: "View library",
        hint: "Browse organisational folders within visibility rules",
      },
    ],
  },
  {
    title: "Folders",
    columns: [
      { key: "create_folder", label: "Create (submit)", hint: "Submit folder creation for approval" },
      {
        key: "create_folder_without_approval",
        label: "Create (no approval)",
        hint: "Create folders immediately",
      },
      { key: "create_collection", label: "Collections", hint: "Project / vendor collections" },
    ],
  },
  {
    title: "Upload",
    columns: [
      { key: "upload_link_import_scan", label: "Upload (submit)", hint: "Upload, link, import, scan" },
      { key: "upload_without_approval", label: "Upload (no approval)", hint: "Upload without approval queue" },
    ],
  },
  {
    title: "Edit & versions",
    columns: [
      { key: "edit_rename_description_colour", label: "Edit (submit)", hint: "Rename, description, colour" },
      { key: "edit_without_approval", label: "Edit (no approval)", hint: "" },
      { key: "replace_version", label: "Replace (submit)", hint: "Replace file version" },
      { key: "replace_version_without_approval", label: "Replace (no approval)", hint: "" },
      { key: "move", label: "Move (submit)", hint: "Move folder or document" },
      { key: "move_without_approval", label: "Move (no approval)", hint: "" },
    ],
  },
  {
    title: "Access & lifecycle",
    columns: [
      { key: "share_manage_access", label: "Manage access", hint: "Internal audience" },
      { key: "assign_document", label: "Assign", hint: "Assign documents or policies" },
      { key: "lock_unlock", label: "Lock / unlock", hint: "" },
      { key: "archive_restore", label: "Archive / restore", hint: "" },
      { key: "delete", label: "Delete (submit)", hint: "" },
      { key: "delete_without_approval", label: "Delete (no approval)", hint: "" },
      { key: "permanent_delete", label: "Permanent delete", hint: "Super Admin default" },
      { key: "delete_protected_override", label: "Protected delete", hint: "Override retention / hold guards" },
    ],
  },
  {
    title: "Records & external",
    columns: [
      { key: "place_release_legal_hold", label: "Legal hold", hint: "Place or release holds" },
      {
        key: "external_share_password_watermark",
        label: "External share",
        hint: "Password / watermark links",
      },
    ],
  },
  {
    title: "Policies",
    columns: [
      { key: "add_policy", label: "Add policy", hint: "" },
      { key: "activate_archive_policy", label: "Activate / archive", hint: "" },
      { key: "assign_policy_ack_sign", label: "Assign policy", hint: "" },
      { key: "view_hr_only_policies", label: "HR-only policies", hint: "" },
      {
        key: "acknowledge_sign_assigned_policy",
        label: "Ack / sign",
        hint: "Employee-facing assignments",
      },
    ],
  },
  {
    title: "Approvals & audit",
    columns: [
      { key: "approve_reject_requests", label: "Approve requests", hint: "" },
      { key: "automate", label: "Automate", hint: "" },
      { key: "view_audit_activity", label: "View audit", hint: "" },
      { key: "is_super_admin", label: "Super Admin", hint: "Private folders + elevated actions" },
    ],
  },
];

export const ORG_PERMISSION_KEYS: OrganizationalPermissionKey[] = ORG_SECTION4_GROUPS.flatMap(
  (group) => group.columns.map((column) => column.key),
);

export function defaultOrganizationalPermissions(): Record<OrganizationalPermissionKey, boolean> {
  return ORG_PERMISSION_KEYS.reduce(
    (acc, key) => {
      acc[key] = false;
      return acc;
    },
    {} as Record<OrganizationalPermissionKey, boolean>,
  );
}
