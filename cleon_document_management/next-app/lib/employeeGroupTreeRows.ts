import type { EmployeeFileGroup } from "./types";
import type { ComplianceTargets, DocDocument, DocFolder } from "./types";
import {
  groupEmployeesInFolder,
  type FolderEmployeeGroup,
} from "./groupEmployeesInFolder";

export type EmployeeGroupTreeRow = {
  folder: DocFolder;
  documents: DocDocument[];
  employees: FolderEmployeeGroup[];
};

export function employeeGroupToFolder(group: EmployeeFileGroup): DocFolder {
  const employeeIds = group.member_employee_ids ?? [];
  return {
    id: group.id,
    folder_name: group.name,
    description: group.description ?? "",
    folder_type: "employee",
    owner_id: 0,
    owner_name: "",
    document_count: group.document_count,
    last_modified: "",
    access_scope: "all_staff",
    color: 0,
    is_locked: false,
    locked: false,
    favorite: false,
    pinned: false,
    active: true,
    employee_ids: employeeIds,
    require_upload_approval: false,
    approval_flow: "any",
    approver_ids: [],
  };
}

export function buildEmployeeGroupTreeRows(
  groups: EmployeeFileGroup[],
  documents: DocDocument[],
  targets?: ComplianceTargets,
): EmployeeGroupTreeRow[] {
  return groups.map((group) => {
    const folder = employeeGroupToFolder(group);
    const folderDocuments = documents.filter(
      (document) =>
        document.employee_id &&
        (group.member_employee_ids ?? []).includes(document.employee_id),
    );
    const employees = groupEmployeesInFolder(folder, folderDocuments, targets);
    return { folder, documents: folderDocuments, employees };
  });
}

export function customGroupIdSet(groups: EmployeeFileGroup[]): Set<number> {
  return new Set(
    groups.filter((group) => group.group_kind === "custom").map((group) => group.id),
  );
}
