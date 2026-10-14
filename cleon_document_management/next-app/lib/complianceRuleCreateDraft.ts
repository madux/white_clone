import {
  COMPLIANCE_RULE_DRAFT_STORAGE_KEY,
  COMPLIANCE_RULE_CREATE_DRAFT_KEY,
} from "./complianceRuleCreatePath";
import { clearSessionFormDraft } from "./sessionFormDraft";

/** Clears any persisted compliance rule-create session data (legacy + current). */
export function clearComplianceRuleCreateDraft(): void {
  clearSessionFormDraft(COMPLIANCE_RULE_CREATE_DRAFT_KEY);
  try {
    sessionStorage.removeItem(COMPLIANCE_RULE_DRAFT_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
