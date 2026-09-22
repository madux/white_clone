"use client";

const PRESETS = [
  {
    value: "relaxed" as const,
    title: "Relaxed",
    autoApprove: 75,
    reviewBelow: 40,
    blurb: "Approve more results automatically. Best for clean, typed files.",
  },
  {
    value: "balanced" as const,
    title: "Balanced",
    autoApprove: 85,
    reviewBelow: 50,
    blurb: "Recommended. High-confidence results pass; uncertain ones wait.",
  },
  {
    value: "strict" as const,
    title: "Strict",
    autoApprove: 92,
    reviewBelow: 65,
    blurb: "More human review. Use for scans, IDs, and sensitive records.",
  },
];

export default function ValidationStep({
  confidencePreset,
  ocrFallback,
  deduplicate,
  masking,
  auditLogging,
  onPreset,
  onFlag,
}: {
  confidencePreset: "relaxed" | "balanced" | "strict";
  ocrFallback: boolean;
  deduplicate: boolean;
  masking: boolean;
  auditLogging: boolean;
  onPreset: (value: "relaxed" | "balanced" | "strict") => void;
  onFlag: (
    key: "ocrFallback" | "deduplicate" | "masking" | "auditLogging",
    value: boolean,
  ) => void;
}) {
  const current = PRESETS.find((item) => item.value === confidencePreset) || PRESETS[1];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-slate-900">How strict should review be?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Required fields and format checks always run. These thresholds are
          saved on the dataset so later setting changes do not rewrite this job.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {PRESETS.map((preset) => {
          const selected = preset.value === confidencePreset;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => onPreset(preset.value)}
              className={`rounded-2xl border p-4 text-left ${
                selected
                  ? "border-brand-pink bg-pink-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <p className="font-semibold text-slate-900">{preset.title}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Auto-approve {preset.autoApprove}% · Review below {preset.reviewBelow}%
              </p>
              <p className="mt-2 text-sm text-slate-500">{preset.blurb}</p>
            </button>
          );
        })}
      </div>

      <p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
        Missing required fields or invalid formats always go to review. Otherwise
        results at {current.autoApprove}% or higher auto-approve, and results
        below {current.reviewBelow}% wait for a person.
      </p>

      {(
        [
          ["ocrFallback", "OCR fallback for unreadable PDFs", ocrFallback],
          ["deduplicate", "Skip duplicate source documents", deduplicate],
          ["masking", "Mask sensitive values on export", masking],
          ["auditLogging", "Write an audit trail for this job", auditLogging],
        ] as const
      ).map(([key, label, checked]) => (
        <label key={key} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="h-4 w-4 accent-pink-600"
            checked={checked}
            onChange={(event) => onFlag(key, event.target.checked)}
          />
          {label}
        </label>
      ))}
    </div>
  );
}
