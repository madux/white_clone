"use client";

const STATUS_MAP: Record<string, { label: string; variant: string }> = {
  approved: { label: "Approved", variant: "approved" },
  pending: { label: "Pending", variant: "pending" },
  rejected: { label: "Rejected", variant: "rejected" },
  flagged: { label: "Flagged", variant: "flagged" },
  success: { label: "Success", variant: "success" },
  failed: { label: "Failed", variant: "failed" },
};

export function StatusBadge({ status }: { status: string }) {
  const mapped = STATUS_MAP[status] || { label: status, variant: "pending" };
  return <span className={`status-badge ${mapped.variant}`}>{mapped.label}</span>;
}
