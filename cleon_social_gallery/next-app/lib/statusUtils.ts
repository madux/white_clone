const STATUS_LABELS: Record<string, string> = {
  approved: "Approved",
  pending: "Pending",
  rejected: "Rejected",
  flagged: "Flagged",
  scheduled: "Scheduled",
  draft: "Draft",
  success: "Success",
  failed: "Failed",
  processing: "Processing",
  uploading: "Uploading",
  ready: "Ready",
  "pending review": "Pending Review",
  pending_review: "Pending Review",
};

const STATUS_VARIANTS: Record<string, string> = {
  approved: "approved",
  success: "success",
  ready: "approved",
  pending: "pending",
  "pending review": "pending",
  pending_review: "pending",
  scheduled: "scheduled",
  rejected: "rejected",
  failed: "failed",
  flagged: "flagged",
  processing: "processing",
  uploading: "uploading",
  draft: "pending",
};

export function formatStatusLabel(status?: string | null): string {
  if (!status) return "";
  const normalized = status.trim().toLowerCase();
  if (STATUS_LABELS[normalized]) return STATUS_LABELS[normalized];
  return status
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function statusVariant(status?: string | null): string {
  if (!status) return "pending";
  const normalized = status.trim().toLowerCase();
  return STATUS_VARIANTS[normalized] || normalized.replace(/\s+/g, "-");
}

export function mediaStatusInfo(media: {
  processing_state?: string;
  approval_status?: string;
}): { label: string; variant: string } | null {
  if (media.processing_state && media.processing_state !== "ready") {
    return {
      label: formatStatusLabel(media.processing_state),
      variant: statusVariant(media.processing_state),
    };
  }
  if (media.approval_status === "pending") {
    return { label: "Pending Review", variant: "pending" };
  }
  if (media.approval_status) {
    return {
      label: formatStatusLabel(media.approval_status),
      variant: statusVariant(media.approval_status),
    };
  }
  return null;
}
