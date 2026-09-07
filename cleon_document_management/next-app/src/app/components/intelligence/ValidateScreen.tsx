"use client";

import Link from "next/link";
import { useIntelligenceReviewQueue } from "../../../../hooks/useIntelligence";
import {
  IntelligenceEmpty,
  IntelligenceError,
  IntelligenceLoading,
} from "./states";

export default function ValidateScreen() {
  const queue = useIntelligenceReviewQueue();

  return (
    <div className="space-y-8">
      <section>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
          Review queue
        </p>
        <h1 className="mt-1 text-3xl font-medium text-slate-900">Validate</h1>
        <p className="mt-2 max-w-2xl text-sm font-light text-slate-400">
          Extracted records from the latest jobs. Side-by-side approve, reject,
          and override actions come in the next phase.
        </p>
      </section>
      {queue.isError ? (
        <IntelligenceError message="The review queue could not be loaded." />
      ) : null}
      {queue.isLoading ? (
        <IntelligenceLoading />
      ) : queue.data?.length ? (
        <div className="space-y-4">
          {queue.data.map((record) => (
            <article
              key={record.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900">
                    {record.document_name}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {record.dataset} · {record.document_type || "Unclassified"} ·{" "}
                    {record.employee || "No employee"}
                  </p>
                </div>
                <span className="status pending">
                  {record.review_status.replace(/_/g, " ")} ·{" "}
                  {Math.round((record.document_confidence || 0) * 100)}%
                </span>
              </div>
              <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                {record.fields.map((field) => (
                  <div key={field.key}>
                    <dt className="text-xs font-bold uppercase text-slate-400">
                      {field.name}
                      {field.required ? " *" : ""}
                    </dt>
                    <dd className="text-slate-800">
                      {field.value || "—"}
                      <span className="ml-2 text-xs text-slate-400">
                        {Math.round((field.confidence || 0) * 100)}%
                        {field.citation ? ` · ${field.citation}` : ""}
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
              {record.issues.length ? (
                <ul className="mt-3 list-disc pl-5 text-sm text-amber-700">
                  {record.issues.map((issue) => (
                    <li key={issue.id}>{issue.message}</li>
                  ))}
                </ul>
              ) : null}
              <a
                href={`${process.env.NEXT_PUBLIC_ODOO_URL || ""}${record.preview_url}`}
                className="mt-4 inline-flex text-sm font-semibold text-brand-pink"
                target="_blank"
                rel="noreferrer"
              >
                Open source document
              </a>
            </article>
          ))}
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
