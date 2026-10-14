import type { FilterState } from "../src/app/components/DocumentFilterBar";
import type { DocDocument, DocFolder } from "./types";
import { parentFolderId } from "./organizationalFolderDetails";
import {
  filterOrgFoldersByKind,
  type OrgLibraryKindFilter,
} from "./orgLibraryStats";
import { orgDocumentSourceKey } from "./orgDocumentSource";

export type OrgFolderSort = "name_asc" | "name_desc" | "modified_desc" | "documents_desc";

export type OrgFolderFilters = {
  subKind: "all" | "folder" | "project" | "vendor" | "policy";
  accessScope: string;
  lockState: "all" | "locked" | "unlocked";
  archived: "all" | "active" | "archived";
  content: "all" | "empty" | "has_files";
  sort: OrgFolderSort;
};

export const INITIAL_ORG_FOLDER_FILTERS: OrgFolderFilters = {
  subKind: "all",
  accessScope: "all",
  lockState: "all",
  archived: "all",
  content: "all",
  sort: "name_asc",
};

export type OrgDocumentTabFilters = {
  source: string;
  documentTypeId: string;
  status: string;
  policyLink: FilterState["policyLink"];
  folderId: string;
  fileFormat: string;
  timeframe: string;
  dateField: FilterState["dateField"];
  startDate: string;
  endDate: string;
};

export const INITIAL_ORG_DOCUMENT_TAB_FILTERS: OrgDocumentTabFilters = {
  source: "all",
  documentTypeId: "all",
  status: "all",
  policyLink: "all",
  folderId: "all",
  fileFormat: "all",
  timeframe: "all",
  dateField: "write_date",
  startDate: "",
  endDate: "",
};

export type OrgPolicyTabFilters = {
  status: string;
  visibility: string;
  category: string;
  hasDocument: "all" | "yes" | "no";
};

export const INITIAL_ORG_POLICY_TAB_FILTERS: OrgPolicyTabFilters = {
  status: "all",
  visibility: "all",
  category: "all",
  hasDocument: "all",
};

export function orgDocumentTabFiltersToFilterState(
  search: string,
  tab: OrgDocumentTabFilters,
): FilterState {
  return {
    search,
    documentType: tab.documentTypeId,
    status: tab.status,
    timeframe: tab.timeframe,
    dateField: tab.dateField,
    startDate: tab.startDate,
    endDate: tab.endDate,
    department: "all",
    fileFormat: tab.fileFormat,
    approvalStatus: "all",
    policyLink: tab.policyLink,
  };
}

export function folderMatchesOrgFolderFilters(
  folder: DocFolder,
  filters: OrgFolderFilters,
): boolean {
  if (filters.subKind !== "all" && (folder.folder_kind || "folder") !== filters.subKind) {
    return false;
  }
  if (filters.accessScope !== "all" && folder.access_scope !== filters.accessScope) {
    return false;
  }
  const locked = Boolean(folder.locked);
  if (filters.lockState === "locked" && !locked) return false;
  if (filters.lockState === "unlocked" && locked) return false;
  const archived =
    folder.active === false ||
    folder.distribution_status === "archived" ||
    folder.distribution_status === "deactivated";
  if (filters.archived === "active" && archived) return false;
  if (filters.archived === "archived" && !archived) return false;
  const count = folder.document_count ?? 0;
  if (filters.content === "empty" && count > 0) return false;
  if (filters.content === "has_files" && count <= 0) return false;
  return true;
}

function sortOrgFolders(folders: DocFolder[], sort: OrgFolderSort): DocFolder[] {
  const list = [...folders];
  list.sort((a, b) => {
    switch (sort) {
      case "name_desc":
        return b.folder_name.localeCompare(a.folder_name, undefined, { sensitivity: "base" });
      case "modified_desc": {
        const at = Date.parse(a.last_modified || "") || 0;
        const bt = Date.parse(b.last_modified || "") || 0;
        return bt - at;
      }
      case "documents_desc":
        return (b.document_count ?? 0) - (a.document_count ?? 0);
      case "name_asc":
      default:
        return a.folder_name.localeCompare(b.folder_name, undefined, { sensitivity: "base" });
    }
  });
  return list;
}

