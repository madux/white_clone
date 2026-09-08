"use client";

import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileText,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useCurrentUser, useMyWorkspace } from "../../../hooks/useDocuments";

const states: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  processing: "bg-amber-50 text-amber-700",
  rejected: "bg-red-50 text-red-700",
  draft: "bg-slate-100 text-slate-600",
  expired: "bg-red-50 text-red-700",
  missing: "bg-orange-50 text-orange-700",
};

export default function EmployeeDashboard() {
  const user = useCurrentUser();
  const workspace = useMyWorkspace();
  const data = workspace.data;
  const outstanding = data?.outstanding ?? [];
  const myFiles = data?.my_files ?? [];
  const shared = data?.shared_documents ?? [];
  const pending = [...myFiles, ...shared].filter(
    (document) =>
      document.approval_state === "pending" ||
      ["processing", "draft"].includes(document.state),
  );

  return (
    <div className="mx-auto min-h-full w-full max-w-[1650px] space-y-8 bg-slate-50 p-6">
      <section className="rounded-2xl shadow-brand-secondary/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-3xl font-medium">Dashboard</span>
            <span className="font-light text-slate-400">
              Welcome back, {user.data?.name || "there"}. Overview of actions,
              requirements, and shortcuts — manage files in My Documents.
            </span>
          </div>
          <Link
            href="/pages/my-documents?upload=1"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-brand-text to-brand-pink px-4 py-3 text-sm font-medium text-white shadow-lg shadow-pink-200"
          >
            <Upload className="h-4 w-4" />
            Upload Document
          </Link>
        </div>
      </section>

      {workspace.error && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Your workspace data could not be loaded. Please try again.</span>
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "My documents",
            value: data?.dashboard.total,
            caption: "Total records",
            icon: FileText,
          },
          {
            label: "Outstanding",
            value: outstanding.length,
            caption: "Required uploads",
            icon: Clock3,
          },
          {
            label: "Pending review",
            value: pending.length,
            caption: "Awaiting approval",
            icon: AlertCircle,
          },
          {
            label: "Expiring soon",
            value: data?.dashboard.expiring,
            caption: "Next 30 days",
            icon: Clock3,
          },
        ].map(({ label, value, caption, icon: Icon }, index) => {
          const isFirst = index === 0;
          return (
            <div
              key={label}
              className={`rounded-2xl border border-slate-200 p-5 ${isFirst ? "bg-gradient-to-br from-brand-text to-brand-pink text-white shadow-lg shadow-pink-200" : "bg-white text-black"}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  {workspace.isLoading ? (
                    <div className="mt-2 h-9 w-16 animate-pulse rounded-xl bg-slate-200" />
                  ) : (
                    <p className="mt-1 text-3xl font-bold tracking-tight">
                      {value ?? "-"}
                    </p>
                  )}
                </div>
                <div
                  className={`rounded-xl p-2.5 ${isFirst ? "bg-white/20 text-white" : "bg-pink-50 text-brand-pink"}`}
                >
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p
                className={`mt-3 text-xs ${isFirst ? "text-white" : "text-brand-text"}`}
              >
                {caption}
              </p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
                Action required
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Outstanding requirements
              </h2>
            </div>
            <Clock3 className="h-5 w-5 text-brand-pink" />
          </div>
          {workspace.isLoading ? (
            <div className="space-y-3">
              <div className="h-16 animate-pulse rounded-xl bg-slate-200" />
              <div className="h-16 animate-pulse rounded-xl bg-slate-200" />
            </div>
          ) : outstanding.length ? (
            <div className="divide-y divide-slate-100">
              {outstanding.slice(0, 6).map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-lg bg-orange-50 p-2 text-orange-600">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {document.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {document.document_type}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${states.missing}`}
                    >
                      Required
                    </span>
                    <Link
                      href={`/pages/my-documents?upload=1&type=${document.document_type_id}`}
                      className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-brand-text to-brand-pink px-3 py-2 text-[10px] font-bold text-white"
                    >
                      <Upload className="h-3 w-3" />
                      Upload
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-xl bg-slate-50 p-8 text-center">
              <CheckCircle2 className="h-7 w-7 text-brand-pink" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                All requirements complete
              </p>
              <p className="mt-1 text-xs text-slate-400">
                No outstanding document uploads are waiting for you.
              </p>
            </div>
          )}
          {outstanding.length > 0 && (
            <Link
              href="/pages/my-documents"
              className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-brand-pink hover:underline"
            >
              View all in My Documents
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
                Workspace
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Quick access
              </h2>
            </div>
            <ArrowUpRight className="h-5 w-5 text-brand-pink" />
          </div>
          <div className="grid gap-3">
            <Link
              href="/pages/my-documents"
              className="flex items-center justify-between rounded-xl border border-pink-100 bg-pink-50/50 p-4 text-sm font-semibold text-brand-text transition hover:bg-pink-100"
            >
              <span className="flex items-center gap-3">
                <FileText className="h-4 w-4" />
                My Documents
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pages/my-documents?upload=1"
              className="flex items-center justify-between rounded-xl border border-pink-100 bg-pink-50/50 p-4 text-sm font-semibold text-brand-text transition hover:bg-pink-100"
            >
              <span className="flex items-center gap-3">
                <Upload className="h-4 w-4" />
                Upload a document
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pages/quick-access"
              className="flex items-center justify-between rounded-xl border border-pink-100 bg-pink-50/50 p-4 text-sm font-semibold text-brand-text transition hover:bg-pink-100"
            >
              <span className="flex items-center gap-3">
                <Clock3 className="h-4 w-4" />
                Pinned shortcuts
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
