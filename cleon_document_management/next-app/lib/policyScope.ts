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

export function appliesToFromPolicyScope(
  scope: PolicyScopeState,
): "all" | "filtered" {
  return hasPolicyScopeFilters(scope) ? "filtered" : "all";
}

export function buildScopePayload(scope: PolicyScopeState) {
  const applies_to = appliesToFromPolicyScope(scope);
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

export function addScopeId(
  scope: PolicyScopeState,
  key: keyof PolicyScopeState,
  id: number,
): PolicyScopeState {
  if (scope[key].includes(id)) {
    return scope;
  }
  return { ...scope, [key]: [...scope[key], id] };
}

/** Select a department/grade/etc. and drop redundant individual picks for that group. */
export function pickScopeDimension(
  scope: PolicyScopeState,
  key: keyof PolicyScopeState,
  id: number,
  targets?: PolicyScopeTargets,
): PolicyScopeState {
  if (key === "employee_ids") {
    return addScopeId(scope, key, id);
  }
  const members = listEmployeesInScopeDimension(key, id, targets);
  const memberIds = new Set(members.map((row) => row.id));
  const next = addScopeId(scope, key, id);
  return {
    ...next,
    employee_ids: next.employee_ids.filter((empId) => !memberIds.has(empId)),
  };
}

export function unpickScopeDimension(
  scope: PolicyScopeState,
  key: keyof PolicyScopeState,
  id: number,
  targets?: PolicyScopeTargets,
): PolicyScopeState {
  const members = listEmployeesInScopeDimension(key, id, targets);
  const memberIds = new Set(members.map((row) => row.id));
  const next = removeScopeId(scope, key, id);
  return {
    ...next,
    employee_ids: next.employee_ids.filter((empId) => !memberIds.has(empId)),
  };
}

export function isEmployeeInPolicyScope(
  employeeId: number,
  scope: PolicyScopeState,
  targets?: PolicyScopeTargets,
): boolean {
  const employee = targets?.employees?.find((row) => row.id === employeeId);
  if (!employee) return false;
  return employeeMatchesPolicyScope(employee, scope);
}

export function countEmployeesPickedInDimension(
  key: keyof PolicyScopeState,
  id: number,
  scope: PolicyScopeState,
  targets?: PolicyScopeTargets,
  memberFilter?: (employee: NonNullable<PolicyScopeTargets["employees"]>[number]) => boolean,
): { picked: number; total: number } {
  const members = listEmployeesInScopeDimension(key, id, targets).filter((row) =>
    memberFilter ? memberFilter(row) : true,
  );
  const dimensionSelected = key === "employee_ids" ? false : scope[key].includes(id);
  if (dimensionSelected) {
    return { picked: members.length, total: members.length };
  }
  const picked = members.filter((row) =>
    isEmployeeInPolicyScope(row.id, scope, targets),
  ).length;
  return { picked, total: members.length };
}

export function pickAllEmployeesInDimension(
  scope: PolicyScopeState,
  key: keyof PolicyScopeState,
  id: number,
  targets?: PolicyScopeTargets,
  memberFilter?: (employee: NonNullable<PolicyScopeTargets["employees"]>[number]) => boolean,
): PolicyScopeState {
  const members = listEmployeesInScopeDimension(key, id, targets).filter((row) =>
    memberFilter ? memberFilter(row) : true,
  );
  if (!members.length) return scope;
  if (key !== "employee_ids") {
    return pickScopeDimension(scope, key, id, targets);
  }
  const ids = new Set(scope.employee_ids);
  for (const member of members) {
    ids.add(member.id);
  }
  return { ...scope, employee_ids: [...ids] };
}

export function unpickAllEmployeesInDimension(
  scope: PolicyScopeState,
  key: keyof PolicyScopeState,
  id: number,
  targets?: PolicyScopeTargets,
  memberFilter?: (employee: NonNullable<PolicyScopeTargets["employees"]>[number]) => boolean,
): PolicyScopeState {
  const members = listEmployeesInScopeDimension(key, id, targets).filter((row) =>
    memberFilter ? memberFilter(row) : true,
  );
  let next = scope;
  if (key !== "employee_ids" && next[key].includes(id)) {
    next = unpickScopeDimension(next, key, id, targets);
  }
  for (const member of members) {
    if (isEmployeeInPolicyScope(member.id, next, targets)) {
      next = removeEmployeeFromPolicyScope(member.id, next, targets);
    }
  }
  return next;
}

export function toggleEmployeeInPolicyScope(
  employeeId: number,
  scope: PolicyScopeState,
  targets?: PolicyScopeTargets,
): PolicyScopeState {
  if (isEmployeeInPolicyScope(employeeId, scope, targets)) {
    return removeEmployeeFromPolicyScope(employeeId, scope, targets);
  }
  return addScopeId(scope, "employee_ids", employeeId);
}

export function countUniqueDirectoryMembersInScope(
  scope: PolicyScopeState,
  targets?: PolicyScopeTargets,
): number {
  return listEmployeesInPolicyScope(scope, targets).length;
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
  if (!hasPolicyScopeFilters(scope)) {
    return 0;
  }
  return listEmployeesInPolicyScope(scope, targets).length;
}

export function listEmployeesInPolicyScope(
  scope: PolicyScopeState,
  targets?: PolicyScopeTargets,
  options?: { allEmployees?: boolean },
): NonNullable<PolicyScopeTargets["employees"]> {
  const employees = targets?.employees ?? [];
  if (options?.allEmployees) {
    return employees;
  }
  if (!hasPolicyScopeFilters(scope)) {
    return [];
  }
  return employees.filter((employee) =>
    employeeMatchesPolicyScope(employee, scope),
  );
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

export function employeeBelongsToScopeDimension(
  employee: NonNullable<PolicyScopeTargets["employees"]>[number],
  key: keyof PolicyScopeState,
  id: number,
): boolean {
  switch (key) {
    case "department_ids": {
      const deptId = employee.department_id || false;
      return Boolean(deptId && deptId === id);
    }
    case "grade_ids": {
      const gradeId = employee.grade_id || false;
      return Boolean(gradeId && gradeId === id);
    }
    case "work_location_ids": {
      const locId = employee.work_location_id || false;
      return Boolean(locId && locId === id);
    }
    case "employment_type_ids": {
      const typeId = employee.employment_type_id || false;
      return Boolean(typeId && typeId === id);
    }
    case "branch_ids": {
      const branchId = employee.branch_id || false;
      return Boolean(branchId && branchId === id);
    }
    default:
      return false;
  }
}

/** Drop one person from scope; keeps everyone else via explicit employee_ids if needed. */
export function removeEmployeeFromPolicyScope(
  employeeId: number,
  scope: PolicyScopeState,
  targets?: PolicyScopeTargets,
): PolicyScopeState {
  if (scope.employee_ids.includes(employeeId)) {
    const employee_ids = scope.employee_ids.filter((id) => id !== employeeId);
    if (!employee_ids.length && !hasPolicyScopeFilters({ ...scope, employee_ids })) {
      return emptyPolicyScope();
    }
    return { ...scope, employee_ids };
  }
  const matched = listEmployeesInPolicyScope(scope, targets);
  const remaining = matched
    .filter((employee) => employee.id !== employeeId)
    .map((employee) => employee.id);
  if (!remaining.length) {
    return emptyPolicyScope();
  }
  return {
    ...emptyPolicyScope(),
    employee_ids: remaining,
  };
}

export function listEmployeesInScopeDimension(
  key: keyof PolicyScopeState,
  id: number,
  targets?: PolicyScopeTargets,
): NonNullable<PolicyScopeTargets["employees"]> {
  const employees = targets?.employees ?? [];
  if (key === "employee_ids") {
    const match = employees.find((row) => row.id === id);
    return match ? [match] : [];
  }
  return employees.filter((employee) =>
    employeeBelongsToScopeDimension(employee, key, id),
  );
}
