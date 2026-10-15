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
  Sparkles,
  Star,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useClickOutside } from "../../../hooks/useClickOutside";
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
import SectionTabs from "./SectionTabs";
import DocumentFilterBar, { FilterState, INITIAL_FILTER_STATE, applyDocumentFilters } from "./DocumentFilterBar";
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
import { FileTypeIcon } from "./FileTypeIcon";
import SharedDocumentsTable from "./SharedDocumentsTable";
import AppToolbar from "./AppToolbar";
import FilterToggleButton from "./FilterToggleButton";
import PersonalDocumentTree from "./PersonalDocumentTree";
import LibraryBreadcrumb from "./LibraryBreadcrumb";
import { documentPreviewUrl } from "../../../lib/documentPreviewUrls";
import { myWorkspaceHref } from "../../../lib/workspaceRoutes";

type Tab = "files" | "shared";
type SharedAckFilter = "all" | "needs_ack";

const SHARED_ACK_FILTER_OPTIONS: { value: SharedAckFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs_ack", label: "Needs acknowledgement" },
];
const DEFAULT_TAB_KEY = "cleon-doc-default-tab";
const VALID_TABS: Tab[] = ["files", "shared"];

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
  const pathname = usePathname();
  const router = useRouter();
  const guideTarget = params.get("guide");
  const acknowledge = useAcknowledgeDocument();
  const upload = useUploadMyDocument();
  const requestApproval = useRequestDocumentApproval();
  const { showAlert, showConfirm } = useAppDialog();
  const documentTypes = useDocumentTypes();
  const [tab, setTab] = useState<Tab>("files");
  const [sharedAckFilter, setSharedAckFilter] = useState<SharedAckFilter>("all");
  const [sharedFilterOpen, setSharedFilterOpen] = useState(false);
  const sharedFilterRef = useRef<HTMLDivElement>(null);
  useClickOutside(sharedFilterRef, () => setSharedFilterOpen(false));
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
  const [uploadError, setUploadError] = useState("");
  const [docFilters, setDocFilters] = useState<FilterState>(INITIAL_FILTER_STATE);
  useEffect(() => {
    if (params.get("upload") === "1") {
      setUploadError("");
      setShowUpload(true);
      const next = new URLSearchParams(params.toString());
      next.delete("upload");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }
    const scope = params.get("scope") || params.get("tab");
    if (scope === "shared" || scope === "needs_ack") {
      setTab("shared");
      setSharedAckFilter(
        scope === "needs_ack" || params.get("ack") === "needs"
          ? "needs_ack"
          : "all",
      );
      return;
    }
    if (scope === "outstanding") {
      router.replace(myWorkspaceHref("policies", { inbox: "todo" }));
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
    if (saved === "needs_ack") {
      setTab("shared");
      setSharedAckFilter("needs_ack");
      return;
    }
    if (saved && VALID_TABS.includes(saved as Tab)) {
      setTab(saved as Tab);
    }
  }, [guideTarget, params, pathname, router]);
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
  const filteredMyFiles = useMemo(
    () => applyDocumentFilters(myFiles, docFilters),
    [myFiles, docFilters]
  );
  const setPage = (next: Tab) => {
    setTab(next);
    setSearch("");
    if (next !== "shared") {
      setSharedAckFilter("all");
      setSharedFilterOpen(false);
    }
    const nextParams = new URLSearchParams(params.toString());
    if (next === "files") {
      nextParams.delete("scope");
      nextParams.delete("ack");
    } else if (next === "shared") {
      nextParams.set("scope", "shared");
    }
    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const setSharedAckFilterAndUrl = (filter: SharedAckFilter) => {
    setSharedAckFilter(filter);
    const next = new URLSearchParams(params.toString());
    next.set("scope", "shared");
    if (filter === "needs_ack") {
      next.set("ack", "needs");
    } else {
      next.delete("ack");
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };
  const pendingStatusById = Object.fromEntries(
    (pendingUploads.data?.items ?? []).map((item) => [item.id, item.status_label]),
  );
  const needsAckCount = shared.filter((document) => !document.acknowledged).length;
  const sharedAckFilterActive = sharedAckFilter !== "all";
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
          { id: "shared", label: "Shared", count: shared.length },
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
        />
      ) : tab === "shared" ? (
        <AppToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search shared documents..."
          extras={
            <>
              <div className="relative shrink-0" ref={sharedFilterRef}>
                <FilterToggleButton
                  aria-expanded={sharedFilterOpen}
                  aria-controls="shared-doc-ack-filters"
                  aria-haspopup="menu"
                  className="font-semibold text-slate-600 hover:border-brand-pink hover:text-brand-pink"
                  onClick={() => setSharedFilterOpen((open) => !open)}
                  badge={
                    sharedAckFilterActive ? (
                      <span className="rounded-full bg-brand-pink px-2 py-0.5 text-[11px] font-bold text-white">
                        1
                      </span>
                    ) : null
                  }
                >
                  Filters
                </FilterToggleButton>
                {sharedFilterOpen ? (
                  <div
                    id="shared-doc-ack-filters"
                    role="menu"
                    className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
                  >
                    {SHARED_ACK_FILTER_OPTIONS.map((option) => {
                      const count =
                        option.value === "all" ? shared.length : needsAckCount;
                      const selected = sharedAckFilter === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={selected}
                          className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition hover:bg-pink-50 ${
                            selected
                              ? "bg-pink-50/80 font-semibold text-slate-900"
                              : "text-slate-700"
                          }`}
                          onClick={() => {
                            setSharedAckFilterAndUrl(option.value);
                            setSharedFilterOpen(false);
                          }}
                        >
                          <span>{option.label}</span>
                          <span className="text-xs tabular-nums text-slate-500">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
              {sharedAckFilterActive ? (
                <button
                  type="button"
                  onClick={() => setSharedAckFilterAndUrl("all")}
                  className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:text-brand-pink"
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </button>
              ) : null}
            </>
          }
        />
      ) : (
        <AppToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search documents..."
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
      {(tab === "files" || tab === "shared") && (
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
                  !(await showConfirm(
                    `Send "${document.name}" to an administrator for review?`,
                    { title: "Request review", confirmLabel: "Send" },
                  ))
                ) {
                  return;
                }
                try {
                  await requestApproval.mutateAsync(document.id);
                  await showAlert(
                    "Your document was sent for review. Administrators will see it in the approval inbox.",
                    { title: "Submitted for review" },
                  );
                } catch (error: any) {
                  await showAlert(
                    error?.message || "Could not submit this document for approval.",
                    { title: "Request failed" },
                  );
                }
              }}
            />
          ) : (
            <SharedDocumentsTable
              documents={shared}
              search={search}
              sharedAckFilter={sharedAckFilter}
              onView={(document) => {
                setViewing(document);
                setViewingVersionId(null);
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
          title="Upload documents"
          eyebrow="My Workspace"
          documentTypes={documentTypes.data ?? []}
          pending={upload.isPending}
          error={uploadError}
          progress={uploadProgress}
          onClose={() => {
            setShowUpload(false);
            setUploadError("");
            setUploadProgress("");
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
