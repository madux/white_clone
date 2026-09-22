import type { EmployeeFileFilterState } from "./employeeFileFilters";
import { employeeMatchesFileFilters } from "./employeeFileFilters";
import type {
  ComplianceTargetEmployee,
  ComplianceTargets,
  DocDocument,
  DocFolder,
  EmployeeLifecycleStatus,
} from "./types";

export type FolderEmployeeGroup = {
  id: number;
  name: string;
  department: string;
  department_id: number | false;
  grade: string;
  job_title: string;
  lifecycle_status: EmployeeLifecycleStatus;
  work_location: string;
  work_location_id: number | false;
  has_pending_documents: boolean;
  documents: DocDocument[];
};

function buildEmployeeGroup(
  employeeId: number,
  target: ComplianceTargetEmployee | undefined,
  fallbackName = "Unknown employee",
): FolderEmployeeGroup {
  return {
    id: employeeId,
    name: target?.name ?? fallbackName,
    department: target?.department || "Unassigned",
    department_id: target?.department_id ?? false,
    grade: target?.grade ?? "",
    job_title: target?.job_title ?? "",
    lifecycle_status: target?.lifecycle_status ?? "active",
    work_location: target?.work_location || target?.location || "",
    work_location_id: target?.work_location_id ?? false,
    has_pending_documents: Boolean(target?.has_pending_documents),
    documents: [],
  };
}

export function groupEmployeesInFolder(
  folder: DocFolder,
  documents: DocDocument[],
  targets?: ComplianceTargets,
  filters?: EmployeeFileFilterState,
): FolderEmployeeGroup[] {
  const targetById = new Map(
    (targets?.employees ?? []).map((employee) => [employee.id, employee]),
  );
  const grouped = new Map<number, FolderEmployeeGroup>();

  (folder.employee_ids ?? []).forEach((employeeId) => {
    grouped.set(
      employeeId,
      buildEmployeeGroup(employeeId, targetById.get(employeeId)),
    );
  });

  documents.forEach((document) => {
    if (!document.employee_id) return;
    const target = targetById.get(document.employee_id);
    const current =
      grouped.get(document.employee_id) ??
      buildEmployeeGroup(
        document.employee_id,
        target,
        document.employee_name,
      );
    current.documents = [...current.documents, document];
    grouped.set(document.employee_id, current);
  });

  return [...grouped.values()]
    .filter((employee) => {
      const target = targetById.get(employee.id);
      if (!target) {
        return !filters?.search || employee.name.toLowerCase().includes(
          filters.search.trim().toLowerCase(),
        );
      }
      if (!filters) return true;
      return employeeMatchesFileFilters(target, filters);
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}
