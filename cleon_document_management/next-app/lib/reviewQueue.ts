import { myWorkspaceHref, type WorkspaceTabId } from "./workspaceRoutes";

export type ReviewQueueSection = "compliance" | "employee" | "org";

export const REVIEW_QUEUE_TAB: WorkspaceTabId = "review-queue";

export const DEFAULT_REVIEW_QUEUE_SECTION: ReviewQueueSection = "compliance";

export const VERIFICATION_REJECTION_REASONS: {
  value: string;
  label: string;
}[] = [
  { value: "illegible", label: "Illegible" },
  { value: "wrong_document", label: "Wrong document" },
  { value: "expired", label: "Expired" },
  { value: "details_mismatch", label: "Details do not match" },
  { value: "incomplete", label: "Incomplete" },
  { value: "other", label: "Other" },
];

export function reviewQueueHref(section: ReviewQueueSection = DEFAULT_REVIEW_QUEUE_SECTION) {
  return myWorkspaceHref(REVIEW_QUEUE_TAB, { section });
}

export function parseReviewQueueSection(
  value: string | null,
): ReviewQueueSection {
  if (value === "compliance" || value === "employee" || value === "org") {
    return value;
  }
  if (value === "all") {
    return DEFAULT_REVIEW_QUEUE_SECTION;
  }
  return DEFAULT_REVIEW_QUEUE_SECTION;
}
