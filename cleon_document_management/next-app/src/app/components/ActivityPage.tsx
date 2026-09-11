"use client";

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useWorkspaceActivity } from "../../../hooks/useDocuments";
import { documentViewHref } from "../../../lib/documentLinks";
import type { WorkspaceActivityEvent } from "../../../lib/types";
import AdminOnly from "./AdminOnly";

function formatWhen(value: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(String(value).replace(" ", "T")));
}

function eventIcon(kind: WorkspaceActivityEvent["kind"]) {
  if (kind === "acknowledgement") return CheckCircle2;
  if (kind === "approval") return AlertCircle;
  if (kind === "upload") return FileText;
  return Activity;
}

function documentLink(item: {
  document_id: number;
  folder_id: number;
  folder_type?: string;
  employee_id?: number | false;
}) {
  return documentViewHref(
    {
      id: item.document_id,
      folder_id: item.folder_id,
      employee_id: item.employee_id,
      folder_type: item.folder_type,
    },
    true,
  );
}

function ActivityPageContent() {
  const activity = useWorkspaceActivity();
  const data = activity.data;

  return (
    <div className="mx-auto min-h-full max-w-[1200px] space-y-6 bg-slate-50 p-6 pb-10">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-pink">
          Workspace
        </p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
          Activity
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-500">
          Track document uploads, approvals, and acknowledgements across the
          workspace.
        </p>
      </div>

      {activity.isError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          Activity data could not be loaded.
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {activity.isLoading ? (
          <div className="space-y-3 py-8">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : !data?.activity_log.length ? (
          <p className="py-16 text-center text-sm text-slate-400">
            No workspace activity recorded yet.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {data.activity_log.map((event) => {
              const Icon = eventIcon(event.kind);
              return (
                <div
                  key={`${event.id}-${event.occurred_at}`}
                  className="flex items-start justify-between gap-4 py-4"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-brand-pink">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {event.message}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {event.actor_name} · {event.folder_name}
                      </p>
                      <Link
                        href={documentLink(event)}
                        className="mt-2 inline-flex text-xs font-bold text-brand-pink hover:underline"
                      >
                        View document
                      </Link>
                    </div>
                  </div>
                  <time className="shrink-0 text-xs text-slate-400">
                    {formatWhen(event.occurred_at)}
                  </time>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default function ActivityPage() {
  return (
    <AdminOnly>
      <ActivityPageContent />
    </AdminOnly>
  );
}
