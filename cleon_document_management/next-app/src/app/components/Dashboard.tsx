"use client";

import {
  AlertCircle,
  ArrowUpRight,
  BarChart3,
  BellRing,
  Brain,
  CheckCircle2,
  Clock3,
  FileText,
  FolderKanban,
  Plus,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  useDashboardStats,
  useDocuments,
  useFolders,
} from "../../../hooks/useDocuments";

function LoadingBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-slate-200 ${className}`} />
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
      <AlertCircle className="h-5 w-5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1000000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1000000).toFixed(1)} MB`;
}

const statusStyles = {
  approved: "bg-pink-50 text-brand-pink",
  processing: "bg-amber-50 text-amber-700",
  draft: "bg-slate-100 text-slate-600",
  rejected: "bg-red-50 text-red-700",
  expired: "bg-orange-50 text-orange-700",
  missing: "bg-orange-50 text-orange-700",
};

export default function Dashboard() {
  const stats = useDashboardStats();
  const folders = useFolders();
  const documents = useDocuments();
  const dataError = stats.error || folders.error || documents.error;
  const documentRows = documents.data ?? [];
  const approvedDocuments = documentRows.filter(
    (document) => document.state === "approved",
  ).length;
  const approvalProgress = documentRows.length
    ? Math.round((approvedDocuments / documentRows.length) * 100)
    : 0;
  const statusMetrics = [
    {
      label: "Approved",
      value: documentRows.filter((document) => document.state === "approved")
        .length,
      color: "bg-brand-pink",
    },
    {
      label: "Processing",
      value: documentRows.filter((document) => document.state === "processing")
        .length,
      color: "bg-amber-400",
    },
    {
      label: "Draft",
      value: documentRows.filter((document) => document.state === "draft")
        .length,
      color: "bg-slate-300",
    },
    {
      label: "Rejected",
      value: documentRows.filter((document) => document.state === "rejected")
        .length,
      color: "bg-red-400",
    },
    {
      label: "Expired",
      value: documentRows.filter((document) => document.state === "expired")
        .length,
      color: "bg-orange-400",
    },
  ];
  const chartMax = Math.max(...statusMetrics.map((metric) => metric.value), 1);
  const statCards: Array<{
    label: string;
    value: number | undefined;
    icon: LucideIcon;
    caption: string;
  }> = [
    {
      label: "Documents",
      value: stats.data?.total_documents,
      icon: FileText,
      caption: "Total records",
    },
    {
      label: "Folders",
      value: stats.data?.total_folders,
      icon: FolderKanban,
      caption: "Active spaces",
    },
    {
      label: "Expiring soon",
      value: stats.data?.expiring_documents,
      icon: Clock3,
      caption: "Next 30 days",
    },
    {
      label: "Pending approvals",
      value: stats.data?.pending_approvals,
      icon: ShieldCheck,
      caption: "Needs attention",
    },
  ];

  return (
    <div className="min-h-full mx-auto space-y-8 bg-gray-100 rounded-2xl max-w-[1650px] w-full p-6">
      <section className="rounded-2xl shadow-brand-secondary/10">
        <div className="flex justify-between items-center">
          <div className="flex flex-col gap-2">
            <span className="text-3xl font-medium">Dashboard</span>
            <span className="text-slate-400 font-light">
              Centralized repository for employee files, compliance policies,
              and audits.
            </span>
          </div>
          <div className="flex gap-4">
            <Link
              href="#"
              className="inline-flex gap-2 items-center bg-gradient-to-br from-brand-text to-brand-pink px-4 py-3 rounded-full text-white font-medium inline-block shadow-lg shadow-pink-200"
            >
              <Plus className="h-4 w-4" />
              Add Folder
            </Link>
            <Link
              href="#"
              className="inline-flex gap-2 items-center bg-white px-4 py-3 rounded-full text-brand-pink font-medium inline-block border border-brand-pink"
            >
              Upload Document
            </Link>
          </div>
        </div>
      </section>

      {dataError && (
        <ErrorState message="Some dashboard data could not be loaded. Please try again." />
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map(({ label, value, icon: Icon, caption }, index) => {
          const isFirst = index === 0;
          return (
            <div
              key={label as string}
              className={`rounded-2xl border border-slate-200 p-5 ${isFirst ? "bg-gradient-to-br text-white from-brand-text to-brand-pink shadow-lg shadow-pink-200" : "bg-white text-black"}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  {stats.isLoading ? (
                    <LoadingBlock className="mt-2 h-9 w-16" />
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

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1.5fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
                Browse
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Your document spaces
              </h2>
            </div>
            <FolderKanban className="h-5 w-5 text-slate-300" />
          </div>
          {folders.isLoading ? (
            <div className="space-y-3">
              <LoadingBlock className="h-20 w-full" />
              <LoadingBlock className="h-20 w-full" />
            </div>
          ) : folders.data?.length ? (
            <div className="space-y-3">
              {folders.data.map((folder) => (
                <Link
                  href={`/pages/${folder.folder_type === "employee" ? "employee" : "organization"}`}
                  key={folder.id}
                  className="group flex items-center justify-between rounded-xl border border-slate-100 p-4 transition hover:border-pink-200 hover:bg-pink-50/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="h-3 w-3 shrink-0 rounded-full bg-brand-pink" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {folder.folder_name}
                      </p>
                      <p className="mt-1 truncate text-xs text-slate-400">
                        {folder.description}
                      </p>
                    </div>
                  </div>
                  <span className="ml-3 flex shrink-0 items-center gap-1 text-xs font-semibold text-slate-400 group-hover:text-brand-pink">
                    {folder.document_count} files{" "}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-xl bg-slate-50 p-5 text-sm text-slate-500">
              No folders are available yet.
            </p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
                Activity
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Recent documents
              </h2>
            </div>
            <Link
              href="/pages/organization"
              className="text-xs font-semibold text-brand-pink hover:underline"
            >
              View all
            </Link>
          </div>
          {documents.isLoading ? (
            <div className="space-y-3">
              <LoadingBlock className="h-16 w-full" />
              <LoadingBlock className="h-16 w-full" />
              <LoadingBlock className="h-16 w-full" />
            </div>
          ) : documents.data?.length ? (
            <div className="divide-y divide-slate-100">
              {documents.data.slice(0, 5).map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-lg bg-slate-100 p-2 text-slate-500">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {document.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        {document.folder_name} ·{" "}
                        {formatFileSize(document.file_size)}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${statusStyles[document.state]}`}
                  >
                    {document.state}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center rounded-xl bg-slate-50 p-8 text-center">
              <CheckCircle2 className="h-7 w-7 text-brand-pink" />
              <p className="mt-3 text-sm font-semibold text-slate-700">
                No documents yet
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Uploaded files will appear here.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.8fr_0.95fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
                Activity
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Document analytics
              </h2>
            </div>
            <BarChart3 className="h-5 w-5 text-brand-pink" />
          </div>
          <div className="flex h-44 items-end justify-between gap-3 px-2">
            {statusMetrics.map((metric) => (
              <div
                key={metric.label}
                className="flex h-full flex-1 flex-col items-center justify-end gap-2"
              >
                <div
                  className={`w-full max-w-10 rounded-t-full ${metric.color}`}
                  style={{
                    height: `${Math.max(12, (metric.value / chartMax) * 100)}%`,
                  }}
                />
                <span className="text-center text-[10px] font-semibold text-slate-400">
                  {metric.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
                Attention
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Reminders
              </h2>
            </div>
            <BellRing className="h-5 w-5 text-brand-pink" />
          </div>
          <div className="mt-7">
            <p className="text-2xl font-semibold leading-tight tracking-[-0.04em] text-brand-text">
              {stats.data?.expiring_documents
                ? "Review expiring documents"
                : "Workspace is up to date"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {stats.data?.expiring_documents
                ? `${stats.data.expiring_documents} document${stats.data.expiring_documents === 1 ? "" : "s"} need attention within 30 days.`
                : "No renewal reminders are waiting for you."}
            </p>
            <Link
              href="/pages/organization"
              className="mt-7 flex items-center justify-center gap-2 rounded-full bg-brand-pink px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-text"
            >
              {stats.data?.expiring_documents ? "Review now" : "Browse records"}{" "}
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
                Collaboration
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Team activity
              </h2>
            </div>
            <Users className="h-5 w-5 text-brand-pink" />
          </div>
          <div className="mt-5 space-y-4">
            {documentRows.slice(0, 3).map((document, index) => {
              const name =
                document.employee_name !== "N/A"
                  ? document.employee_name
                  : document.folder_name;
              const initials = name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <div key={document.id} className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full ${["bg-pink-100", "bg-pink-200", "bg-pink-50"][index]} text-xs font-bold text-brand-text`}
                  >
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {name}
                    </p>
                    <p className="truncate text-xs capitalize text-slate-400">
                      {document.state} document
                    </p>
                  </div>
                  <span className="ml-auto text-[10px] text-slate-400">
                    {document.created_at.slice(0, 10)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
                Compliance
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Approval progress
              </h2>
            </div>
            <ShieldCheck className="h-5 w-5 text-brand-pink" />
          </div>
          <div className="mt-6 flex items-center justify-center">
            <div
              className="relative flex h-44 w-44 items-center justify-center rounded-full"
              style={{
                background: `conic-gradient(#e83e8c 0 ${approvalProgress}%, #f3a6c5 ${approvalProgress}% 82%, #f7d9e5 82% 100%)`,
              }}
            >
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-full bg-white">
                <span className="text-4xl font-semibold tracking-[-0.06em] text-slate-950">
                  {documents.isLoading ? "-" : `${approvalProgress}%`}
                </span>
                <span className="text-xs text-slate-400">approved</span>
              </div>
            </div>
          </div>
          <div className="mt-5 flex justify-center gap-4 text-[10px] font-semibold text-slate-500">
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-brand-pink" />
              Approved
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-pink-300" />
              Review
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-2 w-2 rounded-full bg-pink-100" />
              Pending
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-pink">
                Workspace
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                Quick actions
              </h2>
            </div>
            <ArrowUpRight className="h-5 w-5 text-brand-pink" />
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <Link
              href="/pages/employee"
              className="flex items-center justify-between rounded-xl border border-pink-100 bg-pink-50/50 p-4 text-sm font-semibold text-brand-text transition hover:bg-pink-100"
            >
              <span className="flex items-center gap-3">
                <Users className="h-4 w-4" />
                Employee files
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pages/organization"
              className="flex items-center justify-between rounded-xl border border-pink-100 bg-pink-50/50 p-4 text-sm font-semibold text-brand-text transition hover:bg-pink-100"
            >
              <span className="flex items-center gap-3">
                <FolderKanban className="h-4 w-4" />
                Company records
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pages/document-intelligence"
              className="flex items-center justify-between rounded-xl border border-pink-100 bg-pink-50/50 p-4 text-sm font-semibold text-brand-text transition hover:bg-pink-100"
            >
              <span className="flex items-center gap-3">
                <Brain className="h-4 w-4" />
                Ask AI
              </span>
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <div className="rounded-2xl bg-gradient-to-br from-brand-text to-brand-pink p-6 text-white shadow-lg shadow-pink-200">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-pink-100">
            Document health
          </p>
          <h2 className="mt-2 text-2xl font-bold">
            Keep your workspace audit-ready.
          </h2>
          <p className="mt-3 text-sm leading-6 text-pink-100">
            Stay ahead of renewals, approvals, and missing employee records.
          </p>
          <Link
            href="/pages/document-intelligence"
            className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-bold text-brand-text transition hover:bg-pink-50"
          >
            Open intelligence <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
