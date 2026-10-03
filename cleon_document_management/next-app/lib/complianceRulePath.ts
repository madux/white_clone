/** Deep link to a compliance rule in Employee Files → Compliance. */
export function complianceRulePath(ruleId: number): string {
  return `/pages/employee?tab=compliance&rule=${ruleId}`;
}

/** @deprecated Use complianceRulePath */
export function compliancePolicyPath(ruleId: number): string {
  return complianceRulePath(ruleId);
}
