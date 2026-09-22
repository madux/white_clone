import type {
  ComplianceTargetEmployee,
  EmployeeLifecycleStatus,
} from "./types";

export type EmployeeFileFilterState = {
  search: string;
  lifecycleStatuses: EmployeeLifecycleStatus[];
  locationIds: number[];
  gradeIds: number[];
  pendingDocuments: "all" | "yes" | "no";
};

export const INITIAL_EMPLOYEE_FILE_FILTERS: EmployeeFileFilterState = {
  search: "",
  lifecycleStatuses: [],
  locationIds: [],
  gradeIds: [],
  pendingDocuments: "all",
};

export const LIFECYCLE_STATUS_OPTIONS: {
  value: EmployeeLifecycleStatus;
  label: string;
}[] = [
  { value: "active", label: "Active" },
  { value: "probation", label: "Probation" },
  { value: "on_leave", label: "On Leave" },
  { value: "suspended", label: "Suspended" },
];

export function countActiveEmployeeFilters(
  filters: EmployeeFileFilterState,
): number {
  let count = 0;
  if (filters.lifecycleStatuses.length) count += 1;
  if (filters.locationIds.length) count += 1;
  if (filters.gradeIds.length) count += 1;
  if (filters.pendingDocuments !== "all") count += 1;
  return count;
}

export function matchesEmployeeSearch(
  employee: ComplianceTargetEmployee,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return [
    employee.name,
    employee.department,
    employee.grade,
    employee.job_title,
    employee.work_location,
    employee.location,
  ].some((field) => field?.toLowerCase().includes(normalized));
}

export function employeeMatchesFileFilters(
  employee: ComplianceTargetEmployee,
  filters: EmployeeFileFilterState,
): boolean {
  if (!matchesEmployeeSearch(employee, filters.search)) {
    return false;
  }

  if (
    filters.lifecycleStatuses.length &&
    !filters.lifecycleStatuses.includes(
      employee.lifecycle_status ?? "active",
    )
  ) {
    return false;
  }

  if (filters.locationIds.length) {
    const locationId = employee.work_location_id;
    if (!locationId || !filters.locationIds.includes(locationId)) {
      return false;
    }
  }

  if (filters.gradeIds.length) {
    const gradeId = employee.grade_id;
    if (!gradeId || !filters.gradeIds.includes(gradeId)) {
      return false;
    }
  }

  if (filters.pendingDocuments === "yes" && !employee.has_pending_documents) {
    return false;
  }
  if (filters.pendingDocuments === "no" && employee.has_pending_documents) {
    return false;
  }

  return true;
}

export function filterEmployeeIds(
  employees: ComplianceTargetEmployee[],
  filters: EmployeeFileFilterState,
): Set<number> {
  return new Set(
    employees
      .filter((employee) => employeeMatchesFileFilters(employee, filters))
      .map((employee) => employee.id),
  );
}
