"use client";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Check,
  Download,
  FilePlus2,
  FileText,
  Mail,
  MapPin,
  Maximize2,
  Minimize2,
  Phone,
  Upload,
  X,
  XCircle,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  useComplianceTargets,
  useCurrentUser,
  useDocumentTypes,
  useDocuments,
  useReviewDocument,
  useUploadEmployeeDocument,
} from "../../../hooks/useDocuments";
import { api } from "../../../lib/api";
import DocumentActions from "./DocumentActions";
import BulkDocumentActions from "./BulkDocumentActions";
import InlineDocumentTypeCreator from "./InlineDocumentTypeCreator";
import SortableTable from "./SortableTable";
import ThemedSelect from "./ThemedSelect";

export default function EmployeeProfilePage() {
  const params = useSearchParams();
  const documents = useDocuments();
  const targets = useComplianceTargets();
  const currentUser = useCurrentUser();
  const review = useReviewDocument();
  const availableDocumentTypes = useDocumentTypes();
  const uploadEmployeeDocument = useUploadEmployeeDocument();
  const [typeFilter, setTypeFilter] = useState("all");
  const [selected, setSelected] = useState<number[]>([]);
  const [viewing, setViewing] = useState<any>(null);
  const [rejecting, setRejecting] = useState<any>(null);
  const [viewerFullscreen, setViewerFullscreen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadTypes, setUploadTypes] = useState<string[]>([]);
  const [bulkUploadType, setBulkUploadType] = useState("");
  const [uploadError, setUploadError] = useState("");
  const employeeId = Number(params.get("employee"));
  const employeeDocuments = useMemo(
    () =>
      (documents.data ?? []).filter((document) =>
        employeeId ? document.employee_id === employeeId : document.employee_id,
      ),
    [documents.data, employeeId],
  );
  const employee = employeeDocuments[0];
  const employeeRecord = targets.data?.employees.find(
    (item) => item.id === employeeId,
  );
  const approved = employeeDocuments.filter(
    (document) => document.approval_state === "approved",
  ).length;
  const compliance = employeeDocuments.length
    ? Math.round((approved / employeeDocuments.length) * 100)
    : 0;
  const documentTypes = [
    ...new Set(employeeDocuments.map((document) => document.document_type)),
  ];
  const filteredEmployeeDocuments =
    typeFilter === "all"
      ? employeeDocuments
      : employeeDocuments.filter(
          (document) => document.document_type === typeFilter,
        );
  const visibleIds = filteredEmployeeDocuments.map((document) => document.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleSelected = (id: number) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const name =
    employeeRecord?.name ?? employee?.employee_name ?? "Employee profile";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const approvalLabel = (state: string) =>
    state === "pending"
      ? "Requires approval"
      : state.replace("_", " ");

  const handleReview = async (
    document: any,
    action: "approve" | "reject",
    reason = "",
  ) => {
    setReviewError("");
    try {
      const result = await review.mutateAsync({
        id: document.id,
        action,
        ...(action === "reject" ? { reason } : {}),
      });
      if (!result.success) {
        throw new Error(
          (result as { message?: string }).message ||
            "The document review could not be completed.",
        );
      }
      setViewing(null);
      setRejecting(null);
      setRejectReason("");
    } catch (error: any) {
      setReviewError(error?.message || "The document review could not be completed.");
    }
  };

  return (
    <div className="min-h-full mx-auto max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10">
      <Link
        href="/pages/employee"
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-brand-pink"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Employee Files
      </Link>
      {reviewError && !rejecting && (
        <p
          role="alert"
          className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {reviewError}
        </p>
      )}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-pink-50 text-2xl font-bold text-brand-pink ring-4 ring-pink-50">
              {employee ? initials : <UserRound className="h-8 w-8" />}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-pink">
                Employee profile
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
                {name}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                EMP-{employeeRecord?.id ?? employee?.employee_id ?? "---"}
              </p>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="h-4 w-4 text-brand-pink" />
                  {employeeRecord?.job_title || "Employee record"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4 text-brand-pink" />
                  {employeeRecord?.location || "Location not set"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4 text-brand-pink" />
                  {employeeRecord?.grade || "Grade not set"}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-brand-pink" />
                  {employeeRecord?.work_email || "Email not set"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-4 w-4 text-brand-pink" />
                  {employeeRecord?.work_phone || "Phone not set"}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700">
              Active
            </span>
            <button
              type="button"
              onClick={() => {
                setUploadError("");
                setShowUpload(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200"
            >
              <FilePlus2 className="h-4 w-4" />
              Upload document
            </button>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
          <span className="rounded-xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
            Overview
          </span>
          <span className="text-sm font-semibold text-slate-400">
            {compliance}% compliant
          </span>
        </div>
      </section>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-brand-text to-brand-pink p-5 text-white shadow-lg shadow-pink-200">
          <p className="text-sm text-white/80">Compliance score</p>
          <p className="mt-3 text-3xl font-bold">{compliance}%</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-white"
              style={{ width: `${compliance}%` }}
            />
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total documents</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">
            {employeeDocuments.length}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Across this employee record
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Approved documents</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{approved}</p>
          <p className="mt-1 text-xs text-slate-400">
            Ready for compliance review
          </p>
        </div>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <h2 className="text-xl font-bold text-slate-900">
            All employee documents
          </h2>

          <div className="mt-5 flex flex-wrap gap-1 border-b border-slate-100">
            <button
              type="button"
              onClick={() => setTypeFilter("all")}
              className={`border-b-2 px-3 py-2.5 text-xs font-bold transition ${typeFilter === "all" ? "border-brand-pink text-brand-pink" : "border-transparent text-slate-400 hover:text-slate-700"}`}
            >
              All documents
            </button>
            {documentTypes.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setTypeFilter(type)}
                className={`border-b-2 px-3 py-2.5 text-xs font-bold transition ${typeFilter === type ? "border-brand-pink text-brand-pink" : "border-transparent text-slate-400 hover:text-slate-700"}`}
              >
                {type}
                <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px]">
                  {
                    employeeDocuments.filter(
                      (document) => document.document_type === type,
                    ).length
                  }
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="px-5 pt-4">
          <BulkDocumentActions
            selected={selected}
            onClear={() => setSelected([])}
          />
        </div>
        {documents.isLoading ? (
          <div className="space-y-3 p-5">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : filteredEmployeeDocuments.length ? (
          <div className="overflow-x-auto">
              <SortableTable className="w-full min-w-[900px] text-left">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="w-12 px-5 py-4">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() =>
                        setSelected(allSelected ? [] : visibleIds)
                      }
                      aria-label="Select all documents"
                      className="h-4 w-4 accent-pink-600"
                    />
                  </th>
                  <th className="px-5 py-4">Document name</th>
                  <th className="px-5 py-4">Category</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Expiry date</th>
                  <th className="px-5 py-4">Modified</th>
                  <th className="px-5 py-4" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployeeDocuments.map((document) => (
                  <tr key={document.id} className="hover:bg-pink-50/30">
                    <td className="w-12 px-5 py-4">
                      <input
                        type="checkbox"
                        checked={selected.includes(document.id)}
                        onChange={() => toggleSelected(document.id)}
                        aria-label={`Select ${document.name}`}
                        className="h-4 w-4 accent-pink-600"
                      />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-brand-pink" />
                        <div>
                          <button
                            type="button"
                            onClick={() => setViewing(document)}
                            className="text-left font-semibold text-slate-800 transition hover:text-brand-pink focus:text-brand-pink"
                            aria-label={`Open ${document.name}`}
                          >
                            {document.name}
                          </button>
                          <p className="mt-1 text-xs text-slate-400">
                            {document.description}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {document.document_type}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${document.approval_state === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                      >
                        {document.approval_state === "approved" && (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {approvalLabel(document.approval_state)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {document.expiry_date ?? "No expiry"}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500">
                      {document.write_date.slice(0, 10)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {currentUser.data?.is_document_manager &&
                          document.approval_state === "pending" && (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleReview(document, "approve")}
                                disabled={review.isPending}
                                title="Approve document"
                                aria-label={`Approve ${document.name}`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Check className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRejecting(document);
                                  setRejectReason("");
                                  setReviewError("");
                                }}
                                disabled={review.isPending}
                                title="Reject document"
                                aria-label={`Reject ${document.name}`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:border-red-300 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        <DocumentActions
                          documentId={document.id}
                          documentName={document.name}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </SortableTable>
          </div>
        ) : (
          <p className="p-10 text-center text-sm text-slate-500">
            No documents found for this filter.
          </p>
        )}
      </section>
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <form
            onSubmit={async (event) => {
              event.preventDefault();
              if (!uploadFiles.length || uploadTypes.some((id) => !id) || !employeeId) return;
              setUploadError("");
              try {
                const response = await uploadEmployeeDocument.mutateAsync({
                  files: uploadFiles,
                  employee_id: employeeId,
                  document_type_ids: uploadTypes.map(Number),
                });
                if (!response.success || !response.data?.id) {
                  throw new Error(response.message || "The document could not be uploaded.");
                }
                setUploadFiles([]);
                setUploadTypes([]);
                setBulkUploadType("");
                setShowUpload(false);
              } catch (error: any) {
                setUploadError(error?.message || "The document could not be uploaded.");
              }
            }}
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-pink">Employee files</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">Upload documents</h2>
                <p className="mt-1 text-sm text-slate-500">Upload one or more files directly to this employee’s records.</p>
              </div>
              <button type="button" onClick={() => setShowUpload(false)} className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"><X className="h-5 w-5" /></button>
            </div>
            <label className="mt-5 block">
              <span className="label">Files</span>
              <span className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-brand-pink/40 bg-pink-50/50 px-4 py-6 text-sm font-semibold text-brand-text">
                <Upload className="h-5 w-5" />{uploadFiles.length ? `${uploadFiles.length} file${uploadFiles.length === 1 ? "" : "s"} selected` : "Choose files from your computer"}
                <input required multiple type="file" onChange={(event) => { const next = Array.from(event.target.files ?? []); setUploadFiles(next); setUploadTypes(next.map((_, index) => uploadTypes[index] ?? "")); }} className="hidden" />
              </span>
            </label>
            {uploadFiles.length > 0 && <div className="mt-4 space-y-2"><div className="grid grid-cols-[minmax(0,1fr)_minmax(180px,220px)] gap-3 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400"><span>File name</span><span>Document type</span></div>{uploadFiles.map((file, index) => <div key={`${file.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(180px,220px)] items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-2"><span title={file.name} className="min-w-0 truncate text-sm font-medium text-slate-700">{file.name}</span><ThemedSelect value={uploadTypes[index] ?? ""} onChange={(value) => setUploadTypes((current) => current.map((item, i) => i === index ? value : item))} placeholder="Document type" options={(availableDocumentTypes.data ?? []).map((type) => ({ value: String(type.id), label: type.name }))} /></div>)}<button type="button" className="text-xs font-bold text-brand-pink" onClick={() => { const value = uploadTypes[0] ?? ""; setUploadTypes(uploadFiles.map(() => value)); }}>Apply first type to all</button></div>}
            <details className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <summary className="cursor-pointer text-xs font-bold text-slate-700">Advanced configuration</summary>
              <div className="mt-3 flex items-end gap-2">
                <label className="min-w-0 flex-1">
                  <span className="label">Use one document type for all files</span>
                  <ThemedSelect value={bulkUploadType} onChange={setBulkUploadType} placeholder="Select a type" options={(availableDocumentTypes.data ?? []).map((type) => ({ value: String(type.id), label: type.name }))} />
                </label>
                <InlineDocumentTypeCreator onCreated={(type) => setBulkUploadType(String(type.id))} />
                <button type="button" disabled={!bulkUploadType} onClick={() => setUploadTypes(uploadFiles.map(() => bulkUploadType))} className="rounded-xl bg-pink-50 px-3 py-2.5 text-xs font-bold text-brand-pink disabled:opacity-50">Apply to all</button>
              </div>
            </details>
            {uploadError && <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{uploadError}</p>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowUpload(false)} className="rounded-full px-4 py-2.5 font-semibold text-slate-500">Cancel</button>
              <button disabled={uploadEmployeeDocument.isPending || !uploadFiles.length || uploadTypes.some((id) => !id)} className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-5 py-2.5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{uploadEmployeeDocument.isPending ? "Uploading..." : "Upload documents"}</button>
            </div>
          </form>
        </div>
      )}
      {viewing && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm ${viewerFullscreen ? "" : "p-4"}`}>
          <div className={`flex w-full flex-col overflow-hidden bg-white shadow-2xl ${viewerFullscreen ? "h-screen max-w-none rounded-none" : "max-h-[92vh] max-w-4xl rounded-3xl"}`}>
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-pink">
                  {viewing.approval_state === "pending" && currentUser.data?.is_document_manager
                    ? "Admin review"
                    : "Document viewer"}
                </p>
                <h2 className="mt-1 text-lg font-bold text-slate-900">
                  {viewing.name}
                </h2>
                <p className="text-xs text-slate-400">
                  {viewing.document_type}
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
                  onClick={() => setViewerFullscreen((current) => !current)}
                  aria-label={viewerFullscreen ? "Exit full screen" : "Open full screen"}
                  className="rounded-full border border-slate-200 p-2 text-slate-500 hover:border-brand-pink hover:text-brand-pink"
                >
                  {viewerFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => { setViewing(null); setViewerFullscreen(false); }}
                  className="rounded-full p-2 text-slate-400 hover:bg-pink-50 hover:text-brand-pink"
                >
                  <X />
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden bg-slate-100 p-5">
              <iframe
                title={viewing.name}
                src={`${(process.env.NEXT_PUBLIC_ODOO_URL || "").replace(/\/$/, "")}/document-management/document/${viewing.id}/preview`}
                className="block h-full min-h-[62vh] w-full pointer-events-auto rounded-2xl border border-slate-200 bg-white"
              />
            </div>
            {viewing.approval_state === "pending" && currentUser.data?.is_document_manager && (
              <div className="border-t border-slate-100 p-5">
                <p className="text-sm font-semibold text-slate-700">
                  This document is awaiting approval.
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={review.isPending}
                    onClick={() => {
                      setRejecting(viewing);
                      setViewing(null);
                      setRejectReason("");
                      setReviewError("");
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2.5 text-sm font-bold text-red-600"
                  >
                    <XCircle className="h-4 w-4" />
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={review.isPending}
                    onClick={() => void handleReview(viewing, "approve")}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-4 py-2.5 text-sm font-bold text-white"
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {rejecting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-document-title"
            onSubmit={(event) => {
              event.preventDefault();
              if (!rejectReason.trim()) {
                setReviewError("Add a reason before rejecting this document.");
                return;
              }
              void handleReview(rejecting, "reject", rejectReason.trim());
            }}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-red-500">
                  Reject document
                </p>
                <h2 id="reject-document-title" className="mt-1 text-xl font-bold text-slate-900">
                  Explain what needs to change
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  The requester will see this reason when they review the rejected document.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRejecting(null)}
                aria-label="Close rejection dialog"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="mt-5 block">
              <span className="label">Reason</span>
              <textarea
                autoFocus
                required
                value={rejectReason}
                onChange={(event) => {
                  setRejectReason(event.target.value);
                  setReviewError("");
                }}
                rows={4}
                placeholder="Explain what needs to be corrected..."
                className="field min-h-28 resize-none"
              />
            </label>
            {reviewError && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                {reviewError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejecting(null)}
                className="rounded-full px-4 py-2.5 font-semibold text-slate-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={review.isPending}
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                {review.isPending ? "Rejecting..." : "Reject document"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
