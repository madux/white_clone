import {
  coerceEffectiveDate,
  coercePolicyAppliesTo,
  coercePolicyAuditFrequency,
  coercePolicyEventTrigger,
  coercePolicySchedule,
} from "./policyFieldCoercion";
import {
  defaultPolicyForm,
  type PolicyCreateFormState,
  type PolicyReviewMeta,
} from "./policyCreateForm";

export type PolicyAiProposal = {
  name?: string;
  description?: string;
  policy_type_id?: number | false;
  policy_type_code?: string;
  document_type_ids?: number[];
  unknown_document_type_names?: string[];
  applies_to?: string;
  schedule?: string | false;
  custom_schedule_days?: number;
  minimum_documents?: number;
  grace_period_days?: number;
  effective_date?: string;
  event_trigger?: string;
  due_days?: number;
  reminder_frequency_days?: number;
  audit_frequency?: string;
  sample_pct?: number;
  field_notes?: string[];
};

export function proposalToForm(
  proposal: PolicyAiProposal,
  base?: PolicyCreateFormState,
): PolicyCreateFormState {
  const form = base ? { ...base } : defaultPolicyForm();
  if (proposal.name) form.name = proposal.name;
  if (proposal.description) form.description = proposal.description;
  if (proposal.policy_type_id) {
    form.policy_type_id = String(proposal.policy_type_id);
  }
  if (proposal.document_type_ids?.length) {
    form.document_type_ids = [...proposal.document_type_ids];
  }
  if (proposal.applies_to) {
    form.applies_to = coercePolicyAppliesTo(proposal.applies_to);
  }
  if (proposal.schedule !== undefined) {
    form.schedule = coercePolicySchedule(proposal.schedule);
  }
  if (proposal.custom_schedule_days != null) {
    form.custom_schedule_days = String(proposal.custom_schedule_days);
  }
  if (proposal.minimum_documents != null) {
    form.minimum_documents = String(proposal.minimum_documents);
  }
  if (proposal.grace_period_days != null) {
    form.grace_period_days = String(proposal.grace_period_days);
  }
  if (proposal.effective_date) {
    form.effective_date = coerceEffectiveDate(proposal.effective_date);
  }
  if (proposal.event_trigger) {
    form.event_trigger = coercePolicyEventTrigger(proposal.event_trigger);
  }
  if (proposal.due_days != null) form.due_days = proposal.due_days;
  if (proposal.reminder_frequency_days != null) {
    form.reminder_frequency_days = proposal.reminder_frequency_days;
  }
  if (proposal.audit_frequency) {
    form.audit_frequency = coercePolicyAuditFrequency(proposal.audit_frequency);
  }
  if (proposal.sample_pct != null) form.sample_pct = proposal.sample_pct;
  form.lifecycle_status = "draft";
  form.active = false;
  form.ai_drafted = true;
  return form;
}

export function reviewMetaFromProposal(
  proposal: PolicyAiProposal,
  extra?: PolicyReviewMeta,
): PolicyReviewMeta {
  return {
    ...extra,
    unknownDocumentTypeNames: proposal.unknown_document_type_names ?? [],
    aiSuggested: true,
  };
}
