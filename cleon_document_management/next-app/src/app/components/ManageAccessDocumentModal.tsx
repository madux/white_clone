"use client";

import { useState } from "react";
import ModalDialog from "./ModalDialog";
import OrganizationalAccessScopeFields, {
  validateOrganizationalScope,
} from "./OrganizationalAccessScopeFields";
import { useComplianceTargets } from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import { api } from "../../../lib/api";

export default function ManageAccessDocumentModal({
  documentId,
  documentName,
  orgUseFolderAccess,
  orgAccessScope,
  orgDepartmentIds,
  orgGradeIds,
  orgEmployeeIds,
  onClose,
}: {
  documentId: number;
  documentName: string;
  orgUseFolderAccess: boolean;
  orgAccessScope?: string;
  orgDepartmentIds: number[];
  orgGradeIds: number[];
  orgEmployeeIds: number[];
  onClose: () => void;
}) {
  const targets = useComplianceTargets();
  const { showAlert } = useAppDialog();
  const [useFolderAccess, setUseFolderAccess] = useState(orgUseFolderAccess);
  const [accessScope, setAccessScope] = useState(orgAccessScope || "department");
  const [scopeIds, setScopeIds] = useState<number[]>(() => {
    if (orgAccessScope === "department") return orgDepartmentIds;
    if (orgAccessScope === "grade") return orgGradeIds;
    if (orgAccessScope === "individual") return orgEmployeeIds;
    return [];
  });
  const [scopeSearch, setScopeSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!useFolderAccess) {
      const error = validateOrganizationalScope(accessScope, scopeIds);
      if (error) {
        await showAlert(error, { title: "Check access settings" });
        return;
      }
    }
    setSaving(true);
    try {
      await api.updateOrganizationalDocumentAccess({
        document_id: documentId,
        org_use_folder_access: useFolderAccess,
        org_access_scope: useFolderAccess ? "" : accessScope,
        org_department_ids:
          !useFolderAccess && accessScope === "department" ? scopeIds : [],
        org_grade_ids: !useFolderAccess && accessScope === "grade" ? scopeIds : [],
        org_employee_ids:
          !useFolderAccess && accessScope === "individual" ? scopeIds : [],
      });
      onClose();
    } catch (error) {
      await showAlert(
        error instanceof Error ? error.message : "Unable to save access.",
        { title: "Unable to save access" },
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalDialog
      title="Manage document access"
      eyebrow={documentName}
      onClose={onClose}
      size="lg"
      zIndex={110}
    >
      <form onSubmit={save} className="grid gap-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={useFolderAccess}
            onChange={(event) => setUseFolderAccess(event.target.checked)}
            className="h-4 w-4 accent-pink-600"
          />
          Use folder access (recommended)
        </label>
        {!useFolderAccess ? (
          <OrganizationalAccessScopeFields
            accessScope={accessScope}
            onAccessScopeChange={setAccessScope}
            scopeIds={scopeIds}
            onScopeIdsChange={setScopeIds}
            scopeSearch={scopeSearch}
            onScopeSearchChange={setScopeSearch}
            departments={targets.data?.departments ?? []}
            grades={targets.data?.grades ?? []}
            employees={targets.data?.employees ?? []}
            hideAdminOnly
          />
        ) : null}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="secondary-button">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="primary-button">
            Save
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
