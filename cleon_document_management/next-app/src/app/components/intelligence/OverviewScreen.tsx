"use client";

import {
  AlertTriangle,
  ClipboardCheck,
  MessageSquareText,
  Plus,
} from "lucide-react";
import Link from "next/link";
import {
  useControlIntelligenceJob,
  useIntelligenceOverview,
} from "../../../../hooks/useIntelligence";
import {
  DemoBadge,
  IntelligenceEmpty,
  IntelligenceError,
  IntelligenceLoading,
} from "./states";

function metricValue(value: number | null) {
  return value == null ? "—" : `${value}%`;
}

export default function OverviewScreen() {
  const overview = useIntelligenceOverview();
  const control = useControlIntelligenceJob();
  const data = overview.data;
  const metrics = data?.metrics;
  const jobs = data?.jobs || [];
  const failed = data?.attention.failed || [];
  const expiring = data?.attention.expiring || [];
  const probation = data?.attention.probation || [];

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
        <Link
          href="/pages/document-intelligence/datasets/new"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-3 text-sm font-medium text-white shadow-lg shadow-pink-200"
        >
          <Plus className="h-4 w-4" />
          New Extraction
        </Link>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Link
          href="/pages/document-intelligence/ask"
          className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-pink-200"
        >
          <MessageSquareText className="h-5 w-5 text-brand-pink" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">Ask AI</h2>
          <p className="mt-1 text-sm text-slate-500">
            Query approved records with source citations.
          </p>
        </Link>
        <Link
          href="/pages/document-intelligence/validate"
          className="rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-pink-200"
        >
          <ClipboardCheck className="h-5 w-5 text-brand-pink" />
          <h2 className="mt-3 text-lg font-bold text-slate-900">Validate</h2>
          <p className="mt-1 text-sm text-slate-500">
            {data?.queue_count
              ? `${data.queue_count} record(s) waiting for review.`
              : "Review extracted fields beside the original document."}
          </p>
        </Link>
        <Link
          href="/pages/document-intelligence/datasets/new"
          className="rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-text to-brand-pink p-5 text-white shadow-lg shadow-pink-200"
        >
          <Plus className="h-5 w-5" />
          <h2 className="mt-3 text-lg font-bold">New Extraction</h2>
          <p className="mt-1 text-sm text-white/80">
            Configure a dataset and run the extraction pipeline.
          </p>
        </Link>
      </section>

      {overview.isError ? (
        <IntelligenceError message="Overview data could not be loaded." />
      ) : null}

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: "Extraction accuracy",
            value: metricValue(metrics?.extraction_accuracy ?? null),
            real: metrics?.extraction_source === "reviewed",
            note:
              metrics?.extraction_source === "reviewed"
                ? `Share of ${data?.reviewed_count || 0} reviewed records that were approved or overridden.`
                : "Not calculated from reviewed records yet.",
          },
          {
            label: "Classification accuracy",
            value: metricValue(metrics?.classification_accuracy ?? null),
            real: false,
            note:
              metrics?.classification_source === "estimated"
                ? "Average classification confidence on approved records. Estimated until humans confirm types."
                : "Not calculated from reviewed records yet.",
          },
          {
            label: "Data quality",
            value: metricValue(metrics?.data_quality ?? null),
            real: metrics?.data_quality_source === "approved",
            note:
              metrics?.data_quality_source === "approved"
                ? `Share of ${data?.approved_count || 0} approved records with no remaining validation issues.`
                : "Not calculated from approved records yet.",
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">{metric.label}</p>
              {metric.real ? null : <DemoBadge />}
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{metric.value}</p>
            <p className="mt-2 text-xs text-slate-400">{metric.note}</p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold text-slate-900">Recent jobs</h2>
        <p className="mt-1 text-sm text-slate-500">
          Progress updates automatically while a job is queued or running.
        </p>
        <div className="mt-6">
          {overview.isLoading ? (
            <IntelligenceLoading />
          ) : jobs.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2">Job</th>
                    <th className="py-2">Dataset</th>
                    <th className="py-2">Source</th>
                    <th className="py-2">Docs</th>
                    <th className="py-2">Owner</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Progress</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-t border-slate-100">
                      <td className="py-3">#{job.id}</td>
                      <td className="py-3">{job.dataset}</td>
                      <td className="py-3 capitalize">{job.source || "—"}</td>
                      <td className="py-3">
                        {job.processed_count}/{job.document_count}
                      </td>
                      <td className="py-3">{job.owner_name || "—"}</td>
                      <td className="py-3">
                        <span
                          className={`status ${
                            ["queued", "running", "paused", "needs_review"].includes(
                              job.state,
                            )
                              ? "pending"
                              : job.state === "failed"
                                ? ""
                                : ""
                          }`}
                        >
                          {job.state.replace(/_/g, " ")}
                        </span>
                        {job.error_message ? (
                          <p className="mt-1 max-w-xs text-xs text-amber-700">
                            {job.error_message}
                          </p>
                        ) : null}
                      </td>
                      <td className="py-3">{job.progress ?? 0}%</td>
                      <td className="py-3 text-right">
                        <JobActions
                          job={job}
                          busy={control.isPending}
                          onAction={(action) =>
                            control.mutate({ action, id: job.id })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <IntelligenceEmpty
              title="No extraction jobs"
              description="Create a dataset and run extraction against Organizational or Employee Files."
              action={
                <Link
                  href="/pages/document-intelligence/datasets/new"
                  className="inline-flex items-center gap-2 rounded-full border border-brand-pink px-4 py-2 text-sm font-semibold text-brand-pink"
                >
                  Start a dataset
                </Link>
              }
            />
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <AttentionCard
          title="Failed extraction"
          empty="No failed jobs right now."
          items={failed.map((item) => ({
            title: item.dataset,
            detail: item.reason,
            href: "/pages/document-intelligence/datasets",
          }))}
        />
        <AttentionCard
          title="Expiring contracts"
          empty="No approved contract end dates in the next 60 days."
          items={expiring.map((item) => ({
            title: item.document,
            detail: `${item.employee || "No employee"} · ${item.field} ${item.date}`,
            href: "/pages/document-intelligence/validate",
          }))}
        />
        <AttentionCard
          title="Probation alerts"
          empty="No approved probation dates yet. Add a probation field to a profile to populate this card."
          items={probation.map((item) => ({
            title: item.document,
            detail: `${item.employee || "No employee"} · ${item.date}`,
            href: "/pages/document-intelligence/ask",
          }))}
        />
      </section>
    </div>
  );
}

function JobActions({
  job,
  busy,
  onAction,
}: {
  job: {
    id: number;
    state: string;
    dataset_id?: number;
  };
  busy: boolean;
  onAction: (action: "pause" | "resume" | "retry") => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-3">
      {job.dataset_id ? (
        <Link
          href={`/pages/document-intelligence/validate?dataset_id=${job.dataset_id}`}
          className="text-sm font-semibold text-brand-pink"
        >
          Review
        </Link>
      ) : null}
      {["queued", "running"].includes(job.state) ? (
        <button
          type="button"
          disabled={busy}
          className="text-sm font-semibold text-slate-600"
          onClick={() => onAction("pause")}
        >
          Pause
        </button>
      ) : null}
      {job.state === "paused" ? (
        <button
          type="button"
          disabled={busy}
          className="text-sm font-semibold text-slate-600"
          onClick={() => onAction("resume")}
        >
          Resume
        </button>
      ) : null}
      {["failed", "cancelled", "completed"].includes(job.state) ? (
        <button
          type="button"
          disabled={busy}
          className="text-sm font-semibold text-slate-600"
          onClick={() => onAction("retry")}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}

function AttentionCard({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: Array<{ title: string; detail: string; href: string }>;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 text-amber-700">
        <AlertTriangle className="h-4 w-4" />
        <h3 className="font-bold">{title}</h3>
      </div>
      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => (
            <li key={`${item.title}-${index}`}>
              <Link href={item.href} className="block text-sm">
                <span className="font-semibold text-slate-800">{item.title}</span>
                <span className="mt-0.5 block text-slate-500">{item.detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{empty}</p>
      )}
    </div>
  );
}
