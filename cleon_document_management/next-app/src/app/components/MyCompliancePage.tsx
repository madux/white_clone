"use client";

import { AlertCircle, CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useMyCompliance } from "../../../hooks/useDocuments";

const statusStyles: Record<string, string> = {
  compliant: "bg-emerald-50 text-emerald-700",
  partial: "bg-amber-50 text-amber-700",
  non_compliant: "bg-red-50 text-red-700",
  missing: "bg-orange-50 text-orange-700",
  grace: "bg-amber-50 text-amber-700",
  complete: "bg-emerald-50 text-emerald-700",
};

export default function MyCompliancePage() {
  const compliance = useMyCompliance();
  const data = compliance.data;
  const summary = data?.summary;

  return (
    <div className="mx-auto min-h-full max-w-[1650px] space-y-6 bg-slate-50 p-6 pb-10">
      {compliance.error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Your compliance data could not be loaded. Please try again.</span>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Compliant policies", value: summary?.compliant, icon: CheckCircle2 },
          { label: "Partially compliant", value: summary?.partial, icon: Clock3 },
          { label: "Non-compliant", value: summary?.non_compliant, icon: AlertCircle },
          { label: "Outstanding items", value: summary?.outstanding_count, icon: ShieldCheck },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">{label}</p>
                {compliance.isLoading ? (
                  <div className="mt-2 h-9 w-12 animate-pulse rounded-xl bg-slate-200" />
                ) : (
                  <p className="mt-1 text-3xl font-bold text-slate-900">{value ?? 0}</p>
                )}
              </div>
              <div className="rounded-xl bg-pink-50 p-2.5 text-brand-pink">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Policy evaluations</h2>
          <p className="mt-1 text-sm text-slate-500">
            How your uploaded documents match each assigned policy.
          </p>
          {compliance.isLoading ? (
            <div className="mt-5 space-y-3">
              <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
              <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : data?.evaluations.length ? (
            <div className="mt-5 space-y-4">
              {data.evaluations.map((evaluation) => (
                <article
                  key={evaluation.id}
                  className="rounded-xl border border-slate-100 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">
                        {evaluation.policy}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        Evaluated {evaluation.evaluated_at?.slice(0, 10) || "recently"}
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${statusStyles[evaluation.status] || "bg-slate-100 text-slate-600"}`}
                    >
                      {evaluation.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>Score: {evaluation.score}%</span>
                    <span>Complete: {evaluation.complete_count}</span>
                    <span>Missing: {evaluation.missing_count}</span>
                    <span>Grace: {evaluation.grace_count}</span>
                  </div>
                  {evaluation.lines.length > 0 && (
                    <ul className="mt-4 divide-y divide-slate-50 rounded-lg border border-slate-100">
                      {evaluation.lines.map((line) => (
                        <li
                          key={line.id}
                          className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                        >
                          <span className="min-w-0 truncate text-slate-700">
                            {line.document_type}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusStyles[line.status] || "bg-slate-100 text-slate-600"}`}
                          >
                            {line.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="mt-8 text-center text-sm text-slate-400">
              No compliance evaluations are assigned to you yet.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">Outstanding requirements</h2>
          <p className="mt-1 text-sm text-slate-500">
            Documents you still need to upload or renew.
          </p>
          {compliance.isLoading ? (
            <div className="mt-5 h-24 animate-pulse rounded-xl bg-slate-100" />
          ) : data?.outstanding.length ? (
            <div className="mt-5 divide-y divide-slate-100">
              {data.outstanding.map((item, index) => (
                <div
                  key={`${item.policy}-${item.document_type}-${index}`}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {item.document_type}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{item.policy}</p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${statusStyles[item.status] || statusStyles.missing}`}
                  >
                    {item.status}
                  </span>
                </div>
              ))}
              <Link
                href="/pages/my-documents"
                className="mt-4 inline-flex text-sm font-bold text-brand-pink hover:underline"
              >
                Upload in My Documents
              </Link>
            </div>
          ) : (
            <div className="mt-8 flex flex-col items-center rounded-xl bg-slate-50 p-8 text-center">
              <CheckCircle2 className="h-7 w-7 text-brand-pink" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                All requirements complete
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
