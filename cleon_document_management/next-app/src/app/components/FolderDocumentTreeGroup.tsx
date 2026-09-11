"use client";

import type { ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useDocumentVersions } from "../../../hooks/useDocuments";
import { documentViewHref } from "../../../lib/documentLinks";
import type { EmployeeDocumentGroup } from "../../../lib/groupEmployeeDocuments";
import type { DocDocument } from "../../../lib/types";

const baseUrl = (process.env.NEXT_PUBLIC_ODOO_URL || "").replace(/\/$/, "");

function VersionHistoryRows({
  documentId,
  relatedDocuments,
  isDocumentManager,
  onDocumentOpen,
  onDeleteVersion,
  onDeleteRelatedDocument,
  depth,
}: {
  documentId: number;
  relatedDocuments: DocDocument[];
  isDocumentManager: boolean;
  onDocumentOpen?: (document: DocDocument) => void;
  onDeleteVersion?: (versionId: number, versionNumber: number) => void;
  onDeleteRelatedDocument?: (document: DocDocument) => void;
  depth: number;
}) {
  const versions = useDocumentVersions(documentId);
  const items = versions.data?.data ?? [];
  const pad = depth * 20 + 16;

  if (versions.isLoading) {
    return (
      <p className="employee-tree-empty" style={{ paddingLeft: `${pad}px` }}>
        Loading version history…
      </p>
    );
  }

  return (
    <>
      {items.map((version) => (
        <div
          key={`version-${version.id}`}
          className="employee-tree-row employee-tree-row-file employee-tree-row-version"
          style={{ paddingLeft: `${pad}px` }}
        >
          <span className="employee-tree-version-line" aria-hidden />
          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-600">
              v{version.version_number}
              {version.change_note ? (
                <span className="font-normal text-slate-500">
                  {" "}
                  · {version.change_note}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-slate-400">
              {version.uploaded_by} ·{" "}
              {version.upload_date?.slice(0, 16).replace("T", " ")}
            </p>
          </div>
          <span className="employee-tree-badge archived">Archived</span>
          <div className="flex shrink-0 items-center gap-2">
            {baseUrl ? (
              <a
                href={`${baseUrl}/document-management/document/version/${version.id}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="employee-tree-open-link"
              >
                Open
                <ExternalLink className="ml-1 inline h-3 w-3" />
              </a>
            ) : null}
            {onDeleteVersion ? (
              <button
                type="button"
                onClick={() => onDeleteVersion(version.id, version.version_number)}
                className="employee-tree-action text-red-600"
                aria-label={`Delete version ${version.version_number}`}
                title="Delete this version"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      ))}
      {relatedDocuments.map((document) => (
        <div
          key={`copy-${document.id}`}
          className="employee-tree-row employee-tree-row-file employee-tree-row-version"
          style={{ paddingLeft: `${pad}px` }}
        >
          <span className="employee-tree-version-line" aria-hidden />
          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-600">Earlier copy</p>
            <p className="text-xs text-slate-400">
              Uploaded {document.write_date.slice(0, 10)} · {document.document_type}
            </p>
          </div>
          <span className="employee-tree-badge archived">Superseded</span>
          <div className="flex shrink-0 items-center gap-2">
            {onDocumentOpen ? (
              <button
                type="button"
                onClick={() => onDocumentOpen(document)}
                className="employee-tree-open-link"
              >
                Open
              </button>
            ) : (
              <Link
                href={documentViewHref(document, isDocumentManager)}
                className="employee-tree-open-link"
              >
                Open
              </Link>
            )}
            {onDeleteRelatedDocument ? (
              <button
                type="button"
                onClick={() => onDeleteRelatedDocument(document)}
                className="employee-tree-action text-red-600"
                aria-label={`Delete earlier copy of ${document.name}`}
                title="Delete this earlier copy"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
      ))}
      {!items.length && !relatedDocuments.length ? (
        <p className="employee-tree-empty" style={{ paddingLeft: `${pad}px` }}>
          No previous versions yet.
        </p>
      ) : null}
    </>
  );
}

export default function FolderDocumentTreeGroup({
  group,
  expanded,
  onToggleExpand,
  isDocumentManager,
  onDocumentOpen,
  onDeleteVersion,
  onDeleteRelatedDocument,
  depth = 3,
  prefix,
  suffix,
}: {
  group: EmployeeDocumentGroup;
  expanded: boolean;
  onToggleExpand: () => void;
  isDocumentManager: boolean;
  onDocumentOpen?: (document: DocDocument) => void;
  onDeleteVersion?: (versionId: number, versionNumber: number) => void;
  onDeleteRelatedDocument?: (document: DocDocument) => void;
  depth?: number;
  prefix?: ReactNode;
  suffix?: ReactNode;
}) {
  const document = group.primary;
  const archivedVersions = document.version_count ?? 0;
  const currentVersion =
    document.current_version_number ?? Math.max(archivedVersions + 1, 1);
  const hasHistory = group.historyCount > 0;
  const pad = depth * 20 + 16;

  return (
    <div className="employee-tree-document-group">
      <div
        className="employee-tree-row employee-tree-row-file"
        style={{ paddingLeft: `${pad - 20}px` }}
      >
        {prefix}
        <button
          type="button"
          className={`employee-tree-toggle ${hasHistory ? "has-history" : ""}`}
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-label={
            expanded
              ? `Collapse versions of ${document.name}`
              : `Expand versions of ${document.name}`
          }
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
        <FileText className="h-4 w-4 shrink-0 text-brand-pink" />
        {onDocumentOpen ? (
          <button
            type="button"
            onClick={() => onDocumentOpen(document)}
            className="min-w-0 flex-1 truncate text-left font-medium text-slate-700 hover:text-brand-pink"
          >
            {document.name}
          </button>
        ) : (
          <Link
            href={documentViewHref(document, isDocumentManager)}
            className="min-w-0 flex-1 truncate font-medium text-slate-700 hover:text-brand-pink"
          >
            {document.name}
          </Link>
        )}
        {hasHistory ? (
          <span className="employee-tree-badge current">
            Current · v{currentVersion}
          </span>
        ) : null}
        <small className="truncate text-slate-400">{document.document_type}</small>
        {suffix}
      </div>
      {expanded ? (
        <VersionHistoryRows
          documentId={document.id}
          relatedDocuments={group.relatedDocuments}
          isDocumentManager={isDocumentManager}
          onDocumentOpen={onDocumentOpen}
          onDeleteVersion={onDeleteVersion}
          onDeleteRelatedDocument={onDeleteRelatedDocument}
          depth={depth + 1}
        />
      ) : null}
    </div>
  );
}
