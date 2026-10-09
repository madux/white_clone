"use client";

export default function DevBOwnedTabPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center max-w-lg">
      <p className="text-sm font-bold text-slate-800">{title}</p>
      <p className="mt-2 text-sm text-slate-600">
        For Mike — this area is in the global specification and will be wired here
        when that work lands. The tab is listed in Settings so admins know where
        configuration will live.
      </p>
    </div>
  );
}
