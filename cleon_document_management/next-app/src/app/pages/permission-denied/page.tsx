"use client";

import Link from "next/link";

export default function PermissionDeniedPage() {
  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <h1 className="text-xl font-bold text-slate-900">You don&apos;t have access</h1>
      <p className="mt-3 text-sm text-slate-600">
        This notification links to something you can no longer open. The notification
        was marked as read.
      </p>
      <Link
        href="/pages/my-workspace"
        className="mt-8 inline-block rounded-xl bg-brand-pink px-5 py-2.5 text-sm font-bold text-white"
      >
        Back to My Workspace
      </Link>
    </div>
  );
}
