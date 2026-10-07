"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { api } from "../../../lib/api";
import EmptyState from "./EmptyState";
import PersonCell from "./PersonCell";
import SectionTabs from "./SectionTabs";
import StatusPill from "./StatusPill";

type TeamRow = {
  employee_id: number;
  employee: string;
  status: string;
  reason_message?: string;
  policy: string;
  policy_id: number;
};

const ATTENTION_STATUSES = new Set([
  "non_compliant",
  "at_risk",
  "partial",
  "pending",
  "non-compliant",
]);

function rowNeedsAttention(status: string) {
  const key = String(status || "").toLowerCase().replace(/-/g, "_");
  return ATTENTION_STATUSES.has(key);
}

function MetricCard({
  label,
  value,
  icon: Icon,
  highlight,
  variant = "default",
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
  highlight?: boolean;
  variant?: "default" | "success" | "warning";
}) {
  const iconWrap =
    variant === "success"
      ? "bg-emerald-50 text-emerald-600"
      : variant === "warning"
        ? "bg-amber-50 text-amber-700"
        : highlight
          ? "bg-red-50 text-red-600"
          : "bg-pink-50 text-brand-pink";

  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm ${
        highlight ? "border-red-200 ring-1 ring-red-100" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p
            className={`mt-1 text-3xl font-bold tracking-tight ${
              highlight ? "text-red-700" : "text-slate-900"
            }`}
          >
            {value}
          </p>
        </div>
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconWrap}`}
        >
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}

export default function MyTeamCompliancePage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const team = useQuery({
    queryKey: ["compliance", "my-team"],
    queryFn: () => api.getMyTeamCompliance(),
  });
  const rows = (team.data?.data?.rows ?? []) as TeamRow[];
  const attention = team.data?.data?.attention_count ?? 0;
  const [filter, setFilter] = useState<"all" | "attention">("all");

  const stats = useMemo(() => {
    const employeeIds = new Set(rows.map((row) => row.employee_id));
    const compliantRows = rows.filter((row) => {
      const s = String(row.status || "").toLowerCase();
      return s === "compliant" || s === "exempt";
    });
    const employeesNeedingAttention = new Set(
      rows.filter((row) => rowNeedsAttention(row.status)).map((row) => row.employee_id),
    );
    return {
      directReports: employeeIds.size,
      policyEvaluations: rows.length,
      compliantCount: compliantRows.length,
      reportsNeedingAttention: employeesNeedingAttention.size,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (filter === "attention") {
      return rows.filter((row) => rowNeedsAttention(row.status));
    }
    return rows;
  }, [filter, rows]);

  const tabItems = useMemo(
    () => [
      { id: "all" as const, label: "All", count: rows.length },
      { id: "attention" as const, label: "Need attention", count: attention },
    ],
    [attention, rows.length],
  );

  return (
    <div className={embedded ? "space-y-6" : "app-page space-y-6"}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Team</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            Direct reports only — see who is compliant and what still needs action
            across assigned policies.
          </p>
        </div>
        {attention > 0 ? (
          <div
            className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-900"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {attention} evaluation{attention === 1 ? "" : "s"} need attention
          </div>
        ) : rows.length ? (
          <div
            className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Team looks clear
          </div>
        ) : null}
      </header>

      {team.error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          Team compliance could not be loaded.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Direct reports"
          value={team.isLoading ? "…" : stats.directReports}
          icon={Users}
        />
        <MetricCard
          label="Need attention"
          value={team.isLoading ? "…" : attention}
          icon={AlertTriangle}
          highlight={attention > 0}
          variant={attention > 0 ? "warning" : "default"}
        />
        <MetricCard
          label="Compliant evaluations"
          value={team.isLoading ? "…" : stats.compliantCount}
          icon={ShieldCheck}
          variant="success"
        />
        <MetricCard
          label="Reports with gaps"
          value={team.isLoading ? "…" : stats.reportsNeedingAttention}
          icon={AlertCircle}
          highlight={stats.reportsNeedingAttention > 0}
        />
      </div>

      <SectionTabs
        level="nested"
        ariaLabel="Team compliance filters"
        value={filter}
        onChange={(value) => setFilter(value as "all" | "attention")}
        items={tabItems}
      />

      <section className="app-page-body ef-table overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Users className="h-4 w-4 text-brand-pink" />
            Policy status by team member
          </div>
          <p className="mt-1 text-xs text-slate-500">
            One row per employee and policy evaluation. Open a profile to review
            documents.
          </p>
        </div>

        {team.isLoading ? (
          <EmptyState title="Loading team compliance…" loading />
        ) : filteredRows.length ? (
          <div className="overflow-x-auto">
            <table className="dms-table ef-table min-w-[720px]">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Policy</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th className="dms-col-actions">Profile</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => {
                  const needsAttention = rowNeedsAttention(row.status);
                  return (
                    <tr
                      key={`${row.employee_id}-${row.policy_id}-${index}`}
                      className={
                        needsAttention
                          ? "bg-amber-50/40 hover:bg-amber-50/60"
                          : "hover:bg-pink-50/20"
                      }
                    >
                      <td>
                        <PersonCell
                          name={String(row.employee || "—")}
                          subtitle={
                            needsAttention ? "Action may be required" : "Direct report"
                          }
                          href={`/pages/employee/profile?employee=${row.employee_id}`}
                        />
                      </td>
                      <td className="text-sm font-medium text-slate-800">
                        {String(row.policy || "—")}
                      </td>
                      <td>
                        <StatusPill
                          label={String(row.status || "unknown")}
                          tone={needsAttention ? "attention" : undefined}
                        />
                      </td>
                      <td className="max-w-xs text-sm text-slate-600">
                        {row.reason_message ? (
                          <span className="line-clamp-2">{String(row.reason_message)}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="dms-col-actions">
                        <Link
                          href={`/pages/employee/profile?employee=${row.employee_id}`}
                          className="app-btn app-btn-secondary text-xs"
                        >
                          View file
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : rows.length && filter === "attention" ? (
          <EmptyState
            icon={CheckCircle2}
            title="Nothing needs attention"
            description="All visible evaluations for your direct reports are in good shape."
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No team compliance data yet"
            description="When policies are evaluated for your direct reports, their status will show up here."
          />
        )}
      </section>
    </div>
  );
}
