/** Safe display date for API fields that may be false, null, or missing. */
export function formatDocumentDate(
  value: string | false | null | undefined,
  fallback = "—",
): string {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return value.length >= 10 ? value.slice(0, 10) : fallback;
  }
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(parsed);
}

export function formatDocumentDateShort(
  value: string | false | null | undefined,
  fallback = "—",
): string {
  if (typeof value !== "string" || !value.trim()) {
    return fallback;
  }
  return value.slice(0, 10);
}
