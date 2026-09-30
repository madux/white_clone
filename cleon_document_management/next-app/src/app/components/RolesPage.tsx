"use client";

import {
  AlertTriangle,
  Ellipsis,
  KeyRound,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Shield,
  Trash2,
  UserMinus,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  useAssignEmployeeFilesRoles,
  useDeleteEmployeeFilesRole,
  useEmployeeFilesRoleDocumentTypes,
  useEmployeeFilesRoleMembers,
  useEmployeeFilesRoles,
  useSaveEmployeeFilesRole,
} from "../../../hooks/useEmployeeFilesRoles";
import {
  useAssignModuleRoles,
  useModuleRoleDefinitions,
  useModuleRoleMembers,
} from "../../../hooks/useModuleRoles";
import { useAppDialog } from "../../../hooks/useAppDialog";
import { useToast } from "../../../hooks/useToast";
import type {
  EmployeeFilesRole,
  EmployeeFilesRoleLine,
  EmployeeFilesRoleMember,
  ModuleRoleDefinition,
  ModuleRoleMember,
  OrganizationalRoleActions,
} from "../../../lib/types";
import SectionTabs from "./SectionTabs";
import ThemedSelect from "./ThemedSelect";
import StatusPill from "./StatusPill";
import EmptyState from "./EmptyState";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EMPLOYEE_FILE_LIST_PAGE_SIZE } from "../../../lib/employeeFileListPageSize";
import { useClientPagination } from "../../../lib/useClientPagination";
import ListPagination from "./ListPagination";

const CATEGORY_GROUPS = [
  { value: "hr", label: "Human Resources" },
  { value: "finance", label: "Finance" },
  { value: "legal", label: "Legal" },
  { value: "identity", label: "Identity" },
  { value: "employment", label: "Employment" },
  { value: "medical", label: "Medical" },
  { value: "training", label: "Training" },
  { value: "other", label: "Other" },
] as const;

const SCOPE_OPTIONS = [
  { value: "own_team", label: "Own team" },
  { value: "department", label: "Department" },
  { value: "all", label: "All employees" },
];

const ACTION_COLUMNS = [
  { key: "view" as const, label: "View", hint: "Open and preview files" },
  { key: "upload" as const, label: "Upload", hint: "Add or replace documents" },
  { key: "approve" as const, label: "Approve", hint: "Review and approve submissions" },
  { key: "download" as const, label: "Download", hint: "Download file copies" },
  { key: "archive" as const, label: "Archive", hint: "Move documents to archived" },
  { key: "delete" as const, label: "Delete", hint: "Recycle bin and permanent removal" },
  { key: "export" as const, label: "Export", hint: "Bulk export employee files" },
  {
    key: "manage_settings" as const,
    label: "Settings",
    hint: "Employee Files configuration",
  },
] as const;

type ActionKey = (typeof ACTION_COLUMNS)[number]["key"];

const ACTION_KEYS: ActionKey[] = ACTION_COLUMNS.map((column) => column.key);

const ORG_ACCESS_GROUPS: {
  title: string;
  columns: {
    key: keyof OrganizationalRoleActions;
    label: string;
    hint: string;
  }[];
}[] = [
  {
    title: "Folders",
    columns: [
      {
        key: "access_library",
        label: "Library",
        hint: "Browse organizational folders within visibility rules",
      },
      {
        key: "create_folder",
        label: "Create folder",
        hint: "Create new organizational folders",
      },
      {
        key: "manage_folders",
        label: "Manage folders",
        hint: "Rename, description, colour, lock, and duplicate structure",
      },
      {
        key: "share_manage_access",
        label: "Manage access",
        hint: "Share or change folder audience",
      },
      {
        key: "folder_archive",
        label: "Archive",
        hint: "Archive organizational folders",
      },
      {
        key: "folder_delete",
        label: "Delete",
        hint: "Delete organizational folders",
      },
    ],
  },
  {
    title: "Documents",
    columns: [
      {
        key: "upload",
        label: "Upload",
        hint: "Upload files into organizational folders",
      },
      {
        key: "document_manage",
        label: "Manage",
        hint: "Link, copy, assign, version, print, and edit description",
      },
      {
        key: "document_manage_access",
        label: "Access",
        hint: "Change document-level audience",
      },
      {
        key: "document_delete",
        label: "Delete",
        hint: "Delete organizational documents",
      },
    ],
  },
];

function defaultOrganizationalActions(): OrganizationalRoleActions {
  return {
    access_library: false,
    create_folder: false,
    manage_folders: false,
    share_manage_access: false,
    folder_archive: false,
    folder_delete: false,
    upload: false,
    document_manage: false,
    document_manage_access: false,
    document_delete: false,
  };
}

