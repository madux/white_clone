"use client";

import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Search,
} from "lucide-react";
import { useMemo, useState } from "react";
import type {
  AcknowledgementDocumentNode,
  AcknowledgementFolderNode,
} from "../../../lib/types";
import AcknowledgementDocumentPanel from "./AcknowledgementDocumentPanel";

type PercentFilter = "below100" | "below90" | "below80" | "above80";

const PERCENT_FILTERS: { value: PercentFilter; label: string }[] = [
  { value: "below100", label: "Below 100%" },
  { value: "below90", label: "Below 90%" },
  { value: "below80", label: "Below 80%" },
  { value: "above80", label: "80% and above" },
];

function matchesPercentFilter(percent: number, filters: PercentFilter[]) {
  if (!filters.length) return true;
  return filters.some((filter) => {
    if (filter === "below100") return percent < 100;
    if (filter === "below90") return percent < 90;
    if (filter === "below80") return percent < 80;
    return percent >= 80;
  });
}

function percentBadgeClass(percent: number) {
  if (percent >= 80) return "ack-percent-badge healthy";
  if (percent >= 60) return "ack-percent-badge caution";
  return "ack-percent-badge risk";
}

export default function AcknowledgementPendingTree({
  folders,
}: {
  folders: AcknowledgementFolderNode[];
}) {
  const [search, setSearch] = useState("");
  const [percentFilters, setPercentFilters] = useState<PercentFilter[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>(
    {},
  );
  const [expandedDocumentId, setExpandedDocumentId] = useState<number | null>(
    null,
  );

  const filteredFolders = useMemo(() => {
    const query = search.trim().toLowerCase();
    return folders
      .map((folder) => {
        const documents = folder.documents.filter((document) => {
          const matchesSearch =
            !query ||
            folder.folder_name.toLowerCase().includes(query) ||
            document.document_name.toLowerCase().includes(query) ||
            document.document_type.toLowerCase().includes(query);
          const matchesPercent = matchesPercentFilter(
            document.acknowledgement_percent,
            percentFilters,
          );
          return matchesSearch && matchesPercent;
        });
        if (!documents.length) return null;
        const audienceCount = documents.reduce(
          (total, document) => total + document.audience_count,
          0,
        );
        const acknowledgedCount = documents.reduce(
          (total, document) => total + document.acknowledged_count,
          0,
        );
        const acknowledgementPercent = audienceCount
          ? Math.round((acknowledgedCount * 100) / audienceCount)
          : 0;
        if (
          percentFilters.length &&
          !matchesPercentFilter(acknowledgementPercent, percentFilters)
        ) {
          return null;
        }
        return {
          ...folder,
          documents,
          audience_count: audienceCount,
          acknowledged_count: acknowledgedCount,
          acknowledgement_percent: acknowledgementPercent,
        };
      })
      .filter(Boolean) as AcknowledgementFolderNode[];
  }, [folders, percentFilters, search]);

  const togglePercentFilter = (value: PercentFilter) => {
    setPercentFilters((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value],
    );
  };

  const toggleFolder = (folderId: number) => {
    setExpandedFolders((current) => ({
      ...current,
      [folderId]: !(current[folderId] ?? true),
    }));
  };

  const toggleDocument = (document: AcknowledgementDocumentNode) => {
    setExpandedDocumentId((current) =>
      current === document.document_id ? null : document.document_id,
    );
  };

  if (!folders.length) {
    return (
      <p className="py-16 text-center text-sm text-slate-400">
        Everyone in scope has acknowledged their organizational documents.
      </p>
    );
  }

  return (
    <div className="ack-tree-shell">
      <div className="ack-tree-toolbar">
        <label className="ack-tree-search">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search folders or documents..."
          />
        </label>
        <div className="employee-filter-section !border-0 !p-0">
          <h3 className="employee-filter-section-title">Acknowledgement %</h3>
          <div className="employee-filter-options !max-h-none md:grid-cols-2">
            {PERCENT_FILTERS.map((filter) => (
              <label key={filter.value} className="employee-filter-checkbox">
                <input
                  type="checkbox"
                  checked={percentFilters.includes(filter.value)}
                  onChange={() => togglePercentFilter(filter.value)}
                  className="h-4 w-4 rounded border-slate-300 accent-pink-600"
                />
                <span>{filter.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {!filteredFolders.length ? (
        <p className="py-12 text-center text-sm text-slate-400">
          No folders or documents match the current filters.
        </p>
      ) : (
        <div className="ack-tree-list">
          {filteredFolders.map((folder) => {
            const folderExpanded = expandedFolders[folder.folder_id] ?? true;
            return (
              <div key={folder.folder_id} className="ack-tree-folder">
                <button
                  type="button"
                  className="ack-tree-row ack-tree-row-folder"
                  onClick={() => toggleFolder(folder.folder_id)}
                >
                  {folderExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                  )}
                  <FolderOpen className="h-4 w-4 shrink-0 text-brand-pink" />
                  <span className="min-w-0 flex-1 text-left font-semibold text-slate-800">
                    {folder.folder_name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {folder.documents.length} documents
                  </span>
                  <span
                    className={percentBadgeClass(folder.acknowledgement_percent)}
                  >
                    {folder.acknowledgement_percent}%
                  </span>
                </button>

                {folderExpanded ? (
                  <div className="ack-tree-documents">
                    {folder.documents.map((document) => {
                      const expanded =
                        expandedDocumentId === document.document_id;
                      return (
                        <div key={document.document_id} className="ack-tree-document-block">
                          <button
                            type="button"
                            className={`ack-tree-row ack-tree-row-document ${
                              expanded ? "active" : ""
                            }`}
                            onClick={() => toggleDocument(document)}
                          >
                            <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                            <span className="min-w-0 flex-1 text-left">
                              <span className="block truncate font-medium text-slate-800">
                                {document.document_name}
                              </span>
                              <span className="block truncate text-xs text-slate-500">
                                {document.document_type}
                                {document.pending_count
                                  ? ` · ${document.pending_count} pending`
                                  : ""}
                              </span>
                            </span>
                            <span
                              className={percentBadgeClass(
                                document.acknowledgement_percent,
                              )}
                            >
                              {document.acknowledgement_percent}%
                            </span>
                          </button>
                          {expanded ? (
                            <AcknowledgementDocumentPanel document={document} />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
