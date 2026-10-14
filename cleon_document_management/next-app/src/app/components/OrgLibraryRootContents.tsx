"use client";

import { Lock } from "lucide-react";
import { useMemo, useState } from "react";
import type { DocFolder } from "../../../lib/types";
import type { OrgLibraryKindFilter } from "../../../lib/orgLibraryStats";
import {
  filterOrgRootFolders,
  type OrgFolderFilters,
} from "../../../lib/orgLibraryFilters";
import { formatDocumentDate } from "../../../lib/formatDocumentDate";
import OrgFolderIcon from "./OrgFolderIcon";
import FolderActions from "./FolderActions";
import ViewToggle from "./ViewToggle";
import { Checkbox } from "@/components/ui/checkbox";
import EmptyState from "./EmptyState";
import OrgLibraryItemCardGrid from "./OrgLibraryItemCardGrid";
import type { LibraryFileRow } from "./LibraryFileTable";

function rootTitle(kindFilter: OrgLibraryKindFilter) {
  if (kindFilter === "project") return "Projects";
  if (kindFilter === "vendor") return "Vendors";
  return "All folders";
}

export default function OrgLibraryRootContents({
  folders,
  kindFilter,
  search,
  folderFilters,
  viewMode,
  onViewModeChange,
  onOpenFolder,
}: {
  folders: DocFolder[];
  kindFilter: OrgLibraryKindFilter;
  search: string;
  folderFilters: OrgFolderFilters;
  viewMode: "list" | "card";
  onViewModeChange: (mode: "list" | "card") => void;
  onOpenFolder: (folderId: number) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);

  const roots = useMemo(
    () => filterOrgRootFolders(folders, kindFilter, search, folderFilters),
    [folders, folderFilters, kindFilter, search],
  );

  const toggle = (id: number) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((v) => v !== id) : [...current, id],
    );

  const rootCardRows = useMemo<LibraryFileRow[]>(
    () =>
      roots.map((folder) => ({
        id: String(folder.id),
        kind: "folder",
        name: folder.folder_name,
        subtitle: `${folder.document_count ?? 0} items`,
        folderKind: folder.folder_kind,
        folderColorHex: folder.color_hex,
        folderPreview: {
          hasContent: (folder.document_count ?? 0) > 0,
          documents: [],
        },
        modified: formatDocumentDate(folder.last_modified),
        onOpen: () => onOpenFolder(folder.id),
        selected: selected.includes(folder.id),
        onSelectChange: () => toggle(folder.id),
        extra: folder.locked ? (
          <Lock className="h-4 w-4 text-muted-foreground" />
        ) : null,
        actions: (
          <FolderActions
            folderId={folder.id}
            folderName={folder.folder_name}
            description={folder.description}
            locked={folder.locked}
            folderType={folder.folder_type}
            accessScope={folder.access_scope}
            folderKind={folder.folder_kind}
          />
        ),
      })),
    [onOpenFolder, roots, selected],
  );

  if (!roots.length) {
    return (
      <EmptyState
        title="No folders yet"
        description="Use + New in the header to create a folder, project, or vendor."
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{rootTitle(kindFilter)}</p>
          <p className="text-xs text-slate-500">{roots.length} items</p>
        </div>
        <ViewToggle
          value={viewMode === "card" ? "card" : "list"}
          onChange={(value) => onViewModeChange(value === "card" ? "card" : "list")}
          ariaLabel="Folder view mode"
        />
      </div>
      {viewMode === "list" ? (
        <ul className="divide-y divide-slate-100 overflow-y-auto">
          {roots.map((folder) => (
            <li
              key={folder.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
            >
              <Checkbox
                checked={selected.includes(folder.id)}
                onCheckedChange={() => toggle(folder.id)}
                aria-label={`Select ${folder.folder_name}`}
              />
              <button
                type="button"
                onClick={() => onOpenFolder(folder.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <OrgFolderIcon
                  className="h-9 w-9 shrink-0"
                  folderKind={folder.folder_kind}
                  hasContent={(folder.document_count ?? 0) > 0}
                />
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {folder.folder_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {folder.document_count ?? 0} items ·{" "}
                    {formatDocumentDate(folder.last_modified)}
                  </p>
                </div>
              </button>
              {folder.locked ? (
                <Lock className="h-4 w-4 text-muted-foreground" />
              ) : null}
              <FolderActions
                folderId={folder.id}
                folderName={folder.folder_name}
                description={folder.description}
                locked={folder.locked}
                folderType={folder.folder_type}
                accessScope={folder.access_scope}
                folderKind={folder.folder_kind}
              />
            </li>
          ))}
        </ul>
      ) : (
        <OrgLibraryItemCardGrid rows={rootCardRows} selectable />
      )}
    </div>
  );
}
