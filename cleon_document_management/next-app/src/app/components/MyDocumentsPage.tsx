"use client";

import {
  Activity,
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
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAcknowledgeDocument,
  useCurrentUser,
  useDocumentTypes,
  useMyWorkspace,
  useRequestDocumentApproval,
  useUploadMyDocument,
} from "../../../hooks/useDocuments";
import { api, useTestData } from "../../../lib/api";
import DocumentActions from "./DocumentActions";
import SortableTable from "./SortableTable";
import ThemedSelect from "./ThemedSelect";

type Tab = "dashboard" | "files" | "shared" | "activity";
type FileView = "files" | "outstanding";
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
}: {
  documents: any[];
  search: string;
  shared?: boolean;
  readOnly?: boolean;
  onView: (document: any) => void;
  onRequestApproval?: (document: any) => void;
  onUploadOutstanding?: (document: any) => void;
}) {
  const rows = documents.filter((document) =>
    `${document.name} ${document.document_type} ${document.folder_name}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <SortableTable className="w-full min-w-[850px] text-left">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-400">
            <tr>
              <th className="px-5 py-4">Document</th>
              <th className="px-5 py-4">Category</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4">
                {shared ? "Shared from" : "Last updated"}
              </th>
              <th className="px-5 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((document) => (
              <tr key={document.id} className="transition hover:bg-pink-50/30">
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
                    </span>
                  </button>
                </td>
                <td className="px-5 py-4 text-sm text-slate-600">
                  {document.document_type}
                </td>
                <td className="px-5 py-4">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${shared && document.acknowledged ? states.approved : states[document.state] || states.draft}`}
                  >
                    {shared && document.acknowledged
                      ? "Acknowledged"
                      : document.state}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-slate-500">
                  {document.write_date?.slice(0, 10) || "Required"}
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
                      <button type="button" onClick={() => onUploadOutstanding(document)} className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-3 py-2 text-xs font-bold text-white">Upload</button>
                    )}
                    {!readOnly && !shared && (
                      <>
                        {document.state === "draft" || document.state === "rejected" ? <button type="button" onClick={() => onRequestApproval?.(document)} className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-3 py-2 text-xs font-bold text-white">Request approval</button> : null}
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
  const user = useCurrentUser();
  const acknowledge = useAcknowledgeDocument();
  const upload = useUploadMyDocument();
  const requestApproval = useRequestDocumentApproval();
  const documentTypes = useDocumentTypes();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [fileView, setFileView] = useState<FileView>("files");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<any>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadType, setUploadType] = useState("");
  const [uploadRequirement, setUploadRequirement] = useState<any>(null);
  const [uploadError, setUploadError] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showTypeFilter, setShowTypeFilter] = useState(false);
  const typeFilterRef = useRef<HTMLDivElement>(null);
  const data = workspace.data;
  const myFiles = data?.my_files ?? [];
  const shared = data?.shared_documents ?? [];
  const outstanding = data?.outstanding ?? [];
  const combined = [...myFiles, ...shared];
  const filteredMyFiles = typeFilter === "all" ? myFiles : myFiles.filter((document) => String(document.document_type_id) === typeFilter);
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
      label: "Employee Files",
      icon: FileText,
      count: myFiles.length,
    },
    {
      id: "shared" as const,
      label: "Shared Documents",
      icon: Share2,
      count: shared.length,
    },
    { id: "activity" as const, label: "Activity Log", icon: Activity },
  ];
  const setPage = (next: Tab) => {
    setTab(next);
    setSearch("");
  };
  const previewUrl =
    viewing?.id > 0
      ? `${(process.env.NEXT_PUBLIC_ODOO_URL || "").replace(/\/$/, "")}/document-management/document/${viewing.id}/preview`
      : "";
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (typeFilterRef.current && !typeFilterRef.current.contains(event.target as Node)) setShowTypeFilter(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setShowTypeFilter(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", escape); };
  }, []);
  const submitUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!uploadFile || !uploadType) return;
    setUploadError("");
    try {
      const result = await upload.mutateAsync({ file: uploadFile, document_type_id: Number(uploadType) });
      const response = result as { success: boolean; data?: { id: number }; message?: string };
      if (!response.success || !response.data?.id) throw new Error(response.message || "The document could not be uploaded.");
      await requestApproval.mutateAsync(response.data.id);
    } catch (caught: any) {
      setUploadError(caught?.message || "The document could not be submitted for approval.");
      return;
    }
    setUploadFile(null);
    setUploadType("");
    setUploadRequirement(null);
    setShowUpload(false);
  };

  return (
    <div className="min-h-full mx-auto max-w-[1650px] space-y-5 rounded-2xl bg-gray-100 p-6 pb-10">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Welcome, {user.data?.name || "there"}
          </h1>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Employee workspace ·{" "}
            {user.data?.company_name || "Document Management"}
          </p>
        </div>
        <button type="button" onClick={() => { setUploadRequirement(null); setUploadError(""); setShowUpload(true); }} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-5 py-3 text-sm font-bold text-white shadow-lg shadow-pink-200"><Upload className="h-4 w-4" /> Upload document</button>
      </header>
      <nav className="flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <button
            key={id}
            type="button"
            onClick={() => setPage(id)}
            className={`inline-flex items-center gap-2 rounded-t-xl border-b-2 px-4 py-3 text-xs font-bold transition ${tab === id ? "border-brand-pink bg-gradient-to-r from-brand-text to-brand-pink text-white shadow-md shadow-pink-200" : "border-transparent text-slate-500 hover:bg-pink-50 hover:text-brand-text"}`}
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
                  "/pages/employee",
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
                      className={`rounded-full px-2 py-1 text-[10px] font-bold capitalize ${states[document.state] || states.draft}`}
                    >
                      {document.state}
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
              {tab === "shared" ? "Shared Documents" : "Employee Files"}
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
                <button type="button" onClick={() => setFileView("files")} className={`rounded-full px-4 py-2 text-xs font-bold ${fileView === "files" ? "bg-gradient-to-r from-brand-text to-brand-pink text-white shadow-sm" : "text-slate-500 hover:bg-pink-50"}`}>My Files</button>
                <button type="button" onClick={() => setFileView("outstanding")} className={`rounded-full px-4 py-2 text-xs font-bold ${fileView === "outstanding" ? "bg-gradient-to-r from-brand-text to-brand-pink text-white shadow-sm" : "text-slate-500 hover:bg-pink-50"}`}>Outstanding Documents <span className="ml-1">{outstanding.length}</span></button>
              </div>
              {fileView === "files" && <div ref={typeFilterRef} className="relative"><button type="button" aria-haspopup="menu" aria-expanded={showTypeFilter} onClick={() => setShowTypeFilter((current) => !current)} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-bold transition ${typeFilter !== "all" || showTypeFilter ? "border-brand-pink bg-pink-50 text-brand-text" : "border-slate-200 bg-white text-slate-600 hover:border-brand-pink hover:text-brand-text"}`}><SlidersHorizontal className="h-4 w-4" /> Filter{typeFilter !== "all" && <span className="h-1.5 w-1.5 rounded-full bg-brand-pink" />}</button>{showTypeFilter && <div role="menu" className="absolute left-0 top-[calc(100%+0.5rem)] z-40 w-64 rounded-2xl border border-pink-100 bg-white p-2 shadow-xl shadow-slate-900/10"><div className="border-b border-slate-100 px-3 py-2"><p className="text-xs font-bold text-slate-800">Filter by document type</p><p className="mt-0.5 text-[11px] text-slate-400">Choose which files to show</p></div><div className="mt-1 space-y-0.5"><button type="button" role="menuitem" onClick={() => { setTypeFilter("all"); setShowTypeFilter(false); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${typeFilter === "all" ? "bg-pink-50 font-bold text-brand-text" : "text-slate-600 hover:bg-pink-50/70"}`}>All types{typeFilter === "all" && <Check className="h-4 w-4" />}</button>{documentTypes.data?.map((type) => <button key={type.id} type="button" role="menuitem" onClick={() => { setTypeFilter(String(type.id)); setShowTypeFilter(false); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${typeFilter === String(type.id) ? "bg-pink-50 font-bold text-brand-text" : "text-slate-600 hover:bg-pink-50/70"}`}>{type.name}{typeFilter === String(type.id) && <Check className="h-4 w-4" />}</button>)}</div></div>}</div>}
            </div>
          )}
          <label className="relative block max-w-md">
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
            onView={setViewing}
            onRequestApproval={async (document) => {
              if (window.confirm(`Send "${document.name}" to an administrator for review?`)) await requestApproval.mutateAsync(document.id);
            }}
            onUploadOutstanding={(document) => { setUploadRequirement(document); setUploadType(String(document.document_type_id)); setUploadFile(null); setUploadError(""); setShowUpload(true); }}
          />
        </section>
      )}
      {tab === "activity" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Activity Log</h2>
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
                      {event.event}: {event.document}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {event.folder}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-pink">
                  Document viewer
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {viewing.name}
                </h2>
                <p className="text-xs text-slate-400">
                  {viewing.document_type} · {viewing.folder_name}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => api.downloadDocument(viewing.id)}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-pink px-3 py-2 text-xs font-bold text-white"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setViewing(null)}
                  className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"
                >
                  <X />
                </button>
              </div>
            </div>
            <div className="min-h-[360px] flex-1 overflow-y-auto bg-slate-100 p-5">
              {useTestData || viewing.id < 0 ? (
                <div className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-sm">
                  <FileText className="h-9 w-9 text-brand-pink" />
                  <h3 className="mt-4 text-lg font-bold text-slate-900">
                    {viewing.name}
                  </h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">
                    {viewing.description || "Test document preview."}
                  </p>
                </div>
              ) : (
                <iframe
                  title={viewing.name}
                  src={previewUrl}
                  className="h-[62vh] w-full rounded-2xl border border-slate-200 bg-white"
                />
              )}
            </div>
            {tab === "shared" && !viewing.acknowledged && (
              <div className="border-t border-amber-200 bg-amber-50 p-5">
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
                        await acknowledge.mutateAsync(viewing.id);
                        setViewing({ ...viewing, acknowledged: true });
                      }}
                      className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-4 py-2.5 text-xs font-bold text-white"
                    >
                      <Check className="h-4 w-4" />
                      {acknowledge.isPending
                        ? "Recording..."
                        : "Acknowledge document"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {showUpload && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowUpload(false); }}><form onSubmit={submitUpload} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-pink">Employee files</p><h2 className="mt-1 text-xl font-bold text-slate-900">{uploadRequirement ? "Complete outstanding document" : "Upload a document"}</h2><p className="mt-1 text-sm text-slate-500">{uploadRequirement ? "This upload will be sent to an administrator for review immediately." : "Your document will be saved as a draft and can be submitted for approval."}</p></div><button type="button" onClick={() => setShowUpload(false)} className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"><X className="h-5 w-5" /></button></div><label className="mt-5 block"><span className="label">File</span><span className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-brand-pink/40 bg-pink-50/50 px-4 py-6 text-sm font-semibold text-brand-text"><Upload className="h-5 w-5" />{uploadFile?.name ?? "Choose a file from your computer"}<input required type="file" onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)} className="hidden" /></span></label>{uploadRequirement ? <div className="mt-4 rounded-2xl border border-pink-100 bg-pink-50/50 p-3"><span className="label">Required document type</span><p className="text-sm font-bold text-brand-text">{uploadRequirement.document_type}</p><p className="mt-1 text-xs text-slate-500">Automatically assigned from the outstanding requirement.</p></div> : <label className="mt-4 block"><span className="label">Document type</span><ThemedSelect value={uploadType} onChange={setUploadType} placeholder="Select document type" options={(documentTypes.data ?? []).map((type) => ({ value: String(type.id), label: type.name }))} /></label>}{uploadError && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{uploadError}</p>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setShowUpload(false)} className="rounded-full px-4 py-2.5 font-semibold text-slate-500">Cancel</button><button disabled={upload.isPending || requestApproval.isPending || !uploadFile || !uploadType} className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-5 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{upload.isPending ? "Uploading..." : requestApproval.isPending ? "Sending for review..." : uploadRequirement ? "Upload and request review" : "Upload draft"}</button></div></form></div>}
    </div>
  );
}
