import type { PolicyReviewMeta } from "./policyCreateForm";
import {
  validatePolicyCreateForm,
  type PolicyWizardStep,
} from "./policyCreateValidation";

export type PolicyWizardFieldId =
  | "name"
  | "policy_type_id"
  | "audience"
  | "document_type_ids"
  | "effective_date"
  | "minimum_documents"
  | "grace_period_days"
  | "request_tasks"
  | "requirements";

function wizardStepForMissingField(
  message: string,
  typeCode: string,
): PolicyWizardStep {
  const lower = message.toLowerCase();
  if (message.endsWith(" name")) {
    return "basics";
  }
  if (message.endsWith(" type") && !lower.includes("document type")) {
    return "basics";
  }
  if (message.startsWith("Audience")) {
    return "audience";
  }
  if (
    message === "At least one required document type" ||
    message === "At least one document type" ||
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
  if (
    message.startsWith("Add at least") ||
    message.startsWith("Task ") ||
    message.startsWith("Select when") ||
    message.startsWith("Specific date") ||
    message.startsWith("Recurring") ||
    message.startsWith("Due within must") ||
    message.startsWith("Minimum tasks") ||
    message.startsWith("When reviews") ||
    message.startsWith("Assigned reviewer") ||
    message.startsWith("Retention")
  ) {
    return "requirements";
  }
  return typeCode === "document_requirement" ? "documents" : "requirements";
}

export function policyFieldIdForValidationMessage(
  message: string,
  entity: "rule" | "policy",
): PolicyWizardFieldId {
  const cap = entity === "policy" ? "Policy" : "Rule";
  if (message === `${cap} name`) return "name";
  if (message === `${cap} type`) return "policy_type_id";
  if (message.startsWith("Audience")) return "audience";
  if (
    message === "At least one required document type" ||
    message === "At least one document type" ||
    message === "Resolve unknown document types"
  ) {
    return "document_type_ids";
  }
  if (message === "Effective date") return "effective_date";
  if (message.startsWith("Copies needed")) return "minimum_documents";
  if (message.startsWith("Grace period")) return "grace_period_days";
  return "requirements";
}

export function friendlyPolicyFieldMessage(
  message: string,
  entity: "rule" | "policy",
): string {
  const cap = entity === "policy" ? "Policy" : "Rule";
  const lower = entity === "policy" ? "policy" : "rule";
  if (message === `${cap} name`) {
    return `Enter a ${lower} name.`;
  }
  if (message === `${cap} type`) {
    return `Select a ${lower} type.`;
  }
  if (message.startsWith("Audience")) {
    return "Select who this rule applies to.";
  }
  if (message === "At least one required document type") {
    return "Select at least one document type.";
  }
  if (message === "At least one document type") {
    return "Select at least one document type.";
  }
  if (message === "Effective date") {
    return "Choose an effective date.";
  }
  if (message.startsWith("Copies needed")) {
    return "Enter how many copies are required (at least 1).";
  }
  if (message === "Resolve unknown document types") {
    return "Resolve unknown document types before continuing.";
  }
  return message.endsWith(".") ? message : `${message}.`;
}

export function fieldErrorsForWizardStep(
  step: PolicyWizardStep,
  form: Parameters<typeof validatePolicyCreateForm>[0],
  typeCode: string,
  reviewMeta?: PolicyReviewMeta,
  entity: "rule" | "policy" = "rule",
): Partial<Record<PolicyWizardFieldId, string>> {
  const { missingFields } = validatePolicyCreateForm(
    form,
    typeCode,
    reviewMeta,
    entity,
  );
  const errors: Partial<Record<PolicyWizardFieldId, string>> = {};
  for (const message of missingFields) {
    if (wizardStepForMissingField(message, typeCode) !== step) continue;
    const fieldId = policyFieldIdForValidationMessage(message, entity);
    const text = friendlyPolicyFieldMessage(message, entity);
    if (!errors[fieldId]) {
      errors[fieldId] = text;
    } else if (fieldId === "requirements" && errors.requirements !== text) {
      errors.requirements = `${errors.requirements} ${text}`;
    }
  }
  return errors;
}

export function fieldErrorsFromMissingFields(
  missingFields: string[],
  entity: "rule" | "policy",
): Partial<Record<PolicyWizardFieldId, string>> {
  const errors: Partial<Record<PolicyWizardFieldId, string>> = {};
  for (const message of missingFields) {
    const fieldId = policyFieldIdForValidationMessage(message, entity);
    const text = friendlyPolicyFieldMessage(message, entity);
    errors[fieldId] = errors[fieldId] ? `${errors[fieldId]} ${text}` : text;
  }
  return errors;
}
