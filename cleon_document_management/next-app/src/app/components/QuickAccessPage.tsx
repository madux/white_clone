"use client";

import { FileText, Folder, Pin, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useCurrentUser, useQuickAccess } from "../../../hooks/useDocuments";
import type { DocDocument, DocFolder } from "../../../lib/types";
import SectionTabs from "./SectionTabs";
import ThemedSelect from "./ThemedSelect";

type SortKey = "name" | "date";

function filterByName(
  items: Array<DocFolder | DocDocument>,
  query: string,
  tab: "folders" | "documents",
) {
  const term = query.trim().toLowerCase();
  if (!term) return items;
  return items.filter((item) => {
    const label =
      tab === "folders" && "folder_name" in item
        ? `${item.folder_name} ${item.description ?? ""}`
        : "name" in item
          ? `${item.name} ${item.folder_name ?? ""}`
          : "";
    return label.toLowerCase().includes(term);
  });
}

function sortItems<T extends DocFolder | DocDocument>(
  items: T[],
  sort: SortKey,
  nameKey: keyof T,
) {
  const sorted = [...items];
  if (sort === "date") {
    sorted.sort((a, b) => {
      const aDate = "write_date" in a ? a.write_date : "";
      const bDate = "write_date" in b ? b.write_date : "";
      if (aDate && bDate) return bDate.localeCompare(aDate);
      return String(a[nameKey]).localeCompare(String(b[nameKey]));
    });
    return sorted;
  }
  sorted.sort((a, b) =>
    String(a[nameKey]).localeCompare(String(b[nameKey]), undefined, {
      sensitivity: "base",
    }),
  );
  return sorted;
}

function folderHref(folder: DocFolder, isManager: boolean) {
  if (isManager) {
    return folder.folder_type === "employee"
      ? `/pages/employee/folder?folder=${folder.id}`
      : `/pages/organization/folder?folder=${folder.id}`;
  }
  return folder.folder_type === "employee"
    ? "/pages/my-documents?tab=files"
    : "/pages/my-documents?tab=shared";
}

function documentHref(document: DocDocument, isManager: boolean) {
  if (isManager) {
    return document.employee_id
      ? `/pages/employee/profile?employee=${document.employee_id}`
      : `/pages/organization/folder?folder=${document.folder_id}`;
  }
  return `/pages/my-documents?doc=${document.id}`;
}

export default function QuickAccessPage() {
  const quickAccess = useQuickAccess();
  const currentUser = useCurrentUser();
  const isManager = currentUser.data?.is_document_manager === true;
  const folders = quickAccess.data?.folders ?? [];
  const documents = quickAccess.data?.documents ?? [];
  const [tab, setTab] = useState<"folders" | "documents">("folders");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  const filteredFolders = useMemo(
    () =>
      sortItems(
        filterByName(folders, search, "folders") as DocFolder[],
        sort,
        "folder_name",
      ),
    [folders, search, sort],
  );
  const filteredDocuments = useMemo(
    () =>
      sortItems(
        filterByName(documents, search, "documents") as DocDocument[],
        sort,
        "name",
      ),
    [documents, search, sort],
  );

  return (
    <div className="mx-auto min-h-full max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10">
      {quickAccess.isLoading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-white" />
      ) : (
        <>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <SectionTabs
              items={[
                {
                  id: "folders",
                  label: "Pinned Folders",
                  icon: Folder,
                  count: folders.length,
                },
                {
                  id: "documents",
                  label: "Pinned Documents",
                  icon: FileText,
                  count: documents.length,
                },
              ]}
              value={tab}
              onChange={setTab}
              className="!w-auto"
              ariaLabel="Quick access sections"
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative block min-w-[220px] flex-1 sm:max-w-xs">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${tab}...`}
                  className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-pink/40 focus:ring-4 focus:ring-brand-pink/10"
                />
              </label>
              <ThemedSelect
                value={sort}
                onChange={(value) => setSort(value as SortKey)}
                ariaLabel="Sort pinned items"
                className="min-w-[180px] rounded-full border border-slate-200 bg-white px-3 py-2.5 text-sm"
                options={[
                  { value: "name", label: "Sort by name" },
                  { value: "date", label: "Sort by date pinned" },
                ]}
              />
            </div>
          </div>
          {tab === "folders" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Pin className="h-4 w-4 text-brand-pink" />
                <h2 className="font-bold text-slate-900">Pinned folders</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredFolders.map((folder) => (
                  <Link
                    key={folder.id}
                    href={folderHref(folder, isManager)}
                    className="rounded-2xl border border-slate-100 p-4 transition hover:border-pink-200 hover:bg-pink-50/40"
                  >
                    <Folder className="h-6 w-6 text-brand-pink" />
                    <p className="mt-3 font-bold text-slate-800">
                      {folder.folder_name}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">
                      {folder.description || "Pinned folder"}
                    </p>
                  </Link>
                ))}
                {!filteredFolders.length && (
                  <p className="text-sm text-slate-400">
                    {search
                      ? "No pinned folders match your search."
                      : "Pinned folders will appear here."}
                  </p>
                )}
              </div>
            </section>
          )}
          {tab === "documents" && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Pin className="h-4 w-4 text-brand-pink" />
                <h2 className="font-bold text-slate-900">Pinned documents</h2>
              </div>
              <div className="mt-4 divide-y divide-slate-100">
                {filteredDocuments.map((document) => (
                  <Link
                    key={document.id}
                    href={documentHref(document, isManager)}
                    className="flex items-center gap-3 py-3 hover:text-brand-pink"
                  >
                    <FileText className="h-5 w-5 text-brand-pink" />
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-slate-800">
                        {document.name}
                      </strong>
                      <small className="text-xs text-slate-400">
                        {document.folder_name} · {document.document_type}
                      </small>
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      {document.active === false ? "Inactive" : "Active"}
                    </span>
                  </Link>
                ))}
                {!filteredDocuments.length && (
                  <p className="text-sm text-slate-400">
                    {search
                      ? "No pinned documents match your search."
                      : "Pinned documents will appear here."}
                  </p>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
