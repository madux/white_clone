"use client";

import { useMemo, useState } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import type { SuggestedPolicyFile } from "../../../lib/types";
import { FileTypeIcon } from "./FileTypeIcon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function folderPathLabel(item: SuggestedPolicyFile) {
  const crumbs = item.folder_path;
  if (Array.isArray(crumbs) && crumbs.length) {
    if (typeof crumbs[0] === "string") {
      return crumbs.filter(Boolean).join(" / ");
    }
    return crumbs.map((crumb) => crumb.name).filter(Boolean).join(" / ");
  }
  return item.folder_name || "—";
}

export default function PolicyPotentialFilesPanel({
  policyName,
  items,
  loading,
  selectedIds,
  onSelectedIdsChange,
  disabled,
}: {
  policyName: string;
  items: SuggestedPolicyFile[];
  loading: boolean;
  selectedIds: number[];
  onSelectedIdsChange: (ids: number[]) => void;
  disabled?: boolean;
}) {
  const [clientFilter, setClientFilter] = useState("");
  const namedSearch = Boolean(policyName.trim());

  const filtered = useMemo(() => {
    const needle = clientFilter.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => {
      const path = folderPathLabel(item).toLowerCase();
      return item.name.toLowerCase().includes(needle) || path.includes(needle);
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

  const subtitle = loading
    ? "Searching the organizational library…"
    : namedSearch
      ? `${items.length} match${items.length === 1 ? "" : "es"} for “${policyName.trim()}”`
      : `${items.length} policy-related file${items.length === 1 ? "" : "s"} not in a policy folder yet`;

  return (
    <section
      className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white"
      aria-label="Smart potential files"
    >
      <div className="border-b border-slate-200/80 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Smart potential files</h3>
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          </div>
          {!loading && items.length > 0 ? (
            <button
              type="button"
              className="text-sm font-semibold text-brand-pink hover:text-brand-text disabled:opacity-40"
              disabled={disabled || !filteredIds.length}
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
              placeholder="Filter by name or folder…"
              className="h-9 rounded-lg border-slate-200 text-sm"
              aria-label="Filter potential files"
              disabled={disabled}
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
          <p className="text-sm font-medium text-slate-800">
            {namedSearch ? "No matching files for this policy name" : "No unassigned policy files found"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {namedSearch
              ? "Try a different name or add documents after the policy folder is created."
              : "You can still create the policy and upload or link documents afterward."}
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
            return (
              <li key={item.id}>
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <FileTypeIcon
                    name={item.name}
                    mime_type={item.mime_type}
                    document_type={item.document_type}
                    source_url={item.source_url}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
                    <p className="truncate text-xs text-slate-500">{folderPathLabel(item)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    disabled={disabled}
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition",
                      selected
                        ? "border-brand-pink bg-brand-pink text-white"
                        : "border-slate-200 bg-white text-slate-500 hover:border-brand-pink hover:text-brand-pink",
                    )}
                    aria-label={
                      selected ? `Remove ${item.name} from selection` : `Add ${item.name}`
                    }
                    aria-pressed={selected}
                  >
                    {selected ? (
                      <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden />
                    ) : (
                      <Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
