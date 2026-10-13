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

/** Policy types that do not use document verification / verifier SLA settings. */
export function policyTypeUsesVerification(typeCode: string): boolean {
  return (
    typeCode !== "review_schedule" && typeCode !== "compliance_request"
  );
}

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
  if (typeCode === "compliance_request") {
    return [];
  }
  const ids = new Set<number>(form.document_type_ids);
  return documentTypes.filter(
    (type) =>
      ids.has(type.id) &&
      type.require_upload_approval &&
      // Older payloads omit the flag; the backend derives it from upload approval by default.
      (type.verification_required ?? true),
  );
}
