"use client";

import { Check, FileText, X } from "lucide-react";
import {
  useDeleteDocumentVersion,
  useDocumentAction,
} from "../../../hooks/useDocuments";
import { formatDocumentDateShort } from "../../../lib/formatDocumentDate";
import type { EmployeeDocumentGroup } from "../../../lib/groupEmployeeDocuments";
import { approvalDisplayLabel, canReviewDocument } from "../../../lib/approvalHelpers";
import { canUpdateDocument } from "../../../lib/documentUpdateHelpers";
import type { DocDocument } from "../../../lib/types";
import DocumentActions from "./DocumentActions";
import FolderDocumentTreeGroup from "./FolderDocumentTreeGroup";
import {
  employeeTreeCol,
  employeeTreeColsAdmin,
} from "../../../lib/employeeTreeColumns";

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
  onUpdate,
  showUpdateAction,
  deleteRelatedIds = [],
}: {
  document: DocDocument;
  showReviewActions: boolean;
  reviewPending: boolean;
  onApprove: () => void;
  onReject: () => void;
  onUpdate?: () => void;
  showUpdateAction?: boolean;
  deleteRelatedIds?: number[];
}) {
  const showUpdate =
    showUpdateAction && onUpdate && canUpdateDocument(document);

  return (
    <div className="flex shrink-0 items-center gap-2">
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
        active={document.active !== false}
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
  onUpdate,
  showUpdateAction,
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
  onUpdate?: () => void;
  showUpdateAction?: boolean;
  reviewPending: boolean;
  showReviewActions: boolean;
  deleteRelatedIds?: number[];
  depth?: number;
}) {
  return (
    <div
      className={`employee-tree-row employee-tree-row-file ${employeeTreeColsAdmin}`}
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
        {document.document_category_label ?? "—"}
      </span>
      <span className={employeeTreeCol.docType}>
        {document.document_type || "—"}
      </span>
      <span className={employeeTreeCol.uploadDate}>
        {formatDocumentDateShort(document.created_at || document.write_date)}
      </span>
      <span className={employeeTreeCol.version}>
        v{document.current_version_number ?? 1}
      </span>
      <div className={employeeTreeCol.status}>
        <DocumentStatusBadge document={document} />
      </div>
      <div className={employeeTreeCol.actions}>
        <DocumentRowActions
          document={document}
          showReviewActions={showReviewActions}
          reviewPending={reviewPending}
          onApprove={onApprove}
          onReject={onReject}
          onUpdate={onUpdate}
          showUpdateAction={showUpdateAction}
          deleteRelatedIds={deleteRelatedIds}
        />
      </div>
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
  onViewVersion,
  onApprove,
  onReject,
  reviewPending,
  showReviewActions,
  isDocumentManager,
  onUpdate,
  showUpdateAction = false,
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
  onViewVersion?: (document: DocDocument, versionId: number) => void;
  onApprove: (document: DocDocument) => void;
  onReject: (document: DocDocument) => void;
  reviewPending: boolean;
  showReviewActions: boolean;
  isDocumentManager: boolean;
  onUpdate?: (document: DocDocument) => void;
  showUpdateAction?: boolean;
}) {
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
    if (!window.confirm(`Delete this earlier copy of "${document.name}"?`)) {
      return;
    }
    await documentAction.mutateAsync({ id: document.id, action: "delete" });
  };

  return (
    <div className="employee-file-tree border-t border-slate-100 p-4">
      <div className="employee-tree-folder">
        <div
          className={`employee-tree-row employee-tree-row-folder ${employeeTreeColsAdmin}`}
        >
          <div className="employee-tree-leading">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleAll}
            aria-label="Select all documents"
            className={`h-4 w-4 accent-pink-600 ${employeeTreeCol.check}`}
          />
          <span className={employeeTreeCol.toggle} aria-hidden />
          <span className={employeeTreeCol.icon} aria-hidden />
          <div className={`font-bold text-slate-800 ${employeeTreeCol.name}`}>
            Documents
          </div>
          </div>
          <span
            className={`${employeeTreeCol.category} employee-tree-col-header employee-tree-col-category`}
          >
            Category
          </span>
          <span
            className={`${employeeTreeCol.docType} employee-tree-col-header employee-tree-col-doctype`}
          >
            Document type
          </span>
          <span
            className={`${employeeTreeCol.uploadDate} employee-tree-col-header employee-tree-col-upload-date`}
          >
            Upload date
          </span>
          <span
            className={`${employeeTreeCol.version} employee-tree-col-header employee-tree-col-version`}
          >
            Ver.
          </span>
          <span
            className={`${employeeTreeCol.status} employee-tree-col-header employee-tree-col-status`}
          >
            Approval
          </span>
          <span className={employeeTreeCol.actions} aria-hidden />
        </div>
        <div className="employee-tree-file-group !ml-4 !border-l-pink-100">
          {groups.map((group) => {
            const document = group.primary;
            const expanded = expandedDocuments.includes(document.id);
            const rowSuffix = (
              <>
                <span className={employeeTreeCol.category}>
                  {document.document_category_label ?? "—"}
                </span>
                <span className={employeeTreeCol.docType}>
                  {document.document_type || "—"}
                </span>
                <span className={employeeTreeCol.uploadDate}>
                  {formatDocumentDateShort(
                    document.created_at || document.write_date,
                  )}
                </span>
                <span className={employeeTreeCol.version}>
                  v{document.current_version_number ?? 1}
                </span>
                <div className={employeeTreeCol.status}>
                  <DocumentStatusBadge document={document} />
                </div>
                <div className={employeeTreeCol.actions}>
                  <DocumentRowActions
                    document={document}
                    showReviewActions={showReviewActions}
                    reviewPending={reviewPending}
                    onApprove={() => onApprove(document)}
                    onReject={() => onReject(document)}
                    onUpdate={onUpdate ? () => onUpdate(document) : undefined}
                    showUpdateAction={showUpdateAction}
                    deleteRelatedIds={group.relatedDocuments.map(
                      (item) => item.id,
                    )}
                  />
                </div>
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
                  onViewVersion={onViewVersion}
                  onDeleteVersion={handleDeleteVersion}
                  onDeleteRelatedDocument={handleDeleteRelatedDocument}
                  depth={2}
                  prefix={
                    <input
                      type="checkbox"
                      checked={selected.includes(document.id)}
                      onChange={() => onToggleSelect(document.id)}
                      aria-label={`Select ${document.name}`}
                      className={`h-4 w-4 shrink-0 accent-pink-600 ${employeeTreeCol.check}`}
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
                onUpdate={onUpdate ? () => onUpdate(document) : undefined}
                showUpdateAction={showUpdateAction}
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
