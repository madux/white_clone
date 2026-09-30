/** Parse React-managed table sort keys like `attention desc`. */
export function parseSortKey(sortKey: string): { field: string; desc: boolean } {
  const trimmed = (sortKey || "name asc").trim();
  const space = trimmed.lastIndexOf(" ");
  if (space <= 0) {
    return { field: trimmed, desc: false };
  }
  const field = trimmed.slice(0, space);
  const direction = trimmed.slice(space + 1).toLowerCase();
  return { field, desc: direction === "desc" };
}

export function toggleTableSortKey(sortKey: string, field: string): string {
  const { field: active, desc } = parseSortKey(sortKey);
  if (active === field) {
    return `${field} ${desc ? "asc" : "desc"}`;
  }
  return `${field} asc`;
}

export function tableSortMark(sortKey: string, field: string): string {
  const { field: active, desc } = parseSortKey(sortKey);
  if (active !== field) return "";
  return desc ? " ↓" : " ↑";
}
