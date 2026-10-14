"use client";

import {
  Check,
  ChevronRight,
  CornerDownRight,
  Lock,
  Search,
  Server,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { DocFolder } from "../../../lib/types";
import {
  folderKindLabel,
  folderLocationPath,
  parentFolderId,
} from "../../../lib/organizationalFolderDetails";
import {
  orgFolderDirectChildFolderCount,
  orgRootDirectoryStats,
} from "../../../lib/orgFolderLocationStats";
import { orgFolderLocationAccessBadge } from "../../../lib/orgFolderLocationAccessBadge";
import {
  filterOrgFoldersByKind,
  orgFoldersInTree,
  type OrgLibraryKindFilter,
} from "../../../lib/orgLibraryStats";
import { formatDocumentDate } from "../../../lib/formatDocumentDate";
import ModalDialog from "./ModalDialog";
import OrgFolderIcon from "./OrgFolderIcon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LocationKindChip = "all" | "policy" | "project" | "vendor" | "root";

const KIND_CHIPS: { key: LocationKindChip; label: string }[] = [
  { key: "all", label: "All folders" },
  { key: "policy", label: "Policy folders" },
  { key: "vendor", label: "Vendors" },
  { key: "project", label: "Projects" },
  { key: "root", label: "Root directory" },
];

function chipToKindFilter(chip: LocationKindChip): OrgLibraryKindFilter {
  if (chip === "policy") return "policy";
  if (chip === "project") return "project";
  if (chip === "vendor") return "vendor";
  return "all";
}

function matchesFolderSearch(folder: DocFolder, term: string) {
  if (!term) return true;
  const hay = `${folder.folder_name} ${folder.description || ""} ${folder.collection_code || ""}`;
  return hay.toLowerCase().includes(term);
}

function KindTag({ folder }: { folder: DocFolder }) {
  const kind = folder.folder_kind || "folder";
  if (kind === "folder") return null;
  return (
    <span className="shrink-0 rounded-md bg-pink-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pink-800">
      {kind === "policy" ? "Policy folder" : folderKindLabel(kind)}
    </span>
  );
}

function AccessTag({ folder }: { folder: DocFolder }) {
  const badge = orgFolderLocationAccessBadge(folder);
  if (!badge) return null;
  if (badge.tone === "confidential") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-red-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-700">
        <Lock className="h-3 w-3" aria-hidden />
        {badge.label}
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">
      {badge.detail ? `${badge.label} · ${badge.detail}` : badge.label}
    </span>
  );
}

function SelectionMark({ selected }: { selected: boolean }) {
  return (
    <span
      className={cn(
        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition",
        selected ? "border-brand-pink bg-brand-pink text-white" : "border-slate-300 bg-white",
      )}
      aria-hidden
    >
      {selected ? <Check className="h-3.5 w-3.5" /> : null}
    </span>
  );
}

