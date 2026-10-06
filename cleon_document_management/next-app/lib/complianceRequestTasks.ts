export type ComplianceRequestTaskType =
  | "read"
  | "acknowledge"
  | "declaration"
  | "upload_evidence"
  | "complete_form";

import type { PolicyScopeState } from "./policyScope";

export type ComplianceLinkableContentItem = {
  kind: "org_policy" | "document";
  id: number;
  name: string;
  document_id: number;
  folder_id: number;
  folder_name: string;
  access_summary?: string;
};

export type ComplianceLinkableContext = {
  policyId?: number;
  applies_to: string;
  scope: PolicyScopeState;
};

export type ComplianceRequestTaskDefinition = {
  id?: number;
  sequence?: number;
  name: string;
  instructions?: string;
  task_type: ComplianceRequestTaskType;
  requirement: "required" | "optional";
  linked_org_policy_id?: number;
  linked_org_policy_name?: string;
  linked_document_id?: number;
  linked_document_name?: string;
  declaration_text?: string;
  evidence_document_type_id?: number;
  linked_form_id?: number;
};

export type ComplianceRequestScheduleState = {
  request_trigger: string;
  request_start_date: string;
  repeat_every_months: number;
  tasks_needed_mode: "all_required" | "any_required" | "minimum_count";
  tasks_needed_minimum: number;
  reopen_on_content_change: boolean;
};

export const REQUEST_TRIGGER_LABELS: Record<string, string> = {
  policy_effective: "Policy effective date",
  employee_start: "Employee start date",
  joined_scope: "Joined scope",
  people_change: "Role / department / location change",
  specific_date: "Specific date",
  recurring: "Recurring schedule",
};

export const TASK_TYPE_LABELS: Record<ComplianceRequestTaskType, string> = {
  read: "Read",
  acknowledge: "Acknowledge",
  declaration: "Declaration",
  upload_evidence: "Upload evidence",
  complete_form: "Complete form",
};

export function emptyRequestTask(): ComplianceRequestTaskDefinition {
  return {
    name: "",
    instructions: "",
    task_type: "acknowledge",
    requirement: "required",
  };
}

export function defaultRequestSchedule(): ComplianceRequestScheduleState {
  return {
    request_trigger: "policy_effective",
    request_start_date: "",
    repeat_every_months: 0,
    tasks_needed_mode: "all_required",
    tasks_needed_minimum: 1,
    reopen_on_content_change: true,
  };
}

export function validateRequestTask(task: ComplianceRequestTaskDefinition): string | null {
  if (!task.name.trim()) return "Task name is required.";
  if (task.task_type === "declaration" && !task.declaration_text?.trim()) {
    return "Declaration tasks need a statement.";
  }
  if (
    (task.task_type === "read" || task.task_type === "acknowledge") &&
    !task.linked_org_policy_id &&
    !task.linked_document_id
  ) {
    return "Link organizational content or a document.";
  }
  if (task.task_type === "upload_evidence" && !task.evidence_document_type_id) {
    return "Select an evidence document type.";
  }
  if (task.task_type === "complete_form" && !task.linked_form_id) {
    return "Select a published form.";
  }
  return null;
}

export function validateComplianceRequestConfig(
  tasks: ComplianceRequestTaskDefinition[],
  schedule: ComplianceRequestScheduleState,
  dueDays: number,
): string[] {
  const errors: string[] = [];
  if (!tasks.length) errors.push("Add at least one task.");
  if (!tasks.some((task) => task.requirement === "required")) {
    errors.push("Add at least one required task.");
  }
  tasks.forEach((task, index) => {
    const message = validateRequestTask(task);
    if (message) errors.push(`Task ${index + 1}: ${message}`);
  });
  if (!schedule.request_trigger) errors.push("Select when this request starts.");
  if (schedule.request_trigger === "specific_date" && !schedule.request_start_date) {
    errors.push("Specific date trigger requires a start date.");
  }
  if (schedule.request_trigger === "recurring") {
    if (!schedule.request_start_date) errors.push("Recurring requests need a start date.");
    if (!schedule.repeat_every_months || schedule.repeat_every_months < 1) {
      errors.push("Recurring requests need a repeat interval.");
    } else if (dueDays >= schedule.repeat_every_months * 30) {
      errors.push("Due within must be shorter than the repeat period.");
    }
  }
  if (
    schedule.tasks_needed_mode === "minimum_count" &&
    schedule.tasks_needed_minimum < 1
  ) {
    errors.push("Minimum tasks needed must be at least 1.");
  }
  return errors;
}
