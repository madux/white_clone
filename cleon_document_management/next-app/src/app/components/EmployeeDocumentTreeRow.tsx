"use client";

import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  X,
} from "lucide-react";
import { useDocumentVersions } from "../../../hooks/useDocuments";
import type { DocDocument } from "../../../lib/types";
import { approvalDisplayLabel, canReviewDocument } from "../../../lib/approvalHelpers";
import DocumentActions from "./DocumentActions";

const baseUrl = (process.env.NEXT_PUBLIC_ODOO_URL || "").replace(/\/$/, "");

function TreeChildCell({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <td className="px-5 py-3">
      <div className="flex items-start gap-2 border-l-2 border-slate-200 pl-6 ml-3">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>
        </div>
      </div>
    </td>
  );
}

function DocumentHistoryRows({
  documentId,
  relatedDocuments,
  onOpenDocument,
}: {
  documentId: number;
  relatedDocuments: DocDocument[];
  onOpenDocument: (document: DocDocument) => void;
}) {
  const versions = useDocumentVersions(documentId);
  const items = versions.data?.data ?? [];

  if (versions.isLoading) {
    return (
      <tr className="bg-slate-50/60">
        <td colSpan={7} className="px-5 py-3 pl-14 text-xs text-slate-400">
          Loading version history…
        </td>
      </tr>
    );
  }

  if (!items.length && !relatedDocuments.length) {
    return (
      <tr className="bg-slate-50/60">
        <td colSpan={7} className="px-5 py-3 pl-14 text-xs text-slate-400">
          No previous versions yet.
        </td>
      </tr>
    );
  }

  return (
    <>
      {items.map((version) => (
        <tr
          key={`version-${version.id}`}
          className="bg-slate-50/60 hover:bg-slate-50"
          data-version-child={documentId}
        >
          <td className="w-12 px-5 py-3" />
          <TreeChildCell
            title={`v${version.version_number}${
              version.change_note ? ` · ${version.change_note}` : ""
            }`}
            subtitle={`${version.uploaded_by} · ${version.upload_date
              ?.slice(0, 16)
              .replace("T", " ")}`}
          />
          <td className="px-5 py-3 text-sm text-slate-400">—</td>
          <td className="px-5 py-3">
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
              Archived
            </span>
          </td>
          <td className="px-5 py-3 text-sm text-slate-400">—</td>
          <td className="px-5 py-3 text-sm text-slate-500">
            {version.upload_date?.slice(0, 10)}
          </td>
          <td className="px-5 py-3 text-right">
            {baseUrl ? (
              <a
                href={`${baseUrl}/document-management/document/version/${version.id}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-pink hover:text-brand-pink"
              >
                Open
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
          </td>
        </tr>
      ))}
      {relatedDocuments.map((document) => (
        <tr
          key={`copy-${document.id}`}
          className="bg-slate-50/60 hover:bg-slate-50"
          data-related-document={document.id}
        >
          <td className="w-12 px-5 py-3" />
          <TreeChildCell
            title="Earlier copy"
            subtitle={`Uploaded ${document.write_date.slice(0, 10)}`}
          />
          <td className="px-5 py-3 text-sm text-slate-400">
            {document.document_type}
          </td>
          <td className="px-5 py-3">
            <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
              Superseded
            </span>
          </td>
          <td className="px-5 py-3 text-sm text-slate-400">
            {document.expiry_date ?? "—"}
          </td>
          <td className="px-5 py-3 text-sm text-slate-500">
            {document.write_date.slice(0, 10)}
          </td>
          <td className="px-5 py-3 text-right">
            <button
              type="button"
              onClick={() => onOpenDocument(document)}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-pink hover:text-brand-pink"
            >
              Open
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}

export default function EmployeeDocumentTreeRow({
  document,
  relatedDocuments = [],
  historyCount = 0,
  selected,
  expanded,
  onToggleExpand,
  onToggleSelect,
  onView,
  onOpenDocument,
  onApprove,
  onReject,
  reviewPending,
  showReviewActions,
}: {
  document: DocDocument;
  relatedDocuments?: DocDocument[];
  historyCount?: number;
  selected: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleSelect: () => void;
  onView: () => void;
  onOpenDocument: (document: DocDocument) => void;
  onApprove: () => void;
  onReject: () => void;
  reviewPending: boolean;
  showReviewActions: boolean;
}) {
  const archivedVersions = document.version_count ?? 0;
  const currentVersion =
    document.current_version_number ?? Math.max(archivedVersions + 1, 1);
  const hasHistory = historyCount > 0;

  return (
    <>
      <tr className="hover:bg-pink-50/30" data-document-row={document.id}>
        <td className="w-12 px-5 py-4">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            aria-label={`Select ${document.name}`}
            className="h-4 w-4 accent-pink-600"
          />
        </td>
        <td className="px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleExpand}
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? `Collapse versions of ${document.name}`
                  : `Expand versions of ${document.name}`
              }
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-slate-500 transition hover:border-brand-pink hover:text-brand-pink ${
                hasHistory
                  ? "border-brand-pink/30 bg-pink-50/50 text-brand-pink"
                  : "border-slate-200"
              }`}
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="h-5 w-5 shrink-0 text-brand-pink" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onView}
                    className="text-left font-semibold text-slate-800 transition hover:text-brand-pink focus:text-brand-pink"
                    aria-label={`Open ${document.name}`}
                  >
                    {document.name}
                  </button>
                  {hasHistory ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                      Current · v{currentVersion}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {document.description}
                  {hasHistory ? (
                    <span className="text-slate-500">
                      {" "}
                      · {historyCount} previous version
                      {historyCount === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span className="text-slate-400">
                      {" "}
                      · Click arrow to view version history
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        </td>
        <td className="px-5 py-4 text-sm text-slate-600">
          {document.document_type}
        </td>
        <td className="px-5 py-4">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
              document.approval_state === "approved"
                ? "bg-emerald-50 text-emerald-700"
                : document.waiting_for_prior
                  ? "bg-slate-100 text-slate-600"
                  : document.can_review
                    ? "bg-amber-50 text-amber-700"
                    : "bg-amber-50/70 text-amber-700"
            }`}
          >
            {document.approval_state === "approved" && (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {approvalDisplayLabel(document)}
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
            {showReviewActions && canReviewDocument(document) && (
              <>
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={reviewPending}
                  title="Approve document"
                  aria-label={`Approve ${document.name}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  disabled={reviewPending}
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
      {expanded ? (
        <DocumentHistoryRows
          documentId={document.id}
          relatedDocuments={relatedDocuments}
          onOpenDocument={onOpenDocument}
        />
      ) : null}
    </>
  );
}
