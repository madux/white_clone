"use client";

import { Lock } from "lucide-react";
import { useMemo } from "react";
import type {
  AcknowledgementFolderNode,
  DocDocument,
  DocFolder,
} from "../../../lib/types";
import { formatDocumentDate } from "../../../lib/formatDocumentDate";
import FolderActions from "./FolderActions";
import { sortLibraryFileRows } from "../../../lib/libraryTableSort";
import LibraryFileTable, { type LibraryFileRow } from "./LibraryFileTable";
import StatusPill from "./StatusPill";

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

function percentBadge(percent: number | null) {
  if (percent === null) return <StatusPill label="—" tone="neutral" />;
  const tone =
    percent >= 80 ? "ok" : percent >= 60 ? "attention" : "danger";
  return <StatusPill label={`${percent}%`} tone={tone} />;
}

function folderKindLabel(kind?: DocFolder["folder_kind"]) {
  if (kind === "project") return "Project";
  if (kind === "vendor") return "Vendor";
  return "Folder";
}

function formatBytes(bytes: number) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value < 10 && index > 0 ? value.toFixed(1) : Math.round(value)} ${units[index]}`;
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
  parentFolderId,
  sortKey = "name asc",
  onSortChange,
}: {
  rows: FolderRow[];
  ackFolders: AcknowledgementFolderNode[];
  selectedFolderIds: number[];
  onToggleFolderSelected: (id: number) => void;
  isDocumentManager: boolean;
  guideTarget?: string | null;
  search: string;
  percentFilters: AckPercentFilter[];
  parentFolderId?: number | false;
  sortKey?: string;
  onSortChange?: (order: string) => void;
}) {
  const ackByFolderId = useMemo(
    () => new Map(ackFolders.map((folder) => [folder.folder_id, folder])),
    [ackFolders],
  );

  const childFolderCountByParent = useMemo(() => {
    const counts = new Map<number, number>();
    rows.forEach(({ folder }) => {
      const parentId = Number(folder.parent_id || 0);
      if (!parentId) return;
      counts.set(parentId, (counts.get(parentId) ?? 0) + 1);
    });
    return counts;
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const scoped = rows.filter(({ folder }) => {
      const parentId = folder.parent_id || false;
      if (query) return true;
      if (parentFolderId) return parentId === parentFolderId;
      return !parentId;
    });
    const matched = scoped.filter(({ folder, documents }) => {
      const ackFolder = ackByFolderId.get(folder.id);
      const folderPercent = ackFolder?.acknowledgement_percent ?? null;
      const matchesSearch =
        !query ||
        folder.folder_name.toLowerCase().includes(query) ||
        documents.some(
          (document) =>
            document.name.toLowerCase().includes(query) ||
            document.document_type.toLowerCase().includes(query),
        );
      const matchesPercent = matchesPercentFilter(
        folderPercent ?? 100,
        percentFilters,
      );
      return matchesSearch && matchesPercent;
    });
    return matched;
  }, [ackByFolderId, parentFolderId, percentFilters, rows, search]);

  const tableRows: LibraryFileRow[] = sortLibraryFileRows(
    filteredRows.map(({ folder, documents }) => {
    const ackFolder = ackByFolderId.get(folder.id);
    const folderPercent = ackFolder?.acknowledgement_percent ?? null;
    const href = `/pages/organization/folder?folder=${folder.id}${
      guideTarget === "organizational-upload" ? "&guide=organizational-upload" : ""
    }`;
    const itemCount =
      (folder.document_count ?? documents.length) +
      (childFolderCountByParent.get(folder.id) ?? 0);
    return {
      id: `folder-${folder.id}`,
      kind: "folder",
      folderPreview: {
        hasContent: itemCount > 0,
        documents,
      },
      name: folder.folder_name,
      description: folder.description || "",
      documentsCount: itemCount,
      subtitle: `${folderKindLabel(folder.folder_kind)}${folder.collection_code ? ` · ${folder.collection_code}` : ""}`,
      href,
      extra: folder.locked ? (
        <Lock className="size-3.5 text-muted-foreground" aria-label="Locked" />
      ) : null,
      owner: folder.owner_name || "—",
      modified: formatDocumentDate(folder.last_modified),
      modifiedRaw: folder.last_modified || undefined,
      status: folder.locked ? (
        <StatusPill label="Locked" />
      ) : (
        percentBadge(folderPercent)
      ),
      selected: selectedFolderIds.includes(folder.id),
      onSelectChange: isDocumentManager
        ? () => onToggleFolderSelected(folder.id)
        : undefined,
      actions: (
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
          colorHex={folder.color_hex}
          folderKind={folder.folder_kind}
          organizeBy={folder.organize_by}
          requireUploadApproval={folder.require_upload_approval}
          approvalFlow={folder.approval_flow}
          acknowledgementPercent={folderPercent}
          acknowledgementPending={
            ackFolder
              ? Math.max(
                  0,
                  ackFolder.audience_count - ackFolder.acknowledged_count,
                )
              : undefined
          }
        />
      ),
    };
    }),
    sortKey,
  );

  if (!tableRows.length) {
    return null;
  }

  return (
    <LibraryFileTable
      rows={tableRows}
      sortKey={sortKey}
      onSortChange={onSortChange}
      selectable={isDocumentManager}
      allSelected={tableRows.every((row) => row.selected)}
      onToggleAll={(checked) => {
        filteredRows.forEach(({ folder }) => {
          const selected = selectedFolderIds.includes(folder.id);
          if (checked && !selected) onToggleFolderSelected(folder.id);
          if (!checked && selected) onToggleFolderSelected(folder.id);
        });
      }}
      showStatus
      showDescription
      showDocuments
      documentsColumnLabel="Items"
    />
  );
}
