import {
  AUDIT_FREQUENCY_LABELS,
  EVENT_TRIGGER_LABELS,
} from "./complianceCopy";

export const POLICY_APPLIES_TO = ["all", "department", "grade", "employee"] as const;

export const POLICY_SCHEDULES = [
  "manual",
  "one_time",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "semi_annually",
  "annually",
  "custom",
] as const;

const EVENT_TRIGGER_CODES = Object.keys(EVENT_TRIGGER_LABELS);
const AUDIT_FREQUENCY_CODES = Object.keys(AUDIT_FREQUENCY_LABELS);

function normalizeToken(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function pickFromAllowed(
  raw: string | undefined | null,
  allowed: readonly string[],
  fallback: string,
  labelMap?: Record<string, string>,
) {
  if (!raw?.trim()) return fallback;
  const trimmed = raw.trim();
  if (allowed.includes(trimmed)) return trimmed;
  const token = normalizeToken(trimmed);
  if (allowed.includes(token)) return token;
  const lower = trimmed.toLowerCase();
  for (const code of allowed) {
    if (lower.includes(code.replace(/_/g, " ")) || lower.includes(code)) {
      return code;
    }
  }
  if (labelMap) {
    for (const [code, label] of Object.entries(labelMap)) {
      const labelLower = label.toLowerCase();
      if (lower === labelLower || lower.includes(labelLower) || labelLower.includes(lower)) {
        return code;
      }
    }
  }
  return fallback;
}

export function coercePolicyEventTrigger(value?: string | null) {
  return pickFromAllowed(
    value,
    EVENT_TRIGGER_CODES,
    "onboarding",
    EVENT_TRIGGER_LABELS,
  );
}

export function coercePolicyAuditFrequency(value?: string | null) {
  return pickFromAllowed(
    value,
    AUDIT_FREQUENCY_CODES,
    "quarterly",
    AUDIT_FREQUENCY_LABELS,
  );
}

export function coercePolicyAppliesTo(value?: string | null) {
  return pickFromAllowed(value, POLICY_APPLIES_TO, "all");
}

export function coercePolicySchedule(value?: string | false | null) {
  if (value === false || value === null || value === undefined) return "";
  const stringValue = String(value);
  const picked = pickFromAllowed(stringValue, POLICY_SCHEDULES, "monthly");
  return picked === "manual" ? "" : picked;
}

export function coerceEffectiveDate(value?: string | null) {
  if (!value?.trim()) return "";
  const iso = value.trim().match(/\d{4}-\d{2}-\d{2}/);
  return iso ? iso[0] : "";
}
