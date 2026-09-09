"use client";

import { formatStatusLabel, statusVariant } from "@/lib/statusUtils";

const STATUS_MAP: Record<string, { label: string; variant: string }> = {
  approved: { label: "Approved", variant: "approved" },
  pending: { label: "Pending", variant: "pending" },
  rejected: { label: "Rejected", variant: "rejected" },
  flagged: { label: "Flagged", variant: "flagged" },
  scheduled: { label: "Scheduled", variant: "scheduled" },
  draft: { label: "Draft", variant: "pending" },
  success: { label: "Success", variant: "success" },
  failed: { label: "Failed", variant: "failed" },
  processing: { label: "Processing", variant: "processing" },
  uploading: { label: "Uploading", variant: "uploading" },
  ready: { label: "Ready", variant: "approved" },
  "pending review": { label: "Pending Review", variant: "pending" },
};

export function StatusBadge({ status }: { status: string }) {
  const key = (status || "").trim().toLowerCase();
  const mapped = STATUS_MAP[key] || {
    label: formatStatusLabel(status),
    variant: statusVariant(status),
  };
  return <span className={`status-badge ${mapped.variant}`}>{mapped.label}</span>;
}
