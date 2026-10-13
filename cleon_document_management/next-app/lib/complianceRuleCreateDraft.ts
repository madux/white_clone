import type { PolicyCreateFormState, PolicyReviewMeta } from "./policyCreateForm";
import {
  COMPLIANCE_RULE_DRAFT_STORAGE_KEY,
  COMPLIANCE_RULE_CREATE_DRAFT_KEY,
} from "./complianceRuleCreatePath";
import {
  clearSessionFormDraft,
  readSessionFormDraft,
  writeSessionFormDraft,
} from "./sessionFormDraft";

export type ComplianceRuleCreateSessionDraft = {
  v: 2;
  policyForm: PolicyCreateFormState;
  reviewMeta?: PolicyReviewMeta;
  configureStep: "configure" | "review";
  wizardStep: number;
  ai: {
    name: string;
    description: string;
    policyTypeId: string;
    documentTypeIds: number[];
  };
};

function readLegacyAiHandoff(): ComplianceRuleCreateSessionDraft | null {
  try {
    const raw = sessionStorage.getItem(COMPLIANCE_RULE_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      form: PolicyCreateFormState;
      reviewMeta?: PolicyReviewMeta;
      initialStep: "configure" | "review";
    };
    sessionStorage.removeItem(COMPLIANCE_RULE_DRAFT_STORAGE_KEY);
    return {
      v: 2,
      policyForm: parsed.form,
      reviewMeta: parsed.reviewMeta,
      configureStep: parsed.initialStep,
      wizardStep: parsed.initialStep === "review" ? 3 : 0,
      ai: {
        name: "",
        description: "",
        policyTypeId: "",
        documentTypeIds: [],
      },
    };
  } catch {
    return null;
  }
}

export function readComplianceRuleCreateDraft(): ComplianceRuleCreateSessionDraft | null {
  const current = readSessionFormDraft<ComplianceRuleCreateSessionDraft>(
    COMPLIANCE_RULE_CREATE_DRAFT_KEY,
  );
  if (current?.v === 2) return current;
  return readLegacyAiHandoff();
}

export function writeComplianceRuleCreateDraft(
  draft: ComplianceRuleCreateSessionDraft,
): void {
  writeSessionFormDraft(COMPLIANCE_RULE_CREATE_DRAFT_KEY, draft);
}

export function clearComplianceRuleCreateDraft(): void {
  clearSessionFormDraft(COMPLIANCE_RULE_CREATE_DRAFT_KEY);
  sessionStorage.removeItem(COMPLIANCE_RULE_DRAFT_STORAGE_KEY);
}
