import type { PolicyCreateFormState } from "./policyCreateForm";
import type { DocumentType } from "./types";

export const VERIFIED_BY_LABELS: Record<string, string> = {
  line_manager: "Line manager",
  hr_admin: "HR administrator",
  policy_owner: "Policy owner",
  assigned_reviewer: "Assigned reviewer",
};

export const VERIFIED_BY_OPTIONS = Object.entries(VERIFIED_BY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const VERIFIER_PHRASES: Record<string, string> = {
  line_manager: "each employee's line manager",
  hr_admin: "an HR administrator",
  policy_owner: "the policy owner",
  assigned_reviewer: "the assigned reviewer",
};

export function verifierPhrase(verifiedBy: string) {
  return VERIFIER_PHRASES[verifiedBy] || VERIFIER_PHRASES.hr_admin;
}

export const APPROVAL_FLOW_LABELS: Record<string, string> = {
  any: "Single approver",
  sequential: "Sequential",
  random: "All approvers",
};

/**
 * Document types in this policy whose own upload approvers stop applying: when a type
 * requires verification, the policy's verifier handles its uploads instead.
 */
export function approverHandoffTypes(
  form: Pick<PolicyCreateFormState, "document_type_ids" | "request_tasks">,
  typeCode: string,
  documentTypes: DocumentType[] | undefined,
): DocumentType[] {
  if (
    !documentTypes?.length ||
    typeCode === "review_schedule" ||
    typeCode === "retention"
  ) {
    return [];
  }
  const ids = new Set<number>(
    typeCode === "compliance_request"
      ? form.request_tasks
          .filter((task) => task.task_type === "upload_evidence")
          .map((task) => Number(task.evidence_document_type_id || 0))
          .filter(Boolean)
      : form.document_type_ids,
  );
  return documentTypes.filter(
    (type) =>
      ids.has(type.id) &&
      type.require_upload_approval &&
      // Older payloads omit the flag; the backend derives it from upload approval by default.
      (type.verification_required ?? true),
  );
}
