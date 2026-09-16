"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  useEmployeeFileGroup,
  useEmployeeFileSummaries,
} from "../../../hooks/useEmployeeFiles";
import { EMPLOYEE_FILE_LIST_PAGE_SIZE } from "../../../lib/employeeFileListPageSize";
import ListPagination from "./ListPagination";
import { api } from "../../../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { EMPLOYEE_FILES_KEYS } from "../../../hooks/useEmployeeFiles";
import EmployeeFilesGroupExplorer from "./EmployeeFilesGroupExplorer";
import type { EmployeeFileGroup } from "../../../lib/types";

function employeeInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function AddEmployeeFilePicker({
  memberFileIds,
  selected,
  onToggle,
  onSetSelected,
  onAdd,
  pending,
}: {
  memberFileIds: Set<number>;
  selected: number[];
  onToggle: (id: number) => void;
  onSetSelected: (ids: number[]) => void;
  onAdd: () => void;
  pending: boolean;
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const filePage = useEmployeeFileSummaries(
    search.trim() || undefined,
    page,
    EMPLOYEE_FILE_LIST_PAGE_SIZE,
  );

  const filtered = useMemo(() => {
    const items = filePage.data?.items ?? [];
    return items.filter((file) => !memberFileIds.has(file.id));
  }, [filePage.data?.items, memberFileIds]);

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((file) => selected.includes(file.id));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="font-semibold text-slate-900">Add employee files</h2>
        <p className="mt-1 text-xs text-slate-500">
          Select existing employee files to include in this custom group. Turn groups on from
          Settings → Employee Files → Custom groups.
        </p>
        <label className="relative mt-4 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="field w-full pl-10"
            placeholder="Search by name or department…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>

      <div className="employee-file-tree max-h-72 overflow-y-auto p-2">
        {filtered.length ? (
          filtered.map((file) => {
            const isSelected = selected.includes(file.id);
            return (
              <button
                key={file.id}
                type="button"
                onClick={() => onToggle(file.id)}
                className={`employee-tree-row employee-tree-row-employee w-full text-left transition ${
                  isSelected ? "bg-pink-50/80" : "hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  readOnly
                  checked={isSelected}
                  aria-hidden
                  className="pointer-events-none h-4 w-4 shrink-0 accent-pink-600"
                />
                <span className="employee-tree-avatar">{employeeInitials(file.employee_name)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-800">{file.employee_name}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {file.department_name || "Unassigned"}
                    {file.document_count ? ` · ${file.document_count} files` : ""}
                  </span>
                </span>
              </button>
            );
          })
        ) : (
          <p className="employee-tree-empty px-4 py-8 text-center text-sm text-slate-500">
            {filePage.isLoading
              ? "Loading employees…"
              : (filePage.data?.total ?? 0) > 0
                ? "No employees on this page are available to add."
                : "No employees match your search."}
          </p>
        )}
      </div>

      <div className="border-t border-slate-100 px-5 py-3">
        <ListPagination
          page={page}
          pageSize={EMPLOYEE_FILE_LIST_PAGE_SIZE}
          total={filePage.data?.total ?? 0}
          onPageChange={setPage}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
        <button
          type="button"
          className="text-sm font-semibold text-slate-600 hover:text-brand-pink"
          disabled={!filtered.length}
          onClick={() => {
            const visibleIds = new Set(filtered.map((file) => file.id));
            if (allVisibleSelected) {
              onSetSelected(selected.filter((id) => !visibleIds.has(id)));
            } else {
              onSetSelected([...new Set([...selected, ...filtered.map((file) => file.id)])]);
            }
          }}
        >
          {allVisibleSelected ? "Clear visible" : "Select visible"}
        </button>
        <button
          type="button"
          disabled={!selected.length || pending}
          className="rounded-xl bg-brand-pink px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onAdd}
        >
          {pending ? "Adding…" : `Add ${selected.length || ""} employee file${selected.length === 1 ? "" : "s"}`.trim()}
        </button>
      </div>
    </div>
  );
}

export default function EmployeeGroupPage() {
  const params = useSearchParams();
  const router = useRouter();
  const groupId = Number(params.get("id") || 0);
  const group = useEmployeeFileGroup(groupId);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);
  const isCreate = params.get("create") === "1";

  const readOnly = group.data?.read_only_membership === true;

  useEffect(() => {
    if (isCreate) {
      router.replace("/pages/settings?section=employee_files");
    }
  }, [isCreate, router]);

  const memberFileIds = useMemo(
    () => new Set((group.data?.members ?? []).map((member) => member.id)),
    [group.data?.members],
  );

  const treeGroup = useMemo((): EmployeeFileGroup | null => {
    if (!group.data) return null;
    return {
      ...group.data,
      member_employee_ids: [],
    };
  }, [group.data]);

  const toggleSelected = (id: number) => {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  };

  const addMembers = async () => {
    if (!groupId || !selected.length) return;
    setAdding(true);
    try {
      await api.addEmployeeFilesToGroup(groupId, selected);
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: EMPLOYEE_FILES_KEYS.group(groupId) });
    } finally {
      setAdding(false);
    }
  };

  if (!groupId) {
    return <p className="text-sm text-slate-500">Select a group from Employee Files home.</p>;
  }

  return (
    <div className="min-h-full mx-auto w-full max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10">
      <div>
        <Link href="/pages/employee" className="text-sm text-brand-pink">
          ← Employee Files
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900">{group.data?.name}</h1>
          {group.data?.group_kind === "custom" ? (
            <span className="employee-tree-badge probation text-[10px] uppercase tracking-wide">
              Custom
            </span>
          ) : null}
        </div>
        <p className="text-sm text-slate-500">
          {group.data?.employee_count ?? 0} employees · {group.data?.document_count ?? 0}{" "}
          documents
          {readOnly ? " · System-managed (read-only membership)" : ""}
        </p>
      </div>

      {treeGroup ? (
        <EmployeeFilesGroupExplorer groups={[treeGroup]} search="" />
      ) : null}

      {!readOnly && group.data?.group_kind === "custom" ? (
        <AddEmployeeFilePicker
          memberFileIds={memberFileIds}
          selected={selected}
          onToggle={toggleSelected}
          onSetSelected={setSelected}
          onAdd={addMembers}
          pending={adding}
        />
      ) : null}
    </div>
  );
}
