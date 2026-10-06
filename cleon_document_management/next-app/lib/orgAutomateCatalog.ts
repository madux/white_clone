export const ORG_AUTOMATION_TRIGGERS = [
  { value: "document_updated", label: "Document updated" },
  { value: "new_version", label: "New version uploaded" },
  { value: "document_approved", label: "Document approved" },
  { value: "document_rejected", label: "Document rejected" },
  { value: "document_signed", label: "Document signed" },
  { value: "approaching_expiry", label: "Approaching expiry" },
  { value: "expired", label: "Expired" },
];

export const ORG_AUTOMATION_ACTIONS = [
  { value: "notify_owner", label: "Notify owner" },
  { value: "notify_audience", label: "Notify audience" },
  { value: "archive", label: "Archive document" },
];

export const ORG_AUTOMATION_CONDITIONS = [
  { value: "always", label: "No extra condition" },
  { value: "doc_active", label: "Document is active" },
  { value: "approval_approved", label: "Approval is approved" },
  { value: "approval_not_pending", label: "Approval not pending" },
  { value: "approval_rejected", label: "Approval rejected" },
  { value: "has_expiry_date", label: "Has expiry date set" },
  { value: "expiry_in_warning_window", label: "Expiry within 14 days" },
  { value: "expiry_passed", label: "Expiry date reached" },
  { value: "not_on_legal_hold", label: "Not on legal hold" },
  { value: "signature_completed", label: "Signature completed" },
  { value: "owner_has_login", label: "Owner has a user account" },
] as const;

export type OrgAutomationCondition = (typeof ORG_AUTOMATION_CONDITIONS)[number]["value"];

const AUTOMATION_CONDITION_MATRIX: Record<
  string,
  Record<string, readonly OrgAutomationCondition[]>
> = {
  document_updated: {
    notify_owner: [
      "always",
      "doc_active",
      "approval_approved",
      "approval_not_pending",
      "not_on_legal_hold",
      "owner_has_login",
    ],
    notify_audience: [
      "always",
      "doc_active",
      "approval_approved",
      "approval_not_pending",
      "not_on_legal_hold",
    ],
    archive: ["always", "doc_active", "approval_approved", "not_on_legal_hold"],
  },
  new_version: {
    notify_owner: [
      "always",
      "doc_active",
      "approval_approved",
      "not_on_legal_hold",
      "owner_has_login",
    ],
    notify_audience: ["always", "doc_active", "approval_approved", "not_on_legal_hold"],
    archive: ["always", "doc_active", "not_on_legal_hold"],
  },
  document_approved: {
    notify_owner: ["always", "doc_active", "owner_has_login"],
    notify_audience: ["always", "doc_active"],
    archive: ["always", "doc_active", "not_on_legal_hold"],
  },
  document_rejected: {
    notify_owner: ["always", "doc_active", "approval_rejected", "owner_has_login"],
    notify_audience: ["always", "doc_active", "approval_rejected"],
    archive: ["always", "doc_active", "not_on_legal_hold"],
  },
  document_signed: {
    notify_owner: ["always", "doc_active", "signature_completed", "owner_has_login"],
    notify_audience: ["always", "doc_active", "signature_completed"],
    archive: ["always", "doc_active", "signature_completed", "not_on_legal_hold"],
  },
  approaching_expiry: {
    notify_owner: [
      "always",
      "doc_active",
      "has_expiry_date",
      "expiry_in_warning_window",
      "not_on_legal_hold",
      "owner_has_login",
    ],
    notify_audience: [
      "always",
      "doc_active",
      "has_expiry_date",
      "expiry_in_warning_window",
      "not_on_legal_hold",
    ],
    archive: [
      "always",
      "doc_active",
      "has_expiry_date",
      "expiry_in_warning_window",
      "not_on_legal_hold",
    ],
  },
  expired: {
    notify_owner: [
      "always",
      "expiry_passed",
      "doc_active",
      "not_on_legal_hold",
      "owner_has_login",
    ],
    notify_audience: ["always", "expiry_passed", "doc_active", "not_on_legal_hold"],
    archive: ["always", "expiry_passed", "not_on_legal_hold"],
  },
};

export function automationConditionsFor(trigger: string, action: string) {
  const keys =
    AUTOMATION_CONDITION_MATRIX[trigger]?.[action] ?? (["always"] as const);
  const keySet = new Set(keys);
  return ORG_AUTOMATION_CONDITIONS.filter((item) => keySet.has(item.value));
}

export function defaultAutomationCondition(trigger: string, action: string): string {
  if (action === "archive") {
    const options = automationConditionsFor(trigger, action);
    if (options.some((item) => item.value === "not_on_legal_hold")) {
      return "not_on_legal_hold";
    }
  }
  return "always";
}

export function isValidAutomationTriple(
  trigger: string,
  action: string,
  condition: string,
) {
  const allowed = automationConditionsFor(trigger, action);
  return allowed.some((item) => item.value === condition);
}

export function automationTriggerLabel(value: string) {
  return ORG_AUTOMATION_TRIGGERS.find((item) => item.value === value)?.label ?? value;
}

export function automationActionLabel(value: string) {
  return ORG_AUTOMATION_ACTIONS.find((item) => item.value === value)?.label ?? value;
}

export function automationConditionLabel(value: string) {
  return (
    ORG_AUTOMATION_CONDITIONS.find((item) => item.value === value)?.label ?? value
  );
}
