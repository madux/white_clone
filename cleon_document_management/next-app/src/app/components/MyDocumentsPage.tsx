"use client";

import {
  Activity,
  AlertCircle,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  LayoutDashboard,
  Search,
  Share2,
  SlidersHorizontal,
  Star,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAcknowledgeDocument,
  useCurrentUser,
  useDocumentTypes,
  useMyPendingUploads,
  useMyWorkspace,
  useRequestDocumentApproval,
  useUpdateOnboarding,
  useUploadMyDocument,
} from "../../../hooks/useDocuments";
import { api } from "../../../lib/api";
import DocumentActions from "./DocumentActions";
import SortableTable from "./SortableTable";
import ThemedSelect from "./ThemedSelect";
import DocumentFilterBar, { FilterState, INITIAL_FILTER_STATE, applyDocumentFilters } from "./DocumentFilterBar";
import BulkDocumentActions from "./BulkDocumentActions";
import DocumentViewerDialog from "./DocumentViewerDialog";
import ModalDialog from "./ModalDialog";
import UploadDuplicateDialog from "./UploadDuplicateDialog";
import {
  buildReplaceDocumentIds,
  buildVersionChangeNotes,
  findUploadDuplicates,
} from "../../../lib/uploadDuplicates";
import type { UploadDuplicateMatch } from "../../../lib/types";
import {
  missingExpiryDates,
  typeRequiresExpiry,
} from "./uploadExpiryHelpers";
import { formatStatusLabel } from "../../../lib/formatLabel";

