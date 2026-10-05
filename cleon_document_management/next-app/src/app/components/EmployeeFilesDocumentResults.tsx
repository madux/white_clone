"use client";

import Link from "next/link";
import { FileTypeIcon } from "./FileTypeIcon";
import type { DocDocument } from "../../../lib/types";
import type { EmployeeFilesDocumentColumnId } from "../../../lib/employeeFilesBrowsePreferences";
import { formatDocumentDateShort } from "../../../lib/formatDocumentDate";
import ListPagination from "./ListPagination";
import PersonCell from "./PersonCell";
import { tableSortMark, toggleTableSortKey } from "../../../lib/tableSortKey";
import SortableTable from "./SortableTable";
import StatusPill from "./StatusPill";
import { documentStatusDisplayLabel } from "../../../lib/documentStatusLabel";

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
  onOpenDocument?: (document: DocDocument) => void;
};

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
  onOpenDocument,
}: Props) {
  const show = (col: EmployeeFilesDocumentColumnId) => visibleColumns.includes(col);

  const headerSort = (label: string) => {
    const field = SORTABLE[label];
    if (!field) return undefined;
    return () => onSortChange(toggleTableSortKey(sortKey, field));
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
            <button
              key={doc.id}
              type="button"
              onClick={() => onOpenDocument?.(doc)}
              className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-pink-200 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <FileTypeIcon
                  name={doc.name}
                  mime_type={doc.mime_type}
                  document_type={doc.document_type}
                  source_url={doc.source_url}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{doc.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{doc.employee_name}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {doc.document_category_label ?? doc.document_type} ·{" "}
                    {documentStatusDisplayLabel(doc)}
                  </p>
                </div>
              </div>
            </button>
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
        <SortableTable
          className="ef-table dms-table--employee-files-docs min-w-[900px]"
          managedSort
        >
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
                    {tableSortMark(sortKey, "name")}
                  </button>
                </th>
              ) : null}
              {show("employee") ? (
                <th className="dms-col-employee-name">
                  <button type="button" onClick={headerSort("Employee")}>
                    Employee
                    {tableSortMark(sortKey, "employee")}
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
                    {tableSortMark(sortKey, "status")}
                  </button>
                </th>
              ) : null}
              {show("uploadDate") ? (
                <th>
                  <button type="button" onClick={headerSort("Upload date")}>
                    Upload date
                    {tableSortMark(sortKey, "upload_date")}
                  </button>
                </th>
              ) : null}
              {show("expiry") ? (
                <th>
                  <button type="button" onClick={headerSort("Expiry")}>
                    Expiry
                    {tableSortMark(sortKey, "expiry")}
                  </button>
                </th>
              ) : null}
              <th className="dms-col-actions">Open</th>
            </tr>
          </thead>
          <tbody>
            {items.map((doc) => (
              <tr
                key={doc.id}
                className={onOpenDocument ? "cursor-pointer hover:bg-slate-50/80" : undefined}
                onClick={
                  onOpenDocument
                    ? (event) => {
                        const target = event.target as HTMLElement;
                        if (target.closest("a, button")) return;
                        onOpenDocument(doc);
                      }
                    : undefined
                }
              >
                {show("name") ? (
                  <td className="dms-col-doc-name font-medium text-slate-800">
                    <button
                      type="button"
                      onClick={() => onOpenDocument?.(doc)}
                      className="inline-flex max-w-full items-center gap-2 text-left hover:text-brand-pink"
                    >
                      <FileTypeIcon
                        name={doc.name}
                        mime_type={doc.mime_type}
                        document_type={doc.document_type}
                        source_url={doc.source_url}
                        className="h-5 w-4 shrink-0"
                      />
                      <span className="truncate">{doc.name}</span>
                    </button>
                  </td>
                ) : null}
                {show("employee") ? (
                  <td className="dms-col-employee-name">
                    <PersonCell
                      name={doc.employee_name || "—"}
                      href={
                        doc.employee_id
                          ? `/pages/employee/profile?employee=${doc.employee_id}`
                          : undefined
                      }
                    />
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
                  <td>
                    <StatusPill label={documentStatusDisplayLabel(doc)} />
                  </td>
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
                  <button
                    type="button"
                    onClick={() => onOpenDocument?.(doc)}
                    className="text-xs font-bold text-brand-pink hover:underline"
                  >
                    View
                  </button>
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
