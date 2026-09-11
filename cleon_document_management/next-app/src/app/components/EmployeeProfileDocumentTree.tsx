"use client";

import { Check, FileText, X } from "lucide-react";
import {
  useDeleteDocumentVersion,
  useDocumentAction,
} from "../../../hooks/useDocuments";
import type { EmployeeDocumentGroup } from "../../../lib/groupEmployeeDocuments";
import { approvalDisplayLabel, canReviewDocument } from "../../../lib/approvalHelpers";
import type { DocDocument } from "../../../lib/types";
import DocumentActions from "./DocumentActions";
import FolderDocumentTreeGroup from "./FolderDocumentTreeGroup";

function DocumentStatusBadge({ document }: { document: DocDocument }) {
  return (
    <span
      className={`employee-tree-badge ${
        document.approval_state === "approved"
          ? "active"
          : document.waiting_for_prior
            ? ""
            : document.can_review
              ? "probation"
              : "pending"
      }`}
    >
      {approvalDisplayLabel(document)}
    </span>
  );
}

function DocumentRowActions({
  document,
  showReviewActions,
  reviewPending,
  onApprove,
  onReject,
  deleteRelatedIds = [],
}: {
  document: DocDocument;
  showReviewActions: boolean;
  reviewPending: boolean;
  onApprove: () => void;
  onReject: () => void;
  deleteRelatedIds?: number[];
}) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {showReviewActions && canReviewDocument(document) ? (
        <>
          <button
            type="button"
            onClick={onApprove}
            disabled={reviewPending}
            title="Approve document"
            aria-label={`Approve ${document.name}`}
            className="employee-tree-action text-emerald-700"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={reviewPending}
            title="Reject document"
            aria-label={`Reject ${document.name}`}
            className="employee-tree-action text-red-600"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : null}
      <DocumentActions
        documentId={document.id}
        documentName={document.name}
        deleteRelatedIds={deleteRelatedIds}
      />
    </div>
  );
}

function ProfileDocumentRow({
  document,
  selected,
  onToggleSelect,
  onView,
  onApprove,
  onReject,
  reviewPending,
  showReviewActions,
  deleteRelatedIds = [],
  depth = 2,
}: {
  document: DocDocument;
  selected: boolean;
  onToggleSelect: () => void;
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
  reviewPending: boolean;
  showReviewActions: boolean;
  deleteRelatedIds?: number[];
  depth?: number;
}) {
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
      <DocumentStatusBadge document={document} />
      <small className="hidden shrink-0 text-slate-400 sm:inline">
        {document.expiry_date ?? "No expiry"}
      </small>
      <small className="hidden shrink-0 text-slate-400 md:inline">
        {document.write_date.slice(0, 10)}
      </small>
      <DocumentRowActions
        document={document}
        showReviewActions={showReviewActions}
        reviewPending={reviewPending}
        onApprove={onApprove}
        onReject={onReject}
        deleteRelatedIds={deleteRelatedIds}
      />
    </div>
  );
}

export default function EmployeeProfileDocumentTree({
  groups,
  selected,
  expandedDocuments,
  allSelected,
  onToggleAll,
  onToggleSelect,
  onToggleExpand,
  onView,
  onOpenDocument,
  onApprove,
  onReject,
  reviewPending,
  showReviewActions,
  isDocumentManager,
}: {
  groups: EmployeeDocumentGroup[];
  selected: number[];
  expandedDocuments: number[];
  allSelected: boolean;
  onToggleAll: () => void;
  onToggleSelect: (id: number) => void;
  onToggleExpand: (id: number) => void;
  onView: (document: DocDocument) => void;
  onOpenDocument: (document: DocDocument) => void;
  onApprove: (document: DocDocument) => void;
  onReject: (document: DocDocument) => void;
  reviewPending: boolean;
  showReviewActions: boolean;
  isDocumentManager: boolean;
}) {
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
    if (!window.confirm(`Delete this earlier copy of "${document.name}"?`)) {
      return;
    }
    await documentAction.mutateAsync({ id: document.id, action: "delete" });
  };

  return (
    <div className="employee-file-tree border-t border-slate-100 p-4">
      <div className="employee-tree-folder">
        <div className="employee-tree-row employee-tree-row-folder">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleAll}
            aria-label="Select all documents"
            className="h-4 w-4 shrink-0 accent-pink-600"
          />
          <div className="min-w-0 flex-1 font-bold text-slate-800">Employee files</div>
          <small className="hidden text-slate-400 sm:inline">Status</small>
          <small className="hidden text-slate-400 sm:inline">Expiry</small>
          <small className="hidden text-slate-400 md:inline">Modified</small>
          <span className="hidden w-[88px] sm:inline" aria-hidden />
        </div>
        <div className="employee-tree-file-group !ml-4 !border-l-pink-100">
          {groups.map((group) => {
            const document = group.primary;
            const expanded = expandedDocuments.includes(document.id);
            const rowSuffix = (
              <>
                <DocumentStatusBadge document={document} />
                <small className="hidden shrink-0 text-slate-400 sm:inline">
                  {document.expiry_date ?? "No expiry"}
                </small>
                <small className="hidden shrink-0 text-slate-400 md:inline">
                  {document.write_date.slice(0, 10)}
                </small>
                <DocumentRowActions
                  document={document}
                  showReviewActions={showReviewActions}
                  reviewPending={reviewPending}
                  onApprove={() => onApprove(document)}
                  onReject={() => onReject(document)}
                  deleteRelatedIds={group.relatedDocuments.map((item) => item.id)}
                />
              </>
            );

            if (group.historyCount > 0) {
              return (
                <FolderDocumentTreeGroup
                  key={document.id}
                  group={group}
                  expanded={expanded}
                  onToggleExpand={() => onToggleExpand(document.id)}
                  isDocumentManager={isDocumentManager}
                  onDocumentOpen={onOpenDocument}
                  onDeleteVersion={handleDeleteVersion}
                  onDeleteRelatedDocument={handleDeleteRelatedDocument}
                  depth={2}
                  prefix={
                    <input
                      type="checkbox"
                      checked={selected.includes(document.id)}
                      onChange={() => onToggleSelect(document.id)}
                      aria-label={`Select ${document.name}`}
                      className="h-4 w-4 shrink-0 accent-pink-600"
                    />
                  }
                  suffix={rowSuffix}
                />
              );
            }

            return (
              <ProfileDocumentRow
                key={document.id}
                document={document}
                selected={selected.includes(document.id)}
                onToggleSelect={() => onToggleSelect(document.id)}
                onView={() => onView(document)}
                onApprove={() => onApprove(document)}
                onReject={() => onReject(document)}
                reviewPending={reviewPending}
                showReviewActions={showReviewActions}
                deleteRelatedIds={group.relatedDocuments.map((item) => item.id)}
                depth={2}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
