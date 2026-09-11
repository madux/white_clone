"use client";

import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type {
  AcknowledgementDocumentNode,
  AcknowledgementFolderNode,
  DocDocument,
  DocFolder,
} from "../../../lib/types";
import AcknowledgementDocumentPanel from "./AcknowledgementDocumentPanel";
import FolderActions from "./FolderActions";

export type AckPercentFilter = "below100" | "below90" | "below80" | "above80";

type FolderRow = {
  folder: DocFolder;
  documents: DocDocument[];
};

function matchesPercentFilter(percent: number, filters: AckPercentFilter[]) {
  if (!filters.length) return true;
  return filters.some((filter) => {
    if (filter === "below100") return percent < 100;
    if (filter === "below90") return percent < 90;
    if (filter === "below80") return percent < 80;
    return percent >= 80;
  });
}

function percentBadgeClass(percent: number | null) {
  if (percent === null) return "ack-percent-badge muted";
  if (percent >= 80) return "ack-percent-badge healthy";
  if (percent >= 60) return "ack-percent-badge caution";
  return "ack-percent-badge risk";
}

function toAckDocumentNode(
  document: DocDocument,
  folder: DocFolder,
  ack?: AcknowledgementDocumentNode,
): AcknowledgementDocumentNode {
  if (ack) return ack;
  return {
    document_id: document.id,
    document_name: document.name,
    document_type: document.document_type,
    folder_id: folder.id,
    folder_name: folder.folder_name,
    audience_count: 0,
    acknowledged_count: 0,
    acknowledgement_percent: 0,
    pending_count: 0,
  };
}

