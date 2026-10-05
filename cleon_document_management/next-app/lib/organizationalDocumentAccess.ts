import type { DocDocument, DocFolder } from "./types";
import { allowedAccessScopes, coerceAccessScope } from "./organizationalFolderScope";

export type FolderAccessContext = {
  access_scope?: string;
  department_ids?: number[];
  grade_ids?: number[];
  employee_ids?: number[];
};

export function folderAccessFromDocument(
  document?: DocDocument | null,
): FolderAccessContext | null {
  if (!document?.folder_access_scope) return null;
  return {
    access_scope: document.folder_access_scope,
    department_ids: document.folder_department_ids ?? [],
    grade_ids: document.folder_grade_ids ?? [],
    employee_ids: document.folder_employee_ids ?? [],
  };
}

export function folderAccessFromFolder(
  folder?: Pick<
    DocFolder,
    "access_scope" | "department_ids" | "grade_ids" | "employee_ids"
  > | null,
): FolderAccessContext | null {
  if (!folder?.access_scope) return null;
  return {
    access_scope: folder.access_scope,
    department_ids: folder.department_ids ?? [],
    grade_ids: folder.grade_ids ?? [],
    employee_ids: folder.employee_ids ?? [],
  };
}

export function allowedDocumentAccessScopes(folder?: FolderAccessContext | null): string[] {
  return allowedAccessScopes(folder?.access_scope);
}

export function filterDepartmentsForFolderScope<
  T extends { id: number; name: string },
>(departments: T[], folder?: FolderAccessContext | null): T[] {
  if (!folder?.access_scope || folder.access_scope === "all_staff") {
    return departments;
  }
  if (folder.access_scope === "department" && folder.department_ids?.length) {
    const allowed = new Set(folder.department_ids);
    return departments.filter((item) => allowed.has(item.id));
  }
  return departments;
}

export function filterGradesForFolderScope<T extends { id: number; name: string }>(
  grades: T[],
  folder?: FolderAccessContext | null,
): T[] {
  if (!folder?.access_scope || folder.access_scope === "all_staff") {
    return grades;
  }
  if (folder.access_scope === "grade" && folder.grade_ids?.length) {
    const allowed = new Set(folder.grade_ids);
    return grades.filter((item) => allowed.has(item.id));
  }
  return grades;
}

export function filterEmployeesForFolderScope<
  T extends {
    id: number;
    department_id?: number | false;
    grade_id?: number | false;
  },
>(employees: T[], folder?: FolderAccessContext | null): T[] {
  if (!folder?.access_scope || folder.access_scope === "all_staff") {
    return employees;
  }
  if (folder.access_scope === "individual" && folder.employee_ids?.length) {
    const allowed = new Set(folder.employee_ids);
    return employees.filter((item) => allowed.has(item.id));
  }
  if (folder.access_scope === "department" && folder.department_ids?.length) {
    const allowed = new Set(folder.department_ids);
    return employees.filter(
      (employee) =>
        Boolean(employee.department_id) && allowed.has(Number(employee.department_id)),
    );
  }
  if (folder.access_scope === "grade" && folder.grade_ids?.length) {
    const allowed = new Set(folder.grade_ids);
    return employees.filter(
      (employee) => Boolean(employee.grade_id) && allowed.has(Number(employee.grade_id)),
    );
  }
  return employees;
}

export function initialDocumentAccessScope(
  folder?: FolderAccessContext | null,
  currentScope?: string,
): string {
  const allowed = allowedDocumentAccessScopes(folder);
  if (currentScope && allowed.includes(currentScope)) {
    return currentScope;
  }
  if (folder?.access_scope === "department") return "department";
  if (folder?.access_scope === "grade") return "grade";
  if (folder?.access_scope === "individual") return "individual";
  return coerceAccessScope("department", folder?.access_scope);
}
