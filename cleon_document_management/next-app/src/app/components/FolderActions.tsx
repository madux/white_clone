"use client";

import {
  Archive,
  Download,
  Edit3,
  Ellipsis,
  FolderHeart,
  Lock,
  Pin,
  Share2,
  Trash2,
  Unlock,
  Copy,
} from "lucide-react";
import { useRef, useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import ModalDialog from "./ModalDialog";
import FolderApprovalFields, {
  type ApprovalFlow,
  validateFolderApproval,
} from "./FolderApprovalFields";
import OrganizationalAccessScopeFields, {
  scopeIdsForFolder,
  validateOrganizationalScope,
} from "./OrganizationalAccessScopeFields";
import {
  useComplianceTargets,
  useDeleteFolder,
  useFolderAction,
  useSettings,
  useUpdateFolder,
} from "../../../hooks/useDocuments";
import { useClickOutside } from "../../../hooks/useClickOutside";

export default function FolderActions({
  folderId,
  folderName,
  description = "",
  locked = false,
  folderType,
  requireUploadApproval = false,
  approvalFlow = "any",
  approverIds = [],
  accessScope = "all_staff",
  departmentIds = [],
  gradeIds = [],
  employeeIds = [],
}: {
  folderId: number;
  folderName: string;
  description?: string;
  locked?: boolean;
  folderType?: string;
  requireUploadApproval?: boolean;
  approvalFlow?: ApprovalFlow | string;
  approverIds?: number[];
  accessScope?: string;
  departmentIds?: number[];
  gradeIds?: number[];
  employeeIds?: number[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folderName);
  const [folderDescription, setFolderDescription] = useState(description);
  const [uploadApproval, setUploadApproval] = useState(requireUploadApproval);
  const [flow, setFlow] = useState<ApprovalFlow>(
    (approvalFlow as ApprovalFlow) || "any",
  );
  const [selectedApproverIds, setSelectedApproverIds] = useState<number[]>(
    approverIds ?? [],
  );
  const [scope, setScope] = useState(accessScope);
  const [scopeIds, setScopeIds] = useState<number[]>(() =>
    scopeIdsForFolder({
      access_scope: accessScope,
      department_ids: departmentIds,
      grade_ids: gradeIds,
      employee_ids: employeeIds,
    }),
  );
  const [scopeSearch, setScopeSearch] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const update = useUpdateFolder();
  const remove = useDeleteFolder();
  const action = useFolderAction();
  const settingsQuery = useSettings();
  const targets = useComplianceTargets();

  const approverOptions =
    settingsQuery.data?.approvers?.map(
      (item: { id: number; name: string; email?: string }) => ({
        id: item.id,
        name: item.name,
        email: item.email,
      }),
    ) ?? [];

  const showApprovalFields = folderType === "employee";
  const showAccessScopeFields = folderType === "organizational";

  const approvalError = validateFolderApproval(
    uploadApproval,
    flow,
    selectedApproverIds,
  );

  const scopeError = useMemo(
    () =>
      showAccessScopeFields ? validateOrganizationalScope(scope, scopeIds) : null,
    [scope, scopeIds, showAccessScopeFields],
  );

  useClickOutside(menuRef, () => setOpen(false), [triggerRef]);

  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const updatePosition = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect)
        setMenuPosition({
          top: Math.max(12, rect.top - 250 - 8),
          left: Math.max(8, rect.right - 208),
        });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  const resetEditForm = () => {
    setName(folderName);
    setFolderDescription(description);
    setUploadApproval(requireUploadApproval);
    setFlow((approvalFlow as ApprovalFlow) || "any");
    setSelectedApproverIds(approverIds ?? []);
    setScope(accessScope);
    setScopeIds(
      scopeIdsForFolder({
        access_scope: accessScope,
        department_ids: departmentIds,
        grade_ids: gradeIds,
        employee_ids: employeeIds,
      }),
    );
    setScopeSearch("");
  };

  const openEditModal = () => {
    resetEditForm();
    setEditing(true);
    setOpen(false);
  };

  const run = async (task: () => Promise<unknown>) => {
    setOpen(false);
    await task();
  };

  const share = async () => {
    const result = await action.mutateAsync({
      id: folderId,
      action: "share",
      permission: "viewer",
      expiry_option: "7_days",
      allow_download: true,
    });
    if (result.data?.url)
      await navigator.clipboard?.writeText(
        `${window.location.origin}${result.data.url}`,
      );
    window.alert("Folder share link copied.");
    setOpen(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (showApprovalFields && approvalError) {
      window.alert(approvalError);
      return;
    }
    if (scopeError) {
      window.alert(scopeError);
      return;
    }
    await update.mutateAsync({
      id: folderId,
      name: name.trim(),
      description: folderDescription.trim(),
      ...(showApprovalFields
        ? {
            require_upload_approval: uploadApproval,
            approval_flow: flow,
            approver_ids: selectedApproverIds,
          }
        : {}),
      ...(showAccessScopeFields
        ? {
            access_scope: scope,
            department_ids: scope === "department" ? scopeIds : [],
            grade_ids: scope === "grade" ? scopeIds : [],
            employee_ids: scope === "individual" ? scopeIds : [],
          }
        : {}),
    });
    setEditing(false);
    setOpen(false);
  };

  const deleteFolder = async () => {
    if (!window.confirm(`Delete "${folderName}"? This cannot be undone.`))
      return;
    await remove.mutateAsync(folderId);
    router.push("/pages/employee");
  };

  return (
    <div
      ref={containerRef}
      className="relative text-left"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="rounded-xl p-2 text-slate-400 transition hover:bg-pink-50 hover:text-brand-pink"
        aria-label={`Actions for ${folderName}`}
      >
        <Ellipsis className="h-5 w-5" />
      </button>

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: menuPosition.top, left: menuPosition.left }}
            className="fixed z-[100] w-52 rounded-2xl border border-slate-200 bg-white p-1.5 text-left shadow-xl shadow-slate-200/60"
          >
            <button type="button" onClick={openEditModal} className="menu-item">
              <Edit3 />
              Edit folder
            </button>
            <button
              type="button"
              onClick={() =>
                run(() =>
                  action.mutateAsync({ id: folderId, action: "favorite" }),
                )
              }
              className="menu-item"
            >
              <FolderHeart />
              Favorite
            </button>
            <button
              type="button"
              onClick={() =>
                run(() => action.mutateAsync({ id: folderId, action: "pin" }))
              }
              className="menu-item"
            >
              <Pin />
              Pin folder
            </button>
            <button type="button" onClick={share} className="menu-item">
              <Share2 />
              Share folder
            </button>
            <button
              type="button"
              onClick={() =>
                run(async () => {
                  api.downloadFolder(folderId);
                })
              }
              className="menu-item"
            >
              <Download />
              Download folder
            </button>
            <button
              type="button"
              onClick={() =>
                run(() =>
                  action.mutateAsync({ id: folderId, action: "duplicate" }),
                )
              }
              className="menu-item"
            >
              <Copy />
              Duplicate
            </button>
            <button
              type="button"
              onClick={() =>
                run(() =>
                  action.mutateAsync({
                    id: folderId,
                    action: locked ? "unlock" : "lock",
                  }),
                )
              }
              className="menu-item"
            >
              {locked ? <Unlock /> : <Lock />}
              {locked ? "Unlock folder" : "Lock folder"}
            </button>
            <button
              type="button"
              onClick={() =>
                run(() =>
                  action.mutateAsync({ id: folderId, action: "archive" }),
                )
              }
              className="menu-item"
            >
              <Archive />
              Archive
            </button>
            <button
              type="button"
              onClick={deleteFolder}
              className="menu-item text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <Trash2 />
              Delete folder
            </button>
          </div>,
          document.body,
        )}

      {editing && (
        <ModalDialog
          title="Edit folder"
          eyebrow="Folder settings"
          onClose={() => setEditing(false)}
          size={showApprovalFields || showAccessScopeFields ? "lg" : "md"}
          titleClassName="text-xl"
        >
          <form onSubmit={save} className="space-y-5 text-left">
            <label className="flex w-full flex-col items-start gap-1.5 text-left">
              <span className="label text-sm font-medium text-slate-700">
                Folder name
              </span>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="field w-full"
              />
            </label>

            <label className="flex w-full flex-col items-start gap-1.5 text-left">
              <span className="label text-sm font-medium text-slate-700">
                Description
              </span>
              <textarea
                value={folderDescription}
                onChange={(event) => setFolderDescription(event.target.value)}
                className="field min-h-24 w-full"
              />
            </label>

            {showAccessScopeFields && (
              <OrganizationalAccessScopeFields
                accessScope={scope}
                onAccessScopeChange={setScope}
                scopeIds={scopeIds}
                onScopeIdsChange={setScopeIds}
                scopeSearch={scopeSearch}
                onScopeSearchChange={setScopeSearch}
                departments={targets.data?.departments ?? []}
                grades={targets.data?.grades ?? []}
                employees={targets.data?.employees ?? []}
              />
            )}

            {showApprovalFields && (
              <FolderApprovalFields
                requireUploadApproval={uploadApproval}
                onRequireUploadApprovalChange={setUploadApproval}
                approvalFlow={flow}
                onApprovalFlowChange={setFlow}
                approverIds={selectedApproverIds}
                onApproverIdsChange={setSelectedApproverIds}
                approvers={approverOptions}
                helperText="Changes apply to new uploads in this folder. Pending uploads for this department use the same chain."
              />
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={
                  update.isPending || Boolean(approvalError) || Boolean(scopeError)
                }
                type="submit"
                className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {update.isPending ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </ModalDialog>
      )}
    </div>
  );
}
