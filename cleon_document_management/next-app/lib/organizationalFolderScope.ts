export const ORGANIZATIONAL_SCOPE_RANK: Record<string, number> = {
  all_staff: 0,
  department: 1,
  business_unit: 1,
  grade: 1,
  role: 1,
  employment_type: 1,
  location: 1,
  individual: 2,
  private: 3,
  company_owned: 3,
  admin_only: 4,
};

export type OrgVisibilityMode =
  | "public"
  | "restricted"
  | "private"
  | "company_owned"
  | "admin_only";

export function allowedVisibilityModes(parentScope?: string): OrgVisibilityMode[] {
  if (!parentScope || parentScope === "all_staff") {
    return ["public", "restricted", "private", "company_owned"];
  }
  if (parentScope === "admin_only") return ["admin_only"];
  if (parentScope === "private") return ["private"];
  if (parentScope === "company_owned") return ["company_owned", "private", "admin_only"];
  return ["restricted", "private", "company_owned"];
}

export function allowedAccessScopes(parentScope?: string): string[] {
  if (!parentScope || parentScope === "all_staff") {
    return [
      "all_staff",
      "department",
      "grade",
      "individual",
      "private",
      "company_owned",
      "admin_only",
    ];
  }
  if (parentScope === "admin_only") return ["admin_only"];
  if (parentScope === "private") return ["private", "company_owned", "admin_only"];
  if (parentScope === "company_owned") {
    return ["company_owned", "private", "admin_only"];
  }
  if (parentScope === "department") {
    return ["department", "individual", "private", "company_owned", "admin_only"];
  }
  if (parentScope === "grade") {
    return ["grade", "individual", "private", "company_owned", "admin_only"];
  }
  if (parentScope === "individual") {
    return ["individual", "private", "company_owned", "admin_only"];
  }
  return [parentScope, "individual", "private", "company_owned", "admin_only"].filter(
    (value, index, list) => list.indexOf(value) === index,
  );
}

export function coerceVisibilityMode(
  mode: OrgVisibilityMode,
  parentScope?: string,
): OrgVisibilityMode {
  const allowed = allowedVisibilityModes(parentScope);
  return allowed.includes(mode) ? mode : allowed[0];
}

export function coerceAccessScope(scope: string, parentScope?: string): string {
  const allowed = allowedAccessScopes(parentScope);
  return allowed.includes(scope) ? scope : allowed[0];
}
