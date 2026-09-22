"use client";

import { useEffect, useState } from "react";
import { useDocumentAcknowledgementAudience } from "../../../hooks/useDocuments";
import type { AcknowledgementDocumentNode } from "../../../lib/types";
import DocumentViewerDialog from "./DocumentViewerDialog";
import ListPagination from "./ListPagination";

const PAGE_SIZE = 10;
const baseUrl = (process.env.NEXT_PUBLIC_ODOO_URL || "").replace(/\/$/, "");

function employeeInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function AcknowledgementDocumentPanel({
  document,
}: {
  document: AcknowledgementDocumentNode;
}) {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "acknowledged" | "pending">("all");
  const [viewing, setViewing] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [status, document.document_id]);

  const audience = useDocumentAcknowledgementAudience(
    document.document_id,
    page,
    search,
    status,
  );

  const data = audience.data;

  return (
    <div className="ack-document-panel">
      <div className="ack-document-panel-header">
        <div>
          <p className="ack-document-panel-title">Audience</p>
          <p className="ack-document-panel-meta">
            {data
              ? `${data.acknowledged_count}/${data.audience_count} acknowledged · ${data.acknowledgement_percent}%`
              : `${document.acknowledged_count}/${document.audience_count} acknowledged · ${document.acknowledgement_percent}%`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setViewing(true)}
          className="employee-tree-open-link"
        >
          View document
        </button>
      </div>

      <div className="ack-document-panel-toolbar">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search employees..."
          className="ack-document-panel-search"
        />
        <div className="ack-document-panel-status">
          {([
            ["all", "All"],
            ["acknowledged", "Acknowledged"],
            ["pending", "Pending"],
          ] as const).map(([value, label]) => (
            <label key={value} className="employee-filter-checkbox">
              <input
                type="checkbox"
                checked={status === value}
                onChange={() => setStatus(value)}
                className="h-4 w-4 rounded border-slate-300 accent-pink-600"
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>

      {audience.isLoading ? (
        <div className="ack-document-panel-loading">
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-10 animate-pulse rounded-lg bg-slate-100" />
        </div>
      ) : !data?.employees.length ? (
        <p className="ack-document-panel-empty">No employees match this filter.</p>
      ) : (
        <div className="ack-document-panel-list">
          {data.employees.map((employee) => (
            <div key={`${employee.employee_id}-${employee.employee_name}`} className="ack-document-panel-row">
              <span className="employee-tree-avatar">
                {employeeInitials(employee.employee_name)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">
                  {employee.employee_name}
                </p>
                <p className="text-xs text-slate-500">
                  {employee.department || "No department"}
                </p>
              </div>
              <span
                className={`ack-percent-badge ${
                  employee.acknowledged ? "complete" : "pending"
                }`}
              >
                {employee.acknowledged
                  ? `Acknowledged ${String(employee.acknowledged_at || "").slice(0, 10)}`
                  : "Pending"}
              </span>
            </div>
          ))}
        </div>
      )}

      {data ? (
        <ListPagination
          page={data.page}
          pageSize={PAGE_SIZE}
          total={data.total}
          onPageChange={setPage}
        />
      ) : null}

      {viewing ? (
        <DocumentViewerDialog
          title={document.document_name}
          description={document.document_type}
          onClose={() => setViewing(false)}
          documentId={document.document_id}
          previewUrl={`${baseUrl}/document-management/document/${document.document_id}/preview`}
          size="5xl"
          backdropClassName="bg-slate-900/40"
          iframeMinHeight="min-h-[65vh]"
        />
      ) : null}
    </div>
  );
}