type Tab = "dashboard" | "files" | "shared" | "activity";
type FileView = "files" | "outstanding";
const DEFAULT_TAB_KEY = "cleon-doc-default-tab";
const VALID_TABS: Tab[] = ["dashboard", "files", "shared", "activity"];
const states: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-amber-50 text-amber-700",
  rejected: "bg-red-50 text-red-700",
  draft: "bg-slate-100 text-slate-600",
  expired: "bg-red-50 text-red-700",
  missing: "bg-orange-50 text-orange-700",
};

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
        <SortableTable className="w-full min-w-[850px] text-left">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-400">
            <tr>
              {selectable && <th className="w-12 px-5 py-4"><input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? [] : visibleIds)} aria-label="Select all my files" className="h-4 w-4 accent-pink-600" /></th>}
              <th className="px-5 py-4">Document</th>
              <th className="px-5 py-4">Category</th>
              <th className={`px-5 py-4 ${guideTarget === "approval" ? "guide-status-emphasis" : ""}`}>Status</th>
              <th className="px-5 py-4">
                {shared ? "Shared by" : "Last updated"}
              </th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
              {rows.map((document) => (
              <tr key={document.id} className="transition hover:bg-pink-50/30">
                {selectable && <td className="w-12 px-5 py-4"><input type="checkbox" checked={selected.includes(document.id)} onChange={() => setSelected((current) => current.includes(document.id) ? current.filter((id) => id !== document.id) : [...current, document.id])} aria-label={`Select ${document.name}`} className="h-4 w-4 accent-pink-600" /></td>}
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => onView(document)}
                    className="flex items-center gap-3 text-left"
                  >
                    <span className="rounded-xl bg-blue-50 p-2.5 text-blue-500">
                      <FileText className="h-5 w-5" />
                    </span>
                    <span>
                      <strong className="block text-sm text-slate-800 hover:text-brand-pink">
                        {document.name}
                      </strong>
                      <small className="mt-1 block text-xs text-slate-400">
                        {document.folder_name}
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
                <td className="px-5 py-4 text-sm text-slate-600">
                  {document.document_type}
                </td>
                <td className={`px-5 py-4 ${guideTarget === "approval" ? "guide-status-emphasis" : ""}`}>
                  {(() => {
                    const requiresApproval = document.approval_state === "pending";
                    const statusKey = requiresApproval ? "pending" : document.state;
                    return (
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${shared && document.acknowledged ? states.approved : states[statusKey] || states.draft} ${guideTarget === "approval" ? "guide-status-badge" : ""}`}
                  >
                    {shared && document.acknowledged
                      ? document.acknowledged_at
                        ? `Acknowledged ${String(document.acknowledged_at).slice(0, 10)}`
                        : "Acknowledged"
                      : requiresApproval
                        ? "Requires Approval"
                        : formatStatusLabel(document.state)}
                  </span>
                    );
                  })()}
                </td>
                <td className="px-5 py-4 text-sm text-slate-500">
                  {shared
                    ? document.shared_by || "Document administrator"
                    : document.write_date?.slice(0, 10) || "Required"}
                </td>
                <td className="px-5 py-4">
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
        <p className="p-12 text-center text-sm text-slate-500">
          No documents found.
        </p>
      )}
    </div>
  );
}

export default function MyDocumentsPage() {
  const workspace = useMyWorkspace();
  const pendingUploads = useMyPendingUploads();
  const updateOnboarding = useUpdateOnboarding();
  const params = useSearchParams();
  const guideTarget = params.get("guide");
  const user = useCurrentUser();
  const acknowledge = useAcknowledgeDocument();
  const upload = useUploadMyDocument();
  const requestApproval = useRequestDocumentApproval();
  const documentTypes = useDocumentTypes();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sharedAckFilter, setSharedAckFilter] = useState<"all" | "needs_ack">("all");
  const [ackMessage, setAckMessage] = useState("");
  const [ackError, setAckError] = useState("");
  const [uploadProgress, setUploadProgress] = useState("");
  const [isDraggingUpload, setIsDraggingUpload] = useState(false);
  const [defaultSaved, setDefaultSaved] = useState(false);
  const [fileView, setFileView] = useState<FileView>("files");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<any>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    matches: UploadDuplicateMatch[];
    proceedAsVersion: () => Promise<void>;
    proceedAsNew: () => Promise<void>;
  } | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTypes, setUploadTypes] = useState<string[]>([]);
  const [uploadExpiryDates, setUploadExpiryDates] = useState<string[]>([]);
  const [bulkUploadType, setBulkUploadType] = useState("");
  const [uploadRequirement, setUploadRequirement] = useState<any>(null);
  const [uploadError, setUploadError] = useState("");
  const [docFilters, setDocFilters] = useState<FilterState>(INITIAL_FILTER_STATE);
  useEffect(() => {
    if (params.get("upload") === "1") setShowUpload(true);
    const requestedTab = params.get("tab");
    if (requestedTab === "shared") {
      setTab("shared");
      return;
    }
    if (requestedTab === "files") {
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
  const data = workspace.data;
  const myFiles = data?.my_files ?? [];
  const shared = data?.shared_documents ?? [];
  const outstanding = data?.outstanding ?? [];
  const combined = [...myFiles, ...shared];
  const filteredMyFiles = useMemo(
    () => applyDocumentFilters(myFiles, docFilters),
    [myFiles, docFilters]
  );
  const pending = combined.filter(
    (document) =>
      document.approval_state === "pending" ||
      ["processing", "draft"].includes(document.state),
  );
  const favourites = myFiles.filter((document) => document.favorite);
  const recent = combined.slice(0, 5);
  const tabs = [
    { id: "dashboard" as const, label: "Home", icon: LayoutDashboard },
    {
      id: "files" as const,
      label: "My files",
      icon: FileText,
      count: myFiles.length,
    },
    {
      id: "shared" as const,
      label: "Shared Documents",
      icon: Share2,
      count: shared.length,
    },
    { id: "activity" as const, label: "My Activity Log", icon: Activity },
  ];
  const setPage = (next: Tab) => {
    setTab(next);
    setSearch("");
  };
  const saveDefaultTab = () => {
    localStorage.setItem(DEFAULT_TAB_KEY, tab);
    setDefaultSaved(true);
    window.setTimeout(() => setDefaultSaved(false), 2000);
  };
  const pendingStatusById = Object.fromEntries(
    (pendingUploads.data?.items ?? []).map((item) => [item.id, item.status_label]),
  );
  const needsAckCount = shared.filter((document) => !document.acknowledged).length;
  const previewUrl =
    viewing?.id > 0
      ? `${(process.env.NEXT_PUBLIC_ODOO_URL || "").replace(/\/$/, "")}/document-management/document/${viewing.id}/preview`
      : "";

  const performUpload = async (asVersion = false) => {
    setUploadError("");
    if (
      missingExpiryDates(
        uploadTypes,
        uploadExpiryDates,
        documentTypes.data ?? [],
      )
    ) {
      setUploadError("Enter an expiry date for each applicable document type.");
      return;
    }
    const matches = duplicateWarning?.matches ?? [];
    try {
      setUploadProgress(asVersion ? "Saving new version..." : "Uploading files...");
      const result = await upload.mutateAsync({
        files: uploadFiles,
        document_type_ids: uploadTypes.map(Number),
        expiry_dates: uploadExpiryDates,
        replace_document_ids: asVersion
          ? buildReplaceDocumentIds(uploadFiles, uploadTypes, matches)
          : undefined,
        change_notes: asVersion
          ? buildVersionChangeNotes(uploadFiles, uploadTypes, matches)
          : undefined,
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
      setUploadProgress("Upload complete.");
    } catch (caught: any) {
      setUploadProgress("");
      setUploadError(
        caught?.message || "The document could not be uploaded.",
      );
      return;
    }
    setUploadProgress("");
    setUploadFiles([]);
    setUploadTypes([]);
    setUploadExpiryDates([]);
    setBulkUploadType("");
    setUploadRequirement(null);
    setShowUpload(false);
    setDuplicateWarning(null);
  };

  const submitUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !uploadFiles.length ||
      uploadTypes.some((id) => !id) ||
      missingExpiryDates(
        uploadTypes,
        uploadExpiryDates,
        documentTypes.data ?? [],
      )
    )
      return;
    const employeeId =
      myFiles.find((document) => document.employee_id)?.employee_id ?? 0;
    if (employeeId) {
      try {
        const matches = await findUploadDuplicates(
          employeeId,
          uploadFiles,
          uploadTypes,
        );
        if (matches.length) {
          setDuplicateWarning({
            matches,
            proceedAsVersion: () => performUpload(true),
            proceedAsNew: () => performUpload(false),
          });
          return;
        }
      } catch (caught: any) {
        setUploadError(caught?.message || "Could not check for duplicate uploads.");
        return;
      }
    }
    await performUpload();
  };

  return (
    <div className="min-h-full mx-auto max-w-[1650px] space-y-5 bg-slate-50 p-6 pb-10">
      <header className={`flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between ${guideTarget === "workspace" ? "guide-emphasis rounded-2xl" : ""}`}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome, {user.data?.name || "there"}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setUploadRequirement(null);
            setUploadError("");
            setShowUpload(true);
          }}
          className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-5 py-3 text-sm font-bold text-white shadow-lg shadow-pink-200 ${guideTarget === "upload" ? "guide-emphasis" : ""}`}
        >
          <Upload className="h-4 w-4" /> Upload document
        </button>
      </header>
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
      <nav className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200">
        <div className="flex flex-wrap gap-1">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPage(id)}
            className={`inline-flex items-center gap-2 rounded-t-xl border-b-2 px-4 py-3 text-xs font-bold transition ${tab === id ? "border-brand-pink bg-gradient-to-r from-brand-text to-brand-pink text-white shadow-md shadow-pink-200" : "border-transparent text-slate-500 hover:bg-pink-50 hover:text-brand-text"} ${id === "shared" && guideTarget === "shared" ? "guide-emphasis" : ""} ${id === "files" && ["workspace", "upload", "approval"].includes(guideTarget || "") ? "guide-emphasis" : ""}`}
          >
            <Icon className="h-4 w-4" />
            {label}
            {count !== undefined && (
              <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
                {count}
              </span>
            )}
          </button>
        ))}
        </div>
        <button
          type="button"
          onClick={saveDefaultTab}
          className="mb-1 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-500 transition hover:border-brand-pink hover:text-brand-pink"
        >
          {defaultSaved ? "Default saved" : "Set as default view"}
        </button>
      </nav>
      {tab === "dashboard" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between rounded-2xl border border-pink-200 bg-pink-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-pink-600" />
              <div>
                <p className="text-sm font-bold text-pink-800">
                  You have {pending.length + outstanding.length} pending action
                  {pending.length + outstanding.length === 1 ? "" : "s"}
                </p>
                <p className="mt-1 text-xs text-pink-700">
                  Documents awaiting review or completion.
                </p>
              </div>
            </div>
            {(pending.length || outstanding.length) > 0 && (
              <button
                type="button"
                onClick={() => setPage("files")}
                className="rounded-full bg-pink-600 px-4 py-2 text-xs font-bold text-white"
              >
                View
              </button>
            )}
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800">Quick Actions</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  Upload,
                  "Upload Document",
                  "Submit a new document",
                  "/pages/my-documents?upload=1",
                ],
                [
                  Download,
                  "Download Template",
                  "Get forms and templates",
                  "/pages/document-intelligence",
                ],
                [
                  BookOpen,
                  "Review Policies",
                  "Read shared policies",
                  "#shared",
                ],
                [
                  Share2,
                  "Shared Documents",
                  "Open documents shared with you",
                  "#shared",
                ],
              ].map(([Icon, title, subtitle, href]) => (
                <Link
                  key={title as string}
                  href={href as string}
                  onClick={(event) => {
                    if (href === "#shared") {
                      event.preventDefault();
                      setPage("shared");
                    }
                  }}
                  className="group rounded-xl border border-slate-100 p-4 transition hover:border-pink-200 hover:bg-pink-50/40"
                >
                  <span className="inline-flex rounded-lg bg-pink-50 p-2 text-brand-pink">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="mt-3 text-xs font-bold text-slate-800">
                    {title as string}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {subtitle as string}
                  </p>
                </Link>
              ))}
            </div>
          </section>
          <div className="grid gap-5 xl:grid-cols-[1.7fr_0.8fr]">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-800">
                  Recent Documents
                </h2>
                <button
                  type="button"
                  onClick={() => setPage("files")}
                  className="text-xs font-bold text-brand-pink"
                >
                  View All
                </button>
              </div>
              <div className="space-y-2">
                {recent.map((document) => (
                  <button
                    type="button"
                    key={document.id}
                    onClick={() => setViewing(document)}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-3 py-3 text-left hover:bg-pink-50/30"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <FileText className="h-4 w-4 shrink-0 text-blue-500" />
                      <span className="min-w-0">
                        <strong className="block truncate text-xs text-slate-800">
                          {document.name}
                        </strong>
                        <small className="text-[10px] text-slate-400">
                          {document.folder_name}
                        </small>
                      </span>
                    </span>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold ${states[document.state] || states.draft}`}
                    >
                      {formatStatusLabel(document.state)}
                    </span>
                  </button>
                ))}
                {!recent.length && (
                  <p className="p-8 text-center text-sm text-slate-400">
                    No recent documents.
                  </p>
                )}
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-800">My Documents</h2>
              <dl className="mt-4 space-y-4 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Total</dt>
                  <dd className="font-bold text-blue-600">
                    {data?.dashboard.total ?? "-"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Approved</dt>
                  <dd className="font-bold text-emerald-600">
                    {data?.dashboard.states.approved ?? 0}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Pending</dt>
                  <dd className="font-bold text-amber-600">{pending.length}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Rejected</dt>
                  <dd className="font-bold text-red-600">
                    {data?.dashboard.states.rejected ?? 0}
                  </dd>
                </div>
              </dl>
            </section>
          </div>
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Favourites</h2>
              <Star className="h-4 w-4 text-brand-pink" />
            </div>
            {favourites.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {favourites.map((document) => (
                  <div
                    key={document.id}
                    className="flex items-center justify-between rounded-xl border border-slate-100 p-3"
                  >
                    <p className="truncate text-xs font-bold text-slate-700">
                      {document.name}
                    </p>
                    <DocumentActions
                      documentId={document.id}
                      documentName={document.name}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Your favourite documents will appear here.
              </p>
            )}
          </section>
        </div>
      )}
      {(tab === "files" || tab === "shared") && (
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {tab === "shared" ? "Shared Documents" : "My files"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {tab === "shared"
                ? "Organizational documents shared with your employee profile."
                : "Your submitted and assigned employee documents."}
            </p>
          </div>
          {tab === "files" && (
            <div className="space-y-3">
              <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setFileView("files")}
                  className={`rounded-full px-4 py-2 text-xs font-bold ${fileView === "files" ? "bg-gradient-to-r from-brand-text to-brand-pink text-white shadow-sm" : "text-slate-500 hover:bg-pink-50"}`}
                >
                  My Files
                </button>
                <button
                  type="button"
                  onClick={() => setFileView("outstanding")}
                  className={`rounded-full px-4 py-2 text-xs font-bold ${fileView === "outstanding" ? "bg-gradient-to-r from-brand-text to-brand-pink text-white shadow-sm" : "text-slate-500 hover:bg-pink-50"}`}
                >
                  Outstanding Documents{" "}
                  <span className="ml-1">{outstanding.length}</span>
                </button>
              </div>
              {fileView === "files" && (
                <DocumentFilterBar
                  filters={docFilters}
                  onChange={setDocFilters}
                  availableTypes={documentTypes.data ?? []}
                  showDepartmentFilter={false}
                  totalCount={myFiles.length}
                  filteredCount={filteredMyFiles.length}
                />
              )}
            </div>
          )}
          {tab === "shared" && (
            <div className="flex w-fit max-w-full flex-wrap gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                type="button"
                onClick={() => setSharedAckFilter("all")}
                className={`rounded-full px-4 py-2 text-xs font-bold ${sharedAckFilter === "all" ? "bg-gradient-to-r from-brand-text to-brand-pink text-white shadow-sm" : "text-slate-500 hover:bg-pink-50"}`}
              >
                All shared
              </button>
              <button
                type="button"
                onClick={() => setSharedAckFilter("needs_ack")}
                className={`rounded-full px-4 py-2 text-xs font-bold ${sharedAckFilter === "needs_ack" ? "bg-gradient-to-r from-brand-text to-brand-pink text-white shadow-sm" : "text-slate-500 hover:bg-pink-50"}`}
              >
                Needs acknowledgement{" "}
                <span className="ml-1">{needsAckCount}</span>
              </button>
            </div>
          )}
          <label className={`relative block max-w-md ${guideTarget === "search" ? "guide-emphasis rounded-full" : ""}`}>
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search documents..."
              className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-pink/40 focus:ring-4 focus:ring-brand-pink/10"
            />
          </label>
          <DocumentTable
            documents={
              tab === "shared"
                ? shared
                : fileView === "outstanding"
                  ? outstanding
                  : filteredMyFiles
            }
            search={search}
            shared={tab === "shared"}
            readOnly={fileView === "outstanding"}
            guideTarget={guideTarget || undefined}
            sharedAckFilter={tab === "shared" ? sharedAckFilter : "all"}
            pendingStatusById={pendingStatusById}
            onView={setViewing}
            onRequestApproval={async (document) => {
              if (
                window.confirm(
                  `Send "${document.name}" to an administrator for review?`,
                )
              )
                await requestApproval.mutateAsync(document.id);
            }}
            onUploadOutstanding={(document) => {
              setUploadRequirement(document);
              setUploadTypes([String(document.document_type_id)]);
              setUploadFiles([]);
              setUploadError("");
              setShowUpload(true);
            }}
          />
        </section>
      )}
      {tab === "activity" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">My Activity Log</h2>
          <p className="mt-1 text-sm text-slate-500">
            Recent activity across your employee workspace.
          </p>
          <div className="mt-5 divide-y divide-slate-100">
            {data?.activity.map((event) => (
              <div
                key={`${event.id}-${event.occurred_at}`}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div className="flex items-center gap-3">
                  <Activity className="h-4 w-4 text-brand-pink" />
                  <div>
                    <p className="text-sm font-bold text-slate-700">
                      {event.event === "Updated"
                        ? `You updated ${event.document}`
                        : `You added ${event.document}`}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      in {event.folder}
                    </p>
                  </div>
                </div>
                <time className="text-xs text-slate-400">
                  {event.occurred_at?.slice(0, 16).replace("T", " ")}
                </time>
              </div>
            ))}
            {!data?.activity.length && (
              <p className="py-12 text-center text-sm text-slate-400">
                No activity recorded.
              </p>
            )}
          </div>
        </section>
      )}
      {viewing && (
        <DocumentViewerDialog
          title={viewing.name}
          description={`${viewing.document_type} · ${viewing.folder_name}`}
          onClose={() => setViewing(null)}
          previewUrl={viewing.id > 0 ? previewUrl : undefined}
          documentId={viewing.id > 0 ? viewing.id : undefined}
          placeholder={
            viewing.id < 0 ? (
              <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
                <FileText className="h-9 w-9 text-brand-pink" />
                <h3 className="mt-4 text-lg font-bold text-slate-900">
                  {viewing.name}
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  {viewing.description || "This document has not been uploaded yet."}
                </p>
              </div>
            ) : undefined
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
      {duplicateWarning && (
        <UploadDuplicateDialog
          matches={duplicateWarning.matches}
          typeLabels={Object.fromEntries(
            (documentTypes.data ?? []).map((type) => [type.id, type.name]),
          )}
          onCancel={() => setDuplicateWarning(null)}
          onUploadAsVersion={() => void duplicateWarning.proceedAsVersion()}
          onUploadAsNew={() => void duplicateWarning.proceedAsNew()}
          pending={upload.isPending}
        />
      )}
      {showUpload && (
        <ModalDialog
          title={uploadRequirement ? "Complete outstanding document" : "Upload a document"}
          eyebrow="Employee files"
          description={
            uploadRequirement
              ? "This upload will be sent to an administrator for review immediately."
              : "Your document will be submitted for HR review. If a department folder exists, it will be assigned automatically after approval."
          }
          onClose={() => setShowUpload(false)}
          size="lg"
          backdropClassName="bg-slate-950/45"
          titleClassName="text-xl"
        >
          <form onSubmit={submitUpload}>
            <label className="block">
              <span className="label">Files</span>
              <span
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDraggingUpload(true);
                }}
                onDragLeave={() => setIsDraggingUpload(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDraggingUpload(false);
                  const next = Array.from(event.dataTransfer.files ?? []);
                  if (!next.length) return;
                  setUploadFiles(next);
                  setUploadTypes(
                    next.map((_, index) =>
                      uploadRequirement
                        ? String(uploadRequirement.document_type_id)
                        : uploadTypes[index] ?? "",
                    ),
                  );
                  setUploadExpiryDates(
                    next.map((_, index) => uploadExpiryDates[index] ?? ""),
                  );
                }}
                className={`flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed px-4 py-6 text-sm font-semibold transition ${
                  isDraggingUpload
                    ? "border-brand-pink bg-pink-100/70 text-brand-text"
                    : "border-brand-pink/40 bg-pink-50/50 text-brand-text"
                }`}
              >
                <Upload className="h-5 w-5" />
                {uploadFiles.length
                  ? `${uploadFiles.length} file${uploadFiles.length === 1 ? "" : "s"} selected`
                  : "Choose files or drag and drop them here"}
                <input
                  required
                  multiple
                  type="file"
                  onChange={(event) => {
                    const next = Array.from(event.target.files ?? []);
                    setUploadFiles(next);
                    setUploadTypes(
                      next.map((_, index) =>
                        uploadRequirement
                          ? String(uploadRequirement.document_type_id)
                          : uploadTypes[index] ?? "",
                      ),
                    );
                    setUploadExpiryDates(
                      next.map((_, index) => uploadExpiryDates[index] ?? ""),
                    );
                  }}
                  className="hidden"
                />
              </span>
            </label>
            {uploadFiles.length > 0 && (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  Selected files and types
                </p>
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(180px,220px)_minmax(140px,160px)] gap-3 px-2 pb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <span>File name</span>
                  <span>Document type</span>
                  <span>Expiry date</span>
                </div>
                <div className="space-y-2">
                  {uploadFiles.map((file, index) => {
                    const typeId =
                      uploadTypes[index] ??
                      (uploadRequirement
                        ? String(uploadRequirement.document_type_id)
                        : "");
                    return (
                      <div
                        key={`${file.name}-${index}`}
                        className="grid grid-cols-[minmax(0,1fr)_minmax(180px,220px)_minmax(140px,160px)] items-center gap-3 rounded-xl bg-white p-2"
                      >
                        <span
                          title={file.name}
                          className="min-w-0 truncate text-sm font-medium text-slate-700"
                        >
                          {file.name}
                        </span>
                        {uploadRequirement ? (
                          <span className="truncate rounded-full bg-pink-50 px-2 py-1 text-xs font-bold text-brand-pink">
                            {uploadRequirement.document_type}
                          </span>
                        ) : (
                          <ThemedSelect
                            value={uploadTypes[index] ?? ""}
                            onChange={(value) =>
                              setUploadTypes((current) =>
                                current.map((item, i) =>
                                  i === index ? value : item,
                                ),
                              )
                            }
                            placeholder="Document type"
                            options={(documentTypes.data ?? []).map((type) => ({
                              value: String(type.id),
                              label: type.name,
                            }))}
                          />
                        )}
                        {typeRequiresExpiry(typeId, documentTypes.data ?? []) ? (
                          <input
                            required
                            type="date"
                            className="field"
                            value={uploadExpiryDates[index] ?? ""}
                            onChange={(event) =>
                              setUploadExpiryDates((current) =>
                                current.map((item, i) =>
                                  i === index ? event.target.value : item,
                                ),
                              )
                            }
                          />
                        ) : (
                          <span className="text-xs text-slate-400">
                            Not required
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!uploadRequirement && (
                  <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                    <summary className="cursor-pointer text-xs font-bold text-slate-700">
                      Advanced configuration
                    </summary>
                    <div className="mt-3 flex items-end gap-2">
                      <label className="min-w-0 flex-1">
                        <span className="label">
                          Use one document type for all files
                        </span>
                        <ThemedSelect
                          value={bulkUploadType}
                          onChange={setBulkUploadType}
                          placeholder="Select a type"
                          options={(documentTypes.data ?? []).map((type) => ({
                            value: String(type.id),
                            label: type.name,
                          }))}
                        />
                      </label>
                      <button
                        type="button"
                        disabled={!bulkUploadType}
                        onClick={() =>
                          setUploadTypes(uploadFiles.map(() => bulkUploadType))
                        }
                        className="rounded-xl bg-pink-50 px-3 py-2.5 text-xs font-bold text-brand-pink disabled:opacity-50"
                      >
                        Apply to all
                      </button>
                    </div>
                  </details>
                )}
              </div>
            )}
            {uploadRequirement ? (
              <div className="mt-4 rounded-2xl border border-pink-100 bg-pink-50/50 p-3">
                <span className="label">Required document type</span>
                <p className="text-sm font-bold text-brand-text">
                  {uploadRequirement.document_type}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Automatically assigned from the outstanding requirement.
                </p>
              </div>
            ) : null}
            {uploadProgress && (
              <p className="mt-4 rounded-xl bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700">
                {uploadProgress}
              </p>
            )}
            {uploadError && (
              <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {uploadError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="rounded-full px-4 py-2.5 font-semibold text-slate-500"
              >
                Cancel
              </button>
              <button
                disabled={
                  upload.isPending ||
                  !uploadFiles.length ||
                  uploadTypes.some((id) => !id) ||
                  missingExpiryDates(
                    uploadTypes,
                    uploadExpiryDates,
                    documentTypes.data ?? [],
                  )
                }
                className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-5 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {upload.isPending
                  ? "Uploading..."
                  : uploadRequirement
                      ? "Upload and request review"
                    : "Upload documents"}
              </button>
            </div>
          </form>
        </ModalDialog>
      )}
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
