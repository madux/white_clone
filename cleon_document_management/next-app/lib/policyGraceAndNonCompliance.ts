export const NON_COMPLIANCE_MODE_LABELS: Record<string, string> = {
  after_due: "After due date",
  after_grace: "After grace period",
  never: "Never automatically",
};

export type NonComplianceMode = keyof typeof NON_COMPLIANCE_MODE_LABELS;

export function nonComplianceModeOptions(gracePeriodEnabled: boolean) {
  return (Object.entries(NON_COMPLIANCE_MODE_LABELS) as [NonComplianceMode, string][]).map(
    ([value, label]) => ({
      value,
      label,
      disabled: value === "after_grace" && !gracePeriodEnabled,
    }),
  );
}

export function coerceNonComplianceMode(
  mode: string | undefined,
  gracePeriodEnabled: boolean,
): NonComplianceMode {
  if (mode === "never" || mode === "after_due") {
    return mode;
  }
  if (gracePeriodEnabled && mode === "after_grace") {
    return "after_grace";
  }
  return gracePeriodEnabled ? "after_grace" : "after_due";
}

export function policyGraceFieldsFromApi(policy: {
  grace_period_days?: number;
  grace_period_enabled?: boolean;
  non_compliance_mode?: string;
}) {
  const enabled =
    policy.grace_period_enabled ?? (policy.grace_period_days ?? 0) > 0;
  return {
    grace_period_enabled: enabled,
    grace_period_days: String(
      enabled ? Math.max(1, policy.grace_period_days ?? 1) : 0,
    ),
    non_compliance_mode: coerceNonComplianceMode(
      policy.non_compliance_mode,
      enabled,
    ),
  };
}

/** Renewable rules use document expiry only — no policy grace period. */
export const RENEWABLE_POLICY_GRACE_PAYLOAD = {
  grace_period_enabled: false,
  grace_period_days: 0,
  non_compliance_mode: "after_due" as const,
};

export function graceDaysFromForm(
  gracePeriodEnabled: boolean,
  gracePeriodDays: string | number,
): number {
  if (!gracePeriodEnabled) {
    return 0;
  }
  return Math.max(1, Number(gracePeriodDays) || 0);
}
