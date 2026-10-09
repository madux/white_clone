/** Multi-dimension compliance policy audience (AND across non-empty dimensions). */

export type PolicyScopeState = {
  department_ids: number[];
  grade_ids: number[];
  work_location_ids: number[];
  employment_type_ids: number[];
  branch_ids: number[];
  employee_ids: number[];
};

export const POLICY_SCOPE_KEYS: (keyof PolicyScopeState)[] = [
  "department_ids",
  "grade_ids",
  "work_location_ids",
  "employment_type_ids",
  "branch_ids",
  "employee_ids",
];

export function emptyPolicyScope(): PolicyScopeState {
  return {
    department_ids: [],
    grade_ids: [],
    work_location_ids: [],
    employment_type_ids: [],
    branch_ids: [],
    employee_ids: [],
  };
}

export function hasPolicyScopeFilters(scope: PolicyScopeState): boolean {
  return POLICY_SCOPE_KEYS.some((key) => scope[key].length > 0);
}

export function policyScopeFromApi(policy: {
  applies_to?: string;
  department_ids?: number[];
  grade_ids?: number[];
  work_location_ids?: number[];
  employment_type_ids?: number[];
  branch_ids?: number[];
  employee_ids?: number[];
}): PolicyScopeState {
  const scope = emptyPolicyScope();
  scope.department_ids = [...(policy.department_ids ?? [])];
  scope.grade_ids = [...(policy.grade_ids ?? [])];
  scope.work_location_ids = [...(policy.work_location_ids ?? [])];
  scope.employment_type_ids = [...(policy.employment_type_ids ?? [])];
  scope.branch_ids = [...(policy.branch_ids ?? [])];
  scope.employee_ids = [...(policy.employee_ids ?? [])];

  const applies = policy.applies_to || "all";
  if (applies === "department" && scope.department_ids.length === 0) {
    scope.department_ids = [...(policy.department_ids ?? [])];
  }
  if (applies === "grade" && scope.grade_ids.length === 0) {
    scope.grade_ids = [...(policy.grade_ids ?? [])];
  }
  if (applies === "employee" && scope.employee_ids.length === 0) {
    scope.employee_ids = [...(policy.employee_ids ?? [])];
  }
  return scope;
}

export function buildScopePayload(
  scope: PolicyScopeState,
  appliesTo?: string,
) {
  const filtered = hasPolicyScopeFilters(scope);
  const applies_to = filtered
    ? "filtered"
    : appliesTo === "filtered"
      ? "filtered"
      : "all";
  return {
    applies_to,
    department_ids: scope.department_ids,
    grade_ids: scope.grade_ids,
    work_location_ids: scope.work_location_ids,
    employment_type_ids: scope.employment_type_ids,
    branch_ids: scope.branch_ids,
    employee_ids: scope.employee_ids,
  };
}

export type PolicyScopeTargets = {
  departments?: { id: number; name: string }[];
  grades?: { id: number; name: string }[];
  locations?: { id: number; name: string }[];
  employment_types?: { id: number; name: string }[];
  branches?: { id: number; name: string }[];
  employees?: {
    id: number;
    name: string;
    department?: string;
    department_id?: number | false;
    grade_id?: number | false;
    job_title?: string;
    work_email?: string;
    work_location_id?: number | false;
    employment_type_id?: number | false;
    branch_id?: number | false;
  }[];
};

const SCOPE_LABELS: Record<keyof PolicyScopeState, string> = {
  department_ids: "Departments",
  grade_ids: "Grades",
  work_location_ids: "Work locations",
  employment_type_ids: "Employment types",
  branch_ids: "Business units",
  employee_ids: "Individuals",
};

export function formatPolicyScopeSummary(
  scope: PolicyScopeState,
  targets?: PolicyScopeTargets,
): string[] {
  if (!hasPolicyScopeFilters(scope)) {
    return ["All employees"];
  }
  const lines: string[] = [];
  const lookup = (
    key: keyof PolicyScopeState,
    items: { id: number; name: string }[] | undefined,
  ) => {
    const ids = scope[key];
    if (!ids.length) return;
    const names = ids
      .map((id) => items?.find((row) => row.id === id)?.name || `#${id}`)
      .join(", ");
    lines.push(`${SCOPE_LABELS[key]}: ${names}`);
  };
  lookup("department_ids", targets?.departments);
  lookup("grade_ids", targets?.grades);
  lookup("work_location_ids", targets?.locations);
  lookup("employment_type_ids", targets?.employment_types);
  lookup("branch_ids", targets?.branches);
  if (scope.employee_ids.length) {
    const names = scope.employee_ids
      .map(
        (id) =>
          targets?.employees?.find((row) => row.id === id)?.name || `#${id}`,
      )
      .join(", ");
    lines.push(`${SCOPE_LABELS.employee_ids}: ${names}`);
  }
  return lines;
}

export function toggleScopeId(
  scope: PolicyScopeState,
  key: keyof PolicyScopeState,
  id: number,
): PolicyScopeState {
  const current = scope[key];
  const next = current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id];
  return { ...scope, [key]: next };
}

export function removeScopeId(
  scope: PolicyScopeState,
  key: keyof PolicyScopeState,
  id: number,
): PolicyScopeState {
  return {
    ...scope,
    [key]: scope[key].filter((item) => item !== id),
  };
}

/** Client-side estimate matching server AND logic across scope dimensions. */
export function countEmployeesInPolicyScope(
  scope: PolicyScopeState,
  targets?: PolicyScopeTargets,
): number {
  const employees = targets?.employees ?? [];
  if (!hasPolicyScopeFilters(scope)) {
    return employees.length;
  }
  return employees.filter((employee) =>
    employeeMatchesPolicyScope(employee, scope),
  ).length;
}

export function employeeMatchesPolicyScope(
  employee: NonNullable<PolicyScopeTargets["employees"]>[number],
  scope: PolicyScopeState,
): boolean {
  if (scope.department_ids.length) {
    const deptId = employee.department_id || false;
    if (!deptId || !scope.department_ids.includes(deptId)) {
      return false;
    }
  }
  if (scope.grade_ids.length) {
    const gradeId = employee.grade_id || false;
    if (!gradeId || !scope.grade_ids.includes(gradeId)) {
      return false;
    }
  }
  if (scope.work_location_ids.length) {
    const locId = employee.work_location_id || false;
    if (!locId || !scope.work_location_ids.includes(locId)) {
      return false;
    }
  }
  if (scope.employment_type_ids.length) {
    const typeId = employee.employment_type_id || false;
    if (!typeId || !scope.employment_type_ids.includes(typeId)) {
      return false;
    }
  }
  if (scope.branch_ids.length) {
    const branchId = employee.branch_id || false;
    if (!branchId || !scope.branch_ids.includes(branchId)) {
      return false;
    }
  }
  if (scope.employee_ids.length && !scope.employee_ids.includes(employee.id)) {
    return false;
  }
  return true;
}
