import { parentFolderId } from "./organizationalFolderDetails";
import type { DocFolder } from "./types";

export type OrgLibraryKindFilter =
  | "all"
  | "documents"
  | "project"
  | "vendor"
  | "policy";

export type OrgLibraryStats = {
  folder_count: number;
  document_count: number;
  project_count: number;
  vendor_count: number;
  policy_count: number;
};

export function computeOrgLibraryStats(folders: DocFolder[]): OrgLibraryStats {
  const org = folders.filter((item) => item.folder_type === "organizational");
  let document_count = 0;
  let project_count = 0;
  let vendor_count = 0;
  let policy_count = 0;
  for (const folder of org) {
    document_count += folder.document_count ?? 0;
    const kind = folder.folder_kind || "folder";
    if (kind === "project") project_count += 1;
    else if (kind === "vendor") vendor_count += 1;
    else if (kind === "policy") policy_count += 1;
  }
  return {
    folder_count: org.length,
    document_count,
    project_count,
    vendor_count,
    policy_count,
  };
}

export function filterOrgFoldersByKind(
  folders: DocFolder[],
  filter: OrgLibraryKindFilter,
): DocFolder[] {
  const org = folders.filter((item) => item.folder_type === "organizational");
  if (filter === "all") return org;
  if (filter === "documents") {
    return org.filter((item) => (item.document_count ?? 0) > 0);
  }
  return org.filter((item) => (item.folder_kind || "folder") === filter);
}

export function orgFolderHref(folderId: number, basePath = "/pages/organization") {
  if (basePath.includes("/folder")) {
    return `${basePath}?folder=${folderId}`;
  }
  return `${basePath}?folder=${folderId}`;
}

export function orgFoldersInTree(
  folders: DocFolder[],
  parentId: number,
  kindFilter: OrgLibraryKindFilter,
) {
  const filtered = filterOrgFoldersByKind(folders, kindFilter);
  const ids = new Set(filtered.map((item) => item.id));
  return folders
    .filter(
      (item) =>
        item.folder_type === "organizational" &&
        parentFolderId(item) === parentId &&
        (kindFilter === "all" || ids.has(item.id) || hasDescendantInSet(item.id, folders, ids)),
    )
    .sort((a, b) =>
      a.folder_name.localeCompare(b.folder_name, undefined, { sensitivity: "base" }),
    );
}

function hasDescendantInSet(
  folderId: number,
  folders: DocFolder[],
  allowed: Set<number>,
): boolean {
  const children = folders.filter(
    (item) =>
      item.folder_type === "organizational" && parentFolderId(item) === folderId,
  );
  return children.some(
    (child) => allowed.has(child.id) || hasDescendantInSet(child.id, folders, allowed),
  );
}
