"use client";

import { Badge } from "@/components/ui/badge";
import { formatStatusLabel } from "../../../lib/formatLabel";

export type StatusTone =
  | "neutral"
  | "ok"
  | "pending"
  | "attention"
  | "danger"
  | "draft"
  | "info"
  | "missing"
  | "locked";

function toneFromLabel(label: string): StatusTone {
  const value = label.trim().toLowerCase();
  if (["lock"].some((key) => value.includes(key))) return "locked";
  if (
    ["ok", "active", "approved", "synced", "acknowledged", "complete", "compliant"].some(
      (key) => value.includes(key),
    ) &&
    !value.includes("non")
  ) {
    return "ok";
  }
  if (["draft"].some((key) => value.includes(key))) return "draft";
  if (
    ["pending", "processing", "awaiting", "submitted", "queued"].some((key) =>
      value.includes(key),
    )
  ) {
    return "pending";
  }
  if (["running", "info"].some((key) => value.includes(key))) return "info";
  if (["missing", "incomplete"].some((key) => value.includes(key))) return "missing";
  if (
    ["fail", "reject", "error", "expired", "inactive", "non-compliant", "non_compliant"].some(
      (key) => value.includes(key),
    )
  ) {
    return "danger";
  }
  if (
    ["attention", "expir", "unresolved", "warning", "partial", "excepted"].some((key) =>
      value.includes(key),
    )
  ) {
    return "attention";
  }
  return "neutral";
}

/** Format raw API status tokens; leave already-friendly phrases unchanged. */
function pillDisplayLabel(label: string): string {
  const trimmed = label.trim();
  if (!trimmed) return trimmed;
  if (/\d/.test(trimmed) && /\s/.test(trimmed)) {
    return trimmed;
  }
  if (/_/.test(trimmed) || /^[a-z][a-z0-9_-]*$/i.test(trimmed)) {
    return formatStatusLabel(trimmed, trimmed);
  }
  return trimmed;
}

function badgeVariant(
  tone: StatusTone,
):
  | "secondary"
  | "outline"
  | "destructive"
  | "default"
  | "success"
  | "warning"
  | "caution"
  | "info"
  | "muted"
  | "locked" {
  if (tone === "ok") return "success";
  if (tone === "danger") return "destructive";
  if (tone === "pending") return "warning";
  if (tone === "attention") return "caution";
  if (tone === "missing") return "caution";
  if (tone === "info") return "info";
  if (tone === "draft") return "muted";
  if (tone === "locked") return "locked";
  return "muted";
}

export default function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone?: StatusTone;
}) {
  if (!label) return <span>—</span>;
  const display = pillDisplayLabel(label);
  return (
    <Badge variant={badgeVariant(tone ?? toneFromLabel(display))}>{display}</Badge>
  );
}
