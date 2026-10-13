"use client";

import { Copy, LoaderCircle, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  useCloneEmployeeFilesRole,
  useDeleteEmployeeFilesRole,
  useEmployeeFilesRoleEditorContext,
  useSaveEmployeeFilesRole,
} from "../../../../hooks/useEmployeeFilesRoles";
import { diffPermissionKeys } from "../../../../lib/rolePermissionRules";
import { ensureFixedCategoryLines } from "../../../../lib/roleCategoryLines";
import type { RoleMatrixModuleRow } from "../../../../lib/rolePermissionsMatrix";
import type { EmployeeFilesRole } from "../../../../lib/types";
import { useAppDialog } from "../../../../hooks/useAppDialog";
import { useToast } from "../../../../hooks/useToast";
import StatusPill from "../StatusPill";
import { SettingsFieldHelp } from "../EmployeeFilesOrganizingDimensionsSettings";
import { Button } from "@/components/ui/button";
import ModalDialog from "../ModalDialog";
import RolePermissionsMatrix from "./RolePermissionsMatrix";

function assignedUserCount(role: EmployeeFilesRole): number {
  return role.assigned_users?.length ?? role.assigned_user_ids?.length ?? 0;
}

export default function RoleEditor({
  role,
  savedSnapshot,
  onChange,
  onSaved,
  onDeleted,
  onCloned,
  onDirtyChange,
}: {
  role: EmployeeFilesRole;
  savedSnapshot: EmployeeFilesRole;
  onChange: (role: EmployeeFilesRole) => void;
  onSaved: (role: EmployeeFilesRole) => void;
  onDeleted: () => void;
  onCloned: (role: EmployeeFilesRole) => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const { showToast } = useToast();
  const { showConfirm } = useAppDialog();
  const [summaryOpen, setSummaryOpen] = useState(false);
  const contextQuery = useEmployeeFilesRoleEditorContext();
  const saveMutation = useSaveEmployeeFilesRole();
  const deleteMutation = useDeleteEmployeeFilesRole();
  const cloneMutation = useCloneEmployeeFilesRole();

  const readOnly = Boolean(role.is_system_template);
  const userCount = assignedUserCount(role);
  const modulesEnabled = contextQuery.data?.modules_enabled || {};

  const roleForSave = useMemo(() => {
    const lines = ensureFixedCategoryLines(role);
    return { ...role, lines };
  }, [role]);

  const permDiff = useMemo(
    () =>
      diffPermissionKeys(
        savedSnapshot.dms_permissions || {},
        roleForSave.dms_permissions || {},
      ),
    [savedSnapshot, roleForSave],
  );
  const changeCount = permDiff.added.length + permDiff.removed.length;
  const isDirty =
    changeCount > 0 ||
    roleForSave.name !== savedSnapshot.name ||
    roleForSave.description !== savedSnapshot.description ||
    roleForSave.employee_scope !== savedSnapshot.employee_scope ||
    JSON.stringify(roleForSave.lines) !== JSON.stringify(savedSnapshot.lines);

  const showDirty = isDirty && !readOnly;

  useEffect(() => {
    onDirtyChange?.(showDirty);
  }, [showDirty, onDirtyChange]);

  function moduleOffForRow(row: RoleMatrixModuleRow) {
    return Boolean(row.moduleKey && modulesEnabled[row.moduleKey] === false);
  }

  async function performSave() {
    try {
      const saved = await saveMutation.mutateAsync(roleForSave);
      onSaved(saved);
      setSummaryOpen(false);
      showToast("Role saved.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Role could not be saved.",
        "error",
      );
    }
  }

  function requestSave() {
    if (!roleForSave.name.trim()) {
      showToast("Role name is required.", "error");
      return;
    }
    if (userCount > 0 && changeCount > 0) {
      setSummaryOpen(true);
      return;
    }
    void performSave();
  }

  async function handleClone() {
    if (!role.id) return;
    try {
      const cloned = await cloneMutation.mutateAsync(role.id);
      onCloned(cloned);
      showToast("Role cloned.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Could not clone role.",
        "error",
      );
    }
  }

  async function handleDelete() {
    if (!role.id || readOnly) return;
    const count = assignedUserCount(role);
    if (count > 0) {
      showToast(`Move these ${count} users to another role first.`, "error");
      return;
    }
    const confirmed = await showConfirm(`Delete ${role.name}?`, {
      title: "Delete role",
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
    try {
      await deleteMutation.mutateAsync(role.id);
      onDeleted();
      showToast("Role deleted.");
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Role could not be deleted.",
        "error",
      );
    }
  }

  const displayName = role.name.trim() || "New role";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
      <header className="shrink-0 border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-bold text-slate-900">{displayName}</span>
              <SettingsFieldHelp
                label={`${displayName} permissions`}
                text={
                  readOnly
                    ? "System roles are read-only. Clone to customise."
                    : "Ticking any action adds View automatically where required."
                }
              />
              {readOnly ? (
                <StatusPill label="System" tone="locked" />
              ) : (
                <StatusPill label="Custom" tone="neutral" />
              )}
              {showDirty ? <StatusPill label="Editing" tone="attention" /> : null}
            </div>
            {!readOnly ? (
              <div className="grid max-w-2xl gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                    Role name
                  </span>
                  <input
                    className="field w-full"
                    value={role.name}
                    onChange={(event) =>
                      onChange({ ...role, name: event.target.value })
                    }
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-bold uppercase text-slate-500">
                    Description
                  </span>
                  <input
                    className="field w-full"
                    value={role.description || ""}
                    onChange={(event) =>
                      onChange({ ...role, description: event.target.value })
                    }
                  />
                </label>
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {role.id ? (
              <Button variant="outline" size="sm" onClick={() => void handleClone()}>
                <Copy data-icon="inline-start" className="h-4 w-4" />
                Clone
              </Button>
            ) : null}
            {!readOnly && role.id ? (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600"
                onClick={() => void handleDelete()}
              >
                <Trash2 data-icon="inline-start" className="h-4 w-4" />
                Delete
              </Button>
            ) : null}
            <Button
              size="sm"
              disabled={!isDirty || saveMutation.isPending || readOnly}
              onClick={requestSave}
            >
              {saveMutation.isPending ? (
                <LoaderCircle data-icon="inline-start" className="animate-spin" />
              ) : null}
              Save changes
              {changeCount > 0 ? (
                <span className="ml-1.5 rounded-full bg-white/25 px-1.5 text-xs">
                  {changeCount}
                </span>
              ) : null}
            </Button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4">
        <RolePermissionsMatrix
          role={roleForSave}
          readOnly={readOnly}
          moduleOffForRow={moduleOffForRow}
          onChange={onChange}
          onHint={(message) => showToast(message)}
        />
      </div>

      {summaryOpen ? (
        <ModalDialog
          title="Confirm role changes"
          description={`${userCount} users will be affected.`}
          onClose={() => setSummaryOpen(false)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setSummaryOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void performSave()} disabled={saveMutation.isPending}>
                Confirm save
              </Button>
            </div>
          }
        >
          <ul className="space-y-2 text-sm">
            {permDiff.added.length ? (
              <li>
                <strong>Added:</strong> {permDiff.added.join(", ")}
              </li>
            ) : null}
            {permDiff.removed.length ? (
              <li>
                <strong>Removed:</strong> {permDiff.removed.join(", ")}
              </li>
            ) : null}
          </ul>
        </ModalDialog>
      ) : null}
    </div>
  );
}
