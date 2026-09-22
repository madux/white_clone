"use client";

import Link from "next/link";
import type { EmployeeFileSummary } from "../../../lib/types";
import type { EmployeeFilesEmployeeColumnId } from "../../../lib/employeeFilesBrowsePreferences";
import ListPagination from "./ListPagination";
import SortableTable from "./SortableTable";

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

  const toggleNameSort = () =>
    onSortChange(sortKey === "name asc" ? "name desc" : "name asc");

  if (isLoading) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Loading employees…
      </p>
    );
  }

  if (!items.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
        No employee files match your search.
      </p>
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
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="dms-table-wrap">
        <SortableTable className="min-w-[800px]">
          <thead>
            <tr>
              {show("name") ? (
                <th>
                  <button type="button" onClick={toggleNameSort}>
                    Employee
                    {sortKey.startsWith("name") ? (sortKey.includes("desc") ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ) : null}
              {show("employeeId") ? <th>Employee ID</th> : null}
              {show("department") ? <th>Department</th> : null}
              {show("jobTitle") ? <th>Job title</th> : null}
              {show("documents") ? <th className="dms-col-num">Documents</th> : null}
              {show("attention") ? (
                <th className="dms-col-num dms-col-num--wide">Needs attention</th>
              ) : null}
              <th className="dms-col-actions">Open</th>
            </tr>
          </thead>
          <tbody>
            {items.map((file) => (
              <tr key={file.id}>
                {show("name") ? (
                  <td className="font-medium text-slate-800">{file.employee_name}</td>
                ) : null}
                {show("employeeId") ? (
                  <td className="text-slate-600">
                    {file.employee_identification || file.employee_id}
                  </td>
                ) : null}
                {show("department") ? (
                  <td className="text-slate-600">{file.department_name || "—"}</td>
                ) : null}
                {show("jobTitle") ? (
                  <td className="text-slate-600">{file.job_title || "—"}</td>
                ) : null}
                {show("documents") ? (
                  <td className="dms-col-num text-slate-600">{file.document_count}</td>
                ) : null}
                {show("attention") ? (
                  <td className="dms-col-num dms-col-num--wide text-slate-600">
                    {file.attention_count}
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
