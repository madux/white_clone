"use client";

import { Building2, Gauge, Shield, Unplug, Upload, Users, Zap } from "lucide-react";

const SOURCES = [
  {
    value: "employee" as const,
    title: "Employee Files",
    description: "Documents stored on employee folders — contracts, IDs, certificates.",
    icon: Users,
    available: true,
  },
  {
    value: "organizational" as const,
    title: "Organizational Files",
    description: "Company-wide documents in Organizational Files.",
    icon: Building2,
    available: true,
  },
  {
    value: "upload" as const,
    title: "Upload documents",
    description: "Extract files from your computer. They stay in this dataset, not in Employee or Organizational Files.",
    icon: Upload,
    available: true,
  },
  {
    value: "external" as const,
    title: "External source",
    description: "Google Drive, SharePoint, and similar connectors are not connected yet.",
    icon: Unplug,
    available: false,
  },
];

const MODES = [
  {
    value: "fast" as const,
    title: "Fast",
    description: "Fewer review checks. Use for clean, typed documents.",
    icon: Zap,
  },
  {
    value: "balanced" as const,
    title: "Balanced",
    description: "Recommended. Mix of speed and review.",
    icon: Gauge,
  },
  {
    value: "conservative" as const,
    title: "Conservative",
    description: "Stricter review. Better for scans and mixed files.",
    icon: Shield,
  },
];

export default function RepositoryStep({
  source,
  processingMode,
  counts,
  loading,
  error,
  onSource,
  onMode,
}: {
  source: string;
  processingMode: "fast" | "balanced" | "conservative";
  counts: {
    employee: number;
    organizational: number;
    upload: number;
    external: number;
  };
  loading?: boolean;
  error?: boolean;
  onSource: (value: "employee" | "organizational" | "upload" | "external") => void;
  onMode: (value: "fast" | "balanced" | "conservative") => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900">Where should we look?</h2>
        <p className="mt-1 text-sm text-slate-500">
          Pick a repository. Counts are live files in Employee or Organizational
          Files — not recycle bin or archived items.
        </p>
      </div>
      {error ? (
        <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">
          Live counts could not be loaded from Odoo. Restart the server if this
          screen was opened before the latest backend fix.
        </p>
      ) : null}
      {loading && !error ? (
        <p className="text-sm text-slate-500">Counting documents…</p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {SOURCES.map((item) => {
          const selected = source === item.value;
          const count = counts[item.value] ?? 0;
          const Icon = item.icon;
          return (
            <button
              key={item.value}
              type="button"
              disabled={!item.available}
              onClick={() => onSource(item.value)}
              className={`rounded-2xl border p-4 text-left transition ${
                selected
                  ? "border-brand-pink bg-pink-50 shadow-sm"
                  : item.available
                    ? "border-slate-200 bg-white hover:border-pink-200"
                    : "cursor-not-allowed border-slate-100 bg-slate-50 opacity-70"
              }`}
            >
              <span className="flex items-start gap-3">
                <span className="rounded-xl bg-white p-2 text-brand-text shadow-sm">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-semibold text-slate-900">{item.title}</span>
                  <span className="mt-1 block text-sm text-slate-500">{item.description}</span>
                  <span className="mt-2 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {item.value === "upload"
                      ? "From your computer"
                      : `${count.toLocaleString()} documents`}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <div>
        <p className="label">AI processing mode</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {MODES.map((item) => {
            const selected = processingMode === item.value;
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onMode(item.value)}
                className={`rounded-2xl border p-4 text-left ${
                  selected
                    ? "border-brand-pink bg-pink-50"
                    : "border-slate-200 bg-white hover:border-pink-200"
                }`}
              >
                <Icon className="h-4 w-4 text-brand-text" />
                <span className="mt-2 block font-semibold text-slate-900">
                  {item.title}
                  {item.value === "balanced" ? " · recommended" : ""}
                </span>
                <span className="mt-1 block text-xs text-slate-500">{item.description}</span>
                <span className="mt-2 block text-[11px] font-medium text-slate-400">
                  {item.value === "fast"
                    ? "Uses the same extractor. Review is lighter only after you pick Validation rules."
                    : item.value === "conservative"
                      ? "Same extractor. Prefer this when files are scans; turn OCR on in Validation."
                      : "Same extractor for every mode: read the file text, then pull fields from that text."}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
