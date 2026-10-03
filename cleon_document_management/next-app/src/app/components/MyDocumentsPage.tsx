"use client";

import {
  AlertCircle,
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  LayoutDashboard,
  Search,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  QUERY_KEYS,
  useAcknowledgeDocument,
  useDocumentTypes,
  useMyPendingUploads,
  useMyWorkspace,
  useRequestDocumentApproval,
  useUpdateOnboarding,
  useUploadMyDocument,
} from "../../../hooks/useDocuments";
import { useAppDialog } from "../../../hooks/useAppDialog";
import { api } from "../../../lib/api";
import DocumentActions from "./DocumentActions";
import SortableTable from "./SortableTable";
import SectionTabs from "./SectionTabs";
import DocumentFilterBar, { FilterState, INITIAL_FILTER_STATE, applyDocumentFilters } from "./DocumentFilterBar";
import BulkDocumentActions from "./BulkDocumentActions";
import DocumentViewerDialog from "./DocumentViewerDialog";
import type { DocDocument } from "../../../lib/types";
import DocumentUploadModal, {
  type DocumentUploadPayload,
} from "./DocumentUploadModal";
import UpdateDocumentModal from "./UpdateDocumentModal";
import UploadConflictDialog from "./UploadConflictDialog";
import {
  buildAllowSeparateDuplicates,
  buildReplaceDocumentIdsFromConflicts,
  buildVersionChangeNotesFromConflicts,
  findUploadConflictsByFileIndex,
  hasResolvableConflicts,
  preventConflictMessage,
} from "../../../lib/uploadConflictHelpers";
import type { UploadConflict } from "../../../lib/types";
import StatusPill from "./StatusPill";
import { formatStatusLabel } from "../../../lib/formatLabel";
import { formatDocumentDateShort } from "../../../lib/formatDocumentDate";
import { folderColorHex } from "../../../lib/folderColor";
import { FileTypeIcon } from "./FileTypeIcon";
import EmptyState from "./EmptyState";
import AppToolbar from "./AppToolbar";
import PersonalDocumentTree from "./PersonalDocumentTree";
import NewMenu from "./NewMenu";
import LibraryBreadcrumb from "./LibraryBreadcrumb";
import { documentPreviewUrl } from "../../../lib/documentPreviewUrls";

type Tab = "files" | "shared" | "outstanding" | "needs_ack";
const DEFAULT_TAB_KEY = "cleon-doc-default-tab";
const VALID_TABS: Tab[] = ["files", "shared", "outstanding", "needs_ack"];

function FolderNameLabel({
  name,
  colorHex,
}: {
  name?: string;
  colorHex?: string;
}) {
  const hex = folderColorHex(colorHex);
  return (
    <span className="inline-flex items-center gap-1.5">
      {hex ? (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: hex }}
          aria-hidden
        />
      ) : null}
      <span>{name}</span>
    </span>
  );
}

