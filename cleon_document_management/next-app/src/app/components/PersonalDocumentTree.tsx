"use client";

import { useMemo, useState } from "react";
import { approvalDisplayLabel } from "../../../lib/approvalHelpers";
import { canUpdateDocument } from "../../../lib/documentUpdateHelpers";
import { formatStatusLabel } from "../../../lib/formatLabel";
import { formatDocumentDate } from "../../../lib/formatDocumentDate";
import { groupEmployeeDocuments } from "../../../lib/groupEmployeeDocuments";
import type { DocDocument } from "../../../lib/types";
import BulkDocumentActions from "./BulkDocumentActions";
import DocumentActions from "./DocumentActions";
import LibraryFileTable, { type LibraryFileRow } from "./LibraryFileTable";
import StatusPill from "./StatusPill";
import { Button } from "@/components/ui/button";

export default function PersonalDocumentTree({
  documents,
  search,
  pendingStatusById = {},
  onView,
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

  const tableRows: LibraryFileRow[] = groups.map((group) => {
    const document = group.primary;
    const pendingStatus = pendingStatusById[document.id];
    const requiresApproval = document.approval_state === "pending";
    const canRequest =
      (document.state === "draft" || document.state === "rejected") &&
      document.approval_state !== "pending" &&
      !pendingStatus &&
      Boolean(onRequestApproval);
    return {
      id: String(document.id),
      kind: "file" as const,
      fileMeta: {
        name: document.name,
        mime_type: document.mime_type,
        document_type: document.document_type,
        source_url: document.source_url,
      },
      name: document.name,
      subtitle: [
        document.document_category_label ?? document.document_type,
        group.historyCount ? `${group.historyCount} earlier version${group.historyCount === 1 ? "" : "s"}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
      onOpen: () => onView(document),
      owner: document.employee_name || "Me",
      modified: formatDocumentDate(document.write_date),
      status: (
        <span className="flex flex-wrap items-center gap-1">
          <StatusPill
            label={
              pendingStatus ||
              (requiresApproval
                ? approvalDisplayLabel(document)
                : formatStatusLabel(document.state))
            }
          />
        </span>
      ),
      selected: selected.includes(document.id),
      onSelectChange: () =>
        setSelected((current) =>
          current.includes(document.id)
            ? current.filter((id) => id !== document.id)
            : [...current, document.id],
        ),
      actions: (
        <span className="flex items-center justify-end gap-1">
          {onUpdate && canUpdateDocument(document) ? (
            <Button variant="ghost" size="sm" onClick={() => onUpdate(document)}>
              Update
            </Button>
          ) : null}
          {canRequest ? (
            <Button size="sm" onClick={() => onRequestApproval?.(document)}>
              Request approval
            </Button>
          ) : null}
          <DocumentActions
            documentId={document.id}
            documentName={document.name}
            document={document}
            deleteRelatedIds={group.relatedDocuments.map((item) => item.id)}
          />
        </span>
      ),
    };
  });

  return (
    <div>
      <BulkDocumentActions
        selected={selected}
        onClear={() => setSelected([])}
        documents={rows}
        groups={groups}
      />
      <LibraryFileTable
        rows={tableRows}
        selectable
        allSelected={allSelected}
        onToggleAll={(checked) => setSelected(checked ? visibleIds : [])}
        showStatus
        emptyTitle="No documents found"
        emptyDescription="Upload a file to start building this workspace."
      />
    </div>
  );
}
