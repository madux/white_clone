export function collectionMatchBadgeLabel(
  matchReason: string | undefined,
  query: string,
  documentName: string,
): string {
  const trimmed = query.trim();
  const nameLower = documentName.toLowerCase();
  const queryLower = trimmed.toLowerCase();
  if (matchReason === "exact" || (trimmed && nameLower.includes(queryLower))) {
    return trimmed ? `Exact match for "${trimmed}"` : "Exact match";
  }
  if (matchReason === "terms") {
    return trimmed ? `Matches "${trimmed}"` : "Matching terms";
  }
  if (matchReason === "project_keyword") {
    return `Contains "Project" in name`;
  }
  if (matchReason === "vendor_keyword") {
    return `Contains "Vendor" in name`;
  }
  return "Related library file";
}

export function formatDocumentFileSize(bytes?: number | null) {
  const size = Number(bytes || 0);
  if (!size) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
