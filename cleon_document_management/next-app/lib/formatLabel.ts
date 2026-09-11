const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  inactive: "Inactive",
  approved: "Approved",
  rejected: "Rejected",
  pending: "Pending",
  draft: "Draft",
  processing: "Processing",
  expired: "Expired",
  missing: "Missing",
  archived: "Archived",
  not_required: "Not Required",
  pending_review: "Pending Review",
  pending_approval: "Pending Approval",
  awaiting_folder: "Awaiting Folder",
  awaiting_folder_restore: "Awaiting Restore",
  non_compliant: "Non-Compliant",
  compliant: "Compliant",
  partial: "Partial",
  grace: "Grace Period",
  complete: "Complete",
  queued: "Queued",
  running: "Running",
  paused: "Paused",
  failed: "Failed",
  cancelled: "Cancelled",
  completed: "Completed",
  needs_review: "Needs Review",
  manual: "Manual",
  automatic: "Automatic",
  scheduled: "Scheduled",
  all_staff: "All Staff",
  department: "Department",
  grade: "Grade",
  individual: "Individual",
  admin_only: "Admin Only",
  fast: "Fast",
  balanced: "Balanced",
  conservative: "Conservative",
  external: "External",
  organizational: "Organizational",
  employee: "Employee",
  deactivated: "Inactive",
  one_time: "One Time",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

function titleCaseWord(word: string) {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/** Format snake_case / kebab-case API values for display. */
export function formatStatusLabel(
  value?: string | null,
  fallback = "Unknown",
): string {
  if (!value) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (STATUS_LABELS[normalized]) return STATUS_LABELS[normalized];
  return normalized
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map(titleCaseWord)
    .join(" ");
}

/** Alias for non-status enum fields that use the same shape. */
export function formatFieldLabel(
  value?: string | null,
  fallback = "—",
): string {
  return formatStatusLabel(value, fallback);
}
