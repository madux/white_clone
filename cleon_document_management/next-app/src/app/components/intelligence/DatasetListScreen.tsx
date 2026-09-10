"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import {
  useControlIntelligenceJob,
  useIntelligenceDatasets,
} from "../../../../hooks/useIntelligence";
import type { IntelligenceDataset } from "../../../../lib/intelligence-api";
import { formatFieldLabel, formatStatusLabel } from "../../../../lib/formatLabel";
import {
  IntelligenceEmpty,
  IntelligenceError,
  IntelligenceLoading,
} from "./states";

export default function DatasetListScreen() {
  const datasets = useIntelligenceDatasets();

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
        <Link
          href="/pages/document-intelligence/datasets/new"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-3 text-sm font-medium text-white shadow-lg shadow-pink-200"
        >
          <Plus className="h-4 w-4" />
          New Dataset
        </Link>
      </section>

      {datasets.isError ? (
        <IntelligenceError message="Datasets could not be loaded. Confirm Odoo is running and you are signed in." />
      ) : null}
      {datasets.isLoading ? (
        <IntelligenceLoading />
      ) : datasets.data?.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Types</th>
                <th className="px-4 py-3">Fields</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {datasets.data.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {item.name}
                  </td>
                  <td className="px-4 py-3">{item.source ? formatFieldLabel(item.source) : "—"}</td>
                  <td className="px-4 py-3">
                    {item.document_types.join(", ") ||
                      (item.auto_classify ? "auto" : "—")}
                  </td>
                  <td className="px-4 py-3">{item.field_count}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`status ${item.state === "draft" ? "pending" : ""}`}
                    >
                      {formatStatusLabel(item.state)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.latest_job && typeof item.latest_job === "object"
                      ? `${item.latest_job.progress}% (${item.latest_job.processed_count}/${item.latest_job.document_count})`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{item.owner_name}</td>
                  <td className="px-4 py-3 text-right">
                    <DatasetRowActions item={item} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <IntelligenceEmpty
          title="No datasets yet"
          description="A dataset stores source, scope, document types, fields, and confidence thresholds."
          action={
            <Link
              href="/pages/document-intelligence/datasets/new"
              className="inline-flex items-center gap-2 rounded-full border border-brand-pink px-4 py-2 text-sm font-semibold text-brand-pink"
            >
              New Dataset
            </Link>
          }
        />
      )}
    </div>
  );
}

function DatasetRowActions({ item }: { item: IntelligenceDataset }) {
  const control = useControlIntelligenceJob();
  const job =
    item.latest_job && typeof item.latest_job === "object"
      ? item.latest_job
      : null;
  if (item.state === "draft") {
    return (
      <Link
        href={`/pages/document-intelligence/datasets/new?id=${item.id}`}
        className="text-sm font-semibold text-brand-pink"
      >
        Continue
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap justify-end gap-3">
      <Link
        href={`/pages/document-intelligence/validate?dataset_id=${item.id}`}
        className="text-sm font-semibold text-brand-pink"
      >
        Review
      </Link>
      {job && ["queued", "running"].includes(job.state) ? (
        <button
          type="button"
          className="text-sm font-semibold text-slate-600"
          disabled={control.isPending}
          onClick={() => control.mutate({ action: "pause", id: job.id })}
        >
          Pause
        </button>
      ) : null}
      {job && job.state === "paused" ? (
        <button
          type="button"
          className="text-sm font-semibold text-slate-600"
          disabled={control.isPending}
          onClick={() => control.mutate({ action: "resume", id: job.id })}
        >
          Resume
        </button>
      ) : null}
      {job && ["failed", "cancelled", "completed"].includes(job.state) ? (
        <button
          type="button"
          className="text-sm font-semibold text-slate-600"
          disabled={control.isPending}
          onClick={() => control.mutate({ action: "retry", id: job.id })}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
