"use client";

import Link from "next/link";
import {
  Briefcase,
  CheckCircle2,
  FileText,
  PencilLine,
  Upload,
} from "lucide-react";
import { useMemo } from "react";
import {
  WORK_ITEM_GROUP_LABELS,
  type WorkspaceWorkItem,
  type WorkspaceWorkItemsPayload,
} from "../../../lib/workspaceWorkItems";
import EmptyState from "./EmptyState";
import WorkspaceSummaryCards from "./WorkspaceSummaryCards";

function itemIcon(kind: string) {
  if (kind === "signature" || kind === "sign") {
    return PencilLine;
  }
  if (kind === "upload") {
    return Upload;
  }
  if (kind === "policy" || kind === "compliance") {
    return CheckCircle2;
  }
  if (kind === "form") {
    return FileText;
  }
  return Briefcase;
}

function groupItems(items: WorkspaceWorkItem[]) {
  const overdue = items.filter((item) => item.urgency === "overdue");
  const dueThisWeek = items.filter((item) => item.urgency === "due_this_week");
  return [
    { id: "overdue" as const, items: overdue },
    { id: "due_this_week" as const, items: dueThisWeek },
  ].filter((group) => group.items.length > 0);
}

export default function WorkspaceTodoTab({
  payload,
  loading,
}: {
  payload: WorkspaceWorkItemsPayload | null;
  loading: boolean;
}) {
  const groups = useMemo(
    () => groupItems(payload?.items || []),
    [payload?.items],
  );

  if (loading && !payload) {
    return <p className="text-sm text-slate-500">Loading your to do list…</p>;
  }

  if (!payload) {
    return (
      <EmptyState
        title="Could not load to do"
        description="Try refreshing the page."
      />
    );
  }

  return (
    <div className="space-y-6">
      <WorkspaceSummaryCards summary={payload.summary} />

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">To do</h2>

        {!groups.length ? (
          <EmptyState
            title="You're all caught up"
            description="Approvals, signatures, uploads, and policy tasks assigned to you will appear here."
          />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.id}>
                <p className="mb-2 text-xs font-bold tracking-wide text-slate-400">
                  {WORK_ITEM_GROUP_LABELS[group.id]}
                </p>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {group.items.map((item) => {
                    const Icon = itemIcon(item.icon || item.kind);
                    const statusTone =
                      item.status_tone === "danger"
                        ? "border-red-100 bg-red-50 text-red-700"
                        : "border-slate-200 bg-slate-50 text-slate-600";
                    return (
                      <li
                        key={item.id}
                        className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <span
                            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600"
                          >
                            <Icon className="h-4 w-4" aria-hidden />
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">{item.title}</p>
                            {item.subtitle ? (
                              <p className="text-sm text-slate-500">{item.subtitle}</p>
                            ) : null}
                            {item.status_label ? (
                              <span
                                className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${statusTone}`}
                              >
                                {item.status_label}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        {item.href ? (
                          <Link
                            href={item.href}
                            className={
                              item.action_variant === "primary"
                                ? "inline-flex h-8 shrink-0 items-center justify-center self-start rounded-lg bg-brand-pink px-3 text-xs font-bold text-white sm:self-center"
                                : "inline-flex h-8 shrink-0 items-center justify-center self-start rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 sm:self-center"
                            }
                          >
                            {item.action_label}
                          </Link>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