function DocumentTable({
  documents,
  search,
  shared,
  readOnly,
  onView,
  onRequestApproval,
  onUploadOutstanding,
  guideTarget,
  sharedAckFilter = "all",
  pendingStatusById = {},
}: {
  documents: any[];
  search: string;
  shared?: boolean;
  readOnly?: boolean;
  onView: (document: any) => void;
  onRequestApproval?: (document: any) => void;
  onUploadOutstanding?: (document: any) => void;
  guideTarget?: string;
  sharedAckFilter?: "all" | "needs_ack";
  pendingStatusById?: Record<number, string>;
}) {
  const rows = documents.filter((document) => {
    if (shared && sharedAckFilter === "needs_ack" && document.acknowledged) {
      return false;
    }
    return `${document.name} ${document.document_type} ${document.folder_name}`
      .toLowerCase()
      .includes(search.toLowerCase());
  });
  const [selected, setSelected] = useState<number[]>([]);
  const selectable = !shared && !readOnly;
  const visibleIds = rows.map((document) => document.id);
  const allSelected = selectable && visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <SortableTable className="w-full min-w-[850px]">
          <thead>
            <tr>
              {selectable && (
                <th className="dms-col-check">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? [] : visibleIds)
                    }
                    aria-label="Select all my files"
                    className="h-4 w-4 accent-pink-600"
                  />
                </th>
              )}
              <th>Document</th>
              <th>Category</th>
              <th
                className={
                  guideTarget === "approval" ? "guide-status-emphasis" : ""
                }
              >
                Status
              </th>
              <th>{shared ? "Shared by" : "Last updated"}</th>
              <th className="dms-col-actions">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
              {rows.map((document) => (
              <tr key={document.id} className="transition hover:bg-pink-50/30">
                {selectable && (
                  <td className="dms-col-check">
                    <input
                      type="checkbox"
                      checked={selected.includes(document.id)}
                      onChange={() =>
                        setSelected((current) =>
                          current.includes(document.id)
                            ? current.filter((id) => id !== document.id)
                            : [...current, document.id],
                        )
                      }
                      aria-label={`Select ${document.name}`}
                      className="h-4 w-4 accent-pink-600"
                    />
                  </td>
                )}
                <td>
                  <button
                    type="button"
                    onClick={() => onView(document)}
                    className="flex items-center gap-3 text-left"
                  >
                    <FileTypeIcon
                      name={document.name}
                      mime_type={document.mime_type}
                      document_type={document.document_type}
                      source_url={document.source_url}
                    />
                    <span>
                      <strong className="block text-sm text-slate-800 hover:text-brand-pink">
                        {document.name}
                      </strong>
                      <small className="mt-1 block text-xs text-slate-400">
                        <FolderNameLabel
                          name={document.folder_name}
                          colorHex={document.folder_color_hex}
                        />
                      </small>
                      {shared && !document.acknowledged && (
                        <span className="mt-1 inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          Needs acknowledgement
                        </span>
                      )}
                      {!shared && pendingStatusById[document.id] && (
                        <span className="mt-1 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          {pendingStatusById[document.id]}
                        </span>
                      )}
                    </span>
                  </button>
                </td>
                <td className="text-sm text-slate-600">
                  {document.document_type}
                </td>
                <td
                  className={
                    guideTarget === "approval" ? "guide-status-emphasis" : ""
                  }
                >
                  {(() => {
                    const isOutstandingPlaceholder = document.id < 0;
                    const requiresApproval =
                      !isOutstandingPlaceholder &&
                      document.approval_state === "pending";
                    const label =
                      shared && document.acknowledged
                        ? document.acknowledged_at
                          ? `Acknowledged ${String(document.acknowledged_at).slice(0, 10)}`
                          : "Acknowledged"
                        : isOutstandingPlaceholder
                          ? formatStatusLabel(document.state)
                          : requiresApproval
                            ? "Requires Approval"
                            : formatStatusLabel(document.state);
                    return (
                      <span className={guideTarget === "approval" ? "guide-status-badge" : undefined}>
                        <StatusPill label={label} />
                      </span>
                    );
                  })()}
                </td>
                <td className="text-sm text-slate-500">
                  {shared
                    ? document.shared_by || "Document administrator"
                    : formatDocumentDateShort(document.write_date, "Required")}
                </td>
                <td className="dms-col-actions">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => onView(document)}
                      className="rounded-full border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:border-brand-pink hover:text-brand-pink"
                    >
                      View
                    </button>
                    {document.state === "missing" && onUploadOutstanding && (
                      <button
                        type="button"
                        onClick={() => onUploadOutstanding(document)}
                        className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-3 py-2 text-xs font-bold text-white"
                      >
                        Upload
                      </button>
                    )}
                    {!readOnly && !shared && (
                      <>
                        {(document.state === "draft" ||
                          document.state === "rejected") &&
                        document.approval_state !== "pending" &&
                        !pendingStatusById[document.id] ? (
                          <button
                            type="button"
                            onClick={() => onRequestApproval?.(document)}
                            className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-3 py-2 text-xs font-bold text-white"
                          >
                            Request approval
                          </button>
                        ) : null}
                        <DocumentActions
                          documentId={document.id}
                          documentName={document.name}
                          document={document}
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </SortableTable>
      </div>
      {selectable && <BulkDocumentActions selected={selected} onClear={() => setSelected([])} documents={rows} />}
      {!rows.length && (
        <EmptyState
          title="No documents yet"
          description="Upload a file to start building this workspace."
        />
      )}
    </div>
  );
}

export default function MyDocumentsPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const workspace = useMyWorkspace();
  const queryClient = useQueryClient();
  const pendingUploads = useMyPendingUploads();
  const updateOnboarding = useUpdateOnboarding();
  const params = useSearchParams();
  const router = useRouter();
  const guideTarget = params.get("guide");
  const acknowledge = useAcknowledgeDocument();
  const upload = useUploadMyDocument();
  const requestApproval = useRequestDocumentApproval();
  const { showConfirm } = useAppDialog();
  const documentTypes = useDocumentTypes();
  const [tab, setTab] = useState<Tab>("files");
  const [ackMessage, setAckMessage] = useState("");
  const [ackError, setAckError] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<any>(null);
  const [viewingVersionId, setViewingVersionId] = useState<number | null>(null);
  const [updatingDocument, setUpdatingDocument] = useState<DocDocument | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadConflictWarning, setUploadConflictWarning] = useState<{
    conflicts: UploadConflict[];
    perFile: Array<UploadConflict | null>;
    proceedUpdate: () => Promise<void>;
    proceedSeparate: () => Promise<void>;
  } | null>(null);
  const pendingUploadRef = useRef<DocumentUploadPayload | null>(null);
  const [uploadRequirement, setUploadRequirement] = useState<any>(null);
  const [uploadError, setUploadError] = useState("");
  const [docFilters, setDocFilters] = useState<FilterState>(INITIAL_FILTER_STATE);
  useEffect(() => {
    if (params.get("upload") === "1") setShowUpload(true);
    const scope = params.get("scope") || params.get("tab");
    if (scope === "shared") {
      setTab("shared");
      return;
    }
    if (scope === "outstanding") {
      setTab("outstanding");
      return;
    }
    if (scope === "needs_ack") {
      setTab("needs_ack");
      return;
    }
    if (scope === "files") {
      setTab("files");
      return;
    }
    if (["workspace", "upload", "approval"].includes(guideTarget || "")) {
      setTab("files");
      return;
    }
    if (guideTarget === "shared") {
      setTab("shared");
      return;
    }
    const saved = localStorage.getItem(DEFAULT_TAB_KEY);
    if (saved && VALID_TABS.includes(saved as Tab)) {
      setTab(saved as Tab);
    }
  }, [guideTarget, params]);
  useEffect(() => {
    const docId = Number(params.get("doc") || 0);
    if (!docId || !workspace.data) return;
    const match =
      [...(workspace.data.my_files ?? []), ...(workspace.data.shared_documents ?? [])].find(
        (document) => document.id === docId,
      );
    if (match) setViewing(match);
  }, [params, workspace.data]);
  useEffect(() => {
    if (!viewing?.id || viewing.id < 0 || !viewing.review_decision_unread) {
      return;
    }
    void api.acknowledgeReviewDecision(viewing.id).then(() => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myReviewAlerts });
      void workspace.refetch();
    });
  }, [viewing?.id, viewing?.review_decision_unread, queryClient, workspace]);
  const data = workspace.data;
  const myFiles = data?.my_files ?? [];
  const shared = data?.shared_documents ?? [];
  const outstanding = data?.outstanding ?? [];
  const filteredMyFiles = useMemo(
    () => applyDocumentFilters(myFiles, docFilters),
    [myFiles, docFilters]
  );
  const setPage = (next: Tab) => {
    setTab(next);
    setSearch("");
  };
  const pendingStatusById = Object.fromEntries(
    (pendingUploads.data?.items ?? []).map((item) => [item.id, item.status_label]),
  );
  const needsAckCount = shared.filter((document) => !document.acknowledged).length;
  const previewUrl =
    viewing?.id > 0
      ? documentPreviewUrl(viewing.id, { variant: "current" })
      : "";

  const runUploadConflictPreflight = async (
    typeIds: string[],
    uploadFn: (extras?: {
      replace_document_ids?: Array<number | null>;
      change_notes?: string[];
      allow_separate_duplicates?: boolean[];
    }) => Promise<void>,
  ) => {
    const employeeId =
      myFiles.find((document) => document.employee_id)?.employee_id ?? 0;
    if (!employeeId) {
      await uploadFn();
      return;
    }
    try {
      const perFile = await findUploadConflictsByFileIndex(employeeId, typeIds);
      const preventMessage = preventConflictMessage(perFile);
      if (preventMessage) {
        setUploadError(preventMessage);
        return;
      }
      if (!hasResolvableConflicts(perFile)) {
        await uploadFn();
        return;
      }
      const conflicts = perFile.filter(Boolean) as UploadConflict[];
      setUploadConflictWarning({
        conflicts,
        perFile,
        proceedUpdate: async () => {
          setUploadConflictWarning(null);
          await uploadFn({
            replace_document_ids: buildReplaceDocumentIdsFromConflicts(perFile),
            change_notes: buildVersionChangeNotesFromConflicts(perFile),
          });
        },
        proceedSeparate: async () => {
          setUploadConflictWarning(null);
          await uploadFn({
            allow_separate_duplicates: buildAllowSeparateDuplicates(perFile),
          });
        },
      });
    } catch (caught: any) {
      setUploadError(caught?.message || "Could not check for upload conflicts.");
    }
  };

  const performUpload = async (extras?: {
    replace_document_ids?: Array<number | null>;
    change_notes?: string[];
    allow_separate_duplicates?: boolean[];
  }) => {
    const payload = pendingUploadRef.current;
    if (!payload?.files.length || payload.documentTypeIds.some((id) => !id)) {
      return;
    }
    setUploadError("");
    try {
      setUploadProgress("Uploading files...");
      const result = await upload.mutateAsync({
        files: payload.files,
        document_type_ids: payload.documentTypeIds.map(Number),
        expiry_dates: payload.expiryDates,
        issue_dates: payload.issueDates,
        descriptions: payload.descriptions,
        replace_document_ids: extras?.replace_document_ids,
        change_notes: extras?.change_notes,
        allow_separate_duplicates: extras?.allow_separate_duplicates,
      });
      const response = result as {
        success: boolean;
        data?: { id: number };
        message?: string;
      };
      if (!response.success || !response.data?.id)
        throw new Error(
          response.message || "The document could not be uploaded.",
        );
      setUploadProgress("");
      pendingUploadRef.current = null;
      setUploadRequirement(null);
      setShowUpload(false);
    } catch (caught: any) {
      setUploadProgress("");
      setUploadError(
        caught?.message || "The document could not be uploaded.",
      );
    }
  };

  const handleUploadSubmit = async (payload: DocumentUploadPayload) => {
    pendingUploadRef.current = payload;
    await runUploadConflictPreflight(payload.documentTypeIds, performUpload);
  };

  return (
    <div className={embedded ? "space-y-5" : "app-page space-y-5"}>
      <LibraryBreadcrumb
        items={[
          { label: "My Workspace", href: "/pages/my-workspace" },
          { label: "Documents" },
        ]}
      />
      <SectionTabs
        level="nested"
        ariaLabel="Document scope"
        value={tab}
        onChange={setPage}
        items={[
          { id: "files", label: "My files", count: myFiles.length },
          { id: "outstanding", label: "Outstanding", count: outstanding.length },
          { id: "shared", label: "Shared", count: shared.length },
          { id: "needs_ack", label: "Needs acknowledgement", count: needsAckCount },
        ]}
      />
      {tab === "files" ? (
        <DocumentFilterBar
          filters={docFilters}
          onChange={setDocFilters}
          availableTypes={documentTypes.data ?? []}
          showDepartmentFilter={false}
          totalCount={myFiles.length}
          filteredCount={filteredMyFiles.length}
          actions={
            <NewMenu
              items={[
                {
                  label: "File upload",
                  icon: Upload,
                  onSelect: () => {
                    setUploadRequirement(null);
                    setUploadError("");
                    setShowUpload(true);
                  },
                },
              ]}
            />
          }
        />
      ) : (
        <AppToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search documents..."
          actions={
            <NewMenu
              items={[
                {
                  label: "File upload",
                  icon: Upload,
                  onSelect: () => {
                    setUploadRequirement(null);
                    setUploadError("");
                    setShowUpload(true);
                  },
                },
              ]}
            />
          }
        />
      )}
      {workspace.isLoading && (
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded-2xl bg-white" />
          <div className="h-48 animate-pulse rounded-2xl bg-white" />
        </div>
      )}
      {workspace.error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Your workspace data could not be loaded. Please try again.</span>
        </div>
      )}
      {!workspace.isLoading && (
      <>
      {(tab === "files" || tab === "shared" || tab === "outstanding" || tab === "needs_ack") && (
        <section className="app-table-well app-page-body">
          {tab === "files" ? (
            <PersonalDocumentTree
              documents={filteredMyFiles}
              search={docFilters.search}
              pendingStatusById={pendingStatusById}
              guideTarget={guideTarget || undefined}
              onView={(document) => {
                setViewing(document);
                setViewingVersionId(null);
              }}
              onViewVersion={(document, versionId) => {
                setViewing(document);
                setViewingVersionId(versionId);
              }}
              onUpdate={setUpdatingDocument}
              onRequestApproval={async (document) => {
                if (
                  await showConfirm(
                    `Send "${document.name}" to an administrator for review?`,
                    { title: "Request review", confirmLabel: "Send" },
                  )
                ) {
                  await requestApproval.mutateAsync(document.id);
                }
              }}
            />
          ) : (
            <DocumentTable
              documents={
                tab === "outstanding"
                  ? outstanding
                  : shared
              }
              search={search}
              shared={tab === "shared" || tab === "needs_ack"}
              readOnly={tab === "outstanding"}
              guideTarget={guideTarget || undefined}
              sharedAckFilter={tab === "needs_ack" ? "needs_ack" : "all"}
              pendingStatusById={pendingStatusById}
              onView={setViewing}
              onRequestApproval={async (document) => {
                if (
                  await showConfirm(
                    `Send "${document.name}" to an administrator for review?`,
                    { title: "Request review", confirmLabel: "Send" },
                  )
                )
                  await requestApproval.mutateAsync(document.id);
              }}
              onUploadOutstanding={(document) => {
                setUploadRequirement(document);
                setUploadError("");
                setShowUpload(true);
              }}
            />
          )}
        </section>
      )}
      {updatingDocument ? (
        <UpdateDocumentModal
          document={updatingDocument}
          mode="my_documents"
          onClose={() => setUpdatingDocument(null)}
        />
      ) : null}
      {viewing && (
        <DocumentViewerDialog
          title={viewing.name}
          description={[
            viewing.document_type,
            viewing.folder_name,
            viewing.rejection_reason
              ? `Rejected: ${viewing.rejection_reason}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          onClose={() => {
            setViewing(null);
            setViewingVersionId(null);
          }}
          previewUrl={viewing.id > 0 ? previewUrl : undefined}
          documentId={viewing.id > 0 ? viewing.id : undefined}
          initialVersionId={viewingVersionId}
          placeholder={
            viewing.id < 0 ? (
              <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
                <FileTypeIcon
                  name={viewing.name}
                  mime_type={viewing.mime_type}
                  document_type={viewing.document_type}
                  source_url={viewing.source_url}
                  className="h-9 w-7"
                />
                <h3 className="mt-4 text-lg font-bold text-slate-900">
                  {viewing.name}
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {viewing.description || "This document has not been uploaded yet."}
                </p>
              </div>
            ) : undefined
          }
          headerActions={
            viewing.id > 0 ? (
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/pages/document-intelligence/ask?document=${viewing.id}`,
                  )
                }
                className="inline-flex items-center gap-2 rounded-full border border-brand-pink px-3 py-2 text-xs font-bold text-brand-pink hover:bg-pink-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Ask AI
              </button>
            ) : null
          }
          footer={
            tab === "shared" && !viewing.acknowledged ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                <div className="flex gap-3">
                  <Bell className="h-5 w-5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-bold text-amber-800">
                      Acknowledgement required
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-700">
                      Please read this document in full. Your acknowledgement
                      confirms that you have read, understood, and agree to
                      comply with it.
                    </p>
                    <button
                      type="button"
                      disabled={acknowledge.isPending}
                      onClick={async () => {
                        setAckError("");
                        setAckMessage("");
                        try {
                          const result = await acknowledge.mutateAsync(viewing.id);
                          if (result && (result as { success?: boolean }).success === false) {
                            throw new Error(
                              (result as { message?: string }).message ||
                                "Could not record acknowledgement.",
                            );
                          }
                          const acknowledgedAt =
                            (result as { data?: { acknowledged_at?: string } })?.data
                              ?.acknowledged_at || "";
                          setViewing({
                            ...viewing,
                            acknowledged: true,
                            acknowledged_at: acknowledgedAt,
                          });
                          setAckMessage("Document acknowledged successfully.");
                        } catch (caught: any) {
                          setAckError(
                            caught?.message || "Could not record acknowledgement.",
                          );
                        }
                      }}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-4 py-2.5 text-xs font-bold text-white"
                    >
                      <Check className="h-4 w-4" />
                      {acknowledge.isPending
                        ? "Recording..."
                        : "Acknowledge document"}
                    </button>
                    {ackError && (
                      <p className="mt-3 text-xs font-semibold text-red-700">{ackError}</p>
                    )}
                    {ackMessage && (
                      <p className="mt-3 text-xs font-semibold text-emerald-700">{ackMessage}</p>
                    )}
                  </div>
                </div>
              </div>
            ) : viewing.acknowledged && tab === "shared" ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                {viewing.acknowledged_at
                  ? `Acknowledged on ${String(viewing.acknowledged_at).slice(0, 10)}`
                  : "You have acknowledged this document."}
              </div>
            ) : undefined
          }
        />
      )}
      {uploadConflictWarning ? (
        <UploadConflictDialog
          conflicts={uploadConflictWarning.conflicts}
          onCancel={() => setUploadConflictWarning(null)}
          onUpdateExisting={() => void uploadConflictWarning.proceedUpdate()}
          onUploadSeparate={() => void uploadConflictWarning.proceedSeparate()}
          pending={upload.isPending}
          canUpdateExisting={uploadConflictWarning.conflicts.some(
            (conflict) => conflict.enable_versioning,
          )}
          requireConfirmForSeparate={uploadConflictWarning.conflicts.some(
            (conflict) => conflict.policy === "allow_confirm",
          )}
        />
      ) : null}
      {showUpload ? (
        <DocumentUploadModal
          draftKey="my-workspace-upload"
          zIndex={80}
          title={uploadRequirement ? "Complete outstanding document" : "Upload documents"}
          eyebrow="My Workspace"
          description={
            uploadRequirement
              ? "This upload will be sent to an administrator for review immediately."
              : undefined
          }
          documentTypes={documentTypes.data ?? []}
          lockedTypeId={
            uploadRequirement?.document_type_id
              ? String(uploadRequirement.document_type_id)
              : undefined
          }
          lockedTypeLabel={uploadRequirement?.document_type}
          pending={upload.isPending}
          error={uploadError}
          progress={uploadProgress}
          submitLabel={uploadRequirement ? "Upload and request review" : undefined}
          onClose={() => {
            setShowUpload(false);
            setUploadError("");
            setUploadProgress("");
            setUploadRequirement(null);
            pendingUploadRef.current = null;
          }}
          onSubmit={handleUploadSubmit}
        />
      ) : null}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-400">
        <span>Need a refresher on how this workspace works?</span>
        <button
          type="button"
          onClick={() => updateOnboarding.mutate({ action: "reset" })}
          className="rounded-full border border-slate-200 px-3 py-1.5 font-bold text-slate-500 hover:border-brand-pink hover:text-brand-pink"
        >
          Restart getting started guide
        </button>
      </footer>
      </>
      )}
    </div>
  );
}
