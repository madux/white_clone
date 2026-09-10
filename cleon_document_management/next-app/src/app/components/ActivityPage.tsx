"use client";

import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useWorkspaceActivity } from "../../../hooks/useDocuments";
import { documentViewHref } from "../../../lib/documentLinks";
import type {
  WorkspaceActivity,
  WorkspaceActivityEvent,
  WorkspacePendingAcknowledgement,
} from "../../../lib/types";
import AdminOnly from "./AdminOnly";

type Tab = "log" | "acknowledgements" | "pending";

const tabs: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "log", label: "Activity log", icon: Activity },
  { id: "acknowledgements", label: "Acknowledgements", icon: CheckCircle2 },
  { id: "pending", label: "Pending acknowledgement", icon: Clock3 },
];

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

function documentLink(
  item: {
    document_id: number;
    folder_id: number;
    folder_type?: string;
    employee_id?: number | false;
  },
) {
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

function ActivityLogTab({ events }: { events: WorkspaceActivityEvent[] }) {
  if (!events.length) {
    return (
      <p className="py-16 text-center text-sm text-slate-400">
        No workspace activity recorded yet.
      </p>
    );
  }
  return (
    <div className="divide-y divide-slate-100">
      {events.map((event) => {
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
  );
}

function AcknowledgementsTab({
  items,
}: {
  items: WorkspaceActivity["recent_acknowledgements"];
}) {
  if (!items.length) {
    return (
      <p className="py-16 text-center text-sm text-slate-400">
        No acknowledgements recorded yet.
      </p>
    );
  }
  return (
    <div className="divide-y divide-slate-100">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-4 py-4"
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800">
              {item.employee_name} acknowledged{" "}
              <span className="text-brand-text">{item.document_name}</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">{item.folder_name}</p>
            <Link
              href={documentLink(item)}
              className="mt-2 inline-flex text-xs font-bold text-brand-pink hover:underline"
            >
              View document
            </Link>
          </div>
          <time className="shrink-0 text-xs text-slate-400">
            {formatWhen(item.acknowledged_at)}
          </time>
        </div>
      ))}
    </div>
  );
}

function PendingTab({
  items,
}: {
  items: WorkspacePendingAcknowledgement[];
}) {
  if (!items.length) {
    return (
      <p className="py-16 text-center text-sm text-slate-400">
        Everyone in scope has acknowledged their organizational documents.
      </p>
    );
  }
  return (
    <div className="space-y-4">
      {items.map((item) => (
        <article
          key={item.document_id}
          className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-slate-900">
                {item.document_name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {item.document_type} · {item.folder_name}
              </p>
            </div>
            <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold text-amber-700">
              {item.acknowledged_count}/{item.audience_count} acknowledged
            </span>
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
              Still pending in folder scope
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {item.pending_employees.map((employee) => (
                <li
                  key={employee.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                >
                  <Users className="h-3 w-3 text-slate-400" />
                  {employee.name}
                </li>
              ))}
            </ul>
          </div>
          <Link
            href={documentLink(item)}
            className="mt-4 inline-flex text-xs font-bold text-brand-pink hover:underline"
          >
            View document
          </Link>
        </article>
      ))}
    </div>
  );
}

function ActivityPageContent() {
  const params = useSearchParams();
  const activity = useWorkspaceActivity();
  const [tab, setTab] = useState<Tab>("log");

  useEffect(() => {
    const requested = params.get("tab");
    if (requested === "acknowledgements" || requested === "pending" || requested === "log") {
      setTab(requested);
    }
  }, [params]);

  const data = activity.data;
  const counts = useMemo(
    () => ({
      log: data?.activity_log.length ?? 0,
      acknowledgements: data?.recent_acknowledgements.length ?? 0,
      pending: data?.pending_acknowledgements.length ?? 0,
    }),
    [data],
  );

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
          Track document events, employee acknowledgements, and who still needs
          to acknowledge files within each folder&apos;s access scope.
        </p>
      </div>

      {activity.isError && (
        <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          Activity data could not be loaded.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition ${
                tab === item.id
                  ? "bg-gradient-to-r from-brand-text to-brand-pink text-white shadow-md shadow-pink-200"
                  : "bg-white text-slate-500 hover:bg-pink-50"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
              <span className="opacity-80">{counts[item.id]}</span>
            </button>
          );
        })}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {activity.isLoading ? (
          <div className="space-y-3 py-8">
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
          </div>
        ) : tab === "log" ? (
          <ActivityLogTab events={data?.activity_log ?? []} />
        ) : tab === "acknowledgements" ? (
          <AcknowledgementsTab items={data?.recent_acknowledgements ?? []} />
        ) : (
          <PendingTab items={data?.pending_acknowledgements ?? []} />
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
