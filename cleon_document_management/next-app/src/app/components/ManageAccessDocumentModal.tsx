"use client";

import { useEffect, useState } from "react";
import ModalDialog from "./ModalDialog";
import { useCurrentUser } from "../../../hooks/useDocuments";
import { canExternalShareOrg } from "../../../lib/organizationalFilesAccess";
import OrganizationalAccessScopeFields, {
  validateOrganizationalScope,
} from "./OrganizationalAccessScopeFields";
import { useComplianceTargets } from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import { api } from "../../../lib/api";
import {
  allowedDocumentAccessScopes,
  filterDepartmentsForFolderScope,
  filterEmployeesForFolderScope,
  filterGradesForFolderScope,
  initialDocumentAccessScope,
  type FolderAccessContext,
} from "../../../lib/organizationalDocumentAccess";
import { coerceAccessScope } from "../../../lib/organizationalFolderScope";

export default function ManageAccessDocumentModal({
  documentId,
  documentName,
  orgUseFolderAccess,
  orgAccessScope,
  orgDepartmentIds,
  orgGradeIds,
  orgEmployeeIds,
  folderAccess,
  onClose,
  onSaved,
}: {
  documentId: number;
  documentName: string;
  orgUseFolderAccess: boolean;
  orgAccessScope?: string;
  orgDepartmentIds: number[];
  orgGradeIds: number[];
  orgEmployeeIds: number[];
  folderAccess?: FolderAccessContext | null;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const targets = useComplianceTargets();
  const resolvedFolderAccess = folderAccess ?? null;
  const { showAlert } = useAppDialog();
  const [useFolderAccess, setUseFolderAccess] = useState(orgUseFolderAccess);
  const [accessScope, setAccessScope] = useState(
    initialDocumentAccessScope(resolvedFolderAccess, orgAccessScope),
  );
  const [scopeIds, setScopeIds] = useState<number[]>(() => {
    if (orgAccessScope === "department") return orgDepartmentIds;
    if (orgAccessScope === "grade") return orgGradeIds;
    if (orgAccessScope === "individual") return orgEmployeeIds;
    return [];
  });
  const [scopeSearch, setScopeSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const currentUserQuery = useCurrentUser();
  const currentUser = currentUserQuery.data;
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
      onSaved?.();
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
            onAccessScopeChange={(value) => {
              setAccessScope(coerceAccessScope(value, resolvedFolderAccess?.access_scope));
              setScopeIds([]);
              if (value === "private" || value === "admin_only" || value === "company_owned") {
                setUseFolderAccess(false);
              }
            }}
            scopeIds={scopeIds}
            onScopeIdsChange={setScopeIds}
            scopeSearch={scopeSearch}
            onScopeSearchChange={setScopeSearch}
            departments={filterDepartmentsForFolderScope(
              targets.data?.departments ?? [],
              resolvedFolderAccess,
            )}
            grades={filterGradesForFolderScope(
              targets.data?.grades ?? [],
              resolvedFolderAccess,
            )}
            employees={filterEmployeesForFolderScope(
              targets.data?.employees ?? [],
              resolvedFolderAccess,
            )}
            allowedScopes={allowedDocumentAccessScopes(resolvedFolderAccess)}
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
