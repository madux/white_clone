"use client";

import { ChevronLeft, FileText, FolderOpen, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDocuments, useFolders } from "../../../../../hooks/useDocuments";
import SortableTable from "../../SortableTable";

const FOLDER_TONES = [
  "bg-slate-100 text-slate-500",
  "bg-red-50 text-red-500",
  "bg-orange-50 text-orange-500",
  "bg-amber-50 text-amber-500",
  "bg-lime-50 text-lime-600",
  "bg-emerald-50 text-emerald-600",
  "bg-cyan-50 text-cyan-600",
  "bg-sky-50 text-sky-600",
  "bg-violet-50 text-violet-500",
  "bg-fuchsia-50 text-fuchsia-500",
  "bg-pink-50 text-pink-500",
  "bg-slate-100 text-slate-500",
];

function formatWhen(value?: string) {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "—";
  const today = new Date();
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return "Today";
  }
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function folderTone(color?: number) {
  const index = Number.isFinite(color) ? Math.max(0, Number(color) % FOLDER_TONES.length) : 0;
  return FOLDER_TONES[index] || FOLDER_TONES[0];
}

export default function OrgFilesScope({
  selectedIds,
  onIds,
}: {
  selectedIds: number[];
  onIds: (value: number[]) => void;
}) {
  const folders = useFolders();
  const allDocuments = useDocuments();
  const [openFolderId, setOpenFolderId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const folderDocuments = useDocuments(openFolderId);
  const selected = new Set(selectedIds);

  useEffect(() => {
    if (openFolderId == null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenFolderId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openFolderId]);

  const allOrgFolders = useMemo(
    () =>
      (folders.data ?? []).filter(
        (folder) => folder.folder_type === "organizational",
      ),
    [folders.data],
  );
  const orgFolders = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allOrgFolders.filter(
      (folder) =>
        !needle ||
        `${folder.folder_name} ${folder.description || ""}`
          .toLowerCase()
          .includes(needle),
    );
  }, [allOrgFolders, query]);
  const openFolder = allOrgFolders.find((folder) => folder.id === openFolderId);
  const files = (folderDocuments.data ?? []).filter(
    (document) => document.distribution_status !== "archived",
  );
  const visibleFileIds = files.map((document) => document.id);
  const allInFolderSelected =
    visibleFileIds.length > 0 && visibleFileIds.every((id) => selected.has(id));

  const selectedRows = useMemo(() => {
    const known = new Map(
      (allDocuments.data ?? []).map((document) => [document.id, document]),
    );
    return selectedIds
      .map((id) => known.get(id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
  }, [allDocuments.data, selectedIds]);

  const totalFiles = orgFolders.reduce(
    (sum, folder) => sum + (folder.document_count || 0),
    0,
  );

  function toggleFile(id: number) {
    onIds(
      selected.has(id)
        ? selectedIds.filter((item) => item !== id)
        : [...selectedIds, id],
    );
  }

  function toggleFolderFiles() {
    if (allInFolderSelected) {
      onIds(selectedIds.filter((id) => !visibleFileIds.includes(id)));
      return;
    }
    const next = new Set(selectedIds);
    visibleFileIds.forEach((id) => next.add(id));
    onIds(Array.from(next));
  }

  if (folders.isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  if (openFolder) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-pink"
            onClick={() => setOpenFolderId(null)}
          >
            <ChevronLeft className="h-4 w-4" />
            All folders
          </button>
          <p className="text-xs font-semibold text-slate-400">
            {selectedIds.length} selected across folders
          </p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
            Organizational Files
          </p>
          <h3 className="mt-1 text-base font-bold text-slate-900">
            {openFolder.folder_name}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Tick the files to extract. You can go back and pick more from another
            folder.
          </p>
        </div>
        {files.length ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2.5">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={allInFolderSelected}
                  onChange={toggleFolderFiles}
                  className="h-4 w-4 accent-pink-600"
                />
                Select all in this folder
              </label>
              <span className="text-xs font-semibold text-slate-400">
                {files.length} files
              </span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="w-12 px-4 py-3" />
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Last modified</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {files.map((document) => (
                    <tr
                      key={document.id}
                      className={`cursor-pointer hover:bg-pink-50/40 ${
                        selected.has(document.id) ? "bg-pink-50/50" : ""
                      }`}
                      onClick={() => toggleFile(document.id)}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(document.id)}
                          onChange={() => toggleFile(document.id)}
                          onClick={(event) => event.stopPropagation()}
                          className="h-4 w-4 accent-pink-600"
                          aria-label={`Select ${document.name}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-2 font-semibold text-slate-800">
                          <FileText className="h-4 w-4 text-slate-400" />
                          {document.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {document.document_type || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {formatWhen(document.write_date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
            {folderDocuments.isLoading
              ? "Loading files…"
              : "This folder has no files you can extract."}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="relative block min-w-[220px] flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter folders…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-pink/40 focus:bg-white focus:ring-4 focus:ring-brand-pink/10"
          />
        </label>
        <div className="flex gap-2 text-xs font-semibold text-slate-500">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            Total Folders: {orgFolders.length}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">
            Total Files: {totalFiles}
          </span>
        </div>
      </div>
      {selectedIds.length ? (
        <div className="rounded-2xl border border-pink-100 bg-pink-50/60 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">
              {selectedIds.length} file{selectedIds.length === 1 ? "" : "s"} selected
            </p>
            <button
              type="button"
              className="text-xs font-semibold text-brand-pink hover:underline"
              onClick={() => onIds([])}
            >
              Clear
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedRows.map((document) => (
              <span
                key={document.id}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                {document.name}
                <button
                  type="button"
                  aria-label={`Remove ${document.name}`}
                  onClick={() => toggleFile(document.id)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <SortableTable className="w-full min-w-[720px] text-left">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-400">
            <tr>
              <th className="px-5 py-4">Name</th>
              <th className="px-5 py-4">Description</th>
              <th className="px-5 py-4">Documents</th>
              <th className="px-5 py-4">Last modified</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orgFolders.length ? (
              orgFolders.map((folder) => (
                <tr
                  key={folder.id}
                  className="cursor-pointer hover:bg-pink-50/40"
                  onClick={() => setOpenFolderId(folder.id)}
                >
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-3">
                      <span
                        className={`rounded-xl p-2.5 ${folderTone(folder.color)}`}
                      >
                        <FolderOpen className="h-5 w-5" />
                      </span>
                      <span className="font-bold text-slate-800">
                        {folder.folder_name}
                      </span>
                    </span>
                  </td>
                  <td className="px-5 py-4 text-sm italic text-slate-400">
                    {folder.description || "No description"}
                  </td>
                  <td className="px-5 py-4 text-sm font-semibold text-brand-pink">
                    {folder.document_count ?? 0}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {formatWhen(folder.last_modified)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                  {query.trim()
                    ? "No folders match that filter."
                    : "No organizational folders are shared with you yet."}
                </td>
              </tr>
            )}
          </tbody>
        </SortableTable>
      </div>
    </div>
  );
}
