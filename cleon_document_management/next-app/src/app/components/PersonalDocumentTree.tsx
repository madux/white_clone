"use client";

import { FileText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useDeleteDocumentVersion,
  useDocumentAction,
} from "../../../hooks/useDocuments";
import { approvalDisplayLabel } from "../../../lib/approvalHelpers";
import { canUpdateDocument } from "../../../lib/documentUpdateHelpers";
import { formatStatusLabel } from "../../../lib/formatLabel";
import { groupEmployeeDocuments } from "../../../lib/groupEmployeeDocuments";
import type { DocDocument } from "../../../lib/types";
import BulkDocumentActions from "./BulkDocumentActions";
import DocumentActions from "./DocumentActions";
import FolderDocumentTreeGroup from "./FolderDocumentTreeGroup";
import {
  employeeTreeCol,
  employeeTreeColsPersonal,
} from "../../../lib/employeeTreeColumns";

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
  onUpdate,
  deleteRelatedIds = [],
  depth = 2,
}: {
  document: DocDocument;
  selected: boolean;
  pendingStatus?: string;
  onToggleSelect: () => void;
  onView: () => void;
  onRequestApproval?: () => void;
  onUpdate?: () => void;
  deleteRelatedIds?: number[];
  depth?: number;
}) {
  const requiresApproval = document.approval_state === "pending";
  const statusKey = requiresApproval ? "pending" : document.state;
  const showUpdate = onUpdate && canUpdateDocument(document);

  return (
    <div
      className={`employee-tree-row employee-tree-row-file ${employeeTreeColsPersonal}`}
    >
      <div
        className="employee-tree-leading"
        style={{ paddingLeft: `${depth * 20 + 16}px` }}
      >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggleSelect}
        aria-label={`Select ${document.name}`}
        className={`h-4 w-4 accent-pink-600 ${employeeTreeCol.check}`}
      />
      <span className={employeeTreeCol.toggle} aria-hidden />
      <FileText className={`h-4 w-4 shrink-0 text-brand-pink ${employeeTreeCol.icon}`} />
      <button
        type="button"
        onClick={onView}
        className={`min-w-0 truncate text-left font-medium text-slate-700 hover:text-brand-pink ${employeeTreeCol.name}`}
      >
        {document.name}
      </button>
      </div>
      <span className={employeeTreeCol.category}>
        {document.document_category_label ?? document.document_type ?? "—"}
      </span>
      <div className={employeeTreeCol.status}>
      <span className={`employee-tree-badge ${states[statusKey] || ""}`}>
        {requiresApproval
          ? approvalDisplayLabel(document)
          : formatStatusLabel(document.state)}
      </span>
      {pendingStatus ? (
        <span className="employee-tree-badge pending">{pendingStatus}</span>
      ) : null}
      {document.rejection_reason &&
      (document.approval_state === "rejected" ||
        document.last_review_decision === "rejected") ? (
        <span
          className="employee-tree-badge suspended max-w-[12rem] truncate"
          title={document.rejection_reason}
        >
          {document.approval_state === "rejected"
            ? "Rejected"
            : "Update rejected"}
        </span>
      ) : null}
      </div>
      <span className={employeeTreeCol.uploadDate}>
        {document.write_date?.slice(0, 10) || "—"}
      </span>
      <div className={employeeTreeCol.actions}>
        <button
          type="button"
          onClick={onView}
          className="employee-tree-open-link"
        >
          View
        </button>
        {showUpdate ? (
          <button
            type="button"
            onClick={onUpdate}
            className="employee-tree-open-link"
            title="Upload a new version of this file"
          >
            Update
          </button>
        ) : null}
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
  onViewVersion,
  onRequestApproval,
  onUpdate,
}: {
  documents: DocDocument[];
  search: string;
  pendingStatusById?: Record<number, string>;
  guideTarget?: string;
  onView: (document: DocDocument) => void;
  onViewVersion?: (document: DocDocument, versionId: number) => void;
  onRequestApproval?: (document: DocDocument) => void;
  onUpdate?: (document: DocDocument) => void;
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
        `Delete version ${versionNumber}? This only removes that out-of-date version.`,
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
          <div className="employee-tree-file-group !ml-4 !border-l-pink-100">
            <div
              className={`employee-tree-row employee-tree-row-folder ${employeeTreeColsPersonal}`}
            >
              <div className="employee-tree-leading">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? [] : visibleIds)}
                  aria-label="Select all my files"
                  className={`h-4 w-4 accent-pink-600 ${employeeTreeCol.check}`}
                />
                <span className={employeeTreeCol.toggle} aria-hidden />
                <span className={employeeTreeCol.icon} aria-hidden />
                <div className={`font-bold text-slate-800 ${employeeTreeCol.name}`}>
                  My files
                </div>
              </div>
              <span
                className={`${employeeTreeCol.category} employee-tree-col-header employee-tree-col-category`}
              >
                Category
              </span>
              <span
                className={`${employeeTreeCol.status} employee-tree-col-header employee-tree-col-status ${guideTarget === "approval" ? "guide-status-emphasis" : ""}`}
              >
                Status
              </span>
              <span
                className={`${employeeTreeCol.uploadDate} employee-tree-col-header employee-tree-col-upload-date`}
              >
                Updated
              </span>
              <span className={employeeTreeCol.actions} aria-hidden />
            </div>
            {groups.map((group) => {
              const document = group.primary;
              const pendingStatus = pendingStatusById[document.id];
              const requiresApproval = document.approval_state === "pending";
              const statusKey = requiresApproval ? "pending" : document.state;
              const suffix = (
                <>
                  <span className={employeeTreeCol.category}>
                    {document.document_category_label ??
                      document.document_type ??
                      "—"}
                  </span>
                  <div className={employeeTreeCol.status}>
                  <span
                    className={`employee-tree-badge ${states[statusKey] || ""} ${guideTarget === "approval" ? "guide-status-badge" : ""}`}
                  >
                    {requiresApproval
                      ? approvalDisplayLabel(document)
                      : formatStatusLabel(document.state)}
                  </span>
                  {pendingStatus ? (
                    <span className="employee-tree-badge pending">{pendingStatus}</span>
                  ) : null}
                  {document.rejection_reason &&
                  (document.approval_state === "rejected" ||
                    document.last_review_decision === "rejected") ? (
                    <span
                      className="employee-tree-badge suspended max-w-[12rem] truncate"
                      title={document.rejection_reason}
                    >
                      {document.approval_state === "rejected"
                        ? "Rejected"
                        : "Update rejected"}
                    </span>
                  ) : null}
                  </div>
                  <span className={employeeTreeCol.uploadDate}>
                    {document.write_date?.slice(0, 10) || "—"}
                  </span>
                  <div className={employeeTreeCol.actions}>
                    <button
                      type="button"
                      onClick={() => onView(document)}
                      className="employee-tree-open-link"
                    >
                      View
                    </button>
                    {onUpdate && canUpdateDocument(document) ? (
                      <button
                        type="button"
                        onClick={() => onUpdate(document)}
                        className="employee-tree-open-link"
                        title="Upload a new version of this file"
                      >
                        Update
                      </button>
                    ) : null}
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
                    onViewVersion={onViewVersion}
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
                        className={`h-4 w-4 shrink-0 accent-pink-600 ${employeeTreeCol.check}`}
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
                  onUpdate={onUpdate ? () => onUpdate(document) : undefined}
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