export function filterOrgRootFolders(
  folders: DocFolder[],
  kindFilter: OrgLibraryKindFilter,
  search: string,
  filters: OrgFolderFilters,
): DocFolder[] {
  const term = search.trim().toLowerCase();
  const filtered = filterOrgFoldersByKind(folders, kindFilter);
  const allowed = new Set(filtered.map((item) => item.id));
  let roots = folders.filter(
    (item) =>
      item.folder_type === "organizational" &&
      !parentFolderId(item) &&
      (kindFilter === "all" || allowed.has(item.id)),
  );
  roots = roots.filter((item) => folderMatchesOrgFolderFilters(item, filters));
  if (term) {
    roots = roots.filter((item) =>
      `${item.folder_name} ${item.description || ""} ${item.collection_code || ""}`
        .toLowerCase()
        .includes(term),
    );
  }
  return sortOrgFolders(roots, filters.sort);
}

/** Whether the open folder belongs under the current summary tab (e.g. Projects). */
export function orgActiveFolderMatchesKindTab(
  folder: DocFolder,
  folders: DocFolder[],
  kindFilter: OrgLibraryKindFilter,
): boolean {
  if (kindFilter === "all" || kindFilter === "documents") return true;
  const org = folders.filter((item) => item.folder_type === "organizational");
  const byId = new Map(org.map((item) => [item.id, item]));
  let current: DocFolder | undefined = folder;
  while (current) {
    if ((current.folder_kind || "folder") === kindFilter) return true;
    const parentId = parentFolderId(current);
    current = parentId ? byId.get(parentId) : undefined;
  }
  return false;
}

/** Folder ids that match filters, plus ancestors for tree navigation. */
export function orgFolderTreeVisibleIds(
  folders: DocFolder[],
  kindFilter: OrgLibraryKindFilter,
  filters: OrgFolderFilters,
): Set<number> | null {
  const hasExtra =
    filters.subKind !== "all" ||
    filters.accessScope !== "all" ||
    filters.lockState !== "all" ||
    filters.archived !== "all" ||
    filters.content !== "all";
  if (!hasExtra && kindFilter !== "documents") return null;

  const org = folders.filter((item) => item.folder_type === "organizational");
  const byKind = filterOrgFoldersByKind(org, kindFilter);
  const kindAllowed = new Set(byKind.map((item) => item.id));
  const matching = new Set<number>();
  for (const folder of org) {
    if (kindFilter !== "all" && kindFilter !== "documents" && !kindAllowed.has(folder.id)) {
      continue;
    }
    if (kindFilter === "documents" && (folder.document_count ?? 0) <= 0) continue;
    if (!folderMatchesOrgFolderFilters(folder, filters)) continue;
    matching.add(folder.id);
  }
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
  return keep;
}

export function filterOrgDocumentsTab(
  documents: DocDocument[],
  tabFilters: OrgDocumentTabFilters,
  search: string,
  applyDocumentFiltersFn: (docs: DocDocument[], filters: FilterState) => DocDocument[],
): DocDocument[] {
  let list = documents;
  if (tabFilters.source !== "all") {
    list = list.filter((doc) => orgDocumentSourceKey(doc) === tabFilters.source);
  }
  if (tabFilters.folderId !== "all") {
    const folderId = Number(tabFilters.folderId);
    if (folderId > 0) {
      list = list.filter((doc) => doc.folder_id === folderId);
    }
  }
  const filterState = orgDocumentTabFiltersToFilterState(search, tabFilters);
  return applyDocumentFiltersFn(list, filterState);
}

export function uniqueOrgFolderOptions(folders: DocFolder[]) {
  return folders
    .filter((item) => item.folder_type === "organizational")
    .map((item) => ({ value: String(item.id), label: item.folder_name }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export function uniquePolicyCategories(
  policies: { category?: string }[],
): { value: string; label: string }[] {
  const values = new Set<string>();
  for (const policy of policies) {
    const category = (policy.category || "").trim();
    if (category) values.add(category);
  }
  return [{ value: "all", label: "All categories" }].concat(
    [...values]
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }))
      .map((value) => ({ value, label: value })),
  );
}
