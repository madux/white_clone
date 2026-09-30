import type { LibraryFileRow } from "../src/app/components/LibraryFileTable";

export type LibrarySortField =
  | "name"
  | "description"
  | "documents"
  | "owner"
  | "modified";

export function toggleLibrarySortKey(
  current: string,
  field: LibrarySortField,
): string {
  const asc = `${field} asc`;
  const desc = `${field} desc`;
  return current === asc ? desc : asc;
}

export function sortMark(sortKey: string, field: LibrarySortField) {
  const [active, direction] = (sortKey || "").trim().split(/\s+/, 2);
  if (active !== field) return "";
  return direction === "desc" ? " ↓" : " ↑";
}

function parseModified(raw: string | undefined) {
  if (!raw?.trim()) return 0;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const ts = Date.parse(normalized);
  return Number.isNaN(ts) ? 0 : ts;
}

function documentsValue(row: LibraryFileRow) {
  const value = row.documentsCount;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export function compareLibraryFileRows(
  left: LibraryFileRow,
  right: LibraryFileRow,
  sortKey: string,
): number {
  const trimmed = (sortKey || "name asc").trim();
  const space = trimmed.lastIndexOf(" ");
  const field = space > 0 ? trimmed.slice(0, space) : trimmed;
  const direction = space > 0 ? trimmed.slice(space + 1) : "asc";
  const desc = direction === "desc";
  const factor = desc ? -1 : 1;

  const compareText = (a: string, b: string) =>
    a.localeCompare(b, undefined, { sensitivity: "base", numeric: true });

  let result = 0;
  switch (field) {
    case "description":
      result = compareText(left.description || "", right.description || "");
      break;
    case "documents":
      result = documentsValue(left) - documentsValue(right);
      break;
    case "owner":
      result = compareText(left.owner || "", right.owner || "");
      break;
    case "modified":
      result =
        parseModified(left.modifiedRaw || left.modified) -
        parseModified(right.modifiedRaw || right.modified);
      break;
    case "name":
    default:
      result = compareText(left.name, right.name);
      break;
  }
  return result * factor;
}

export function sortLibraryFileRows(
  rows: LibraryFileRow[],
  sortKey: string,
): LibraryFileRow[] {
  return [...rows].sort((left, right) => compareLibraryFileRows(left, right, sortKey));
}

/** Maps legacy toolbar sort to column sort key. */
export function libraryToolbarSortToKey(
  sortBy: "name" | "modified",
): string {
  return sortBy === "modified" ? "modified desc" : "name asc";
}
