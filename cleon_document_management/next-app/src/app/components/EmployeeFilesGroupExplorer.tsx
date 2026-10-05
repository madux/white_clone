"use client";

import { keepPreviousData, useQueries, useQueryClient } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import OrgFolderIcon, { DMS_FOLDER_ICON_CLASS } from "./OrgFolderIcon";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchEmployeeFileSummaryPage } from "../../../lib/employeeFileSummaryPages";
import { EMPLOYEE_FILE_LIST_PAGE_SIZE } from "../../../lib/employeeFileListPageSize";
import { useClientPagination } from "../../../lib/useClientPagination";
import {
  buildChildrenByParentId,
  buildFlatEmployeeGroupTree,
} from "../../../lib/employeeGroupTreeRows";
import type { EmployeeFileGroup, EmployeeFileSummary } from "../../../lib/types";
import { EMPLOYEE_FILES_KEYS } from "../../../hooks/useEmployeeFiles";
import AnimatedTreeCollapse from "./AnimatedTreeCollapse";
import EmptyState from "./EmptyState";
import ListPagination from "./ListPagination";
import PersonCell from "./PersonCell";
import SortableTable from "./SortableTable";
import StatusPill from "./StatusPill";
import { formatStatusLabel } from "../../../lib/formatLabel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  parseSortKey,
  tableSortMark,
  toggleTableSortKey,
} from "../../../lib/tableSortKey";

