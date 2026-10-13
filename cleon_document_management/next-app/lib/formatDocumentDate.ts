import { formatDmsDate, parseDmsDateValue } from "./dmsLocale";

/** Safe display date for API fields that may be false, null, or missing. */
export function formatDocumentDate(
  value: string | false | null | undefined,
  fallback = "—",
): string {
  return formatDmsDate(value, { fallback });
}

export function formatDocumentDateShort(
  value: string | false | null | undefined,
  fallback = "—",
): string {
  const parsed = parseDmsDateValue(value);
  if (!parsed) {
    if (typeof value === "string" && value.trim()) {
      return value.slice(0, 10);
    }
    return fallback;
  }
  return formatDmsDate(value, { fallback });
}
