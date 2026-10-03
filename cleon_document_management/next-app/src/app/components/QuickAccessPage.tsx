"use client";

import { Pin, Search } from "lucide-react";
import OrgFolderIcon from "./OrgFolderIcon";
import { FileTypeIcon } from "./FileTypeIcon";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useCurrentUser, useQuickAccess } from "../../../hooks/useDocuments";
import type { DocDocument, DocFolder } from "../../../lib/types";
import { folderCardStyle } from "../../../lib/folderColor";
import { myWorkspaceHref } from "../../../lib/workspaceRoutes";
import SectionTabs from "./SectionTabs";
import ThemedSelect from "./ThemedSelect";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

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
    ? myWorkspaceHref("documents", { scope: "files" })
    : myWorkspaceHref("documents", { scope: "shared" });
}

function documentHref(document: DocDocument, isManager: boolean) {
  if (isManager) {
    return document.employee_id
      ? `/pages/employee/profile?employee=${document.employee_id}`
      : `/pages/organization/folder?folder=${document.folder_id}`;
  }
  return myWorkspaceHref("documents", { doc: String(document.id) });
}

export default function QuickAccessPage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
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
    <div className={embedded ? "space-y-6" : "app-page space-y-6"}>
      {quickAccess.isLoading ? (
        <div className="h-48 animate-pulse bg-white" />
      ) : (
        <>
          <SectionTabs
            level="nested"
            ariaLabel="Quick access sections"
            value={tab}
            onChange={(value) => setTab(value as "folders" | "documents")}
            items={[
              { id: "folders", label: "Pinned folders", count: folders.length },
              { id: "documents", label: "Pinned documents", count: documents.length },
            ]}
          />
          <div className="app-page-toolbar">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <InputGroup className="min-w-[220px] flex-1 sm:max-w-xs">
                <InputGroupAddon>
                  <Search />
                </InputGroupAddon>
                <InputGroupInput
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${tab}...`}
                />
              </InputGroup>
              <ThemedSelect
                value={sort}
                onChange={(value) => setSort(value as SortKey)}
                ariaLabel="Sort pinned items"
                options={[
                  { value: "name", label: "Sort by name" },
                  { value: "date", label: "Sort by date pinned" },
                ]}
              />
            </div>
          </div>
          {tab === "folders" && (
            <section className="app-page-body p-4">
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
                    style={folderCardStyle(folder.color_hex)}
                  >
                    <OrgFolderIcon
                      className="h-10 w-10"
                      folderKind={folder.folder_kind}
                      hasContent={(folder.document_count ?? 0) > 0}
                    />
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
            <section className="app-page-body p-4">
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
                    <FileTypeIcon
                      name={document.name}
                      mime_type={document.mime_type}
                      document_type={document.document_type}
                      source_url={document.source_url}
                    />
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
