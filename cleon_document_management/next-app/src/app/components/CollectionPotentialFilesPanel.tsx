"use client";

import { useMemo, useState } from "react";
import { Check, Link2, Loader2 } from "lucide-react";
import type { SuggestedCollectionFile } from "../../../lib/types";
import {
  collectionMatchBadgeLabel,
  formatDocumentFileSize,
} from "../../../lib/collectionSuggestedFileMatch";
import { formatDocumentDateShort } from "../../../lib/formatDocumentDate";
import { FileTypeIcon } from "./FileTypeIcon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function folderPathLabel(item: SuggestedCollectionFile) {
  const crumbs = item.folder_path;
  if (Array.isArray(crumbs) && crumbs.length) {
    if (typeof crumbs[0] === "string") {
      return crumbs.filter(Boolean).join(" / ");
    }
    return crumbs.map((crumb) => crumb.name).filter(Boolean).join(" / ");
  }
  return item.folder_name || "—";
}

export default function CollectionPotentialFilesPanel({
  collectionKind,
  query,
  items,
  loading,
  selectedIds,
  onSelectedIdsChange,
}: {
  collectionKind: "project" | "vendor";
  query: string;
  items: SuggestedCollectionFile[];
  loading: boolean;
  selectedIds: number[];
  onSelectedIdsChange: (ids: number[]) => void;
}) {
  const [clientFilter, setClientFilter] = useState("");

  const filtered = useMemo(() => {
    const needle = clientFilter.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => {
      const path = folderPathLabel(item).toLowerCase();
      return (
        item.name.toLowerCase().includes(needle) ||
        path.includes(needle) ||
        (item.owner_name || "").toLowerCase().includes(needle)
      );
    });
  }, [clientFilter, items]);

  const filteredIds = useMemo(() => filtered.map((item) => item.id), [filtered]);
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  const toggle = (documentId: number) => {
    onSelectedIdsChange(
      selectedIds.includes(documentId)
        ? selectedIds.filter((id) => id !== documentId)
        : [...selectedIds, documentId],
    );
  };

  const selectAllFiltered = () => {
    const merged = new Set([...selectedIds, ...filteredIds]);
    onSelectedIdsChange([...merged]);
  };

  const clearFiltered = () => {
    onSelectedIdsChange(selectedIds.filter((id) => !filteredIds.includes(id)));
  };

  const showPanel = loading || query.trim().length >= 2;

  if (!showPanel) {
    return null;
  }

  const selectionCount = selectedIds.length;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white"
      aria-label="Potential files to include"
    >
      <div className="border-b border-slate-200/80 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Potential files to include
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {loading
                ? "Searching the organizational library…"
                : `${items.length} match${items.length === 1 ? "" : "es"} for this ${collectionKind}`}
            </p>
          </div>
          {!loading && items.length > 0 ? (
            <button
              type="button"
              className="text-sm font-semibold text-brand-pink hover:text-brand-text disabled:opacity-40"
              disabled={!filteredIds.length}
              onClick={allFilteredSelected ? clearFiltered : selectAllFiltered}
            >
              {allFilteredSelected ? "Clear selection" : "Select all"}
            </button>
          ) : null}
        </div>
        {!loading && items.length > 3 ? (
          <div className="mt-3">
            <Input
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
              placeholder="Filter by name, folder, or owner…"
              className="h-9 rounded-lg border-slate-200 text-sm"
              aria-label="Filter potential files"
            />
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 px-4 py-10 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin text-brand-pink" aria-hidden />
          Loading recommendations…
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-800">No matching files yet</p>
          <p className="mt-1 text-sm text-slate-600">
            You can create the {collectionKind} now and link documents later from the library.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-600">
          No files match your filter. Clear the filter to see all suggestions.
        </div>
      ) : (
        <ul className="max-h-[min(24rem,52vh)] divide-y divide-slate-100 overflow-y-auto">
          {filtered.map((item) => {
            const selected = selectedIds.includes(item.id);
            const badge = collectionMatchBadgeLabel(
              item.match_reason,
              query,
              item.name,
            );
            return (
              <li key={item.id}>
                <label
                  className={cn(
                    "flex cursor-pointer gap-3 px-4 py-3.5 transition",
                    selected ? "bg-violet-50/80" : "hover:bg-slate-50/80",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-brand-pink focus:ring-brand-pink/30"
                    checked={selected}
                    onChange={() => toggle(item.id)}
                  />
                  <FileTypeIcon
                    name={item.name}
                    mime_type={item.mime_type}
                    document_type={item.document_type}
                    source_url={item.source_url}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {item.name}
                      </p>
                      <span
                        className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600"
                        title={badge}
                      >
                        {badge.length > 36 ? `${badge.slice(0, 33)}…` : badge}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {folderPathLabel(item)}
                    </p>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0 text-[11px] text-slate-400">
                      <span>{formatDocumentFileSize(item.file_size)}</span>
                      <span>
                        {formatDocumentDateShort(item.write_date, "—")}
                      </span>
                      {item.owner_name ? (
                        <span className="truncate">Owner: {item.owner_name}</span>
                      ) : null}
                    </p>
                  </div>
                  {selected ? (
                    <Check
                      className="mt-1 h-4 w-4 shrink-0 text-violet-700"
                      aria-hidden
                    />
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>
      )}

      {selectionCount > 0 ? (
        <div
          className="flex flex-wrap items-center gap-2 border-t border-violet-100 bg-violet-50/90 px-4 py-3 text-sm text-violet-950"
          role="status"
        >
          <Link2 className="h-4 w-4 shrink-0 text-violet-700" aria-hidden />
          <span>
            <span className="font-semibold">{selectionCount}</span> file
            {selectionCount === 1 ? "" : "s"} selected — linked as shortcuts when you
            create (files stay in their current folders).
          </span>
        </div>
      ) : null}
    </section>
  );
}
