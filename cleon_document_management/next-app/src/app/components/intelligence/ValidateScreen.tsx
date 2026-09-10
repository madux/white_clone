"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  useBulkApproveSafeRecords,
  useIntelligenceReviewQueue,
  useReviewIntelligenceRecord,
} from "../../../../hooks/useIntelligence";
import type { IntelligenceExtractionRecord } from "../../../../lib/intelligence-api";
import { formatFieldLabel, formatStatusLabel } from "../../../../lib/formatLabel";
import {
  IntelligenceEmpty,
  IntelligenceError,
  IntelligenceLoading,
} from "./states";

function previewSrc(record: IntelligenceExtractionRecord) {
  const origin = (process.env.NEXT_PUBLIC_ODOO_URL || "").replace(/\/$/, "");
  return `${origin}${record.preview_url}`;
}

export default function ValidateScreen() {
  const searchParams = useSearchParams();
  const datasetId = Number(searchParams.get("dataset_id") || 0) || undefined;
  const queue = useIntelligenceReviewQueue(datasetId);
  const review = useReviewIntelligenceRecord();
  const bulk = useBulkApproveSafeRecords();
  const records = queue.data || [];
  const [selectedId, setSelectedId] = useState<number>();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [correctionReason, setCorrectionReason] = useState("");
  const [comment, setComment] = useState("");
  const [prompt, setPrompt] = useState<{
    kind: "reject" | "override";
    reason: string;
  } | null>(null);
  const [message, setMessage] = useState("");

  const selected =
    records.find((item) => item.id === selectedId) || records[0] || null;

  useEffect(() => {
    if (!selected) {
      return;
    }
    setSelectedId(selected.id);
    setDrafts(
      Object.fromEntries(
        selected.fields.map((field) => [field.key, field.value || ""]),
      ),
    );
    setCorrectionReason("");
    setComment("");
  }, [selected?.id]);

  const blockingOpen = useMemo(
    () =>
      (selected?.issues || []).filter(
        (issue) => issue.severity === "blocking" && !issue.resolved,
      ),
    [selected],
  );

  async function runReview(
    payload: Parameters<typeof review.mutateAsync>[0],
    success: string,
  ) {
    setMessage("");
    try {
      await review.mutateAsync(payload);
      setMessage(success);
      setPrompt(null);
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review failed.");
      return false;
    }
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-end">
        <button
          type="button"
          className="inline-flex rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
          disabled={bulk.isPending || !records.length}
          onClick={async () => {
            setMessage("");
            try {
              const result = await bulk.mutateAsync(
                records.map((item) => item.id),
              );
              setMessage(
                `Approved ${result.approved_count} high-confidence record(s). Blocking or low-confidence items were skipped.`,
              );
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "Bulk approve failed.",
              );
            }
          }}
        >
          Approve safe records
        </button>
      </section>

      {queue.isError ? (
        <IntelligenceError message="The review queue could not be loaded." />
      ) : null}
      {message ? (
        <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {message}
        </p>
      ) : null}

      {queue.isLoading ? (
        <IntelligenceLoading />
      ) : records.length && selected ? (
        <div className="grid gap-4 xl:grid-cols-[16rem_minmax(0,1fr)_24rem]">
          <aside className="space-y-2">
            {records.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => setSelectedId(record.id)}
                className={`w-full rounded-2xl border p-3 text-left ${
                  selected.id === record.id
                    ? "border-brand-pink bg-white"
                    : "border-slate-200 bg-white/70"
                }`}
              >
                <p className="text-sm font-bold text-slate-900">
                  {record.document_name}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {record.document_type || "Unclassified"} ·{" "}
                  {Math.round((record.document_confidence || 0) * 100)}%
                </p>
              </button>
            ))}
          </aside>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div>
                <h2 className="font-bold text-slate-900">
                  {selected.document_name}
                </h2>
                <p className="text-xs text-slate-400">
                  {selected.dataset}
                    {selected.used_ocr ? " · OCR/vision used" : ""}
                    {selected.text_source ? ` · ${formatFieldLabel(selected.text_source)}` : ""}
                </p>
              </div>
              <a
                href={previewSrc(selected)}
                className="text-sm font-semibold text-brand-pink"
                target="_blank"
                rel="noreferrer"
              >
                Open file
              </a>
            </div>
            <iframe
              title={`Preview of ${selected.document_name}`}
              src={previewSrc(selected)}
              className="h-[28rem] w-full bg-slate-50"
            />
            {selected.extracted_text ? (
              <pre className="max-h-48 overflow-auto border-t border-slate-100 bg-slate-50 p-4 text-xs text-slate-600 whitespace-pre-wrap">
                {selected.extracted_text}
              </pre>
            ) : null}
          </section>

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="status pending">
                {formatStatusLabel(selected.review_status)}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                {formatStatusLabel(selected.validation_status)}
              </span>
            </div>

            <div className="space-y-3">
              {selected.fields.map((field) => (
                <label key={field.key} className="block">
                  <span className="text-xs font-bold uppercase text-slate-400">
                    {field.name}
                    {field.required ? " *" : ""}
                    <span className="ml-2 font-medium normal-case text-slate-400">
                      {Math.round((field.confidence || 0) * 100)}%
                      {field.citation ? ` · ${field.citation}` : ""}
                    </span>
                  </span>
                  <input
                    className="field mt-1"
                    value={drafts[field.key] ?? field.value}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [field.key]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
            </div>

            <label className="block">
              <span className="label">Correction reason</span>
              <input
                className="field"
                value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
                placeholder="Required when saving a field change"
              />
            </label>
            <button
              type="button"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              disabled={review.isPending}
              onClick={async () => {
                const changed = selected.fields.filter(
                  (field) =>
                    (drafts[field.key] ?? field.value) !== (field.value || ""),
                );
                if (!changed.length) {
                  setMessage("No field values changed.");
                  return;
                }
                for (const field of changed) {
                  const ok = await runReview(
                    {
                      action: "correct",
                      id: selected.id,
                      field_key: field.key,
                      value: drafts[field.key] ?? "",
                      reason: correctionReason,
                    },
                    `Updated ${changed.map((item) => item.name).join(", ")}.`,
                  );
                  if (!ok) {
                    break;
                  }
                }
              }}
            >
              Save field correction
            </button>

            {selected.issues.length ? (
              <ul className="space-y-2">
                {selected.issues.map((issue) => (
                  <li
                    key={issue.id}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      issue.resolved
                        ? "bg-slate-50 text-slate-400"
                        : issue.severity === "blocking"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span>{issue.message}</span>
                      {!issue.resolved ? (
                        <button
                          type="button"
                          className="shrink-0 text-xs font-bold uppercase"
                          onClick={() =>
                            runReview(
                              {
                                action: "resolve",
                                id: selected.id,
                                issue_id: issue.id,
                                reason: "Issue reviewed",
                              },
                              "Issue marked resolved.",
                            )
                          }
                        >
                          Resolve
                        </button>
                      ) : (
                        <span className="text-xs uppercase">Resolved</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            <label className="block">
              <span className="label">Review comment</span>
              <textarea
                className="field min-h-20"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="text-sm font-semibold text-brand-pink"
              onClick={() =>
                runReview(
                  { action: "comment", id: selected.id, comment },
                  "Comment saved.",
                )
              }
            >
              Add comment
            </button>

            {prompt ? (
              <div className="space-y-2 rounded-xl border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-800">
                  {prompt.kind === "reject"
                    ? "Reject reason"
                    : "Override reason"}
                </p>
                <textarea
                  className="field min-h-20"
                  value={prompt.reason}
                  onChange={(event) =>
                    setPrompt({ ...prompt, reason: event.target.value })
                  }
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-xl bg-brand-pink px-3 py-2 text-sm font-semibold text-white"
                    onClick={() =>
                      runReview(
                        {
                          action: prompt.kind,
                          id: selected.id,
                          reason: prompt.reason,
                        },
                        prompt.kind === "reject"
                          ? "Record rejected."
                          : "AI result overridden.",
                      )
                    }
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    className="rounded-xl px-3 py-2 text-sm text-slate-500"
                    onClick={() => setPrompt(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  disabled={review.isPending || blockingOpen.length > 0}
                  onClick={() =>
                    runReview(
                      { action: "approve", id: selected.id },
                      "Record approved.",
                    )
                  }
                >
                  Approve
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  onClick={() => setPrompt({ kind: "reject", reason: "" })}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                  onClick={() => setPrompt({ kind: "override", reason: "" })}
                >
                  Override
                </button>
              </div>
            )}
            {blockingOpen.length ? (
              <p className="text-xs text-red-600">
                {blockingOpen.length} blocking issue(s) must be resolved before
                approval.
              </p>
            ) : null}

            {selected.review_actions?.length ? (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  Audit
                </h3>
                <ul className="mt-2 space-y-2 text-xs text-slate-500">
                  {selected.review_actions.map((item) => (
                    <li key={item.id}>
                      <strong className="text-slate-700">
                        {formatFieldLabel(item.action)}
                      </strong>{" "}
                      by {item.user}
                      {item.reason ? ` — ${item.reason}` : ""}
                      {item.before_value || item.after_value
                        ? ` (${item.before_value || "empty"} → ${item.after_value || "empty"})`
                        : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <IntelligenceEmpty
          title="Nothing to validate"
          description="Run a dataset against Employee or Organizational Files. Records that need review appear here."
          action={
            <Link
              href="/pages/document-intelligence/datasets/new"
              className="inline-flex rounded-full border border-brand-pink px-4 py-2 text-sm font-semibold text-brand-pink"
            >
              New Dataset
            </Link>
          }
        />
      )}
    </div>
  );
}
