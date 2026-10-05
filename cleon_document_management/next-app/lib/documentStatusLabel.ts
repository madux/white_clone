import { approvalDisplayLabel } from "./approvalHelpers";
import { formatStatusLabel } from "./formatLabel";
import type { DocDocument } from "./types";

/** Human-readable document status for employee / org lists and pills. */
export function documentStatusDisplayLabel(
  document: Pick<
    DocDocument,
    | "approval_state"
    | "state"
    | "active"
    | "can_review"
    | "waiting_for_prior"
    | "current_approver_name"
    | "has_pending_revision"
  >,
): string {
  if (
    document.approval_state &&
    document.approval_state !== "not_required"
  ) {
    return approvalDisplayLabel(document);
  }
  if (document.state) {
    return formatStatusLabel(document.state);
  }
  if (document.active === false) {
    return formatStatusLabel("inactive");
  }
  return formatStatusLabel("active");
}
