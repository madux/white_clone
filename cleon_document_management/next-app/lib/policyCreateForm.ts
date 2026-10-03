/** Client-side policy create form state (Compliance + org flows). */

export type PolicyCreateFormState = {
  name: string;
  description: string;
  policy_type_id: string;
  document_type_ids: number[];
  applies_to: string;
  scope_ids: number[];
  schedule: string;
  custom_schedule_days: string;
  minimum_documents: string;
  grace_period_days: string;
  effective_date: string;
  allow_waiver: boolean;
  alert_schedule_days: string;
  escalate_manager_days: number;
  escalate_hr_days: number;
  auto_request_renewal: boolean;
  event_trigger: string;
  due_days: number;
  reminder_frequency_days: number;
  assigned_reviewer_id: string;
  audit_frequency: string;
  sample_pct: number;
  assigned_auditor_id: string;
  policy_category: string;
  lifecycle_status: string;
  active: boolean;
  policy_visibility: string;
  policy_audience: string;
  ai_drafted?: boolean;
};

export type PolicyReviewMeta = {
  sourceDocumentId?: number;
  sourceDocumentName?: string;
  unknownDocumentTypeNames?: string[];
  fieldNotes?: string[];
  aiSuggested?: boolean;
};

export function defaultPolicyForm(policyTypeId = ""): PolicyCreateFormState {
  return {
    name: "",
    description: "",
    policy_type_id: policyTypeId,
    document_type_ids: [],
    applies_to: "all",
    scope_ids: [],
    schedule: "monthly",
    custom_schedule_days: "30",
    minimum_documents: "1",
    grace_period_days: "0",
    effective_date: new Date().toISOString().slice(0, 10),
    allow_waiver: true,
    alert_schedule_days: "60,30,15,7,0",
    escalate_manager_days: 0,
    escalate_hr_days: 7,
    auto_request_renewal: true,
    event_trigger: "onboarding",
    due_days: 14,
    reminder_frequency_days: 3,
    assigned_reviewer_id: "",
    audit_frequency: "quarterly",
    sample_pct: 100,
    assigned_auditor_id: "",
    policy_category: "",
    lifecycle_status: "draft",
    active: false,
    policy_visibility: "employees",
    policy_audience: "everyone",
    ai_drafted: false,
  };
}

export function buildCreatePolicyPayload(form: PolicyCreateFormState) {
  const effectiveAppliesTo =
    form.applies_to === "all" || form.scope_ids.length === 0
      ? "all"
      : form.applies_to;

  return {
    ...form,
    policy_type_id: Number(form.policy_type_id),
    applies_to: effectiveAppliesTo,
    document_type_ids: form.document_type_ids,
    employee_ids:
      effectiveAppliesTo === "employee" ? form.scope_ids : [],
    department_ids:
      effectiveAppliesTo === "department" ? form.scope_ids : [],
    grade_ids: effectiveAppliesTo === "grade" ? form.scope_ids : [],
    custom_schedule_days: Number(form.custom_schedule_days),
    minimum_documents: Number(form.minimum_documents),
    grace_period_days: Number(form.grace_period_days),
    assigned_reviewer_id: form.assigned_reviewer_id
      ? Number(form.assigned_reviewer_id)
      : false,
    assigned_auditor_id: form.assigned_auditor_id
      ? Number(form.assigned_auditor_id)
      : false,
    escalate_manager_days: 0,
    lifecycle_status: "draft",
    active: false,
    policy_category: form.policy_category || "",
    policy_visibility: form.policy_visibility || "employees",
    policy_audience: form.policy_audience || "everyone",
    ai_drafted: Boolean(form.ai_drafted),
    schedule: form.schedule || false,
  };
}
