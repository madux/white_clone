"use client";

import { Lock, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useEmployeeFilesRoles } from "../../../../hooks/useEmployeeFilesRoles";
import type { EmployeeFilesRole } from "../../../../lib/types";
import EmptyState from "../EmptyState";
import StatusPill from "../StatusPill";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import RoleEditor from "./RoleEditor";

function defaultRole(): EmployeeFilesRole {
  return {
    name: "",
    description: "",
    active: true,
    employee_scope: "own_team",
    lines: [],
    assigned_user_ids: [],
    assigned_users: [],
    dms_permissions: {},
    role_template_key: "custom",
    is_system_template: false,
  };
}

function userCount(role: EmployeeFilesRole): number {
  return role.assigned_users?.length ?? role.assigned_user_ids?.length ?? 0;
}

function roleKindLabel(role: EmployeeFilesRole): string {
  return role.is_system_template ? "System" : "Custom";
}

export default function RolesSettingsPanel() {
  const rolesQuery = useEmployeeFilesRoles();
  const roles = rolesQuery.data || [];
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | "new" | null>(null);
  const [draft, setDraft] = useState<EmployeeFilesRole | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<EmployeeFilesRole | null>(null);
  const [editorDirty, setEditorDirty] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return roles;
    return roles.filter((role) => role.name.toLowerCase().includes(q));
  }, [roles, search]);

  useEffect(() => {
    if (selectedId !== null || rolesQuery.isLoading || roles.length === 0) return;
    const first = roles[0];
    if (first?.id) {
      setSelectedId(first.id);
      setSavedSnapshot({ ...first });
    }
  }, [roles, rolesQuery.isLoading, selectedId]);

  const selected =
    draft ||
    (selectedId === "new"
      ? defaultRole()
      : typeof selectedId === "number"
        ? roles.find((role) => role.id === selectedId) || null
        : null);

  function selectRole(id: number | "new") {
    setSelectedId(id);
    setDraft(null);
    setEditorDirty(false);
    if (id === "new") {
      const fresh = defaultRole();
      setSavedSnapshot(fresh);
    } else {
      const role = roles.find((item) => item.id === id);
      setSavedSnapshot(role ? { ...role } : null);
    }
  }

  return (
    <div className="grid gap-4 lg:h-[min(70vh,640px)] lg:min-h-[28rem] lg:max-h-[min(70vh,640px)] lg:grid-cols-[minmax(240px,280px)_1fr]">
      <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white lg:max-h-[min(70vh,640px)]">
        <div className="shrink-0 border-b border-slate-200 p-3">
          <InputGroup>
            <InputGroupAddon>
              <Search className="h-4 w-4" />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search roles…"
              aria-label="Search roles"
            />
          </InputGroup>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {rolesQuery.isLoading ? (
            <EmptyState title="Loading roles…" loading />
          ) : (
            <ul className="space-y-1">
              {filtered.map((role) => {
                const active = selectedId === role.id;
                const showEditing = active && editorDirty;
                return (
                  <li key={role.id}>
                    <button
                      type="button"
                      onClick={() => selectRole(role.id!)}
                      className={`flex w-full items-start gap-2 rounded-lg px-3 py-3 text-left text-sm transition ${
                        active
                          ? "bg-brand-pink/10 font-semibold text-slate-900 ring-1 ring-brand-pink/30"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      {role.is_system_template ? (
                        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                      ) : (
                        <span className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="block truncate">{role.name}</span>
                          {showEditing ? (
                            <StatusPill label="Editing" tone="attention" />
                          ) : null}
                        </span>
                        <span className="mt-0.5 block text-xs font-normal text-slate-500">
                          {roleKindLabel(role)} · {userCount(role)}{" "}
                          {userCount(role) === 1 ? "user" : "users"}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="shrink-0 border-t border-slate-200 p-3">
          <Button variant="outline" className="w-full" onClick={() => selectRole("new")}>
            <Plus data-icon="inline-start" />
            New role
          </Button>
        </div>
      </aside>

      <div className="flex min-h-[22rem] flex-col lg:h-full lg:min-h-0 lg:max-h-[min(70vh,640px)]">
        {selected && savedSnapshot ? (
          <RoleEditor
            role={selected}
            savedSnapshot={savedSnapshot}
            onChange={setDraft}
            onDirtyChange={setEditorDirty}
            onSaved={(saved) => {
              setDraft(null);
              setSelectedId(saved.id || null);
              setSavedSnapshot({ ...saved });
              setEditorDirty(false);
            }}
            onDeleted={() => {
              setDraft(null);
              setSelectedId(null);
              setSavedSnapshot(null);
              setEditorDirty(false);
            }}
            onCloned={(cloned) => {
              setDraft(null);
              setSelectedId(cloned.id || null);
              setSavedSnapshot({ ...cloned });
              setEditorDirty(false);
            }}
          />
        ) : (
          <div className="flex min-h-[22rem] flex-1 items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 lg:min-h-0">
            <EmptyState
              title="Select a role"
              description="Choose a role from the list or create a new custom role."
            />
          </div>
        )}
      </div>
    </div>
  );
}
