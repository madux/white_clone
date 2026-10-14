import { validateComplianceRequestConfig } from "./complianceRequestTasks";
import { validateReviewScheduleConfig } from "./reviewSchedule";
import type { PolicyCreateFormState, PolicyReviewMeta } from "./policyCreateForm";
export type PolicyValidationResult = {
  canConfirm: boolean;
  missingFields: string[];
  warnings: string[];
};

export type PolicyWizardStep =
  | "basics"
  | "audience"
  | "requirements"
  | "timing"
  | "documents"
  | "verification";

function wizardStepForMissingField(
  message: string,
  typeCode: string,
): PolicyWizardStep {
  const lower = message.toLowerCase();
  if (message.endsWith(" name")) {
    return "basics";
  }
  // "Rule type" / "Policy type" only — not "…document type".
  if (
    message.endsWith(" type") &&
    !lower.includes("document type")
  ) {
    return "basics";
  }
  if (message.startsWith("Audience")) {
    return "audience";
  }
  if (
    message === "At least one required document type" ||
    message === "Resolve unknown document types" ||
    lower.includes("document type")
  ) {
    return typeCode === "document_requirement" ? "documents" : "requirements";
  }
  if (message === "Effective date") {
    return typeCode === "renewable_document" || typeCode === "retention"
      ? "basics"
      : "timing";
  }
  if (
    message.startsWith("Copies needed") ||
    message.startsWith("Grace period")
  ) {
    return "timing";
  }
  if (message.startsWith("Assigned reviewer (for verification)")) {
    return "verification";
  }
  return typeCode === "document_requirement" ? "documents" : "requirements";
}

export function validatePolicyWizardStep(
  step: PolicyWizardStep,
  form: PolicyCreateFormState,
  typeCode: string,
  reviewMeta?: PolicyReviewMeta,
  entity: "rule" | "policy" = "rule",
): string | null {
  const { missingFields } = validatePolicyCreateForm(
    form,
    typeCode,
    reviewMeta,
    entity,
  );
  const forStep = missingFields.filter(
    (field) => wizardStepForMissingField(field, typeCode) === step,
  );
  return forStep[0] ?? null;
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
  if (typeCode === "compliance_request") {
    const requestErrors = validateComplianceRequestConfig(
      form.request_tasks,
      {
        request_trigger: form.request_trigger,
        request_start_date: form.request_start_date,
        repeat_every_months: form.repeat_every_months,
        tasks_needed_mode: form.tasks_needed_mode as
          | "all_required"
          | "any_required"
          | "minimum_count",
        tasks_needed_minimum: form.tasks_needed_minimum,
        reopen_on_content_change: form.reopen_on_content_change,
      },
      form.due_days,
    );
    missingFields.push(...requestErrors);
  } else if (
    typeCode !== "retention" &&
    typeCode !== "review_schedule" &&
    !form.document_type_ids.length
  ) {
    missingFields.push("At least one required document type");
  } else if (typeCode === "retention" && !form.document_type_ids.length) {
    missingFields.push("At least one document type");
  } else if (typeCode === "review_schedule") {
    missingFields.push(...validateReviewScheduleConfig(form.review_milestones));
    if (!form.review_trigger) {
      missingFields.push("When reviews start");
    }
    if (
      form.review_reviewer_mode === "assigned_reviewer" &&
      !form.assigned_reviewer_id
    ) {
      missingFields.push("Assigned reviewer");
    }
  }
  if (!(form.effective_date || "").trim()) {
    missingFields.push("Effective date");
  }
  if (
    form.grace_period_enabled &&
    (!form.grace_period_days || Number(form.grace_period_days) < 1)
  ) {
    missingFields.push("Grace period (enter at least 1 day)");
  }
  if (
    (form.verification_document_type_ids?.length ?? 0) > 0 &&
    form.verified_by === "assigned_reviewer" &&
    !form.assigned_reviewer_id
  ) {
    missingFields.push("Assigned reviewer (for verification)");
  }
  if (
    typeCode !== "compliance_request" &&
    typeCode !== "retention" &&
    typeCode !== "review_schedule" &&
    typeCode !== "renewable_document" &&
    (!form.minimum_documents || Number(form.minimum_documents) < 1)
  ) {
    missingFields.push("Copies needed (minimum 1)");
  }

  if (typeCode === "retention") {
    if (!form.retention_action_mode) {
      missingFields.push("Retention action mode");
    }
    if (
      form.retention_action_mode === "owner_approval" &&
      (!form.retention_owner_notice_days || form.retention_owner_notice_days < 1)
    ) {
      missingFields.push("Owner notice days (at least 1)");
    }
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
