"use client";

import { useMemo, useState } from "react";
import ModalDialog from "./ModalDialog";
import OrganizationalVisibilityFields, {
  accessScopeToVisibility,
  validateOrganizationalVisibility,
  visibilityToAccessScope,
  type OrgVisibilityMode,
} from "./OrganizationalVisibilityFields";
import {
  coerceVisibilityMode,
} from "../../../lib/organizationalFolderScope";
import {
  useComplianceTargets,
  useFolders,
  useUpdateFolder,
} from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";

export default function ManageAccessFolderModal({
  folderId,
  folderName,
  accessScope,
  departmentIds,
  gradeIds,
  employeeIds,
  onClose,
}: {
  folderId: number;
  folderName: string;
  accessScope: string;
  departmentIds: number[];
  gradeIds: number[];
  employeeIds: number[];
  onClose: () => void;
}) {
  const targets = useComplianceTargets();
  const folders = useFolders();
  const update = useUpdateFolder();
  const { showAlert } = useAppDialog();
  const parentAccessScope = useMemo(() => {
    const current = (folders.data ?? []).find((item) => item.id === folderId);
    const parentId = Number(current?.parent_id || 0);
    if (!parentId) return undefined;
    return (folders.data ?? []).find((item) => item.id === parentId)?.access_scope;
  }, [folderId, folders.data]);
  const initial = useMemo(() => accessScopeToVisibility(accessScope), [accessScope]);
  const [visibilityMode, setVisibilityMode] = useState<OrgVisibilityMode>(() =>
    coerceVisibilityMode(initial.mode, parentAccessScope),
  );
  const [restrictedScope, setRestrictedScope] = useState(initial.restrictedScope);
  const [scopeIds, setScopeIds] = useState<number[]>(() => {
    if (accessScope === "department") return departmentIds;
    if (accessScope === "grade") return gradeIds;
    if (accessScope === "individual") return employeeIds;
    return [];
  });
  const [scopeSearch, setScopeSearch] = useState("");

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextMode = coerceVisibilityMode(visibilityMode, parentAccessScope);
    const error = validateOrganizationalVisibility(
      nextMode,
      restrictedScope,
      scopeIds,
    );
    if (error) {
      await showAlert(error, { title: "Check access settings" });
      return;
    }
    const resolvedScope = visibilityToAccessScope(nextMode, restrictedScope);
    try {
      await update.mutateAsync({
        id: folderId,
        access_scope: resolvedScope,
        department_ids: resolvedScope === "department" ? scopeIds : [],
        grade_ids: resolvedScope === "grade" ? scopeIds : [],
        employee_ids: resolvedScope === "individual" ? scopeIds : [],
      });
      onClose();
    } catch (error) {
      await showAlert(
        error instanceof Error ? error.message : "Unable to save access.",
        { title: "Unable to save access" },
      );
    }
  };

  return (
    <ModalDialog
      title="Manage access"
      eyebrow={folderName}
      onClose={onClose}
      size="lg"
      zIndex={110}
    >
      <form onSubmit={save} className="grid gap-4">
        <OrganizationalVisibilityFields
          visibilityMode={visibilityMode}
          onVisibilityModeChange={(mode) => {
            setVisibilityMode(mode);
            if (mode !== "restricted") setScopeIds([]);
          }}
          restrictedScope={restrictedScope}
          onRestrictedScopeChange={(value) => {
            setRestrictedScope(value);
            setScopeIds([]);
          }}
          scopeIds={scopeIds}
          onScopeIdsChange={setScopeIds}
          scopeSearch={scopeSearch}
          onScopeSearchChange={setScopeSearch}
          departments={targets.data?.departments ?? []}
          grades={targets.data?.grades ?? []}
          employees={targets.data?.employees ?? []}
          parentAccessScope={parentAccessScope}
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="secondary-button">
            Cancel
          </button>
          <button
            type="submit"
            disabled={update.isPending}
            className="primary-button"
          >
            {update.isPending ? "Saving..." : "Save access"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
