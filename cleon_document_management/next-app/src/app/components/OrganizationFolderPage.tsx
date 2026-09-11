"use client";

import {
  Archive,
  ChevronDown,
  FilePlus2,
  FileText,
  FolderOpen,
  Search,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  useDocumentTypes,
  useDocuments,
  useFolders,
  useUploadDocument,
} from "../../../hooks/useDocuments";
import DocumentActions from "./DocumentActions";
import BulkDocumentActions from "./BulkDocumentActions";
import InlineDocumentTypeCreator from "./InlineDocumentTypeCreator";
import ThemedSelect from "./ThemedSelect";
import MoveDocumentsDialog from "./MoveDocumentsDialog";
import ModalDialog from "./ModalDialog";
import BackButton from "./BackButton";
import DocumentViewerDialog from "./DocumentViewerDialog";
import UploadDuplicateDialog from "./UploadDuplicateDialog";
import {
  buildReplaceDocumentIds,
  buildVersionChangeNotes,
  findFolderUploadDuplicates,
} from "../../../lib/uploadDuplicates";
import type { UploadDuplicateMatch } from "../../../lib/types";

import DocumentFilterBar, {
  FilterState,
  INITIAL_FILTER_STATE,
  applyDocumentFilters,
} from "./DocumentFilterBar";
import {
  missingExpiryDates,
  typeRequiresExpiry,
} from "./uploadExpiryHelpers";

