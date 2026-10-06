"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Users } from "lucide-react";
import { api } from "../../../lib/api";
import { formatStatusLabel } from "../../../lib/formatLabel";

export default function MyTeamCompliancePage({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const team = useQuery({
    queryKey: ["compliance", "my-team"],
    queryFn: () => api.getMyTeamCompliance(),
  });
  const rows = team.data?.data?.rows ?? [];
  const attention = team.data?.data?.attention_count ?? 0;

  return (
    <div className={embedded ? "space-y-6" : "app-page space-y-6"}>
      <header>
        <h1 className="text-2xl font-bold text-slate-900">My Team</h1>
        <p className="mt-1 text-sm text-slate-500">
          Direct reports only — compliance status and what is outstanding.
        </p>
      </header>

      {team.error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          Team compliance could not be loaded.
        </div>
      )}

      <div className="app-page-metric max-w-xs">
        <span>Need attention</span>
        <strong>{team.isLoading ? "…" : attention}</strong>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Users className="h-4 w-4 text-brand-pink" />
            Team members
          </div>
        </div>
        {team.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : rows.length ? (
          <ul className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <li
                key={`${row.employee_id}-${row.policy_id}-${index}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="font-semibold text-slate-800">
                    {String(row.employee || "")}
                  </p>
                  <p className="text-xs text-slate-500">{String(row.policy || "")}</p>
                  {row.reason_message ? (
                    <p className="mt-1 text-xs text-slate-600">
                      {String(row.reason_message)}
                    </p>
                  ) : null}
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700">
                  {formatStatusLabel(String(row.status || ""))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 text-center text-sm text-slate-500">
            No compliance evaluations for your direct reports yet.
          </div>
        )}
      </div>
    </div>
  );
}
