"use client";

import { FileText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useDeleteDocumentVersion,
  useDocumentAction,
} from "../../../hooks/useDocuments";
import { formatStatusLabel } from "../../../lib/formatLabel";
import { groupEmployeeDocuments } from "../../../lib/groupEmployeeDocuments";
import type { DocDocument } from "../../../lib/types";
import BulkDocumentActions from "./BulkDocumentActions";
import DocumentActions from "./DocumentActions";
import FolderDocumentTreeGroup from "./FolderDocumentTreeGroup";

const states: Record<string, string> = {
  approved: "active",
  pending: "pending",
  processing: "pending",
  rejected: "suspended",
  draft: "",
  expired: "suspended",
  missing: "pending",
};

function PersonalDocumentRow({
  document,
  selected,
  pendingStatus,
  onToggleSelect,
  onView,
  onRequestApproval,
  deleteRelatedIds = [],
  depth = 2,
}: {
  document: DocDocument;
  selected: boolean;
  pendingStatus?: string;
  onToggleSelect: () => void;
  onView: () => void;
  onRequestApproval?: () => void;
  deleteRelatedIds?: number[];
  depth?: number;
}) {
  const requiresApproval = document.approval_state === "pending";
  const statusKey = requiresApproval ? "pending" : document.state;

  return (
    <div
      className="employee-tree-row employee-tree-row-file"
      style={{ paddingLeft: `${depth * 20 + 16}px` }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        aria-label={`Select ${document.name}`}
        className="h-4 w-4 shrink-0 accent-pink-600"
      />
      <span className="employee-tree-spacer" aria-hidden />
      <FileText className="h-4 w-4 shrink-0 text-brand-pink" />
      <button
        type="button"
        onClick={onView}
        className="min-w-0 flex-1 truncate text-left font-medium text-slate-700 hover:text-brand-pink"
      >
        {document.name}
      </button>
      <small className="hidden shrink-0 text-slate-400 sm:inline">
        {document.document_type}
      </small>
      <span className={`employee-tree-badge ${states[statusKey] || ""}`}>
        {requiresApproval
          ? "Requires Approval"
          : formatStatusLabel(document.state)}
      </span>
      {pendingStatus ? (
        <span className="employee-tree-badge pending">{pendingStatus}</span>
      ) : null}
      <small className="hidden shrink-0 text-slate-400 md:inline">
        {document.write_date?.slice(0, 10) || "—"}
      </small>
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onView}
          className="employee-tree-open-link"
        >
          View
        </button>
        {(document.state === "draft" || document.state === "rejected") &&
        document.approval_state !== "pending" &&
        !pendingStatus &&
        onRequestApproval ? (
          <button
            type="button"
            onClick={onRequestApproval}
            className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-3 py-1.5 text-[11px] font-bold text-white"
          >
            Request approval
          </button>
        ) : null}
        <DocumentActions
          documentId={document.id}
          documentName={document.name}
          deleteRelatedIds={deleteRelatedIds}
        />
      </div>
    </div>
  );
}

