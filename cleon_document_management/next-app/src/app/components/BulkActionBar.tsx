"use client";

import type { ReactNode } from "react";

export default function BulkActionBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear: () => void;
  children: ReactNode;
}) {
  if (count <= 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-pink-100 bg-pink-50 px-5 py-3">
      <span className="text-sm font-bold text-brand-text">
        {count} selected
      </span>
      {children}
      <button
        type="button"
        onClick={onClear}
        className="ml-auto rounded-lg px-3 py-2 text-xs font-bold text-slate-500 hover:text-brand-pink"
      >
        Clear
      </button>
    </div>
  );
}
