"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useIntelligenceDatasets } from "../../../../hooks/useIntelligence";
import {
  IntelligenceEmpty,
  IntelligenceError,
  IntelligenceLoading,
} from "./states";

export default function DatasetListScreen() {
  const datasets = useIntelligenceDatasets();

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
            Datasets
          </p>
          <h1 className="mt-1 text-3xl font-medium text-slate-900">Dataset</h1>
          <p className="mt-2 max-w-2xl text-sm font-light text-slate-400">
            Open drafts, queue a run, and continue an unfinished wizard. Extraction
            of document text starts when you click Run.
          </p>
        </div>
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
                  <td className="px-4 py-3 capitalize">{item.source || "—"}</td>
                  <td className="px-4 py-3">
                    {item.document_types.join(", ") ||
                      (item.auto_classify ? "auto" : "—")}
                  </td>
                  <td className="px-4 py-3">{item.field_count}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`status ${item.state === "draft" ? "pending" : ""}`}
                    >
                      {item.state.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.latest_job && typeof item.latest_job === "object"
                      ? `${item.latest_job.progress}% (${item.latest_job.processed_count}/${item.latest_job.document_count})`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">{item.owner_name}</td>
                  <td className="px-4 py-3 text-right">
                    {item.state === "draft" ? (
                      <Link
                        href={`/pages/document-intelligence/datasets/new?id=${item.id}`}
                        className="text-sm font-semibold text-brand-pink"
                      >
                        Continue
                      </Link>
                    ) : (
                      <Link
                        href="/pages/document-intelligence/validate"
                        className="text-sm font-semibold text-brand-pink"
                      >
                        Review
                      </Link>
                    )}
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
