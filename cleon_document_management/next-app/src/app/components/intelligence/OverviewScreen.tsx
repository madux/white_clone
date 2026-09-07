"use client";

import {
  AlertTriangle,
  ClipboardCheck,
  MessageSquareText,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useIntelligenceDatasets } from "../../../../hooks/useIntelligence";
import { DemoBadge, IntelligenceEmpty } from "./states";

const ATTENTION = [
  {
    title: "Failed extraction",
    detail: "Failed jobs and empty sources show a reason on the dataset list.",
  },
  {
    title: "Expiring contracts",
    detail: "Attention cards will use approved extracted dates once jobs exist.",
  },
  {
    title: "Probation alerts",
    detail: "Probation questions need approved structured records first.",
  },
];

export default function OverviewScreen() {
  const datasets = useIntelligenceDatasets();
  const jobs = (datasets.data || []).filter(
    (item) => item.latest_job && typeof item.latest_job === "object",
  );

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
            Document Intelligence
          </p>
          <h1 className="mt-1 text-3xl font-medium text-slate-900">Overview</h1>
          <p className="mt-2 max-w-2xl text-sm font-light text-slate-400">
            Classify documents, extract fields, review results, and ask
            permission-safe questions.
          </p>
        </div>
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
            Review extracted fields beside the original document.
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

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Extraction accuracy", value: "—" },
          { label: "Classification accuracy", value: "—" },
          { label: "Data quality", value: "—" },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600">{metric.label}</p>
              <DemoBadge />
            </div>
            <p className="mt-2 text-3xl font-bold text-slate-900">{metric.value}</p>
            <p className="mt-2 text-xs text-slate-400">
              Not calculated from reviewed records yet.
            </p>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold text-slate-900">Recent jobs</h2>
        <p className="mt-1 text-sm text-slate-500">
          Progress updates automatically while a job is queued or running.
        </p>
        <div className="mt-6">
          {jobs.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2">Job</th>
                    <th className="py-2">Dataset</th>
                    <th className="py-2">Source</th>
                    <th className="py-2">Docs</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((item) => {
                    const job =
                      item.latest_job && typeof item.latest_job === "object"
                        ? item.latest_job
                        : null;
                    return (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="py-3">#{job?.id}</td>
                        <td className="py-3">{item.name}</td>
                        <td className="py-3 capitalize">{item.source || "—"}</td>
                        <td className="py-3">
                          {job?.processed_count ?? 0}/{job?.document_count ?? 0}
                        </td>
                        <td className="py-3">{item.state.replace(/_/g, " ")}</td>
                        <td className="py-3">{job?.progress ?? 0}%</td>
                      </tr>
                    );
                  })}
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
        {ATTENTION.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              <h3 className="font-bold">{item.title}</h3>
            </div>
            <p className="mt-2 text-sm text-slate-500">{item.detail}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
