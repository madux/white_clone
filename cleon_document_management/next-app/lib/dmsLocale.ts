export type DmsDateFormatKey = "d_mmm_yyyy" | "dd_mm_yyyy" | "yyyy_mm_dd";

export type DmsLocaleSnapshot = {
  dateFormat: DmsDateFormatKey;
  timeZone: string;
  language: string;
};

const DEFAULT_SNAPSHOT: DmsLocaleSnapshot = {
  dateFormat: "d_mmm_yyyy",
  timeZone: "UTC",
  language: "en_GB",
};

let snapshot: DmsLocaleSnapshot = { ...DEFAULT_SNAPSHOT };

export function getDmsLocaleSnapshot(): DmsLocaleSnapshot {
  return snapshot;
}

export function setDmsLocaleSnapshot(partial: Partial<DmsLocaleSnapshot>) {
  snapshot = { ...snapshot, ...partial };
}

export function parseDmsDateValue(
  value: string | false | null | undefined,
): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T12:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const normalized = trimmed.includes("T") ? trimmed : trimmed.replace(" ", "T");
  const hasZone =
    normalized.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(normalized);
  const parsed = new Date(hasZone ? normalized : `${normalized}Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function dateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return map;
}

function monthShort(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    month: "short",
  }).format(date);
}

export function formatDmsDate(
  value: string | false | null | undefined,
  options?: Partial<DmsLocaleSnapshot> & { fallback?: string },
): string {
  const fallback = options?.fallback ?? "—";
  const parsed = parseDmsDateValue(value);
  if (!parsed) {
    if (typeof value === "string" && value.trim()) {
      return value.length >= 10 ? value.slice(0, 10) : fallback;
    }
    return fallback;
  }
  const locale = {
    ...getDmsLocaleSnapshot(),
    ...options,
  };
  const { year, month, day } = dateParts(parsed, locale.timeZone);
  const monthLabel = monthShort(parsed, locale.timeZone);
  if (locale.dateFormat === "dd_mm_yyyy") {
    return `${day}/${month}/${year}`;
  }
  if (locale.dateFormat === "yyyy_mm_dd") {
    return `${year}-${month}-${day}`;
  }
  return `${day} ${monthLabel} ${year}`;
}

export function formatDmsDateTime(
  value: string | false | null | undefined,
  options?: Partial<DmsLocaleSnapshot> & { fallback?: string; showUtc?: boolean },
): string {
  const fallback = options?.fallback ?? "—";
  const parsed = parseDmsDateValue(value);
  if (!parsed) return typeof value === "string" && value.trim() ? value : fallback;
  const locale = {
    ...getDmsLocaleSnapshot(),
    ...options,
  };
  const dateLabel = formatDmsDate(value, locale);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: locale.timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsed);
  if (!options?.showUtc) {
    return `${dateLabel}, ${time}`;
  }
  const utc = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsed);
  return `${dateLabel}, ${time} (${utc} UTC)`;
}
