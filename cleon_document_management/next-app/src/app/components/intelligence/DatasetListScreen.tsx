"use client";

import { Plus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import {
  useControlIntelligenceJob,
  useDeleteIntelligenceDatasets,
  useIntelligenceDatasets,
} from "../../../../hooks/useIntelligence";
import type { IntelligenceDataset } from "../../../../lib/intelligence-api";
import {
  IntelligenceEmpty,
  IntelligenceError,
  IntelligenceLoading,
} from "./states";

export default function DatasetListScreen() {
  const datasets = useIntelligenceDatasets();
  const remove = useDeleteIntelligenceDatasets();
  const [selected, setSelected] = useState<number[]>([]);
  const rows = datasets.data || [];
  const allSelected = rows.length > 0 && rows.every((item) => selected.includes(item.id));

  function toggle(id: number) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  async function deleteIds(ids: number[]) {
    if (!ids.length) {
      return;
    }
    const label = ids.length === 1 ? "this dataset" : `${ids.length} datasets`;
    if (
      !window.confirm(
        `Delete ${label}? Extraction jobs and review records for ${ids.length === 1 ? "it" : "them"} will be removed.`,
      )
    ) {
      return;
    }
    await remove.mutateAsync(ids);
    setSelected((current) => current.filter((id) => !ids.includes(id)));
  }

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
      {remove.isError ? (
        <IntelligenceError
          message={
            remove.error instanceof Error
              ? remove.error.message
              : "The dataset could not be deleted."
          }
        />
      ) : null}
      {datasets.isLoading ? (
        <IntelligenceLoading />
      ) : rows.length ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {selected.length ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-pink-100 bg-pink-50 p-2.5">
              <span className="px-2 text-sm font-bold text-brand-text">
                {selected.length} selected
              </span>
              <button
                type="button"
                className="bulk-button text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={remove.isPending}
                onClick={() => deleteIds(selected)}
              >
                <Trash2 />
                Delete
              </button>
              <button
                type="button"
                className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-white hover:text-brand-pink"
                aria-label="Clear selection"
                onClick={() => setSelected([])}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="w-12 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? [] : rows.map((item) => item.id))
                    }
                    aria-label="Select all datasets"
                    className="h-4 w-4 rounded border-slate-300 accent-pink-600"
                  />
                </th>
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
              {rows.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={() => toggle(item.id)}
                      aria-label={`Select ${item.name}`}
                      className="h-4 w-4 rounded border-slate-300 accent-pink-600"
                    />
                  </td>
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
                      className={`status ${
                        item.state === "draft" || item.state === "needs_review"
                          ? "pending"
                          : item.state === "rejected" || item.state === "failed"
                            ? "rejected"
                            : ""
                      }`}
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
                    <DatasetRowActions
                      item={item}
                      deleting={remove.isPending}
                      onDelete={() => deleteIds([item.id])}
                    />
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

function DatasetRowActions({
  item,
  deleting,
  onDelete,
}: {
  item: IntelligenceDataset;
  deleting: boolean;
  onDelete: () => void;
}) {
  const control = useControlIntelligenceJob();
  const job =
    item.latest_job && typeof item.latest_job === "object"
      ? item.latest_job
      : null;
  return (
    <div className="flex flex-wrap justify-end gap-3">
      {item.state === "draft" ? (
        <Link
          href={`/pages/document-intelligence/datasets/new?id=${item.id}`}
          className="text-sm font-semibold text-brand-pink"
        >
          Continue
        </Link>
      ) : (
        <Link
          href={`/pages/document-intelligence/validate?dataset_id=${item.id}`}
          className="text-sm font-semibold text-brand-pink"
        >
          {item.state === "needs_review" ? "Review" : "Results"}
        </Link>
      )}
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
      {job && ["failed", "cancelled"].includes(job.state) ? (
        <button
          type="button"
          className="text-sm font-semibold text-slate-600"
          disabled={control.isPending}
          onClick={() => control.mutate({ action: "retry", id: job.id })}
        >
          Retry
        </button>
      ) : null}
      <button
        type="button"
        className="text-sm font-semibold text-red-600"
        disabled={deleting}
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
}
