"use client";

import { ChevronRight, Folder } from "lucide-react";
import { useMemo, useState } from "react";
import type { DocFolder } from "../../../lib/types";
import {
  orgFoldersInTree,
  type OrgLibraryKindFilter,
} from "../../../lib/orgLibraryStats";
import { parentFolderId } from "../../../lib/organizationalFolderDetails";
function matchesSearch(folder: DocFolder, term: string) {
  if (!term) return true;
  const hay = `${folder.folder_name} ${folder.description || ""} ${folder.collection_code || ""}`;
  return hay.toLowerCase().includes(term);
}

export default function OrgFolderNavTree({
  folders,
  activeFolderId,
  kindFilter,
  search,
  onSearchChange,
  onSelectFolder,
  treeVisibleIds = null,
}: {
  folders: DocFolder[];
  activeFolderId: number | null;
  kindFilter: OrgLibraryKindFilter;
  search: string;
  onSearchChange: (value: string) => void;
  onSelectFolder: (folderId: number | null) => void;
  treeVisibleIds?: Set<number> | null;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  const term = search.trim().toLowerCase();

  const visibleIds = useMemo(() => {
    if (treeVisibleIds && !term) return treeVisibleIds;
    if (!term && !treeVisibleIds) return null;
    if (!term) return treeVisibleIds;
    const org = folders.filter((item) => item.folder_type === "organizational");
    const matching = new Set(
      org.filter((item) => matchesSearch(item, term)).map((item) => item.id),
    );
    const keep = new Set<number>();
    const byId = new Map(org.map((item) => [item.id, item]));
    for (const id of matching) {
      let current = byId.get(id);
      while (current) {
        keep.add(current.id);
        const parent = parentFolderId(current);
        current = parent ? byId.get(parent) : undefined;
      }
    }
    if (treeVisibleIds && term) {
      for (const id of [...keep]) {
        if (!treeVisibleIds.has(id)) keep.delete(id);
      }
    }
    return keep;
  }, [folders, term, treeVisibleIds]);

  const toggleExpanded = (id: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderNode = (folder: DocFolder, depth: number) => {
    if (visibleIds && !visibleIds.has(folder.id)) return null;
    const children = orgFoldersInTree(folders, folder.id, kindFilter).filter(
      (item) => !visibleIds || visibleIds.has(item.id),
    );
    const hasChildren = children.length > 0;
    const isOpen = term ? true : expanded.has(folder.id);
    const selected = activeFolderId === folder.id;

    return (
      <div key={folder.id}>
        <div
          className={`flex min-w-0 items-center gap-0.5 rounded-lg pr-1 ${
            selected ? "bg-pink-50 text-brand-pink" : "hover:bg-slate-50"
          }`}
          style={{ paddingLeft: 4 + depth * 12 }}
        >
          {hasChildren ? (
            <button
              type="button"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-white/80"
              aria-expanded={isOpen}
              onClick={() => toggleExpanded(folder.id)}
            >
              <ChevronRight
                className={`h-4 w-4 transition ${isOpen ? "rotate-90" : ""}`}
              />
            </button>
          ) : (
            <span className="inline-block h-7 w-7 shrink-0" aria-hidden />
          )}
          <button
            type="button"
            onClick={() => onSelectFolder(folder.id)}
            className={`flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm font-medium ${
              selected ? "text-brand-pink" : "text-slate-800"
            }`}
          >
            <Folder className="h-4 w-4 shrink-0 opacity-70" />
            <span className="truncate">{folder.folder_name}</span>
          </button>
        </div>
        {hasChildren && isOpen
          ? children.map((child) => renderNode(child, depth + 1))
          : null}
      </div>
    );
  };

  const roots = orgFoldersInTree(folders, 0, kindFilter).filter(
    (item) => !visibleIds || visibleIds.has(item.id),
  );

  return (
    <aside className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-slate-50/80">
      <div className="border-b border-slate-200 px-3 py-3">
        <h2 className="text-sm font-bold text-slate-900">Folders</h2>
      </div>
      <div className="px-3 py-2">
        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search folders…"
          className="field w-full text-sm"
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        <button
          type="button"
          onClick={() => onSelectFolder(null)}
          className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold ${
            activeFolderId === null
              ? "bg-pink-50 text-brand-pink"
              : "text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Folder className="h-4 w-4 shrink-0" />
          All folders
        </button>
        {roots.map((folder) => renderNode(folder, 0))}
      </div>
    </aside>
  );
}
