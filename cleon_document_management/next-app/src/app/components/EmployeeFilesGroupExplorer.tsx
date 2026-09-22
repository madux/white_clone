"use client";

import { useQueries } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useComplianceTargets,
  useCurrentUser,
  useDocuments,
} from "../../../hooks/useDocuments";
import { api } from "../../../lib/api";
import { EMPLOYEE_FILE_LIST_PAGE_SIZE } from "../../../lib/employeeFileListPageSize";
import {
  buildChildrenByParentId,
  buildEmployeeGroupTreeRows,
  buildFlatEmployeeGroupTree,
  customGroupIdSet,
  employeeGroupToFolder,
} from "../../../lib/employeeGroupTreeRows";
import type { FolderTreeRow } from "./FolderEmployeeFileTree";
import { groupEmployeesInFolder } from "../../../lib/groupEmployeesInFolder";
import type { EmployeeFileGroup } from "../../../lib/types";
import { EMPLOYEE_FILES_KEYS } from "../../../hooks/useEmployeeFiles";
import FolderEmployeeFileTree from "./FolderEmployeeFileTree";

type MemberListState = {
  search: string;
  onSearchChange: (value: string) => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
};

export default function EmployeeFilesGroupExplorer({
  groups,
  search,
  memberSearch,
  paginateMembers = true,
}: {
  groups: EmployeeFileGroup[];
  search: string;
  /** When set (e.g. Employees tab), applies to the all-employees folder (id 0). */
  memberSearch?: string;
  paginateMembers?: boolean;
}) {
  const documents = useDocuments();
  const targets = useComplianceTargets();
  const currentUser = useCurrentUser();

  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>({});
  const [localMemberSearch, setLocalMemberSearch] = useState<Record<number, string>>({});
  const [memberPage, setMemberPage] = useState<Record<number, number>>({});

  const filteredGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return groups;
    const matching = groups.filter((group) => group.name.toLowerCase().includes(needle));
    const keepIds = new Set(matching.map((group) => group.id));
    matching.forEach((group) => {
      let parentId = group.parent_group_id;
      while (parentId) {
        keepIds.add(parentId);
        const parent = groups.find((item) => item.id === parentId);
        parentId = parent?.parent_group_id ?? false;
      }
    });
    return groups.filter((group) => keepIds.has(group.id));
  }, [groups, search]);

  const orderedGroups = useMemo(
    () => buildFlatEmployeeGroupTree(filteredGroups),
    [filteredGroups],
  );

  const childrenByParent = useMemo(
    () => buildChildrenByParentId(filteredGroups),
    [filteredGroups],
  );

  const leafGroupIds = useMemo(() => {
    const ids = new Set<number>();
    filteredGroups.forEach((group) => {
      if (!childrenByParent.has(group.id)) {
        ids.add(group.id);
      }
    });
    return ids;
  }, [childrenByParent, filteredGroups]);

  const expandedFolderIds = useMemo(
    () =>
      Object.entries(expandedFolders)
        .filter(([, open]) => open)
        .map(([id]) => Number(id))
        .filter((id) => leafGroupIds.has(id)),
    [expandedFolders, leafGroupIds],
  );

  const groupsForMemberQueries = useMemo(() => {
    const seen = new Set<number>();
    const list: EmployeeFileGroup[] = [];
    const walk = (group: EmployeeFileGroup) => {
      if (seen.has(group.id)) return;
      seen.add(group.id);
      list.push(group);
      (childrenByParent.get(group.id) ?? []).forEach(walk);
    };
    orderedGroups
      .filter((item) => item.depth === 0)
      .forEach((item) => walk(item.group));
    return list;
  }, [childrenByParent, orderedGroups]);

  useEffect(() => {
    if (memberSearch === undefined) return;
    setMemberPage((current) => ({ ...current, 0: 1 }));
  }, [memberSearch]);

  const memberQueries = useQueries({
    queries: paginateMembers
      ? expandedFolderIds.map((folderId) => {
          const local = localMemberSearch[folderId] ?? "";
          const effectiveSearch =
            folderId === 0 && memberSearch !== undefined
              ? memberSearch.trim() || local
              : local;
          const page = memberPage[folderId] ?? 1;
          const offset = (Math.max(page, 1) - 1) * EMPLOYEE_FILE_LIST_PAGE_SIZE;
          const isAllEmployees = folderId === 0;
          return {
            queryKey: isAllEmployees
              ? EMPLOYEE_FILES_KEYS.files({
                  search: effectiveSearch,
                  limit: EMPLOYEE_FILE_LIST_PAGE_SIZE,
                  offset,
                })
              : EMPLOYEE_FILES_KEYS.groupMembers(folderId, {
                  search: effectiveSearch,
                  limit: EMPLOYEE_FILE_LIST_PAGE_SIZE,
                  offset,
                }),
            queryFn: () =>
              isAllEmployees
                ? api.listEmployeeFileSummaries({
                    search: effectiveSearch || undefined,
                    limit: EMPLOYEE_FILE_LIST_PAGE_SIZE,
                    offset,
                  })
                : api.listEmployeeGroupMembers(folderId, {
                    search: effectiveSearch || undefined,
                    limit: EMPLOYEE_FILE_LIST_PAGE_SIZE,
                    offset,
                  }),
          };
        })
      : [],
  });

  const membersByFolderId = useMemo(() => {
    const map = new Map<number, { items: number[]; total: number; loading: boolean }>();
    expandedFolderIds.forEach((folderId, index) => {
      const result = memberQueries[index];
      const items = result?.data?.items ?? [];
      map.set(folderId, {
        items: items.map((file) => file.employee_id),
        total: result?.data?.total ?? 0,
        loading: result?.isLoading ?? false,
      });
    });
    return map;
  }, [expandedFolderIds, memberQueries]);

  const setFolderExpanded = useCallback((folderId: number, open: boolean) => {
    setExpandedFolders((current) => ({ ...current, [folderId]: open }));
    if (open && memberPage[folderId] === undefined) {
      setMemberPage((current) => ({ ...current, [folderId]: 1 }));
    }
  }, [memberPage]);

  const treeRows = useMemo(() => {
    if (!paginateMembers) {
      return buildEmployeeGroupTreeRows(
        groupsForMemberQueries,
        documents.data ?? [],
        targets.data,
      );
    }

    const buildGroupRow = (group: EmployeeFileGroup, depth: number): FolderTreeRow => {
      const children = childrenByParent.get(group.id) ?? [];
      const memberState = membersByFolderId.get(group.id);
      const employeeIds =
        expandedFolders[group.id] && memberState ? memberState.items : [];
      const folder = employeeGroupToFolder({
        ...group,
        member_employee_ids: employeeIds,
      });
      const folderDocuments = (documents.data ?? []).filter(
        (document) =>
          document.employee_id && employeeIds.includes(document.employee_id),
      );
      const employees =
        expandedFolders[group.id] && leafGroupIds.has(group.id)
          ? groupEmployeesInFolder(folder, folderDocuments, targets.data)
          : [];
      const nestedRows = children.length
        ? children.map((child) => buildGroupRow(child, depth + 1))
        : undefined;
      return { folder, documents: folderDocuments, employees, depth, nestedRows };
    };

    return orderedGroups
      .filter((item) => item.depth === 0)
      .map((item) => buildGroupRow(item.group, 0));
  }, [
    childrenByParent,
    documents.data,
    expandedFolders,
    groupsForMemberQueries,
    leafGroupIds,
    membersByFolderId,
    orderedGroups,
    paginateMembers,
    targets.data,
  ]);

  const employeeMemberLists = useMemo(() => {
    if (!paginateMembers) return undefined;
    const lists: Record<number, MemberListState> = {};
    groupsForMemberQueries.forEach((group) => {
      if (!expandedFolders[group.id] || !leafGroupIds.has(group.id)) return;
      const memberState = membersByFolderId.get(group.id);
      lists[group.id] = {
        search: localMemberSearch[group.id] ?? "",
        onSearchChange: (value: string) => {
          setLocalMemberSearch((current) => ({ ...current, [group.id]: value }));
          setMemberPage((current) => ({ ...current, [group.id]: 1 }));
        },
        page: memberPage[group.id] ?? 1,
        pageSize: EMPLOYEE_FILE_LIST_PAGE_SIZE,
        total: memberState?.total ?? group.employee_count,
        onPageChange: (page: number) =>
          setMemberPage((current) => ({ ...current, [group.id]: page })),
        loading: memberState?.loading,
      };
    });
    return lists;
  }, [
    expandedFolders,
    groupsForMemberQueries,
    localMemberSearch,
    memberPage,
    leafGroupIds,
    membersByFolderId,
    paginateMembers,
  ]);

  const employeeCountDisplay = useMemo(() => {
    const counts: Record<number, number> = {};
    groupsForMemberQueries.forEach((group) => {
      counts[group.id] = group.employee_count;
    });
    return counts;
  }, [groupsForMemberQueries]);

  const customIds = useMemo(() => customGroupIdSet(filteredGroups), [filteredGroups]);

  if (documents.isLoading) {
    return (
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5">
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <FolderEmployeeFileTree
        kind="employee"
        rows={treeRows}
        isDocumentManager={
          currentUser.data?.employee_files_permissions?.can_access_ef_home === true ||
          currentUser.data?.is_document_manager === true
        }
        singleFolderExpanded={false}
        showFolderOpenLink={!groups.some((group) => group.id === 0)}
        employeeGroupLinkMode
        customGroupIds={customIds}
        emptyMessage="No employee file groups match your filters."
        expandedFolders={expandedFolders}
        onFolderExpandedChange={setFolderExpanded}
        employeeMemberLists={employeeMemberLists}
        employeeCountDisplay={employeeCountDisplay}
      />
    </div>
  );
}
