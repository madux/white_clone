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

export type FlatEmployeeGroupTreeItem = {
  group: EmployeeFileGroup;
  depth: number;
};

export function buildChildrenByParentId(
  groups: EmployeeFileGroup[],
): Map<number, EmployeeFileGroup[]> {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const childrenByParent = new Map<number, EmployeeFileGroup[]>();
  for (const group of groups) {
    const parentId = group.parent_group_id;
    if (!parentId || !byId.has(parentId)) continue;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(group);
    childrenByParent.set(parentId, list);
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name));
  }
  return childrenByParent;
}

export function buildFlatEmployeeGroupTree(
  groups: EmployeeFileGroup[],
): FlatEmployeeGroupTreeItem[] {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const childrenByParent = new Map<number, EmployeeFileGroup[]>();
  for (const group of groups) {
    const parentId = group.parent_group_id;
    if (!parentId || !byId.has(parentId)) continue;
    const list = childrenByParent.get(parentId) ?? [];
    list.push(group);
    childrenByParent.set(parentId, list);
  }
  const roots = groups.filter(
    (group) => !group.parent_group_id || !byId.has(group.parent_group_id),
  );
  roots.sort((a, b) => a.name.localeCompare(b.name));
  const flat: FlatEmployeeGroupTreeItem[] = [];
  const walk = (group: EmployeeFileGroup, depth: number) => {
    flat.push({ group, depth });
    const children = (childrenByParent.get(group.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    children.forEach((child) => walk(child, depth + 1));
  };
  roots.forEach((root) => walk(root, 0));
  return flat;
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

/** Groups belonging to a subtree rooted at `rootId` (inclusive). */
export function filterGroupsToSubtree(
  groups: EmployeeFileGroup[],
  rootId: number,
): EmployeeFileGroup[] {
  const byId = new Map(groups.map((group) => [group.id, group]));
  const inSubtree = (group: EmployeeFileGroup): boolean => {
    if (group.id === rootId) return true;
    let parentId = group.parent_group_id;
    while (parentId) {
      if (parentId === rootId) return true;
      parentId = byId.get(parentId)?.parent_group_id ?? false;
    }
    return false;
  };
  return groups.filter(inSubtree);
}
