"use client";

import {
  Archive,
  Copy,
  Ellipsis,
  FileHeart,
  FolderInput,
  Info,
  Pin,
  Printer,
  ScanLine,
  ToggleLeft,
  ToggleRight,
  Users,
  Workflow,
} from "lucide-react";
import type { DocDocument } from "../../../lib/types";
import DocumentDetailsPanel from "./DocumentDetailsPanel";
import { useEffect, useRef, useState } from "react";
import { api } from "../../../lib/api";
import {
  canArchiveEmployeeDocuments,
  canAutomateEmployeeDocuments,
  canDeleteEmployeeDocuments,
} from "../../../lib/employeeFilesAccess";
import {
  useCurrentUser,
  useDocumentAction,
  useDocumentsAction,
  useFolders,
} from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import { useClickOutside } from "../../../hooks/useClickOutside";
import { offlineMessage, useOnlineStatus } from "../../../lib/useOnlineStatus";
import ManageAccessDocumentModal from "./ManageAccessDocumentModal";
import FolderPickerDialog from "./FolderPickerDialog";
import ModalDialog from "./ModalDialog";
import DocumentAutomateDialog from "./DocumentAutomateDialog";
import EmployeeMetricPicker from "./EmployeeMetricPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  canManageOrgDocumentAccess,
  canManageOrgDocuments,
} from "../../../lib/organizationalFilesAccess";
import { documentInDraftPolicyFolder } from "../../../lib/draftPolicyFolder";
import {
  filterEmployeesForFolderScope,
  folderAccessFromDocument,
  type FolderAccessContext,
} from "../../../lib/organizationalDocumentAccess";
import { useComplianceTargets } from "../../../hooks/useDocuments";
import ActionMenuCategory from "./ActionMenuCategory";
import { ORG_ACTION_MENU_CATEGORIES } from "../../../lib/orgActionCatalog";

