"use client";

import Link from "next/link";
import { AlertTriangle, Download, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ListPagination from "./ListPagination";
import { api } from "../../../lib/api";
import { EMPLOYEE_FILE_LIST_PAGE_SIZE } from "../../../lib/employeeFileListPageSize";
import {
  useEmployeeFileIssueAction,
  useEmployeeFileIssues,
  useEmployeeFilesHomeStats,
} from "../../../hooks/useEmployeeFiles";
import SectionTabs from "./SectionTabs";

const PAGE_CLASS =
  "min-h-full mx-auto w-full max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10";

const TABS = [
  { id: "all", label: "All" },
  { id: "inactive", label: "Inactive" },
  { id: "test_employee", label: "Test employee" },
  { id: "manually_excluded", label: "Manually excluded" },
  { id: "initialization_failed", label: "Initialization failed" },
  { id: "unresolved_data", label: "Unresolved data issue" },
];

function classificationBadge(classification: string) {
  switch (classification) {
    case "inactive":
    case "test_employee":
    case "manually_excluded":
      return "border-slate-200 bg-slate-50 text-slate-700";
    case "initialization_failed":
      return "border-red-200 bg-red-50 text-red-800";
    case "unresolved_data":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

export default function EmployeeFilesIssuesPage() {
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);
  const issues = useEmployeeFileIssues(category, page, EMPLOYEE_FILE_LIST_PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [category]);
  const stats = useEmployeeFilesHomeStats();
  const action = useEmployeeFileIssueAction();

  const rows = issues.data?.data ?? [];
  const listTotal = issues.data?.total ?? 0;
  const totalOpen = issues.data?.summary.total ?? stats.data?.needs_attention ?? 0;
  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of issues.data?.summary.categories ?? []) {
      map.set(row.category, row.count);
    }
    return map;
  }, [issues.data?.summary.categories]);

  return (
    <div className={PAGE_CLASS}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
            Employee Files
          </p>
          <Link
            href="/pages/employee"
            className="mt-1 inline-block text-sm font-semibold text-brand-pink hover:underline"
          >
            ← Back to home
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            Issues &amp; reconciliation
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Open items from setup and EMS sync that need HR or document admin follow-up.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => api.downloadEmployeeFileIssuesReport()}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-pink-200 hover:bg-pink-50/50 hover:text-brand-text"
          >
            <Download className="h-4 w-4" />
            Download report
          </button>
          {totalOpen > 0 ? (
            <div
              className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/90 to-white px-5 py-3 shadow-sm"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-amber-600 shadow-sm">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-800/80">
                  Open items
                </p>
                <p className="text-2xl font-bold tabular-nums text-amber-950">{totalOpen}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {stats.data ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat label="EMS employees" value={stats.data.ems_employees} />
          <MiniStat label="Employee files" value={stats.data.employee_files_initialized} />
          <MiniStat label="Synced" value={stats.data.successfully_synced} highlight />
          <MiniStat label="Needs attention" value={stats.data.needs_attention} warn />
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <SectionTabs
          ariaLabel="Issue classifications"
          value={category}
          onChange={setCategory}
          items={TABS.map((tab) => ({
            ...tab,
            label:
              tab.id === "all"
                ? tab.label
                : `${tab.label}${categoryCounts.get(tab.id) ? ` (${categoryCounts.get(tab.id)})` : ""}`,
          }))}
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {issues.isLoading ? (
          <div className="flex items-center justify-center gap-2 px-6 py-16 text-sm text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-brand-pink" />
            Loading issues…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm font-semibold text-slate-800">No open items in this category</p>
            <p className="mt-1 text-sm text-slate-500">
              {category === "all"
                ? "Everything reconciled for now."
                : "Try another category or return after the next EMS sync."}
            </p>
            <Link
              href="/pages/employee"
              className="mt-6 inline-flex rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(232,62,140,0.18)]"
            >
              Open Employee Files
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3.5">Issue</th>
                    <th className="px-5 py-3.5">Employee</th>
                    <th className="px-5 py-3.5">Details</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((issue) => {
                    const classification =
                      issue.classification ?? issue.category ?? "unresolved_data";
                    const classificationLabel =
                      issue.classification_label ??
                      TABS.find((t) => t.id === classification)?.label ??
                      classification.replace(/_/g, " ");
                    const rowKey = `${issue.source ?? "issue"}-${issue.id}`;

                    return (
                      <tr key={rowKey} className="transition hover:bg-pink-50/20">
                        <td className="px-5 py-4 align-top">
                          <p className="font-semibold text-slate-900">{issue.name}</p>
                          <span
                            className={`mt-2 inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${classificationBadge(classification)}`}
                          >
                            {classificationLabel}
                          </span>
                        </td>
                        <td className="px-5 py-4 align-top text-slate-700">
                          {issue.employee_id ? (
                            <Link
                              href={`/pages/employee/profile?employee=${issue.employee_id}`}
                              className="font-medium text-brand-pink hover:underline"
                            >
                              {issue.employee_name || `Employee #${issue.employee_id}`}
                            </Link>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="max-w-md px-5 py-4 align-top text-slate-600">
                          <p className="line-clamp-3 leading-relaxed">{issue.details || "—"}</p>
                        </td>
                        <td className="px-5 py-4 align-top text-right">
                          {issue.source === "exclusion" ? (
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-500">
                              Excluded
                            </span>
                          ) : issue.recommended_action === "view_in_ems" ? (
                            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
                              View in EMS
                            </span>
                          ) : issue.recommended_action === "none" ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <button
                              type="button"
                              disabled={action.isPending}
                              className="inline-flex rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-semibold text-brand-text transition hover:bg-pink-100 disabled:opacity-50"
                              onClick={() =>
                                action.mutate({
                                  id: issue.id,
                                  action: issue.recommended_action,
                                })
                              }
                            >
                              {issue.recommended_action === "retry" ? "Retry" : "Resolve"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 px-5 py-4">
              <ListPagination
                page={page}
                pageSize={EMPLOYEE_FILE_LIST_PAGE_SIZE}
                total={listTotal}
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function MiniStat({
  label,
  value,
  highlight,
  warn,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 ${
        warn && value > 0
          ? "border-amber-200 bg-amber-50/60"
          : highlight
            ? "border-pink-100 bg-pink-50/40"
            : "border-slate-200 bg-white"
      }`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