export default function OrganizationFolderPage() {
  const params = useSearchParams();
  const folderId = Number(params.get("folder"));
  const guideTarget = params.get("guide");
  const folders = useFolders();
  const documents = useDocuments(folderId || undefined, true);
  const types = useDocumentTypes();
  const upload = useUploadDocument();
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTER_STATE);
  const [showUpload, setShowUpload] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [typeIds, setTypeIds] = useState<string[]>([]);
  const [expiryDates, setExpiryDates] = useState<string[]>([]);
  const [bulkTypeId, setBulkTypeId] = useState("");
  const [viewing, setViewing] = useState<any>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [movingIds, setMovingIds] = useState<number[] | null>(null);
  const [folderExpanded, setFolderExpanded] = useState(true);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    matches: UploadDuplicateMatch[];
    proceedAsVersion: () => Promise<void>;
    proceedAsNew: () => Promise<void>;
  } | null>(null);
  const folder = folders.data?.find((item) => item.id === folderId);
  const visibleDocuments = useMemo(
    () => applyDocumentFilters(documents.data ?? [], filters),
    [documents.data, filters],
  );

  useEffect(() => {
    const docId = Number(params.get("doc") || 0);
    if (!docId || !documents.data?.length) return;
    const match = documents.data.find((document) => document.id === docId);
    if (match) setViewing(match);
  }, [documents.data, params]);

  useEffect(() => {
    const rows = Array.from(document.querySelectorAll("tbody tr"));
    rows.forEach((row) => {
      const name = row.textContent || "";
      const record = visibleDocuments.find((item) => name.includes(item.name));
      const badge = row.querySelector("td:nth-last-child(4) span");
      if (!record || !badge) return;
      const status =
        record.distribution_status ||
        (record.active === false ? "deactivated" : "active");
      badge.textContent =
        status === "archived"
          ? "Archived"
          : status === "deactivated"
            ? "Inactive"
            : "Active";
    });
  }, [visibleDocuments]);
  const visibleIds = visibleDocuments.map((document) => document.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggleSelected = (id: number) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  const performUpload = async (asVersion = false) => {
    if (
      !files.length ||
      !typeIds.length ||
      typeIds.some((id) => !id) ||
      !folderId ||
      missingExpiryDates(typeIds, expiryDates, types.data ?? [])
    )
      return;
    const matches = duplicateWarning?.matches ?? [];
    await upload.mutateAsync({
      files,
      folder_id: folderId,
      document_type_ids: typeIds.map(Number),
      expiry_dates: expiryDates,
      replace_document_ids: asVersion
        ? buildReplaceDocumentIds(files, typeIds, matches)
        : undefined,
      change_notes: asVersion
        ? buildVersionChangeNotes(files, typeIds, matches)
        : undefined,
    });
    setFiles([]);
    setTypeIds([]);
    setExpiryDates([]);
    setBulkTypeId("");
    setShowUpload(false);
    setDuplicateWarning(null);
  };

  const submitUpload = async (event: React.FormEvent) => {
    event.preventDefault();
    if (
      !files.length ||
      !typeIds.length ||
      typeIds.some((id) => !id) ||
      !folderId ||
      missingExpiryDates(typeIds, expiryDates, types.data ?? [])
    )
      return;
    const matches = findFolderUploadDuplicates(
      files,
      typeIds,
      documents.data ?? [],
    );
    if (matches.length) {
      setDuplicateWarning({
        matches,
        proceedAsVersion: () => performUpload(true),
        proceedAsNew: () => performUpload(false),
      });
      return;
    }
    await performUpload();
  };
  return (
    <div className="min-h-full mx-auto max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10">
      <BackButton variant="page" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          {folder?.folder_name ? (
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              {folder.folder_name}
            </h1>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/pages/archived"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:border-brand-pink hover:text-brand-pink"
          >
            <Archive className="h-4 w-4" />
            Archived
          </Link>
          <button
            type="button"
            onClick={() => setShowUpload(true)}
            className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200 ${guideTarget === "organizational-upload" ? "guide-emphasis" : ""}`}
          >
            <FilePlus2 className="h-4 w-4" />
            Add document
          </button>
        </div>
      </div>
      <DocumentFilterBar
        filters={filters}
        onChange={setFilters}
        availableTypes={types.data ?? []}
        showDepartmentFilter={false}
        totalCount={documents.data?.length}
        filteredCount={visibleDocuments.length}
      />
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="px-4 pt-4">
          <BulkDocumentActions
            selected={selected}
            onClear={() => setSelected([])}
            documents={visibleDocuments}
            organizational
            onMove={() => setMovingIds(selected)}
          />
        </div>
        {documents.isLoading ? (
          <div className="space-y-3 p-5">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : folder ? (
          <div className="folder-accordion p-4">
            <div className="folder-accordion-block">
              <div className="folder-accordion-header-row">
                <button
                  type="button"
                  className="folder-accordion-header"
                  onClick={() => setFolderExpanded((current) => !current)}
                >
                  <FolderOpen size={15} />
                  <span>{folder.folder_name}</span>
                  <small>{visibleDocuments.length} files</small>
                  <ChevronDown
                    size={15}
                    className={
                      folderExpanded
                        ? "folder-accordion-chevron expanded"
                        : "folder-accordion-chevron"
                    }
                  />
                </button>
              </div>
              {folderExpanded && (
                <div className="folder-accordion-body">
                  {visibleDocuments.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[980px] text-left">
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
                            <th className="px-5 py-4">Document</th>
                            <th className="px-5 py-4">Type</th>
                            <th className="px-5 py-4">Status</th>
                            <th className="px-5 py-4">Expiry date</th>
                            <th className="px-5 py-4">Uploaded</th>
                            <th className="px-5 py-4">Modified</th>
                            <th className="px-5 py-4" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {visibleDocuments.map((document) => (
                            <tr
                              key={document.id}
                              className="transition hover:bg-pink-50/30"
                            >
                              <td className="w-12 px-5 py-4">
                                <input
                                  type="checkbox"
                                  checked={selected.includes(document.id)}
                                  onChange={() => toggleSelected(document.id)}
                                  onClick={(event) => event.stopPropagation()}
                                  aria-label={`Select ${document.name}`}
                                  className="h-4 w-4 accent-pink-600"
                                />
                              </td>
                              <td className="px-5 py-4">
                                <button
                                  type="button"
                                  onClick={() => setViewing(document)}
                                  className="flex items-center gap-3 text-left"
                                >
                                  <span className="rounded-xl bg-pink-50 p-2.5 text-brand-pink">
                                    <FileText className="h-5 w-5" />
                                  </span>
                                  <span>
                                    <strong className="block text-sm text-slate-800 hover:text-brand-pink">
                                      {document.name}
                                    </strong>
                                    <small className="mt-1 block text-xs text-slate-400">
                                      {document.description || "Organizational document"}
                                    </small>
                                  </span>
                                </button>
                              </td>
                              <td className="px-5 py-4 text-sm text-slate-600">
                                {document.document_type}
                              </td>
                              <td className="px-5 py-4">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${document.active === false ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}
                                >
                                  {document.active === false ? "Inactive" : "Active"}
                                </span>
                              </td>
                              <td className="px-5 py-4 text-sm text-slate-500">
                                {document.expiry_date || "No expiry"}
                              </td>
                              <td className="px-5 py-4 text-sm text-slate-500">
                                {document.created_at?.slice(0, 10) || "Unknown"}
                              </td>
                              <td className="px-5 py-4 text-sm text-slate-500">
                                {document.write_date.slice(0, 10)}
                              </td>
                              <td className="px-5 py-4 text-right">
                                <DocumentActions
                                  documentId={document.id}
                                  documentName={document.name}
                                  active={document.active !== false}
                                  organizational
                                  onMove={() => setMovingIds([document.id])}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="folder-accordion-empty">
                      No documents found in this folder.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </section>
      {showUpload && (
        <ModalDialog
          title="Add documents"
          eyebrow="Organizational files"
          onClose={() => setShowUpload(false)}
          size="lg"
          titleClassName="text-xl"
        >
          <form onSubmit={submitUpload}>
            <label className="mt-5 block">
              <span className="label">Files</span>
              <span className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-brand-pink/40 bg-pink-50/50 px-4 py-5 text-sm font-semibold text-brand-text">
                <Upload className="h-5 w-5" />
                {files.length
                  ? `${files.length} file${files.length === 1 ? "" : "s"} selected`
                  : "Choose files from your computer"}
                <input
                  required
                  multiple
                  type="file"
                  onChange={(event) => {
                    const next = Array.from(event.target.files ?? []);
                    setFiles(next);
                    setTypeIds(next.map((_, index) => typeIds[index] ?? ""));
                    setExpiryDates(next.map((_, index) => expiryDates[index] ?? ""));
                  }}
                  className="hidden"
                />
              </span>
            </label>
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(180px,220px)_minmax(140px,160px)] gap-3 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                  <span>File name</span>
                  <span>Document type</span>
                  <span>Expiry date</span>
                </div>
                {files.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="grid grid-cols-[minmax(0,1fr)_minmax(180px,220px)_minmax(140px,160px)] items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-2"
                  >
                    <span
                      title={file.name}
                      className="min-w-0 truncate text-sm font-medium text-slate-700"
                    >
                      {file.name}
                    </span>
                    <ThemedSelect
                      value={typeIds[index] ?? ""}
                      onChange={(value) =>
                        setTypeIds((current) =>
                          current.map((item, i) =>
                            i === index ? value : item,
                          ),
                        )
                      }
                      placeholder="Document type"
                      options={(types.data ?? []).map((type: any) => ({
                        value: String(type.id),
                        label: type.name,
                      }))}
                    />
                    {typeRequiresExpiry(typeIds[index] ?? "", types.data ?? []) ? (
                      <input
                        required
                        type="date"
                        className="field"
                        value={expiryDates[index] ?? ""}
                        onChange={(event) =>
                          setExpiryDates((current) =>
                            current.map((item, i) =>
                              i === index ? event.target.value : item,
                            ),
                          )
                        }
                      />
                    ) : (
                      <span className="text-xs text-slate-400">Not required</span>
                    )}
                  </div>
                ))}
                <details className="rounded-xl border border-slate-200 bg-white p-3">
                  <summary className="cursor-pointer text-xs font-bold text-slate-700">
                    Advanced configuration
                  </summary>
                  <div className="mt-3 flex items-end gap-2">
                    <label className="min-w-0 flex-1">
                      <span className="label">
                        Use one document type for all files
                      </span>
                      <ThemedSelect
                        value={bulkTypeId}
                        onChange={setBulkTypeId}
                        placeholder="Select a type"
                        options={(types.data ?? []).map((type: any) => ({
                          value: String(type.id),
                          label: type.name,
                        }))}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={!bulkTypeId}
                      onClick={() => setTypeIds(files.map(() => bulkTypeId))}
                      className="rounded-xl bg-pink-50 px-3 py-2.5 text-xs font-bold text-brand-pink disabled:opacity-50"
                    >
                      Apply to all
                    </button>
                  </div>
                </details>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="rounded-xl px-4 py-2.5 font-semibold text-slate-500"
              >
                Cancel
              </button>
              <button
                disabled={
                  upload.isPending ||
                  !files.length ||
                  typeIds.some((id) => !id) ||
                  missingExpiryDates(typeIds, expiryDates, types.data ?? [])
                }
                className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2.5 font-semibold text-white"
              >
                {upload.isPending ? "Uploading..." : "Upload documents"}
              </button>
            </div>
          </form>
        </ModalDialog>
      )}
      {viewing && (
        <DocumentViewerDialog
          title={viewing.name}
          description={viewing.document_type}
          onClose={() => setViewing(null)}
          documentId={viewing.id}
          previewUrl={`${(process.env.NEXT_PUBLIC_ODOO_URL || "").replace(/\/$/, "")}/document-management/document/${viewing.id}/preview`}
          size="5xl"
          backdropClassName="bg-slate-900/40"
          iframeMinHeight="min-h-[65vh]"
          headerActions={
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600"
            >
              Print
            </button>
          }
        />
      )}
      {duplicateWarning && (
        <UploadDuplicateDialog
          matches={duplicateWarning.matches}
          typeLabels={Object.fromEntries(
            (types.data ?? []).map((type) => [type.id, type.name]),
          )}
          onCancel={() => setDuplicateWarning(null)}
          onUploadAsVersion={() => void duplicateWarning.proceedAsVersion()}
          onUploadAsNew={() => void duplicateWarning.proceedAsNew()}
          pending={upload.isPending}
        />
      )}
      {movingIds && (
        <MoveDocumentsDialog
          documentIds={movingIds}
          folders={folders.data ?? []}
          folderType="organizational"
          onClose={() => setMovingIds(null)}
          onMoved={() => {
            setMovingIds(null);
            setSelected([]);
          }}
        />
      )}
    </div>
  );
}
