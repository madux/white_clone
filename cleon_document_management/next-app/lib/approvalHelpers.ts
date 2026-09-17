import { formatStatusLabel } from "./formatLabel";
import type { DocDocument } from "./types";

export function canReviewDocument(document: Pick<DocDocument, "can_review">) {
  return Boolean(document.can_review);
}

export function approvalDisplayLabel(
  document: Pick<
    DocDocument,
    | "approval_state"
    | "can_review"
    | "waiting_for_prior"
    | "current_approver_name"
    | "has_pending_revision"
  >,
) {
  if (document.has_pending_revision && document.approval_state === "pending") {
    return "Update pending approval";
  }
  if (document.approval_state === "approved") return "Approved";
  if (document.approval_state === "rejected") return "Rejected";
  if (document.can_review) return "Awaiting your approval";
  if (document.waiting_for_prior) {
    const name = document.current_approver_name;
    return name ? `Waiting for ${name}` : "Waiting for prior approval";
  }
  if (document.approval_state === "pending") return "Pending Approval";
  return formatStatusLabel(document.approval_state);
}
