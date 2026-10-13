"use client";

export default function DevBOwnedTabPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center max-w-lg">
      <p className="text-sm font-bold text-slate-800">{title}</p>
      <p className="mt-2 text-sm text-slate-600">
        This configuration is not available yet. The tab is listed in Settings so
        administrators know where these controls will appear when they are released.
      </p>
    </div>
  );
}