export default function OrganizationalLibraryTree({
  rows,
  ackFolders,
  selectedFolderIds,
  onToggleFolderSelected,
  isDocumentManager,
  guideTarget,
  search,
  percentFilters,
}: {
  rows: FolderRow[];
  ackFolders: AcknowledgementFolderNode[];
  selectedFolderIds: number[];
  onToggleFolderSelected: (id: number) => void;
  isDocumentManager: boolean;
  guideTarget?: string | null;
  search: string;
  percentFilters: AckPercentFilter[];
}) {
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>(
    {},
  );
  const [expandedDocumentId, setExpandedDocumentId] = useState<number | null>(
    null,
  );

  const ackByFolderId = useMemo(
    () => new Map(ackFolders.map((folder) => [folder.folder_id, folder])),
    [ackFolders],
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .map(({ folder, documents }) => {
        const ackFolder = ackByFolderId.get(folder.id);
        const ackDocMap = new Map(
          (ackFolder?.documents ?? []).map((document) => [
            document.document_id,
            document,
          ]),
        );

        const visibleDocuments = documents.filter((document) => {
          const ackDoc = ackDocMap.get(document.id);
          const matchesSearch =
            !query ||
            folder.folder_name.toLowerCase().includes(query) ||
            document.name.toLowerCase().includes(query) ||
            document.document_type.toLowerCase().includes(query);
          const matchesPercent = matchesPercentFilter(
            ackDoc?.acknowledgement_percent ?? 100,
            percentFilters,
          );
          return matchesSearch && matchesPercent;
        });

        if (!visibleDocuments.length && query) {
          const folderMatches = folder.folder_name.toLowerCase().includes(query);
          if (!folderMatches) return null;
        } else if (!visibleDocuments.length && percentFilters.length) {
          return null;
        }

        const folderPercent = ackFolder?.acknowledgement_percent ?? null;
        if (
          percentFilters.length &&
          folderPercent !== null &&
          !matchesPercentFilter(folderPercent, percentFilters) &&
          !visibleDocuments.length
        ) {
          return null;
        }

        return {
          folder,
          documents: visibleDocuments.length ? visibleDocuments : documents,
          folderPercent,
          ackDocMap,
        };
      })
      .filter(Boolean) as {
      folder: DocFolder;
      documents: DocDocument[];
      folderPercent: number | null;
      ackDocMap: Map<number, AcknowledgementDocumentNode>;
    }[];
  }, [ackByFolderId, percentFilters, rows, search]);

  const toggleFolder = (folderId: number) => {
    setExpandedFolders((current) => ({
      ...current,
      [folderId]: !(current[folderId] ?? false),
    }));
  };

  const toggleDocument = (documentId: number) => {
    setExpandedDocumentId((current) =>
      current === documentId ? null : documentId,
    );
  };

  if (!rows.length) {
    return (
      <p className="py-16 text-center text-sm text-slate-400">
        No organizational folders found.
      </p>
    );
  }

  if (!filteredRows.length) {
    return (
      <p className="py-12 text-center text-sm text-slate-400">
        No folders or documents match the current filters.
      </p>
    );
  }

  return (
    <div className="ack-tree-list p-4">
      {filteredRows.map(
        ({ folder, documents, folderPercent, ackDocMap }) => {
          const folderExpanded = expandedFolders[folder.id] ?? false;
          return (
            <div key={folder.id} className="ack-tree-folder">
              <div className="ack-tree-row ack-tree-row-folder">
                {isDocumentManager ? (
                  <input
                    type="checkbox"
                    checked={selectedFolderIds.includes(folder.id)}
                    onChange={() => onToggleFolderSelected(folder.id)}
                    aria-label={`Select ${folder.folder_name}`}
                    className="h-4 w-4 shrink-0 accent-pink-600"
                    onClick={(event) => event.stopPropagation()}
                  />
                ) : null}
                <button
                  type="button"
                  className="employee-tree-toggle"
                  onClick={() => toggleFolder(folder.id)}
                  aria-expanded={folderExpanded}
                  aria-label={`${folderExpanded ? "Collapse" : "Expand"} ${folder.folder_name}`}
                >
                  {folderExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <FolderOpen className="h-4 w-4 shrink-0 text-brand-pink" />
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => toggleFolder(folder.id)}
                >
                  <span className="block truncate font-semibold text-slate-800">
                    {folder.folder_name}
                  </span>
                  <span className="block truncate text-xs text-slate-500">
                    {documents.length} documents
                  </span>
                </button>
                <span className={percentBadgeClass(folderPercent)}>
                  {folderPercent === null ? "—" : `${folderPercent}%`}
                </span>
                <FolderActions
                  folderId={folder.id}
                  folderName={folder.folder_name}
                  description={folder.description}
                  locked={folder.locked}
                  folderType={folder.folder_type}
                  accessScope={folder.access_scope}
                  departmentIds={folder.department_ids}
                  gradeIds={folder.grade_ids}
                  employeeIds={folder.employee_ids}
                />
                <Link
                  href={`/pages/organization/folder?folder=${folder.id}${guideTarget === "organizational-upload" ? "&guide=organizational-upload" : ""}`}
                  className="employee-tree-open-link"
                  aria-label={`Open ${folder.folder_name}`}
                >
                  Open
                </Link>
              </div>

              {folderExpanded ? (
                <div className="ack-tree-documents">
                  {documents.length ? (
                    documents.map((document) => {
                      const ackDoc = ackDocMap.get(document.id);
                      const ackNode = toAckDocumentNode(
                        document,
                        folder,
                        ackDoc,
                      );
                      const expanded = expandedDocumentId === document.id;
                      return (
                        <div key={document.id} className="ack-tree-document-block">
                          <button
                            type="button"
                            className={`ack-tree-row ack-tree-row-document ${
                              expanded ? "active" : ""
                            }`}
                            onClick={() => toggleDocument(document.id)}
                          >
                            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="min-w-0 flex-1 text-left">
                              <span className="block truncate font-medium text-slate-800">
                                {document.name}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {document.document_type}
                                {ackDoc?.pending_count
                                  ? ` · ${ackDoc.pending_count} pending`
                                  : ""}
                              </span>
                            </span>
                            <span
                              className={percentBadgeClass(
                                ackDoc ? ackDoc.acknowledgement_percent : null,
                              )}
                            >
                              {ackDoc
                                ? `${ackDoc.acknowledgement_percent}%`
                                : "—"}
                            </span>
                          </button>
                          {expanded ? (
                            <AcknowledgementDocumentPanel document={ackNode} />
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="ack-document-panel-empty px-4 py-6">
                      No documents in this folder yet.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          );
        },
      )}
    </div>
  );
}
