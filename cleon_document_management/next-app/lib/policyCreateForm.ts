/** Client-side policy create form state (Compliance + org flows). */

import {
  defaultRequestSchedule,
  type ComplianceRequestTaskDefinition,
} from "./complianceRequestTasks";
import type { ReviewMilestoneDefinition } from "./reviewSchedule";
import {
  buildScopePayload,
  emptyPolicyScope,
  type PolicyScopeState,
} from "./policyScope";

export type PolicyCreateFormState = {
  name: string;
  description: string;
  policy_type_id: string;
  document_type_ids: number[];
  applies_to: string;
  scope: PolicyScopeState;
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
  request_trigger: string;
  request_start_date: string;
  repeat_every_months: number;
  tasks_needed_mode: string;
  tasks_needed_minimum: number;
  reopen_on_content_change: boolean;
  request_tasks: ComplianceRequestTaskDefinition[];
  retention_action_mode: string;
  retention_owner_notice_days: number;
  review_trigger: string;
  review_start_date: string;
  review_reviewer_mode: string;
  review_completion_mode: string;
  review_completion_minimum: number;
  review_overdue_mode: string;
  review_milestones: ReviewMilestoneDefinition[];
  verified_by: string;
  verification_sla_days: number;
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
    scope: emptyPolicyScope(),
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
    ...defaultRequestSchedule(),
    request_tasks: [],
    retention_action_mode: "report_only",
    retention_owner_notice_days: 14,
    review_trigger: "employee_start",
    review_start_date: "",
    review_reviewer_mode: "line_manager",
    review_completion_mode: "all_scheduled",
    review_completion_minimum: 1,
    review_overdue_mode: "after_grace",
    review_milestones: [],
    verified_by: "hr_admin",
    verification_sla_days: 3,
  };
}

export function buildCreatePolicyPayload(form: PolicyCreateFormState) {
  const scopePayload =
    form.applies_to === "all"
      ? { ...buildScopePayload(emptyPolicyScope()), applies_to: "all" as const }
      : buildScopePayload(form.scope);

  return {
    ...form,
    policy_type_id: Number(form.policy_type_id),
    applies_to: scopePayload.applies_to,
    document_type_ids: form.document_type_ids,
    department_ids: scopePayload.department_ids,
    grade_ids: scopePayload.grade_ids,
    employee_ids: scopePayload.employee_ids,
    work_location_ids: scopePayload.work_location_ids,
    employment_type_ids: scopePayload.employment_type_ids,
    branch_ids: scopePayload.branch_ids,
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
    request_trigger: form.request_trigger,
    request_start_date: form.request_start_date || false,
    repeat_every_months: form.repeat_every_months,
    tasks_needed_mode: form.tasks_needed_mode,
    tasks_needed_minimum: form.tasks_needed_minimum,
    reopen_on_content_change: form.reopen_on_content_change,
    request_tasks: form.request_tasks,
    retention_action_mode: form.retention_action_mode || "report_only",
    retention_owner_notice_days: form.retention_owner_notice_days || 0,
    review_trigger: form.review_trigger,
    review_start_date: form.review_start_date || false,
    review_reviewer_mode: form.review_reviewer_mode,
    review_completion_mode: form.review_completion_mode,
    review_completion_minimum: form.review_completion_minimum,
    review_overdue_mode: form.review_overdue_mode,
    review_milestones: form.review_milestones,
    verified_by: form.verified_by || "hr_admin",
    verification_sla_days: form.verification_sla_days || 3,
  };
}
