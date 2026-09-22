"use client";

import Link from "next/link";
import { FileText } from "lucide-react";
import type { DocDocument } from "../../../lib/types";
import type { EmployeeFilesDocumentColumnId } from "../../../lib/employeeFilesBrowsePreferences";
import { formatDocumentDateShort } from "../../../lib/formatDocumentDate";
import ListPagination from "./ListPagination";
import SortableTable from "./SortableTable";

const SORTABLE: Record<string, string> = {
  Document: "name",
  Employee: "employee",
  "Upload date": "upload_date",
  Status: "status",
  Expiry: "expiry",
};

type Props = {
  items: DocDocument[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  layoutMode: "list" | "card";
  visibleColumns: EmployeeFilesDocumentColumnId[];
  sortKey: string;
  onSortChange: (order: string) => void;
  isLoading?: boolean;
};

function statusLabel(doc: DocDocument) {
  if (doc.approval_state === "pending") return "Pending approval";
  return doc.state || "—";
}

export default function EmployeeFilesDocumentResults({
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
  const show = (col: EmployeeFilesDocumentColumnId) => visibleColumns.includes(col);

  const headerSort = (label: string) => {
    const field = SORTABLE[label];
    if (!field) return undefined;
    const asc = `${field} asc`;
    const desc = `${field} desc`;
    return () => onSortChange(sortKey === asc ? desc : asc);
  };

  if (isLoading) {
    return (
      <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Loading documents…
      </p>
    );
  }

  if (!items.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-slate-500">
        No documents match your search and filters.
      </p>
    );
  }

  if (layoutMode === "card") {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((doc) => (
            <Link
              key={doc.id}
              href={`/pages/employee/profile?employee=${doc.employee_id}&doc=${doc.id}`}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-pink-200 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <span className="rounded-xl bg-pink-50 p-2 text-brand-pink">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{doc.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{doc.employee_name}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {doc.document_category_label ?? doc.document_type} ·{" "}
                    {statusLabel(doc)}
                  </p>
                </div>
              </div>
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
        <SortableTable className="dms-table--employee-files-docs min-w-[900px]">
          <thead>
            <tr>
              {show("name") ? (
                <th className="dms-col-doc-name">
                  <button
                    type="button"
                    className="font-inherit"
                    onClick={headerSort("Document")}
                  >
                    Document
                    {sortKey.startsWith("name") ? (sortKey.includes("desc") ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ) : null}
              {show("employee") ? (
                <th className="dms-col-employee-name">
                  <button type="button" onClick={headerSort("Employee")}>
                    Employee
                    {sortKey.startsWith("employee") ? (sortKey.includes("desc") ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ) : null}
              {show("category") ? <th>Category</th> : null}
              {show("documentType") ? <th>Document type</th> : null}
              {show("source") ? <th>Source</th> : null}
              {show("status") ? (
                <th>
                  <button type="button" onClick={headerSort("Status")}>
                    Status
                    {sortKey.startsWith("status") ? (sortKey.includes("desc") ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ) : null}
              {show("uploadDate") ? (
                <th>
                  <button type="button" onClick={headerSort("Upload date")}>
                    Upload date
                    {sortKey.startsWith("upload_date") ? (sortKey.includes("desc") ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ) : null}
              {show("expiry") ? (
                <th>
                  <button type="button" onClick={headerSort("Expiry")}>
                    Expiry
                    {sortKey.startsWith("expiry") ? (sortKey.includes("desc") ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ) : null}
              <th className="dms-col-actions">Open</th>
            </tr>
          </thead>
          <tbody>
            {items.map((doc) => (
              <tr key={doc.id}>
                {show("name") ? (
                  <td className="dms-col-doc-name font-medium text-slate-800">
                    {doc.name}
                  </td>
                ) : null}
                {show("employee") ? (
                  <td className="dms-col-employee-name text-slate-600">
                    {doc.employee_name}
                  </td>
                ) : null}
                {show("category") ? (
                  <td className="text-slate-600">
                    {doc.document_category_label ?? "—"}
                  </td>
                ) : null}
                {show("documentType") ? (
                  <td className="text-slate-600">{doc.document_type}</td>
                ) : null}
                {show("source") ? (
                  <td className="text-slate-600">
                    {(doc as DocDocument & { source_module_label?: string })
                      .source_module_label ?? "Employee Files"}
                  </td>
                ) : null}
                {show("status") ? (
                  <td className="text-slate-600">{statusLabel(doc)}</td>
                ) : null}
                {show("uploadDate") ? (
                  <td className="text-slate-500">
                    {formatDocumentDateShort(doc.created_at || doc.write_date)}
                  </td>
                ) : null}
                {show("expiry") ? (
                  <td className="text-slate-500">{doc.expiry_date ?? "—"}</td>
                ) : null}
                <td className="dms-col-actions">
                  <Link
                    href={`/pages/employee/profile?employee=${doc.employee_id}&doc=${doc.id}`}
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