export default function DocumentActions({
  documentId,
  documentName,
  document,
  active,
  organizational = false,
  folderId,
  onMove,
  deleteRelatedIds = [],
  orgUseFolderAccess = true,
  orgAccessScope = "",
  orgDepartmentIds = [],
  orgGradeIds = [],
  orgEmployeeIds = [],
  folderLocked = false,
  sourceUrl,
  linkStatus,
  draftPolicyFolder = false,
  folderAccess = null,
}: {
  documentId: number;
  documentName: string;
  document?: DocDocument | null;
  active?: boolean;
  organizational?: boolean;
  folderId?: number;
  onMove?: () => void;
  deleteRelatedIds?: number[];
  orgUseFolderAccess?: boolean;
  orgAccessScope?: string;
  orgDepartmentIds?: number[];
  orgGradeIds?: number[];
  orgEmployeeIds?: number[];
  folderLocked?: boolean;
  sourceUrl?: string;
  linkStatus?: string;
  /** When true, only Details and Organise (favorite, pin, move) are available. */
  draftPolicyFolder?: boolean;
  folderAccess?: FolderAccessContext | null;
}) {
  const action = useDocumentAction();
  const complianceTargets = useComplianceTargets(organizational);
  const bulkAction = useDocumentsAction();
  const folders = useFolders();
  const draftPolicy =
    draftPolicyFolder ||
    (organizational ? documentInDraftPolicyFolder(document) : false);
  const resolvedFolderAccess =
    folderAccess ?? (organizational ? folderAccessFromDocument(document) : null);
  const assignableEmployees = filterEmployeesForFolderScope(
    complianceTargets.data?.employees ?? [],
    resolvedFolderAccess,
  );
  const currentUser = useCurrentUser();
  const { showConfirm, showAlert } = useAppDialog();
  const online = useOnlineStatus();
  const canArchive =
    active !== false &&
    (organizational
      ? canManageOrgDocuments(currentUser.data)
      : canArchiveEmployeeDocuments(currentUser.data) ||
        canDeleteEmployeeDocuments(currentUser.data));
  const policyRegistryId =
    document?.organizational_policy_id && Number(document.organizational_policy_id) > 0
      ? Number(document.organizational_policy_id)
      : null;
  const showPolicyEmployeeAssign =
    organizational && Boolean(policyRegistryId) && document?.is_policy === true;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [manageAccessOpen, setManageAccessOpen] = useState(false);
  const [copyToOpen, setCopyToOpen] = useState(false);
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(documentName);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activityRefreshKey, setActivityRefreshKey] = useState(0);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmployeeIds, setAssignEmployeeIds] = useState<number[]>([]);
  const [automateOpen, setAutomateOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const canManage = canManageOrgDocuments(currentUser.data);
  const canManageAccess = canManageOrgDocumentAccess(currentUser.data);
  const canAutomate = organizational
    ? canManage
    : canAutomateEmployeeDocuments(currentUser.data);

  useClickOutside(rootRef, () => setOpen(false));
  useEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const menuHeight = organizational ? 420 : canArchive ? 220 : 180;
    setPosition({
      top: Math.max(12, Math.min(rect.top, window.innerHeight - menuHeight - 16)),
      right: Math.max(12, window.innerWidth - rect.right),
    });
  }, [open, organizational, canArchive]);

  const guardOnline = async () => {
    if (online) return true;
    await showAlert(offlineMessage(), { title: "You're offline" });
    return false;
  };

  const run = async (
    name: "favorite" | "pin" | "delete" | "archive" | "activate" | "deactivate",
  ) => {
    if (!(await guardOnline())) return;
    if (name === "delete") {
      const deleteIds = [documentId, ...deleteRelatedIds.filter((id) => id !== documentId)];
      const message =
        deleteIds.length > 1
          ? `Move "${documentName}" and all related versions to the recycle bin?`
          : `Move "${documentName}" to the recycle bin?`;
      if (
        !(await showConfirm(message, {
          title: "Move to recycle bin",
          confirmLabel: "Move",
        }))
      )
        return;
      await bulkAction.mutateAsync({ document_ids: deleteIds, action: "delete" });
      setOpen(false);
      return;
    }
    if (name === "archive") {
      const message = organizational
        ? `Archive "${documentName}"? It will be removed from everyone it is shared with until restored.`
        : `Archive "${documentName}"? It will leave active employee file lists. Restore it from Archived when needed.`;
      if (
        !(await showConfirm(message, {
          title: "Archive document",
          confirmLabel: "Archive",
        }))
      )
        return;
    }
    await action.mutateAsync({ id: documentId, action: name });
    setOpen(false);
  };

  const copyLink = async () => {
    if (!(await guardOnline())) return;
    const folderPart = folderId || "";
    const url = `${window.location.origin}/document-management/pages/organization/folder?folder=${folderPart}&doc=${documentId}`;
    await navigator.clipboard.writeText(url);
    await showAlert("Link copied. It does not change who can open the document.", {
      title: "Copy link",
    });
    setOpen(false);
  };

  return (
    <div ref={rootRef} onClick={(event) => event.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={`Actions for ${documentName}`}
        className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"
      >
        <Ellipsis className="h-5 w-5" />
      </button>
      {open && (
        <div
          className="org-action-sheet fixed z-[100] w-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 text-left shadow-2xl"
          style={{ top: position.top, right: position.right, maxHeight: "70vh" }}
        >
          <ActionMenuCategory label={ORG_ACTION_MENU_CATEGORIES.information} />
          <button type="button" onClick={() => { setDetailsOpen(true); setOpen(false); }} className="menu-item">
            <Info />
            Details
          </button>
          <ActionMenuCategory label={ORG_ACTION_MENU_CATEGORIES.organise} />
          <button type="button" onClick={() => run("favorite")} className="menu-item">
            <FileHeart />
            Favorite
          </button>
          <button type="button" onClick={() => run("pin")} className="menu-item">
            <Pin />
            Pin document
          </button>
          {organizational && canManage && !folderLocked && onMove && (
            <button
              type="button"
              onClick={() => {
                onMove();
                setOpen(false);
              }}
              className="menu-item"
            >
              <FolderInput />
              Move to folder
            </button>
          )}
          {!draftPolicy && organizational && canManage && !folderLocked && (
            <>
              <button type="button" onClick={() => { setCopyToOpen(true); setOpen(false); }} className="menu-item">
                <Copy />
                Copy to
              </button>
              <button type="button" onClick={() => { setShortcutOpen(true); setOpen(false); }} className="menu-item">
                <ScanLine />
                Add shortcut
              </button>
            </>
          )}
          {!draftPolicy && organizational && canManage && !folderLocked && (
            <button
              type="button"
              className="menu-item"
              onClick={() =>
                void api.createOrganizationalTemplate(documentId).then(() => setOpen(false))
              }
            >
              Create template
            </button>
          )}
          {!draftPolicy && organizational && (
            <ActionMenuCategory label={ORG_ACTION_MENU_CATEGORIES.access} />
          )}
          {!draftPolicy && organizational && canManageAccess && !folderLocked && (
            <button
              type="button"
              onClick={() => {
                setManageAccessOpen(true);
                setOpen(false);
              }}
              className="menu-item"
            >
              <Users />
              Manage access
            </button>
          )}
          {!draftPolicy && organizational && canManage && showPolicyEmployeeAssign && (
            <button
              type="button"
              onClick={() => {
                setAssignEmployeeIds([]);
                setAssignOpen(true);
                setOpen(false);
              }}
              className="menu-item"
            >
              <Users />
              Assign to employee
            </button>
          )}
          {!draftPolicy && organizational && canManage && !showPolicyEmployeeAssign && (
            <button
              type="button"
              onClick={() => {
                setAssignEmployeeIds([]);
                setAssignOpen(true);
                setOpen(false);
              }}
              className="menu-item"
            >
              <Users />
              Grant individual access
            </button>
          )}
          {!draftPolicy ? (
            <>
              <ActionMenuCategory label={ORG_ACTION_MENU_CATEGORIES.lifecycle} />
              {!draftPolicy && canAutomate && (
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setAutomateOpen(true);
                    setOpen(false);
                  }}
                >
                  <Workflow />
                  Automate
                </button>
              )}
              {canArchive ? (
                <button type="button" onClick={() => run("archive")} className="menu-item">
                  <Archive />
                  Archive document
                </button>
              ) : null}
              {organizational && (
                <button
                  type="button"
                  onClick={() => run(active === false ? "activate" : "deactivate")}
                  className="menu-item"
                >
                  {active === false ? <ToggleRight /> : <ToggleLeft />}
                  {active === false ? "Activate document" : "Deactivate document"}
                </button>
              )}
              {organizational && (
                <button
                  type="button"
                  onClick={async () => {
                    await action.mutateAsync({ id: documentId, action: "print" });
                    api.downloadDocument(documentId);
                    setOpen(false);
                  }}
                  className="menu-item"
                >
                  <Printer />
                  Print
                </button>
              )}
            </>
          ) : null}
          {!draftPolicy && sourceUrl ? (
            <button
              type="button"
              className="menu-item"
              onClick={() =>
                void api.refreshOrganizationalLinkStatus(documentId).then((result) =>
                  showAlert(`Link status: ${result.data?.link_status || linkStatus || "unchecked"}`, {
                    title: "Linked file",
                  }),
                )
              }
            >
              Check link
            </button>
          ) : null}
        </div>
      )}
      {detailsOpen ? (
        <DocumentDetailsPanel
          documentId={documentId}
          documentName={documentName}
          document={document}
          organizational={organizational}
          onClose={() => setDetailsOpen(false)}
          onDownload={() => api.downloadDocument(documentId)}
          onShare={draftPolicy ? undefined : () => void copyLink()}
          onRename={
            !draftPolicy && organizational && canManage && !folderLocked
              ? () => {
                  setRenameValue(documentName);
                  setRenameOpen(true);
                }
              : undefined
          }
          onMove={
            onMove && !folderLocked
              ? () => {
                  setDetailsOpen(false);
                  onMove();
                }
              : undefined
          }
          onDelete={
            draftPolicy
              ? undefined
              : () => void run("delete").then(() => setDetailsOpen(false))
          }
          onManageAccess={
            !draftPolicy && organizational && canManageAccess && !folderLocked
              ? () => setManageAccessOpen(true)
              : undefined
          }
          versionHistoryReadOnly={draftPolicy}
          activityRefreshKey={activityRefreshKey}
        />
      ) : null}
      {manageAccessOpen && organizational && (
        <ManageAccessDocumentModal
          documentId={documentId}
          documentName={documentName}
          orgUseFolderAccess={orgUseFolderAccess}
          orgAccessScope={orgAccessScope}
          orgDepartmentIds={orgDepartmentIds}
          orgGradeIds={orgGradeIds}
          orgEmployeeIds={orgEmployeeIds}
          folderAccess={resolvedFolderAccess}
          onClose={() => setManageAccessOpen(false)}
          onSaved={() => setActivityRefreshKey((key) => key + 1)}
        />
      )}
      {copyToOpen ? (
        <FolderPickerDialog
          title="Copy to folder"
          eyebrow="Copy to"
          description="Creates a copy in the destination folder. The original file stays where it is."
          folders={folders.data ?? []}
          confirmLabel="Copy"
          pending={action.isPending}
          onClose={() => setCopyToOpen(false)}
          onPick={async (id) => {
            if (!id) return;
            const result = await api.copyOrganizationalDocument({
              document_id: documentId,
              folder_id: id,
            });
            if (!result.success) {
              await showAlert(result.message || "Copy failed.", { title: "Copy to" });
              return;
            }
            setCopyToOpen(false);
          }}
        />
      ) : null}
      {shortcutOpen ? (
        <FolderPickerDialog
          title="Add shortcut"
          eyebrow="Shortcut"
          description="Creates a reference in another folder. It does not copy the file."
          folders={folders.data ?? []}
          confirmLabel="Add shortcut"
          onClose={() => setShortcutOpen(false)}
          onPick={async (id) => {
            if (!id) return;
            const result = await api.createOrganizationalShortcut({
              document_id: documentId,
              folder_id: id,
            });
            if (!result.success) {
              await showAlert(result.message || "Unable to add shortcut.", {
                title: "Add shortcut",
              });
              return;
            }
            setShortcutOpen(false);
          }}
        />
      ) : null}
      {renameOpen ? (
        <ModalDialog title="Rename document" onClose={() => setRenameOpen(false)} size="sm" zIndex={110}>
          <Input value={renameValue} onChange={(event) => setRenameValue(event.target.value)} />
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                void api
                  .renameOrganizationalDocument({
                    document_id: documentId,
                    name: renameValue,
                  })
                  .then(() => setRenameOpen(false))
              }
            >
              Save
            </Button>
          </div>
        </ModalDialog>
      ) : null}
      {assignOpen ? (
        <ModalDialog
          title={
            showPolicyEmployeeAssign ? "Assign policy to employee" : "Grant individual access"
          }
          description={
            showPolicyEmployeeAssign
              ? "Assign this organizational policy to an employee file. This is separate from sharing the document in Manage access."
              : "Grant this employee access to the document without widening folder visibility."
          }
          onClose={() => setAssignOpen(false)}
          size="md"
          zIndex={110}
        >
          <EmployeeMetricPicker
            mode="single"
            selectedIds={assignEmployeeIds}
            onChange={(ids) => setAssignEmployeeIds(ids)}
            employees={assignableEmployees}
            placeholder="Search employees by name, department, or job title…"
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!assignEmployeeIds.length}
              onClick={() =>
                void (async () => {
                  if (showPolicyEmployeeAssign && policyRegistryId) {
                    const result = await api.assignPolicyToEmployee({
                      policy_id: policyRegistryId,
                      employee_id: assignEmployeeIds[0],
                    });
                    if (!result.success) {
                      await showAlert(result.message || "Unable to assign this policy.", {
                        title: "Assign policy",
                      });
                      return;
                    }
                  } else {
                    const result = await api.updateOrganizationalDocumentAccess({
                      document_id: documentId,
                      org_use_folder_access: false,
                      org_access_scope: "individual",
                      org_employee_ids: assignEmployeeIds,
                    });
                    if (result && (result as { success?: boolean }).success === false) {
                      await showAlert(
                        (result as { message?: string }).message ||
                          "Unable to update document access.",
                        { title: "Grant access" },
                      );
                      return;
                    }
                  }
                  setAssignOpen(false);
                })()
              }
            >
              {showPolicyEmployeeAssign ? "Assign policy" : "Grant access"}
            </Button>
          </div>
        </ModalDialog>
      ) : null}
      {automateOpen ? (
        <DocumentAutomateDialog
          library={organizational ? "organizational" : "employee"}
          documentId={documentId}
          documentName={documentName}
          onClose={() => setAutomateOpen(false)}
        />
      ) : null}
    </div>
  );
}
