import type { PolicyCreateFormState, PolicyReviewMeta } from "./policyCreateForm";

export type PolicyValidationResult = {
  canConfirm: boolean;
  missingFields: string[];
  warnings: string[];
};

function requiresScope(appliesTo: string) {
  return appliesTo === "department" || appliesTo === "grade" || appliesTo === "employee";
}

export function validatePolicyCreateForm(
  form: PolicyCreateFormState,
  typeCode: string,
  reviewMeta?: PolicyReviewMeta,
  entity: "rule" | "policy" = "rule",
): PolicyValidationResult {
  const missingFields: string[] = [];
  const warnings: string[] = [];
  const cap = entity === "policy" ? "Policy" : "Rule";
  const lower = entity === "policy" ? "policy" : "rule";

  if (!(form.name || "").trim()) {
    missingFields.push(`${cap} name`);
  }
  if (!form.policy_type_id) {
    missingFields.push(`${cap} type`);
  }
  if (!form.document_type_ids.length) {
    missingFields.push("At least one required document type");
  }
  if (!(form.effective_date || "").trim()) {
    missingFields.push("Effective date");
  }
  if (!form.minimum_documents || Number(form.minimum_documents) < 1) {
    missingFields.push("Copies needed (minimum 1)");
  }

  const appliesTo =
    form.applies_to === "all" || form.scope_ids.length === 0
      ? "all"
      : form.applies_to;
  if (requiresScope(appliesTo) && form.scope_ids.length === 0) {
    missingFields.push(`Scope (select who this ${lower} applies to)`);
  }

  if (typeCode === "compliance_request" && !form.assigned_reviewer_id) {
    missingFields.push("Assigned reviewer");
  }
  if (typeCode === "retention" && !form.assigned_auditor_id) {
    missingFields.push("Assigned auditor");
  }

  const unknown = reviewMeta?.unknownDocumentTypeNames ?? [];
  if (unknown.length) {
    warnings.push(
      `Map or replace unknown document types suggested by AI: ${unknown.join(", ")}`,
    );
    missingFields.push("Resolve unknown document types");
  }

  return {
    canConfirm: missingFields.length === 0,
    missingFields,
    warnings,
  };
}
