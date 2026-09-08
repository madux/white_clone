"use client";

export default function PreviewStep({
  name,
  source,
  scopeKind,
  typeNames,
  autoClassify,
  fieldCount,
  processingMode,
  autoApprove,
  reviewBelow,
  documentCount,
  employeeCount,
  estimating,
  onName,
}: {
  name: string;
  source: string;
  scopeKind: string;
  typeNames: string[];
  autoClassify: boolean;
  fieldCount: number;
  processingMode: string;
  autoApprove: number;
  reviewBelow: number;
  documentCount?: number;
  employeeCount?: number;
  estimating: boolean;
  onName: (value: string) => void;
}) {
  const sourceLabel =
    source === "organizational"
      ? "Organizational Files"
      : source === "employee"
        ? "Employee Files"
        : source || "—";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Preview and run</h2>
        <p className="mt-1 text-sm text-slate-500">
          Name the dataset, then save and run. Document counts are live. Page,
          time, and cost estimates are not calculated yet.
        </p>
      </div>
      <label className="block">
        <span className="label">Dataset name</span>
        <input
          className="field"
          value={name}
          onChange={(event) => onName(event.target.value)}
          placeholder="Q3 employment contracts"
        />
      </label>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Repository
          </dt>
          <dd className="mt-1 font-medium text-slate-800">{sourceLabel}</dd>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Scope
          </dt>
          <dd className="mt-1 font-medium capitalize text-slate-800">
            {scopeKind.replace(/_/g, " ")}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Document types
          </dt>
          <dd className="mt-1 font-medium text-slate-800">
            {typeNames.join(", ") || (autoClassify ? "Automatic classification" : "None")}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Fields
          </dt>
          <dd className="mt-1 font-medium text-slate-800">{fieldCount}</dd>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Processing
          </dt>
          <dd className="mt-1 font-medium capitalize text-slate-800">
            {processingMode}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Confidence
          </dt>
          <dd className="mt-1 font-medium text-slate-800">
            Auto-approve {autoApprove}% · review below {reviewBelow}%
          </dd>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Matching documents
          </dt>
          <dd className="mt-1 font-medium text-slate-800">
            {estimating
              ? "Counting…"
              : documentCount === undefined
                ? "—"
                : documentCount.toLocaleString()}
            {employeeCount ? ` · ${employeeCount.toLocaleString()} employees` : ""}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Pages / time / cost
          </dt>
          <dd className="mt-1 font-medium text-slate-800">Not estimated yet</dd>
        </div>
      </dl>
    </div>
  );
}
