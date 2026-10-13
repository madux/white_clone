/** Deep link to a compliance rule on the Compliance page. */
export function complianceRulePath(ruleId: number): string {
  return `/pages/compliance?rule=${ruleId}`;
}

/** Full-page flow to create a new compliance rule. */
export { complianceRuleCreatePath, COMPLIANCE_RULE_CREATE_BASE } from "./complianceRuleCreatePath";

/** @deprecated Use complianceRulePath */
export function compliancePolicyPath(ruleId: number): string {
  return complianceRulePath(ruleId);
}
