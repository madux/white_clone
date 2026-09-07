"use client";

import { AlertCircle, Inbox } from "lucide-react";
import type { ReactNode } from "react";

export function IntelligenceLoading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className="h-20 w-full animate-pulse rounded-xl bg-slate-200"
        />
      ))}
    </div>
  );
}

export function IntelligenceError({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function IntelligenceEmpty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
      <Inbox className="h-10 w-10 text-slate-300" />
      <h3 className="mt-4 text-lg font-bold text-slate-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function DemoBadge() {
  return (
    <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">
      Estimated / demo
    </span>
  );
}