const SECTION_ITEMS = [
  { id: "ef-roles" as const, label: "Custom roles", icon: Shield },
  { id: "assign" as const, label: "Assign to users", icon: Users },
  { id: "assigned" as const, label: "Assigned users", icon: UserRound },
  { id: "platform" as const, label: "Platform administrator", icon: KeyRound },
];

type RolesSection = (typeof SECTION_ITEMS)[number]["id"];

type AssignedRosterRow = {
  userId: number;
  name: string;
  login: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  employmentType: string;
  workLocation: string;
  branch: string;
  grade: string;
  roles: { id: number; name: string }[];
};

const INITIAL_ASSIGNED_FILTERS = {
  search: "",
  roleId: "all",
  department: "all",
};

function defaultLine(): EmployeeFilesRoleLine {
  return {
    applies_all_categories: true,
    actions: {
      view: true,
      upload: false,
      approve: false,
      download: true,
      archive: false,
      delete: false,
      export: false,
      manage_settings: false,
    },
  };
}

function defaultRole(): EmployeeFilesRole {
  return {
    name: "",
    description: "",
    active: true,
    employee_scope: "own_team",
    lines: [defaultLine()],
    assigned_user_ids: [],
    assigned_users: [],
    organizational_actions: defaultOrganizationalActions(),
  };
}

function assignedRoster(roles: EmployeeFilesRole[]): AssignedRosterRow[] {
  const byUser = new Map<number, AssignedRosterRow>();
  for (const role of roles) {
    if (!role.id) continue;
    for (const user of role.assigned_users || []) {
      const existing = byUser.get(user.id);
      if (existing) {
        if (!existing.roles.some((item) => item.id === role.id)) {
          existing.roles.push({ id: role.id, name: role.name });
        }
        continue;
      }
      byUser.set(user.id, {
        userId: user.id,
        name: user.name,
        login: user.login || "",
        employeeName: user.employee_name || user.name,
        department: user.department || "",
        jobTitle: user.job_title || "",
        employmentType: user.employment_type || "",
        workLocation: user.work_location || "",
        branch: user.branch || "",
        grade: user.grade || "",
        roles: [{ id: role.id, name: role.name }],
      });
    }
  }
  return Array.from(byUser.values()).sort((left, right) =>
    left.employeeName.localeCompare(right.employeeName),
  );
}

function scopeLabel(scope: EmployeeFilesRole["employee_scope"]) {
  return SCOPE_OPTIONS.find((option) => option.value === scope)?.label || scope;
}

function assignedUserCount(role: EmployeeFilesRole): number {
  if (role.assigned_users?.length) return role.assigned_users.length;
  return role.assigned_user_ids?.length || 0;
}

function memberAssignedRoleNames(
  member: EmployeeFilesRoleMember,
  roles: EmployeeFilesRole[],
): string {
  const names = member.employee_files_role_ids
    .map((roleId) => roles.find((role) => role.id === roleId)?.name)
    .filter((name): name is string => Boolean(name));
  return names.join(", ");
}

function FieldLabel({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <p className="mb-1.5 text-sm font-semibold text-slate-700" id={htmlFor}>
      {children}
    </p>
  );
}

function lineTargetSummary(
  line: EmployeeFilesRoleLine,
  docTypes: { id: number; name: string }[],
): string {
  if (line.applies_all_categories) return "All categories";
  if (line.document_type_id) {
    const match = docTypes.find((type) => type.id === line.document_type_id);
    return match ? `Type: ${match.name}` : "Document type";
  }
  if (line.category_group) {
    const group = CATEGORY_GROUPS.find((item) => item.value === line.category_group);
    return group ? `Group: ${group.label}` : "Category group";
  }
  return "Select a category target";
}

