"use client";

import {
  Archive,
  Copy,
  Ellipsis,
  FileHeart,
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
  canDeleteEmployeeDocuments,
} from "../../../lib/employeeFilesAccess";
import { useCurrentUser, useDocumentAction, useFolders } from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import { useClickOutside } from "../../../hooks/useClickOutside";
import { offlineMessage, useOnlineStatus } from "../../../lib/useOnlineStatus";
import ManageAccessDocumentModal from "./ManageAccessDocumentModal";
import FolderPickerDialog from "./FolderPickerDialog";
import ModalDialog from "./ModalDialog";
import ThemedSelect from "./ThemedSelect";
import EmployeeMetricPicker from "./EmployeeMetricPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  canManageOrgDocumentAccess,
  canManageOrgDocuments,
} from "../../../lib/organizationalFilesAccess";

function Category({ label }: { label: string }) {
  return (
    <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
      {label}
    </p>
  );
}

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
}) {
  const action = useDocumentAction();
  const folders = useFolders();
  const currentUser = useCurrentUser();
  const { showConfirm, showAlert } = useAppDialog();
  const online = useOnlineStatus();
  const canArchive =
    active !== false &&
    (organizational
      ? canManageOrgDocuments(currentUser.data)
      : canArchiveEmployeeDocuments(currentUser.data) ||
        canDeleteEmployeeDocuments(currentUser.data));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [manageAccessOpen, setManageAccessOpen] = useState(false);
  const [copyToOpen, setCopyToOpen] = useState(false);
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState(documentName);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignEmployeeIds, setAssignEmployeeIds] = useState<number[]>([]);
  const [automateOpen, setAutomateOpen] = useState(false);
  const [autoName, setAutoName] = useState("");
  const [autoTrigger, setAutoTrigger] = useState("document_updated");
  const [autoAction, setAutoAction] = useState("notify_owner");
  const [autoCondition, setAutoCondition] = useState("");
  const [autoItems, setAutoItems] = useState<any[]>([]);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const canManage = canManageOrgDocuments(currentUser.data);
  const canManageAccess = canManageOrgDocumentAccess(currentUser.data);

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
      for (const id of deleteIds) {
        await action.mutateAsync({ id, action: "delete" });
      }
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
          <Category label="Information" />
          <button type="button" onClick={() => { setDetailsOpen(true); setOpen(false); }} className="menu-item">
            <Info />
            Details
          </button>
          <Category label="Organise" />
          <button type="button" onClick={() => run("favorite")} className="menu-item">
            <FileHeart />
            Favorite
          </button>
          <button type="button" onClick={() => run("pin")} className="menu-item">
            <Pin />
            Pin document
          </button>
          {organizational && canManage && !folderLocked && (
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
          {organizational && canManage && !folderLocked && (
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
          {organizational && (
            <Category label="Access" />
          )}
          {organizational && canManageAccess && !folderLocked && (
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
          {organizational && canManage && (
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
              Assign
            </button>
          )}
          {organizational && canManage && (
            <button
              type="button"
              className="menu-item"
              onClick={() =>
                void (async () => {
                  const result = await api.organizationalAutomations({
                    document_id: documentId,
                    op: "list",
                  });
                  setAutoItems(result.data?.items ?? []);
                  setAutomateOpen(true);
                  setOpen(false);
                })()
              }
            >
              <Workflow />
              Automate
            </button>
          )}
          <Category label="Lifecycle" />
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
          {sourceUrl ? (
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
          onShare={() => void copyLink()}
          onRename={
            organizational && canManage && !folderLocked
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
          onDelete={() => void run("delete").then(() => setDetailsOpen(false))}
          onManageAccess={
            organizational && canManageAccess && !folderLocked
              ? () => setManageAccessOpen(true)
              : undefined
          }
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
          onClose={() => setManageAccessOpen(false)}
        />
      )}
      {copyToOpen ? (
        <FolderPickerDialog
          title="Copy to folder"
          eyebrow="Copy to"
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
          title="Assign to employee"
          description="Grant this employee access to the document without widening folder visibility."
          onClose={() => setAssignOpen(false)}
          size="md"
          zIndex={110}
        >
          <EmployeeMetricPicker
            mode="single"
            selectedIds={assignEmployeeIds}
            onChange={(ids) => setAssignEmployeeIds(ids)}
            placeholder="Search employees by name, department, or job title…"
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAssignOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={!assignEmployeeIds.length}
              onClick={() =>
                void api
                  .updateOrganizationalDocumentAccess({
                    document_id: documentId,
                    org_use_folder_access: false,
                    org_access_scope: "individual",
                    org_employee_ids: assignEmployeeIds,
                  })
                  .then(() => setAssignOpen(false))
              }
            >
              Assign
            </Button>
          </div>
        </ModalDialog>
      ) : null}
      {automateOpen ? (
        <ModalDialog title="Automate" onClose={() => setAutomateOpen(false)} size="lg">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-semibold">Name</span>
              <Input value={autoName} onChange={(event) => setAutoName(event.target.value)} />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-semibold">Trigger</span>
              <ThemedSelect
                value={autoTrigger}
                onChange={setAutoTrigger}
                options={[
                  "document_updated",
                  "new_version",
                  "document_approved",
                  "document_rejected",
                  "document_signed",
                  "approaching_expiry",
                  "expired",
                ].map((value) => ({ value, label: value.replaceAll("_", " ") }))}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-semibold">Action</span>
              <ThemedSelect
                value={autoAction}
                onChange={setAutoAction}
                options={[
                  { value: "notify_owner", label: "Notify owner" },
                  { value: "notify_audience", label: "Notify audience" },
                  { value: "archive", label: "Archive document" },
                ]}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-semibold">Condition (optional)</span>
              <Input
                value={autoCondition}
                onChange={(event) => setAutoCondition(event.target.value)}
                placeholder="approved / expired"
              />
            </label>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() =>
                void api
                  .organizationalAutomations({
                    document_id: documentId,
                    op: "create",
                    name: autoName,
                    trigger: autoTrigger,
                    action: autoAction,
                    condition: autoCondition,
                  })
                  .then((result) => {
                    setAutoItems((current) => [result.data, ...current]);
                    setAutoName("");
                  })
              }
            >
              Save Automation
            </Button>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {autoItems.map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span>
                  {item.name} · {item.trigger} · {item.status}
                </span>
                <Button
                  variant="ghost"
                  onClick={() =>
                    void api
                      .organizationalAutomations({
                        document_id: documentId,
                        op: "update",
                        id: item.id,
                        status: item.status === "active" ? "disabled" : "active",
                      })
                      .then(() =>
                        setAutoItems((current) =>
                          current.map((row) =>
                            row.id === item.id
                              ? { ...row, status: row.status === "active" ? "disabled" : "active" }
                              : row,
                          ),
                        ),
                      )
                  }
                >
                  {item.status === "active" ? "Disable" : "Enable"}
                </Button>
              </li>
            ))}
          </ul>
        </ModalDialog>
      ) : null}
    </div>
  );
}
