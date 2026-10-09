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

export type ComplianceLinkableTreeFolder = {
  id: number;
  name: string;
  folder_kind: string;
  has_children: boolean;
  path?: string;
  org_policy_id: number | false;
  org_policy_name: string;
  disabled_reason: string;
};

export type ComplianceLinkableTreeDocument = {
  id: number;
  name: string;
  folder_id: number;
  folder_name: string;
  mime_type?: string;
  path?: string;
  eligible: boolean;
  reason: string;
  /** Set when this file is the policy's primary document. */
  org_policy_id: number | false;
  org_policy_name: string;
};

export type ComplianceLinkableTreeLevel = {
  folders: ComplianceLinkableTreeFolder[];
  documents: ComplianceLinkableTreeDocument[];
};

/** One picked file; `key` is `doc:<id>` (or `policy:<id>` for legacy policy links). */
export type ComplianceContentSelection = {
  key: string;
  name: string;
  document_id?: number;
  org_policy_id?: number;
  org_policy_name?: string;
  folder_id?: number;
  folder_name?: string;
};

export const MAX_LINKED_CONTENT_SELECTION = 50;

export function selectionFromTreeDocument(
  document: ComplianceLinkableTreeDocument,
): ComplianceContentSelection {
  return {
    key: `doc:${document.id}`,
    name: document.name,
    document_id: document.id,
    org_policy_id: document.org_policy_id || undefined,
    org_policy_name: document.org_policy_name || undefined,
    folder_id: document.folder_id,
    folder_name: document.folder_name,
  };
}

export function selectionFromTask(
  task: ComplianceRequestTaskDefinition,
): ComplianceContentSelection | null {
  if (task.linked_org_policy_id) {
    return {
      key: `policy:${task.linked_org_policy_id}`,
      name: task.linked_org_policy_name || "Policy",
      org_policy_id: task.linked_org_policy_id,
      org_policy_name: task.linked_org_policy_name,
      folder_id: task.source_folder_id || undefined,
      folder_name: task.source_folder_name,
    };
  }
  if (task.linked_document_id) {
    return {
      key: `doc:${task.linked_document_id}`,
      name: task.linked_document_name || "Document",
      document_id: task.linked_document_id,
      folder_id: task.source_folder_id || undefined,
      folder_name: task.source_folder_name,
    };
  }
  return null;
}

/** Policy primaries link via the policy so new policy versions reopen the task. */
export function applySelectionToTask(
  task: ComplianceRequestTaskDefinition,
  item: ComplianceContentSelection,
): ComplianceRequestTaskDefinition {
  const viaPolicy = Boolean(item.org_policy_id);
  return {
    ...task,
    linked_org_policy_id: viaPolicy ? item.org_policy_id : undefined,
    linked_org_policy_name: viaPolicy ? item.org_policy_name || item.name : undefined,
    linked_document_id: viaPolicy ? undefined : item.document_id,
    linked_document_name: viaPolicy ? undefined : item.name,
    source_folder_id: item.folder_id,
    source_folder_name: item.folder_name,
  };
}

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
  source_folder_id?: number;
  source_folder_name?: string;
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
