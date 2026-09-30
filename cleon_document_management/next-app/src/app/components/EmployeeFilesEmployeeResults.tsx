"use client";

import Link from "next/link";
import type { EmployeeFileSummary } from "../../../lib/types";
import type { EmployeeFilesEmployeeColumnId } from "../../../lib/employeeFilesBrowsePreferences";
import EmptyState from "./EmptyState";
import ListPagination from "./ListPagination";
import PersonCell from "./PersonCell";
import { tableSortMark, toggleTableSortKey } from "../../../lib/tableSortKey";
import SortableTable from "./SortableTable";
import StatusPill from "./StatusPill";

type Props = {
  items: EmployeeFileSummary[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  layoutMode: "list" | "card";
  visibleColumns: EmployeeFilesEmployeeColumnId[];
  sortKey: string;
  onSortChange: (order: string) => void;
  isLoading?: boolean;
};

export default function EmployeeFilesEmployeeResults({
  items,
  total,
  page,
  pageSize,
  onPageChange,
  layoutMode,
  visibleColumns,
  sortKey,
  onSortChange,
  isLoading,
}: Props) {
  const show = (col: EmployeeFilesEmployeeColumnId) => visibleColumns.includes(col);

  const toggleSort = (
    field: "name" | "identification" | "department" | "documents" | "attention",
  ) => onSortChange(toggleTableSortKey(sortKey, field));

  if (isLoading) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Loading employees…
      </p>
    );
  }

  if (!items.length) {
    return (
      <EmptyState
        title="No matching employees"
        description="No employee files match your search."
      />
    );
  }

  if (layoutMode === "card") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((file) => (
            <Link
              key={file.id}
              href={`/pages/employee/profile?employee=${file.employee_id}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-pink-200"
            >
              <p className="font-semibold text-slate-900">{file.employee_name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {file.employee_identification || `ID ${file.employee_id}`}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                {file.department_name || "No department"} · {file.document_count}{" "}
                documents
              </p>
            </Link>
          ))}
        </div>
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <SortableTable className="ef-table min-w-[800px]" managedSort>
          <thead>
            <tr>
              {show("name") ? (
                <th className="dms-col-name">
                  <button type="button" onClick={() => toggleSort("name")}>
                    Employee
                    {tableSortMark(sortKey, "name")}
                  </button>
                </th>
              ) : null}
              {show("employeeId") ? (
                <th className="dms-col-id">
                  <button type="button" onClick={() => toggleSort("identification")}>
                    Employee ID
                    {tableSortMark(sortKey, "identification")}
                  </button>
                </th>
              ) : null}
              {show("department") ? (
                <th className="dms-col-dept">
                  <button type="button" onClick={() => toggleSort("department")}>
                    Department
                    {tableSortMark(sortKey, "department")}
                  </button>
                </th>
              ) : null}
              {show("jobTitle") ? <th>Job title</th> : null}
              {show("documents") ? (
                <th className="dms-col-center">
                  <button type="button" onClick={() => toggleSort("documents")}>
                    Documents
                    {tableSortMark(sortKey, "documents")}
                  </button>
                </th>
              ) : null}
              {show("attention") ? (
                <th>
                  <button type="button" onClick={() => toggleSort("attention")}>
                    Status
                    {tableSortMark(sortKey, "attention")}
                  </button>
                </th>
              ) : null}
              <th className="dms-col-actions" aria-label="Open employee file" />
            </tr>
          </thead>
          <tbody>
            {items.map((file) => (
              <tr key={file.id}>
                {show("name") ? (
                  <td className="dms-col-name">
                    <PersonCell
                      name={file.employee_name}
                      subtitle={
                        show("employeeId")
                          ? undefined
                          : file.employee_identification || undefined
                      }
                      href={`/pages/employee/profile?employee=${file.employee_id}`}
                    />
                  </td>
                ) : null}
                {show("employeeId") ? (
                  <td className="dms-col-id">
                    <Link
                      href={`/pages/employee/profile?employee=${file.employee_id}`}
                      className="dms-id-link"
                    >
                      {file.employee_identification || file.employee_id}
                    </Link>
                  </td>
                ) : null}
                {show("department") ? (
                  <td className="dms-col-dept text-slate-600">
                    {file.department_name || "—"}
                  </td>
                ) : null}
                {show("jobTitle") ? (
                  <td className="text-slate-600">{file.job_title || "—"}</td>
                ) : null}
                {show("documents") ? (
                  <td className="dms-col-center text-slate-600">{file.document_count}</td>
                ) : null}
                {show("attention") ? (
                  <td data-sort-value={String(file.attention_count ?? 0)}>
                    <StatusPill
                      label={
                        file.attention_count
                          ? `${file.attention_count} need attention`
                          : "OK"
                      }
                    />
                  </td>
                ) : null}
                <td className="dms-col-actions">
                  <Link
                    href={`/pages/employee/profile?employee=${file.employee_id}`}
                    className="text-xs font-bold text-brand-pink hover:underline"
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </SortableTable>
      </div>
      <div className="border-t border-slate-100 px-4 py-3">
        <ListPagination
          page={page}
          pageSize={pageSize}
          total={total}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
