"use client";

import {
  Archive,
  Copy,
  Download,
  Edit3,
  Ellipsis,
  FolderHeart,
  FolderInput,
  Info,
  Lock,
  Pin,
  Share2,
  Trash2,
  Unlock,
} from "lucide-react";
import type { DocFolder } from "../../../lib/types";
import ActionMenuCategory from "./ActionMenuCategory";
import FolderDetailsPanel from "./FolderDetailsPanel";
import { useRef, useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";
import { useAppDialog } from "../../../hooks/useAppDialog";
import ModalDialog from "./ModalDialog";
import FolderApprovalFields, {
  type ApprovalFlow,
  validateFolderApproval,
} from "./FolderApprovalFields";
import { scopeIdsForFolder } from "./OrganizationalAccessScopeFields";
import OrganizationalVisibilityFields, {
  accessScopeToVisibility,
  validateOrganizationalVisibility,
  visibilityToAccessScope,
  type OrgVisibilityMode,
} from "./OrganizationalVisibilityFields";
import {
  useComplianceTargets,
  useCurrentUser,
  useDeleteFolder,
  useFolderAction,
  useFolders,
  useSettings,
  useUpdateFolder,
} from "../../../hooks/useDocuments";
import { useClickOutside } from "../../../hooks/useClickOutside";
import { folderColorHex } from "../../../lib/folderColor";
import ManageAccessFolderModal from "./ManageAccessFolderModal";
import FolderPickerDialog from "./FolderPickerDialog";
import {
  canArchiveOrgFolders,
  canManageOrgFolders,
  canShareManageOrgAccess,
} from "../../../lib/organizationalFilesAccess";
import {
  coerceVisibilityMode,
} from "../../../lib/organizationalFolderScope";
import { formatFieldLabel } from "../../../lib/formatLabel";
import FolderDescriptionAssist from "./FolderDescriptionAssist";
import AppSelect from "./AppSelect";

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
  colorHex = "",
  folderKind = "folder",
  organizeBy = "none",
  acknowledgementPercent,
  acknowledgementPending,
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
  colorHex?: string;
  folderKind?: string;
  organizeBy?: string;
  acknowledgementPercent?: number | null;
  acknowledgementPending?: number;
}) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { showAlert, showConfirm } = useAppDialog();
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folderName);
  const [folderDescription, setFolderDescription] = useState(description);
  const [organize, setOrganize] = useState(organizeBy || "none");
  const [uploadApproval, setUploadApproval] = useState(requireUploadApproval);
  const [flow, setFlow] = useState<ApprovalFlow>(
    (approvalFlow as ApprovalFlow) || "any",
  );
  const [selectedApproverIds, setSelectedApproverIds] = useState<number[]>(
    approverIds ?? [],
  );
  const initialVisibility = useMemo(
    () => accessScopeToVisibility(accessScope),
    [accessScope],
  );
  const [visibilityMode, setVisibilityMode] = useState<OrgVisibilityMode>(
    initialVisibility.mode,
  );
  const [restrictedScope, setRestrictedScope] = useState(
    initialVisibility.restrictedScope,
  );
  const [scopeIds, setScopeIds] = useState<number[]>(() =>
    scopeIdsForFolder({
      access_scope: accessScope,
      department_ids: departmentIds,
      grade_ids: gradeIds,
      employee_ids: employeeIds,
    }),
  );
  const [scopeSearch, setScopeSearch] = useState("");
  const [manageAccessOpen, setManageAccessOpen] = useState(false);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [includeDocuments, setIncludeDocuments] = useState(false);
  const [selectedColor, setSelectedColor] = useState(folderColorHex(colorHex));

  useEffect(() => {
    setSelectedColor(folderColorHex(colorHex));
  }, [colorHex]);

  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const update = useUpdateFolder();
  const remove = useDeleteFolder();
  const action = useFolderAction();
  const folders = useFolders();
  const settingsQuery = useSettings();
  const targets = useComplianceTargets();
  const parentAccessScope = useMemo(() => {
    const current = (folders.data ?? []).find((item) => item.id === folderId);
    const parentId = Number(current?.parent_id || 0);
    if (!parentId) return undefined;
    return (folders.data ?? []).find((item) => item.id === parentId)?.access_scope;
  }, [folderId, folders.data]);

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
  const showOrgManage = folderType !== "organizational" || canManageOrgFolders(currentUser.data);
  const canLockFolder =
    folderType !== "organizational"
      ? currentUser.data?.is_document_manager === true
      : canManageOrgFolders(currentUser.data);
  const modificationsLocked = locked;
  const canShareAccess =
    !modificationsLocked &&
    (folderType !== "organizational" ||
      canShareManageOrgAccess(currentUser.data));
  const canArchive =
    folderType !== "organizational" ||
    canArchiveOrgFolders(currentUser.data);

  const approvalError = validateFolderApproval(
    uploadApproval,
    flow,
    selectedApproverIds,
  );

  const scopeError = useMemo(() => {
    if (!showAccessScopeFields) return null;
    const nextMode = coerceVisibilityMode(visibilityMode, parentAccessScope);
    return validateOrganizationalVisibility(
      nextMode,
      restrictedScope,
      scopeIds,
    );
  }, [
    parentAccessScope,
    restrictedScope,
    scopeIds,
    showAccessScopeFields,
    visibilityMode,
  ]);

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
    const visibility = accessScopeToVisibility(accessScope);
    setVisibilityMode(
      coerceVisibilityMode(visibility.mode, parentAccessScope),
    );
    setRestrictedScope(visibility.restrictedScope);
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
    if (folderType === "organizational") {
      setManageAccessOpen(true);
      setOpen(false);
      return;
    }
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
    await showAlert("Folder share link copied.", { title: "Link copied" });
    setOpen(false);
  };

  const folderColors = [
    "#ec4899",
    "#8b5cf6",
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#64748b",
  ];

  const setFolderColor = async (hex: string) => {
    setSelectedColor(hex);
    await update.mutateAsync({ id: folderId, color_hex: hex });
    setOpen(false);
  };

  const duplicateFolder = async () => {
    await action.mutateAsync({
      id: folderId,
      action: "duplicate",
      include_documents: modificationsLocked ? false : includeDocuments,
    });
    setDuplicateOpen(false);
    setOpen(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (showApprovalFields && approvalError) {
      await showAlert(approvalError, { title: "Check folder details" });
      return;
    }
    if (scopeError) {
      await showAlert(scopeError, { title: "Check folder details" });
      return;
    }
    try {
      await update.mutateAsync({
      id: folderId,
      name: name.trim(),
      description: folderDescription.trim(),
      ...(folderType === "organizational"
        ? { organize_by: organize }
        : {}),
      ...(showApprovalFields
        ? {
            require_upload_approval: uploadApproval,
            approval_flow: flow,
            approver_ids: selectedApproverIds,
          }
        : {}),
      ...(showAccessScopeFields
        ? (() => {
            const nextMode = coerceVisibilityMode(
              visibilityMode,
              parentAccessScope,
            );
            const resolvedScope = visibilityToAccessScope(
              nextMode,
              restrictedScope,
            );
            return {
              access_scope: resolvedScope,
              department_ids:
                resolvedScope === "department" ? scopeIds : [],
              grade_ids: resolvedScope === "grade" ? scopeIds : [],
              employee_ids:
                resolvedScope === "individual" ? scopeIds : [],
            };
          })()
        : {}),
      });
      setEditing(false);
      setOpen(false);
    } catch (error) {
      await showAlert(
        error instanceof Error ? error.message : "Unable to save folder.",
        { title: "Unable to save folder" },
      );
    }
  };

  const deleteFolder = async () => {
    const confirmed = await showConfirm(
      `Delete "${folderName}"? This cannot be undone.`,
      { title: "Delete folder", confirmLabel: "Delete" },
    );
    if (!confirmed) return;
    await remove.mutateAsync(folderId);
    setDetailsOpen(false);
    router.push(folderType === "organizational" ? "/pages/organization" : "/pages/employee");
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
            className="org-action-sheet fixed z-[100] w-52 rounded-2xl border border-slate-200 bg-white p-1.5 text-left shadow-xl shadow-slate-200/60"
          >
            <ActionMenuCategory label="Information" />
            <button
              type="button"
              onClick={() => {
                setDetailsOpen(true);
                setOpen(false);
              }}
              className="menu-item"
            >
              <Info />
              Details
            </button>
            <ActionMenuCategory label="Organise" />
            {!modificationsLocked && showOrgManage ? (
              <button type="button" onClick={openEditModal} className="menu-item">
                <Edit3 />
                Edit folder
              </button>
            ) : null}
            {showOrgManage ? (
              <button
                type="button"
                onClick={() => {
                  setIncludeDocuments(false);
                  setDuplicateOpen(true);
                  setOpen(false);
                }}
                className="menu-item"
              >
                <Copy />
                Duplicate
              </button>
            ) : null}
            {folderType === "organizational" && showOrgManage && !modificationsLocked ? (
              <button
                type="button"
                onClick={() => {
                  setMoveOpen(true);
                  setOpen(false);
                }}
                className="menu-item"
              >
                <FolderInput />
                Move folder
              </button>
            ) : null}
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
            {!modificationsLocked &&
              folderType === "organizational" &&
              canManageOrgFolders(currentUser.data) && (
                <div className="px-2 py-2">
                  <p className="px-2 pb-1 text-[10px] font-bold uppercase text-slate-400">
                    Folder colour
                  </p>
                  <div className="flex flex-wrap gap-1 px-1">
                    {folderColors.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        aria-label={`Set colour ${hex}`}
                        onClick={() => run(() => setFolderColor(hex))}
                        className={`h-6 w-6 rounded-full border-2 ${
                          selectedColor === hex ? "border-slate-900" : "border-white"
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>
              )}
            <ActionMenuCategory label="Access" />
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
            {canShareAccess ? (
              <button type="button" onClick={share} className="menu-item">
                <Share2 />
                {folderType === "organizational" ? "Manage access" : "Share folder"}
              </button>
            ) : null}
            <ActionMenuCategory label="Lifecycle" />
            {canLockFolder ? (
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
            ) : null}
            {canArchive ? (
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
            ) : null}
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

      {detailsOpen ? (
        <FolderDetailsPanel
          folderId={folderId}
          folderName={folderName}
          folderType={folderType}
          description={description}
          locked={locked}
          accessScope={accessScope}
          folderKind={folderKind as DocFolder["folder_kind"]}
          organizeBy={organizeBy}
          requireUploadApproval={requireUploadApproval}
          approvalFlow={approvalFlow}
          acknowledgementPercent={acknowledgementPercent}
          acknowledgementPending={acknowledgementPending}
          onClose={() => setDetailsOpen(false)}
        />
      ) : null}
      {editing &&
        createPortal(
        <ModalDialog
          title="Edit folder"
          eyebrow="Folder settings"
          onClose={() => setEditing(false)}
          size={showApprovalFields || showAccessScopeFields ? "lg" : "md"}
          titleClassName="text-xl"
          zIndex={110}
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

            <div className="flex w-full flex-col items-start gap-1.5 text-left">
              <div className="flex w-full flex-wrap items-center justify-between gap-2">
                <span className="label mb-0 text-sm font-medium text-slate-700">
                  Description
                </span>
                {folderType === "organizational" && (
                  <FolderDescriptionAssist
                    name={name}
                    visibility={
                      visibilityMode === "public"
                        ? "Public, visible to all staff"
                        : visibilityMode === "private"
                          ? "Private"
                          : visibilityMode === "company_owned"
                            ? "Company owned"
                          : visibilityMode === "admin_only"
                            ? "Admin only"
                            : `Restricted (${formatFieldLabel(restrictedScope)})`
                    }
                    description={folderDescription}
                    onDescriptionChange={setFolderDescription}
                  />
                )}
              </div>
              <textarea
                maxLength={500}
                value={folderDescription}
                onChange={(event) => setFolderDescription(event.target.value)}
                className="field min-h-24 w-full"
                placeholder={
                  folderType === "organizational"
                    ? "Describe what belongs in this folder, or suggest with AI"
                    : undefined
                }
              />
            </div>

            {folderType === "organizational" &&
            (folderKind === "project" || folderKind === "vendor") ? (
              <label className="flex w-full flex-col items-start gap-1.5 text-left">
                <span className="label text-sm font-medium text-slate-700">
                  Organize by
                </span>
                <AppSelect
                  value={organize}
                  onChange={setOrganize}
                  options={[
                    { value: "none", label: "None" },
                    { value: "department", label: "Department" },
                    { value: "grade", label: "Grade" },
                    { value: "location", label: "Location" },
                    { value: "employment_type", label: "Employment type" },
                  ]}
                />
              </label>
            ) : null}

            {showAccessScopeFields && (
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
                className="app-btn app-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {update.isPending ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </ModalDialog>,
        document.body,
      )}
      {manageAccessOpen &&
        folderType === "organizational" &&
        createPortal(
          <ManageAccessFolderModal
            folderId={folderId}
            folderName={folderName}
            accessScope={accessScope}
            departmentIds={departmentIds}
            gradeIds={gradeIds}
            employeeIds={employeeIds}
            onClose={() => setManageAccessOpen(false)}
          />,
          document.body,
        )}
      {duplicateOpen &&
        createPortal(
        <ModalDialog
          title="Duplicate folder"
          eyebrow={folderName}
          onClose={() => setDuplicateOpen(false)}
          zIndex={110}
        >
          <p className="text-sm text-slate-600">
            Choose whether to copy documents into the new folder or duplicate the
            folder structure only.
          </p>
          {modificationsLocked ? (
            <p className="mt-3 text-sm text-slate-500">
              This folder is locked, so documents cannot be copied. The empty
              folder structure can still be duplicated.
            </p>
          ) : null}
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={modificationsLocked ? false : includeDocuments}
              disabled={modificationsLocked}
              onChange={(event) => setIncludeDocuments(event.target.checked)}
              className="h-4 w-4 accent-pink-600"
            />
            Include documents
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDuplicateOpen(false)}
              className="secondary-button"
            >
              Cancel
            </button>
            <button type="button" onClick={duplicateFolder} className="primary-button">
              Duplicate
            </button>
          </div>
        </ModalDialog>,
        document.body,
      )}
      {moveOpen ? (
        <FolderPickerDialog
          title="Move folder"
          eyebrow="Relocation"
          description="This is the only step that asks where the folder should live."
          folders={folders.data ?? []}
          excludeIds={[folderId]}
          allowRoot
          confirmLabel="Move"
          onClose={() => setMoveOpen(false)}
          onPick={async (parentId) => {
            const result = await api.moveOrganizationalFolder({
              folder_id: folderId,
              parent_id: parentId || false,
            });
            if (!result.success) {
              await showAlert(result.message || "Unable to move this folder.", {
                title: "Move folder",
              });
              return;
            }
            await folders.refetch();
            setMoveOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