function CategoryAccessMatrix({
  lines,
  documentTypeOptions,
  onAddLine,
  onRemoveLine,
  onUpdateLine,
}: {
  lines: EmployeeFilesRoleLine[];
  documentTypeOptions: { value: string; label: string }[];
  onAddLine: () => void;
  onRemoveLine: (index: number) => void;
  onUpdateLine: (index: number, patch: Partial<EmployeeFilesRoleLine>) => void;
}) {
  const docTypes = documentTypeOptions.map((option) => ({
    id: Number(option.value),
    name: option.label,
  }));

  return (
    <div className="ef-role-access">
      <div className="ef-role-access__intro">
        <div>
          <p className="employee-filter-section-title">Category access</p>
          <p className="ef-role-access__hint">
            Each row defines which document categories this role can access and which
            actions are allowed. View must be enabled before other actions.
          </p>
        </div>
        <button type="button" className="ef-role-access__add" onClick={onAddLine}>
          <Plus size={14} aria-hidden />
          Add category row
        </button>
      </div>

      <div className="ef-role-access__rows">
        {lines.map((line, index) => (
          <article key={index} className="ef-role-access-row">
            <header className="ef-role-access-row__header">
              <div className="min-w-0 flex-1 space-y-3">
                <p className="ef-role-access-row__title">
                  {lineTargetSummary(line, docTypes)}
                </p>
                <div className="ef-role-access-row__target">
                  <label className="ef-role-access-target-toggle">
                    <input
                      type="checkbox"
                      checked={line.applies_all_categories}
                      onChange={(event) =>
                        onUpdateLine(index, {
                          applies_all_categories: event.target.checked,
                        })
                      }
                      className="h-4 w-4 rounded border-slate-300 accent-pink-600"
                    />
                    <span>All categories</span>
                  </label>
                  {!line.applies_all_categories && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <FieldLabel>Document type</FieldLabel>
                        <ThemedSelect
                          ariaLabel="Document type"
                          placeholder="Any type (optional)"
                          value={
                            line.document_type_id ? String(line.document_type_id) : ""
                          }
                          options={documentTypeOptions}
                          onChange={(value) =>
                            onUpdateLine(index, {
                              document_type_id: value ? Number(value) : false,
                              category_group: "",
                            })
                          }
                        />
                      </div>
                      <div>
                        <FieldLabel>Category group</FieldLabel>
                        <ThemedSelect
                          ariaLabel="Category group"
                          placeholder="Any group (optional)"
                          value={line.category_group || ""}
                          options={CATEGORY_GROUPS.map((option) => ({
                            value: option.value,
                            label: option.label,
                          }))}
                          onChange={(value) =>
                            onUpdateLine(index, {
                              category_group: value,
                              document_type_id: false,
                            })
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {lines.length > 1 ? (
                <button
                  type="button"
                  className="ef-role-access-row__remove"
                  onClick={() => onRemoveLine(index)}
                >
                  Remove
                </button>
              ) : null}
            </header>

            <div className="ef-role-access-matrix-wrap">
              <table className="ef-role-access-matrix">
                <thead>
                  <tr>
                    {ACTION_COLUMNS.map((column) => (
                      <th key={column.key} title={column.hint}>
                        <span className="ef-role-access-matrix__label">
                          {column.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {ACTION_COLUMNS.map((column) => {
                      const isOn = Boolean(line.actions[column.key]);
                      const disabled = column.key !== "view" && !line.actions.view;
                      return (
                        <td key={column.key}>
                          <label
                            className={`ef-role-access-matrix__cell ${
                              isOn ? "is-on" : ""
                            } ${disabled ? "is-disabled" : ""}`}
                            title={column.hint}
                          >
                            <input
                              type="checkbox"
                              checked={isOn}
                              disabled={disabled}
                              onChange={(event) =>
                                onUpdateLine(index, {
                                  actions: {
                                    ...line.actions,
                                    [column.key]: event.target.checked,
                                  },
                                })
                              }
                              className="sr-only"
                            />
                            <span
                              className="ef-role-access-matrix__check"
                              aria-hidden
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function OrganizationalAccessMatrix({
  actions,
  onChange,
}: {
  actions: OrganizationalRoleActions;
  onChange: (next: OrganizationalRoleActions) => void;
}) {
  return (
    <div className="ef-role-access">
      <div className="ef-role-access__intro">
        <div>
          <p className="employee-filter-section-title">Organizational Files</p>
          <p className="ef-role-access__hint">
            Controls access to the organizational library, folders, and shared
            documents. Unioned across all roles assigned to a user.
          </p>
        </div>
      </div>

      <div className="ef-role-access__rows">
        {ORG_ACCESS_GROUPS.map((group) => (
          <article key={group.title} className="ef-role-access-row">
            <header className="ef-role-access-row__header">
              <p className="ef-role-access-row__title">{group.title}</p>
            </header>
            <div className="ef-role-access-matrix-wrap">
              <table className="ef-role-access-matrix">
                <thead>
                  <tr>
                    {group.columns.map((column) => (
                      <th key={column.key} title={column.hint}>
                        <span className="ef-role-access-matrix__label">
                          {column.label}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {group.columns.map((column) => {
                      const isOn = Boolean(actions[column.key]);
                      return (
                        <td key={column.key}>
                          <label
                            className={`ef-role-access-matrix__cell ${
                              isOn ? "is-on" : ""
                            }`}
                            title={column.hint}
                          >
                            <input
                              type="checkbox"
                              checked={isOn}
                              onChange={(event) =>
                                onChange({
                                  ...actions,
                                  [column.key]: event.target.checked,
                                })
                              }
                              className="sr-only"
                            />
                            <span
                              className="ef-role-access-matrix__check"
                              aria-hidden
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default function RolesPage({ embedded = false }: { embedded?: boolean }) {
  const { showToast } = useToast();
  const { showConfirm } = useAppDialog();
  const [section, setSection] = useState<RolesSection>("ef-roles");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<number | "new" | null>(null);
  const [roleDraft, setRoleDraft] = useState<EmployeeFilesRole | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [assignTarget, setAssignTarget] = useState<EmployeeFilesRoleMember | null>(null);
  const [draftRoleIds, setDraftRoleIds] = useState<number[] | null>(null);
  const [assignedFilters, setAssignedFilters] = useState(INITIAL_ASSIGNED_FILTERS);
  const [revokingKey, setRevokingKey] = useState<string | null>(null);
  const [assignPage, setAssignPage] = useState(1);
  const [platformPage, setPlatformPage] = useState(1);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setAssignPage(1);
    setPlatformPage(1);
  }, [debouncedSearch]);

  const rolesQuery = useEmployeeFilesRoles();
  const docTypesQuery = useEmployeeFilesRoleDocumentTypes();
  const membersQuery = useEmployeeFilesRoleMembers(
    section === "assign" ? debouncedSearch : "",
    assignPage,
    section === "assign",
  );
  const saveRoleMutation = useSaveEmployeeFilesRole();
  const deleteRoleMutation = useDeleteEmployeeFilesRole();
  const assignEfMutation = useAssignEmployeeFilesRoles();

  const platformDefsQuery = useModuleRoleDefinitions(section === "platform");
  const platformMembersQuery = useModuleRoleMembers(
    debouncedSearch,
    platformPage,
    section === "platform",
  );
  const assignPlatformMutation = useAssignModuleRoles();

  const roles = rolesQuery.data || [];
  const membersPayload = membersQuery.data;
  const efMembersRaw = membersPayload?.members || [];
  const assignTotal = membersPayload?.total ?? efMembersRaw.length;
  const assignServerPaged = membersPayload?.page != null && membersPayload?.page_size != null;
  const efMembers = assignServerPaged
    ? efMembersRaw
    : efMembersRaw.slice(
        (assignPage - 1) * EMPLOYEE_FILE_LIST_PAGE_SIZE,
        assignPage * EMPLOYEE_FILE_LIST_PAGE_SIZE,
      );
  const selectedMember =
    efMembers.find((member) => member.employee_id === selectedEmployeeId) ||
    (assignTarget?.employee_id === selectedEmployeeId ? assignTarget : null);
  const activeRoleIds = draftRoleIds ?? selectedMember?.employee_files_role_ids ?? [];

  const selectedRole =
    roleDraft ||
    (typeof selectedRoleId === "number"
      ? roles.find((role) => role.id === selectedRoleId) || null
      : selectedRoleId === "new"
        ? defaultRole()
        : null);
  const assignableRoles = membersPayload?.roles?.length ? membersPayload.roles : roles;
  const roster = useMemo(() => assignedRoster(roles), [roles]);
  const assignedDepartments = useMemo(
    () =>
      Array.from(
        new Set(roster.map((row) => row.department).filter(Boolean)),
      ).sort((left, right) => left.localeCompare(right)),
    [roster],
  );
  const filteredRoster = useMemo(() => {
    const query = assignedFilters.search.trim().toLowerCase();
    return roster.filter((row) => {
      if (
        assignedFilters.roleId !== "all" &&
        !row.roles.some((role) => String(role.id) === assignedFilters.roleId)
      ) {
        return false;
      }
      if (
        assignedFilters.department !== "all" &&
        row.department !== assignedFilters.department
      ) {
        return false;
      }
      if (query) {
        const haystack = [
          row.employeeName,
          row.name,
          row.login,
          row.department,
          row.jobTitle,
          row.employmentType,
          row.workLocation,
          row.branch,
          row.grade,
          ...row.roles.map((role) => role.name),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [assignedFilters, roster]);
  const assignedFilterCount = [
    assignedFilters.roleId !== "all",
    assignedFilters.department !== "all",
  ].filter(Boolean).length;
  const pagedRoles = useClientPagination(roles, roles.length);
  const pagedRoster = useClientPagination(
    filteredRoster,
    `${filteredRoster.length}:${assignedFilters.search}:${assignedFilters.roleId}:${assignedFilters.department}`,
  );

  const documentTypeOptions = useMemo(
    () =>
      (docTypesQuery.data || []).map((docType) => ({
        value: String(docType.id),
        label: docType.name,
      })),
    [docTypesQuery.data],
  );

  const platformAssignable = useMemo(
    () =>
      (platformDefsQuery.data || []).filter(
        (role): role is ModuleRoleDefinition & { role_key: "admin" } =>
          role.assignable && role.role_key === "admin",
      ),
    [platformDefsQuery.data],
  );
  const platformPayload = platformMembersQuery.data;
  const platformMembersRaw = platformPayload?.members || [];
  const platformTotal = platformPayload?.total ?? platformMembersRaw.length;
  const platformServerPaged =
    platformPayload?.page != null && platformPayload?.page_size != null;
  const platformMembers = platformServerPaged
    ? platformMembersRaw
    : platformMembersRaw.slice(
        (platformPage - 1) * EMPLOYEE_FILE_LIST_PAGE_SIZE,
        platformPage * EMPLOYEE_FILE_LIST_PAGE_SIZE,
      );

  function patchRole(patch: Partial<EmployeeFilesRole>) {
    if (!selectedRole) return;
    setRoleDraft({ ...selectedRole, ...patch });
  }

  function selectRole(roleId: number | "new") {
    setSelectedRoleId(roleId);
    setRoleDraft(null);
  }

  function updateLine(index: number, patch: Partial<EmployeeFilesRoleLine>) {
    if (!selectedRole) return;
    const lines = [...selectedRole.lines];
    const current = { ...lines[index], ...patch };
    if (patch.actions) {
      current.actions = { ...lines[index].actions, ...patch.actions };
      if (!current.actions.view) {
        for (const key of ACTION_KEYS) {
          if (key !== "view") current.actions[key] = false;
        }
      }
    }
    lines[index] = current;
    setRoleDraft({ ...selectedRole, lines });
  }

  async function handleSaveRole() {
    if (!selectedRole) return;
    try {
      const saved = await saveRoleMutation.mutateAsync(selectedRole);
      setRoleDraft(null);
      setSelectedRoleId(saved.id || null);
      showToast("Role saved.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Role could not be saved.",
        "error",
      );
    }
  }

  async function handleDeleteRole(role?: EmployeeFilesRole) {
    const target = role || selectedRole;
    if (!target?.id) return;
    const confirmed = await showConfirm(
      `Delete ${target.name}? Assigned users will lose this role.`,
      {
        title: "Delete role",
        confirmLabel: "Delete",
        tone: "danger",
      },
    );
    if (!confirmed) return;
    try {
      await deleteRoleMutation.mutateAsync(target.id);
      if (selectedRoleId === target.id) {
        setRoleDraft(null);
        setSelectedRoleId(null);
      }
      showToast("Role deleted.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Role could not be deleted.",
        "error",
      );
    }
  }

  async function handleRevokeRole(row: AssignedRosterRow, roleId?: number) {
    const remaining = roleId
      ? row.roles.filter((role) => role.id !== roleId).map((role) => role.id)
      : [];
    const roleName = roleId
      ? row.roles.find((role) => role.id === roleId)?.name
      : null;
    const confirmed = await showConfirm(
      roleId
        ? `Remove ${roleName} from ${row.employeeName}? They will keep any other assigned roles.`
        : `Remove all custom roles from ${row.employeeName}?`,
      {
        title: roleId ? "Revoke role" : "Revoke all roles",
        confirmLabel: "Revoke",
        tone: "danger",
      },
    );
    if (!confirmed) return;
    const key = `${row.userId}:${roleId || "all"}`;
    setRevokingKey(key);
    try {
      await assignEfMutation.mutateAsync({
        user_id: row.userId,
        role_ids: remaining,
      });
      showToast(
        roleId
          ? `${roleName} removed from ${row.employeeName}.`
          : `All custom roles removed from ${row.employeeName}.`,
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Role could not be revoked.",
        "error",
      );
    } finally {
      setRevokingKey(null);
    }
  }

  async function handleAssignEfRoles() {
    if (!selectedMember?.user_id) return;
    try {
      await assignEfMutation.mutateAsync({
        user_id: selectedMember.user_id,
        role_ids: activeRoleIds,
      });
      setDraftRoleIds(null);
      showToast("Roles updated.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Assignments could not be updated.",
        "error",
      );
    }
  }

  async function handleTogglePlatformAdmin(member: ModuleRoleMember, enabled: boolean) {
    try {
      await assignPlatformMutation.mutateAsync({
        employee_id: member.employee_id,
        assignments: platformAssignable.map((role) => ({
          role_key: role.role_key,
          enabled,
        })),
      });
      showToast(
        enabled
          ? `${member.employee_name} is now a platform administrator.`
          : `Platform administrator access removed from ${member.employee_name}.`,
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Platform role not updated.",
        "error",
      );
    }
  }

  const efAssignChanged =
    draftRoleIds !== null &&
    JSON.stringify(draftRoleIds) !==
      JSON.stringify(selectedMember?.employee_files_role_ids || []);

  const inner = (
    <>
      <SectionTabs
        ariaLabel="Roles sections"
        value={section}
        onChange={setSection}
        items={SECTION_ITEMS}
        level={embedded ? "nested" : "page"}
      />

      {section === "ef-roles" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {roles.length} custom {roles.length === 1 ? "role" : "roles"}
            </p>
            <Button onClick={() => selectRole("new")}>
              <Plus data-icon="inline-start" />
              New role
            </Button>
          </div>
          <div className="app-table-well">
            {rolesQuery.isLoading ? (
              <p className="roles-admin-empty">Loading roles…</p>
            ) : !roles.length && selectedRoleId !== "new" ? (
              <EmptyState
                title="No custom roles yet"
                description="Create a role to control Employee Files and Organizational Files access."
                action={
                  <Button onClick={() => selectRole("new")}>
                    <Plus data-icon="inline-start" />
                    New role
                  </Button>
                }
              />
            ) : roles.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRoles.items.map((role) => {
                    const count = assignedUserCount(role);
                    const selected = selectedRoleId === role.id;
                    return (
                      <TableRow
                        key={role.id}
                        data-state={selected ? "selected" : undefined}
                      >
                        <TableCell>
                          <button
                            type="button"
                            className="text-left font-semibold hover:underline"
                            onClick={() => selectRole(role.id!)}
                          >
                            {role.name}
                          </button>
                          {role.description ? (
                            <p className="max-w-md truncate text-xs text-muted-foreground">
                              {role.description}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell>{scopeLabel(role.employee_scope)}</TableCell>
                        <TableCell>
                          {count === 1 ? "1 user" : `${count} users`}
                        </TableCell>
                        <TableCell>
                          <StatusPill
                            label={role.active === false ? "Inactive" : "Active"}
                          />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Actions for ${role.name}`}
                                >
                                  <Ellipsis />
                                </Button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuGroup>
                                <DropdownMenuItem onClick={() => selectRole(role.id!)}>
                                  <Pencil />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => void handleDeleteRole(role)}
                                >
                                  <Trash2 />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuGroup>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : null}
            {roles.length ? (
              <ListPagination
                page={pagedRoles.page}
                pageSize={pagedRoles.pageSize}
                total={pagedRoles.total}
                onPageChange={pagedRoles.setPage}
              />
            ) : null}
          </div>
          {selectedRole ? (
            <div className="space-y-5 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {selectedRole.id ? "Edit role" : "New role"}
                    </p>
                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedRole.name || "Untitled role"}
                    </h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelectedRoleId(null);
                        setRoleDraft(null);
                      }}
                    >
                      Close
                    </Button>
                    {selectedRole.id ? (
                      <Button
                        variant="destructive"
                        onClick={() => void handleDeleteRole(selectedRole)}
                        disabled={deleteRoleMutation.isPending}
                      >
                        <Trash2 data-icon="inline-start" />
                        Delete
                      </Button>
                    ) : null}
                    <Button
                      onClick={handleSaveRole}
                      disabled={saveRoleMutation.isPending || !selectedRole.name.trim()}
                    >
                      {saveRoleMutation.isPending ? (
                        <LoaderCircle data-icon="inline-start" className="animate-spin" />
                      ) : null}
                      Save role
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <FieldLabel>Role name</FieldLabel>
                    <input
                      className="field"
                      value={selectedRole.name}
                      onChange={(event) => patchRole({ name: event.target.value })}
                      placeholder="e.g. HR business partner"
                    />
                  </div>
                  <div>
                    <FieldLabel>Employee scope</FieldLabel>
                    <ThemedSelect
                      ariaLabel="Employee scope"
                      value={selectedRole.employee_scope}
                      options={SCOPE_OPTIONS}
                      onChange={(value) =>
                        patchRole({
                          employee_scope: value as EmployeeFilesRole["employee_scope"],
                        })
                      }
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>Description</FieldLabel>
                  <textarea
                    className="field min-h-[4.5rem] resize-y"
                    rows={2}
                    value={selectedRole.description || ""}
                    onChange={(event) => patchRole({ description: event.target.value })}
                    placeholder="Optional summary for administrators"
                  />
                </div>

                <CategoryAccessMatrix
                  lines={selectedRole.lines}
                  documentTypeOptions={documentTypeOptions}
                  onAddLine={() =>
                    patchRole({
                      lines: [...selectedRole.lines, defaultLine()],
                    })
                  }
                  onRemoveLine={(index) =>
                    patchRole({
                      lines: selectedRole.lines.filter((_, i) => i !== index),
                    })
                  }
                  onUpdateLine={updateLine}
                />
                <OrganizationalAccessMatrix
                  actions={
                    selectedRole.organizational_actions ||
                    defaultOrganizationalActions()
                  }
                  onChange={(organizational_actions) =>
                    patchRole({ organizational_actions })
                  }
                />
            </div>
          ) : null}
        </div>
      )}

      {section === "assign" && (
        <div className="space-y-4">
          <InputGroup className="max-w-md">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, department, grade, location, or login"
              aria-label="Search employees"
            />
          </InputGroup>
          <div className="app-table-well">
            {membersQuery.isLoading ? (
              <p className="roles-admin-empty">Searching…</p>
            ) : !assignTotal ? (
              <EmptyState
                title="No employees found"
                description="Try a name, department, grade, location, or other EMS group."
              />
            ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {efMembers.map((member) => {
                    const assignedNames = memberAssignedRoleNames(member, assignableRoles);
                    const selected = selectedEmployeeId === member.employee_id;
                    return (
                      <TableRow
                        key={member.employee_id}
                        data-state={selected ? "selected" : undefined}
                      >
                        <TableCell className="font-semibold">
                          {member.employee_name}
                        </TableCell>
                        <TableCell>{member.department || "No department"}</TableCell>
                        <TableCell>
                          {member.has_login ? member.user_login || "Linked" : "No login"}
                        </TableCell>
                        <TableCell>
                          {assignedNames || (member.has_login ? "None" : "—")}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEmployeeId(member.employee_id);
                              setAssignTarget(member);
                              setDraftRoleIds(null);
                            }}
                          >
                            Assign
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <ListPagination
                page={assignPage}
                pageSize={EMPLOYEE_FILE_LIST_PAGE_SIZE}
                total={assignTotal}
                onPageChange={setAssignPage}
              />
              </>
            )}
          </div>
          {selectedMember ? (
            <div className="space-y-4 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Assign roles
                    </p>
                    <h2 className="text-lg font-bold text-slate-900">
                      {selectedMember.employee_name}
                    </h2>
                  </div>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setSelectedEmployeeId(null);
                      setAssignTarget(null);
                      setDraftRoleIds(null);
                    }}
                  >
                    Close
                  </Button>
                </div>
                {!selectedMember.has_login && (
                  <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                    <span>Link an Odoo user before assigning roles.</span>
                  </div>
                )}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Role</TableHead>
                      <TableHead>Scope</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(membersPayload?.roles || []).map((role) => (
                      <TableRow key={role.id}>
                        <TableCell>
                          <Checkbox
                            checked={activeRoleIds.includes(role.id!)}
                            disabled={!selectedMember.has_login}
                            onCheckedChange={(value) => {
                              const checked = value === true;
                              const next = checked
                                ? [...activeRoleIds, role.id!]
                                : activeRoleIds.filter((id) => id !== role.id);
                              setDraftRoleIds(Array.from(new Set(next)));
                            }}
                            aria-label={`Assign ${role.name}`}
                          />
                        </TableCell>
                        <TableCell className="font-semibold">{role.name}</TableCell>
                        <TableCell>{scopeLabel(role.employee_scope)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Button
                  disabled={
                    !selectedMember.has_login ||
                    !efAssignChanged ||
                    assignEfMutation.isPending
                  }
                  onClick={handleAssignEfRoles}
                >
                  Save assignments
                </Button>
            </div>
          ) : null}
        </div>
      )}

      {section === "assigned" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <InputGroup className="flex-1">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                  value={assignedFilters.search}
                  onChange={(event) =>
                    setAssignedFilters((current) => ({
                      ...current,
                      search: event.target.value,
                    }))
                  }
                  placeholder="Search assigned users by name, department, grade, location, or role..."
              />
            </InputGroup>
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-52">
                  <ThemedSelect
                    value={assignedFilters.roleId}
                    onChange={(value) =>
                      setAssignedFilters((current) => ({ ...current, roleId: value }))
                    }
                    placeholder="All roles"
                    options={[
                      { value: "all", label: "All roles" },
                      ...roles
                        .filter((role) => role.id)
                        .map((role) => ({
                          value: String(role.id),
                          label: role.name,
                        })),
                    ]}
                  />
                </div>
                <div className="w-48">
                  <ThemedSelect
                    value={assignedFilters.department}
                    onChange={(value) =>
                      setAssignedFilters((current) => ({
                        ...current,
                        department: value,
                      }))
                    }
                    placeholder="All departments"
                    options={[
                      { value: "all", label: "All departments" },
                      ...assignedDepartments.map((department) => ({
                        value: department,
                        label: department,
                      })),
                    ]}
                  />
                </div>
                {assignedFilterCount > 0 || assignedFilters.search ? (
                  <button
                    type="button"
                    onClick={() => setAssignedFilters(INITIAL_ASSIGNED_FILTERS)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  >
                    <X className="h-3.5 w-3.5" />
                    Reset
                  </button>
                ) : null}
              </div>
          </div>

          <div className="app-table-well">
            {rolesQuery.isLoading ? (
              <p className="roles-admin-empty">Loading assigned users…</p>
            ) : !roster.length ? (
              <p className="roles-admin-empty">
                No users are assigned to custom roles yet. Use Assign to users to grant
                access.
              </p>
            ) : !filteredRoster.length ? (
              <p className="roles-admin-empty">
                No assigned users match the current filters.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRoster.items.map((row) => {
                    const busy = revokingKey?.startsWith(`${row.userId}:`);
                    return (
                      <TableRow key={row.userId}>
                        <TableCell className="font-semibold">
                          {row.employeeName}
                        </TableCell>
                        <TableCell>{row.department || "No department"}</TableCell>
                        <TableCell>{row.login || "—"}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {row.roles.map((role) => {
                              const key = `${row.userId}:${role.id}`;
                              return (
                                <span key={role.id} className="roles-assigned-chip">
                                  {role.name}
                                  <button
                                    type="button"
                                    onClick={() => handleRevokeRole(row, role.id)}
                                    disabled={assignEfMutation.isPending}
                                    aria-label={`Revoke ${role.name} from ${row.employeeName}`}
                                  >
                                    {revokingKey === key ? (
                                      <LoaderCircle size={12} className="spin" />
                                    ) : (
                                      <X size={12} />
                                    )}
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={assignEfMutation.isPending}
                            onClick={() => handleRevokeRole(row)}
                          >
                            {revokingKey === `${row.userId}:all` ? (
                              <LoaderCircle data-icon="inline-start" className="animate-spin" />
                            ) : (
                              <UserMinus data-icon="inline-start" />
                            )}
                            {busy ? "Revoking…" : "Revoke all"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
            {filteredRoster.length ? (
              <ListPagination
                page={pagedRoster.page}
                pageSize={pagedRoster.pageSize}
                total={pagedRoster.total}
                onPageChange={pagedRoster.setPage}
              />
            ) : null}
          </div>
        </div>
      )}

      {section === "platform" && (
        <div className="space-y-4">
          <InputGroup className="max-w-md">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, department, grade, location, or login"
              aria-label="Search employees"
            />
          </InputGroup>
          <div className="app-table-well">
            {platformMembersQuery.isLoading ? (
              <p className="roles-admin-empty">Searching…</p>
            ) : !platformTotal ? (
              <EmptyState
                title="No employees found"
                description="Try a name, department, grade, location, or other EMS group."
              />
            ) : (
              <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Department</TableHead>
                    <TableHead>Login</TableHead>
                    <TableHead>Administrator</TableHead>
                    <TableHead className="w-12">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {platformMembers.map((member) => {
                    const isAdmin = Boolean(member.roles.admin);
                    return (
                      <TableRow key={member.employee_id}>
                        <TableCell className="font-semibold">
                          {member.employee_name}
                        </TableCell>
                        <TableCell>{member.department || "No department"}</TableCell>
                        <TableCell>
                          {member.has_login ? member.user_login || "Linked" : "No login"}
                        </TableCell>
                        <TableCell>
                          <StatusPill
                            label={isAdmin ? "Administrator" : "User"}
                            tone={isAdmin ? "ok" : "neutral"}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant={isAdmin ? "outline" : "default"}
                            size="sm"
                            disabled={
                              !member.has_login || assignPlatformMutation.isPending
                            }
                            onClick={() =>
                              void handleTogglePlatformAdmin(member, !isAdmin)
                            }
                          >
                            {isAdmin ? "Revoke" : "Grant"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <ListPagination
                page={platformPage}
                pageSize={EMPLOYEE_FILE_LIST_PAGE_SIZE}
                total={platformTotal}
                onPageChange={setPlatformPage}
              />
              </>
            )}
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="roles-admin-page is-embedded space-y-6">{inner}</div>;
  }

  return (
    <div className="app-page">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-6">
          <p className="text-xs font-bold uppercase tracking-wider text-brand-pink">
            Document administration
          </p>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Roles & access</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Custom roles for Employee Files and Organizational Files, user
            assignment, and platform administrator access.
          </p>
        </div>
        <div className="p-5 sm:p-6">
          <div className="roles-admin-page space-y-6">{inner}</div>
        </div>
      </section>
    </div>
  );
}