export default function OrgFolderLocationPickerDialog({
  folders,
  allowRoot = true,
  initialFolderId = null,
  excludeIds = [],
  onClose,
  onPick,
  pending,
}: {
  folders: DocFolder[];
  allowRoot?: boolean;
  initialFolderId?: number | null;
  excludeIds?: number[];
  onClose: () => void;
  onPick: (folderId: number | false) => void | Promise<void>;
  pending?: boolean;
}) {
  const orgFolders = useMemo(
    () =>
      folders.filter(
        (item) =>
          item.folder_type === "organizational" && !excludeIds.includes(item.id),
      ),
    [excludeIds, folders],
  );

  const [search, setSearch] = useState("");
  const [kindChip, setKindChip] = useState<LocationKindChip>("all");
  const [selectedId, setSelectedId] = useState<number | false>(
    initialFolderId ?? (allowRoot ? false : orgFolders[0]?.id ?? false),
  );
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  const term = search.trim().toLowerCase();
  const kindFilter = chipToKindFilter(kindChip);
  const rootStats = useMemo(() => orgRootDirectoryStats(orgFolders), [orgFolders]);

  const chipCounts = useMemo(() => {
    const all = orgFolders.length;
    const policy = filterOrgFoldersByKind(orgFolders, "policy").length;
    const vendor = filterOrgFoldersByKind(orgFolders, "vendor").length;
    const project = filterOrgFoldersByKind(orgFolders, "project").length;
    return { all, policy, vendor, project };
  }, [orgFolders]);

  const visibleIds = useMemo(() => {
    if (!term) return null;
    const matching = new Set(
      orgFolders.filter((item) => matchesFolderSearch(item, term)).map((item) => item.id),
    );
    const keep = new Set<number>();
    const byId = new Map(orgFolders.map((item) => [item.id, item]));
    for (const id of matching) {
      let current = byId.get(id);
      while (current) {
        keep.add(current.id);
        const parent = parentFolderId(current);
        current = parent ? byId.get(parent) : undefined;
      }
    }
    return keep;
  }, [orgFolders, term]);

  const roots = useMemo(() => {
    if (kindChip === "root") return [];
    return orgFoldersInTree(orgFolders, 0, kindFilter).filter(
      (item) => !visibleIds || visibleIds.has(item.id),
    );
  }, [kindChip, kindFilter, orgFolders, visibleIds]);

  const toggleExpanded = (id: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedFolder =
    typeof selectedId === "number"
      ? orgFolders.find((item) => item.id === selectedId)
      : undefined;

  const selectedLabel =
    selectedId === false
      ? "Root"
      : selectedFolder?.folder_name ?? "—";

  const selectedPath =
    selectedId === false
      ? "Root"
      : selectedFolder
        ? folderLocationPath(selectedFolder.id, orgFolders, "")
        : "—";

  const renderFolderRow = (folder: DocFolder, depth: number, previewChild = false) => {
    const children = orgFoldersInTree(orgFolders, folder.id, kindFilter).filter(
      (item) => !visibleIds || visibleIds.has(item.id),
    );
    const hasChildren = children.length > 0;
    const isOpen = term ? true : expanded.has(folder.id);
    const selected = selectedId === folder.id;
    const subfolderCount = orgFolderDirectChildFolderCount(folder.id, orgFolders);
    const fileCount = folder.document_count ?? 0;

    if (previewChild) {
      return (
        <div
          key={`preview-${folder.id}`}
          className="flex items-center gap-2 py-1.5 pl-12 text-sm text-slate-600"
        >
          <CornerDownRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <span className="truncate font-medium">{folder.folder_name}</span>
        </div>
      );
    }

    return (
      <div key={folder.id} className="border-b border-slate-100 last:border-0">
        <div
          className={cn(
            "flex items-start gap-2 px-3 py-3 transition",
            selected ? "bg-pink-50/60" : "hover:bg-slate-50/80",
          )}
        >
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {hasChildren ? (
              <button
                type="button"
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-500 hover:bg-white"
                aria-expanded={isOpen}
                onClick={() => toggleExpanded(folder.id)}
              >
                <ChevronRight
                  className={cn("h-4 w-4 transition", isOpen && "rotate-90")}
                />
              </button>
            ) : (
              <span className="mt-0.5 inline-block h-7 w-7 shrink-0" aria-hidden />
            )}
            <button
              type="button"
              className="flex min-w-0 flex-1 gap-3 text-left"
              onClick={() => setSelectedId(folder.id)}
            >
              <OrgFolderIcon
                className="h-10 w-10 shrink-0"
                folderKind={folder.folder_kind}
                hasContent={fileCount > 0}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-slate-900">{folder.folder_name}</span>
                  <KindTag folder={folder} />
                  <AccessTag folder={folder} />
                </div>
                {folder.description ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                    {folder.description}
                  </p>
                ) : null}
                <p className="mt-2 text-[11px] text-slate-400">
                  {fileCount} {fileCount === 1 ? "file" : "files"}
                  {subfolderCount > 0
                    ? ` · ${subfolderCount} ${subfolderCount === 1 ? "subfolder" : "subfolders"}`
                    : ""}
                  {folder.last_modified
                    ? ` · Updated ${formatDocumentDate(folder.last_modified)}`
                    : ""}
                </p>
              </div>
            </button>
          </div>
          <button
            type="button"
            className="mt-1 shrink-0 p-1"
            onClick={() => setSelectedId(folder.id)}
            aria-label={`Select ${folder.folder_name}`}
          >
            <SelectionMark selected={selected} />
          </button>
        </div>
        {hasChildren && isOpen ? (
          <div className="border-t border-slate-50 bg-slate-50/40 pb-1">
            {children.length <= 4
              ? children.map((child) => renderFolderRow(child, depth + 1, true))
              : children
                  .slice(0, 3)
                  .map((child) => renderFolderRow(child, depth + 1, true))}
            {children.length > 4 ? (
              <p className="py-2 pl-12 text-xs text-slate-400">
                +{children.length - 3} more subfolders
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  const showRootCard = allowRoot && kindChip !== "policy" && kindChip !== "vendor" && kindChip !== "project";
  const rootSelected = selectedId === false;

  return (
    <ModalDialog
      title="Select folder location"
      eyebrow="Folder destination · Directory selection"
      description="Choose a policy category, vendor, project, or the normal root directory."
      onClose={onClose}
      size="3xl"
      zIndex={110}
      bodyClassName="!px-0 !py-0"
      footer={
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-pink">
              Selected location
            </p>
            <p className="text-sm font-bold text-slate-900">{selectedLabel}</p>
            <p className="mt-0.5 truncate text-xs text-slate-500">Path: {selectedPath}</p>
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="ghost" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => void onPick(selectedId)}
            >
              <Check className="h-4 w-4" data-icon="inline-start" />
              {pending ? "Working…" : "Select folder location"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-0">
        <div className="space-y-3 border-b border-slate-100 px-6 py-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search policy folders, vendors, projects, or root directory…"
              className="field w-full pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {KIND_CHIPS.map((chip) => {
              const count =
                chip.key === "all"
                  ? chipCounts.all
                  : chip.key === "policy"
                    ? chipCounts.policy
                    : chip.key === "vendor"
                      ? chipCounts.vendor
                      : chip.key === "project"
                        ? chipCounts.project
                        : null;
              const active = kindChip === chip.key;
              return (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    setKindChip(chip.key);
                    if (chip.key === "root" && allowRoot) setSelectedId(false);
                  }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                  )}
                >
                  {chip.label}
                  {count !== null ? ` (${count})` : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div className="max-h-[min(52vh,28rem)] overflow-y-auto px-6 py-4">
          {showRootCard ? (
            <section className="mb-6">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Normal folder directory (root level)
              </p>
              <button
                type="button"
                onClick={() => setSelectedId(false)}
                className={cn(
                  "flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition",
                  rootSelected
                    ? "border-brand-pink bg-pink-50/40 ring-2 ring-brand-pink/20"
                    : "border-slate-200 bg-white hover:border-slate-300",
                )}
              >
                <span
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-pink-100 text-brand-pink"
                  aria-hidden
                >
                  <Server className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-slate-900">Root directory (/)</span>
                    <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-800">
                      Normal folder directory
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    Standard root directory. Store documents or folders at the top level of the
                    organization without nesting under a category.
                  </p>
                  <p className="mt-2 text-[11px] text-slate-400">
                    Path: Root · {rootStats.fileCount} top-level{" "}
                    {rootStats.fileCount === 1 ? "file" : "files"} ·{" "}
                    {rootStats.subdirectoryCount}{" "}
                    {rootStats.subdirectoryCount === 1 ? "subdirectory" : "subdirectories"}
                  </p>
                </div>
                <SelectionMark selected={rootSelected} />
              </button>
            </section>
          ) : null}

          {kindChip !== "root" ? (
            <section>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Categorized organization folders
              </p>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                {roots.length ? (
                  roots.map((folder) => renderFolderRow(folder, 0))
                ) : (
                  <p className="px-4 py-8 text-center text-sm text-slate-500">
                    No folders match this filter.
                  </p>
                )}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </ModalDialog>
  );
}