export default function PersonalDocumentTree({
  documents,
  search,
  pendingStatusById = {},
  guideTarget,
  onView,
  onRequestApproval,
}: {
  documents: DocDocument[];
  search: string;
  pendingStatusById?: Record<number, string>;
  guideTarget?: string;
  onView: (document: DocDocument) => void;
  onRequestApproval?: (document: DocDocument) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [expandedDocuments, setExpandedDocuments] = useState<Record<number, boolean>>(
    {},
  );
  const autoExpandedRef = useRef(false);
  const documentAction = useDocumentAction();
  const deleteVersion = useDeleteDocumentVersion();

  const handleDeleteVersion = async (versionId: number, versionNumber: number) => {
    if (
      !window.confirm(
        `Delete version ${versionNumber}? This only removes that archived version.`,
      )
    ) {
      return;
    }
    await deleteVersion.mutateAsync(versionId);
  };

  const handleDeleteRelatedDocument = async (document: DocDocument) => {
    if (
      !window.confirm(
        `Delete this earlier copy of "${document.name}"?`,
      )
    ) {
      return;
    }
    await documentAction.mutateAsync({ id: document.id, action: "delete" });
  };

  const rows = useMemo(
    () =>
      documents.filter((document) =>
        `${document.name} ${document.document_type} ${document.folder_name}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [documents, search],
  );

  const groups = useMemo(() => groupEmployeeDocuments(rows), [rows]);
  const visibleIds = groups.map((group) => group.primary.id);
  const allSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));

  useEffect(() => {
    if (autoExpandedRef.current || !groups.length) return;
    const next: Record<number, boolean> = {};
    groups.forEach((group) => {
      if (group.historyCount > 0) {
        next[group.primary.id] = true;
      }
    });
    if (Object.keys(next).length) {
      setExpandedDocuments(next);
      autoExpandedRef.current = true;
    }
  }, [groups]);

  const toggleExpanded = (documentId: number) => {
    setExpandedDocuments((current) => ({
      ...current,
      [documentId]: !current[documentId],
    }));
  };

  if (!groups.length) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <p className="p-12 text-center text-sm text-slate-500">No documents found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <BulkDocumentActions
        selected={selected}
        onClear={() => setSelected([])}
        documents={rows}
        groups={groups}
      />
      <div className="employee-file-tree p-4">
        <div className="employee-tree-folder">
          <div className="employee-tree-row employee-tree-row-folder">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? [] : visibleIds)}
              aria-label="Select all my files"
              className="h-4 w-4 shrink-0 accent-pink-600"
            />
            <div className="min-w-0 flex-1 font-bold text-slate-800">My files</div>
            <small className="hidden text-slate-400 sm:inline">Category</small>
            <small
              className={`hidden text-slate-400 sm:inline ${guideTarget === "approval" ? "guide-status-emphasis" : ""}`}
            >
              Status
            </small>
            <small className="hidden text-slate-400 md:inline">Updated</small>
            <span className="hidden w-[120px] sm:inline" aria-hidden />
          </div>
          <div className="employee-tree-file-group !ml-4 !border-l-pink-100">
            {groups.map((group) => {
              const document = group.primary;
              const pendingStatus = pendingStatusById[document.id];
              const requiresApproval = document.approval_state === "pending";
              const statusKey = requiresApproval ? "pending" : document.state;
              const suffix = (
                <>
                  <small className="hidden shrink-0 text-slate-400 sm:inline">
                    {document.document_type}
                  </small>
                  <span
                    className={`employee-tree-badge ${states[statusKey] || ""} ${guideTarget === "approval" ? "guide-status-badge" : ""}`}
                  >
                    {requiresApproval
                      ? "Requires Approval"
                      : formatStatusLabel(document.state)}
                  </span>
                  {pendingStatus ? (
                    <span className="employee-tree-badge pending">{pendingStatus}</span>
                  ) : null}
                  <small className="hidden shrink-0 text-slate-400 md:inline">
                    {document.write_date?.slice(0, 10) || "—"}
                  </small>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onView(document)}
                      className="employee-tree-open-link"
                    >
                      View
                    </button>
                    {(document.state === "draft" || document.state === "rejected") &&
                    document.approval_state !== "pending" &&
                    !pendingStatus &&
                    onRequestApproval ? (
                      <button
                        type="button"
                        onClick={() => onRequestApproval(document)}
                        className="rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-3 py-1.5 text-[11px] font-bold text-white"
                      >
                        Request approval
                      </button>
                    ) : null}
                    <DocumentActions
                      documentId={document.id}
                      documentName={document.name}
                      deleteRelatedIds={group.relatedDocuments.map((item) => item.id)}
                    />
                  </div>
                </>
              );

              if (group.historyCount > 0) {
                return (
                  <FolderDocumentTreeGroup
                    key={document.id}
                    group={group}
                    expanded={expandedDocuments[document.id] ?? false}
                    onToggleExpand={() => toggleExpanded(document.id)}
                    isDocumentManager={false}
                    onDocumentOpen={onView}
                    onDeleteVersion={handleDeleteVersion}
                    onDeleteRelatedDocument={handleDeleteRelatedDocument}
                    depth={2}
                    prefix={
                      <input
                        type="checkbox"
                        checked={selected.includes(document.id)}
                        onChange={() =>
                          setSelected((current) =>
                            current.includes(document.id)
                              ? current.filter((id) => id !== document.id)
                              : [...current, document.id],
                          )
                        }
                        aria-label={`Select ${document.name}`}
                        className="h-4 w-4 shrink-0 accent-pink-600"
                      />
                    }
                    suffix={suffix}
                  />
                );
              }

              return (
                <PersonalDocumentRow
                  key={document.id}
                  document={document}
                  selected={selected.includes(document.id)}
                  pendingStatus={pendingStatus}
                  onToggleSelect={() =>
                    setSelected((current) =>
                      current.includes(document.id)
                        ? current.filter((id) => id !== document.id)
                        : [...current, document.id],
                    )
                  }
                  onView={() => onView(document)}
                  onRequestApproval={
                    onRequestApproval
                      ? () => onRequestApproval(document)
                      : undefined
                  }
                  deleteRelatedIds={group.relatedDocuments.map((item) => item.id)}
                  depth={2}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
