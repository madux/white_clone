import type { DocFolder } from "./types";

type FolderNode = Pick<
  DocFolder,
  "id" | "folder_name" | "folder_type" | "parent_id"
>;

export function parentFolderId(
  folder: Pick<DocFolder, "parent_id"> | FolderNode,
) {
  const raw = folder.parent_id as number | false | { id?: number } | undefined;
  if (!raw) return 0;
  if (typeof raw === "object") return Number(raw.id || 0);
  return Number(raw);
}

export function folderLocationPath(
  folderId: number,
  folders: FolderNode[],
  rootLabel = "Organizational Files",
) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const parts: string[] = [];
  let current = byId.get(folderId);
  const seen = new Set<number>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    parts.unshift(current.folder_name);
    const parentId = parentFolderId(current);
    current = parentId ? byId.get(parentId) : undefined;
  }
  if (rootLabel) parts.unshift(rootLabel);
  return parts.join(" / ");
}

export function directFolderItemCount(
  folderId: number,
  folders: Array<Pick<DocFolder, "id" | "parent_id" | "folder_type" | "document_count">>,
) {
  const folder = folders.find((item) => item.id === folderId);
  if (!folder) return 0;
  const subfolders = folders.filter(
    (item) =>
      item.folder_type === folder.folder_type &&
      parentFolderId(item) === folderId,
  ).length;
  return (folder.document_count ?? 0) + subfolders;
}

export function folderKindLabel(kind?: DocFolder["folder_kind"]) {
  if (kind === "project") return "Project";
  if (kind === "vendor") return "Vendor";
  return "Folder";
}
