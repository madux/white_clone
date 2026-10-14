"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganizationalDocumentsIndex } from "../../../hooks/useDocuments";
import type { DocDocument } from "../../../lib/types";
import { formatDocumentDate } from "../../../lib/formatDocumentDate";
import { orgDocumentSourceLabel } from "../../../lib/orgDocumentSource";
import { isOrgDocumentLinkedToPolicy } from "../../../lib/policyDocumentName";
import DocumentActions from "./DocumentActions";
import DocumentViewerDialog from "./DocumentViewerDialog";
import LibraryFileTable, { type LibraryFileRow } from "./LibraryFileTable";
import StatusPill from "./StatusPill";
import ViewToggle from "./ViewToggle";
import OrgLibraryItemCardGrid from "./OrgLibraryItemCardGrid";
import { sortLibraryFileRows } from "../../../lib/libraryTableSort";
import {
  filterOrgDocumentsTab,
  type OrgDocumentTabFilters,
} from "../../../lib/orgLibraryFilters";
import { applyDocumentFilters } from "./DocumentFilterBar";

export default function OrgLibraryDocumentsContents({
  search,
  documentFilters,
  viewMode,
  onViewModeChange,
}: {
  search: string;
  documentFilters: OrgDocumentTabFilters;
  viewMode: "list" | "card";
  onViewModeChange: (mode: "list" | "card") => void;
}) {
  const router = useRouter();
  const documentsQuery = useOrganizationalDocumentsIndex(search);
  const documents = useMemo(
    () =>
      filterOrgDocumentsTab(
        documentsQuery.data?.items ?? [],
        documentFilters,
        search,
        applyDocumentFilters,
      ),
    [documentFilters, documentsQuery.data?.items, search],
  );
  const totalCount = documents.length;

  const [viewing, setViewing] = useState<DocDocument | null>(null);
  const [librarySortKey, setLibrarySortKey] = useState("modified desc");

  const openDocument = useCallback(
    (document: DocDocument) => {
      if (document.source_url) {
        window.open(document.source_url, "_blank", "noopener,noreferrer");
        return;
      }
      const editorId = Number(document.policy_editor_document_id || 0);
      if (editorId > 0) {
        const qs = new URLSearchParams({
          document: String(editorId),
          hr_document: String(document.id),
          folder: String(document.folder_id),
        });
        router.push(`/pages/organization/policy-editor?${qs.toString()}`);
        return;
      }
      setViewing(document);
    },
    [router],
  );

  const rows: LibraryFileRow[] = useMemo(() => {
    const mapped = documents.map((document) => ({
      id: String(document.id),
      kind: "file" as const,
      isShortcut: Boolean(document.is_shortcut),
      fileMeta: {
        name: document.name,
        mime_type: document.mime_type,
        document_type: document.document_type,
        source_url: document.source_url,
      },
      name: document.name,
      subtitle:
        [
          document.document_type,
          document.folder_name ? `In ${document.folder_name}` : null,
          orgDocumentSourceLabel(document),
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
      description: orgDocumentSourceLabel(document),
      location: document.folder_name || "—",
      owner: document.owner_name || "—",
      modified: formatDocumentDate(document.write_date),
      modifiedRaw: document.write_date || undefined,
      onOpen: () => openDocument(document),
      status: (
        <div className="flex flex-wrap items-center gap-1">
          {document.is_shortcut ? <StatusPill label="Shortcut" tone="info" /> : null}
          {isOrgDocumentLinkedToPolicy(document) ? (
            <StatusPill label="Linked to policy" tone="info" />
          ) : null}
          <StatusPill label={document.state === "approved" ? "Active" : document.state} />
        </div>
      ),
      actions: (
        <DocumentActions
          documentId={document.id}
          documentName={document.name}
          document={document}
          active={document.active !== false}
          organizational
          folderId={document.folder_id}
          sourceUrl={document.source_url}
          linkStatus={document.link_status}
          orgUseFolderAccess={document.org_use_folder_access !== false}
          orgAccessScope={document.org_access_scope}
          orgDepartmentIds={document.org_department_ids ?? []}
          orgGradeIds={document.org_grade_ids ?? []}
          orgEmployeeIds={document.org_employee_ids ?? []}
        />
      ),
    }));
    return sortLibraryFileRows(mapped, librarySortKey);
  }, [documents, librarySortKey, openDocument]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-slate-900">All documents</p>
          <p className="text-xs text-slate-500">
            {documentsQuery.isLoading
              ? "Loading…"
              : `${totalCount} document${totalCount === 1 ? "" : "s"} across organizational folders`}
          </p>
        </div>
        <ViewToggle
          value={viewMode === "card" ? "card" : "list"}
          onChange={(value) => onViewModeChange(value === "card" ? "card" : "list")}
          ariaLabel="Document view mode"
        />
      </div>

      {viewMode === "list" ? (
        <LibraryFileTable
          rows={rows}
          loading={documentsQuery.isLoading || documentsQuery.isFetching}
          sortKey={librarySortKey}
          onSortChange={setLibrarySortKey}
          showOwner
          showLocation
          showStatus
          showDescription
          descriptionColumnLabel="Source"
          nameLabel="Document"
          emptyTitle="No documents found"
          emptyDescription={
            search.trim()
              ? "Try a different search term or open a folder from the tree."
              : "Upload or link files in an organizational folder to see them here."
          }
        />
      ) : (
        <OrgLibraryItemCardGrid
          rows={rows}
          emptyTitle="No documents found"
          emptyDescription={
            search.trim()
              ? "Try a different search term or open a folder from the tree."
              : "Upload or link files in an organizational folder to see them here."
          }
        />
      )}

      {viewing ? (
        <DocumentViewerDialog
          title={viewing.name}
          description={[
            viewing.document_type,
            viewing.id ? `ID ${viewing.id}` : "",
            viewing.owner_name,
            viewing.folder_path?.map((item) => item.name).join(" / ") || viewing.folder_name,
            orgDocumentSourceLabel(viewing),
            viewing.source_url ? viewing.source_url : "",
          ]
            .filter(Boolean)
            .join(" · ")}
          documentId={viewing.id}
          onClose={() => setViewing(null)}
        />
      ) : null}
    </div>
  );
}
