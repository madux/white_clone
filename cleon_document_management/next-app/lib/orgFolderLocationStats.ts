import type { DocFolder } from "./types";
import { parentFolderId } from "./organizationalFolderDetails";

export function orgRootDirectoryStats(folders: DocFolder[]) {
  const org = folders.filter((item) => item.folder_type === "organizational");
  const roots = org.filter((item) => !parentFolderId(item));
  const fileCount = roots.reduce((sum, item) => sum + (item.document_count ?? 0), 0);
  const subdirectoryCount = roots.length;
  return { fileCount, subdirectoryCount };
}

export function orgFolderDirectChildFolderCount(
  folderId: number,
  folders: DocFolder[],
) {
  return folders.filter(
    (item) =>
      item.folder_type === "organizational" && parentFolderId(item) === folderId,
  ).length;
}
