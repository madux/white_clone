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
import { folderCardStyle } from "../../../lib/folderColor";
import EmptyState from "./EmptyState";

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
        <div className="grid gap-4 overflow-y-auto p-4 sm:grid-cols-2 xl:grid-cols-3">
          {roots.map((folder) => (
            <article
              key={folder.id}
              className="relative rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-pink/30 hover:shadow-md"
              style={folderCardStyle(folder.color_hex)}
            >
              <button
                type="button"
                onClick={() => onOpenFolder(folder.id)}
                className="flex w-full flex-col items-start text-left"
              >
                <OrgFolderIcon
                  className="mb-3 h-12 w-12"
                  folderKind={folder.folder_kind}
                  hasContent={(folder.document_count ?? 0) > 0}
                />
                <p className="font-semibold text-slate-900">{folder.folder_name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {folder.document_count ?? 0} items
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Modified {formatDocumentDate(folder.last_modified)}
                </p>
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