function memberQueryOptions(
  folderId: number,
  search: string,
  page: number,
  order: string,
  attentionFilter: string,
) {
  const offset = (Math.max(page, 1) - 1) * EMPLOYEE_FILE_LIST_PAGE_SIZE;
  const attention_filter =
    attentionFilter !== "all" ? attentionFilter : undefined;
  const isAllEmployees = folderId === 0;
  return {
    queryKey: isAllEmployees
      ? EMPLOYEE_FILES_KEYS.files({
          search,
          limit: EMPLOYEE_FILE_LIST_PAGE_SIZE,
          offset,
          order,
          attention_filter,
        })
      : EMPLOYEE_FILES_KEYS.groupMembers(folderId, {
          search,
          limit: EMPLOYEE_FILE_LIST_PAGE_SIZE,
          offset,
          order,
          attention_filter,
        }),
    queryFn: () =>
      fetchEmployeeFileSummaryPage({
        groupId: isAllEmployees ? undefined : folderId,
        search: search || undefined,
        pageSize: EMPLOYEE_FILE_LIST_PAGE_SIZE,
        offset,
        order,
        attention_filter,
      }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  };
}

function compareGroups(
  left: EmployeeFileGroup,
  right: EmployeeFileGroup,
  groupSort: string,
) {
  const { field, desc: descending } = parseSortKey(groupSort);
  let result = 0;
  if (field === "employees") {
    result = left.employee_count - right.employee_count;
  } else if (field === "documents") {
    result = left.document_count - right.document_count;
  } else if (field === "attention") {
    result = left.attention_count - right.attention_count;
  } else {
    result = left.name.localeCompare(right.name, undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }
  return descending ? -result : result;
}

export default function EmployeeFilesGroupExplorer({
  groups,
  search,
  memberSearch,
  paginateMembers = true,
  memberSort = "name asc",
  onMemberSortChange,
  groupSort = "name asc",
  onGroupSortChange,
  memberAttentionFilter = "all",
}: {
  groups: EmployeeFileGroup[];
  search: string;
  memberSearch?: string;
  paginateMembers?: boolean;
  memberSort?: string;
  onMemberSortChange?: (order: string) => void;
  groupSort?: string;
  onGroupSortChange?: (order: string) => void;
  memberAttentionFilter?: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [expandedFolders, setExpandedFolders] = useState<Record<number, boolean>>(
    {},
  );
  const [localMemberSearch, setLocalMemberSearch] = useState<Record<number, string>>(
    {},
  );
  const [memberPage, setMemberPage] = useState<Record<number, number>>({});

  const filteredGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return groups;
    const matching = groups.filter((group) =>
      group.name.toLowerCase().includes(needle),
    );
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
  const topLevel = useMemo(
    () => orderedGroups.filter((item) => item.depth === 0).map((item) => item.group),
    [orderedGroups],
  );
  const sortedTopLevel = useMemo(() => {
    const copy = [...topLevel];
    copy.sort((left, right) => compareGroups(left, right, groupSort));
    return copy;
  }, [groupSort, topLevel]);
  const pagedTopLevel = useClientPagination(
    sortedTopLevel,
    `${sortedTopLevel.length}:${search}:${groupSort}`,
  );

  useEffect(() => {
    setMemberPage({});
  }, [memberSort, memberAttentionFilter]);

  const leafGroupIds = useMemo(() => {
    const ids = new Set<number>();
    filteredGroups.forEach((group) => {
      if (!childrenByParent.has(group.id)) ids.add(group.id);
    });
    return ids;
  }, [childrenByParent, filteredGroups]);

  const expandedLeafIds = useMemo(
    () =>
      Object.entries(expandedFolders)
        .filter(([, open]) => open)
        .map(([id]) => Number(id))
        .filter((id) => leafGroupIds.has(id)),
    [expandedFolders, leafGroupIds],
  );

  useEffect(() => {
    if (memberSearch === undefined) return;
    setMemberPage((current) => ({ ...current, 0: 1 }));
  }, [memberSearch]);

  const visibleLeafIds = useMemo(() => {
    const ids: number[] = [];
    const seen = new Set<number>();
    const add = (id: number) => {
      if (seen.has(id) || !leafGroupIds.has(id)) return;
      seen.add(id);
      ids.push(id);
    };
    pagedTopLevel.items.forEach((group) => add(group.id));
    expandedLeafIds.forEach(add);
    return ids;
  }, [expandedLeafIds, leafGroupIds, pagedTopLevel.items]);

  const memberQueries = useQueries({
    queries: paginateMembers
      ? visibleLeafIds.map((folderId) => {
          const local = localMemberSearch[folderId] ?? "";
          const effectiveSearch =
            folderId === 0 && memberSearch !== undefined
              ? memberSearch.trim() || local
              : local;
          const page = memberPage[folderId] ?? 1;
          return memberQueryOptions(
            folderId,
            effectiveSearch,
            page,
            memberSort,
            memberAttentionFilter,
          );
        })
      : [],
  });

  const membersByFolderId = useMemo(() => {
    const map = new Map<
      number,
      { items: EmployeeFileSummary[]; total: number; loading: boolean }
    >();
    visibleLeafIds.forEach((folderId, index) => {
      const result = memberQueries[index];
      map.set(folderId, {
        items: result?.data?.items ?? [],
        total: result?.data?.total ?? 0,
        loading: Boolean(result?.isPending && !result?.data),
      });
    });
    return map;
  }, [memberQueries, visibleLeafIds]);

  const prefetchMembers = useCallback(
    (folderId: number) => {
      if (!paginateMembers || !leafGroupIds.has(folderId)) return;
      const local = localMemberSearch[folderId] ?? "";
      const page = memberPage[folderId] ?? 1;
      void queryClient.prefetchQuery(
        memberQueryOptions(
          folderId,
          local,
          page,
          memberSort,
          memberAttentionFilter,
        ),
      );
    },
    [
      leafGroupIds,
      localMemberSearch,
      memberAttentionFilter,
      memberPage,
      memberSort,
      paginateMembers,
      queryClient,
    ],
  );

  useEffect(() => {
    pagedTopLevel.items.forEach((group) => {
      if (!childrenByParent.has(group.id)) prefetchMembers(group.id);
    });
  }, [childrenByParent, pagedTopLevel.items, prefetchMembers]);

  const setFolderExpanded = useCallback((folderId: number, open: boolean) => {
    setExpandedFolders((current) => ({ ...current, [folderId]: open }));
    if (open && memberPage[folderId] === undefined) {
      setMemberPage((current) => ({ ...current, [folderId]: 1 }));
    }
  }, [memberPage]);

  const toggleGroup = (groupId: number) => {
    const next = !expandedFolders[groupId];
    if (next) prefetchMembers(groupId);
    setFolderExpanded(groupId, next);
  };

  const openEmployee = (employeeId: number) => {
    router.push(`/pages/employee/profile?employee=${employeeId}`);
  };

  if (!topLevel.length) {
    return (
      <EmptyState
        title="No groups match your filters"
        description="Try a different search or organizing dimension."
      />
    );
  }

  return (
    <>
    <Table data-no-sort="true">
      <TableHeader>
        <TableRow>
          <TableHead className="w-10" />
          <TableHead>
            {onGroupSortChange ? (
              <button
                type="button"
                className="font-inherit"
                onClick={() =>
                  onGroupSortChange(toggleTableSortKey(groupSort, "name"))
                }
              >
                Name
                {tableSortMark(groupSort, "name")}
              </button>
            ) : (
              "Name"
            )}
          </TableHead>
          <TableHead>
            {onGroupSortChange ? (
              <button
                type="button"
                className="font-inherit"
                onClick={() =>
                  onGroupSortChange(toggleTableSortKey(groupSort, "employees"))
                }
              >
                People
                {tableSortMark(groupSort, "employees")}
              </button>
            ) : (
              "People"
            )}
          </TableHead>
          <TableHead>
            {onGroupSortChange ? (
              <button
                type="button"
                className="font-inherit"
                onClick={() =>
                  onGroupSortChange(toggleTableSortKey(groupSort, "documents"))
                }
              >
                Files
                {tableSortMark(groupSort, "documents")}
              </button>
            ) : (
              "Files"
            )}
          </TableHead>
          <TableHead>
            {onGroupSortChange ? (
              <button
                type="button"
                className="font-inherit"
                onClick={() =>
                  onGroupSortChange(toggleTableSortKey(groupSort, "attention"))
                }
              >
                Status
                {tableSortMark(groupSort, "attention")}
              </button>
            ) : (
              "Status"
            )}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pagedTopLevel.items.map((group) => {
          const open = Boolean(expandedFolders[group.id]);
          const children = childrenByParent.get(group.id) ?? [];
          return (
            <GroupRows
              key={group.id}
              group={group}
              childrenGroups={children}
              childrenByParent={childrenByParent}
              expandedFolders={expandedFolders}
              onToggle={toggleGroup}
              membersByFolderId={membersByFolderId}
              memberPage={memberPage}
              onMemberPageChange={(id, page) =>
                setMemberPage((current) => ({ ...current, [id]: page }))
              }
              localMemberSearch={localMemberSearch}
              onMemberSearchChange={(id, value) => {
                setLocalMemberSearch((current) => ({ ...current, [id]: value }));
                setMemberPage((current) => ({ ...current, [id]: 1 }));
              }}
              onOpenEmployee={openEmployee}
              onPrefetch={prefetchMembers}
              memberSort={memberSort}
              onMemberSortChange={onMemberSortChange}
              depth={0}
              open={open}
            />
          );
        })}
      </TableBody>
    </Table>
    <ListPagination
      page={pagedTopLevel.page}
      pageSize={pagedTopLevel.pageSize}
      total={pagedTopLevel.total}
      onPageChange={pagedTopLevel.setPage}
    />
    </>
  );
}

function GroupRows({
  group,
  childrenGroups,
  childrenByParent,
  expandedFolders,
  onToggle,
  membersByFolderId,
  memberPage,
  onMemberPageChange,
  localMemberSearch,
  onMemberSearchChange,
  onOpenEmployee,
  onPrefetch,
  memberSort,
  onMemberSortChange,
  depth,
  open,
}: {
  group: EmployeeFileGroup;
  childrenGroups: EmployeeFileGroup[];
  childrenByParent: Map<number, EmployeeFileGroup[]>;
  expandedFolders: Record<number, boolean>;
  onToggle: (id: number) => void;
  membersByFolderId: Map<
    number,
    { items: EmployeeFileSummary[]; total: number; loading: boolean }
  >;
  memberPage: Record<number, number>;
  onMemberPageChange: (id: number, page: number) => void;
  localMemberSearch: Record<number, string>;
  onMemberSearchChange: (id: number, value: string) => void;
  onOpenEmployee: (employeeId: number) => void;
  onPrefetch: (folderId: number) => void;
  memberSort: string;
  onMemberSortChange?: (order: string) => void;
  depth: number;
  open: boolean;
}) {
  const hasChildren = childrenGroups.length > 0;
  const members = membersByFolderId.get(group.id);
  const memberItems = members?.items ?? [];
  const showEmpty = !hasChildren && !members?.loading && memberItems.length === 0;

  return (
    <>
      <TableRow
        onPointerEnter={() => {
          if (!hasChildren) onPrefetch(group.id);
        }}
      >
        <TableCell>
          <button
            type="button"
            className="inline-flex size-5 items-center justify-center text-muted-foreground"
            aria-expanded={open}
            onClick={() => onToggle(group.id)}
          >
            <ChevronRight
              className={`transition-transform duration-200 ${open ? "rotate-90 text-primary" : ""}`}
            />
          </button>
        </TableCell>
        <TableCell>
          <Link
            href={`/pages/employee/group?id=${group.id}`}
            className="inline-flex items-center gap-2 font-medium text-foreground hover:text-brand-pink"
            style={{ paddingLeft: depth * 12 }}
          >
            <OrgFolderIcon
              className={DMS_FOLDER_ICON_CLASS}
              hasContent={
                group.document_count > 0 || group.employee_count > 0
              }
            />
            {group.name}
          </Link>
        </TableCell>
        <TableCell className="text-muted-foreground">
          {group.employee_count} people
        </TableCell>
        <TableCell className="text-muted-foreground">
          {group.document_count} files
        </TableCell>
        <TableCell>
          <StatusPill
            label={
              group.attention_count
                ? `${group.attention_count} need attention`
                : "OK"
            }
          />
        </TableCell>
      </TableRow>
      <TableRow
        className={`app-nested-row border-0${open ? "" : " hidden"}`}
        aria-hidden={!open}
      >
        <TableCell colSpan={5} className="p-0">
          <AnimatedTreeCollapse open={open} className="employee-tree-children">
            {hasChildren ? (
              <div className="group-member-panel">
                <table className="dms-table w-full text-sm" data-no-sort="true">
                  <tbody>
                    {childrenGroups.map((child) => (
                      <GroupRows
                        key={child.id}
                        group={child}
                        childrenGroups={childrenByParent.get(child.id) ?? []}
                        childrenByParent={childrenByParent}
                        expandedFolders={expandedFolders}
                        onToggle={onToggle}
                        membersByFolderId={membersByFolderId}
                        memberPage={memberPage}
                        onMemberPageChange={onMemberPageChange}
                        localMemberSearch={localMemberSearch}
                        onMemberSearchChange={onMemberSearchChange}
                        onOpenEmployee={onOpenEmployee}
                        onPrefetch={onPrefetch}
                        memberSort={memberSort}
                        onMemberSortChange={onMemberSortChange}
                        depth={depth + 1}
                        open={Boolean(expandedFolders[child.id])}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="group-member-panel">
                <SortableTable className="w-full text-sm" managedSort>
                  <thead>
                    <tr>
                      <th className="dms-col-name">
                        {onMemberSortChange ? (
                          <button
                            type="button"
                            onClick={() =>
                              onMemberSortChange?.(
                                toggleTableSortKey(memberSort, "name"),
                              )
                            }
                          >
                            Employee
                            {tableSortMark(memberSort, "name")}
                          </button>
                        ) : (
                          "Employee"
                        )}
                      </th>
                      <th className="dms-col-id">
                        {onMemberSortChange ? (
                          <button
                            type="button"
                            onClick={() =>
                              onMemberSortChange?.(
                                toggleTableSortKey(memberSort, "identification"),
                              )
                            }
                          >
                            Employee ID
                            {tableSortMark(memberSort, "identification")}
                          </button>
                        ) : (
                          "Employee ID"
                        )}
                      </th>
                      <th className="dms-col-dept">
                        {onMemberSortChange ? (
                          <button
                            type="button"
                            onClick={() =>
                              onMemberSortChange?.(
                                toggleTableSortKey(memberSort, "department"),
                              )
                            }
                          >
                            Department
                            {tableSortMark(memberSort, "department")}
                          </button>
                        ) : (
                          "Department"
                        )}
                      </th>
                      <th className="dms-col-center">
                        {onMemberSortChange ? (
                          <button
                            type="button"
                            onClick={() =>
                              onMemberSortChange?.(
                                toggleTableSortKey(memberSort, "documents"),
                              )
                            }
                          >
                            Documents
                            {tableSortMark(memberSort, "documents")}
                          </button>
                        ) : (
                          "Documents"
                        )}
                      </th>
                      <th>
                        {onMemberSortChange ? (
                          <button
                            type="button"
                            onClick={() =>
                              onMemberSortChange?.(
                                toggleTableSortKey(memberSort, "attention"),
                              )
                            }
                          >
                            Status
                            {tableSortMark(memberSort, "attention")}
                          </button>
                        ) : (
                          "Status"
                        )}
                      </th>
                      <th className="dms-col-actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {memberItems.map((file) => (
                      <EmployeeRow key={file.id} file={file} />
                    ))}
                    {showEmpty ? (
                      <tr>
                        <td colSpan={6} className="text-muted-foreground">
                          No employees in this group.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </SortableTable>
                {members && !members.loading ? (
                  <div className="group-member-tools">
                    <Input
                      value={localMemberSearch[group.id] ?? ""}
                      onChange={(event) =>
                        onMemberSearchChange(group.id, event.target.value)
                      }
                      placeholder="Search employees in this group…"
                      className="group-member-search max-w-xs"
                    />
                    <ListPagination
                      page={memberPage[group.id] ?? 1}
                      pageSize={EMPLOYEE_FILE_LIST_PAGE_SIZE}
                      total={members.total}
                      onPageChange={(page) =>
                        onMemberPageChange(group.id, page)
                      }
                    />
                  </div>
                ) : null}
              </div>
            )}
          </AnimatedTreeCollapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function EmployeeRow({
  file,
}: {
  file: EmployeeFileSummary;
}) {
  const href = `/pages/employee/profile?employee=${file.employee_id}`;
  return (
    <tr>
      <td className="dms-col-name">
        <PersonCell name={file.employee_name} href={href} />
      </td>
      <td className="dms-col-id">
        <Link href={href} className="dms-id-link">
          {file.employee_identification || file.employee_id}
        </Link>
      </td>
      <td className="dms-col-dept text-muted-foreground">
        {file.department_name || "—"}
      </td>
      <td className="dms-col-center text-muted-foreground">
        {file.document_count}
      </td>
      <td data-sort-value={String(file.attention_count ?? 0)}>
        <StatusPill
          label={
            file.attention_count
              ? `${file.attention_count} need attention`
              : formatStatusLabel(file.status || file.state || "ok")
          }
        />
      </td>
      <td className="dms-col-actions">
        <Link href={href} className="text-xs font-bold text-brand-pink hover:underline">
          View
        </Link>
      </td>
    </tr>
  );
}
