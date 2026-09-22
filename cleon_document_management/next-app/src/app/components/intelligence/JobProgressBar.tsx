"use client";

import type { IntelligenceJob } from "../../../../lib/intelligence-api";

export default function JobProgressBar({
  job,
}: {
  job?: Pick<
    IntelligenceJob,
    "progress" | "processed_count" | "document_count" | "state"
  > | null;
}) {
  if (!job) {
    return <span className="text-slate-400">—</span>;
  }
  const pct = Math.max(0, Math.min(100, Number(job.progress) || 0));
  const queued = job.state === "queued" && pct === 0;
  return (
    <div className="min-w-[9rem]">
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-pink transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        {queued ? "Queued" : `${Math.round(pct)}%`}
        {job.document_count
          ? ` · ${job.processed_count}/${job.document_count}`
          : ""}
      </p>
    </div>
  );
}
