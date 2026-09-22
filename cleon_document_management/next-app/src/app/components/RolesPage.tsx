"use client";

import {
  AlertTriangle,
  KeyRound,
  LoaderCircle,
  Plus,
  Search,
  Shield,
  Trash2,
  UserRound,
  Users,
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
import { useToast } from "../../../hooks/useToast";
import type {
  EmployeeFilesRole,
  EmployeeFilesRoleLine,
  ModuleRoleAssignment,
  ModuleRoleDefinition,
  ModuleRoleMember,
} from "../../../lib/types";
import SectionTabs from "./SectionTabs";
import ThemedSelect from "./ThemedSelect";

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

const SECTION_ITEMS = [
  { id: "ef-roles" as const, label: "Employee Files roles", icon: Shield },
  { id: "assign" as const, label: "Assign to users", icon: Users },
  { id: "platform" as const, label: "Platform administrator", icon: KeyRound },
];

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
  };
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

export default function RolesPage({ embedded = false }: { embedded?: boolean }) {
  const { showToast } = useToast();
  const [section, setSection] = useState<"ef-roles" | "assign" | "platform">(
    "ef-roles",
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<number | "new" | null>(null);
  const [roleDraft, setRoleDraft] = useState<EmployeeFilesRole | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [draftRoleIds, setDraftRoleIds] = useState<number[] | null>(null);
  const [platformDraft, setPlatformDraft] = useState<ModuleRoleMember | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  const rolesQuery = useEmployeeFilesRoles();
  const docTypesQuery = useEmployeeFilesRoleDocumentTypes();
  const membersQuery = useEmployeeFilesRoleMembers(debouncedSearch);
  const saveRoleMutation = useSaveEmployeeFilesRole();
  const deleteRoleMutation = useDeleteEmployeeFilesRole();
  const assignEfMutation = useAssignEmployeeFilesRoles();

  const platformDefsQuery = useModuleRoleDefinitions(section === "platform");
  const platformMembersQuery = useModuleRoleMembers(
    debouncedSearch,
    section === "platform",
  );
  const assignPlatformMutation = useAssignModuleRoles();

  const roles = rolesQuery.data || [];
  const membersPayload = membersQuery.data;
  const efMembers = membersPayload?.members || [];
  const selectedMember =
    efMembers.find((member) => member.employee_id === selectedEmployeeId) || null;
  const activeRoleIds = draftRoleIds ?? selectedMember?.employee_files_role_ids ?? [];

  const selectedRole =
    roleDraft ||
    (typeof selectedRoleId === "number"
      ? roles.find((role) => role.id === selectedRoleId) || null
      : selectedRoleId === "new"
        ? defaultRole()
        : null);

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
  const platformMembers = platformMembersQuery.data || [];
  const platformMember =
    platformDraft ||
    platformMembers.find((member) => member.employee_id === selectedEmployeeId) ||
    null;

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
      showToast("Employee Files role saved.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Role could not be saved.",
        "error",
      );
    }
  }

  async function handleDeleteRole() {
    if (!selectedRole?.id) return;
    try {
      await deleteRoleMutation.mutateAsync(selectedRole.id);
      setRoleDraft(null);
      setSelectedRoleId(null);
      showToast("Role deleted.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Role could not be deleted.",
        "error",
      );
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
      showToast("Employee Files roles updated.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Assignments could not be updated.",
        "error",
      );
    }
  }

  async function handleSavePlatformRole() {
    if (!platformMember) return;
    const assignments: ModuleRoleAssignment[] = platformAssignable.map((role) => ({
      role_key: role.role_key,
      enabled: Boolean(platformMember.roles[role.role_key]),
    }));
    try {
      const updated = await assignPlatformMutation.mutateAsync({
        employee_id: platformMember.employee_id,
        assignments,
      });
      setPlatformDraft(updated);
      showToast("Platform administrator role updated.");
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

  const platformHasChanges =
    !!platformDraft &&
    JSON.stringify(platformDraft.roles) !==
      JSON.stringify(
        platformMembers.find((m) => m.employee_id === selectedEmployeeId)?.roles,
      );

  const inner = (
    <>
      <SectionTabs
        ariaLabel="Roles sections"
        value={section}
        onChange={setSection}
        items={SECTION_ITEMS}
      />

      {section === "ef-roles" && (
        <div className="roles-admin-grid">
          <aside className="roles-admin-panel roles-admin-sidebar">
            <div className="flex items-center justify-between gap-2">
              <p className="employee-filter-section-title">Roles</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-pink hover:text-brand-text"
                onClick={() => selectRole("new")}
              >
                <Plus size={14} aria-hidden />
                New
              </button>
            </div>
            <div className="roles-admin-list">
              {rolesQuery.isLoading && (
                <p className="roles-admin-empty">Loading roles…</p>
              )}
              {!rolesQuery.isLoading && !roles.length && (
                <p className="roles-admin-empty">No roles yet. Create one to get started.</p>
              )}
              {roles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className={`roles-admin-member ${selectedRoleId === role.id ? "active" : ""}`}
                  onClick={() => selectRole(role.id!)}
                >
                  <Shield size={16} className="shrink-0 text-brand-pink" aria-hidden />
                  <div className="min-w-0">
                    <strong>{role.name}</strong>
                    <span>{role.employee_scope.replace("_", " ")}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <div className="roles-admin-detail min-w-0">
            {!selectedRole && (
              <p className="roles-admin-empty">Select or create an Employee Files role.</p>
            )}
            {selectedRole && (
              <div className="roles-admin-panel space-y-5">
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
                    {selectedRole.id ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                        onClick={handleDeleteRole}
                        disabled={deleteRoleMutation.isPending}
                      >
                        <Trash2 size={14} aria-hidden />
                        Delete
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="primary-button"
                      onClick={handleSaveRole}
                      disabled={saveRoleMutation.isPending || !selectedRole.name.trim()}
                    >
                      {saveRoleMutation.isPending && (
                        <LoaderCircle size={16} className="spin" aria-hidden />
                      )}
                      Save role
                    </button>
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
              </div>
            )}
          </div>
        </div>
      )}

      {section === "assign" && (
        <div className="roles-admin-grid">
          <aside className="roles-admin-panel roles-admin-sidebar">
            <FieldLabel>Employee search</FieldLabel>
            <div className="roles-admin-search">
              <Search size={16} className="shrink-0 text-slate-400" aria-hidden />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email, or login"
                aria-label="Search employees"
              />
            </div>
            <div className="roles-admin-list">
              {membersQuery.isLoading && (
                <p className="roles-admin-empty">Searching…</p>
              )}
              {efMembers.map((member) => (
                <button
                  key={member.employee_id}
                  type="button"
                  className={`roles-admin-member ${selectedEmployeeId === member.employee_id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedEmployeeId(member.employee_id);
                    setDraftRoleIds(null);
                  }}
                >
                  <UserRound size={16} className="shrink-0 text-slate-400" aria-hidden />
                  <div className="min-w-0">
                    <strong>{member.employee_name}</strong>
                    <span>{member.department || "No department"}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>
          <div className="roles-admin-detail min-w-0">
            {!selectedMember && (
              <p className="roles-admin-empty">Select an employee to assign roles.</p>
            )}
            {selectedMember && (
              <div className="roles-admin-panel space-y-4">
                <h2 className="text-lg font-bold text-slate-900">
                  {selectedMember.employee_name}
                </h2>
                {!selectedMember.has_login && (
                  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                    <span>Link an Odoo user before assigning roles.</span>
                  </div>
                )}
                <div className="employee-filter-options flex-col !items-stretch">
                  {(membersPayload?.roles || []).map((role) => (
                    <label
                      key={role.id}
                      className="employee-filter-checkbox !rounded-xl !border !border-slate-200 !bg-white !px-3 !py-2.5"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 accent-pink-600"
                        checked={activeRoleIds.includes(role.id!)}
                        disabled={!selectedMember.has_login}
                        onChange={(event) => {
                          const next = event.target.checked
                            ? [...activeRoleIds, role.id!]
                            : activeRoleIds.filter((id) => id !== role.id);
                          setDraftRoleIds(Array.from(new Set(next)));
                        }}
                      />
                      <span className="flex flex-col gap-0.5">
                        <strong className="font-semibold text-slate-800">
                          {role.name}
                        </strong>
                        <span className="text-xs font-normal text-slate-500">
                          Scope: {role.employee_scope.replace("_", " ")}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    !selectedMember.has_login ||
                    !efAssignChanged ||
                    assignEfMutation.isPending
                  }
                  onClick={handleAssignEfRoles}
                >
                  Save assignments
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {section === "platform" && (
        <div className="roles-admin-grid">
          <aside className="roles-admin-panel roles-admin-sidebar">
            <FieldLabel>Employee search</FieldLabel>
            <div className="roles-admin-search">
              <Search size={16} className="shrink-0 text-slate-400" aria-hidden />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email, or login"
                aria-label="Search employees"
              />
            </div>
            <div className="roles-admin-list">
              {platformMembers.map((member) => (
                <button
                  key={member.employee_id}
                  type="button"
                  className={`roles-admin-member ${selectedEmployeeId === member.employee_id ? "active" : ""}`}
                  onClick={() => {
                    setSelectedEmployeeId(member.employee_id);
                    setPlatformDraft(null);
                  }}
                >
                  <UserRound size={16} className="shrink-0 text-slate-400" aria-hidden />
                  <div className="min-w-0">
                    <strong>{member.employee_name}</strong>
                    <span>{member.department || "No department"}</span>
                  </div>
                </button>
              ))}
            </div>
          </aside>
          <div className="roles-admin-detail min-w-0">
            {!platformMember && (
              <p className="roles-admin-empty">
                Select an employee to manage platform administrator access.
              </p>
            )}
            {platformMember && (
              <div className="roles-admin-panel space-y-4">
                <h2 className="text-lg font-bold text-slate-900">
                  {platformMember.employee_name}
                </h2>
                {platformAssignable.map((role) => (
                  <div key={role.role_key} className="roles-admin-toggle-row">
                    <div>
                      <strong>{role.label}</strong>
                      <p>{role.description}</p>
                      <small>{role.capabilities}</small>
                    </div>
                    <button
                      type="button"
                      className={`roles-admin-toggle ${platformMember.roles[role.role_key] ? "on" : ""}`}
                      disabled={!platformMember.has_login}
                      aria-pressed={Boolean(platformMember.roles[role.role_key])}
                      onClick={() => {
                        const base = platformDraft || platformMember;
                        setPlatformDraft({
                          ...base,
                          roles: {
                            ...base.roles,
                            [role.role_key]: !base.roles[role.role_key],
                            user: true,
                          },
                        });
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  className="primary-button"
                  disabled={
                    !platformMember.has_login ||
                    assignPlatformMutation.isPending ||
                    !platformHasChanges
                  }
                  onClick={handleSavePlatformRole}
                >
                  Save platform role
                </button>
              </div>
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
    <div className="min-h-full bg-[#f7f8fc] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1320px]">
        <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
          <div className="border-b border-slate-200 px-5 py-6 sm:px-8">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-pink">
              Document administration
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Roles & access</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              Custom Employee Files roles, user assignment, and platform administrator
              access.
            </p>
          </div>
          <div className="p-5 sm:p-8">
            <div className="roles-admin-page space-y-6">{inner}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
