"use client";

import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Mail,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  useComplianceRun,
  useComplianceRunEmployees,
  useCreateException,
  usePolicies,
  useSendComplianceRunRequest,
} from "../../../hooks/useDocuments";
import { api } from "../../../lib/api";
import { downloadCsv } from "../../../lib/csvExport";
import { formatFieldLabel, formatStatusLabel } from "../../../lib/formatLabel";
import type { ComplianceRunEmployee } from "../../../lib/types";
import BulkActionBar from "./BulkActionBar";
import ListPagination from "./ListPagination";
import ModalDialog from "./ModalDialog";
import SortableTable from "./SortableTable";

const STATUS_FILTERS = [
  { value: "compliant", label: "Compliant" },
  { value: "partial", label: "Partially compliant" },
  { value: "non_compliant", label: "Non-compliant" },
] as const;

const statusStyles: Record<string, string> = {
  compliant: "approved",
  partial: "pending",
  non_compliant: "danger",
  excepted: "pending",
};

function formatDateTime(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value.replace(" ", "T") + (value.endsWith("Z") ? "" : "Z")));
}

export default function ComplianceRunDetailPage() {
  const searchParams = useSearchParams();
  const runId = Number(searchParams.get("run") || 0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [viewEmployee, setViewEmployee] = useState<ComplianceRunEmployee | null>(null);
  const [requestEmployee, setRequestEmployee] = useState<ComplianceRunEmployee | null>(null);
  const [exceptionEmployee, setExceptionEmployee] = useState<ComplianceRunEmployee | null>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>([]);
  const [bulkRequestOpen, setBulkRequestOpen] = useState(false);
  const [bulkExceptionOpen, setBulkExceptionOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const run = useComplianceRun(runId);
  const employees = useComplianceRunEmployees(runId, page, search, status);
  const sendRequest = useSendComplianceRunRequest();
  const createException = useCreateException();
  const policies = usePolicies();

  const runData = run.data;
  const employeeRows = employees.data?.data ?? [];
  const total = employees.data?.total ?? 0;

  const policy = useMemo(
    () => (policies.data ?? []).find((item) => item.id === runData?.policy_id),
    [policies.data, runData?.policy_id],
  );
  const selectedEmployees = employeeRows.filter((item) =>
    selectedEmployeeIds.includes(item.employee_id),
  );
  const actionableEmployees = selectedEmployees.filter((item) =>
    ["non_compliant", "partial"].includes(item.status),
  );
  const allowWaiver = runData?.policy_allow_waiver ?? policy?.allow_waiver;
  const allPageSelected =
    employeeRows.length > 0 &&
    employeeRows.every((item) => selectedEmployeeIds.includes(item.employee_id));

  function clearEmployeeSelection() {
    setSelectedEmployeeIds([]);
  }

  function toggleEmployeeSelected(employeeId: number) {
    setSelectedEmployeeIds((current) =>
      current.includes(employeeId)
        ? current.filter((id) => id !== employeeId)
        : [...current, employeeId],
    );
  }

  function toggleAllEmployeesOnPage() {
    const ids = employeeRows.map((item) => item.employee_id);
    setSelectedEmployeeIds(allPageSelected ? [] : ids);
  }

  async function handleExport() {
    if (!runId) return;
    setExporting(true);
    try {
      const response = await api.exportComplianceRun(runId, {
        search,
        status: status === "all" ? undefined : status,
      });
      const rows = response.data.map((item) => [
        item.employee,
        item.department,
        formatStatusLabel(item.status),
        item.required_count,
        item.submitted_count,
        item.missing_count,
        item.score,
        ...(item.lines ?? []).flatMap((line: { document_type?: string; status: string }) => [
          line.document_type || "",
          formatStatusLabel(line.status),
        ]),
      ]);
      downloadCsv(
        `compliance-run-${runId}.csv`,
        [
          "Employee",
          "Department",
          "Status",
          "Required",
          "Submitted",
          "Missing",
          "Score",
        ],
        rows.map((row) => row.slice(0, 7)),
      );
    } finally {
      setExporting(false);
    }
  }

  if (!runId) {
    return (
      <div className="mx-auto max-w-[1650px] p-6">
        <p className="text-sm text-red-600">No run selected.</p>
        <Link href="/pages/compliance" className="mt-4 inline-flex text-sm font-semibold text-brand-pink">
          Back to compliance
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-full max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/pages/compliance"
            className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-brand-pink"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to compliance
          </Link>
          <h1 className="text-2xl font-bold text-slate-900">{runData?.policy || "Policy run"}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatFieldLabel(runData?.run_type || "manual")} ·{" "}
            {runData?.evaluated_at ? formatDateTime(runData.evaluated_at) : "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={exporting || !runData?.has_snapshots}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:border-brand-pink/30 disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      {(run.error || employees.error) && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Run details could not be loaded. Please try again.</span>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Total employees", value: runData?.employee_count },
          { label: "Fully compliant", value: runData?.compliant_count },
          { label: "Partially compliant", value: runData?.partial_count },
          { label: "Non-compliant", value: runData?.non_compliant_count },
        ].map(({ label, value }, index) => {
          const isFirst = index === 0;
          return (
            <div
              key={label}
              className={`rounded-2xl border border-slate-200 p-5 shadow-sm ${
                isFirst
                  ? "bg-gradient-to-br from-brand-text to-brand-pink text-white shadow-lg shadow-pink-200"
                  : "bg-white"
              }`}
            >
              <p className={`text-sm font-medium ${isFirst ? "text-white/90" : "text-slate-600"}`}>
                {label}
              </p>
              <p className={`mt-1 text-3xl font-bold ${isFirst ? "text-white" : "text-slate-900"}`}>
                {value ?? 0}
              </p>
            </div>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative block min-w-[240px] flex-1 sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                  clearEmployeeSelection();
                }}
                placeholder="Search employees..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-brand-pink/40 focus:ring-4 focus:ring-brand-pink/10"
              />
            </label>
            <button
              type="button"
              aria-expanded={filtersExpanded}
              aria-controls="run-employee-filters"
              onClick={() => setFiltersExpanded((current) => !current)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-brand-pink hover:text-brand-pink"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {status !== "all" ? (
                <span className="rounded-full bg-brand-pink px-2 py-0.5 text-[11px] font-bold text-white">
                  1
                </span>
              ) : null}
            </button>
            {status !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setStatus("all");
                  setPage(1);
                  clearEmployeeSelection();
                }}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 hover:text-brand-pink"
              >
                <X className="h-3.5 w-3.5" />
                Clear all
              </button>
            ) : null}
          </div>
          {filtersExpanded ? (
            <div
              id="run-employee-filters"
              className="employee-filter-panel"
              role="region"
              aria-label="Employee status filters"
            >
              <section className="employee-filter-section">
                <h3 className="employee-filter-section-title">Compliance status</h3>
                <div className="employee-filter-options">
                  {STATUS_FILTERS.map((option) => (
                    <label key={option.value} className="employee-filter-checkbox">
                      <input
                        type="checkbox"
                        checked={status === option.value}
                        onChange={() => {
                          setStatus(status === option.value ? "all" : option.value);
                          setPage(1);
                          clearEmployeeSelection();
                        }}
                        className="h-4 w-4 rounded border-slate-300 accent-pink-600"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
        </div>

        {!runData?.has_snapshots ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No employee snapshot data is available for this run. Re-run the policy to capture per-employee results.
          </div>
        ) : (
          <>
            <BulkActionBar
              count={selectedEmployeeIds.length}
              onClear={clearEmployeeSelection}
            >
              <button
                type="button"
                disabled={actionableEmployees.length === 0}
                onClick={() => setBulkRequestOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-brand-text disabled:opacity-50"
              >
                <Mail className="h-3.5 w-3.5" />
                Send request
              </button>
              {allowWaiver ? (
                <button
                  type="button"
                  disabled={actionableEmployees.length === 0}
                  onClick={() => setBulkExceptionOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Grant exception
                </button>
              ) : null}
            </BulkActionBar>
            <div className="overflow-x-auto">
              <SortableTable className="w-full min-w-[900px] text-left">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  <tr>
                    <th className="w-10 px-5 py-4">
                      <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={toggleAllEmployeesOnPage}
                        className="h-4 w-4 accent-pink-600"
                        aria-label="Select all employees on this page"
                      />
                    </th>
                    {["Name", "Department", "Status", "Required", "Submitted", "Missing"].map(
                      (header) => (
                        <th key={header} className="px-5 py-4">{header}</th>
                      ),
                    )}
                    <th className="table-actions-header px-5 py-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.isLoading ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">
                        Loading employees...
                      </td>
                    </tr>
                  ) : employeeRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">
                        No employees match your filters.
                      </td>
                    </tr>
                  ) : (
                    employeeRows.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100 hover:bg-pink-50/30">
                        <td className="cell w-10">
                          <input
                            type="checkbox"
                            checked={selectedEmployeeIds.includes(item.employee_id)}
                            onChange={() => toggleEmployeeSelected(item.employee_id)}
                            className="h-4 w-4 accent-pink-600"
                            aria-label={`Select ${item.employee}`}
                          />
                        </td>
                        <td className="cell"><b>{item.employee}</b></td>
                        <td className="cell">{item.department || "—"}</td>
                        <td className="cell">
                          <span className={`status ${statusStyles[item.status] || "pending"}`}>
                            {formatStatusLabel(item.status)}
                          </span>
                        </td>
                        <td className="cell">{item.required_count}</td>
                        <td className="cell">{item.submitted_count}</td>
                        <td className="cell">{item.missing_count}</td>
                        <td className="cell table-actions-cell">
                          <div className="table-actions-group">
                            <button
                              type="button"
                              className="row-action"
                              title="View details"
                              onClick={async () => {
                                const detail = await api.getComplianceRunEmployee(runId, item.employee_id);
                                setViewEmployee(detail);
                              }}
                            >
                              <Eye />
                            </button>
                            {["non_compliant", "partial"].includes(item.status) && (
                              <button
                                type="button"
                                className="row-action"
                                title="Send request"
                                onClick={() => setRequestEmployee(item)}
                              >
                                <Mail />
                              </button>
                            )}
                            {["non_compliant", "partial"].includes(item.status) &&
                              (runData?.policy_allow_waiver ?? policy?.allow_waiver) && (
                                <button
                                  type="button"
                                  className="row-action text-emerald-600"
                                  title="Grant exception"
                                  onClick={() => setExceptionEmployee(item)}
                                >
                                  <ShieldCheck />
                                </button>
                              )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </SortableTable>
            </div>
            <ListPagination
              page={page}
              pageSize={10}
              total={total}
              onPageChange={(nextPage) => {
                setPage(nextPage);
                clearEmployeeSelection();
              }}
            />
          </>
        )}
      </section>

      {viewEmployee && runData && (
        <ViewEmployeeModal
          employee={viewEmployee}
          policyName={runData.policy}
          onClose={() => setViewEmployee(null)}
        />
      )}
      {requestEmployee && runData && (
        <RequestEmployeeModal
          policyName={runData.policy}
          employee={requestEmployee}
          pending={sendRequest.isPending}
          onClose={() => setRequestEmployee(null)}
          onSubmit={async (payload) => {
            await sendRequest.mutateAsync({ runId, ...payload });
            setRequestEmployee(null);
          }}
        />
      )}
      {exceptionEmployee && runData && (
        <ExceptionEmployeeModal
          employee={exceptionEmployee}
          policyId={runData.policy_id}
          policies={policies.data ?? []}
          pending={createException.isPending}
          onClose={() => setExceptionEmployee(null)}
          onSubmit={async (payload) => {
            await createException.mutateAsync(payload);
            setExceptionEmployee(null);
          }}
        />
      )}
      {bulkRequestOpen && runData && (
        <BulkRequestModal
          policyName={runData.policy}
          employees={actionableEmployees}
          pending={sendRequest.isPending}
          onClose={() => setBulkRequestOpen(false)}
          onSubmit={async (payload) => {
            for (const employee of actionableEmployees) {
              await sendRequest.mutateAsync({
                runId,
                employee_id: employee.employee_id,
                ...payload,
              });
            }
            setBulkRequestOpen(false);
            clearEmployeeSelection();
          }}
        />
      )}
      {bulkExceptionOpen && runData && (
        <BulkExceptionModal
          employees={actionableEmployees}
          policyId={runData.policy_id}
          policies={policies.data ?? []}
          pending={createException.isPending}
          onClose={() => setBulkExceptionOpen(false)}
          onSubmit={async (payload) => {
            await createException.mutateAsync({
              employee_ids: actionableEmployees.map((item) => item.employee_id),
              policy_id: runData.policy_id,
              ...payload,
            });
            setBulkExceptionOpen(false);
            clearEmployeeSelection();
          }}
        />
      )}
    </div>
  );
}

function employeeInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function lineStatusMeta(status: string) {
  if (status === "complete") {
    return { label: "Present", className: "approved" };
  }
  if (status === "missing") {
    return { label: "Missing", className: "danger" };
  }
  if (status === "grace") {
    return { label: "Grace period", className: "pending" };
  }
  if (status === "excepted") {
    return { label: "Excepted", className: "pending" };
  }
  return { label: formatStatusLabel(status), className: "pending" };
}

function employeeStatusMeta(status: string) {
  if (status === "compliant") return { label: "Compliant", className: "approved" };
  if (status === "non_compliant") return { label: "Non-compliant", className: "danger" };
  if (status === "partial") return { label: "Partially compliant", className: "pending" };
  if (status === "excepted") return { label: "Excepted", className: "pending" };
  return { label: formatStatusLabel(status), className: "pending" };
}

function ViewEmployeeModal({
  employee,
  policyName,
  onClose,
}: {
  employee: ComplianceRunEmployee;
  policyName: string;
  onClose: () => void;
}) {
  const lines = employee.lines ?? [];
  const statusMeta = employeeStatusMeta(employee.status);
  const score = Math.min(Math.max(employee.score, 0), 100);

  return (
    <ModalDialog
      title="Employee Compliance Details"
      description={policyName}
      onClose={onClose}
      size="5xl"
      headerActions={
        <span className={`status ${statusMeta.className}`}>
          {statusMeta.label}
        </span>
      }
    >
      <div className="space-y-5">
        <section className="compliance-detail-stats" aria-label="Compliance summary">
          <article className="compliance-detail-stat compliance-detail-stat--profile">
            <div className="compliance-detail-avatar">{employeeInitials(employee.employee)}</div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{employee.employee}</p>
              <p className="truncate text-[11px] leading-snug text-slate-500">
                {employee.department || "No department"}
              </p>
              {employee.job_title ? (
                <p className="truncate text-[11px] leading-snug text-slate-400">
                  {employee.job_title}
                </p>
              ) : null}
            </div>
          </article>

          <article className="compliance-detail-stat">
            <p className="compliance-detail-stat-label">Compliance rate</p>
            <p className="compliance-detail-stat-value">{score}%</p>
            <div className="compliance-detail-progress">
              <div
                className="compliance-detail-progress-bar"
                style={{ width: `${score}%` }}
              />
            </div>
          </article>

          {[
            { label: "Required", value: employee.required_count },
            { label: "Submitted", value: employee.submitted_count },
            { label: "Missing", value: employee.missing_count },
          ].map(({ label, value }) => (
            <article key={label} className="compliance-detail-stat">
              <p className="compliance-detail-stat-label">{label}</p>
              <p className="compliance-detail-stat-value">{value}</p>
            </article>
          ))}
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-pink" />
              <h3 className="text-sm font-bold text-slate-900">Document breakdown</h3>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {lines.length} document{lines.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Document type</th>
                  <th className="px-4 py-3">Requirement</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Matched document</th>
                </tr>
              </thead>
              <tbody>
                {lines.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-slate-400">
                      No document requirements recorded for this run.
                    </td>
                  </tr>
                ) : (
                  lines.map((line) => {
                    const lineStatus = lineStatusMeta(line.status);
                    const matched =
                      line.document_names?.filter(Boolean).join(", ") ||
                      (line.matched_count > 0 ? `${line.matched_count} matched` : "");
                    return (
                      <tr key={line.id} className="border-t border-slate-100 hover:bg-pink-50/30">
                        <td className="cell">
                          <b>{line.document_type || line.requirement || "—"}</b>
                        </td>
                        <td className="cell">
                          <span className="compliance-requirement-mandatory">Mandatory</span>
                        </td>
                        <td className="cell">
                          <span className={`status ${lineStatus.className} items-center gap-1`}>
                            {line.status === "complete" ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            ) : null}
                            {lineStatus.label}
                          </span>
                        </td>
                        <td className="cell">
                          {matched ? (
                            <span className="text-slate-700">{matched}</span>
                          ) : (
                            <span className="text-slate-400">Not found</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <Link
            href={`/pages/employee/profile?employee=${employee.employee_id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-200 transition hover:brightness-105"
          >
            Open employee profile
          </Link>
        </div>
      </div>
    </ModalDialog>
  );
}

function BulkRequestModal({
  policyName,
  employees,
  pending,
  onClose,
  onSubmit,
}: {
  policyName: string;
  employees: ComplianceRunEmployee[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    due_date: string;
    subject: string;
    message: string;
  }) => Promise<void>;
}) {
  const [dueDate, setDueDate] = useState("");
  const [subject, setSubject] = useState(`Compliance request: ${policyName}`);
  const [message, setMessage] = useState(
    `Dear colleague,\n\nPlease submit the following missing documents for ${policyName}:\n{{missing_documents}}\n\nDue date: {{due_date}}\n\nThank you.`,
  );
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit({ due_date: dueDate, subject, message });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Requests could not be sent.",
      );
    }
  }

  return (
    <ModalDialog
      title="Send bulk compliance request"
      eyebrow={`${employees.length} employee${employees.length === 1 ? "" : "s"}`}
      onClose={onClose}
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="grid gap-4">
        <p className="text-sm text-slate-500">
          A personalized request will be sent to each selected non-compliant employee.
        </p>
        <label>
          <span className="label">Due date</span>
          <input
            required
            type="date"
            className="field"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>
        <label>
          <span className="label">Subject</span>
          <input
            required
            className="field"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </label>
        <label>
          <span className="label">Message</span>
          <textarea
            required
            className="field min-h-32"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500">
            Cancel
          </button>
          <button
            disabled={pending || employees.length === 0}
            className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-5 py-2.5 text-sm font-semibold text-white"
          >
            {pending ? "Sending..." : "Send requests"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

function BulkExceptionModal({
  employees,
  policyId,
  policies,
  pending,
  onClose,
  onSubmit,
}: {
  employees: ComplianceRunEmployee[];
  policyId: number;
  policies: { id: number; name: string }[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: { reason: string; valid_until: string }) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit({ reason, valid_until: validUntil });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Exceptions could not be created.",
      );
    }
  }

  return (
    <ModalDialog
      title="Grant bulk exception"
      eyebrow={`${employees.length} employee${employees.length === 1 ? "" : "s"}`}
      onClose={onClose}
      size="2xl"
    >
      <form onSubmit={handleSubmit} className="grid gap-4">
        <label>
          <span className="label">Policy</span>
          <input
            className="field"
            value={policies.find((item) => item.id === policyId)?.name || "Policy"}
            readOnly
          />
        </label>
        <label>
          <span className="label">Reason</span>
          <textarea
            required
            className="field min-h-24"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <label>
          <span className="label">Valid until</span>
          <input
            required
            type="date"
            className="field"
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500">
            Cancel
          </button>
          <button
            disabled={pending || employees.length === 0}
            className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-5 py-2.5 text-sm font-semibold text-white"
          >
            {pending ? "Saving..." : "Create exceptions"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

function RequestEmployeeModal({
  policyName,
  employee,
  pending,
  onClose,
  onSubmit,
}: {
  policyName: string;
  employee: ComplianceRunEmployee;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    employee_id: number;
    due_date: string;
    subject: string;
    message: string;
  }) => Promise<void>;
}) {
  const [dueDate, setDueDate] = useState("");
  const [subject, setSubject] = useState(`Compliance request: ${policyName}`);
  const [message, setMessage] = useState(
    `Dear ${employee.employee},\n\nPlease submit the following missing documents for ${policyName}:\n{{missing_documents}}\n\nDue date: {{due_date}}\n\nThank you.`,
  );
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit({
        employee_id: employee.employee_id,
        due_date: dueDate,
        subject,
        message,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Request could not be sent.",
      );
    }
  }

  return (
    <ModalDialog title="Send compliance request" eyebrow={employee.employee} onClose={onClose} size="2xl">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <label>
          <span className="label">Due date</span>
          <input
            required
            type="date"
            className="field"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </label>
        <label>
          <span className="label">Subject</span>
          <input
            required
            className="field"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
          />
        </label>
        <label>
          <span className="label">Message</span>
          <textarea
            required
            className="field min-h-32"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">
            Use {"{{missing_documents}}"} and {"{{due_date}}"} as placeholders.
          </p>
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500">
            Cancel
          </button>
          <button
            disabled={pending}
            className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-5 py-2.5 text-sm font-semibold text-white"
          >
            {pending ? "Sending..." : "Send request"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}

function ExceptionEmployeeModal({
  employee,
  policyId,
  policies,
  pending,
  onClose,
  onSubmit,
}: {
  employee: ComplianceRunEmployee;
  policyId: number;
  policies: { id: number; name: string }[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await onSubmit({
        employee_ids: [employee.employee_id],
        policy_id: policyId,
        reason,
        valid_until: validUntil,
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Exception could not be created.",
      );
    }
  }

  return (
    <ModalDialog title="Grant exception" eyebrow={employee.employee} onClose={onClose} size="2xl">
      <form onSubmit={handleSubmit} className="grid gap-4">
        <label>
          <span className="label">Policy</span>
          <input
            className="field"
            value={policies.find((item) => item.id === policyId)?.name || "Policy"}
            readOnly
          />
        </label>
        <label>
          <span className="label">Reason</span>
          <textarea
            required
            className="field min-h-24"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <label>
          <span className="label">Valid until</span>
          <input
            required
            type="date"
            className="field"
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500">
            Cancel
          </button>
          <button
            disabled={pending}
            className="rounded-xl bg-gradient-to-br from-brand-text to-brand-pink px-5 py-2.5 text-sm font-semibold text-white"
          >
            {pending ? "Saving..." : "Create exception"}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
