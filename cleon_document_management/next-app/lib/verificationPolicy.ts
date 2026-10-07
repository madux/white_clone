export const VERIFIED_BY_LABELS: Record<string, string> = {
  line_manager: "Line manager",
  hr_admin: "HR administrator",
  policy_owner: "Policy owner",
  assigned_reviewer: "Assigned reviewer",
};

export const VERIFIED_BY_OPTIONS = Object.entries(VERIFIED_BY_LABELS).map(
  ([value, label]) => ({ value, label }),
);
