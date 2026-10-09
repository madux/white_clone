"use client";

export default function DevBOwnedTabPlaceholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center max-w-lg">
      <p className="text-sm font-bold text-slate-800">{title}</p>
      <p className="mt-2 text-sm text-slate-600">
        This tab is owned by Developer B in the global specification. Settings
        links here so admins know where to configure it once available.
      </p>
    </div>
  );
}
