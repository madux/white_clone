export const COMPLIANCE_RULE_CREATE_BASE = "/pages/compliance/rules/new";

export function complianceRuleCreatePath(
  flow?: "wizard" | "ai",
  query?: Record<string, string>,
): string {
  const params = new URLSearchParams();
  if (flow) params.set("flow", flow);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `${COMPLIANCE_RULE_CREATE_BASE}?${qs}` : COMPLIANCE_RULE_CREATE_BASE;
}

/** @deprecated AI handoff only; use COMPLIANCE_RULE_CREATE_DRAFT_KEY */
export const COMPLIANCE_RULE_DRAFT_STORAGE_KEY = "cleon.compliance.rule.draft.v1";

export const COMPLIANCE_RULE_CREATE_DRAFT_KEY = "compliance/rules/new";
