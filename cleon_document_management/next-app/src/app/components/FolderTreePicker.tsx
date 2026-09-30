"use client";

import { Folder } from "lucide-react";
import { useMemo } from "react";
import type { DocFolder } from "../../../lib/types";

type FolderNode = Pick<
  DocFolder,
  "id" | "folder_name" | "folder_type" | "parent_id" | "collection_code"
>;

function parentFolderId(folder: FolderNode) {
  const raw = folder.parent_id as number | false | { id?: number } | undefined;
  if (!raw) return 0;
  if (typeof raw === "object") return Number(raw.id || 0);
  return Number(raw);
}

export function folderIdsWithDescendants(folders: FolderNode[], ids: number[]) {
  const children = new Map<number, number[]>();
  folders.forEach((folder) => {
    const parentId = parentFolderId(folder);
    if (!parentId) return;
    const list = children.get(parentId) ?? [];
    list.push(folder.id);
    children.set(parentId, list);
  });
  const found = new Set(ids);
  const stack = [...ids];
  while (stack.length) {
    const id = stack.pop()!;
    for (const child of children.get(id) ?? []) {
      if (!found.has(child)) {
        found.add(child);
        stack.push(child);
      }
    }
  }
  return [...found];
}

export default function FolderTreePicker({
  folders,
  excludeIds = [],
  value,
  onChange,
  allowRoot = false,
  folderType = "organizational",
}: {
  folders: FolderNode[];
  excludeIds?: number[];
  value: number | false | "";
  onChange: (id: number | false) => void;
  allowRoot?: boolean;
  folderType?: "organizational" | "employee";
}) {
  const destinations = useMemo(
    () =>
      folders.filter(
        (folder) =>
          folder.folder_type === folderType &&
          !excludeIds.includes(folder.id),
      ),
    [excludeIds, folderType, folders],
  );
  const childrenOf = useMemo(() => {
    const map = new Map<number, typeof destinations>();
    destinations.forEach((folder) => {
      const parentId = parentFolderId(folder);
      const list = map.get(parentId) ?? [];
      list.push(folder);
      map.set(parentId, list);
    });
    map.forEach((list) =>
      list.sort((left, right) =>
        left.folder_name.localeCompare(right.folder_name, undefined, {
          sensitivity: "base",
        }),
      ),
    );
    return map;
  }, [destinations]);
  const destIds = useMemo(
    () => new Set(destinations.map((folder) => folder.id)),
    [destinations],
  );
  const roots = destinations.filter((folder) => {
    const parentId = parentFolderId(folder);
    return !parentId || !destIds.has(parentId);
  });

  const renderNode = (folder: (typeof destinations)[number], depth: number) => {
    const children = childrenOf.get(folder.id) ?? [];
    const selected = value === folder.id;
    return (
      <div key={folder.id}>
        <button
          type="button"
          onClick={() => onChange(folder.id)}
          className={`flex w-full items-center gap-2 rounded-lg py-1.5 pr-2 text-left text-sm font-medium ${
            selected ? "bg-pink-50 text-brand-pink" : "hover:bg-slate-50"
          }`}
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          <Folder className="h-4 w-4 shrink-0" />
          <span className="truncate">
            {folder.folder_name}
            {folder.collection_code ? (
              <span className="ml-1 text-xs font-normal text-slate-400">
                {folder.collection_code}
              </span>
            ) : null}
          </span>
        </button>
        {children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 p-1">
      {allowRoot ? (
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`mb-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium ${
            value === false ? "bg-pink-50 text-brand-pink" : "hover:bg-slate-50"
          }`}
        >
          Library root
        </button>
      ) : null}
      {roots.length ? (
        roots.map((folder) => renderNode(folder, 0))
      ) : (
        <p className="px-3 py-4 text-sm text-slate-500">No folders available.</p>
      )}
    </div>
  );
}
