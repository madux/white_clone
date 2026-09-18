"use client";

import type { ReactNode } from "react";
import { ChevronDown, ChevronRight, FileText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useDocumentVersions } from "../../../hooks/useDocuments";
import { documentViewHref } from "../../../lib/documentLinks";
import type { EmployeeDocumentGroup } from "../../../lib/groupEmployeeDocuments";
import { formatDocumentDateShort } from "../../../lib/formatDocumentDate";
import type { DocDocument } from "../../../lib/types";
import AnimatedTreeCollapse from "./AnimatedTreeCollapse";
import {
  employeeTreeCol,
  employeeTreeColsAdmin,
} from "../../../lib/employeeTreeColumns";
import { documentVersionPreviewUrl } from "../../../lib/documentPreviewUrls";

function VersionHistoryRows({
  document,
  relatedDocuments,
  isDocumentManager,
  onDocumentOpen,
  onDeleteVersion,
  onDeleteRelatedDocument,
  onViewVersion,
  depth,
}: {
  document: DocDocument;
  relatedDocuments: DocDocument[];
  isDocumentManager: boolean;
  onDocumentOpen?: (document: DocDocument) => void;
  onViewVersion?: (document: DocDocument, versionId: number) => void;
  onDeleteVersion?: (versionId: number, versionNumber: number) => void;
  onDeleteRelatedDocument?: (document: DocDocument) => void;
  depth: number;
}) {
  const versions = useDocumentVersions(document.id);
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
          className={`employee-tree-row employee-tree-row-file employee-tree-row-version ${employeeTreeColsAdmin}`}
        >
          <div className="employee-tree-leading" style={{ paddingLeft: `${pad}px` }}>
          <span className={employeeTreeCol.check} aria-hidden />
          <span className={employeeTreeCol.toggle} aria-hidden />
          <FileText className={`h-4 w-4 shrink-0 text-slate-400 ${employeeTreeCol.icon}`} />
          <div className={`${employeeTreeCol.name} min-w-0`}>
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
          </div>
          <span className={employeeTreeCol.category} aria-hidden />
          <span className={employeeTreeCol.docType} aria-hidden />
          <span className={employeeTreeCol.uploadDate} aria-hidden />
          <span className={employeeTreeCol.version} aria-hidden />
          <div className={employeeTreeCol.status}>
            <span className="employee-tree-badge outdated">Out of date</span>
          </div>
          <div className={`${employeeTreeCol.actions} gap-2`}>
            {onViewVersion ? (
              <button
                type="button"
                onClick={() => onViewVersion(document, version.id)}
                className="employee-tree-open-link"
              >
                Read
              </button>
            ) : null}
            <a
              href={documentVersionPreviewUrl(version.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="employee-tree-open-link"
            >
              Open tab
            </a>
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
          className={`employee-tree-row employee-tree-row-file employee-tree-row-version ${employeeTreeColsAdmin}`}
        >
          <div className="employee-tree-leading" style={{ paddingLeft: `${pad}px` }}>
          <span className={employeeTreeCol.check} aria-hidden />
          <span className={employeeTreeCol.toggle} aria-hidden />
          <FileText className={`h-4 w-4 shrink-0 text-slate-400 ${employeeTreeCol.icon}`} />
          <div className={`${employeeTreeCol.name} min-w-0`}>
            <p className="text-sm font-medium text-slate-600">Earlier copy</p>
            <p className="text-xs text-slate-400">
              Uploaded {formatDocumentDateShort(document.write_date)} ·{" "}
              {document.document_type}
            </p>
          </div>
          </div>
          <span className={employeeTreeCol.category} aria-hidden />
          <span className={employeeTreeCol.docType} aria-hidden />
          <span className={employeeTreeCol.uploadDate} aria-hidden />
          <span className={employeeTreeCol.version} aria-hidden />
          <div className={employeeTreeCol.status}>
            <span className="employee-tree-badge outdated">Out of date</span>
          </div>
          <div className={`${employeeTreeCol.actions} gap-2`}>
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
  onViewVersion,
  depth = 3,
  prefix,
  suffix,
}: {
  group: EmployeeDocumentGroup;
  expanded: boolean;
  onToggleExpand: () => void;
  isDocumentManager: boolean;
  onDocumentOpen?: (document: DocDocument) => void;
  onViewVersion?: (document: DocDocument, versionId: number) => void;
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
        className={`employee-tree-row employee-tree-row-file ${employeeTreeColsAdmin}`}
      >
        <div className="employee-tree-leading" style={{ paddingLeft: `${pad}px` }}>
        {prefix}
        {hasHistory ? (
          <button
            type="button"
            className={`employee-tree-toggle has-history ${employeeTreeCol.toggle}`}
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
        ) : (
          <span className={employeeTreeCol.toggle} aria-hidden />
        )}
        <FileText
          className={`h-4 w-4 shrink-0 text-brand-pink ${employeeTreeCol.icon}`}
        />
        <div className={`${employeeTreeCol.name} flex min-w-0 flex-wrap items-center gap-2`}>
          {onDocumentOpen ? (
            <button
              type="button"
              onClick={() => onDocumentOpen(document)}
              className="min-w-0 truncate text-left font-medium text-slate-700 hover:text-brand-pink"
            >
              {document.name}
            </button>
          ) : (
            <Link
              href={documentViewHref(document, isDocumentManager)}
              className="min-w-0 truncate font-medium text-slate-700 hover:text-brand-pink"
            >
              {document.name}
            </Link>
          )}
          {hasHistory ? (
            <span className="employee-tree-badge current shrink-0">
              Current · v{currentVersion}
            </span>
          ) : null}
        </div>
        </div>
        {suffix}
      </div>
      {hasHistory ? (
        <AnimatedTreeCollapse
          open={expanded}
          className="employee-tree-version-group"
        >
          <VersionHistoryRows
            document={document}
            relatedDocuments={group.relatedDocuments}
            isDocumentManager={isDocumentManager}
            onDocumentOpen={onDocumentOpen}
            onViewVersion={onViewVersion}
            onDeleteVersion={onDeleteVersion}
            onDeleteRelatedDocument={onDeleteRelatedDocument}
            depth={depth + 1}
          />
        </AnimatedTreeCollapse>
      ) : null}
    </div>
  );
}
