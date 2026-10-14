const STATUS_LABELS: Record<string, string> = {
  processing: "Processing",
  processing_failed: "Processing Failed",
  draft: "Draft",
  pending_review: "Pending Review",
  returned: "Returned",
  approved: "Approved",
  published: "Published",
  archived: "Archived",
  deleted: "Deleted",
};

const STATUS_VARIANTS: Record<string, string> = {
  processing: "processing",
  processing_failed: "failed",
  draft: "pending",
  pending_review: "pending",
  returned: "rejected",
  approved: "approved",
  published: "success",
  archived: "flagged",
  deleted: "failed",
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
  status?: string;
  processing_state?: string;
  approval_status?: string;
}): { label: string; variant: string } | null {
  if (media.status) {
    if (media.status === "published") return null;
    return {
      label: formatStatusLabel(media.status),
      variant: statusVariant(media.status),
    };
  }
  if (media.processing_state && media.processing_state !== "ready") {
    return {
      label: formatStatusLabel(media.processing_state),
      variant: statusVariant(media.processing_state),
    };
  }
  if (media.approval_status === "pending") {
    return { label: "Pending Review", variant: "pending" };
  }
  if (media.approval_status && media.approval_status !== "approved") {
    return {
      label: formatStatusLabel(media.approval_status),
      variant: statusVariant(media.approval_status),
    };
  }
  return null;
}
