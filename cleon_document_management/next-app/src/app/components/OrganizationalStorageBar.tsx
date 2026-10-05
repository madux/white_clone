"use client";

import { HardDrive } from "lucide-react";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export default function OrganizationalStorageBar({
  storage,
}: {
  storage?: { used_bytes: number; quota_bytes: number };
}) {
  if (!storage) return null;
  const used = storage.used_bytes ?? 0;
  const quota = storage.quota_bytes ?? 0;
  const pct = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0;

  return (
    <section
      className="mx-4 rounded-2xl border border-slate-200 bg-white px-4 py-3"
      aria-label="Storage used"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold text-slate-800">
          <HardDrive className="h-4 w-4 text-brand-pink" aria-hidden />
          Storage
        </span>
        <span className="text-slate-600">
          {formatBytes(used)} of {formatBytes(quota)} used ({pct}%)
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-text to-brand-pink"
          style={{ width: `${pct}%` }}
        />
      </div>
    </section>
  );
}
